import { createClient } from "@supabase/supabase-js";
import pdfParse from "pdf-parse";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
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

async function extractPdfText(resumeUrl) {
  if (!resumeUrl) return "";

  const response = await fetch(resumeUrl);
  if (!response.ok) {
    throw new Error(`Could not download resume PDF (${response.status}).`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("pdf") && !resumeUrl.toLowerCase().includes(".pdf")) {
    return "";
  }

  const arrayBuffer = await response.arrayBuffer();
  const parsed = await pdfParse(Buffer.from(arrayBuffer));
  return parsed.text || "";
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
  };
}

function buildEvaluationMessages({ applicant, jobPosting, resumeText }) {
  const systemPrompt = `You are an expert HR Technical Recruiter. Evaluate the candidate's resume against the job posting.
Return only valid JSON with this exact schema:
{
  "aiSummary": "A 2-3 sentence summary of the applicant's fit for the role.",
  "aiScore": 0,
  "educationScore": 0,
  "experienceScore": 0,
  "locationScore": 0,
  "skillsScore": 0
}
Use scores from 0 to 100. Score based on evidence in the resume text and the role requirements.`;

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

RESUME TEXT EXTRACTED FROM PDF:
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

    const resumeText = await extractPdfText(applicant.resumeUrl);
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
      },
    });

    json(res, 200, { success: true, evaluation, resumeTextLength: resumeText.length });
  } catch (error) {
    json(res, 400, { error: error.message || "Unknown evaluation error" });
  }
}
