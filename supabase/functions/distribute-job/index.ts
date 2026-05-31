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
        let success = false;
        let externalUrl = null;
        let errorMessage = null;
        let externalJobId = null;

        if (source.isMockMode) {
            await simulateDelay(500, 1000);
            success = Math.random() > 0.1;
            if (success) {
                externalJobId = `${source.platform.toUpperCase()}-${Math.random().toString(36).substring(7)}`;
                externalUrl = `https://${source.platform}.com/jobs/view/123`;
            } else {
                errorMessage = `[MOCK] ${source.platform} API Error`;
            }
        } else if (source.platform === 'wordpress') {
            try {
                const creds = source.credentials || {};
                let siteUrl = creds.siteUrl?.replace(/\/$/, "");
                const username = creds.username;
                const password = creds.applicationPassword;
                const postType = creds.postType || "career";

                if (!siteUrl || !username || !password) {
                    throw new Error("Missing WordPress credentials");
                }

                const apiUrl = `${siteUrl}/wp-json/wp/v2/${postType}`;
                const auth = btoa(`${username}:${password}`);

                const payload = {
                    title: posting.title,
                    status: "publish",
                    acf: {
                        location: "Remote",
                        company_overview: posting.description || "",
                        key_responsibilities: posting.requirements || "",
                        desirable_skills: "",
                        qualifications: "",
                        additional_information: posting.salaryRange ? `Salary: ${posting.salaryRange}` : "",
                        join_our_team: "Apply now!"
                    }
                };

                const res = await fetch(apiUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Basic ${auth}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`WordPress API error: ${res.status} ${text}`);
                }

                const data = await res.json();
                success = true;
                externalJobId = data.id?.toString();
                externalUrl = data.link;

            } catch (err: any) {
                success = false;
                errorMessage = err.message || "Unknown error connecting to WordPress";
            }
        } else {
            success = false;
            errorMessage = `Live mode not yet implemented for ${source.platform}`;
        }
        
        const result = {
            postingId: posting.id,
            jobPostingId: posting.id,
            sourceId: source.id,
            postingSourceId: source.id,
            platform: source.platform,
            status: success ? 'success' : 'failed',
            externalJobId,
            externalUrl,
            errorMessage,
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
