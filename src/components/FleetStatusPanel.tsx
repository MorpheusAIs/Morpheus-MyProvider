'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { ApiService } from '@/lib/apiService';
import type { Bid, HealthCheckResponse, LocalModel, ModelHealthReport } from '@/lib/types';
import {
  fetchActiveBids,
  fetchActiveModels,
  marketStatsForModelId,
  type ActiveBid,
  type ActiveModel,
  type ModelMarketStats,
} from '@/lib/activeMorOrg';
import {
  formatMorPerHourInput,
  morPerHourToWeiPerSec,
  weiPerSecToMorPerHour,
} from '@/lib/bidPricing';
import { bidPriceRangeError, useBidPriceBounds } from '@/lib/bidPriceBounds';
import type { ModelsConfigModel } from '@/lib/modelsConfigFormat';
import {
  buildOperatorSecretsEnv,
  loadProviderSecretsSession,
  modelsFromLocalWithSessionKeys,
  saveProviderSecretsSession,
  type ProviderSecretsSession,
} from '@/lib/providerSession';
import { buildSecretsFile, downloadSecretsFile } from '@/lib/secretsFile';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
} from 'lucide-react';

export type FleetGapKind =
  | 'healthy'
  | 'unhealthy'
  | 'bid_vm_pending'
  | 'config_no_bid'
  | 'skipped'
  | 'unknown';

export interface FleetRow {
  modelId: string;
  displayName: string;
  gap: FleetGapKind;
  reason: string;
  onVm: boolean;
  hasBid: boolean;
  bidId?: string;
  pricePerSecond?: string;
  health?: ModelHealthReport;
  local?: LocalModel;
  planned?: NonNullable<ProviderSecretsSession['planned']>[number];
  market: ModelMarketStats;
}

function classifyGap(args: {
  onVm: boolean;
  hasBid: boolean;
  health?: ModelHealthReport;
}): { gap: FleetGapKind; reason: string } {
  const { onVm, hasBid, health } = args;
  const st = health?.status;

  if (st === 'healthy') {
    return {
      gap: 'healthy',
      reason: health?.latencyMs != null ? `Backend OK · ${health.latencyMs}ms` : 'Backend OK',
    };
  }
  if (st === 'unhealthy') {
    const why =
      [health?.errorKind, health?.httpStatus ? `HTTP ${health.httpStatus}` : '']
        .filter(Boolean)
        .join(' · ') || 'Probe failed';
    return { gap: 'unhealthy', reason: why };
  }
  if (st === 'no_model_configured' || (hasBid && !onVm)) {
    return {
      gap: 'bid_vm_pending',
      reason: 'Bid on-chain · not in this VM MODELS_CONFIG yet',
    };
  }
  if (st === 'no_bid' || (onVm && !hasBid)) {
    return {
      gap: 'config_no_bid',
      reason: 'On VM · no active bid — place or restore a bid',
    };
  }
  if (st === 'skipped') {
    return { gap: 'skipped', reason: 'Health probe skipped on this node' };
  }
  if (onVm && hasBid) {
    return { gap: 'unknown', reason: 'Awaiting health probe' };
  }
  return { gap: 'unknown', reason: 'Unknown state' };
}

function rowStyle(gap: FleetGapKind): string {
  switch (gap) {
    case 'healthy':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100';
    case 'unhealthy':
      return 'border-red-500/45 bg-red-500/10 text-red-100';
    case 'bid_vm_pending':
      return 'border-orange-500/50 bg-orange-500/15 text-orange-50';
    case 'config_no_bid':
      return 'border-amber-500/45 bg-amber-500/10 text-amber-50';
    case 'skipped':
      return 'border-zinc-600 bg-zinc-800/50 text-zinc-300';
    default:
      return 'border-zinc-600 bg-zinc-900/50 text-zinc-200';
  }
}

function gapLabel(gap: FleetGapKind): string {
  switch (gap) {
    case 'healthy':
      return 'healthy';
    case 'unhealthy':
      return 'unhealthy';
    case 'bid_vm_pending':
      return 'bid · VM pending';
    case 'config_no_bid':
      return 'config · no bid';
    case 'skipped':
      return 'skipped';
    default:
      return 'unknown';
  }
}

function formatMorHr(n: number): string {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  return n.toFixed(4);
}

function formatChecked(ts?: number): string {
  if (!ts) return '—';
  try {
    return new Date(ts * (ts < 1e12 ? 1000 : 1)).toLocaleString();
  } catch {
    return String(ts);
  }
}

