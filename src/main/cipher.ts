import { safeStorage } from 'electron';
import type { Cipher } from '../core/store';

export function systemCipher(): Cipher {
  return {
    encrypt(plain: string) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('当前系统不能加密保存密码，请改用私钥，或稍后再试');
      }
      return `v1:${safeStorage.encryptString(plain).toString('base64')}`;
    },
    decrypt(payload: string) {
      const body = payload.startsWith('v1:') ? payload.slice(3) : payload;
      return safeStorage.decryptString(Buffer.from(body, 'base64'));
    },
  };
}
