import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeSectionText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dedupeRepeatedLines(value: string) {
  const normalized = normalizeSectionText(value);
  if (!normalized) {
    return "";
  }

  const lines = normalized.split("\n").map((line) => line.trimEnd());
  const deduped: string[] = [];
  let previousComparable = "";

  for (const line of lines) {
    const comparable = line.replace(/\s+/g, " ").trim().toLowerCase();

    if (comparable && comparable === previousComparable) {
      continue;
    }

    deduped.push(line);
    previousComparable = comparable;
  }

  const dedupedText = normalizeSectionText(deduped.join("\n"));
  const midpoint = Math.floor(dedupedText.length / 2);

  if (
    dedupedText.length > 40 &&
    dedupedText.length % 2 === 0 &&
    dedupedText.slice(0, midpoint).trim() === dedupedText.slice(midpoint).trim()
  ) {
    return dedupedText.slice(0, midpoint).trim();
  }

  return dedupedText;
}

function extractSectionBlock(source: string, startMarkers: string[], endMarkers: string[]) {
  const normalized = normalizeSectionText(source);
  const lower = normalized.toLowerCase();

  let startIndex = -1;
  let matchedMarker = "";

  for (const marker of startMarkers) {
    const index = lower.indexOf(marker.toLowerCase());
    if (index !== -1 && (startIndex === -1 || index < startIndex)) {
      startIndex = index;
      matchedMarker = marker;
    }
  }

  if (startIndex === -1) {
    return "";
  }

  const contentStart = startIndex + matchedMarker.length;
  let endIndex = normalized.length;

  for (const marker of endMarkers) {
    const index = lower.indexOf(marker.toLowerCase(), contentStart);
    if (index !== -1 && index < endIndex) {
      endIndex = index;
    }
  }

  return normalizeSectionText(normalized.slice(contentStart, endIndex));
}

function findEarliestMarkerIndex(source: string, markers: string[]) {
  const normalized = normalizeSectionText(source);
  const lower = normalized.toLowerCase();
  let earliestIndex = -1;

  for (const marker of markers) {
    const index = lower.indexOf(marker.toLowerCase());
    if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
      earliestIndex = index;
    }
  }

  return earliestIndex;
}

function buildWordPressSections(posting: any) {
  const fallbackCompany =
    "247labs is a leading software development company headquartered in Toronto, Canada. We specialize in providing custom software solutions, mobile app development, web development, and digital transformation services to clients across various industries. Our team of experienced professionals is dedicated to delivering innovative, high-quality solutions that drive business growth and exceed client expectations.";

  const fallbackPositionOverview =
    "We’re looking for a proven hunter to drive new business for our B2B digital solutions (custom software, cloud, and digital transformation). You’ll own the full sales cycle-from self-sourced leads to closed deals-and build a high-quality pipeline in your local market. This is a contract role with a clear path to full-time based on performance.";

  const description = normalizeSectionText(posting.description || "");
  const requirements = normalizeSectionText(posting.requirements || "");
  const combinedContent = normalizeSectionText([description, requirements].filter(Boolean).join("\n\n"));

  let companyOverview = description;
  let positionOverview = "";
  const overviewMarkers = ["Role Overview:", "Position Overview:", "Job Overview:"];
  const sectionMarkers = [
    "Key Responsibilities:",
    "Responsibilities:",
    "Key Duties:",
    "What You'll Do:",
    "What We Offer:",
    "Benefits:",
    "Why Join Us:",
    "Required Skills & Qualifications:",
    "Qualifications:",
    "Requirements:",
    "Nice to Have:",
    "Preferred Qualifications:",
    "Desirable Skills:",
    "Additional Information:",
  ];

  for (const marker of overviewMarkers) {
    if (description.includes(marker)) {
      const parts = description.split(marker);
      companyOverview = normalizeSectionText(parts[0] || "");
      positionOverview = normalizeSectionText(parts.slice(1).join(marker) || "");
      break;
    }
  }

  if (!positionOverview) {
    positionOverview = companyOverview || fallbackPositionOverview;
    companyOverview = fallbackCompany;
  }

  const positionSectionIndex = findEarliestMarkerIndex(positionOverview, sectionMarkers);
  if (positionSectionIndex !== -1) {
    positionOverview = normalizeSectionText(positionOverview.slice(0, positionSectionIndex));
  }

  if (!positionOverview) {
    positionOverview = fallbackPositionOverview;
  }

  const keyResponsibilities = extractSectionBlock(
    combinedContent,
    ["Key Responsibilities:", "Responsibilities:", "Key Duties:", "What You'll Do:"],
    ["What We Offer:", "Requirements:", "Required Skills & Qualifications:", "Qualifications:", "Nice to Have:", "Additional Information:"]
  );

  const qualifications = extractSectionBlock(
    combinedContent,
    ["Required Skills & Qualifications:", "Qualifications:", "Requirements:"],
    ["Nice to Have:", "What We Offer:", "Additional Information:"]
  );

  const desirableSkills = extractSectionBlock(
    combinedContent,
    ["Nice to Have:", "Preferred Qualifications:", "Desirable Skills:"],
    ["What We Offer:", "Additional Information:"]
  );

  const whatWeOffer = extractSectionBlock(
    combinedContent,
    ["What We Offer:", "Benefits:", "Why Join Us:"],
    ["Requirements:", "Required Skills & Qualifications:", "Qualifications:", "Nice to Have:", "Additional Information:"]
  );

  const additionalInformationParts = [whatWeOffer].filter(Boolean);

  const roleTitle = posting.title || "this opportunity";
  const joinOurTeam = `If you are a motivated and experienced professional with a passion for technology and a drive to succeed, we invite you to apply for the ${roleTitle} role and become part of our dynamic team at 247labs Inc.`;

  return {
    companyOverview: companyOverview || fallbackCompany,
    positionOverview: positionOverview || fallbackPositionOverview,
    keyResponsibilities: dedupeRepeatedLines(keyResponsibilities),
    desirableSkills: dedupeRepeatedLines(desirableSkills),
    qualifications: dedupeRepeatedLines(qualifications),
    additionalInformation: dedupeRepeatedLines(additionalInformationParts.join("\n\n")),
    joinOurTeam,
  };
}

