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

  // 2. Fetch Job Openings
  const getUrl = 'https://recruit.zohocloud.ca/recruit/v2/Job_Openings';
  const getRes = await fetch(getUrl, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
  
  if (getRes.status === 204) {
      console.log("No jobs found in Zoho (204 No Content)!");
      return;
  }
  
  const text = await getRes.text();
  if (!text) {
      console.log("Empty response body.");
      return;
  }

  const getData = JSON.parse(text);
  const jobs = getData.data || [];
  if (jobs.length === 0) {
    console.log("No jobs found in Zoho!");
    return;
  }
  
  let deleted = 0;
  for (const job of jobs) {
      if (job.Posting_Title === "Full Stack Developer") {
          console.log(`Deleting orphaned job: ${job.id} - ${job.Posting_Title}...`);
          const deleteUrl = `https://recruit.zohocloud.ca/recruit/v2/Job_Openings?ids=${job.id}`;
          const deleteRes = await fetch(deleteUrl, { method: 'DELETE', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
          const deleteData = await deleteRes.json();
          console.log("Response:", JSON.stringify(deleteData));
          deleted++;
      }
  }
  if (deleted === 0) {
      console.log("No Full Stack Developer jobs found.");
  }
}

run().catch(console.error);
