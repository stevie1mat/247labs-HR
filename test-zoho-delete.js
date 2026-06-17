require('dotenv').config();

async function run() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;

  // 1. Get Access Token
  const tokenUrl = `https://accounts.zohocloud.ca/oauth/v2/token?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`;
  const tokenRes = await fetch(tokenUrl, { method: 'POST' });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  console.log("Got access token");

  // 2. Fetch Job Openings
  const getUrl = 'https://recruit.zohocloud.ca/recruit/v2/Job_Openings';
  const getRes = await fetch(getUrl, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
  const getData = await getRes.json();
  
  const jobs = getData.data || [];
  if (jobs.length === 0) {
    console.log("No jobs found in Zoho!");
    return;
  }
  
  const jobId = jobs[0].id;
  console.log(`Found job ${jobId} - ${jobs[0].Posting_Title}. Attempting delete...`);

  // 3. Try to delete using ?ids=
  const deleteUrl1 = `https://recruit.zohocloud.ca/recruit/v2/Job_Openings?ids=${jobId}`;
  console.log("DELETE URL:", deleteUrl1);
  const deleteRes1 = await fetch(deleteUrl1, { method: 'DELETE', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
  const deleteData1 = await deleteRes1.json();
  console.log("Delete response:", JSON.stringify(deleteData1, null, 2));
}

run().catch(console.error);
