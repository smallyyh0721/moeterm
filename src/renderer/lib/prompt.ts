import type { PublicConnection } from '../../shared/types';

export type SecretKind = 'password' | 'passphrase';

export function neededPrompt(connection: PublicConnection): SecretKind | null {
  if (connection.authType === 'password' && !connection.hasPassword) return 'password';
  if (connection.authType === 'privateKey' && connection.passphraseRequired && !connection.hasPassphrase) {
    return 'passphrase';
  }
  return null;
}

export interface TabModel {
  localId: string;
  sessionId: string | null;
  connectionId: string;
  title: string;
  status: 'connecting' | 'connected' | 'closed' | 'error';
  message?: string;
  code?: string;
  fingerprint?: string;
}

export interface TypedSecret {
  password?: string;
  passphrase?: string;
}
