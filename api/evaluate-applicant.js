import { createClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";
import { inflateRawSync } from "node:zlib";

function json(res, status, body) {
  if (typeof res.status === "function") {
    res.status(status).setHeader("Content-Type", "application/json");
  } else {
    res.writeHead(status, { "Content-Type": "application/json" });
  }
  res.end(JSON.stringify(body));
}

function getSupabaseClient(req) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const authHeader = req.headers.authorization || "";

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase URL or anon key is missing in Vercel environment variables.");
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
}

function extractDocxText(buffer) {
  // DOCX files are ZIP archives. Read the central directory to locate the
  // compressed Word document XML without requiring another runtime package.
  let endOfDirectory = -1;
  const searchStart = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= searchStart; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOfDirectory = offset;
      break;
    }
  }

  if (endOfDirectory < 0) throw new Error("Invalid DOCX: ZIP directory was not found.");

  const entryCount = buffer.readUInt16LE(endOfDirectory + 10);
  let offset = buffer.readUInt32LE(endOfDirectory + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid DOCX: malformed ZIP directory.");
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);

    if (fileName === "word/document.xml") {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error("Invalid DOCX: malformed document entry.");
      }

      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const xmlBuffer = compressionMethod === 0
        ? compressed
        : compressionMethod === 8
          ? inflateRawSync(compressed)
          : null;

      if (!xmlBuffer) {
        throw new Error(`Unsupported DOCX compression method: ${compressionMethod}.`);
      }

      return xmlBuffer
        .toString("utf8")
        .replace(/<w:tab\s*\/>/g, "\t")
        .replace(/<w:(?:br|cr)(?:\s[^>]*)?\s*\/>/g, "\n")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<\/w:tc>/g, "\t")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("Invalid DOCX: word/document.xml was not found.");
}

async function extractResumeText(resumeUrl, resumeFileName) {
  if (!resumeUrl) return "";

  const response = await fetch(resumeUrl);
  if (!response.ok) {
    throw new Error(`Could not download resume (${response.status}).`);
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const name = String(resumeFileName || resumeUrl).toLowerCase().split("?")[0];
  const isPdf = name.endsWith(".pdf") || contentType.includes("application/pdf") ||
    buffer.subarray(0, 4).toString("ascii") === "%PDF";
  const isDocx = name.endsWith(".docx") || contentType.includes("application/vnd.openxmlformats") ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b);

  if (isPdf) {
    const parsed = await pdfParse(buffer);
    return parsed.text || "";
  }
  if (isDocx) return extractDocxText(buffer);

  throw new Error("Unsupported resume format. Upload a PDF or DOCX file.");
}

function normalizeEvaluation(value) {
  const score = (input) => {
    const parsed = Number(input);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(100, Math.round(parsed)));
  };

  return {
    aiSummary: String(value.aiSummary || "Evaluation completed."),
    aiScore: score(value.aiScore),
    educationScore: score(value.educationScore),
    experienceScore: score(value.experienceScore),
    locationScore: score(value.locationScore),
    skillsScore: score(value.skillsScore),
    scoreRationale: {
      education: String(value.scoreRationale?.education || ""),
      experience: String(value.scoreRationale?.experience || ""),
      location: String(value.scoreRationale?.location || ""),
      skills: String(value.scoreRationale?.skills || ""),
      overall: String(value.scoreRationale?.overall || ""),
    },
    strengths: Array.isArray(value.strengths) ? value.strengths.map(String).slice(0, 5) : [],
    concerns: Array.isArray(value.concerns) ? value.concerns.map(String).slice(0, 5) : [],
  };
}

function buildEvaluationMessages({ applicant, jobPosting, resumeText }) {
  const systemPrompt = `You are an expert HR Technical Recruiter. Your task is to rigidly scrutinize a candidate's resume strictly against the provided job description template.
Return only valid JSON with this exact schema:
{
  "aiSummary": "A 2-3 sentence summary of the applicant's fit specifically mapped to the core requirements.",
  "aiScore": 0,
  "educationScore": 0,
  "experienceScore": 0,
  "locationScore": 0,
  "skillsScore": 0,
  "scoreRationale": {
    "education": "Why this education score was assigned.",
    "experience": "Why this experience score was assigned.",
    "location": "Why this location score was assigned.",
    "skills": "Why this skills score was assigned.",
    "overall": "Why this overall score was assigned."
  },
  "strengths": ["Specific template matches"],
  "concerns": ["Missing requirements or gaps"]
}
Use scores from 0 to 100. Score based on evidence in the resume text and the role requirements. Be brutally objective and penalize heavily for missing requirements.`;

  const userPrompt = `
JOB POSTING:
Title: ${jobPosting.title || "N/A"}
Description:
${jobPosting.description || "N/A"}
Requirements:
${jobPosting.requirements || "N/A"}
Location Requirement: ${jobPosting.location || "Remote/Unspecified"}

APPLICANT:
Name: ${applicant.name || "N/A"}
Email: ${applicant.email || "N/A"}
Portfolio: ${applicant.portfolio || "N/A"}
Cover Letter:
${applicant.coverLetter || "N/A"}

RESUME TEXT EXTRACTED FROM THE UPLOADED FILE:
${resumeText || "No parseable resume text was found."}
`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

async function callChatCompletion({ provider, apiKey, model, messages }) {
  const apiUrl = provider === "groq"
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";

  const aiResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  if (!aiResponse.ok) {
    throw new Error(`${provider === "groq" ? "Groq" : "OpenAI"} API Error: ${await aiResponse.text()}`);
  }

  const aiData = await aiResponse.json();
  const content = aiData.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI response did not include evaluation content.");
  }

  return normalizeEvaluation(JSON.parse(content));
}

