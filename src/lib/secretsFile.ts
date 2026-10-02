/**
 * Save / load provider bootstrap secrets as a local JSON file (session helper).
 * Never uploaded — File System Access / download only.
 */

export const SECRETS_FILE_VERSION = 1 as const;

export interface SecretsFileV1 {
  version: typeof SECRETS_FILE_VERSION;
  savedAt: string;
  deployPath: string;
  walletPrivateKey: string;
  ethNodeAddress: string;
  webPublicUrl: string;
  adminUser: string;
  adminPass: string;
  /** Optional planned offerings for resume */
  planned?: Array<{
    modelId: string;
    modelName: string;
    priceMorPerHour: number;
    backendKind: 'own' | 'venice';
    backendModelName: string;
    apiUrl: string;
    apiKey: string;
    concurrentSlots: number;
    apiType?: string;
    capacityPolicy?: string;
  }>;
}

export function buildSecretsFile(input: Omit<SecretsFileV1, 'version' | 'savedAt'>): SecretsFileV1 {
  return {
    version: SECRETS_FILE_VERSION,
    savedAt: new Date().toISOString(),
    ...input,
  };
}

export function downloadSecretsFile(data: SecretsFileV1, filename = 'morpheus-provider-secrets.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readSecretsFile(file: File): Promise<SecretsFileV1> {
  const text = await file.text();
  const data = JSON.parse(text) as SecretsFileV1;
  if (data.version !== 1) throw new Error(`Unsupported secrets file version: ${String(data.version)}`);
  return data;
}

/** True when the saved session has a real node URL + admin password (enough to connect). */
export function secretsFileCanConnect(data: SecretsFileV1): boolean {
  const url = (data.webPublicUrl || '').trim();
  if (!url) return false;
  if (/PENDING|your-secretvm|localhost|example\.com/i.test(url)) return false;
  if (!(data.adminPass || '').trim()) return false;
  return true;
}
