import postgres from 'postgres';
import { mysqlSql } from '../lib/mysql-tag.mjs';
import { runNotificationJobs } from '../lib/notification-jobs.mjs';

const url = new URL(process.env.DATABASE_URL);
const sql = url.protocol === 'mysql:' ? mysqlSql(url.href) : postgres(url.href, { ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full', max: 2 });
try { console.log(JSON.stringify(await runNotificationJobs(sql))); }
finally { await sql.end(); }