function plannedToModels(session: ProviderSecretsSession | null): ModelsConfigModel[] {
  return (session?.planned || []).map((p) => {
    const entry: ModelsConfigModel = {
      modelId: p.modelId,
      modelName: p.backendModelName || p.modelName,
      apiType: p.apiType || 'openai',
      apiUrl: p.apiUrl,
      concurrentSlots: p.concurrentSlots || 1,
      capacityPolicy: p.capacityPolicy || 'simple',
    };
    if (p.apiKey) entry.apiKey = p.apiKey;
    return entry;
  });
}

interface FleetStatusPanelProps {
  refreshTrigger?: number;
  onRefresh?: () => void;
  /** Create/update on-chain bid (wei/sec). Returns true on success. */
  onUpdateBid?: (modelId: string, weiPerSec: string) => Promise<boolean>;
  onDeleteBid?: (bidId: string, modelName: string) => void;
}

/**
 * Unified operator view: bids ↔ VM MODELS_CONFIG ↔ /healthcheck, with per-row edit.
 */
export default function FleetStatusPanel({
  refreshTrigger,
  onRefresh,
  onUpdateBid,
  onDeleteBid,
}: FleetStatusPanelProps) {
  const { apiService, isConfigured, walletBalance } = useApi();
  const { success, warning, error: showError } = useNotification();
  const bidBounds = useBidPriceBounds();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [activeModels, setActiveModels] = useState<ActiveModel[]>([]);
  const [activeBids, setActiveBids] = useState<ActiveBid[]>([]);
  const [sessionTick, setSessionTick] = useState(0);

  const [editRow, setEditRow] = useState<FleetRow | null>(null);
  const [backendName, setBackendName] = useState('');
  const [apiType, setApiType] = useState('openai');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [slots, setSlots] = useState('6');
  const [capacityPolicy, setCapacityPolicy] = useState('simple');
  const [morPerHour, setMorPerHour] = useState('0.1');
  const [saving, setSaving] = useState(false);
  const [bidding, setBidding] = useState(false);

  const load = useCallback(async () => {
    if (!apiService || !walletBalance?.address) return;
    setLoading(true);
    try {
      const [h, local, bids, models, ab] = await Promise.all([
        apiService.getHealthCheck().catch(() => null),
        apiService.getLocalModels().catch(() => [] as LocalModel[]),
        apiService.getBids().catch(() => [] as Bid[]),
        fetchActiveModels().catch(() => [] as ActiveModel[]),
        fetchActiveBids().catch(() => [] as ActiveBid[]),
      ]);
      const addr = walletBalance.address.toLowerCase();
      const mine = (bids || []).filter(
        (b) =>
          b.Provider?.toLowerCase() === addr &&
          (b.DeletedAt === '0' || b.DeletedAt === null || b.DeletedAt === '')
      );
      setHealth(h);
      setLocalModels(local || []);
      setMyBids(mine);
      setActiveModels(models);
      setActiveBids(ab);
    } catch (err) {
      showError('Fleet status failed', ApiService.parseError(err));
    } finally {
      setLoading(false);
    }
  }, [apiService, walletBalance?.address, showError]);

  useEffect(() => {
    if (isConfigured && apiService && walletBalance?.address) void load();
  }, [isConfigured, apiService, walletBalance?.address, load]);

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) void load();
  }, [refreshTrigger, load]);

  const rows: FleetRow[] = useMemo(() => {
    const session = loadProviderSecretsSession();
    const planned = session?.planned || [];
    const byId = new Map<string, Partial<FleetRow> & { modelId: string }>();

    const ensure = (id: string) => {
      const key = id.toLowerCase();
      let row = byId.get(key);
      if (!row) {
        row = { modelId: id };
        byId.set(key, row);
      }
      return row;
    };

    for (const m of localModels) {
      const r = ensure(m.Id);
      r.local = m;
      r.displayName = m.Model || m.Name || r.displayName;
    }
    for (const b of myBids) {
      const r = ensure(b.ModelAgentId);
      r.hasBid = true;
      r.bidId = b.Id;
      r.pricePerSecond = b.PricePerSecond;
    }
    for (const h of health?.models || []) {
      const r = ensure(h.modelId);
      r.health = h;
      if (h.modelName) r.displayName = h.modelName;
      if (h.hasActiveBid) r.hasBid = true;
      if (h.bidId) r.bidId = h.bidId;
    }
    for (const p of planned) {
      const r = ensure(p.modelId);
      r.planned = p;
      if (!r.displayName) r.displayName = p.modelName || p.backendModelName;
    }

    return [...byId.values()]
      .map((raw) => {
        const onVm = Boolean(raw.local);
        const hasBid = Boolean(raw.hasBid);
        const { gap, reason } = classifyGap({ onVm, hasBid, health: raw.health });
        const market = marketStatsForModelId(raw.modelId, activeModels, activeBids);
        return {
          modelId: raw.modelId,
          displayName: raw.displayName || raw.modelId.slice(0, 10) + '…',
          gap,
          reason,
          onVm,
          hasBid,
          bidId: raw.bidId,
          pricePerSecond: raw.pricePerSecond,
          health: raw.health,
          local: raw.local,
          planned: raw.planned,
          market,
        } satisfies FleetRow;
      })
      .sort((a, b) => {
        const rank = (g: FleetGapKind) =>
          ({ unhealthy: 0, bid_vm_pending: 1, config_no_bid: 2, unknown: 3, skipped: 4, healthy: 5 }[
            g
          ] ?? 9);
        const d = rank(a.gap) - rank(b.gap);
        if (d !== 0) return d;
        return a.displayName.localeCompare(b.displayName);
      });
    // sessionTick forces re-merge after save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localModels, myBids, health, activeModels, activeBids, sessionTick]);

  const counts = useMemo(() => {
    return {
      healthy: rows.filter((r) => r.gap === 'healthy').length,
      unhealthy: rows.filter((r) => r.gap === 'unhealthy').length,
      vmPending: rows.filter((r) => r.gap === 'bid_vm_pending').length,
      noBid: rows.filter((r) => r.gap === 'config_no_bid').length,
    };
  }, [rows]);

  const queueRefresh = async () => {
    if (!apiService) return;
    setRefreshing(true);
    try {
      await apiService.refreshModelHealth();
      success('Sweep queued', 'Re-loading health in a few seconds…');
      await new Promise((r) => setTimeout(r, 3000));
      await load();
      onRefresh?.();
    } catch (err) {
      showError('Refresh failed', ApiService.parseError(err));
    } finally {
      setRefreshing(false);
    }
  };

  const openEdit = (row: FleetRow) => {
    setEditRow(row);
    const planned = row.planned;
    const local = row.local;
    setBackendName(planned?.backendModelName || local?.Model || local?.Name || row.displayName);
    setApiType(local?.ApiType || 'openai');
    setApiUrl(planned?.apiUrl || local?.ApiUrl || 'http://your-model:8080/v1/chat/completions');
    setApiKey(planned?.apiKey || '');
    setSlots(String(planned?.concurrentSlots || local?.Slots || 6));
    setCapacityPolicy(local?.CapacityPolicy || 'simple');
    if (row.pricePerSecond) {
      setMorPerHour(formatMorPerHourInput(weiPerSecToMorPerHour(row.pricePerSecond)));
    } else if (planned?.priceMorPerHour) {
      setMorPerHour(formatMorPerHourInput(planned.priceMorPerHour));
    } else {
      setMorPerHour('0.1');
    }
  };

  const mergePlannedEntry = () => {
    if (!editRow) return null;
    const session = loadProviderSecretsSession();
    if (!session?.adminPass && !session?.walletPrivateKey) {
      warning('No session secrets', 'Load/Save a secrets JSON once first');
      return null;
    }
    if (!apiUrl.trim()) {
      warning('Need apiUrl', 'Backend URL is required');
      return null;
    }
    const entry = {
      modelId: editRow.modelId,
      modelName: editRow.displayName,
      priceMorPerHour: Number(morPerHour) || 0,
      backendKind: (/venice\.ai/i.test(apiUrl) ? 'venice' : 'own') as 'own' | 'venice',
      backendModelName: backendName.trim() || editRow.displayName,
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      concurrentSlots: Number(slots) > 0 ? Number(slots) : 6,
      apiType,
      capacityPolicy,
    };
    const planned = [
      ...(session.planned || []).filter(
        (p) => p.modelId.toLowerCase() !== editRow.modelId.toLowerCase()
      ),
      entry,
    ];
    const next = { ...session, planned };
    saveProviderSecretsSession(next);
    return next;
  };

  const saveJsonAndMaybeCopy = async (andCopy: boolean) => {
    setSaving(true);
    try {
      const next = mergePlannedEntry();
      if (!next) return;
      downloadSecretsFile(
        buildSecretsFile({
          deployPath: next.deployPath || 'secretvm',
          walletPrivateKey: next.walletPrivateKey,
          ethNodeAddress: next.ethNodeAddress,
          webPublicUrl: next.webPublicUrl,
          adminUser: next.adminUser,
          adminPass: next.adminPass,
          planned: next.planned,
        })
      );
      setSessionTick((t) => t + 1);
      if (andCopy) {
        const models = plannedToModels(next);
        const block = buildOperatorSecretsEnv(models, next);
        await navigator.clipboard.writeText(block);
        success('Saved + copied secrets', 'Paste into SecretVM → restart → Refresh');
      } else {
        success('Saved JSON backup', 'Local secrets file downloaded');
      }
      await load();
      onRefresh?.();
    } catch (e) {
      showError('Save failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const copySecretsOnly = async () => {
    try {
      const session = loadProviderSecretsSession();
      if (!session) {
        warning('No session', 'Load secrets JSON first');
        return;
      }
      let models = plannedToModels(session);
      if (!models.length && apiService) {
        const local = await apiService.getLocalModels();
        models = modelsFromLocalWithSessionKeys(local || [], session);
      }
      const block = buildOperatorSecretsEnv(models, session);
      await navigator.clipboard.writeText(block);
      success('Copied secrets', 'All 5 lines — paste into SecretVM');
    } catch (e) {
      showError('Copy failed', e instanceof Error ? e.message : 'Clipboard error');
    }
  };

  const submitBid = async () => {
    if (!editRow || !onUpdateBid) return;
    const n = Number(morPerHour);
    if (!Number.isFinite(n) || n <= 0) {
      warning('Invalid price', 'Enter a positive MOR/hour');
      return;
    }
    const wei = morPerHourToWeiPerSec(n);
    const rangeError = bidPriceRangeError(wei, bidBounds);
    if (rangeError) {
      warning('Price out of range', rangeError);
      return;
    }
    setBidding(true);
    try {
      const ok = await onUpdateBid(editRow.modelId, wei);
      if (ok) {
        mergePlannedEntry();
        setSessionTick((t) => t + 1);
        await load();
        onRefresh?.();
      }
    } finally {
      setBidding(false);
    }
  };

  if (!isConfigured) return null;

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950/60 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Fleet status</p>
          <p className="text-[11px] text-muted-foreground">
            Bids · MODELS_CONFIG ·{' '}
            <code className="text-[10px]">/healthcheck</code>
            {health?.version ? ` · v${health.version}` : ''}
            {health?.uptime ? ` · up ${health.uptime}` : ''}
            {' · '}
            market from active.mor.org
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
            )}
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={refreshing}
            onClick={() => void queueRefresh()}
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
            Re-probe
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void copySecretsOnly()}>
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copy secrets
          </Button>
        </div>
      </div>

      {counts.vmPending > 0 && (
        <div className="rounded-md border border-orange-500/50 bg-orange-500/10 px-3 py-2 text-xs text-orange-50">
          <p className="font-semibold text-orange-100 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Bid on-chain · VM not updated ({counts.vmPending})
          </p>
          <p className="text-orange-100/80 mt-1">
            Edit the orange row(s) → Save JSON + Copy secrets → paste into SecretVM → restart.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-[11px]">
        {health && (
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 ${
              health.status === 'healthy' || health.status === 'ok'
                ? 'border-emerald-500/40 text-emerald-300'
                : 'border-amber-500/40 text-amber-200'
            }`}
          >
            node: {health.status}
          </span>
        )}
        <span className="text-emerald-300/90">{counts.healthy} healthy</span>
        {counts.vmPending > 0 && (
          <span className="text-orange-300/90">{counts.vmPending} VM pending</span>
        )}
        <span className="text-amber-200/90">{counts.noBid} no bid</span>
        <span className="text-red-300/90">{counts.unhealthy} unhealthy</span>
      </div>

      {rows.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          No bids or MODELS_CONFIG entries yet.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.modelId}>
              <button
                type="button"
                onClick={() => openEdit(row)}
                className={`w-full text-left rounded-md border px-3 py-2 text-xs transition hover:brightness-110 ${rowStyle(row.gap)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium flex flex-wrap items-center gap-2">
                      {row.gap === 'healthy' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                      {row.displayName}{' '}
                      <code className="text-[10px] opacity-80 font-normal">
                        {row.modelId.slice(0, 10)}…
                      </code>
                    </div>
                    <p className="opacity-90">{row.reason}</p>
                    <p className="text-[10px] opacity-70">
                      {row.onVm ? 'on VM' : 'not on VM'}
                      {' · '}
                      {row.hasBid ? 'has bid' : 'no bid'}
                      {row.health?.lastChecked
                        ? ` · checked ${formatChecked(row.health.lastChecked)}`
                        : ''}
                      {row.pricePerSecond
                        ? ` · ${formatMorHr(weiPerSecToMorPerHour(row.pricePerSecond))} MOR/hr`
                        : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-1 min-w-[7.5rem]">
                    <span className="uppercase tracking-wide text-[10px] font-semibold block">
                      {gapLabel(row.gap)}
                    </span>
                    {row.market.bidCount > 0 ? (
                      <div className="text-[10px] opacity-90 leading-snug">
                        <div>
                          {row.market.providers || row.market.bidCount} provider
                          {(row.market.providers || row.market.bidCount) === 1 ? '' : 's'}
                        </div>
                        <div>
                          {formatMorHr(row.market.lowMorHr!)}
                          {row.market.highMorHr != null &&
                          row.market.lowMorHr !== row.market.highMorHr
                            ? `–${formatMorHr(row.market.highMorHr)}`
                            : ''}{' '}
                          MOR/hr
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] opacity-60">No market bids</div>
                    )}
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium opacity-90">
                      <Pencil className="h-3 w-3" /> Edit
                    </span>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editRow)} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit · {editRow?.displayName}</DialogTitle>
            <DialogDescription>
              Update backend MODELS_CONFIG and/or on-chain bid. Save downloads a JSON backup; Copy
              secrets for SecretVM paste.
            </DialogDescription>
          </DialogHeader>

          {editRow && (
            <div className="space-y-4 mt-1">
              <div
                className={`rounded-md border px-3 py-2 text-xs ${rowStyle(editRow.gap)}`}
              >
                <span className="font-semibold uppercase text-[10px]">{gapLabel(editRow.gap)}</span>
                <p className="mt-0.5 opacity-90">{editRow.reason}</p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="opacity-70 shrink-0">Model ID</span>
                    <code className="text-[10px] break-all flex-1">{editRow.modelId}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => {
                        void navigator.clipboard.writeText(editRow.modelId);
                        success('Copied', 'Model ID');
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  {editRow.bidId && (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="opacity-70 shrink-0">Bid ID</span>
                      <code className="text-[10px] break-all flex-1">{editRow.bidId}</code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => {
                          void navigator.clipboard.writeText(editRow.bidId!);
                          success('Copied', 'Bid ID');
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {editRow.market.bidCount > 0 && (
                    <p className="opacity-80">
                      Market:{' '}
                      {formatMorHr(editRow.market.lowMorHr!)}
                      {editRow.market.highMorHr != null &&
                      editRow.market.lowMorHr !== editRow.market.highMorHr
                        ? `–${formatMorHr(editRow.market.highMorHr)}`
                        : ''}{' '}
                      MOR/hr · {editRow.market.providers || editRow.market.bidCount} provider
                      {(editRow.market.providers || editRow.market.bidCount) === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold text-foreground">Backend (MODELS_CONFIG)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">Backend model name</Label>
                    <Input
                      value={backendName}
                      onChange={(e) => setBackendName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">API type</Label>
                    <Select value={apiType} onValueChange={setApiType}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI Compatible</SelectItem>
                        <SelectItem value="claudeai">Claude AI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Slots</Label>
                    <Input
                      value={slots}
                      onChange={(e) => setSlots(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">API URL</Label>
                    <Input
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs">API key (kept in local JSON only)</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="optional"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Capacity policy</Label>
                    <Select value={capacityPolicy} onValueChange={setCapacityPolicy}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">simple</SelectItem>
                        <SelectItem value="idle_timeout">idle_timeout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-700 pt-3">
                <p className="text-xs font-semibold text-foreground">On-chain bid</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1.5 flex-1 min-w-[8rem]">
                    <Label className="text-xs">MOR / hour</Label>
                    <Input
                      value={morPerHour}
                      onChange={(e) => setMorPerHour(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={bidding || !onUpdateBid}
                    onClick={() => void submitBid()}
                  >
                    {bidding ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                    {editRow.hasBid ? 'Update bid' : 'Place bid'}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Contract minimum {bidBounds.minWei} wei/sec
                  {bidBounds.maxWei ? ` · maximum ${bidBounds.maxWei}` : ''}.
                </p>
                {editRow.hasBid && editRow.bidId && onDeleteBid && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-red-300 hover:text-red-200"
                    onClick={() => {
                      onDeleteBid(editRow.bidId!, editRow.displayName);
                      setEditRow(null);
                    }}
                  >
                    Delete bid…
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
                  disabled={saving}
                  onClick={() => void saveJsonAndMaybeCopy(true)}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 mr-1" />
                  )}
                  Save JSON + Copy secrets
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={saving}
                  onClick={() => void saveJsonAndMaybeCopy(false)}
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  Save JSON backup only
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
