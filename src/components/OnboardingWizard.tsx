'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, ExternalLink, Rocket, Shield, Boxes } from 'lucide-react';
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

type PathId = 'secretvm' | 'venice' | 'standard';

const PATHS: { id: PathId; title: string; blurb: string; icon: typeof Shield }[] = [
  {
    id: 'secretvm',
    title: 'SecretVM TEE',
    blurb: 'Hardened -tee image on SecretVM + MyProvider over HTTPS',
    icon: Shield,
  },
  {
    id: 'venice',
    title: 'Venice Diem resale',
    blurb: 'Monetize Venice API access by bidding on Morpheus models',
    icon: Boxes,
  },
  {
    id: 'standard',
    title: 'Standard / Docker',
    blurb: 'Your own LLM backend + proxy-router binary or container',
    icon: Rocket,
  },
];

export default function OnboardingWizard() {
  const { success } = useNotification();
  const [path, setPath] = useState<PathId>('secretvm');
  const [selectedModel, setSelectedModel] = useState<ActiveModel | null>(null);
  const [walletKey, setWalletKey] = useState('');
  const [ethRpc, setEthRpc] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('');
  const [apiUrl, setApiUrl] = useState('http://your-model:8080/v1/chat/completions');
  const [apiKey, setApiKey] = useState('');
  const [slots, setSlots] = useState(6);
  const [venicePresetId, setVenicePresetId] = useState(VENICE_PRESETS[0].id);

  const venicePreset = VENICE_PRESETS.find((p) => p.id === venicePresetId) || VENICE_PRESETS[0];

  const modelsForConfig: ModelsConfigModel[] = useMemo(() => {
    if (!selectedModel) return [];
    const base: ModelsConfigModel = {
      modelId: selectedModel.Id,
      modelName: selectedModel.Name,
      apiType: 'openai',
      apiUrl: path === 'venice' ? venicePreset.apiUrl : apiUrl,
      concurrentSlots: path === 'venice' ? venicePreset.concurrentSlots : slots,
      capacityPolicy: 'simple',
    };
    if (apiKey.trim()) base.apiKey = apiKey.trim();
    return [base];
  }, [selectedModel, path, venicePreset, apiUrl, apiKey, slots]);

  const cookieContent = `${adminUser}:${adminPass || 'CHANGE_ME'}`;

  const secretRows = useMemo(() => {
    if (!modelsForConfig.length) return [];
    return buildSecretVMSecrets({
      walletPrivateKey: walletKey || '0xYOUR_PRIVATE_KEY',
      ethNodeAddress: ethRpc || 'wss://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
      webPublicUrl: webUrl || 'https://your-secretvm-url',
      cookieContent,
      models: modelsForConfig,
    });
  }, [modelsForConfig, walletKey, ethRpc, webUrl, cookieContent]);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    success('Copied', label);
  };

  return (
    <Card className="border-primary/30 bg-zinc-900/95 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Rocket className="h-5 w-5 text-primary" />
          New provider onboarding
        </CardTitle>
        <CardDescription>
          Walk from marketplace lookup → secrets → deploy → connect this app. Prefer bidding on an
          existing model from{' '}
          <a href={EXTERNAL_LINKS.activeStatus} className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">
            active.mor.org
          </a>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-3">
          {PATHS.map((p) => {
            const Icon = p.icon;
            const active = path === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPath(p.id);
                  if (p.id === 'venice') {
                    setApiUrl(venicePreset.apiUrl);
                  }
                }}
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
              preferTag={path === 'secretvm' ? 'tee' : undefined}
            />
            {path === 'venice' && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-2">
                <p className="font-semibold">Venice Diem holders</p>
                <p>
                  Use your Venice API key to resell spare capacity on Morpheus. Confirm Venice TOS
                  allows resale. Do <strong>not</strong> use the <code>tee</code> tag — you cannot
                  attest Venice.
                </p>
                <a
                  href={VENICE_DOCS.nodedocs}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-300 hover:underline"
                >
                  Reselling Venice docs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </TabsContent>

          <TabsContent value="2-backend" className="space-y-4 mt-4">
            {path === 'venice' ? (
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
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Wallet private key</Label>
                <Input
                  type="password"
                  value={walletKey}
                  onChange={(e) => setWalletKey(e.target.value)}
                  placeholder="0x…"
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
                    path === 'secretvm'
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
                  />
                </div>
              </div>
            </div>

            {selectedModel && modelsForConfig.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
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
                    Copy .env line
                  </Button>
                  {path === 'secretvm' && secretRows.length > 0 && (
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
                </div>

                {path === 'secretvm' && (
                  <div className="rounded-md border border-zinc-700 bg-zinc-950/80 p-3 space-y-2">
                    <p className="text-sm font-medium">SecretVM encrypted secrets (paste into portal)</p>
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
            {path === 'secretvm' && (
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>
                  Download digest-pinned compose: {SECRETVM_COMPOSE_HINT}{' '}
                  <a href={EXTERNAL_LINKS.releases} className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">
                    Releases
                  </a>
                </li>
                <li>
                  Create VM at{' '}
                  <a href={SECRETVM_PORTAL} className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">
                    SecretVM portal
                  </a>{' '}
                  — paste compose + the 5 secrets from step 3 (Intel TDX).
                </li>
                <li>
                  Wait for health: <code className="text-xs">curl https://&lt;vm&gt;/healthcheck</code>
                </li>
                <li>
                  Connect this app to <code className="text-xs">https://&lt;vm&gt;/</code> with your
                  COOKIE_CONTENT user/password (below).
                </li>
                <li>
                  Provider tab → register <code className="text-xs">host:3333</code>. Models & Bids →
                  bid on the model Id from step 1 (Available Models). Sync config if needed.
                </li>
              </ol>
            )}
            {path === 'venice' && (
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>Run proxy-router (Docker/binary) with the secrets / MODELS_CONFIG from step 3.</li>
                <li>Expose :3333 publicly; keep :8082 private (or HTTPS for this hosted GUI).</li>
                <li>
                  Connect MyProvider → register provider → <strong>bid on the existing model</strong>{' '}
                  (do not mint duplicates).
                </li>
                <li>Price above your Venice cost — see nodedocs resale pricing.</li>
              </ol>
            )}
            {path === 'standard' && (
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>Use Bootstrap below (or step 3 exports) to craft .env / Docker env.</li>
                <li>Start proxy-router with your LLM backend reachable privately.</li>
                <li>Connect MyProvider → register → bid on existing model Id.</li>
              </ol>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href={EXTERNAL_LINKS.nodedocsSecretVm}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                SecretVM docs <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={EXTERNAL_LINKS.nodedocsVenice}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Venice resale docs <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={EXTERNAL_LINKS.nodedocsRegister}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Register on chain <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={EXTERNAL_LINKS.techMor}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                tech.mor.org <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground border-t border-zinc-700 pt-3">
              After the node is up, use <strong>Connect to API</strong> below with your public HTTPS
              URL and Basic Auth. Then finish provider registration and bidding in the tabs that
              appear.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
