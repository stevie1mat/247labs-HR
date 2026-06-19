import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEMPLATE_INSTRUCTIONS = `
We need 5 screening questions tailored to the provided job posting. Use the following categories as inspiration, but adapt the questions specifically to the role's title and description.

Category 1: Company Familiarity
Template Reference: "After reviewing 247 Labs, can you share what stood out to you about our business and how you see your experience aligning with the type of work we do?"
Goal: Gauge if they researched the company and understand the specific role.

Category 2: Relevant Experience
Template Reference: "Have you previously worked with a digital agency, software development company, or IT services firm in a lead generation or digital marketing capacity? If so, please describe the company, the scope of your role, and the results you delivered."
Goal: Ask about past experience relevant to the specific skills required for this job.

Category 3: Strategy & Approach
Template Reference: "What are the primary lead generation channels and methods you have used to generate qualified B2B leads? Please walk us through your typical approach when building a lead generation campaign from scratch."
Goal: Understand their methodology and strategic thinking related to the core responsibilities of this role.

Category 4: Performance & Outcomes
Template Reference: "Based on your past experience, what volume of qualified leads were you able to generate on a daily or weekly basis? Please include the channels used, the target audience, and any measurable outcomes such as conversion rates or cost per lead."
Goal: Ask for concrete metrics, scale, or tangible results they achieved in past similar roles.

Category 5: Specific Example / Portfolio
Template Reference: "Please share one specific example of a B2B lead generation campaign you have owned end-to-end — including the objective, the strategy you executed, the tools you used, and the results achieved."
Goal: Request a specific case study, project, or example demonstrating their competence in this exact field.
`;

function getAiConfig() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  return {
    apiKey,
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: Deno.env.get("AI_MODEL") ?? "gpt-4o-mini",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, description } = await req.json();
    if (!title) {
      throw new Error("Job title is required");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = authHeader.replace("Bearer ", "").trim();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing access token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError?.message ?? "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ai = getAiConfig();
    const messages = [
      {
        role: "system",
        content:
          "You are an expert HR recruiter for 247 Labs. Generate exactly 5 professional screening questions for a job posting. Return the output STRICTLY as a JSON array of objects, where each object has a 'title' (string, max 50 chars) and a 'prompt' (string, the actual question text). Do not include any markdown blocks, just the JSON array.",
      },
      {
        role: "user",
        content:
          `Job Title: ${title}
Job Description: ${description || "No description provided."}

Instructions:
${TEMPLATE_INSTRUCTIONS}

Return a JSON array of 5 objects: [{"title": "Company Familiarity", "prompt": "..."}]`,
      },
    ];

    const response = await fetch(ai.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ai.model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("AI did not return content");
    }

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("AI response was not a valid JSON array");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({ questions: parsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
