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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const accessToken = await getAccessToken();

    // Fetch Candidates from Zoho Recruit
    // Using recruit/v2/Candidates
    const zohoUrl = 'https://recruit.zohocloud.ca/recruit/v2/Candidates';
    const response = await fetch(zohoUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      }
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error("Error in zoho-get-candidates:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Following debug pattern for client-side readability
    })
  }
})
