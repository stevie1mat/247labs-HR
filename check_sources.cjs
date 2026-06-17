const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSources() {
  const { data, error } = await supabaseAdmin.from('postingSources').select('*');
  console.log("Sources in DB:", JSON.stringify(data, null, 2));
  if (error) console.error("Error:", error);
}

checkSources();
