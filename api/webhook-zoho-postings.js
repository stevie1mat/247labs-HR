import { createClient } from "@supabase/supabase-js";

function json(res, status, body) {
  if (typeof res.status === "function") {
    res.status(status).setHeader("Content-Type", "application/json");
  } else {
    res.writeHead(status, { "Content-Type": "application/json" });
  }
  res.end(JSON.stringify(body));
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase URL or Service Role Key is missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// Extract job title from subject: You have posted a job opening for a "SEO & AI Engine Optimization Expert"
function extractJobTitle(subject) {
  const match = subject.match(/"([^"]+)"/);
  return match ? match[1] : null;
}

// Parse the HTML table for Job Boards and Statuses
function parseZohoTable(htmlBody) {
  // Simple regex to extract row contents. 
  // Look for <tr>...</tr> and then extract <td> contents.
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const colRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  
  const results = [];
  let rowMatch;

  while ((rowMatch = rowRegex.exec(htmlBody)) !== null) {
    const rowHtml = rowMatch[1];
    const cols = [];
    let colMatch;
    
    // We only care about rows that have multiple columns (the job boards table)
    while ((colMatch = colRegex.exec(rowHtml)) !== null) {
      // Strip inner HTML tags to get raw text
      const cleanText = colMatch[1].replace(/<[^>]+>/g, '').trim();
      cols.push(cleanText);
    }

    if (cols.length >= 3) {
      // Zoho's columns: [0] Job Board, [1] Status, [2] Type, [3] Posted By, [4] Posted On, [5] Expires On
      const boardName = cols[0];
      const rawStatus = cols[1]; // Usually has a bullet character or something like "• Queued"
      
      let status = "failed";
      if (rawStatus.toLowerCase().includes("queued")) status = "queued";
      if (rawStatus.toLowerCase().includes("active")) status = "success";

      // Ignore header row
      if (boardName.toLowerCase() !== "job board") {
        results.push({
          boardName,
          status
        });
      }
    }
  }

  return results;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const { subject, htmlBody } = req.body || {};
    
    if (!subject || !htmlBody) {
      throw new Error("Missing subject or htmlBody in payload.");
    }

    // 1. Find the Job Title
    const jobTitle = extractJobTitle(subject);
    if (!jobTitle) {
      throw new Error("Could not extract job title from subject: " + subject);
    }

    // 2. Parse the table
    const boards = parseZohoTable(htmlBody);
    if (boards.length === 0) {
      throw new Error("Could not parse any job boards from the email body.");
    }

    // 3. Connect to Supabase
    const supabase = getSupabaseAdmin();

    // 4. Find the Job Posting ID
    const { data: jobPosting, error: jobError } = await supabase
      .from("jobPostings")
      .select("id, title")
      .ilike("title", `%${jobTitle}%`)
      .order("createdAt", { ascending: false })
      .limit(1)
      .single();

    if (jobError || !jobPosting) {
      throw new Error(`Job Posting not found for title: ${jobTitle}`);
    }

    // 5. Update/Insert Job Posting Logs
    for (const board of boards) {
      // Try to find an existing log for this board
      const { data: existingLog } = await supabase
        .from("jobPostingLogs")
        .select("id")
        .eq("jobPostingId", jobPosting.id)
        .ilike("platform", `%${board.boardName}%`)
        .limit(1)
        .single();

      if (existingLog) {
        await supabase
          .from("jobPostingLogs")
          .update({
            status: board.status,
            lastAttemptAt: new Date().toISOString()
          })
          .eq("id", existingLog.id);
      } else {
        await supabase
          .from("jobPostingLogs")
          .insert({
            jobPostingId: jobPosting.id,
            platform: board.boardName,
            status: board.status,
            attemptCount: 1,
            attemptedAt: new Date().toISOString(),
            lastAttemptAt: new Date().toISOString()
          });
      }
    }

    // 6. Log the activity
    await supabase.from("activityLogs").insert({
      action: "distribution_succeeded",
      category: "distribution",
      entityType: "job_posting",
      entityId: jobPosting.id,
      title: `Zoho distribution update`,
      detail: `Received Zoho automated email. Queued/Active on ${boards.length} job boards.`,
      platform: "zoho_recruit",
      sourceName: "Automated Email Sync",
      statusTone: "success",
      jobPostingId: jobPosting.id,
      metadata: {
        boards,
        subject
      }
    });

    json(res, 200, { success: true, message: `Updated ${boards.length} job boards for ${jobTitle}` });
  } catch (error) {
    console.error("Webhook Error:", error);
    json(res, 400, { error: error.message || "Unknown error" });
  }
}
