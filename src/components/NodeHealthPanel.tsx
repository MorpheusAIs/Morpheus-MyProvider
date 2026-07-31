'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { ApiService } from '@/lib/apiService';
import type { HealthCheckResponse, ModelHealthReport } from '@/lib/types';
import {
  fetchActiveBids,
  fetchActiveModels,
  marketStatsForModelId,
  type ActiveBid,
  type ActiveModel,
  type ModelMarketStats,
} from '@/lib/activeMorOrg';
import {
  buildOperatorSecretsEnv,
  loadProviderSecretsSession,
  modelsFromLocalWithSessionKeys,
} from '@/lib/providerSession';
import type { ModelsConfigModel } from '@/lib/modelsConfigFormat';
import { AlertCircle, CheckCircle2, Copy, Loader2, RefreshCw } from 'lucide-react';

function statusStyle(status: string): string {
  switch (status) {
    case 'healthy':
      return 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10';
    case 'unhealthy':
      return 'text-red-300 border-red-500/40 bg-red-500/10';
    case 'no_bid':
      return 'text-amber-200 border-amber-500/40 bg-amber-500/10';
    case 'no_model_configured':
      return 'text-orange-200 border-orange-500/50 bg-orange-500/15';
    case 'skipped':
      return 'text-zinc-400 border-zinc-600 bg-zinc-800/50';
    default:
      return 'text-zinc-300 border-zinc-600 bg-zinc-800/40';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'healthy':
      return 'healthy';
    case 'unhealthy':
      return 'unhealthy';
    case 'no_bid':
      return 'config · no bid';
    case 'no_model_configured':
      return 'bid · VM pending';
    case 'skipped':
      return 'skipped';
    default:
      return status;
  }
}

function statusHint(m: ModelHealthReport): string {
  switch (m.status) {
    case 'healthy':
      return m.latencyMs != null ? `Backend OK · ${m.latencyMs}ms` : 'Backend OK';
    case 'unhealthy':
      return [m.errorKind, m.httpStatus ? `HTTP ${m.httpStatus}` : '']
        .filter(Boolean)
        .join(' · ') || 'Probe failed';
    case 'no_bid':
      return 'Node has this model in MODELS_CONFIG, but you have no active on-chain bid yet';
    case 'no_model_configured':
      return 'Bid is on-chain, but this VM has not loaded the model yet — Copy secrets → paste into SecretVM → restart';
    case 'skipped':
      return 'Health probe skipped on this node';
    default:
      return m.status;
  }
}

function formatChecked(ts: number): string {
  if (!ts) return 'never';
  try {
    return new Date(ts * (ts < 1e12 ? 1000 : 1)).toLocaleString();
  } catch {
    return String(ts);
  }
}

function formatMorHr(n: number): string {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  return n.toFixed(4);
}

/**
 * Operator view of GET /healthcheck + active.mor.org competitor context.
 */
