const crypto = require('crypto');

const SALT = process.env.SEREN_AUTH_SALT || 'seren-alert-dev-salt';

function hashPassword(password) {
  return crypto.createHash('sha256').update(`${SALT}:${password}`).digest('hex');
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  if (passwordHash === password) return true;
  return hashPassword(password) === passwordHash;
}

function createToken() {
  return crypto.randomUUID();
}

module.exports = { hashPassword, verifyPassword, createToken };
