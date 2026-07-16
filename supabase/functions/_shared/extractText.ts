import JSZip from "https://esm.sh/jszip@3.10.1";

/**
 * Given a resume URL, downloads the file and extracts its text content.
 * Supports .docx and .pdf files.
 * Returns the extracted text, or an empty string if extraction fails.
 */
export async function extractResumeText(
  resumeUrl: string,
  resumeFileName?: string,
): Promise<string> {
  if (!resumeUrl) return "";

  let extension = detectExtension(resumeUrl, resumeFileName);

  try {
    console.log(`Downloading resume from: ${resumeUrl}`);
    const response = await fetch(resumeUrl);
    if (!response.ok) {
      console.error(`Failed to download resume: ${response.status} ${response.statusText}`);
      return "";
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("text/html")) {
      console.error("Resume URL returned HTML instead of the uploaded file");
      return "";
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) return "";

    // Signed/storage URLs do not always retain the original filename. Use the
    // response MIME type and file signature when the extension is unavailable.
    extension ||= extensionFromContentType(contentType);
    extension ||= detectExtensionFromBytes(buffer);
    console.log(`Downloaded ${buffer.byteLength} bytes, detected extension: ${extension}`);

    if (extension === "docx") {
      return await extractDocxText(buffer);
    } else if (extension === "pdf") {
      return await extractPdfText(buffer);
    } else if (extension === "doc") {
      // .doc (legacy binary format) is extremely hard to parse without native libs.
      // Return a note so the AI knows it couldn't be read.
      console.warn(".doc format detected — cannot extract text in Edge Function.");
      return "[Resume was uploaded as a .doc file, which cannot be parsed. Only the metadata is available.]";
    } else {
      // Try to read as plain text (e.g., .txt, .rtf)
      try {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        return decoder.decode(buffer);
      } catch {
        console.warn(`Unknown file format: ${extension}`);
        return "";
      }
    }
  } catch (error) {
    console.error("Error extracting resume text:", error);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectExtension(url: string, fileName?: string): string {
  // Try filename first, then URL path
  const source = fileName || url;
  try {
    const pathname = new URL(source).pathname;
    const ext = pathname.split(".").pop()?.toLowerCase()?.split("?")[0];
    if (ext) return ext;
  } catch {
    // fileName may not be a URL — just parse directly
    const ext = source.split(".").pop()?.toLowerCase()?.split("?")[0];
    if (ext) return ext;
  }
  return "";
}

function extensionFromContentType(contentType: string): string {
  if (contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
    return "docx";
  }
  if (contentType.includes("application/pdf")) return "pdf";
  if (contentType.includes("application/msword")) return "doc";
  return "";
}

function detectExtensionFromBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 5));
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return "docx";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return "pdf";
  }
  return "";
}

// ---------------------------------------------------------------------------
// DOCX extraction
// .docx is a ZIP archive; the main body text lives in word/document.xml.
// We unzip it with JSZip, read that XML file, then strip tags to get text.
// ---------------------------------------------------------------------------

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  const documentXml = zip.file("word/document.xml");
  if (!documentXml) {
    console.error("word/document.xml not found in the .docx archive");
    return "";
  }

  const xmlContent = await documentXml.async("text");

  // Extract text from <w:t> elements (the Word text nodes).
  // We also handle paragraph boundaries (<w:p>) to insert newlines.
  const text = xmlContent
    // Preserve layout markers before removing the XML tags.
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<w:(?:br|cr)(?:\s[^>]*)?\s*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tc>/g, "\t")
    // Strip all remaining XML tags
    .replace(/<[^>]+>/g, "")
    // Decode common XML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    // Clean up excessive whitespace
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  console.log(`Extracted ${text.length} characters from .docx`);
  return text;
}

// ---------------------------------------------------------------------------
// PDF extraction (lightweight, no external library)
// Scans the raw PDF byte stream for text-rendering operators (Tj, TJ, ').
// This is a best-effort parser that works for most digitally-created PDFs.
// Scanned-image PDFs will return little or no text.
// ---------------------------------------------------------------------------

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const raw = new TextDecoder("latin1").decode(bytes);
  const textParts: string[] = [];

  // Strategy 1: Look for BT ... ET blocks (text objects) and extract Tj/TJ operands
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let btMatch;

  while ((btMatch = btEtRegex.exec(raw)) !== null) {
    const block = btMatch[1];

    // Tj operator: (string) Tj
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(block)) !== null) {
      textParts.push(decodePdfString(tjMatch[1]));
    }

    // TJ operator: [(string) num (string) ...] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let tjArrMatch;
    while ((tjArrMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = tjArrMatch[1];
      const strRegex = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(inner)) !== null) {
        textParts.push(decodePdfString(strMatch[1]));
      }
    }

    // ' operator (move to next line and show string): (string) '
    const quoteRegex = /\(([^)]*)\)\s*'/g;
    let quoteMatch;
    while ((quoteMatch = quoteRegex.exec(block)) !== null) {
      textParts.push(decodePdfString(quoteMatch[1]));
    }
  }

  // Join and clean up
  let text = textParts
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .replace(/(\w)- (\w)/g, "$1$2") // fix hyphenation
    .trim();

  // If we got very little text, the PDF might be image-based
  if (text.length < 50) {
    console.warn("PDF text extraction yielded very little text — the PDF may be image-based/scanned.");
    if (text.length === 0) {
      text = "[Resume was uploaded as a PDF but appears to be image-based/scanned. Text could not be extracted.]";
    }
  }

  console.log(`Extracted ${text.length} characters from PDF`);
  return text;
}

function decodePdfString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}
