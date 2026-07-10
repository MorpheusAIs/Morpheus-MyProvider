'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Copy, ExternalLink, Rocket } from 'lucide-react';
import ActiveModelSearch from '@/components/ActiveModelSearch';
import { useNotification } from '@/lib/NotificationContext';
import { EXTERNAL_LINKS } from '@/lib/constants';
import { type ActiveModel } from '@/lib/activeMorOrg';
import { VENICE_PRESETS, VENICE_DOCS } from '@/lib/venicePresets';
import {
  buildSecretVMSecrets,
  secretsAsEnvFile,
  SECRETVM_COMPOSE_HINT,
  SECRETVM_PORTAL,
} from '@/lib/secretvmSecrets';
import type { ModelsConfigModel } from '@/lib/modelsConfigFormat';
import { formatModelsConfigContent } from '@/lib/modelsConfigFormat';
import { DEPLOY_PATHS, getDeployPath, type DeployPath } from '@/lib/deployPaths';

interface OnboardingWizardProps {
  deployPath: DeployPath;
  onDeployPathChange: (path: DeployPath) => void;
  onOpenBootstrap: () => void;
}

type BackendKind = 'own' | 'venice';

export default function OnboardingWizard({
  deployPath,
  onDeployPathChange,
  onOpenBootstrap,
}: OnboardingWizardProps) {
  const { success } = useNotification();
  const pathMeta = getDeployPath(deployPath);

  const [selectedModel, setSelectedModel] = useState<ActiveModel | null>(null);
  const [backendKind, setBackendKind] = useState<BackendKind>('own');
  const [walletKey, setWalletKey] = useState('');
  const [ethRpc, setEthRpc] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('');
  const [apiUrl, setApiUrl] = useState('http://your-model:8080/v1/chat/completions');
  const [apiKey, setApiKey] = useState('');
  const [slots, setSlots] = useState(6);
  const [venicePresetId, setVenicePresetId] = useState(VENICE_PRESETS[0].id);
  const [teeImage, setTeeImage] = useState(true);

  const venicePreset = VENICE_PRESETS.find((p) => p.id === venicePresetId) || VENICE_PRESETS[0];

  const modelsForConfig: ModelsConfigModel[] = useMemo(() => {
    if (!selectedModel) return [];
    const useVenice = backendKind === 'venice';
    const base: ModelsConfigModel = {
      modelId: selectedModel.Id,
      modelName: selectedModel.Name,
      apiType: 'openai',
      apiUrl: useVenice ? venicePreset.apiUrl : apiUrl,
      concurrentSlots: useVenice ? venicePreset.concurrentSlots : slots,
      capacityPolicy: 'simple',
    };
    if (apiKey.trim()) base.apiKey = apiKey.trim();
    return [base];
  }, [selectedModel, backendKind, venicePreset, apiUrl, apiKey, slots]);

  const cookieContent = `${adminUser}:${adminPass || 'CHANGE_ME'}`;

  const secretRows = useMemo(() => {
    if (!modelsForConfig.length) return [];
    return buildSecretVMSecrets({
      walletPrivateKey: walletKey || '0xYOUR_PRIVATE_KEY',
      ethNodeAddress: ethRpc || 'wss://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
      webPublicUrl: webUrl || (deployPath === 'secretvm' ? 'https://your-secretvm-url' : 'https://your-node.example.com'),
      cookieContent,
      models: modelsForConfig,
    });
  }, [modelsForConfig, walletKey, ethRpc, webUrl, cookieContent, deployPath]);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    success('Copied', label);
  };

  return (
    <Card className="border-primary/30 bg-zinc-900/95 shadow-lg">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Rocket className="h-5 w-5 text-primary" />
          New provider onboarding
        </CardTitle>
        <CardDescription>
          Pick how you will run the proxy-router, look up an existing model on{' '}
          <a
            href={EXTERNAL_LINKS.activeStatus}
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            active.mor.org
          </a>
          , craft config, then deploy and connect. Venice (or any OpenAI-compatible API) is just a
          backend choice in step 2 — map its model to the Morpheus model Id you bid on.
        </CardDescription>
        <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <p>
            <strong className="text-amber-300">Session only.</strong> Private keys, passwords, and
            API keys you type here are <strong>not stored</strong> on any server — they stay in this
            browser tab and are only used to generate config you copy. Refreshing the page clears
            them.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DEPLOY_PATHS.map((p) => {
            const Icon = p.icon;
            const active = deployPath === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onDeployPathChange(p.id)}
                className={`text-left rounded-lg border p-4 transition ${
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/40'
                }`}
              >
                <Icon className="h-5 w-5 mb-2 text-primary" />
                <div className="font-semibold text-sm">{p.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{p.blurb}</div>
              </button>
            );
          })}
        </div>

        <Tabs defaultValue="1-lookup" className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1">
            <TabsTrigger value="1-lookup">1. Look up model</TabsTrigger>
            <TabsTrigger value="2-backend">2. Backend</TabsTrigger>
            <TabsTrigger value="3-secrets">3. Secrets</TabsTrigger>
            <TabsTrigger value="4-deploy">4. Deploy & connect</TabsTrigger>
          </TabsList>

          <TabsContent value="1-lookup" className="space-y-4 mt-4">
            <ActiveModelSearch
              onSelect={setSelectedModel}
              preferTag={deployPath === 'secretvm' && teeImage ? 'tee' : undefined}
            />
          </TabsContent>

          <TabsContent value="2-backend" className="space-y-4 mt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={backendKind === 'own' ? 'default' : 'outline'}
                onClick={() => setBackendKind('own')}
              >
                Your own LLM / OpenAI-compatible
              </Button>
              <Button
                type="button"
                size="sm"
                variant={backendKind === 'venice' ? 'default' : 'outline'}
                onClick={() => {
                  setBackendKind('venice');
                  setApiUrl(venicePreset.apiUrl);
                }}
              >
                Venice API (e.g. Diem)
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Reselling Venice works on <strong>any</strong> deploy path above. Bid on the Morpheus
              model name that matches what Venice serves — do not mint a duplicate, and do not use
              the <code className="bg-muted px-1 rounded">tee</code> tag for Venice backends.{' '}
              <a
                href={VENICE_DOCS.nodedocs}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Docs <ExternalLink className="h-3 w-3" />
              </a>
            </p>

            {backendKind === 'venice' ? (
              <div className="space-y-3">
                <Label>Venice preset</Label>
                <select
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={venicePresetId}
                  onChange={(e) => {
                    setVenicePresetId(e.target.value);
                    const p = VENICE_PRESETS.find((x) => x.id === e.target.value);
                    if (p) setApiUrl(p.apiUrl);
                  }}
                >
                  {VENICE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{venicePreset.notes}</p>
                <div className="space-y-2">
                  <Label>Venice API key</Label>
                  <Input
                    type="password"
                    placeholder="venice-…"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Backend OpenAI-compatible URL</Label>
                  <Input
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="http://my-model:8080/v1/chat/completions"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API key (optional)</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Concurrent slots</Label>
                  <Input
                    type="number"
                    min={1}
                    value={slots}
                    onChange={(e) => setSlots(Number(e.target.value) || 1)}
                  />
                </div>
              </div>
            )}
            {!selectedModel && (
              <p className="text-xs text-amber-400">Select a model in step 1 so we can fill modelId.</p>
            )}
          </TabsContent>

          <TabsContent value="3-secrets" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Values stay in this browser session only. Copy what you need into SecretVM / Docker /
              `.env` — nothing is uploaded from this form.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Wallet private key</Label>
                <Input
                  type="password"
                  value={walletKey}
                  onChange={(e) => setWalletKey(e.target.value)}
                  placeholder="0x…"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label>ETH_NODE_ADDRESS (Base RPC)</Label>
                <Input
                  value={ethRpc}
                  onChange={(e) => setEthRpc(e.target.value)}
                  placeholder="wss://base-mainnet.g.alchemy.com/v2/…"
                />
              </div>
              <div className="space-y-2">
                <Label>WEB_PUBLIC_URL</Label>
                <Input
                  value={webUrl}
                  onChange={(e) => setWebUrl(e.target.value)}
                  placeholder={
                    deployPath === 'secretvm'
                      ? 'https://your-secretvm-hostname'
                      : 'https://your-node.example.com'
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Admin user</Label>
                  <Input value={adminUser} onChange={(e) => setAdminUser(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Admin password</Label>
                  <Input
                    type="password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {selectedModel && modelsForConfig.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {deployPath === 'secretvm' && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          copy(
                            'MODELS_CONFIG_CONTENT (SecretVM value)',
                            formatModelsConfigContent(modelsForConfig, 'secretvm-value')
                          )
                        }
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copy MODELS_CONFIG_CONTENT value
                      </Button>
                      {secretRows.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => copy('SecretVM .env (5 secrets)', secretsAsEnvFile(secretRows))}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy all 5 SecretVM secrets
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      copy(
                        'MODELS_CONFIG_CONTENT (.env line)',
                        formatModelsConfigContent(modelsForConfig, 'single-line')
                      )
                    }
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy .env MODELS_CONFIG line
                  </Button>
                </div>

                {deployPath === 'secretvm' && (
                  <div className="rounded-md border border-zinc-700 bg-zinc-950/80 p-3 space-y-2">
                    <p className="text-sm font-medium">SecretVM encrypted secrets</p>
                    {secretRows.map((row) => (
                      <div key={row.key} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-primary">{row.key}</code>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => copy(row.key, row.value)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{row.hint}</p>
                        <pre className="text-[10px] overflow-x-auto max-h-16 bg-black/40 p-2 rounded">
                          {row.value.slice(0, 240)}
                          {row.value.length > 240 ? '…' : ''}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="4-deploy" className="space-y-4 mt-4 text-sm">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="font-medium text-primary">
                Selected path: {pathMeta.title}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{pathMeta.blurb}</p>
            </div>

            {deployPath === 'secretvm' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={teeImage}
                    onChange={(e) => setTeeImage(e.target.checked)}
                  />
                  Use hardened <code className="bg-muted px-1 rounded">-tee</code> image (recommended
                  for attestation; optional)
                </label>
                <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                  <li>
                    Download digest-pinned compose: {SECRETVM_COMPOSE_HINT}{' '}
                    <a
                      href={EXTERNAL_LINKS.releases}
                      className="text-blue-400 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Releases
                    </a>
                  </li>
                  <li>
                    Create VM at{' '}
                    <a
                      href={SECRETVM_PORTAL}
                      className="text-blue-400 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      SecretVM portal
                    </a>{' '}
                    — paste compose + the 5 secrets from step 3 (Intel TDX if using TEE).
                  </li>
                  <li>
                    Healthcheck: <code className="text-xs">curl https://&lt;vm&gt;/healthcheck</code>
                  </li>
                  <li>
                    Connect this app to <code className="text-xs">https://&lt;vm&gt;/</code> with
                    COOKIE_CONTENT credentials.
                  </li>
                  <li>
                    Provider tab → register <code className="text-xs">host:3333</code>. Models & Bids
                    → bid on the model Id from step 1.
                  </li>
                </ol>
              </div>
            )}

            {deployPath === 'container' && (
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>Open Bootstrap (below) — it opens on the Container tab for this path.</li>
                <li>
                  Generate / download `.env` including <code className="text-xs">MODELS_CONFIG_CONTENT</code>{' '}
                  from step 3.
                </li>
                <li>
                  <code className="text-xs">
                    docker pull ghcr.io/morpheusais/morpheus-lumerin-node:&lt;version&gt;
                  </code>
                </li>
                <li>
                  Run with published ports <code className="text-xs">3333</code> (public) and{' '}
                  <code className="text-xs">8082</code> (admin; HTTPS or private).
                </li>
                <li>Connect MyProvider → register provider → bid on existing model Id.</li>
              </ol>
            )}

            {deployPath === 'release' && (
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>Open Bootstrap — Release binary tab with OS-detected download links.</li>
                <li>
                  Save `.env` next to the binary; include MODELS_CONFIG from step 3 (or{' '}
                  <code className="text-xs">models-config.json</code>).
                </li>
                <li>
                  Run the binary; confirm <code className="text-xs">/healthcheck</code> and public{' '}
                  <code className="text-xs">:3333</code>.
                </li>
                <li>Connect MyProvider (desktop/local if admin is HTTP-only) → register → bid.</li>
              </ol>
            )}

            {deployPath === 'github' && (
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>
                  <code className="text-xs">
                    git clone https://github.com/MorpheusAIs/Morpheus-Lumerin-Node.git
                  </code>
                </li>
                <li>
                  <code className="text-xs">cd Morpheus-Lumerin-Node/proxy-router && ./build.sh</code>
                </li>
                <li>Copy `.env` from Bootstrap / step 3 into the working directory and start the binary.</li>
                <li>Connect MyProvider → register → bid on existing model Id.</li>
              </ol>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" onClick={onOpenBootstrap}>
                Open Bootstrap for {pathMeta.title}
              </Button>
              <a
                href={pathMeta.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline px-2"
              >
                Path docs <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={EXTERNAL_LINKS.nodedocsRegister}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline px-2"
              >
                Register on chain <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
