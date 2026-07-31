/**
 * Session-only stash of provider secrets (browser tab). Used so operator mode
 * can Save / Copy SecretVM secrets after bootstrap without re-entering keys.
 * Never uploaded.
 */

import type { SecretsFileV1 } from './secretsFile';
import { SECRETS_FILE_VERSION } from './secretsFile';
import { buildFullSecretsBlock } from './secretvmSecrets';
import type { ModelsConfigModel } from './modelsConfigFormat';
import type { LocalModel } from './types';

const SESSION_KEY = 'morpheus_provider_secrets_session';

export type ProviderSecretsSession = Omit<SecretsFileV1, 'version' | 'savedAt'> & {
  savedAt?: string;
};

export function saveProviderSecretsSession(data: ProviderSecretsSession): void {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        ...data,
        version: SECRETS_FILE_VERSION,
        savedAt: data.savedAt || new Date().toISOString(),
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadProviderSecretsSession(): ProviderSecretsSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SecretsFileV1;
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearProviderSecretsSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function secretsSessionFromFile(data: SecretsFileV1): ProviderSecretsSession {
  return {
    deployPath: data.deployPath || 'secretvm',
    walletPrivateKey: data.walletPrivateKey || '',
    ethNodeAddress: data.ethNodeAddress || '',
    webPublicUrl: data.webPublicUrl || '',
    adminUser: data.adminUser || 'admin',
    adminPass: data.adminPass || '',
    planned: data.planned,
    savedAt: data.savedAt,
  };
}

export function modelsFromLocalWithSessionKeys(
  local: LocalModel[],
  session: ProviderSecretsSession | null
): ModelsConfigModel[] {
  const keyMap = new Map<string, string>();
  for (const p of session?.planned || []) {
    if (p.apiKey) keyMap.set(p.modelId.toLowerCase(), p.apiKey);
  }
  return local.map((m) => {
    const entry: ModelsConfigModel = {
      modelId: m.Id,
      modelName: m.Model || m.Name,
      apiType: m.ApiType || 'openai',
      apiUrl: m.ApiUrl,
      concurrentSlots: m.Slots || 1,
      capacityPolicy: m.CapacityPolicy || 'simple',
    };
    const key = keyMap.get(m.Id.toLowerCase());
    if (key) entry.apiKey = key;
    return entry;
  });
}

/**
 * Full 5-line SecretVM secrets block from session + models.
 * Throws if session is missing wallet/password context.
 */
export function buildOperatorSecretsEnv(
  models: ModelsConfigModel[],
  session: ProviderSecretsSession | null = loadProviderSecretsSession()
): string {
  if (!session?.adminPass && !session?.walletPrivateKey) {
    throw new Error(
      'No session secrets — Load a secrets file (or Save during bootstrap) once first'
    );
  }
  return buildFullSecretsBlock({
    walletPrivateKey: session.walletPrivateKey || '0xYOUR_PRIVATE_KEY',
    ethNodeAddress: session.ethNodeAddress || 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
    webPublicUrl: session.webPublicUrl || '',
    cookieContent: `${session.adminUser || 'admin'}:${session.adminPass || ''}`,
    models,
    deployPath: 'secretvm',
  });
}
