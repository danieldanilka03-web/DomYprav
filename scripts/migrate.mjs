import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

async function run() {
  if (!connectionString) {
    console.log('No DATABASE_URL or POSTGRES_URL found. Skipping migrations.');
    return;
  }
  console.log('Connecting to database...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  const db = drizzle(pool);
  console.log('Applying migrations from ./drizzle ...');
  await migrate(db, { migrationsFolder: path.resolve('drizzle') });
  console.log('Migrations applied successfully!');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
