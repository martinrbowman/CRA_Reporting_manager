import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../../.env') });

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is not set');

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

await migrate(db, {
  migrationsFolder: resolve(__dirname, './migrations'),
});

console.log('Migrations complete');
await client.end();
