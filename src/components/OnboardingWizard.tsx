'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Copy, ExternalLink, Rocket, Trash2 } from 'lucide-react';
import ActiveModelSearch from '@/components/ActiveModelSearch';
import { useNotification } from '@/lib/NotificationContext';
import { CONTRACT_MINIMUMS, EXTERNAL_LINKS, getNetworkConfig } from '@/lib/constants';
import {
  type ActiveBid,
  type ActiveModel,
  weiPerSecToMorPerHour,
} from '@/lib/activeMorOrg';
import { formatBidContext, suggestBidWeiPerSec } from '@/lib/bidPricing';
import { VENICE_PRESETS, VENICE_DOCS } from '@/lib/venicePresets';
import {
  buildFullSecretsBlock,
  buildSecretVMSecrets,
  secretsAsEnvFile,
  SECRETVM_COMPOSE_HINT,
  SECRETVM_PORTAL,
  type BidPlanLine,
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

/** One marketplace model the operator plans to serve + bid on */
export interface PlannedModel {
  model: ActiveModel;
  pricePerSecond: string;
  apiUrl: string;
  apiKey: string;
  concurrentSlots: number;
  lowestMorHr: number | null;
  medianMorHr: number | null;
  bidCount: number;
  sample: { provider: string; morHr: number; wei: string }[];
}

export default function OnboardingWizard({
  deployPath,
  onDeployPathChange,
  onOpenBootstrap,
}: OnboardingWizardProps) {
  const { success, warning } = useNotification();
  const pathMeta = getDeployPath(deployPath);
  const networkConfig = getNetworkConfig('base', 'mainnet');

  const [planned, setPlanned] = useState<PlannedModel[]>([]);
  const [backendKind, setBackendKind] = useState<BackendKind>('own');
  const [walletKey, setWalletKey] = useState('');
  const [ethRpc, setEthRpc] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('');
  const [defaultApiUrl, setDefaultApiUrl] = useState(
    'http://your-model:8080/v1/chat/completions'
  );
  const [defaultApiKey, setDefaultApiKey] = useState('');
  const [defaultSlots, setDefaultSlots] = useState(6);
  const [venicePresetId, setVenicePresetId] = useState(VENICE_PRESETS[0].id);
  const [teeImage, setTeeImage] = useState(true);

  const venicePreset = VENICE_PRESETS.find((p) => p.id === venicePresetId) || VENICE_PRESETS[0];

  const addModel = (model: ActiveModel, allBids: ActiveBid[]) => {
    if (planned.some((p) => p.model.Id === model.Id)) {
      warning('Already added', model.Name);
      return;
    }
    const ctx = formatBidContext(model, allBids);
    const price = suggestBidWeiPerSec(model, allBids);
    const useVenice = backendKind === 'venice';
    setPlanned((prev) => [
      ...prev,
      {
        model,
        pricePerSecond: price,
        apiUrl: useVenice ? venicePreset.apiUrl : defaultApiUrl,
        apiKey: defaultApiKey,
        concurrentSlots: useVenice ? venicePreset.concurrentSlots : defaultSlots,
        lowestMorHr: ctx.lowestMorHr,
        medianMorHr: ctx.medianMorHr,
        bidCount: ctx.bidCount,
        sample: ctx.sample,
      },
    ]);
    success('Added', model.Name);
  };

  const updatePlanned = (id: string, patch: Partial<PlannedModel>) => {
    setPlanned((prev) => prev.map((p) => (p.model.Id === id ? { ...p, ...patch } : p)));
  };

  const removePlanned = (id: string) => {
    setPlanned((prev) => prev.filter((p) => p.model.Id !== id));
  };

  const applyBackendDefaultsToAll = (kind: BackendKind) => {
    setBackendKind(kind);
    if (kind === 'venice') {
      setDefaultApiUrl(venicePreset.apiUrl);
      setPlanned((prev) =>
        prev.map((p) => ({
          ...p,
          apiUrl: venicePreset.apiUrl,
          concurrentSlots: venicePreset.concurrentSlots,
        }))
      );
    }
  };

  const modelsForConfig: ModelsConfigModel[] = useMemo(
    () =>
      planned.map((p) => {
        const entry: ModelsConfigModel = {
          modelId: p.model.Id,
          modelName: p.model.Name,
          apiType: 'openai',
          apiUrl: p.apiUrl,
          concurrentSlots: p.concurrentSlots,
          capacityPolicy: 'simple',
        };
        if (p.apiKey.trim()) entry.apiKey = p.apiKey.trim();
        return entry;
      }),
    [planned]
  );

  const bidPlan: BidPlanLine[] = useMemo(
    () =>
      planned.map((p) => ({
        modelId: p.model.Id,
        modelName: p.model.Name,
        pricePerSecond: p.pricePerSecond,
        note:
          p.lowestMorHr != null
            ? `market lowest ~${p.lowestMorHr.toFixed(4)} MOR/hr`
            : undefined,
      })),
    [planned]
  );

  const cookieContent = `${adminUser}:${adminPass || 'CHANGE_ME'}`;

  const secretsInput = useMemo(
    () => ({
      walletPrivateKey: walletKey || '0xYOUR_PRIVATE_KEY',
      ethNodeAddress: ethRpc || 'wss://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
      webPublicUrl:
        webUrl ||
        (deployPath === 'secretvm' ? 'https://your-secretvm-url' : 'https://your-node.example.com'),
      cookieContent,
      models: modelsForConfig,
    }),
    [walletKey, ethRpc, webUrl, cookieContent, modelsForConfig, deployPath]
  );

  const secretRows = useMemo(
    () => (modelsForConfig.length ? buildSecretVMSecrets(secretsInput) : []),
    [secretsInput, modelsForConfig.length]
  );

  const fullBlock = useMemo(() => {
    if (!modelsForConfig.length) return '';
    return buildFullSecretsBlock({
      ...secretsInput,
      deployPath,
      bidPlan,
      chainId: networkConfig.chainId,
      diamondContract: networkConfig.diamondContract,
      morToken: networkConfig.morTokenContract,
    });
  }, [secretsInput, deployPath, bidPlan, modelsForConfig.length, networkConfig]);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    success('Copied', label);
  };

  const totalBidFeesMor = planned.length * 0.3;

  return (
    <Card className="border-primary/30 bg-zinc-900/95 shadow-lg">
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Rocket className="h-5 w-5 text-primary" />
          New provider onboarding
        </CardTitle>
        <CardDescription>
          Select one or more existing models on{' '}
          <a
            href={EXTERNAL_LINKS.activeStatus}
            className="text-blue-400 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            active.mor.org
          </a>
          , set bid prices from live market context, then copy a full secrets /{' '}
          <code className="text-xs">.env</code> block for {pathMeta.title}.
        </CardDescription>
        <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-400" />
          <p>
            <strong className="text-amber-300">Session only.</strong> Keys and passwords are{' '}
            <strong>not stored</strong> on any server — only used to generate config you copy.
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
            <TabsTrigger value="1-lookup">
              1. Models & bids{planned.length ? ` (${planned.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="2-backend">2. Backend defaults</TabsTrigger>
            <TabsTrigger value="3-secrets">3. Secrets</TabsTrigger>
            <TabsTrigger value="4-deploy">4. Deploy & connect</TabsTrigger>
          </TabsList>

          <TabsContent value="1-lookup" className="space-y-4 mt-4">
            <ActiveModelSearch
              multi
              selectedIds={planned.map((p) => p.model.Id)}
              onAdd={addModel}
              preferTag={deployPath === 'secretvm' && teeImage ? 'tee' : undefined}
            />

            {planned.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    Selected models ({planned.length}) — set your bid vs market
                  </p>
                  <p className="text-xs text-amber-300">
                    ~{totalBidFeesMor.toFixed(1)} MOR in bid fees when you post all (
                    {CONTRACT_MINIMUMS.MARKETPLACE_BID_FEE_WEI === '300000000000000000'
                      ? '0.3 MOR each'
                      : 'fee each'}
                    )
                  </p>
                </div>
                {planned.map((p) => (
                  <div
                    key={p.model.Id}
                    className="rounded-lg border border-zinc-700 bg-zinc-950/60 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm">{p.model.Name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground break-all">
                          {p.model.Id}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Market:{' '}
                          {p.lowestMorHr != null
                            ? `lowest ${p.lowestMorHr.toFixed(4)} MOR/hr`
                            : 'no live price'}
                          {p.medianMorHr != null
                            ? ` · median ~${p.medianMorHr.toFixed(4)} MOR/hr`
                            : ''}
                          {p.bidCount ? ` · ${p.bidCount} bid(s)` : ''}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-400"
                        onClick={() => removePlanned(p.model.Id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {p.sample.length > 0 && (
                      <ul className="text-[11px] font-mono space-y-0.5 max-h-20 overflow-y-auto text-muted-foreground border border-zinc-800 rounded p-2">
                        {p.sample.map((s, i) => (
                          <li key={`${s.provider}-${i}`} className="flex justify-between gap-2">
                            <span className="truncate">{s.provider.slice(0, 12)}…</span>
                            <span>{s.morHr.toFixed(4)} MOR/hr</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Your bid (wei / sec)</Label>
                        <Input
                          value={p.pricePerSecond}
                          onChange={(e) =>
                            updatePlanned(p.model.Id, { pricePerSecond: e.target.value })
                          }
                        />
                        <p className="text-[11px] text-muted-foreground">
                          ≈ {weiPerSecToMorPerHour(p.pricePerSecond || '0').toFixed(4)} MOR/hr
                          {p.lowestMorHr != null && (
                            <button
                              type="button"
                              className="ml-2 text-blue-400 hover:underline"
                              onClick={() =>
                                p.sample[0] &&
                                updatePlanned(p.model.Id, {
                                  pricePerSecond: p.sample[0].wei,
                                })
                              }
                            >
                              Match lowest
                            </button>
                          )}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Backend apiUrl</Label>
                        <Input
                          value={p.apiUrl}
                          onChange={(e) => updatePlanned(p.model.Id, { apiUrl: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">API key (optional)</Label>
                        <Input
                          type="password"
                          value={p.apiKey}
                          onChange={(e) => updatePlanned(p.model.Id, { apiKey: e.target.value })}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Concurrent slots</Label>
                        <Input
                          type="number"
                          min={1}
                          value={p.concurrentSlots}
                          onChange={(e) =>
                            updatePlanned(p.model.Id, {
                              concurrentSlots: Number(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="2-backend" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Defaults applied when you <strong>add</strong> a model. You can still edit each model
              in step 1. Venice works on any deploy path — map Venice models to Morpheus names you
              bid on.{' '}
              <a
                href={VENICE_DOCS.nodedocs}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Docs <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={backendKind === 'own' ? 'default' : 'outline'}
                onClick={() => applyBackendDefaultsToAll('own')}
              >
                Your own LLM / OpenAI-compatible
              </Button>
              <Button
                type="button"
                size="sm"
                variant={backendKind === 'venice' ? 'default' : 'outline'}
                onClick={() => applyBackendDefaultsToAll('venice')}
              >
                Venice API (e.g. Diem)
              </Button>
            </div>

            {backendKind === 'venice' ? (
              <div className="space-y-3">
                <Label>Venice preset (default for new adds)</Label>
                <select
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                  value={venicePresetId}
                  onChange={(e) => {
                    setVenicePresetId(e.target.value);
                    const preset = VENICE_PRESETS.find((x) => x.id === e.target.value);
                    if (preset) {
                      setDefaultApiUrl(preset.apiUrl);
                      setDefaultSlots(preset.concurrentSlots);
                    }
                  }}
                >
                  {VENICE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!planned.length}
                  onClick={() =>
                    setPlanned((prev) =>
                      prev.map((p) => ({
                        ...p,
                        apiUrl: venicePreset.apiUrl,
                        concurrentSlots: venicePreset.concurrentSlots,
                        apiKey: defaultApiKey || p.apiKey,
                      }))
                    )
                  }
                >
                  Apply Venice defaults to all selected models
                </Button>
                <div className="space-y-2">
                  <Label>Venice API key (default)</Label>
                  <Input
                    type="password"
                    placeholder="venice-…"
                    value={defaultApiKey}
                    onChange={(e) => setDefaultApiKey(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Default backend URL</Label>
                  <Input
                    value={defaultApiUrl}
                    onChange={(e) => setDefaultApiUrl(e.target.value)}
                    placeholder="http://my-model:8080/v1/chat/completions"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default API key (optional)</Label>
                  <Input
                    type="password"
                    value={defaultApiKey}
                    onChange={(e) => setDefaultApiKey(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default concurrent slots</Label>
                  <Input
                    type="number"
                    min={1}
                    value={defaultSlots}
                    onChange={(e) => setDefaultSlots(Number(e.target.value) || 1)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!planned.length}
                  onClick={() =>
                    setPlanned((prev) =>
                      prev.map((p) => ({
                        ...p,
                        apiUrl: defaultApiUrl,
                        apiKey: defaultApiKey,
                        concurrentSlots: defaultSlots,
                      }))
                    )
                  }
                >
                  Apply defaults to all selected models
                </Button>
              </div>
            )}
            {!planned.length && (
              <p className="text-xs text-amber-400">Add at least one model in step 1.</p>
            )}
          </TabsContent>

          <TabsContent value="3-secrets" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Full block for <strong>{pathMeta.title}</strong> includes all {planned.length} model
              (s) in MODELS_CONFIG plus a commented bid plan. Copy once into SecretVM or your{' '}
              <code className="text-xs">.env</code>.
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

            {planned.length > 0 && fullBlock && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => copy(`Full ${pathMeta.title} secrets`, fullBlock)}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy full secrets / .env block
                  </Button>
                  {deployPath === 'secretvm' && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          copy(
                            'MODELS_CONFIG_CONTENT value',
                            formatModelsConfigContent(modelsForConfig, 'secretvm-value')
                          )
                        }
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        MODELS_CONFIG value only
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copy('SecretVM 5 secrets', secretsAsEnvFile(secretRows))}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        5 SecretVM lines
                      </Button>
                    </>
                  )}
                  {deployPath !== 'secretvm' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        copy(
                          'MODELS_CONFIG_CONTENT line',
                          formatModelsConfigContent(modelsForConfig, 'single-line')
                        )
                      }
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      MODELS_CONFIG line only
                    </Button>
                  )}
                </div>
                <pre className="text-[10px] overflow-x-auto max-h-72 bg-black/50 border border-zinc-700 rounded p-3 whitespace-pre-wrap break-all">
                  {fullBlock}
                </pre>
              </div>
            )}
            {!planned.length && (
              <p className="text-xs text-amber-400">Add models in step 1 to generate secrets.</p>
            )}
          </TabsContent>

          <TabsContent value="4-deploy" className="space-y-4 mt-4 text-sm">
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="font-medium text-primary">Selected path: {pathMeta.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{pathMeta.blurb}</p>
              {planned.length > 0 && (
                <p className="text-xs mt-2">
                  After deploy: register provider, then post {planned.length} bid(s) from the plan in
                  your secrets comments (~{totalBidFeesMor.toFixed(1)} MOR fees).
                </p>
              )}
            </div>

            {deployPath === 'secretvm' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={teeImage}
                    onChange={(e) => setTeeImage(e.target.checked)}
                  />
                  Use hardened <code className="bg-muted px-1 rounded">-tee</code> image (optional)
                </label>
                <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                  <li>
                    {SECRETVM_COMPOSE_HINT}{' '}
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
                    Paste the <strong>full secrets block</strong> from step 3 into{' '}
                    <a
                      href={SECRETVM_PORTAL}
                      className="text-blue-400 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      SecretVM
                    </a>{' '}
                    (or secretvm-cli <code className="text-xs">--env</code>).
                  </li>
                  <li>
                    Healthcheck, connect MyProvider, register <code className="text-xs">host:3333</code>
                    , then bid each planned model Id at the planned pricePerSecond.
                  </li>
                </ol>
              </div>
            )}

            {(deployPath === 'container' ||
              deployPath === 'release' ||
              deployPath === 'github') && (
              <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
                <li>
                  Copy the full <code className="text-xs">.env</code> block from step 3 (or open
                  Bootstrap for download helpers).
                </li>
                <li>Start the node for this path; confirm healthcheck and public :3333.</li>
                <li>
                  Connect MyProvider → register provider → Available Models → Add Bid for each Id in
                  the bid plan comments.
                </li>
              </ol>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="button" onClick={onOpenBootstrap}>
                Open Bootstrap for {pathMeta.title}
              </Button>
              {fullBlock && (
                <Button type="button" variant="secondary" onClick={() => copy('Full secrets', fullBlock)}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy secrets again
                </Button>
              )}
              <a
                href={pathMeta.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline px-2"
              >
                Path docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
