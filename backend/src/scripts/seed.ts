import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

const runSeed = async () => {
  console.log('[SEED] Starting database migration and seed script...');
  try {
    const schemaPath = path.resolve(__dirname, '../../../sql/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }

    const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
    console.log('[SEED] Executing schema.sql statements...');

    const client = await pool.connect();
    try {
      await client.query(sqlContent);
      console.log('[SEED] ✅ Database schema and seed data loaded successfully!');
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[SEED] ❌ Failed to run seed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

runSeed();
