'use client';

/**
 * SecretVM bootstrap — phased, with feedback:
 *  1) Bootstrap secrets (key + RPC + admin) — URL/models are placeholders
 *  2) Deploy compose → get hostname → re-paste secrets (restart 1)
 *  3) Connect to the node → register provider
 *  4) Models/backends → re-paste MODELS_CONFIG (restart 2) → bid
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  Plug,
  Save,
  Trash2,
} from 'lucide-react';
import ActiveModelSearch from '@/components/ActiveModelSearch';
import EthNodeHelper from '@/components/EthNodeHelper';
import VeniceModelPicker from '@/components/VeniceModelPicker';
import SecretVmStoryboard from '@/components/SecretVmStoryboard';
import NodeHealthPanel from '@/components/NodeHealthPanel';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { ApiService } from '@/lib/apiService';
import { CONTRACT_MINIMUMS, EXTERNAL_LINKS, getNetworkConfig } from '@/lib/constants';
import { type ActiveBid, type ActiveModel } from '@/lib/activeMorOrg';
import {
  formatBidContext,
  formatMorPerHourInput,
  morPerHourToWeiPerSec,
  suggestBidMorPerHour,
} from '@/lib/bidPricing';
import { VENICE_CHAT_URL, VENICE_DOCS } from '@/lib/venicePresets';
import {
  buildFullSecretsBlock,
  normalizeSecretVmPublicUrl,
  providerEndpointFromPublicUrl,
  SECRETVM_PORTAL,
  WEB_PUBLIC_URL_PLACEHOLDER,
  type BidPlanLine,
} from '@/lib/secretvmSecrets';
import type { ModelsConfigModel } from '@/lib/modelsConfigFormat';
import { formatModelsConfigContent } from '@/lib/modelsConfigFormat';
import { fetchLatestTeeCompose, type TeeComposeRelease } from '@/lib/teeRelease';
import {
  buildSecretsFile,
  downloadSecretsFile,
  readSecretsFile,
  secretsFileCanConnect,
} from '@/lib/secretsFile';
import {
  loadProviderSecretsSession,
  saveProviderSecretsSession,
  secretsSessionFromFile,
} from '@/lib/providerSession';
import { formatMor } from '@/lib/utils';

export interface PlannedModel {
  model: ActiveModel;
  priceMorPerHour: number;
  backendKind: 'own' | 'venice';
  backendModelName: string;
  apiUrl: string;
  apiKey: string;
  concurrentSlots: number;
  lowestMorHr: number | null;
  medianMorHr: number | null;
  bidCount: number;
  sample: { provider: string; morHr: number; wei: string }[];
  detailsOpen?: boolean;
}

interface SecretVmOnboardingProps {
  onOpenBootstrap: () => void;
  /** Called after a secrets file load successfully connects to the node. */
  onEnteredOperator?: () => void;
}

type WizardStep = '1-boot' | '2-deploy' | '3-connect' | '4-models';

