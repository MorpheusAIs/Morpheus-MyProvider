/**
 * SecretVM encrypted-secrets bundle (5 vars).
 * Matches nodedocs SecretVM quickstart.
 */

import { formatModelsConfigContent, type ModelsConfigModel } from './modelsConfigFormat';

export interface SecretVMSecretsInput {
  walletPrivateKey: string;
  ethNodeAddress: string;
  webPublicUrl: string;
  cookieContent: string; // admin:password
  models: ModelsConfigModel[];
}

export interface SecretVMSecretRow {
  key: string;
  value: string;
  hint: string;
}

export function buildSecretVMSecrets(input: SecretVMSecretsInput): SecretVMSecretRow[] {
  const modelsJson = formatModelsConfigContent(input.models, 'secretvm-value');
  return [
    {
      key: 'WALLET_PRIVATE_KEY',
      value: input.walletPrivateKey.trim(),
      hint: 'Provider wallet private key (stays encrypted in the TEE)',
    },
    {
      key: 'ETH_NODE_ADDRESS',
      value: input.ethNodeAddress.trim(),
      hint: 'Base RPC WSS/HTTPS URL (Alchemy / Infura recommended)',
    },
    {
      key: 'MODELS_CONFIG_CONTENT',
      value: modelsJson,
      hint: 'Single-line JSON — paste as the secret value (no MODELS_CONFIG_CONTENT= prefix)',
    },
    {
      key: 'WEB_PUBLIC_URL',
      value: input.webPublicUrl.trim(),
      hint: 'Public HTTPS URL of this node (SecretVM Traefik URL)',
    },
    {
      key: 'COOKIE_CONTENT',
      value: input.cookieContent.trim(),
      hint: 'Basic Auth for MyProvider / Swagger (admin:password)',
    },
  ];
}

export function secretsAsEnvFile(rows: SecretVMSecretRow[]): string {
  return rows
    .map((r) => {
      // Quote values that contain spaces or special chars
      const needsQuotes = /[\s"'\\]/.test(r.value) || r.key === 'MODELS_CONFIG_CONTENT';
      if (needsQuotes) {
        return `${r.key}='${r.value.replace(/'/g, `'\\''`)}'`;
      }
      return `${r.key}=${r.value}`;
    })
    .join('\n');
}

export const SECRETVM_COMPOSE_HINT =
  'Download docker-compose.tee.deployed.yml from the latest Morpheus-Lumerin-Node GitHub Release (digest-pinned).';

export const SECRETVM_PORTAL = 'https://secretai.scrtlabs.com/secret-vms/create';
