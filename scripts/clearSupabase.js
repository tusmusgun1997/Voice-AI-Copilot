import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({ 
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL 
});

async function reset() {
  await client.connect();
  try {
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
    console.log('Truncating tables: ' + tables.join(', '));
    await client.query(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`);
    console.log('Database cleared successfully.');
  } catch (err) {
    console.error('Error clearing database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

reset();
