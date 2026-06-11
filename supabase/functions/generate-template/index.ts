import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const companyOverviewTemplate =
  "247labs is a leading software development company headquartered in Toronto, Canada. We specialize in providing custom software solutions, mobile app development, web development, and digital transformation services to clients across various industries. Our team of experienced professionals is dedicated to delivering innovative, high-quality solutions that drive business growth and exceed client expectations.";

const positionOverviewTemplate =
  "Position Overview:\nWe are seeking a Full Stack Developer to join 247 Labs and help design, develop, and maintain scalable end-to-end web applications.";

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
    const { position } = await req.json();
    if (!position || typeof position !== "string") {
      throw new Error("Position is required");
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
          "You are an expert HR writer for 247 Labs. Generate a professional reusable job template that is ready for the WordPress posting mapper. Return only valid JSON with keys: title, category, description, requirements, salaryRange.",
      },
      {
        role: "user",
        content:
          `Create a complete reusable job template for this position: ${position}.

Rules:
- company is 247 Labs in Toronto
- write a polished realistic job description aligned to how our WordPress job page is structured
- choose a sensible category
- include a salary range string in CAD if possible
- description must be plain text and ready to post
- requirements must be plain text and ready to post
- CRITICAL: DO NOT use any markdown formatting whatsoever (no **, no ##). Use plain text with ALL CAPS for section headers and standard newlines.
- IMPORTANT: generate content that maps cleanly into these WordPress fields:
  1. company_overview
  2. position_overview
  3. key_responsibilities
  4. what_we_offer
  5. qualifications
  6. nice_to_have
  7. additional_information
  8. join_our_team
- description must contain only these two sections, in this order:
  COMPANY OVERVIEW:
  ${companyOverviewTemplate}

  POSITION OVERVIEW:
  Write a role-specific overview using this style as a model, but adapt it to the requested job:
  ${positionOverviewTemplate}
- requirements must contain only these sections, in this order:
  KEY RESPONSIBILITIES:
  WHAT WE OFFER:
  QUALIFICATIONS:
  NICE TO HAVE:
  ADDITIONAL INFORMATION:
  JOIN OUR TEAM:
- Put each item in KEY RESPONSIBILITIES, WHAT WE OFFER, QUALIFICATIONS, and NICE TO HAVE on its own line starting with "- ".
- DO NOT repeat the same content across sections.
- DO NOT put responsibilities or qualifications inside POSITION OVERVIEW.
- DO NOT put salary inside ADDITIONAL INFORMATION. Salary belongs only in salaryRange.
- JOIN OUR TEAM must be a short closing CTA tailored to the role and 247labs.
- output JSON only`,
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

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI response was not valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({
        title: parsed.title ?? position,
        category: parsed.category ?? "",
        description: parsed.description ?? "",
        requirements: parsed.requirements ?? "",
        salaryRange: parsed.salaryRange ?? "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
