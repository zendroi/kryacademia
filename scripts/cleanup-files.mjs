import postgres from 'postgres';
import { cleanupPrivateFiles } from '../lib/private-files.mjs';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const sql = postgres(process.env.DATABASE_URL, { ssl: ['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname) ? false : 'verify-full', max: 1 });
try { console.log(`Removed ${await cleanupPrivateFiles(sql)} unreferenced private files older than 24 hours.`); }
finally { await sql.end(); }
