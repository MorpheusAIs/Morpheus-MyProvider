/**
 * SecretVM encrypted-secrets bundle + standard .env export.
 * Matches nodedocs SecretVM / Docker / binary quickstarts.
 */

import { formatModelsConfigContent, type ModelsConfigModel } from './modelsConfigFormat';
import type { DeployPath } from './deployPaths';

/** First-boot WEB_PUBLIC_URL — real hostname is unknown until the VM starts. */
export const WEB_PUBLIC_URL_PLACEHOLDER = 'https://PENDING-SET-AFTER-VM-START';

/** Normalize portal hostname / URL → https://host (no trailing slash). */
export function normalizeSecretVmPublicUrl(raw: string): string {
  let s = raw.trim().replace(/\/+$/, '');
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return s;
  }
}

/** On-chain provider endpoint is host:3333 (proxy port), not the HTTPS admin URL. */
export function providerEndpointFromPublicUrl(publicUrl: string): string {
  const normalized = normalizeSecretVmPublicUrl(publicUrl);
  if (!normalized) return '';
  try {
    return `${new URL(normalized).hostname}:3333`;
  } catch {
    return '';
  }
}

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

export interface BidPlanLine {
  modelId: string;
  modelName: string;
  pricePerSecond: string;
  note?: string;
}

export function buildSecretVMSecrets(input: SecretVMSecretsInput): SecretVMSecretRow[] {
  const modelsJson = formatModelsConfigContent(input.models, 'secretvm-value');
  // Order matches SecretVM paste habit: MODELS_CONFIG_CONTENT last (edited most often).
  return [
    {
      key: 'WALLET_PRIVATE_KEY',
      value: input.walletPrivateKey.trim(),
      hint: 'Provider wallet private key (stays encrypted in the TEE)',
    },
    {
      key: 'ETH_NODE_ADDRESS',
      value: input.ethNodeAddress.trim(),
      hint: 'Base RPC HTTPS URL (Alchemy / Infura — https:// preferred)',
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
    {
      key: 'MODELS_CONFIG_CONTENT',
      value: modelsJson,
      hint: 'Single-line JSON — paste as the secret value (no MODELS_CONFIG_CONTENT= prefix)',
    },
  ];
}

export function secretsAsEnvFile(rows: SecretVMSecretRow[]): string {
  return rows
    .map((r) => {
      const needsQuotes = /[\s"'\\]/.test(r.value) || r.key === 'MODELS_CONFIG_CONTENT';
      if (needsQuotes) {
        return `${r.key}='${r.value.replace(/'/g, `'\\''`)}'`;
      }
      return `${r.key}=${r.value}`;
    })
    .join('\n');
}

/** Full copy-paste block for the selected install method (includes bid plan comments). */
export function buildFullSecretsBlock(
  input: SecretVMSecretsInput & {
    deployPath: DeployPath;
    bidPlan?: BidPlanLine[];
    chainId?: string;
    diamondContract?: string;
    morToken?: string;
    proxyPort?: string;
    apiPort?: string;
  }
): string {
  const bidComments =
    input.bidPlan && input.bidPlan.length
      ? [
          '# --- Bid plan (post these AFTER the node is up, via MyProvider Available Models) ---',
          '# Each postModelBid costs a non-refundable marketplaceBidFee (0.3 MOR).',
          ...input.bidPlan.map(
            (b) =>
              `# bid: ${b.modelName}  modelId=${b.modelId}  pricePerSecond=${b.pricePerSecond} wei/sec${
                b.note ? `  (${b.note})` : ''
              }`
          ),
          '#',
        ]
      : [];

  if (input.deployPath === 'secretvm') {
    // Exactly 5 KEY= lines, no comments — SecretVM rejects comment noise; MODELS last for easy edits.
    return secretsAsEnvFile(buildSecretVMSecrets(input));
  }

  const modelsLine = formatModelsConfigContent(input.models, 'single-line');
  return [
    `# Morpheus proxy-router .env — ${input.deployPath}`,
    '# Session-generated only; not uploaded anywhere.',
    ...bidComments,
    `WALLET_PRIVATE_KEY=${input.walletPrivateKey.trim() || '<FILL_ME>'}`,
    `ETH_NODE_ADDRESS=${input.ethNodeAddress.trim() || 'https://base-mainnet.g.alchemy.com/v2/<KEY>'}`,
    input.chainId ? `ETH_NODE_CHAIN_ID=${input.chainId}` : '# ETH_NODE_CHAIN_ID=8453',
    input.diamondContract
      ? `DIAMOND_CONTRACT_ADDRESS=${input.diamondContract}`
      : '# DIAMOND_CONTRACT_ADDRESS=…',
    input.morToken ? `MOR_TOKEN_ADDRESS=${input.morToken}` : '# MOR_TOKEN_ADDRESS=…',
    `WEB_PUBLIC_URL=${input.webPublicUrl.trim() || 'https://your-node.example.com'}`,
    `WEB_ADDRESS=0.0.0.0:${input.apiPort || '8082'}`,
    `PROXY_ADDRESS=0.0.0.0:${input.proxyPort || '3333'}`,
    `COOKIE_CONTENT=${input.cookieContent.trim() || 'admin:CHANGE_ME'}`,
    `ENVIRONMENT=production`,
    `LOG_LEVEL_APP=info`,
    modelsLine,
    '',
  ].join('\n');
}

export const SECRETVM_COMPOSE_HINT =
  'Download docker-compose.tee.deployed.yml from the latest Morpheus-Lumerin-Node GitHub Release (digest-pinned).';

export const SECRETVM_PORTAL = 'https://secretai.scrtlabs.com/secret-vms/create';
