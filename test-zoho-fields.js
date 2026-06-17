require('dotenv').config();
async function run() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  
  const tokenRes = await fetch(`https://accounts.zohocloud.ca/oauth/v2/token?refresh_token=${refreshToken}&client_id=${clientId}&client_secret=${clientSecret}&grant_type=refresh_token`, { method: 'POST' });
  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  
  if (!accessToken) {
    console.error("No access token", tokenData);
    return;
  }
  
  const fieldsRes = await fetch('https://recruit.zohocloud.ca/recruit/v2/settings/fields?module=Job_Openings', {
    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
  });
  
  const fieldsData = await fieldsRes.json();
  const fields = fieldsData.fields || [];
  
  fields.forEach(f => {
    if (f.field_label.toLowerCase().includes('requirement') || f.field_label.toLowerCase().includes('benefit') || f.field_label.toLowerCase().includes('desc')) {
      console.log(`Label: "${f.field_label}", API Name: "${f.api_name}"`);
    }
  });
}
run();
