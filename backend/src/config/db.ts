import { Pool } from 'pg';
import { config } from './env';

// Configure pool with SSL handling for cloud hosts (Neon, Supabase, Render)
const isCloudDb = config.databaseUrl.includes('supabase') || 
                  config.databaseUrl.includes('neon.tech') || 
                  config.databaseUrl.includes('render.com') ||
                  config.databaseUrl.includes('sslmode=require');

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isCloudDb ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DATABASE] Unexpected error on idle PostgreSQL client:', err);
});

export const testDbConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as current_time');
    client.release();
    console.log(`[DATABASE] Connected to PostgreSQL at ${res.rows[0].current_time}`);
    return true;
  } catch (error: any) {
    console.warn(`[DATABASE] Notice: Connection to PostgreSQL failed: ${error.message}`);
    console.warn('[DATABASE] Please ensure DATABASE_URL in .env is valid and database is running.');
    return false;
  }
};
