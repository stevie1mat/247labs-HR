import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import * as pdfjs from "https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.js";

// Basic CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logActivity(supabaseAdmin: any, entry: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("activityLogs").insert(entry);
  if (error) {
    console.error("Failed to write activity log", error);
  }
}

async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      // @ts-ignore - items has str
      .map((item) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }

  return fullText;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { applicantId } = await req.json();
    if (!applicantId) {
      throw new Error("Missing applicantId");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Fetch the applicant
    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from("applicants")
      .select("*, jobPostings(*)")
      .eq("id", applicantId)
      .single();

    if (applicantError || !applicant) {
      throw new Error(`Applicant not found: ${applicantError?.message}`);
    }

    const jobPosting = applicant.jobPostings;
    if (!jobPosting) {
      throw new Error("Applicant is not associated with a job posting.");
    }

    let resumeText = "";
    
    // Check if there is a resume URL and it is a PDF
    if (applicant.resumeUrl && applicant.resumeUrl.toLowerCase().endsWith(".pdf")) {
      console.log(`Downloading resume from: ${applicant.resumeUrl}`);
      try {
        let fetchUrl = applicant.resumeUrl;
        
        // If it's a relative path in Supabase storage, construct the full URL
        if (!fetchUrl.startsWith("http")) {
           // Wait, usually resumeUrl from Elementor is absolute, but if uploaded to Supabase it might be a path.
           // In our frontend, it's just a file name if uploaded directly? Let's check.
           // For now, we assume if it doesn't start with http, it's in the 'resumes' bucket
           const { data: publicUrlData } = supabaseAdmin.storage.from("resumes").getPublicUrl(fetchUrl);
           fetchUrl = publicUrlData.publicUrl;
        }

        const response = await fetch(fetchUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          resumeText = await extractTextFromPDF(arrayBuffer);
          console.log(`Extracted ${resumeText.length} characters from PDF.`);
        } else {
          console.error(`Failed to download resume: ${response.statusText}`);
        }
      } catch (err) {
        console.error("Error extracting text from PDF", err);
      }
    }

    // If we couldn't get the resume text, fallback to cover letter or portfolio as "resume"
    if (!resumeText.trim()) {
      resumeText = [
        applicant.coverLetter ? `Cover Letter:\n${applicant.coverLetter}` : "",
        applicant.portfolio ? `Portfolio/Links:\n${applicant.portfolio}` : ""
      ].join("\n\n").trim();
    }

    if (!resumeText) {
      throw new Error("Could not extract any resume text or cover letter to evaluate.");
    }

    // Prepare prompt for Groq
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY is missing");
    }

    const systemPrompt = `You are an expert HR Technical Recruiter. Your task is to evaluate a candidate's resume against a job description.
You MUST respond with a valid JSON object matching this schema exactly:
{
  "aiSummary": "A 2-3 sentence summary of the applicant's fit for the role.",
  "aiScore": <number 0-100>,
  "educationScore": <number 0-100>,
  "experienceScore": <number 0-100>,
  "locationScore": <number 0-100>,
  "skillsScore": <number 0-100>
}
Be objective. If a category (like location) is not mentioned in the resume but is required, give a neutral score (e.g., 50) or infer from context. Ensure aiScore is a weighted average of the sub-scores.`;

    const userPrompt = `
JOB POSTING:
Title: ${jobPosting.title}
Description:
${jobPosting.description || "N/A"}
Requirements:
${jobPosting.requirements || "N/A"}
Location Requirement: ${jobPosting.location || "Remote/Unspecified"}

APPLICANT RESUME TEXT:
Name: ${applicant.name}
${resumeText}

Analyze the applicant and return the JSON evaluation.
`;

    console.log("Calling Groq API...");
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API Error: ${errorText}`);
    }

    const groqData = await groqResponse.json();
    const evaluationStr = groqData.choices[0].message.content;
    let evaluation;
    try {
      evaluation = JSON.parse(evaluationStr);
    } catch (err) {
      throw new Error(`Failed to parse Groq response: ${evaluationStr}`);
    }

    // Update the applicant in the database
    const { error: updateError } = await supabaseAdmin
      .from("applicants")
      .update({
        aiSummary: evaluation.aiSummary,
        aiScore: evaluation.aiScore,
        educationScore: evaluation.educationScore,
        experienceScore: evaluation.experienceScore,
        locationScore: evaluation.locationScore,
        skillsScore: evaluation.skillsScore,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", applicantId);

    if (updateError) {
      throw updateError;
    }

    // Log the activity
    await logActivity(supabaseAdmin, {
      action: "applicant_evaluated",
      category: "applicants",
      entityType: "applicant",
      entityId: applicantId,
      title: `AI Evaluation complete for ${applicant.name || "applicant"}`,
      detail: `Applicant scored ${evaluation.aiScore}/100.`,
      platform: "internal",
      sourceName: "AI Automation",
      statusTone: evaluation.aiScore >= 75 ? "success" : "neutral",
      jobPostingId: jobPosting.id,
      metadata: {
        applicantId,
        scores: evaluation
      },
    });

    return new Response(JSON.stringify({ success: true, evaluation }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Evaluation error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