export default function NodeHealthPanel({ compact }: { compact?: boolean }) {
  const { apiService, isConfigured } = useApi();
  const { success, warning, error: showError } = useNotification();
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [activeModels, setActiveModels] = useState<ActiveModel[]>([]);
  const [activeBids, setActiveBids] = useState<ActiveBid[]>([]);

  const load = useCallback(async () => {
    if (!apiService) return;
    setLoading(true);
    try {
      const [data, models, bids] = await Promise.all([
        apiService.getHealthCheck(),
        fetchActiveModels().catch(() => [] as ActiveModel[]),
        fetchActiveBids().catch(() => [] as ActiveBid[]),
      ]);
      setHealth(data);
      setActiveModels(models);
      setActiveBids(bids);
    } catch (err) {
      showError('Healthcheck failed', ApiService.parseError(err));
    } finally {
      setLoading(false);
    }
  }, [apiService, showError]);

  useEffect(() => {
    if (isConfigured && apiService) void load();
  }, [isConfigured, apiService, load]);

  const queueRefresh = async () => {
    if (!apiService) return;
    setRefreshing(true);
    try {
      await apiService.refreshModelHealth();
      success('Sweep queued', 'Polling healthcheck in a few seconds…');
      await new Promise((r) => setTimeout(r, 3000));
      await load();
    } catch (err) {
      showError('Refresh failed', ApiService.parseError(err));
    } finally {
      setRefreshing(false);
    }
  };

  const copySecretsForVm = async () => {
    setCopying(true);
    try {
      const session = loadProviderSecretsSession();
      if (!session?.adminPass && !session?.walletPrivateKey) {
        warning('No session secrets', 'Load/Save your secrets JSON first, then Copy');
        return;
      }
      let models: ModelsConfigModel[] = (session.planned || []).map((p) => {
        const entry: ModelsConfigModel = {
          modelId: p.modelId,
          modelName: p.backendModelName || p.modelName,
          apiType: 'openai',
          apiUrl: p.apiUrl,
          concurrentSlots: p.concurrentSlots || 1,
          capacityPolicy: 'simple',
        };
        if (p.apiKey) entry.apiKey = p.apiKey;
        return entry;
      });
      if (!models.length && apiService) {
        const local = await apiService.getLocalModels();
        models = modelsFromLocalWithSessionKeys(local || [], session);
      }
      const block = buildOperatorSecretsEnv(models, session);
      await navigator.clipboard.writeText(block);
      success('Copied secrets', 'Paste into SecretVM → restart → Refresh health');
    } catch (e) {
      showError('Copy failed', e instanceof Error ? e.message : 'Clipboard error');
    } finally {
      setCopying(false);
    }
  };

  if (!isConfigured) return null;

  const models = health?.models ?? [];
  const noBid = models.filter((m) => m.status === 'no_bid');
  const vmPending = models.filter((m) => m.status === 'no_model_configured');
  const healthy = models.filter((m) => m.status === 'healthy').length;
  const unhealthy = models.filter((m) => m.status === 'unhealthy').length;

  const marketFor = (modelId: string): ModelMarketStats =>
    marketStatsForModelId(modelId, activeModels, activeBids);

  return (
    <div
      className={`rounded-lg border border-zinc-700 bg-zinc-950/60 ${compact ? 'p-3' : 'p-4'} space-y-3`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Node health</p>
          <p className="text-[11px] text-muted-foreground">
            Live from <code className="text-[10px]">GET /healthcheck</code>
            {health?.version ? ` · v${health.version}` : ''}
            {health?.uptime ? ` · up ${health.uptime}` : ''}
            {' · '}
            market from active.mor.org
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load()}
          >
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
            Re-probe models
          </Button>
        </div>
      </div>

      {vmPending.length > 0 && (
        <div className="rounded-md border border-orange-500/50 bg-orange-500/10 px-3 py-2.5 text-xs text-orange-50 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-orange-300" />
            <div className="space-y-1 min-w-0">
              <p className="font-semibold text-orange-100">
                Bid on-chain · VM not updated yet ({vmPending.length})
              </p>
              <p className="text-orange-100/80 leading-relaxed">
                You have active bid(s), but this machine&apos;s MODELS_CONFIG does not include them
                yet. Marketplace can see the bid; inference will fail until you paste secrets and
                restart SecretVM.
              </p>
              <ul className="list-disc pl-4 text-orange-100/90">
                {vmPending.map((m) => (
                  <li key={m.modelId}>
                    {m.modelName || 'Model'}{' '}
                    <code className="text-[10px] opacity-80">{m.modelId.slice(0, 10)}…</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="h-7 bg-orange-400 hover:bg-orange-300 text-black font-semibold"
            disabled={copying}
            onClick={() => void copySecretsForVm()}
          >
            {copying ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            Copy secrets for VM update
          </Button>
        </div>
      )}

      {noBid.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-50 space-y-1">
          <p className="font-semibold text-amber-100 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Config on VM · no bid ({noBid.length})
          </p>
          <p className="text-amber-100/80">
            MODELS_CONFIG is loaded, but you still need an on-chain bid for:{' '}
            {noBid.map((m) => m.modelName || m.modelId.slice(0, 8)).join(', ')}.
          </p>
        </div>
      )}

      {health && (
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              health.status === 'healthy' || health.status === 'ok'
                ? 'border-emerald-500/40 text-emerald-300'
                : 'border-amber-500/40 text-amber-200'
            }`}
          >
            node: {health.status}
          </span>
          {models.length > 0 && (
            <>
              <span className="text-emerald-300/90">{healthy} healthy</span>
              {vmPending.length > 0 && (
                <span className="text-orange-300/90">{vmPending.length} VM pending</span>
              )}
              <span className="text-amber-200/90">{noBid.length} no bid</span>
              <span className="text-red-300/90">{unhealthy} unhealthy</span>
            </>
          )}
        </div>
      )}

      {models.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-400" />
          No model reports yet — empty MODELS_CONFIG and no bids.
        </p>
      )}

      {models.length > 0 && (
        <ul className="space-y-2">
          {models.map((m) => {
            const market = marketFor(m.modelId);
            return (
              <li
                key={`${m.modelId}-${m.bidId || 'nobid'}`}
                className={`rounded-md border px-3 py-2 text-xs ${statusStyle(m.status)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-medium">
                      {m.modelName || 'Model'}{' '}
                      <code className="text-[10px] opacity-80 font-normal">
                        {m.modelId.slice(0, 10)}…
                      </code>
                    </div>
                    <p className="opacity-90">{statusHint(m)}</p>
                    <p className="text-[10px] opacity-70">
                      last checked {formatChecked(m.lastChecked)}
                      {m.hasActiveBid && m.bidId ? ` · bid ${m.bidId.slice(0, 10)}…` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right space-y-0.5 min-w-[7.5rem]">
                    <span className="uppercase tracking-wide text-[10px] font-semibold block">
                      {m.status === 'healthy' && (
                        <CheckCircle2 className="inline h-3 w-3 mr-1" />
                      )}
                      {statusLabel(m.status)}
                    </span>
                    {market.bidCount > 0 ? (
                      <div className="text-[10px] text-zinc-300/90 leading-snug">
                        <div>
                          {market.providers || market.bidCount} provider
                          {(market.providers || market.bidCount) === 1 ? '' : 's'}
                        </div>
                        <div className="text-amber-100/90">
                          {formatMorHr(market.lowMorHr!)}
                          {market.highMorHr != null &&
                          market.lowMorHr !== market.highMorHr
                            ? `–${formatMorHr(market.highMorHr)}`
                            : ''}{' '}
                          MOR/hr
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-zinc-500">No market bids</div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
