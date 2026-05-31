import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getAiConfig() {
  const provider = (Deno.env.get("AI_PROVIDER") ?? "groq").toLowerCase();

  if (provider === "openai") {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

    return {
      apiKey,
      endpoint: "https://api.openai.com/v1/chat/completions",
      model: Deno.env.get("AI_MODEL") ?? "gpt-4o-mini",
    };
  }

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY is missing");

  return {
    apiKey,
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: Deno.env.get("AI_MODEL") ?? "openai/gpt-oss-20b",
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
          "You are an expert HR writer for 247 Labs. Generate a professional reusable job template. Return only valid JSON with keys: title, category, description, requirements, salaryRange.",
      },
      {
        role: "user",
        content:
          `Create a complete reusable job template for this position: ${position}.

Rules:
- company is 247 Labs in Toronto
- write a polished realistic job description
- include responsibilities and qualifications
- choose a sensible category
- include a salary range string in CAD if possible
- requirements should be plain text, suitable for saving in a template
- description should be ready to post
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
