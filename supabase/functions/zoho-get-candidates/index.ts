import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"
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

    // 1. Fetch Candidates from Zoho Recruit
    const zohoCandidatesUrl = 'https://recruit.zohocloud.ca/recruit/v2/Candidates';
    const candResponse = await fetch(zohoCandidatesUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      }
    });

    let candidates = [];
    if (candResponse.status !== 204) {
      const candData = await candResponse.json();
      candidates = candData.data || [];
    }

    // 2. Fetch Applications from Zoho Recruit
    const zohoAppsUrl = 'https://recruit.zohocloud.ca/recruit/v2/Applications';
    const appsResponse = await fetch(zohoAppsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
      }
    });

    let applications = [];
    if (appsResponse.status !== 204) {
      const appsData = await appsResponse.json();
      applications = appsData.data || [];
    }

    // 3. Fetch jobPostingLogs from Supabase to map zoho Job_Opening_Id to local postingId
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('jobPostingLogs')
      .select('jobPostingId, externalJobId')
      .eq('platform', 'zoho_recruit')
      .not('externalJobId', 'is', null);

    if (logsError) {
      console.error("Error fetching job logs:", logsError);
    }

    const zohoToLocalJobMap: Record<string, string> = {};
    if (logs) {
      for (const log of logs) {
        if (log.externalJobId && log.jobPostingId) {
          zohoToLocalJobMap[log.externalJobId] = log.jobPostingId;
        }
      }
    }

    // 4. Map Candidates to their Applications and assign jobPostingId
    const mappedCandidates = [];
    
    for (const candidate of candidates) {
      const candidateApps = applications.filter((app: any) => app.Candidate_Name?.id === candidate.id);
      
      if (candidateApps.length > 0) {
        for (const app of candidateApps) {
          const zohoJobId = app.Job_Opening_Name?.id;
          const localJobId = zohoJobId ? zohoToLocalJobMap[zohoJobId] : null;
          
          mappedCandidates.push({
            ...candidate,
            jobPostingId: localJobId,
            applicationId: app.id,
            // Optionally override candidate status with application status if needed
            Candidate_Status: app.Application_Status || candidate.Candidate_Status
          });
        }
      } else {
        // No applications found, return as unsorted
        mappedCandidates.push({
          ...candidate,
          jobPostingId: null
        });
      }
    }

    return new Response(JSON.stringify({ data: mappedCandidates }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error("Error in zoho-get-candidates:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Following debug pattern for client-side readability
    })
  }
})
