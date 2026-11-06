import { compare, genSalt, hash } from 'bcryptjs';

// Unknown accounts still perform the same bcrypt work as existing accounts.
const dummyHash = '$2a$12$gjccHS/IAdCt0Nw3tneE0.Q/eFJJAF1POtzGFHGURFnuN1b7JgZPW';

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 15 || Buffer.byteLength(password) > 72) {
    throw new Error('Password must contain at least 15 characters and at most 72 bytes.');
  }
  // Keep pgcrypto's $2a$ format so rollback can still verify new accounts.
  const salt = (await genSalt(12)).replace('$2b$', '$2a$');
  return hash(password, salt);
}

export async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) return false;
  const verified = await compare(password, storedHash || dummyHash);
  return Boolean(storedHash) && verified;
}