async function logActivity(supabaseAdmin: any, entry: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("activityLogs").insert(entry);
  if (error) {
    console.error("Failed to write activity log", error);
  }
}

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

        await logActivity(supabaseAdmin, {
          action: "job_posting_created",
          category: "lifecycle",
          entityType: "job_posting",
          entityId: posting.id,
          title: `Job posting created: ${posting.title}`,
          detail: "A new posting was created from a template and entered the active hiring pipeline.",
          statusTone: "success",
          jobPostingId: posting.id,
          templateId,
          actorId: user.id,
          actorEmail: user.email ?? null,
          metadata: {
            jobTitle: posting.title,
            source: "template_distribution",
            salaryRange: posting.salaryRange ?? null,
          },
        });
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

    await logActivity(supabaseAdmin, {
      action: "job_distribution_started",
      category: "distribution",
      entityType: "job_posting",
      entityId: posting.id,
      title: `Distribution started: ${posting.title}`,
      detail: `Publishing workflow started for ${filteredSources.length} platform${filteredSources.length === 1 ? "" : "s"}.`,
      statusTone: "neutral",
      jobPostingId: posting.id,
      templateId: posting.templateId ?? templateId ?? null,
      actorId: user.id,
      actorEmail: user.email ?? null,
      metadata: {
        jobTitle: posting.title,
        sourceIds: filteredSources.map((source: any) => source.id),
        platforms: filteredSources.map((source: any) => source.platform),
      },
    });

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

                const wpSections = buildWordPressSections(posting);

                const payload: any = {
                    title: posting.title,
                    status: "publish",
                    content: wpSections.positionOverview,
                    acf: {
                        location: "Remote",
                        company_overview: wpSections.companyOverview,
                        key_responsibilities: wpSections.keyResponsibilities,
                        desirable_skills: wpSections.desirableSkills,
                        qualifications: wpSections.qualifications,
                        additional_information: wpSections.additionalInformation,
                        join_our_team: wpSections.joinOurTeam
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
        } else if (['wellfound', 'linkedin', 'remotive', 'upwork', 'dubizzle_jobs_uae'].includes(source.platform)) {
            try {
                const automationResult = await callAutomationAgent(source, posting);
                success = true;
                externalJobId = automationResult.externalJobId;
                externalUrl = automationResult.externalUrl;
            } catch (err: any) {
                success = false;
                errorMessage = err.message || `Unknown error connecting to ${source.platform}`;
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
        const { data: savedLog, error: logError } = await supabaseAdmin.from('jobPostingLogs').insert(result).select().single();
        if (logError) {
            throw new Error(`Failed to save log to database: ${JSON.stringify(logError)}`);
        }

        await logActivity(supabaseAdmin, {
          action: success ? "distribution_succeeded" : "distribution_failed",
          category: "distribution",
          entityType: "job_posting",
          entityId: posting.id,
          title: `${success ? "Published" : "Publish failed"}: ${posting.title}`,
          detail: success
            ? `${posting.title} reached ${source.name || source.platform}${externalJobId ? ` with external ID ${externalJobId}` : ""}.`
            : errorMessage || `Automation could not publish ${posting.title} to ${source.name || source.platform}.`,
          platform: source.platform,
          sourceName: source.name || source.platform,
          statusTone: success ? "success" : "warning",
          jobPostingId: posting.id,
          templateId: posting.templateId ?? templateId ?? null,
          postingSourceId: source.id,
          actorId: user.id,
          actorEmail: user.email ?? null,
          metadata: {
            jobTitle: posting.title,
            logId: savedLog?.id ?? null,
            externalUrl,
            externalJobId,
            attemptCount: 1,
            status: result.status,
          },
        });
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