async function evaluateWithAi({ applicant, jobPosting, resumeText }) {
  const messages = buildEvaluationMessages({ applicant, jobPosting, resumeText });
  const openAiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (openAiKey) {
    try {
      return await callChatCompletion({
        provider: "openai",
        apiKey: openAiKey,
        model: process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini",
        messages,
      });
    } catch (error) {
      if (!groqKey) {
        throw error;
      }
      console.error("OpenAI evaluation failed, falling back to Groq:", error.message);
    }
  }

  if (!groqKey) {
    throw new Error("OPENAI_API_KEY is missing or invalid, and GROQ_API_KEY fallback is not configured.");
  }

  return await callChatCompletion({
    provider: "groq",
    apiKey: groqKey,
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    messages,
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const { applicantId } = req.body || {};
    if (!applicantId) {
      throw new Error("Missing applicantId");
    }

    const supabase = getSupabaseClient(req);
    const { data: applicant, error: applicantError } = await supabase
      .from("applicants")
      .select("*")
      .eq("id", applicantId)
      .single();

    if (applicantError || !applicant) {
      throw new Error(`Applicant not found: ${applicantError?.message || "No applicant returned"}`);
    }

    if (!applicant.jobPostingId) {
      throw new Error("Applicant is not associated with a job posting.");
    }

    const { data: jobPosting, error: jobPostingError } = await supabase
      .from("jobPostings")
      .select("*")
      .eq("id", applicant.jobPostingId)
      .single();

    if (jobPostingError || !jobPosting) {
      throw new Error(`Job posting not found: ${jobPostingError?.message || "No posting returned"}`);
    }

    const resumeText = await extractResumeText(applicant.resumeUrl, applicant.resumeFileName);
    if (!resumeText.trim()) {
      throw new Error("The resume file did not contain readable text.");
    }
    const evaluation = await evaluateWithAi({ applicant, jobPosting, resumeText });

    const { error: updateError } = await supabase
      .from("applicants")
      .update({
        aiSummary: evaluation.aiSummary,
        aiScore: evaluation.aiScore,
        educationScore: evaluation.educationScore,
        experienceScore: evaluation.experienceScore,
        locationScore: evaluation.locationScore,
        skillsScore: evaluation.skillsScore,
        metadata: {
          ...(applicant.metadata || {}),
          evaluationDetails: {
            scoreRationale: evaluation.scoreRationale,
            strengths: evaluation.strengths,
            concerns: evaluation.concerns,
            resumeTextLength: resumeText.length,
            evaluatedAt: new Date().toISOString(),
          },
        },
        updatedAt: new Date().toISOString(),
      })
      .eq("id", applicantId);

    if (updateError) {
      throw updateError;
    }

    await supabase.from("activityLogs").insert({
      action: "applicant_evaluated",
      category: "applicants",
      entityType: "applicant",
      entityId: applicantId,
      title: `AI Evaluation complete for ${applicant.name || "applicant"}`,
      detail: `Applicant scored ${evaluation.aiScore}/100 using extracted resume text.`,
      platform: "internal",
      sourceName: "AI Automation",
      statusTone: evaluation.aiScore >= 75 ? "success" : "neutral",
      jobPostingId: jobPosting.id,
      metadata: {
        applicantId,
        resumeTextLength: resumeText.length,
        scores: evaluation,
        scoreRationale: evaluation.scoreRationale,
        strengths: evaluation.strengths,
        concerns: evaluation.concerns,
      },
    });

    json(res, 200, { success: true, evaluation, resumeTextLength: resumeText.length });
  } catch (error) {
    json(res, 400, { error: error.message || "Unknown evaluation error" });
  }
}
