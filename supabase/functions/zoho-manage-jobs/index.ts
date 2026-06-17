import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

async function getAccessToken() {
  const clientId = Deno.env.get('ZOHO_CLIENT_ID');
  const clientSecret = Deno.env.get('ZOHO_CLIENT_SECRET');
  const refreshToken = Deno.env.get('ZOHO_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Zoho credentials in environment variables');
  }

  const url = `https://accounts.zohocloud.ca/oauth/v2/token?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`;
  
  const response = await fetch(url, { method: 'POST' });
  const data = await response.json();
  
  if (data.access_token) {
    return data.access_token;
  }
  
  console.error("Error fetching access token:", data);
  throw new Error('Failed to obtain access token from Zoho');
}

async function readZohoJson(response: Response) {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return { error: raw };
  }
}

function getZohoApiError(data: any) {
  const firstResult = data?.data?.[0];
  if (firstResult?.status === "error") {
    return firstResult.message || firstResult.code || "Zoho returned an error";
  }

  if (data?.status === "error" || data?.error) {
    return data.message || data.error || "Zoho returned an error";
  }

  return null;
}

async function resolveZohoJobRecordId(accessToken: string, zohoUrl: string, zohoJobId: string, postingTitle?: string) {
  const trimmedId = String(zohoJobId).trim();

  if (/^\d+$/.test(trimmedId)) {
    return trimmedId;
  }

  if (trimmedId && !trimmedId.startsWith("ZOHO_RECRUIT-")) {
    const criteria = encodeURIComponent(`(Job_Opening_ID:equals:${trimmedId})`);
    const searchResponse = await fetch(`${zohoUrl}/search?criteria=${criteria}`, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      }
    });
    const searchData = await readZohoJson(searchResponse);
    const searchMatch = searchResponse.ok ? searchData?.data?.[0] : null;
    if (searchMatch?.id) {
      return String(searchMatch.id);
    }
  }

  const response = await fetch(`${zohoUrl}?fields=id,Posting_Title,Job_Opening_ID&per_page=200`, {
    method: 'GET',
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
    }
  });
  const data = await readZohoJson(response);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Failed to look up Zoho job (${response.status})`);
  }

  const match = (data?.data || []).find((job: any) => {
    return String(job?.id || "") === trimmedId || String(job?.Job_Opening_ID || "") === trimmedId;
  });

  if (!match?.id) {
    const titleMatch = postingTitle
      ? (data?.data || []).find((job: any) => String(job?.Posting_Title || "") === String(postingTitle))
      : null;

    if (titleMatch?.id) {
      return String(titleMatch.id);
    }

    throw new Error(`Could not find Zoho Job Opening with ID ${trimmedId || "(blank)"}`);
  }

  return String(match.id);
}

async function deleteZohoJob(accessToken: string, zohoUrl: string, recordId: string) {
  const headers = {
    'Authorization': `Zoho-oauthtoken ${accessToken}`,
  };

  const bulkResponse = await fetch(`${zohoUrl}?ids=${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    headers,
  });
  const bulkData = await readZohoJson(bulkResponse);
  const bulkError = getZohoApiError(bulkData);

  if (bulkResponse.ok && !bulkError) {
    return bulkData;
  }

  const singleResponse = await fetch(`${zohoUrl}/${encodeURIComponent(recordId)}`, {
    method: 'DELETE',
    headers,
  });
  const singleData = await readZohoJson(singleResponse);
  const singleError = getZohoApiError(singleData);

  if (singleResponse.ok && !singleError) {
    return singleData;
  }

  throw new Error(
    singleError ||
    singleData?.message ||
    singleData?.error ||
    bulkError ||
    bulkData?.message ||
    bulkData?.error ||
    `Zoho delete failed for record ${recordId}`
  );
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const accessToken = await getAccessToken();
    const zohoUrl = 'https://recruit.zohocloud.ca/recruit/v2/Job_Openings';

    if (req.method === 'GET') {
      const response = await fetch(zohoUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
        }
      });
      const data = await readZohoJson(response);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const response = await fetch(zohoUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'Content-Type': 'application/json'
        },
        // body should be { data: [...] } as per Zoho API
        body: JSON.stringify(body)
      });
      const data = await readZohoJson(response);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (req.method === 'DELETE') {
      const { zohoJobId, postingTitle } = await req.json();
      if (!zohoJobId && !postingTitle) throw new Error("zohoJobId or postingTitle is required for DELETE");

      const recordId = await resolveZohoJobRecordId(accessToken, zohoUrl, String(zohoJobId || ""), postingTitle);
      const data = await deleteZohoJob(accessToken, zohoUrl, recordId);

      return new Response(JSON.stringify({ ...data, resolvedZohoJobId: recordId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    throw new Error('Method not allowed');
  } catch (error) {
    console.error("Error in zoho-manage-jobs:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Following debug pattern
    })
  }
})
