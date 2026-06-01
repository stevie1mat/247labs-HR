import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active job postings
    const { data: postings, error: postingsError } = await supabaseClient
      .from('jobPostings')
      .select('*')
      .in('status', ['publish', 'published', 'active', 'open']); // Adjust if status is different

    if (postingsError) throw postingsError;

    // Fetch WP URLs from logs
    const { data: logs } = await supabaseClient
      .from('jobPostingLogs')
      .select('jobPostingId, externalUrl')
      .eq('platform', 'wordpress')
      .not('externalUrl', 'is', null);

    const logMap = new Map();
    if (logs) {
        for (const log of logs) {
            logMap.set(log.jobPostingId, log.externalUrl);
        }
    }

    let xml = `<?xml version="1.0" encoding="utf-8"?>\n<source>\n`;
    xml += `  <publisher>247 Labs Inc.</publisher>\n`;
    xml += `  <publisherurl>https://247labs.com</publisherurl>\n`;
    xml += `  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

    for (const posting of (postings || [])) {
        const url = logMap.get(posting.id) || `https://247labs.com/careers/${posting.id}`;
        let description = posting.description || '';
        if (posting.requirements) description += `\n\nRequirements:\n${posting.requirements}`;

        xml += `  <job>\n`;
        xml += `    <title><![CDATA[${posting.title || 'Unknown Title'}]]></title>\n`;
        xml += `    <date><![CDATA[${new Date(posting.createdAt || Date.now()).toUTCString()}]]></date>\n`;
        xml += `    <referencenumber><![CDATA[${posting.id}]]></referencenumber>\n`;
        xml += `    <url><![CDATA[${url}]]></url>\n`;
        xml += `    <company><![CDATA[247 Labs Inc.]]></company>\n`;
        xml += `    <city><![CDATA[Toronto]]></city>\n`;
        xml += `    <state><![CDATA[ON]]></state>\n`;
        xml += `    <country><![CDATA[CA]]></country>\n`;
        xml += `    <description><![CDATA[${description}]]></description>\n`;
        if (posting.salaryRange) {
            xml += `    <salary><![CDATA[${posting.salaryRange}]]></salary>\n`;
        }
        xml += `  </job>\n`;
    }

    xml += `</source>`;

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      },
      status: 200
    });

  } catch (error: any) {
    console.error("Indeed feed error:", error);
    return new Response(`<?xml version="1.0" encoding="utf-8"?><error>${error.message}</error>`, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      status: 500
    });
  }
});
