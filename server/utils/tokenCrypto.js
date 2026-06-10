import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const PLAIN_PREFIX = 'plain:';
const ENCRYPTED_PREFIX = 'aes256gcm:';

export function encodeSecret(value) {
  const cleanValue = cleanString(value);
  if (!cleanValue) return '';

  const key = getEncryptionKey();
  if (!key) return `${PLAIN_PREFIX}${Buffer.from(cleanValue, 'utf8').toString('base64')}`;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(cleanValue, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':');
}

export function decodeSecret(value) {
  const cleanValue = cleanString(value);
  if (!cleanValue) return '';

  if (cleanValue.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(cleanValue.slice(PLAIN_PREFIX.length), 'base64').toString('utf8');
  }

  if (!cleanValue.startsWith(ENCRYPTED_PREFIX)) {
    return cleanValue;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY is required to decrypt stored OAuth tokens.');
  }

  const [, iv, tag, encrypted] = cleanValue.split(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}

function getEncryptionKey() {
  const raw = cleanString(process.env.TOKEN_ENCRYPTION_KEY || process.env.APP_TOKEN_ENCRYPTION_KEY);
  if (!raw) return null;

  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');

  return crypto.createHash('sha256').update(raw).digest();
}

function cleanString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
