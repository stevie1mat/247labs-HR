import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logActivity(supabaseClient: any, entry: Record<string, unknown>) {
  const sanitizedEntry = { ...entry };

  if (sanitizedEntry.templateId) {
    const { data: template } = await supabaseClient
      .from("jobTemplates")
      .select("id")
      .eq("id", sanitizedEntry.templateId)
      .maybeSingle();

    if (!template) {
      sanitizedEntry.templateId = null;
    }
  }

  const { error } = await supabaseClient.from("activityLogs").insert(sanitizedEntry);
  if (error) {
    console.error("Failed to write activity log", error);
  }
}

function parsePostIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("p") || parsed.searchParams.get("post") || "";
  } catch {
    return "";
  }
}

function parseSlugFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.at(-1) || "";
  } catch {
    return "";
  }
}

async function resolveWordPressPost(
  siteUrl: string,
  postType: string,
  auth: string,
  externalUrl: string | null,
  title?: string | null,
) {
  const idFromUrl = externalUrl ? parsePostIdFromUrl(externalUrl) : "";
  if (idFromUrl) {
    return { id: idFromUrl, link: externalUrl };
  }

  const slug = externalUrl ? parseSlugFromUrl(externalUrl) : "";
  if (slug) {
    const slugRes = await fetch(`${siteUrl}/wp-json/wp/v2/${postType}?slug=${encodeURIComponent(slug)}&status=any&_fields=id,link,title,slug`, {
      headers: {
        "Authorization": `Basic ${auth}`,
      },
    });

    if (slugRes.ok) {
      const slugData = await slugRes.json();
      if (Array.isArray(slugData) && slugData.length > 0) {
        return {
          id: String(slugData[0].id),
          link: slugData[0].link ?? externalUrl,
        };
      }
    }
  }

  if (title) {
    const searchRes = await fetch(`${siteUrl}/wp-json/wp/v2/${postType}?search=${encodeURIComponent(title)}&status=any&_fields=id,link,title,slug`, {
      headers: {
        "Authorization": `Basic ${auth}`,
      },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        const exactMatch = searchData.find((post: any) => {
          const renderedTitle = String(post?.title?.rendered || "").replace(/<[^>]*>/g, "").trim();
          return renderedTitle === title;
        });
        const post = exactMatch || searchData[0];

        return {
          id: String(post.id),
          link: post.link ?? externalUrl,
        };
      }
    }
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization') || '';
    const authClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { postingId, action } = await req.json();

    if (!postingId || !action) {
      throw new Error("Missing postingId or action");
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await authClient.auth.getUser(jwt);

    const { data: posting, error: postingError } = await supabaseClient
      .from("jobPostings")
      .select("*")
      .eq("id", postingId)
      .single();

    if (postingError || !posting) {
      throw postingError || new Error("Posting not found");
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

    const debugInfo: any = {
      logsFound: logs?.length || 0,
      externalErrors: [],
      wpErrors: [],
      wpRequests: [],
    };

    // 3. Process each external platform
    for (const log of (logs || [])) {
        if (!log.externalJobId) continue;

        if (log.platform === 'zoho_recruit' && action === 'delete') {
            try {
                const res = await fetch(`${supabaseUrl}/functions/v1/zoho-manage-jobs`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader
                    },
                    body: JSON.stringify({ zohoJobId: log.externalJobId, postingTitle: posting.title })
                });
                const responseText = await res.text();
                let zohoData: any = {};
                try {
                    zohoData = responseText ? JSON.parse(responseText) : {};
                } catch {
                    zohoData = { error: responseText };
                }
                
                if (!res.ok) {
                    debugInfo.externalErrors.push({
                        platform: 'zoho_recruit',
                        externalJobId: log.externalJobId,
                        error: zohoData.error || responseText || `Zoho delete failed with ${res.status}`
                    });
                } else {
                    if (zohoData.error) {
                        if (
                            String(log.externalJobId || "").startsWith("ZOHO_RECRUIT-") &&
                            String(zohoData.error || "").includes("Could not find Zoho Job Opening")
                        ) {
                            continue;
                        }

                        debugInfo.externalErrors.push({
                            platform: 'zoho_recruit',
                            externalJobId: log.externalJobId,
                            error: zohoData.error
                        });
                    }
                }
            } catch (err: any) {
                debugInfo.externalErrors.push({ platform: 'zoho_recruit', externalJobId: log.externalJobId, error: err.message });
            }
            continue;
        }

        const source = sources?.find(s => s.id === log.postingSourceId || s.id === log.sourceId);
        if (!source || source.platform !== 'wordpress') continue;

        try {
            const creds = source.credentials || {};
            const siteUrl = String(creds.siteUrl || creds.url || creds.apiUrl || "").trim().replace(/\/$/, "");
            const postType = creds.postType || "career";
            const username = String(creds.username || "").trim();
            const password = String(creds.applicationPassword || creds.appPassword || "").trim();
            const auth = btoa(`${username}:${password}`);

            if (!siteUrl || !username || !password) {
                throw new Error("Missing WordPress credentials for manage-posting");
            }

            let resolvedExternalJobId = String(log.externalJobId);
            let resolvedExternalUrl = log.externalUrl || null;

            const apiUrl = `${siteUrl}/wp-json/wp/v2/${postType}/${resolvedExternalJobId}`;

            debugInfo.wpRequests.push({
              postingSourceId: source.id ?? null,
              externalJobId: resolvedExternalJobId ?? null,
              postType,
              username,
              apiUrl,
              action,
              previousExternalJobId: log.externalJobId ?? null,
            });

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
                    const responseText = await res.text();
                    const resolvedPost = await resolveWordPressPost(
                      siteUrl,
                      postType,
                      auth,
                      resolvedExternalUrl,
                      posting.title,
                    );

                    if (resolvedPost?.id && resolvedPost.id !== resolvedExternalJobId) {
                      resolvedExternalJobId = resolvedPost.id;
                      resolvedExternalUrl = resolvedPost.link ?? resolvedExternalUrl;

                      await supabaseClient
                        .from("jobPostingLogs")
                        .update({
                          externalJobId: resolvedExternalJobId,
                          externalUrl: resolvedExternalUrl,
                          lastAttemptAt: new Date().toISOString(),
                        })
                        .eq("id", log.id);

                      const retryApiUrl = `${siteUrl}/wp-json/wp/v2/${postType}/${resolvedExternalJobId}`;
                      const retryRes = await fetch(retryApiUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Basic ${auth}`
                        },
                        body: JSON.stringify({ status: 'draft' })
                      });

                      if (retryRes.ok) {
                        continue;
                      }

                      debugInfo.wpErrors.push({
                        postingSourceId: source.id ?? null,
                        externalJobId: resolvedExternalJobId ?? null,
                        postType,
                        username,
                        apiUrl: retryApiUrl,
                        action,
                        previousExternalJobId: log.externalJobId ?? null,
                        response: await retryRes.text(),
                      });
                      continue;
                    }

                    debugInfo.wpErrors.push({
                      postingSourceId: source.id ?? null,
                      externalJobId: resolvedExternalJobId ?? null,
                      postType,
                      username,
                      apiUrl,
                      action,
                      previousExternalJobId: log.externalJobId ?? null,
                      response: responseText,
                    });
                }
            } else if (action === 'relist') {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`
                    },
                    body: JSON.stringify({ status: 'publish' })
                });
                if (!res.ok) {
                    const responseText = await res.text();
                    const resolvedPost = await resolveWordPressPost(
                      siteUrl,
                      postType,
                      auth,
                      resolvedExternalUrl,
                      posting.title,
                    );

                    if (resolvedPost?.id && resolvedPost.id !== resolvedExternalJobId) {
                      resolvedExternalJobId = resolvedPost.id;
                      resolvedExternalUrl = resolvedPost.link ?? resolvedExternalUrl;

                      await supabaseClient
                        .from("jobPostingLogs")
                        .update({
                          externalJobId: resolvedExternalJobId,
                          externalUrl: resolvedExternalUrl,
                          lastAttemptAt: new Date().toISOString(),
                        })
                        .eq("id", log.id);

                      const retryApiUrl = `${siteUrl}/wp-json/wp/v2/${postType}/${resolvedExternalJobId}`;
                      const retryRes = await fetch(retryApiUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Basic ${auth}`
                        },
                        body: JSON.stringify({ status: 'publish' })
                      });

                      if (retryRes.ok) {
                        continue;
                      }

                      debugInfo.wpErrors.push({
                        postingSourceId: source.id ?? null,
                        externalJobId: resolvedExternalJobId ?? null,
                        postType,
                        username,
                        apiUrl: retryApiUrl,
                        action,
                        previousExternalJobId: log.externalJobId ?? null,
                        response: await retryRes.text(),
                      });
                      continue;
                    }

                    debugInfo.wpErrors.push({
                      postingSourceId: source.id ?? null,
                      externalJobId: resolvedExternalJobId ?? null,
                      postType,
                      username,
                      apiUrl,
                      action,
                      previousExternalJobId: log.externalJobId ?? null,
                      response: responseText,
                    });
                    debugInfo.externalErrors.push(debugInfo.wpErrors[debugInfo.wpErrors.length - 1]);
                }
            } else if (action === 'delete') {
                const deleteUrl = `${apiUrl}?force=true`;
                const res = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Basic ${auth}`
                    },
                });

                if (!res.ok) {
                    const responseText = await res.text();
                    const resolvedPost = await resolveWordPressPost(
                      siteUrl,
                      postType,
                      auth,
                      resolvedExternalUrl,
                      posting.title,
                    );

                    if (resolvedPost?.id && resolvedPost.id !== resolvedExternalJobId) {
                      resolvedExternalJobId = resolvedPost.id;
                      resolvedExternalUrl = resolvedPost.link ?? resolvedExternalUrl;

                      await supabaseClient
                        .from("jobPostingLogs")
                        .update({
                          externalJobId: resolvedExternalJobId,
                          externalUrl: resolvedExternalUrl,
                          lastAttemptAt: new Date().toISOString(),
                        })
                        .eq("id", log.id);

                      const retryDeleteUrl = `${siteUrl}/wp-json/wp/v2/${postType}/${resolvedExternalJobId}?force=true`;
                      const retryRes = await fetch(retryDeleteUrl, {
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Basic ${auth}`
                        },
                      });

                      if (retryRes.ok) {
                        continue;
                      }

                      debugInfo.wpErrors.push({
                        postingSourceId: source.id ?? null,
                        externalJobId: resolvedExternalJobId ?? null,
                        postType,
                        username,
                        apiUrl: retryDeleteUrl,
                        action,
                        previousExternalJobId: log.externalJobId ?? null,
                        response: await retryRes.text(),
                      });
                      debugInfo.externalErrors.push(debugInfo.wpErrors[debugInfo.wpErrors.length - 1]);
                      continue;
                    }

                    if (responseText.includes("rest_post_invalid_id") || responseText.includes("Invalid post ID")) {
                      continue;
                    }

                    debugInfo.wpErrors.push({
                      postingSourceId: source.id ?? null,
                      externalJobId: resolvedExternalJobId ?? null,
                      postType,
                      username,
                      apiUrl: deleteUrl,
                      action,
                      previousExternalJobId: log.externalJobId ?? null,
                      response: responseText,
                    });
                    debugInfo.externalErrors.push(debugInfo.wpErrors[debugInfo.wpErrors.length - 1]);
                }
            }
        } catch (err: any) {
            debugInfo.wpErrors.push({
              action,
              error: err.message,
            });
            debugInfo.externalErrors.push(debugInfo.wpErrors[debugInfo.wpErrors.length - 1]);
        }
    }

    if (action === "delete" && debugInfo.externalErrors.length > 0) {
      const hasZohoError = debugInfo.externalErrors.some((error: any) => error?.platform === "zoho_recruit");
      return new Response(JSON.stringify({
        error: hasZohoError ? "Zoho delete failed" : "WordPress delete failed",
        debug: debugInfo,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 4. Update local DB
    if (action === 'delete') {
        const { error: deleteApplicantsError } = await supabaseClient
          .from("applicants")
          .delete()
          .eq("jobPostingId", postingId);
        if (deleteApplicantsError) throw deleteApplicantsError;

        const { error: deleteLogsByJobPostingError } = await supabaseClient
          .from("jobPostingLogs")
          .delete()
          .eq("jobPostingId", postingId);
        if (deleteLogsByJobPostingError) throw deleteLogsByJobPostingError;

        const { error: deleteLogsByPostingError } = await supabaseClient
          .from("jobPostingLogs")
          .delete()
          .eq("postingId", postingId);
        if (deleteLogsByPostingError) throw deleteLogsByPostingError;

        const { error: deletePostingError } = await supabaseClient
          .from("jobPostings")
          .delete()
          .eq("id", postingId);
        if (deletePostingError) throw deletePostingError;

        await logActivity(supabaseClient, {
          action: "job_posting_deleted",
          category: "lifecycle",
          entityType: "job_posting",
          entityId: postingId,
          title: `Job deleted permanently: ${posting.title}`,
          detail: "The posting was permanently deleted from the dashboard, related local records were removed, and the linked WordPress listing was permanently deleted.",
          statusTone: "warning",
          jobPostingId: null,
          templateId: posting.templateId ?? null,
          actorId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          metadata: {
            jobTitle: posting.title,
            previousStatus: posting.status ?? null,
            nextStatus: "deleted",
            externalLogsFound: logs?.length || 0,
            deletedApplicants: true,
            deletedPostingLogs: true,
          },
        });
    } else {
        const updatePayload = action === 'fulfill'
            ? { status: 'fulfilled', fulfilledAt: new Date().toISOString() }
            : action === 'relist'
              ? { status: 'active', fulfilledAt: null, postedAt: new Date().toISOString() }
              : { status: 'draft', fulfilledAt: null };

        const { error } = await supabaseClient
            .from('jobPostings')
            .update(updatePayload)
            .eq('id', postingId);
        
        if (error) throw error;

        await logActivity(supabaseClient, {
          action: action === "fulfill" ? "job_posting_fulfilled" : action === "relist" ? "job_posting_relisted" : "job_posting_closed",
          category: "lifecycle",
          entityType: "job_posting",
          entityId: postingId,
          title: `${action === "fulfill" ? "Job fulfilled" : action === "relist" ? "Job relisted" : "Job moved to draft"}: ${posting.title}`,
          detail: action === "fulfill"
            ? "The role was marked as fulfilled and removed from the active pipeline."
            : action === "relist"
              ? "The role was republished and returned to the active pipeline."
              : "The role was moved to draft and removed from active distribution.",
          statusTone: action === "fulfill" || action === "relist" ? "success" : "neutral",
          jobPostingId: postingId,
          templateId: posting.templateId ?? null,
          actorId: user?.id ?? null,
          actorEmail: user?.email ?? null,
          metadata: {
            jobTitle: posting.title,
            previousStatus: posting.status ?? null,
            nextStatus: updatePayload.status,
            externalLogsFound: logs?.length || 0,
          },
        });
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
