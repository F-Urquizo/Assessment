import * as crypto from 'crypto';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CryptoService } from './crypto.service';

const VALID_KEY = crypto.randomBytes(32).toString('hex'); // 64-char hex

function makeModule(keyHex: string) {
  return Test.createTestingModule({
    providers: [
      CryptoService,
      { provide: ConfigService, useValue: { getOrThrow: () => keyHex } },
    ],
  }).compile();
}

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module = await makeModule(VALID_KEY);
    service = module.get(CryptoService);
  });

  describe('round-trip', () => {
    it('decrypt(encrypt(x)) === x for a plain string', () => {
      const original = 'Hello, World! 123 !@#$%';
      expect(service.decrypt(service.encrypt(original))).toBe(original);
    });

    it('handles empty string', () => {
      expect(service.decrypt(service.encrypt(''))).toBe('');
    });

    it('handles unicode / multi-byte content', () => {
      const utf8 = 'Ñoño 🔒 こんにちは';
      expect(service.decrypt(service.encrypt(utf8))).toBe(utf8);
    });
  });

  describe('random IV', () => {
    it('produces a different ciphertext each call for the same plaintext', () => {
      const ct1 = service.encrypt('same input');
      const ct2 = service.encrypt('same input');
      expect(ct1).not.toBe(ct2);
    });
  });

  describe('tampering detection (GCM auth tag)', () => {
    it('throws when the ciphertext body is tampered', () => {
      const ct = service.encrypt('secret');
      const [iv, tag, enc] = ct.split(':');
      const buf = Buffer.from(enc, 'base64');
      buf[0] ^= 0xff; // flip first byte
      const tampered = `${iv}:${tag}:${buf.toString('base64')}`;
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws when the auth tag is tampered', () => {
      const ct = service.encrypt('secret');
      const [iv, tag, enc] = ct.split(':');
      const buf = Buffer.from(tag, 'base64');
      buf[0] ^= 0xff;
      const tampered = `${iv}:${buf.toString('base64')}:${enc}`;
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws when the IV is tampered', () => {
      const ct = service.encrypt('secret');
      const [iv, tag, enc] = ct.split(':');
      const buf = Buffer.from(iv, 'base64');
      buf[0] ^= 0xff;
      const tampered = `${buf.toString('base64')}:${tag}:${enc}`;
      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('format validation', () => {
    it('throws on a token with fewer than 3 colon-separated parts', () => {
      expect(() => service.decrypt('onlytwoparts')).toThrow('Invalid ciphertext format');
      expect(() => service.decrypt('only:two')).toThrow('Invalid ciphertext format');
    });

    it('throws on a token with more than 3 colon-separated parts', () => {
      expect(() => service.decrypt('a:b:c:d')).toThrow('Invalid ciphertext format');
    });
  });

  describe('key validation (constructor)', () => {
    it('throws when ENCRYPTION_KEY is shorter than 32 bytes', async () => {
      await expect(makeModule('0'.repeat(62))).rejects.toThrow(
        'ENCRYPTION_KEY must be a 64-char hex string',
      );
    });

    it('throws when ENCRYPTION_KEY is longer than 32 bytes', async () => {
      await expect(makeModule('0'.repeat(66))).rejects.toThrow(
        'ENCRYPTION_KEY must be a 64-char hex string',
      );
    });
  });
});
