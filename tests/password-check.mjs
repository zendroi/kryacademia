import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../lib/passwords.mjs';

const password = 'Migration-check-2026!';
const digest = await hashPassword(password);
assert.match(digest, /^\$2a\$12\$/);
assert.equal(await verifyPassword(password, digest), true);
assert.equal(await verifyPassword('incorrect-password', digest), false);
assert.equal(await verifyPassword(password, undefined), false);
assert.equal(await verifyPassword(password, null), false);
assert.equal(await verifyPassword(password, 'invalid-hash'), false);
await assert.rejects(hashPassword('short'));
await assert.rejects(hashPassword('界'.repeat(25)));
const boundary = '界'.repeat(24);
const boundaryHash = await hashPassword(boundary);
assert.equal(await verifyPassword(boundary, boundaryHash), true);
assert.equal(await verifyPassword(`${boundary}a`, boundaryHash), false);

// Optional read-only interoperability check; never modifies existing accounts.
if (process.env.DATABASE_URL) {
  const { default: postgres } = await import('postgres');
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'Use the source PostgreSQL database for this check.');
  const sql = postgres(url.href, { max: 1, ssl: ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ? false : 'verify-full' });
  try {
    for (const value of [password, boundary]) {
      const appHash = value === password ? digest : boundaryHash;
      const [row] = await sql`SELECT crypt(${value}, gen_salt('bf', 12)) AS legacy_hash, crypt(${value}, ${appHash}) = ${appHash} AS verified`;
      assert.equal(await verifyPassword(value, row.legacy_hash), true);
      assert.equal(row.verified, true);
    }
    console.log('PostgreSQL bcrypt compatibility passed in both directions.');
  } finally { await sql.end(); }
} else console.log('PostgreSQL compatibility check skipped: DATABASE_URL is not configured.');
console.log('Password checks passed.');
