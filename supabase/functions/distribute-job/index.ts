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

function getAutomationConfig() {
  return {
    url: (Deno.env.get("AUTOMATION_SERVER_URL") ?? "").replace(/\/$/, ""),
    apiKey: Deno.env.get("AUTOMATION_API_KEY") ?? "",
  };
}

async function callAutomationAgent(source: any, posting: any) {
  const { url, apiKey } = getAutomationConfig();

  if (!url) {
    throw new Error("AUTOMATION_SERVER_URL is missing");
  }

  if (!apiKey) {
    throw new Error("AUTOMATION_API_KEY is missing");
  }

  const response = await fetch(`${url}/post-job`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      platform: source.platform,
      posting_id: posting.id,
      credentials: source.credentials || {},
    }),
  });

  const raw = await response.text();
  let data: any = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw };
  }

  if (!response.ok) {
    throw new Error(data.detail || data.error || raw || `Automation request failed with ${response.status}`);
  }

  if (!data.success) {
    throw new Error(data.error || data.verification_reason || "Automation agent reported failure");
  }

  return {
    externalUrl: data.posted_url ?? null,
    externalJobId: data.posted_url ? `${source.platform.toUpperCase()}-AI` : null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { templateId, postingId, sourceIds } = await req.json();

    const authHeader = req.headers.get('Authorization') || '';
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    
    // Admin client to bypass RLS for system logs
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: `Unauthorized - Auth Error: ${authError?.message || 'No user'} (Header: ${authHeader.substring(0, 15)}...)` }), {
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

    const filteredSources = Array.isArray(sourceIds) && sourceIds.length > 0
      ? (sources || []).filter((source: any) => sourceIds.includes(source.id))
      : (sources || []);

    const results = [];
    for (const source of filteredSources) {
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

                // 1. Fetch image from Pexels if API key is present
                let mediaId = null;
                const pexelsKey = Deno.env.get('PEXELS_API_KEY');
                
                if (pexelsKey) {
                    try {
                        // Use the exact job title for highly relevant images
                        const pexelsQuery = encodeURIComponent(posting.title);
                        const pexelsRes = await fetch(`https://api.pexels.com/v1/search?query=${pexelsQuery}&per_page=1&orientation=landscape`, {
                            headers: { Authorization: pexelsKey }
                        });
                        if (pexelsRes.ok) {
                            const pexelsData = await pexelsRes.json();
                            const imageUrl = pexelsData.photos?.[0]?.src?.large2x;
                            
                            if (imageUrl) {
                                // 2. Download the image binary
                                const imgRes = await fetch(imageUrl);
                                if (imgRes.ok) {
                                    const imgBuffer = await imgRes.arrayBuffer();
                                    
                                    // 3. Upload to WordPress Media Library
                                    const uploadRes = await fetch(`${siteUrl}/wp-json/wp/v2/media`, {
                                        method: "POST",
                                        headers: {
                                            "Authorization": `Basic ${auth}`,
                                            "Content-Disposition": `attachment; filename="job-featured-image-${Date.now()}.jpg"`,
                                            "Content-Type": imgRes.headers.get('content-type') || 'image/jpeg'
                                        },
                                        body: imgBuffer
                                    });
                                    
                                    if (uploadRes.ok) {
                                        const uploadData = await uploadRes.json();
                                        mediaId = uploadData.id;
                                    } else {
                                        console.error("WP Media Upload failed", await uploadRes.text());
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Pexels/Media flow failed:", e);
                    }
                }

                let companyText = posting.description || "";
                let roleText = "";
                const markers = ["Role Overview:", "Position Overview:", "Job Overview:"];
                for (const marker of markers) {
                    if (companyText.includes(marker)) {
                        const parts = companyText.split(marker);
                        companyText = parts[0].trim();
                        roleText = parts[1].trim();
                        break;
                    }
                }
                
                // Fallback if no explicit marker was found
                if (!roleText) {
                    roleText = companyText;
                    companyText = "247 Labs Inc. is a leading custom software development company based in Toronto, Canada, specializing in web and mobile app development, AI/ML, UI/UX design, and scalable technology solutions.";
                }

                const payload: any = {
                    title: posting.title,
                    status: "publish",
                    content: roleText,
                    acf: {
                        location: "Remote",
                        company_overview: companyText,
                        key_responsibilities: posting.requirements || "",
                        desirable_skills: "",
                        qualifications: "",
                        additional_information: posting.salaryRange ? `Salary: ${posting.salaryRange}` : "",
                        join_our_team: "Apply now!"
                    }
                };

                if (mediaId) {
                    payload.featured_media = mediaId;
                }

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
        } else if (source.platform === 'wellfound') {
            try {
                const automationResult = await callAutomationAgent(source, posting);
                success = true;
                externalJobId = automationResult.externalJobId;
                externalUrl = automationResult.externalUrl;
            } catch (err: any) {
                success = false;
                errorMessage = err.message || "Unknown error connecting to Wellfound";
            }
        } else {
            success = false;
            errorMessage = `Live mode not yet implemented for ${source.platform}`;
        }
        
        const result = {
            postingId: posting.id,
            jobPostingId: posting.id,
            sourceId: source.id,
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
        const { error: logError } = await supabaseAdmin.from('jobPostingLogs').insert(result);
        if (logError) {
            throw new Error(`Failed to save log to database: ${JSON.stringify(logError)}`);
        }
    }

    return new Response(JSON.stringify({ posting, logs: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: `Execution Error: ${error.message}`, stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
