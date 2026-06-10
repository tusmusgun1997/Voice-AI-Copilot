import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Client } = pg;
const schemaPath = path.resolve(process.cwd(), 'database/supabase-demo-schema.sql');
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Missing SUPABASE_DB_URL or DATABASE_URL.');
  process.exit(1);
}

const sql = await fs.readFile(schemaPath, 'utf8');
const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

try {
  await client.connect();
  await client.query(sql);
  const result = await client.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'app_installations',
        'llm_parameter_versions',
        'llm_parameters',
        'agent_observability_profiles',
        'webhook_events',
        'call_analysis_jobs',
        'call_analyses',
        'call_parameter_results',
        'agent_system_improvements'
      )
    order by table_name;
  `);

  console.log(`Applied schema. Verified ${result.rowCount} tables:`);
  for (const row of result.rows) {
    console.log(`- ${row.table_name}`);
  }
} finally {
  await client.end();
}

