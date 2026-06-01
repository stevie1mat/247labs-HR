import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extremely simple decoding (same as distribute-job)
function decodePassword(encoded: string): string {
  try {
      return atob(encoded);
  } catch {
      return encoded;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { postingId, action } = await req.json();

    if (!postingId || !action) {
      throw new Error("Missing postingId or action");
    }

    // 1. Get logs to find external IDs
    const { data: logs, error: logsError } = await supabaseClient
      .from('jobPostingLogs')
      .select('*')
      .eq('jobPostingId', postingId)
      .eq('status', 'success');

    if (logsError) throw logsError;

    // 2. Fetch all sources to get credentials
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('postingSources')
      .select('*')
      .eq('isActive', true);

    if (sourcesError) throw sourcesError;

    const debugInfo: any = { logsFound: logs?.length || 0, wpErrors: [] };

    // 3. Process each external platform
    for (const log of (logs || [])) {
        if (!log.externalJobId) continue;

        const source = sources?.find(s => s.id === log.postingSourceId || s.id === log.sourceId);
        if (!source || source.platform !== 'wordpress') continue;

        try {
            const siteUrl = source.credentials.siteUrl || source.credentials.url || source.credentials.apiUrl;
            const apiUrl = siteUrl.replace(/\/$/, '') + '/wp-json/wp/v2/careers/' + log.externalJobId;
            const password = decodePassword(source.credentials.appPassword);
            const auth = btoa(`${source.credentials.username}:${password}`);

            if (action === 'fulfill' || action === 'close') {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`
                    },
                    body: JSON.stringify({ status: 'draft' })
                });
                if (!res.ok) {
                    debugInfo.wpErrors.push(await res.text());
                }
            } else if (action === 'delete') {
                let res = await fetch(apiUrl + "?force=true", {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'X-HTTP-Method-Override': 'DELETE'
                    }
                });
                
                if (!res.ok) {
                    // Fallback to just drafting it via standard POST (since we know POST works and draft is supported)
                    res = await fetch(apiUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Basic ${auth}`
                        },
                        body: JSON.stringify({ status: 'draft' })
                    });
                }
                
                if (!res.ok) {
                    debugInfo.wpErrors.push(await res.text());
                }
            }
        } catch (err: any) {
            debugInfo.wpErrors.push(err.message);
        }
    }

    // 4. Update or Delete local DB
    if (action === 'delete') {
        const { error } = await supabaseClient
            .from('jobPostings')
            .delete()
            .eq('id', postingId);
        if (error) throw error;
    } else {
        const updatePayload = action === 'fulfill' 
            ? { status: 'fulfilled', fulfilledAt: new Date().toISOString() }
            : { status: 'closed', fulfilledAt: null };

        const { error } = await supabaseClient
            .from('jobPostings')
            .update(updatePayload)
            .eq('id', postingId);
        
        if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, debug: debugInfo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error("Manage posting error:", error);
    return new Response(JSON.stringify({ error: `Execution Error: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
