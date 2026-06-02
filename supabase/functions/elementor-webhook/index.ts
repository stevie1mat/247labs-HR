import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function firstValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function normalizePayload(raw: Record<string, unknown>) {
  const payload: Record<string, string> = {};
  const assignValue = (key: string, value: string) => {
    const normalizedValue = value.trim();
    if (!normalizedValue) return;

    payload[key] = normalizedValue;
    payload[normalizeKey(key)] = normalizedValue;
  };

  const walk = (prefix: string, value: unknown) => {
    if (typeof value === "string") {
      assignValue(prefix, value);
      return;
    }

    if (Array.isArray(value)) {
      const joined = value
        .map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)))
        .join(", ");
      assignValue(prefix, joined);
      return;
    }

    if (value && typeof value === "object") {
      const objectValue = value as Record<string, unknown>;

      if ("value" in objectValue && typeof objectValue.value === "string") {
        assignValue(prefix, objectValue.value);
      }

      for (const [childKey, childValue] of Object.entries(objectValue)) {
        const nextKey = prefix ? `${prefix}_${childKey}` : childKey;
        walk(nextKey, childValue);
      }
    }
  };

  for (const [key, value] of Object.entries(raw)) {
    walk(key, value);
  }

  return payload;
}

function extractResumeUrl(payload: Record<string, string>) {
  const preferredKeys = [
    "resume",
    "resume_url",
    "cv",
    "cv_url",
    "file",
    "file_upload",
    "upload",
    "attachment",
  ];

  const directMatch = firstValue(payload, preferredKeys);
  if (directMatch) {
    return directMatch;
  }

  const matchingEntry = Object.values(payload).find((value) =>
    /^https?:\/\//i.test(value) && /\.(pdf|doc|docx)(\?.*)?$/i.test(value)
  );

  return matchingEntry ?? "";
}

function extractResumeFileName(url: string) {
  if (!url) return "";

  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.split("/").filter(Boolean).pop();
    return fileName ? decodeURIComponent(fileName) : "";
  } catch {
    return url.split("/").pop() ?? "";
  }
}

async function logActivity(supabaseAdmin: any, entry: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from("activityLogs").insert(entry);
  if (error) {
    console.error("Failed to write activity log", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestUrl = new URL(req.url);
    const expectedSecret = Deno.env.get("ELEMENTOR_WEBHOOK_SECRET") ?? "";
    const providedSecret =
      req.headers.get("x-webhook-secret") ??
      requestUrl.searchParams.get("secret") ??
      "";

    if (expectedSecret && providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Invalid webhook secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const contentType = req.headers.get("content-type") ?? "";
    let body: Record<string, unknown> = {};

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    } else {
      const rawText = await req.text();
      try {
        body = JSON.parse(rawText);
      } catch {
        const params = new URLSearchParams(rawText);
        body = Object.fromEntries(params.entries());
      }
    }

    const payload = normalizePayload(body);
    const formName = firstValue(payload, ["form_name", "formname"]);
    const name = firstValue(payload, ["name", "full_name", "candidate_name", "applicant_name", "your_name"]);
    const email = firstValue(payload, ["email", "e_mail", "candidate_email", "applicant_email", "your_email"]);
    const phone = firstValue(payload, ["phone", "telephone", "tel", "mobile", "phone_number"]);
    const location = firstValue(payload, ["location", "candidate_location", "city_country"]);
    const portfolio = firstValue(payload, ["portfolio", "portfolio_url", "linkedin", "website", "link_to_portfolio"]);
    const coverLetter = firstValue(payload, ["message", "cover_letter", "coverletter", "notes", "additional_information"]);
    const resumeUrl = extractResumeUrl(payload);
    const resumeFileName = extractResumeFileName(resumeUrl);
    const explicitPostingId = firstValue(payload, ["job_posting_id", "posting_id", "job_id"]);
    const submittedJobTitle = firstValue(payload, ["job_title", "position", "role_title", "role", "job_role"]);

    let matchedPostingId: string | null = explicitPostingId || null;

    if (!matchedPostingId && submittedJobTitle) {
      const { data: matchedPosting } = await supabaseAdmin
        .from("jobPostings")
        .select("id, title")
        .ilike("title", submittedJobTitle)
        .limit(1)
        .maybeSingle();

      matchedPostingId = matchedPosting?.id ?? null;
    }

    const applicantPayload = {
      jobPostingId: matchedPostingId,
      name: name || null,
      email: email || null,
      phone: phone || null,
      location: location || null,
      portfolio: portfolio || null,
      coverLetter: coverLetter || null,
      resumeUrl: resumeUrl || null,
      resumeFileName: resumeFileName || null,
      formName: formName || null,
      source: "elementor",
      status: "new",
      metadata: {
        rawSubmission: payload,
        submittedJobTitle: submittedJobTitle || null,
      },
    };

    const { data: applicant, error: applicantError } = await supabaseAdmin
      .from("applicants")
      .insert(applicantPayload)
      .select()
      .single();

    if (applicantError) {
      throw applicantError;
    }

    await logActivity(supabaseAdmin, {
      action: "applicant_received",
      category: "applicants",
      entityType: "applicant",
      entityId: applicant.id,
      title: `Applicant received: ${name || email || "New submission"}`,
      detail: matchedPostingId
        ? `${name || "A candidate"} applied through Elementor and was matched to a job posting.`
        : `${name || "A candidate"} applied through Elementor but could not be matched to a posting automatically.`,
      platform: "internal",
      sourceName: "Elementor submission",
      statusTone: matchedPostingId ? "success" : "warning",
      jobPostingId: matchedPostingId,
      actorEmail: email || null,
      metadata: {
        applicantId: applicant.id,
        formName: formName || null,
        resumeUrl: resumeUrl || null,
        submittedJobTitle: submittedJobTitle || null,
      },
    });

    return new Response(JSON.stringify({ success: true, applicantId: applicant.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Elementor webhook error", error);

    return new Response(JSON.stringify({ error: error.message || "Unknown webhook error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
