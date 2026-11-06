import { createPool } from 'mysql2/promise';
import { readFileSync } from 'node:fs';

// MariaDB exposes our JSON fields as LONGTEXT, including the teaching view.
export const mysqlJSONColumns = new Set(['content', 'files', 'before_data', 'after_data', 'details']);

export function mysqlPool(connectionString = process.env.HOSTINGER_DATABASE_URL) {
  if (!connectionString) throw new Error('HOSTINGER_DATABASE_URL is required.');
  const url = new URL(connectionString);
  if (url.protocol !== 'mysql:' || !url.hostname || !url.username || !/^\/[a-zA-Z0-9_-]+$/.test(url.pathname) || url.search || url.hash) throw new Error('Use a mysql://user:password@host:port/database URL without query parameters.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const ca = process.env.MYSQL_SSL_CA_FILE;
  return createPool({
    host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port || 3306),
    user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1),
    connectionLimit: 5, waitForConnections: true, queueLimit: 50, connectTimeout: 15000,
    charset: 'utf8mb4', timezone: 'Z', dateStrings: true, supportBigNumbers: true, bigNumberStrings: true,
    multipleStatements: false, ssl: local ? undefined : { rejectUnauthorized: true, ...(ca ? { ca: readFileSync(ca, 'utf8') } : {}) },
  });
}

export async function inspectMySQL(connection) {
  const [[server]] = await connection.query('SELECT VERSION() AS version, @@version_comment AS product, DATABASE() AS name, @@max_allowed_packet AS packetBytes');
  const version = server.version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!version) throw new Error('Unrecognized database server version.');
  const [major, minor, patch] = version.slice(1).map(Number);
  const mariaDB = /mariadb/i.test(server.version + server.product);
  if (mariaDB ? major < 11 || (major === 11 && (minor < 8 || (minor === 8 && patch < 9))) : major < 8 || (major === 8 && minor === 0 && patch < 21)) throw new Error('This migration requires MySQL >=8.0.21 or MariaDB >=11.8.9; verify the Hostinger engine/version before continuing.');
  if (Number(server.packetBytes) < 4 * 1024 * 1024) throw new Error('MySQL max_allowed_packet must be at least 4 MiB for verified uploads.');
  await connection.query("SET SESSION time_zone = '+00:00'");
  await connection.query("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ZERO_DATE,NO_ZERO_IN_DATE,NO_ENGINE_SUBSTITUTION,ANSI_QUOTES'");
  if (mariaDB) await connection.query('SET SESSION group_concat_max_len = 4194304');
  return { ...server, engine: mariaDB ? 'mariadb' : 'mysql' };
}
