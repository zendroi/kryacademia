import postgres from 'postgres';
import { runNotificationJobs } from '../lib/notification-jobs.mjs';

const url = new URL(process.env.DATABASE_URL);
const sql = postgres(url.href, { ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full', max: 2 });
try { console.log(JSON.stringify(await runNotificationJobs(sql))); }
finally { await sql.end(); }
