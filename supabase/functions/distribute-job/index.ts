import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function simulateDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, delay));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { templateId, postingId } = await req.json();

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

    let posting;

    if (templateId) {
        const { data: template } = await supabaseClient
            .from('jobTemplates')
            .select('*')
            .eq('id', templateId)
            .single();
            
        if (!template) throw new Error("Template not found");

        const { data: newPosting } = await supabaseClient.from('jobPostings').insert({
            templateId,
            title: template.title,
            description: template.description,
            requirements: template.requirements,
            salaryRange: template.salaryRange,
            status: 'active',
            postedById: user.id
        }).select().single();
        posting = newPosting;
    } else if (postingId) {
        const { data: existingPosting } = await supabaseClient
            .from('jobPostings')
            .select('*')
            .eq('id', postingId)
            .single();
        if (!existingPosting) throw new Error("Posting not found");
        posting = existingPosting;
    } else {
        throw new Error("Must provide templateId or postingId");
    }

    const { data: sources } = await supabaseClient
        .from('postingSources')
        .select('*')
        .eq('isActive', true);

    const results = [];
    for (const source of sources || []) {
        await simulateDelay(500, 1000);
        const success = source.isMockMode ? Math.random() > 0.1 : false;
        
        const result = {
            postingId: posting.id,
            jobPostingId: posting.id,
            sourceId: source.id,
            postingSourceId: source.id,
            platform: source.platform,
            status: success ? 'success' : 'failed',
            externalJobId: success ? `${source.platform.toUpperCase()}-${Math.random().toString(36).substring(7)}` : null,
            externalUrl: success ? `https://${source.platform}.com/jobs/view/123` : null,
            errorMessage: success ? null : `[MOCK] ${source.platform} API Error`,
            attemptCount: 1,
            lastAttemptAt: new Date().toISOString(),
            attemptedAt: new Date().toISOString()
        };

        results.push(result);
        await supabaseClient.from('jobPostingLogs').insert(result);
    }

    return new Response(JSON.stringify({ posting, logs: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
