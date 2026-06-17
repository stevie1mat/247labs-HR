const { Client } = require('pg');
async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:Steven%40279@db.xbfhtdgqiioignjgrsjy.supabase.co:5432/postgres' });
  await client.connect();
  const res = await client.query('SELECT title, description, requirements FROM public."jobTemplates" ORDER BY "createdAt" DESC LIMIT 1');
  console.log(res.rows[0]);
  await client.end();
}
run();
