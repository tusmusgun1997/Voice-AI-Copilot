import dotenv from 'dotenv';
dotenv.config();

const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const tables = [
  'human_actions',
  'call_recommendations',
  'call_parameter_results',
  'call_analyses',
  'llm_parameters',
  'llm_parameter_versions',
  'agent_observability_profiles',
  'call_analysis_jobs',
  'webhook_events',
  'app_installations'
];

async function clearTable(table) {
  console.log(`Clearing table: ${table}...`);
  const response = await fetch(`${url}/rest/v1/${table}?id=not.is.null`, {
    method: 'DELETE',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Failed to clear ${table}: ${response.status} ${text}`);
  } else {
    console.log(`Cleared ${table}.`);
  }
}

async function run() {
  // Order matters if there are foreign keys, though PostgREST might still complain.
  // We'll clear them in order.
  for (const table of tables) {
    await clearTable(table);
  }
  console.log('Cleanup complete.');
}

run();
