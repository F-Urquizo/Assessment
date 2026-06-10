import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // GCM standard IV length
const TAG_BYTES = 16;

/** Format stored in the DB: base64(iv):base64(authTag):base64(ciphertext) */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const hex = config.getOrThrow<string>('ENCRYPTION_KEY');
    const buf = Buffer.from(hex, 'hex');
    if (buf.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY must be a 64-char hex string (32 bytes for AES-256)',
      );
    }
    this.key = buf;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Embed IV and auth tag alongside ciphertext so decrypt() is self-contained.
    return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
  }

  decrypt(token: string): string {
    const parts = token.split(':');
    if (parts.length !== 3) throw new Error('Invalid ciphertext format');
    const [ivB64, tagB64, encB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    if (tag.length !== TAG_BYTES) throw new Error('Invalid auth tag length');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }
}
