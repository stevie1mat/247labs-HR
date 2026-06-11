import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HR_SYSTEM_PROMPT = `You are an expert HR assistant for 247 Labs, a leading software and digital transformation company based in Toronto. Your job is to help hiring managers create professional job descriptions through a friendly conversation.

When a user requests to hire someone:
1. Greet them and confirm the role they want to hire for
2. Ask clarifying questions ONE AT A TIME (never ask multiple questions at once):
   - Seniority level (junior/mid/senior)
   - Key responsibilities (3-5 bullet points)
   - Required technical skills
   - Nice-to-have skills
   - Years of experience required
   - Employment type (full-time/part-time/contract/freelance)
   - Salary range (optional)
3. If a matching template is provided in the context, suggest it to the user and ask if they want to use it as a base
4. Once you have enough information, generate a complete, professional job description
5. Ask the user to confirm the job description before finalizing

Keep responses concise and conversational. Use markdown for the final job description.

IMPORTANT: After EVERY response (except the final ready-to-post one), you MUST append a [SUGGESTIONS] block with 2-4 quick-reply options relevant to the question you just asked. Format:
[SUGGESTIONS]
["option 1","option 2","option 3"]

When you have generated the final job description and the user has confirmed it, you MUST end your response with a JSON block in this exact format (no markdown code fences around it, just the raw JSON on its own line):
[READY_TO_POST]
{"jobTitle":"<exact job title>","requirements":"<requirements as plain text>","salaryRange":"<salary range or empty string>"}`;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: number;
};

function getAiConfig() {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");

  return {
    provider: "openai",
    apiKey,
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: Deno.env.get("AI_MODEL") ?? "gpt-4o-mini",
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { requestId, message } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: jobRequest, error: reqError } = await supabaseClient
      .from('jobRequests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (reqError || !jobRequest) throw new Error("Job request not found");

    const { data: templates } = await supabaseClient
      .from('jobTemplates')
      .select('*')
      .eq('isActive', true);

    const history = jobRequest.conversationHistory || [];
    
    const templateContext = templates && templates.length > 0
        ? `\n\nAvailable job templates in the database:\n${templates.map(t => `- "${t.title}" (v${t.version}): ${t.description.substring(0, 100)}...`).join("\n")}`
        : "";

    const messages: ChatMessage[] = [
      { role: "system", content: HR_SYSTEM_PROMPT + templateContext },
      ...history,
      { role: "user", content: message }
    ];

    const ai = getAiConfig();

    const response = await fetch(ai.endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ai.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: ai.model,
        messages
      })
    });

    if (!response.ok) {
        throw new Error(await response.text());
    }

    const result = await response.json();
    const aiContent = result.choices[0].message.content;

    const updatedHistory = [
        ...history,
        { role: "user", content: message, timestamp: Date.now() },
        { role: "assistant", content: aiContent, timestamp: Date.now() },
    ];

    const isReadyToPost = aiContent.includes("[READY_TO_POST]");
    let cleanContent = aiContent;
    let extractedTitle, extractedRequirements, extractedSalaryRange;

    if (isReadyToPost) {
        const jsonMatch = aiContent.match(/\{[\s\S]*?\}/m);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                extractedTitle = parsed.jobTitle;
                extractedRequirements = parsed.requirements;
                extractedSalaryRange = parsed.salaryRange;
            } catch (_) {}
        }
        cleanContent = aiContent.replace("[READY_TO_POST]", "").replace(/\{[\s\S]*?\}/m, "").trim();
    }

    let suggestions: string[] = [];
    const suggestionsIdx = cleanContent.indexOf("[SUGGESTIONS]");
    if (suggestionsIdx !== -1) {
        const afterSuggestions = cleanContent.slice(suggestionsIdx + "[SUGGESTIONS]".length).trimStart();
        const bracketStart = afterSuggestions.indexOf("[");
        const bracketEnd = afterSuggestions.indexOf("]", bracketStart);
        if (bracketStart !== -1 && bracketEnd !== -1) {
            try { suggestions = JSON.parse(afterSuggestions.slice(bracketStart, bracketEnd + 1)); } catch (_) {}
        }
        cleanContent = cleanContent.slice(0, suggestionsIdx).trim();
    }

    await supabaseClient.from('jobRequests').update({
        conversationHistory: updatedHistory,
        status: isReadyToPost ? "pending_review" : "draft",
        finalDescription: isReadyToPost ? cleanContent : jobRequest.finalDescription,
        ...(extractedTitle && { title: extractedTitle }),
        ...(extractedRequirements && { finalRequirements: extractedRequirements }),
        ...(extractedSalaryRange && { salaryRange: extractedSalaryRange }),
    }).eq('id', requestId);

    return new Response(JSON.stringify({ 
        message: cleanContent, 
        isReadyToPost, 
        requestId, 
        extractedTitle, 
        extractedRequirements, 
        extractedSalaryRange, 
        suggestions 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
