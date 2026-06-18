import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      .select("*")
      .eq("id", applicantId)
      .single();

    if (applicantError || !applicant) {
      throw new Error(`Applicant not found: ${applicantError?.message}`);
    }

    if (!applicant.jobPostingId) {
      throw new Error("Applicant is not associated with a job posting.");
    }

    const { data: jobPosting, error: jobPostingError } = await supabaseAdmin
      .from("jobPostings")
      .select("*")
      .eq("id", applicant.jobPostingId)
      .single();

    if (jobPostingError || !jobPosting) {
      throw new Error(`Job posting not found: ${jobPostingError?.message}`);
    }

    const rawSubmission = applicant.metadata?.rawSubmission || {};
    const resumeText = [
      applicant.coverLetter ? `Cover Letter:\n${applicant.coverLetter}` : "",
      applicant.portfolio ? `Portfolio/Links:\n${applicant.portfolio}` : "",
      applicant.resumeUrl ? `Resume URL:\n${applicant.resumeUrl}` : "",
      applicant.resumeFileName ? `Resume File:\n${applicant.resumeFileName}` : "",
      Object.keys(rawSubmission).length > 0 ? `Form Submission:\n${JSON.stringify(rawSubmission, null, 2)}` : "",
    ].join("\n\n").trim();

    if (!resumeText) {
      throw new Error("Could not find any applicant submission details to evaluate.");
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is missing");
    }

    const systemPrompt = `You are an expert HR Technical Recruiter. Your task is to rigidly scrutinize a candidate's resume strictly against the provided job description template.
You MUST respond with a valid JSON object matching this schema exactly:
{
  "aiSummary": "A 2-3 sentence summary of the applicant's fit specifically mapped to the core requirements.",
  "aiScore": <number 0-100>,
  "educationScore": <number 0-100>,
  "experienceScore": <number 0-100>,
  "locationScore": <number 0-100>,
  "skillsScore": <number 0-100>,
  "strengths": ["string", "string"],
  "concerns": ["string", "string"],
  "scoreRationale": {
    "education": "string",
    "experience": "string",
    "location": "string",
    "skills": "string",
    "overall": "string"
  }
}
Be brutally objective. If a requirement from the template is missing from the resume, flag it in "concerns" and penalize the score heavily. "strengths" should only list items that strictly match the template requirements. Provide clear, concise reasoning in "scoreRationale" for why each sub-score was given based on the evidence.`;

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

    const aiUrl = "https://api.openai.com/v1/chat/completions";
    const model = Deno.env.get("OPENAI_MODEL") || Deno.env.get("AI_MODEL") || "gpt-4o-mini";

    console.log("Calling OpenAI API...");
    const aiResponse = await fetch(aiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      throw new Error(`OpenAI API Error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const evaluationStr = aiData.choices[0].message.content;
    let evaluation;
    try {
      evaluation = JSON.parse(evaluationStr);
    } catch (err) {
      throw new Error(`Failed to parse OpenAI response: ${evaluationStr}`);
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
        metadata: {
          ...applicant.metadata,
          evaluationDetails: {
            strengths: evaluation.strengths || [],
            concerns: evaluation.concerns || [],
            scoreRationale: evaluation.scoreRationale || {},
            resumeTextLength: resumeText.length
          }
        },
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