export default function SecretVmOnboarding({
  onOpenBootstrap,
  onEnteredOperator,
}: SecretVmOnboardingProps) {
  const { success, warning, error: showError } = useNotification();
  const {
    configure,
    isConfigured,
    walletBalance,
    apiService,
    refreshWallet,
    getNetworkConfig: getLiveNetworkConfig,
  } = useApi();
  const networkConfig = getNetworkConfig('base', 'mainnet');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const teeFetched = useRef(false);

  const [step, setStep] = useState<WizardStep>('1-boot');
  const [planned, setPlanned] = useState<PlannedModel[]>([]);
  const [walletKey, setWalletKey] = useState('');
  const [ethRpc, setEthRpc] = useState('');
  const [hostnameRaw, setHostnameRaw] = useState('');
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('');
  const [teeImage, setTeeImage] = useState(true);
  const [teeCompose, setTeeCompose] = useState<TeeComposeRelease | null>(null);
  const [composeYaml, setComposeYaml] = useState('');
  const [teeLoading, setTeeLoading] = useState(false);
  const [venicePickerFor, setVenicePickerFor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [providerRegistered, setProviderRegistered] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const hydratedSession = useRef(false);

  // Resume form fields if session was stashed (e.g. incomplete Load from connect gate)
  useEffect(() => {
    if (hydratedSession.current) return;
    hydratedSession.current = true;
    const s = loadProviderSecretsSession();
    if (!s) return;
    if (s.walletPrivateKey) setWalletKey(s.walletPrivateKey);
    if (s.ethNodeAddress) setEthRpc(s.ethNodeAddress);
    if (s.webPublicUrl) setHostnameRaw(s.webPublicUrl);
    if (s.adminUser) setAdminUser(s.adminUser);
    if (s.adminPass) setAdminPass(s.adminPass);
    if (s.planned?.length) {
      setPlanned(
        s.planned.map((p) => ({
          model: { Id: p.modelId, Name: p.modelName },
          priceMorPerHour: p.priceMorPerHour,
          backendKind: p.backendKind,
          backendModelName: p.backendModelName,
          apiUrl: p.apiUrl,
          apiKey: p.apiKey,
          concurrentSlots: p.concurrentSlots,
          lowestMorHr: null,
          medianMorHr: null,
          bidCount: 0,
          sample: [],
        }))
      );
    }
  }, []);

  const cookieContent = `${adminUser}:${adminPass || 'CHANGE_ME'}`;
  const publicUrl = normalizeSecretVmPublicUrl(hostnameRaw);
  const providerEndpoint = publicUrl ? providerEndpointFromPublicUrl(publicUrl) : '';

  const veniceKeyDonor = useMemo(
    () => planned.find((p) => p.backendKind === 'venice' && p.apiKey.trim()),
    [planned]
  );

  const modelsForConfig: ModelsConfigModel[] = useMemo(
    () =>
      planned.map((p) => {
        const key =
          p.apiKey.trim() ||
          (p.backendKind === 'venice' ? veniceKeyDonor?.apiKey.trim() || '' : '');
        const entry: ModelsConfigModel = {
          modelId: p.model.Id,
          modelName: p.backendModelName.trim() || p.model.Name,
          apiType: 'openai',
          apiUrl: p.apiUrl,
          concurrentSlots: p.concurrentSlots,
          capacityPolicy: 'simple',
        };
        if (key) entry.apiKey = key;
        return entry;
      }),
    [planned, veniceKeyDonor]
  );

  const bidPlan: BidPlanLine[] = useMemo(
    () =>
      planned.map((p) => ({
        modelId: p.model.Id,
        modelName: p.model.Name,
        pricePerSecond: morPerHourToWeiPerSec(p.priceMorPerHour),
        note:
          `${formatMorPerHourInput(p.priceMorPerHour)} MOR/hr` +
          (p.lowestMorHr != null ? `; market low ~${p.lowestMorHr.toFixed(4)}` : '') +
          (p.backendModelName ? `; backend model=${p.backendModelName}` : ''),
      })),
    [planned]
  );

  const baseSecrets = useMemo(
    () => ({
      walletPrivateKey: walletKey || '0xYOUR_PRIVATE_KEY',
      ethNodeAddress: ethRpc || 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY',
      cookieContent,
      deployPath: 'secretvm' as const,
      bidPlan,
      chainId: networkConfig.chainId,
      diamondContract: networkConfig.diamondContract,
      morToken: networkConfig.morTokenContract,
    }),
    [walletKey, ethRpc, cookieContent, bidPlan, networkConfig]
  );

  /** First boot: placeholder URL + empty models — only three real inputs matter. */
  const bootstrapSecrets = useMemo(
    () =>
      buildFullSecretsBlock({
        ...baseSecrets,
        webPublicUrl: WEB_PUBLIC_URL_PLACEHOLDER,
        models: [],
      }),
    [baseSecrets]
  );

  /** After hostname: real URL, still empty models. */
  const hostnameSecrets = useMemo(
    () =>
      buildFullSecretsBlock({
        ...baseSecrets,
        webPublicUrl: publicUrl || WEB_PUBLIC_URL_PLACEHOLDER,
        models: [],
      }),
    [baseSecrets, publicUrl]
  );

  /** After models chosen: URL + MODELS_CONFIG. */
  const modelsSecrets = useMemo(
    () =>
      buildFullSecretsBlock({
        ...baseSecrets,
        webPublicUrl: publicUrl || WEB_PUBLIC_URL_PLACEHOLDER,
        models: modelsForConfig,
      }),
    [baseSecrets, publicUrl, modelsForConfig]
  );

  const bootReady = Boolean(walletKey.trim() && ethRpc.trim() && adminPass.trim());
  const hostnameReady = Boolean(publicUrl);

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    success('Copied', label);
  };

  const copyComposeExact = async () => {
    if (!composeYaml) {
      showError('Nothing to copy', 'Fetch the pinned compose first');
      return;
    }
    try {
      await navigator.clipboard.writeText(composeYaml);
      success('Copied compose YAML', 'Paste into SecretVM exactly — do not edit whitespace');
    } catch {
      showError('Copy failed', 'Select the YAML box and copy manually (⌘/Ctrl+C)');
    }
  };

  const loadTeeCompose = async () => {
    setTeeLoading(true);
    try {
      const rel = await fetchLatestTeeCompose();
      setTeeCompose(rel);
      setComposeYaml(rel.composeText);
      success(
        'Loaded digest-pinned compose',
        `${rel.tag} · image ${rel.imageDigest ?? '?'} · compose sha256 ${rel.composeSha256.slice(0, 12)}…`
      );
    } catch (e) {
      showError('Release fetch failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setTeeLoading(false);
    }
  };

  useEffect(() => {
    if (teeFetched.current) return;
    teeFetched.current = true;
    loadTeeCompose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConfigured || !apiService || !walletBalance?.address) return;
    let cancelled = false;
    (async () => {
      try {
        const providers = await apiService.getProviders();
        const mine = providers.find(
          (p) => p.Address.toLowerCase() === walletBalance.address.toLowerCase() && !p.IsDeleted
        );
        if (!cancelled) setProviderRegistered(!!mine);
      } catch {
        /* ignore — connect step can still register */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConfigured, apiService, walletBalance?.address]);

  const connectToNode = async () => {
    if (!publicUrl) {
      showError('Need hostname', 'Paste the SecretVM URL from the portal first');
      return;
    }
    if (!adminPass.trim()) {
      showError('Need password', 'Admin password from step 1');
      return;
    }
    setConnecting(true);
    try {
      await configure({
        baseUrl: publicUrl,
        username: adminUser.trim() || 'admin',
        password: adminPass,
      });
      persistSession();
      success('Connected', `${publicUrl} — node is reachable`);
      onEnteredOperator?.();
      setStep('3-connect');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'HEALTHCHECK_FAILED') {
        showError(
          'Not reachable yet',
          'Wait 2–3 min after restart, confirm secrets include WEB_PUBLIC_URL, then try again'
        );
      } else if (msg === 'AUTH_FAILED') {
        showError('Auth failed', 'Check admin user/password match COOKIE_CONTENT');
      } else {
        showError('Connect failed', msg || ApiService.parseError(err));
      }
    } finally {
      setConnecting(false);
    }
  };

  const registerProvider = async () => {
    if (!apiService || !walletBalance) {
      showError('Connect first', 'Probe the node before registering');
      return;
    }
    if (!providerEndpoint) {
      showError('Missing endpoint', 'Hostname required for host:3333');
      return;
    }
    const stakeWei = CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE;
    const mor = BigInt(walletBalance.balance || '0');
    const eth = BigInt(walletBalance.ethBalance || '0');
    if (mor < BigInt(stakeWei)) {
      showError(
        'Not enough MOR',
        `Need ≥ ${formatMor(stakeWei)} MOR for stake (wallet has ${formatMor(walletBalance.balance)})`
      );
      return;
    }
    if (eth <= BigInt(0)) {
      showError('No ETH for gas', 'Send a little ETH on Base to this wallet before registering');
      return;
    }
    const liveNet = getLiveNetworkConfig();
    const diamond = liveNet?.diamondContract || networkConfig.diamondContract;

    setRegistering(true);
    try {
      const allowance = await apiService.getAllowance(diamond);
      if (BigInt(allowance || '0') < BigInt(stakeWei)) {
        warning('Approving MOR', `Allow Diamond to spend ${formatMor(stakeWei)} MOR…`);
        await apiService.approve(diamond, stakeWei);
        await new Promise((r) => setTimeout(r, 5000));
      }
      await apiService.createProvider({ endpoint: providerEndpoint, stake: stakeWei });
      setProviderRegistered(true);
      await refreshWallet();
      success('Provider registered', `${providerEndpoint} · stake ${formatMor(stakeWei)} MOR`);
    } catch (err) {
      showError('Register failed', ApiService.parseError(err));
    } finally {
      setRegistering(false);
    }
  };

  const addModel = (model: ActiveModel, allBids: ActiveBid[]) => {
    if (planned.some((p) => p.model.Id === model.Id)) {
      warning('Already added', model.Name);
      return;
    }
    const ctx = formatBidContext(model, allBids);
    const morHr = suggestBidMorPerHour(model, allBids);
    setPlanned((prev) => [
      ...prev,
      {
        model,
        priceMorPerHour: morHr || 0.1,
        backendKind: 'own',
        backendModelName: '',
        apiUrl: 'http://your-model:8080/v1/chat/completions',
        apiKey: '',
        concurrentSlots: 6,
        lowestMorHr: ctx.lowestMorHr,
        medianMorHr: ctx.medianMorHr,
        bidCount: ctx.bidCount,
        sample: ctx.sample,
      },
    ]);
    setExpanded((prev) => [...prev, model.Id]);
    success('Added', model.Name);
  };

  const updatePlanned = (id: string, patch: Partial<PlannedModel>) => {
    setPlanned((prev) => prev.map((p) => (p.model.Id === id ? { ...p, ...patch } : p)));
  };

  const removePlanned = (id: string) => {
    setPlanned((prev) => prev.filter((p) => p.model.Id !== id));
    setExpanded((prev) => prev.filter((x) => x !== id));
  };

  const openVenicePicker = (id: string) => {
    const donorKey = veniceKeyDonor?.apiKey || '';
    updatePlanned(id, {
      backendKind: 'venice',
      apiUrl: VENICE_CHAT_URL,
      concurrentSlots: 4,
      ...(donorKey ? { apiKey: donorKey } : {}),
    });
    setVenicePickerFor(id);
    setExpanded((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const persistSession = () => {
    saveProviderSecretsSession({
      deployPath: 'secretvm',
      walletPrivateKey: walletKey,
      ethNodeAddress: ethRpc,
      webPublicUrl: publicUrl || hostnameRaw,
      adminUser,
      adminPass,
      planned: planned.map((p) => ({
        modelId: p.model.Id,
        modelName: p.model.Name,
        priceMorPerHour: p.priceMorPerHour,
        backendKind: p.backendKind,
        backendModelName: p.backendModelName,
        apiUrl: p.apiUrl,
        apiKey: p.apiKey,
        concurrentSlots: p.concurrentSlots,
      })),
    });
  };

  const saveToDisk = () => {
    persistSession();
    downloadSecretsFile(
      buildSecretsFile({
        deployPath: 'secretvm',
        walletPrivateKey: walletKey,
        ethNodeAddress: ethRpc,
        webPublicUrl: publicUrl,
        adminUser,
        adminPass,
        planned: planned.map((p) => ({
          modelId: p.model.Id,
          modelName: p.model.Name,
          priceMorPerHour: p.priceMorPerHour,
          backendKind: p.backendKind,
          backendModelName: p.backendModelName,
          apiUrl: p.apiUrl,
          apiKey: p.apiKey,
          concurrentSlots: p.concurrentSlots,
        })),
      })
    );
    success('Saved', 'morpheus-provider-secrets.json');
  };

  const loadFromDisk = async (file: File) => {
    setLoadingFile(true);
    try {
      const data = await readSecretsFile(file);
      setWalletKey(data.walletPrivateKey || '');
      setEthRpc(data.ethNodeAddress || '');
      setHostnameRaw(data.webPublicUrl || '');
      setAdminUser(data.adminUser || 'admin');
      setAdminPass(data.adminPass || '');
      saveProviderSecretsSession(secretsSessionFromFile(data));
      if (data.planned?.length) {
        setPlanned(
          data.planned.map((p) => ({
            model: { Id: p.modelId, Name: p.modelName },
            priceMorPerHour: p.priceMorPerHour,
            backendKind: p.backendKind,
            backendModelName: p.backendModelName,
            apiUrl: p.apiUrl,
            apiKey: p.apiKey,
            concurrentSlots: p.concurrentSlots,
            lowestMorHr: null,
            medianMorHr: null,
            bidCount: 0,
            sample: [],
          }))
        );
        setExpanded(data.planned.map((p) => p.modelId));
      }

      if (secretsFileCanConnect(data)) {
        const baseUrl = normalizeSecretVmPublicUrl(data.webPublicUrl);
        try {
          await configure({
            baseUrl,
            username: (data.adminUser || 'admin').trim(),
            password: data.adminPass,
          });
          success(
            'Connected from file',
            `${baseUrl} — opening operator console`
          );
          onEnteredOperator?.();
          return;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          warning(
            'Loaded — connect failed',
            msg === 'HEALTHCHECK_FAILED'
              ? 'File OK but node unreachable. Check WEB_PUBLIC_URL / that the VM is up.'
              : msg === 'AUTH_FAILED'
                ? 'File OK but admin password rejected.'
                : ApiService.parseError(err)
          );
          setStep('3-connect');
          return;
        }
      }

      success(
        'Loaded',
        data.planned?.length
          ? `${file.name} · ${data.planned.length} model(s) — finish hostname/password to connect`
          : `${file.name} — missing node URL or password; continue bootstrap`
      );
      if (!(data.webPublicUrl || '').trim() || /PENDING/i.test(data.webPublicUrl || '')) {
        setStep('2-deploy');
      } else {
        setStep('3-connect');
      }
    } catch (e) {
      showError('Load failed', e instanceof Error ? e.message : 'Invalid file');
    } finally {
      setLoadingFile(false);
    }
  };

  const totalBidFeesMor = planned.length * 0.3;
  const pickerModel = planned.find((p) => p.model.Id === venicePickerFor);
  const minStakeMor = formatMor(CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE);
  const minStakeWei = BigInt(CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE);

  const morWei = BigInt(walletBalance?.balance || '0');
  const ethWei = BigInt(walletBalance?.ethBalance || '0');
  const hasEnoughMor = morWei >= minStakeWei;
  const hasEthForGas = ethWei > BigInt(0);
  const canRegister = hasEnoughMor && hasEthForGas && Boolean(providerEndpoint);

  const StepPill = ({
    n,
    label,
    done,
    active,
  }: {
    n: number;
    label: string;
    done?: boolean;
    active?: boolean;
  }) => (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border ${
        done
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          : active
            ? 'border-sky-500/50 bg-sky-500/15 text-sky-100'
            : 'border-zinc-700 text-zinc-500'
      }`}
    >
      {done ? <CheckCircle2 className="h-3 w-3" /> : <span className="font-mono">{n}</span>}
      {label}
    </div>
  );

  return (
    <div className="space-y-4">
      {!isConfigured && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100 flex flex-wrap items-center justify-between gap-2">
          <p>
            <strong className="text-emerald-200">Returning provider?</strong> Load your saved session
            file — if it has the node URL + admin password we connect and open the fleet console.
          </p>
          <Button
            type="button"
            size="sm"
            className="h-7 bg-emerald-600 hover:bg-emerald-500 text-black font-semibold shrink-0"
            disabled={loadingFile}
            onClick={() => fileInputRef.current?.click()}
          >
            {loadingFile ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5 mr-1" />
            )}
            Load &amp; connect
          </Button>
        </div>
      )}

      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-100 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-medium text-sky-200">SecretVM — one step at a time</p>
          <SecretVmStoryboard variant="banner" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StepPill n={1} label="Bootstrap" done={bootReady} active={step === '1-boot'} />
          <StepPill n={2} label="Hostname" done={hostnameReady} active={step === '2-deploy'} />
          <StepPill n={3} label="Connect" done={isConfigured} active={step === '3-connect'} />
          <StepPill
            n={4}
            label="Models"
            done={providerRegistered && planned.length > 0}
            active={step === '4-models'}
          />
        </div>
      </div>

      <Tabs value={step} onValueChange={(v) => setStep(v as WizardStep)} className="w-full">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <TabsList className="flex flex-wrap h-auto gap-1 flex-1 min-w-0">
            <TabsTrigger value="1-boot">1. Bootstrap</TabsTrigger>
            <TabsTrigger value="2-deploy">2. Deploy + hostname</TabsTrigger>
            <TabsTrigger value="3-connect" disabled={!bootReady}>
              3. Connect
            </TabsTrigger>
            <TabsTrigger value="4-models" disabled={!isConfigured && !hostnameReady}>
              4. Models
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1 shrink-0">
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={saveToDisk}>
              <Save className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={loadingFile}
              onClick={() => fileInputRef.current?.click()}
            >
              {loadingFile ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5 mr-1" />
              )}
              Load
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void loadFromDisk(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {/* -------- 1 BOOTSTRAP -------- */}
        <TabsContent value="1-boot" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Only three values for the first boot. URL and models stay as placeholders until later.
          </p>

          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-400" />
            <p>
              Fund this wallet on Base with <strong>MOR + ETH</strong> before register/bids (≥{' '}
              <strong>{minStakeMor} MOR</strong> stake + <strong>0.3 MOR</strong> per bid + ETH gas).
            </p>
          </div>

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
              <div className="flex items-center justify-between gap-2">
                <Label>ETH_NODE_ADDRESS (Base RPC)</Label>
                <EthNodeHelper />
              </div>
              <Input
                value={ethRpc}
                onChange={(e) => setEthRpc(e.target.value)}
                placeholder="https://base-mainnet.g.alchemy.com/v2/…"
              />
            </div>
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
                placeholder="used for COOKIE_CONTENT + MyProvider connect"
              />
            </div>
          </div>

          <div className="rounded-md border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
            <p>
              Auto-filled placeholders (do not edit yet):{' '}
              <code className="text-zinc-300">WEB_PUBLIC_URL={WEB_PUBLIC_URL_PLACEHOLDER}</code>
            </p>
            <p>
              <code className="text-zinc-300">MODELS_CONFIG_CONTENT=&#39;&#123;&quot;models&quot;:[]&#125;&#39;</code>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!bootReady}
              className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
              onClick={() => {
                copy('Bootstrap secrets (5 lines)', bootstrapSecrets);
                setStep('2-deploy');
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy bootstrap secrets → Deploy
            </Button>
          </div>

          <pre className="text-[10px] overflow-x-auto max-h-40 bg-black/50 border border-zinc-700 rounded p-3 whitespace-pre-wrap break-all">
            {bootstrapSecrets}
          </pre>
        </TabsContent>

        {/* -------- 2 DEPLOY + HOSTNAME -------- */}
        <TabsContent value="2-deploy" className="space-y-4 mt-4 text-sm">
          <div className="rounded-lg border border-zinc-700 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-sm">A · Paste digest-pinned compose</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={teeLoading}
                onClick={loadTeeCompose}
              >
                {teeLoading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5 mr-1" />
                )}
                Fetch latest pinned release
              </Button>
            </div>
            {teeCompose && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] font-mono text-emerald-100/90 break-all">
                {teeCompose.tag} · {teeCompose.imageDigest} · compose {teeCompose.composeSha256}
              </div>
            )}
            <textarea
              readOnly
              spellCheck={false}
              value={composeYaml}
              placeholder="Fetch fills this box…"
              className="w-full min-h-[160px] max-h-[280px] text-[10px] font-mono leading-relaxed bg-black/60 border border-zinc-700 rounded p-3 text-zinc-200 whitespace-pre overflow-auto resize-y"
            />
            <Button
              type="button"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
              disabled={!composeYaml}
              onClick={() => void copyComposeExact()}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy compose YAML
            </Button>
          </div>

          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground text-xs">
            <li>
              Open{' '}
              <a
                href={SECRETVM_PORTAL}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline"
              >
                SecretVM portal
              </a>{' '}
              → new VM → paste compose (Intel TDX if TEE).
            </li>
            <li>Paste <strong>bootstrap secrets</strong> from step 1 → start the VM.</li>
            <li>
              When Overview shows the URL (e.g. <code>jade-chipmunk.vm.scrtlabs.com</code>), paste it
              below.
            </li>
          </ol>

          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
            <p className="font-medium text-sm text-amber-100">B · Hostname → restart 1</p>
            <div className="space-y-2">
              <Label>SecretVM hostname / URL</Label>
              <Input
                value={hostnameRaw}
                onChange={(e) => setHostnameRaw(e.target.value)}
                placeholder="jade-chipmunk.vm.scrtlabs.com"
              />
              {publicUrl && (
                <p className="text-[11px] text-emerald-300/90">
                  Will set <code>WEB_PUBLIC_URL={publicUrl}</code>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!hostnameReady || !bootReady}
                className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
                onClick={() => copy('Secrets with WEB_PUBLIC_URL', hostnameSecrets)}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy secrets with URL
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!hostnameReady}
                onClick={() => setStep('3-connect')}
              >
                Done — go to Connect
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Update encrypted secrets in the portal → restart VM → wait ~2–3 minutes → Connect.
            </p>
            {hostnameReady && (
              <pre className="text-[10px] overflow-x-auto max-h-36 bg-black/50 border border-zinc-700 rounded p-3 whitespace-pre-wrap break-all">
                {hostnameSecrets}
              </pre>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Button type="button" size="sm" variant="outline" onClick={onOpenBootstrap}>
              Advanced ENV helper
            </Button>
            <a
              href="https://nodedocs.mor.org/providers/full/secretvm-quickstart"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 hover:underline px-2"
            >
              SecretVM docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </TabsContent>

        {/* -------- 3 CONNECT -------- */}
        <TabsContent value="3-connect" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            After restart 1, probe the node with the URL + admin password you already have. On
            success, register as a provider (models still empty is fine).
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Node URL</Label>
              <Input
                value={hostnameRaw}
                onChange={(e) => setHostnameRaw(e.target.value)}
                placeholder="jade-chipmunk.vm.scrtlabs.com"
              />
              {publicUrl && (
                <p className="text-[11px] text-muted-foreground">Connects to {publicUrl}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Admin password</Label>
              <Input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!hostnameReady || !adminPass.trim() || connecting}
              className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
              onClick={() => void connectToNode()}
            >
              {connecting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Plug className="h-3.5 w-3.5 mr-1" />
              )}
              {isConfigured ? 'Reconnect' : 'Probe & connect'}
            </Button>
            {isConfigured && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
                {walletBalance?.address
                  ? ` · ${walletBalance.address.slice(0, 6)}…${walletBalance.address.slice(-4)}`
                  : ''}
              </span>
            )}
          </div>

          {isConfigured && walletBalance && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="text-xs space-y-1">
                <p>
                  MOR balance:{' '}
                  <strong
                    className={hasEnoughMor ? 'text-foreground' : 'text-amber-300'}
                  >
                    {formatMor(walletBalance.balance)}
                  </strong>
                  {' · '}
                  ETH:{' '}
                  <strong
                    className={hasEthForGas ? 'text-foreground' : 'text-amber-300'}
                  >
                    {formatMor(walletBalance.ethBalance || '0')}
                  </strong>
                </p>
                <p className="text-muted-foreground break-all">
                  Fund wallet{' '}
                  <code className="text-emerald-200">{walletBalance.address}</code> on Base
                </p>
                <p className="text-muted-foreground">
                  Provider endpoint will be{' '}
                  <code className="text-emerald-200">{providerEndpoint || 'host:3333'}</code>
                </p>
              </div>

              {!providerRegistered && !canRegister && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 space-y-1">
                  <p className="font-medium text-amber-200">Fund before register</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {!hasEnoughMor && (
                      <li>
                        Need ≥ <strong>{minStakeMor} MOR</strong> stake (have{' '}
                        {formatMor(walletBalance.balance)})
                      </li>
                    )}
                    {!hasEthForGas && (
                      <li>
                        Need <strong>ETH on Base</strong> for gas (balance is zero)
                      </li>
                    )}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-1 h-7 text-xs"
                    onClick={() => void refreshWallet()}
                  >
                    Refresh balances
                  </Button>
                </div>
              )}

              {providerRegistered ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Provider already registered
                  </span>
                  <Button type="button" size="sm" onClick={() => setStep('4-models')}>
                    Continue to models
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={registering || !canRegister}
                    onClick={() => void registerProvider()}
                  >
                    {registering ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : null}
                    Register provider ({minStakeMor} MOR stake)
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Or use the Provider tab below once funded. Then step 4 for models / MODELS_CONFIG
                    (restart 2).
                  </p>
                </div>
              )}

              {providerRegistered && <NodeHealthPanel compact />}
            </div>
          )}

          {!isConfigured && (
            <p className="text-[11px] text-muted-foreground">
              Tip: if healthcheck fails, confirm you re-pasted secrets with{' '}
              <code>WEB_PUBLIC_URL</code> and the VM finished restarting.
            </p>
          )}
        </TabsContent>

        {/* -------- 4 MODELS -------- */}
        <TabsContent value="4-models" className="space-y-4 mt-4">
          {!isConfigured && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Connect first (step 3) so you can place bids after updating MODELS_CONFIG. You can still
              plan backends here.
            </div>
          )}

          <div className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-100/90 space-y-1">
            <p className="font-medium text-sky-200">Operator order (after register)</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-sky-100/80">
              <li>
                Put backends in <code className="text-[10px]">MODELS_CONFIG</code> → copy secrets →
                update SecretVM → restart (you may already be here).
              </li>
              <li>
                <strong>Then</strong> place the on-chain bid (~0.3 MOR) in{' '}
                <strong>Models &amp; Bids</strong> below — config alone does not list you on the
                marketplace.
              </li>
              <li>
                Watch <code className="text-[10px]">/healthcheck</code>:{' '}
                <code className="text-[10px]">no_bid</code> means config is loaded but no bid yet;{' '}
                <code className="text-[10px]">healthy</code> means bid + backend probe OK.
              </li>
            </ol>
          </div>

          {isConfigured && <NodeHealthPanel />}

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={teeImage}
              onChange={(e) => setTeeImage(e.target.checked)}
            />
            Prefer models tagged <code className="bg-muted px-1 rounded">tee</code> in search
          </label>

          <ActiveModelSearch
            multi
            selectedIds={planned.map((p) => p.model.Id)}
            onAdd={addModel}
            preferTag={teeImage ? 'tee' : undefined}
          />

          {planned.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Offerings ({planned.length})</p>
                <p className="text-xs text-amber-300">
                  ~{totalBidFeesMor.toFixed(1)} MOR bid fees when you post all
                </p>
              </div>

              <Accordion
                type="multiple"
                value={expanded}
                onValueChange={setExpanded}
                className="space-y-2"
              >
                {planned.map((p) => {
                  const inheritsVeniceKey =
                    p.backendKind === 'venice' &&
                    !p.apiKey.trim() &&
                    !!veniceKeyDonor &&
                    veniceKeyDonor.model.Id !== p.model.Id;
                  const showsOwnKeyField =
                    p.backendKind === 'own' ||
                    (p.backendKind === 'venice' &&
                      (!veniceKeyDonor || veniceKeyDonor.model.Id === p.model.Id));

                  return (
                    <AccordionItem
                      key={p.model.Id}
                      value={p.model.Id}
                      className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 border-b-zinc-700"
                    >
                      <div className="flex items-center gap-2">
                        <AccordionTrigger className="flex-1 hover:no-underline py-3">
                          <div className="text-left min-w-0">
                            <div className="font-semibold text-sm truncate">{p.model.Name}</div>
                            <div className="text-[11px] text-muted-foreground font-normal">
                              {formatMorPerHourInput(p.priceMorPerHour)} MOR/hr
                              {p.backendKind === 'venice' ? ' · Venice' : ' · own backend'}
                              {p.backendModelName ? ` · ${p.backendModelName}` : ''}
                            </div>
                          </div>
                        </AccordionTrigger>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400"
                          onClick={() => removePlanned(p.model.Id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <AccordionContent className="pb-3 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Price (MOR/hour)</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              value={p.priceMorPerHour}
                              onChange={(e) =>
                                updatePlanned(p.model.Id, {
                                  priceMorPerHour: Number(e.target.value) || 0,
                                })
                              }
                            />
                            <p className="text-[10px] text-muted-foreground">
                              → {morPerHourToWeiPerSec(p.priceMorPerHour)} wei/sec on-chain
                              {p.lowestMorHr != null
                                ? ` · market low ~${p.lowestMorHr.toFixed(4)} MOR/hr`
                                : ''}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Concurrent slots</Label>
                            <Input
                              type="number"
                              value={p.concurrentSlots}
                              onChange={(e) =>
                                updatePlanned(p.model.Id, {
                                  concurrentSlots: Number(e.target.value) || 1,
                                })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={p.backendKind === 'own' ? 'default' : 'outline'}
                            onClick={() =>
                              updatePlanned(p.model.Id, {
                                backendKind: 'own',
                                apiUrl: 'http://your-model:8080/v1/chat/completions',
                              })
                            }
                          >
                            Own backend
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={p.backendKind === 'venice' ? 'default' : 'outline'}
                            onClick={() => openVenicePicker(p.model.Id)}
                          >
                            Venice
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Backend modelName</Label>
                            <Input
                              value={p.backendModelName}
                              onChange={(e) =>
                                updatePlanned(p.model.Id, { backendModelName: e.target.value })
                              }
                              placeholder="venice / local id"
                            />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Backend apiUrl</Label>
                            <Input
                              value={p.apiUrl}
                              onChange={(e) =>
                                updatePlanned(p.model.Id, { apiUrl: e.target.value })
                              }
                              placeholder="https://host/v1/chat/completions"
                            />
                            {p.backendKind === 'own' && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                <span className="text-[10px] text-muted-foreground self-center">
                                  Path helper:
                                </span>
                                {(
                                  [
                                    ['/v1/chat/completions', 'chat'],
                                    ['/v1/embeddings', 'embed'],
                                    ['/v1/audio/speech', 'tts'],
                                  ] as const
                                ).map(([path, label]) => (
                                  <Button
                                    key={path}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2"
                                    onClick={() => {
                                      const base = p.apiUrl
                                        .replace(/\/v1\/(chat\/completions|embeddings|audio\/speech)\/?$/i, '')
                                        .replace(/\/$/, '');
                                      const root =
                                        base && /^https?:\/\//i.test(base)
                                          ? base
                                          : 'http://your-model:8080';
                                      updatePlanned(p.model.Id, { apiUrl: `${root}${path}` });
                                    }}
                                  >
                                    {label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {showsOwnKeyField && (
                          <div className="space-y-1">
                            <Label className="text-xs">
                              {p.backendKind === 'venice' ? 'Venice API key' : 'Backend API key'}
                            </Label>
                            <Input
                              type="password"
                              value={p.apiKey}
                              onChange={(e) =>
                                updatePlanned(p.model.Id, { apiKey: e.target.value })
                              }
                              autoComplete="off"
                            />
                          </div>
                        )}
                        {inheritsVeniceKey && (
                          <p className="text-[10px] text-emerald-300/80">
                            Reuses Venice key from another bid
                          </p>
                        )}
                        {p.backendKind === 'venice' && (
                          <a
                            href={VENICE_DOCS.models}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:underline"
                          >
                            Venice model ids <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
                  disabled={!hostnameReady}
                  onClick={() => copy('Secrets with MODELS_CONFIG', modelsSecrets)}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy secrets (restart 2)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    copy(
                      'MODELS_CONFIG value',
                      formatModelsConfigContent(modelsForConfig, 'secretvm-value')
                    )
                  }
                >
                  MODELS_CONFIG value only
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={saveToDisk}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save session file
                </Button>
              </div>
              <pre className="text-[10px] overflow-x-auto max-h-40 bg-black/50 border border-zinc-700 rounded p-3 whitespace-pre-wrap break-all">
                {modelsSecrets}
              </pre>
              <p className="text-[11px] text-muted-foreground">
                Recommended: keep this session file updated (Save above) → paste secrets into SecretVM
                when MODELS_CONFIG changes → then place each bid in Models &amp; Bids (~
                {totalBidFeesMor.toFixed(1)} MOR). Prefer Ids from{' '}
                <a
                  href={EXTERNAL_LINKS.activeStatus}
                  className="text-blue-400 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  active.mor.org
                </a>
                .
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {pickerModel && (
        <VeniceModelPicker
          open={!!venicePickerFor}
          onOpenChange={(open) => {
            if (!open) setVenicePickerFor(null);
          }}
          morpheusName={pickerModel.model.Name}
          onSelect={({ backendModelName, apiUrl }) => {
            updatePlanned(pickerModel.model.Id, {
              backendKind: 'venice',
              backendModelName,
              apiUrl,
              concurrentSlots: apiUrl.includes('embed') ? 8 : apiUrl.includes('speech') ? 2 : 4,
            });
            success('Venice model', backendModelName);
          }}
        />
      )}
    </div>
  );
}
