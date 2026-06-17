require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
        // Disable realtime since we don't have ws package
        params: {
            eventsPerSecond: 10
        }
    }
  });

  const { data: logs, error } = await supabase
    .from('jobPostingLogs')
    .select('*')
    .order('createdAt', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(JSON.stringify(logs, null, 2));
}

run().catch(console.error);
