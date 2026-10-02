'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Loader2, Copy, ExternalLink } from 'lucide-react';
import type { Model } from '@/lib/types';
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
  suggestBidMorPerHour,
  weiPerSecToMorPerHour,
} from '@/lib/bidPricing';
import { CONTRACT_MINIMUMS, EXTERNAL_LINKS } from '@/lib/constants';
import { bidPriceRangeError, useBidPriceBounds } from '@/lib/bidPriceBounds';
import { formatMor } from '@/lib/utils';
import {
  buildOperatorSecretsEnv,
  loadProviderSecretsSession,
  saveProviderSecretsSession,
} from '@/lib/providerSession';
import { buildSecretsFile, downloadSecretsFile } from '@/lib/secretsFile';
import { useNotification } from '@/lib/NotificationContext';
import type { ModelsConfigModel } from '@/lib/modelsConfigFormat';

type Step = 'price' | 'backend' | 'done';

interface BidWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: Model | null;
  editMode: boolean;
  existingWeiPerSec?: string | null;
  isSubmitting: boolean;
  onSubmitBid: (weiPerSec: string) => Promise<boolean>;
  onFinished?: () => void;
}

function formatMorHr(n: number): string {
  if (n >= 1) return n.toFixed(3);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

/**
 * Bid dialog: market context (active.mor.org) → MOR/hour → post-bid MODELS_CONFIG → Copy secrets.
 */
export default function BidWorkflowDialog({
  open,
  onOpenChange,
  model,
  editMode,
  existingWeiPerSec,
  isSubmitting,
  onSubmitBid,
  onFinished,
}: BidWorkflowDialogProps) {
  const { success, warning, error: showError } = useNotification();
  const bidBounds = useBidPriceBounds();
  const minMorHr = weiPerSecToMorPerHour(bidBounds.minWei);
  const bidFeeMor = formatMor(CONTRACT_MINIMUMS.MARKETPLACE_BID_FEE_WEI);

  const [step, setStep] = useState<Step>('price');
  const [morPerHour, setMorPerHour] = useState('0.1');
  const [loadingMarket, setLoadingMarket] = useState(false);
  const [activeModel, setActiveModel] = useState<ActiveModel | null>(null);
  const [market, setMarket] = useState<ModelMarketStats | null>(null);
  const [competitors, setCompetitors] = useState<
    Array<{ provider: string; morHr: number; status?: string; latencyMs?: number | null }>
  >([]);

  const [backendModelName, setBackendModelName] = useState('');
  const [apiUrl, setApiUrl] = useState('http://your-model:8080/v1/chat/completions');
  const [apiKey, setApiKey] = useState('');
  const [slots, setSlots] = useState('6');

  const weiPerSec = useMemo(() => {
    const n = Number(morPerHour);
    if (!Number.isFinite(n) || n <= 0) return '0';
    return morPerHourToWeiPerSec(n);
  }, [morPerHour]);

  useEffect(() => {
    if (!open || !model) return;
    setStep('price');
    setBackendModelName('');
    setApiUrl('http://your-model:8080/v1/chat/completions');
    setApiKey('');
    setSlots('6');

    // Seed price from existing bid or market later
    if (editMode && existingWeiPerSec) {
      setMorPerHour(formatMorPerHourInput(weiPerSecToMorPerHour(existingWeiPerSec)));
    }

    let cancelled = false;
    (async () => {
      setLoadingMarket(true);
      try {
        const [models, bids] = await Promise.all([fetchActiveModels(), fetchActiveBids()]);
        if (cancelled) return;
        const am =
          models.find((m) => m.Id.toLowerCase() === model.Id.toLowerCase()) ||
          models.find((m) => m.Name.toLowerCase() === model.Name.toLowerCase()) ||
          null;
        setActiveModel(am);

        const stats = marketStatsForModelId(model.Id, models, bids);
        setMarket(stats);

        const rows: Array<{
          provider: string;
          morHr: number;
          status?: string;
          latencyMs?: number | null;
        }> = [];

        if (am?.bidDetail?.length) {
          for (const b of am.bidDetail) {
            rows.push({
              provider: b.providerId,
              morHr: b.priceMorPerHour ?? weiPerSecToMorPerHour(b.pricePerSecond),
              status: b.status,
            });
          }
        } else {
          const comps = bids
            .filter(
              (b) =>
                b.ModelAgentId?.toLowerCase() === model.Id.toLowerCase() ||
                b.ModelName?.toLowerCase() === model.Name.toLowerCase()
            )
            .sort((a, b) =>
              BigInt(a.PricePerSecond) < BigInt(b.PricePerSecond) ? -1 : 1
            );
          for (const b of comps.slice(0, 12)) {
            rows.push({
              provider: b.Provider,
              morHr: weiPerSecToMorPerHour(b.PricePerSecond),
              status: b.health?.status,
              latencyMs: b.health?.latencyMs,
            });
          }
        }

        rows.sort((a, b) => a.morHr - b.morHr);
        setCompetitors(rows);

        if (!editMode) {
          const floor = weiPerSecToMorPerHour(bidBounds.minWei);
          const suggested = am
            ? suggestBidMorPerHour(am, bids)
            : stats.lowMorHr ?? floor;
          setMorPerHour(formatMorPerHourInput(Math.max(suggested || floor, floor)));
        }

        // Prefill backend name from marketplace / session
        const session = loadProviderSecretsSession();
        const planned = session?.planned?.find(
          (p) => p.modelId.toLowerCase() === model.Id.toLowerCase()
        );
        if (planned) {
          setBackendModelName(planned.backendModelName || planned.modelName);
          setApiUrl(planned.apiUrl || apiUrl);
          setApiKey(planned.apiKey || '');
          setSlots(String(planned.concurrentSlots || 6));
        } else if (am?.Name) {
          // Often backend id differs from marketplace name — leave editable
          setBackendModelName('');
        }
      } catch {
        if (!cancelled) warning('Market data', 'Could not load active.mor.org — set MOR/hr manually');
      } finally {
        if (!cancelled) setLoadingMarket(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, model?.Id, editMode, existingWeiPerSec, bidBounds.minWei]);

  const submitPrice = async () => {
    const n = Number(morPerHour);
    if (!Number.isFinite(n) || n <= 0) {
      warning('Invalid price', 'Enter a positive MOR/hour');
      return;
    }
    const rangeError = bidPriceRangeError(weiPerSec, bidBounds);
    if (rangeError) {
      warning('Price out of range', `${rangeError} (~${formatMorHr(minMorHr)} MOR/hr minimum)`);
      return;
    }
    const ok = await onSubmitBid(weiPerSec);
    if (!ok) return;
    if (editMode) {
      onOpenChange(false);
      onFinished?.();
      return;
    }
    setStep('backend');
  };

  const saveBackendAndSecrets = async (andCopy: boolean) => {
    if (!model) return;
    if (!apiUrl.trim()) {
      warning('Need apiUrl', 'Backend URL is required for MODELS_CONFIG');
      return;
    }
    const session = loadProviderSecretsSession();
    if (!session) {
      warning(
        'No session file',
        'Load/Save secrets JSON first so we can merge this model into Copy secrets'
      );
      return;
    }

    const entry = {
      modelId: model.Id,
      modelName: model.Name,
      priceMorPerHour: Number(morPerHour) || 0,
      backendKind: (/venice\.ai/i.test(apiUrl) ? 'venice' : 'own') as 'own' | 'venice',
      backendModelName: backendModelName.trim() || model.Name,
      apiUrl: apiUrl.trim(),
      apiKey: apiKey.trim(),
      concurrentSlots: Number(slots) > 0 ? Number(slots) : 6,
    };

    const planned = [...(session.planned || []).filter(
      (p) => p.modelId.toLowerCase() !== model.Id.toLowerCase()
    ), entry];
    const next = { ...session, planned };
    saveProviderSecretsSession(next);
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

    if (andCopy) {
      try {
        const models: ModelsConfigModel[] = planned.map((p) => {
          const m: ModelsConfigModel = {
            modelId: p.modelId,
            modelName: p.backendModelName || p.modelName,
            apiType: 'openai',
            apiUrl: p.apiUrl,
            concurrentSlots: p.concurrentSlots,
            capacityPolicy: 'simple',
          };
          if (p.apiKey) m.apiKey = p.apiKey;
          return m;
        });
        const block = buildOperatorSecretsEnv(models, next);
        await navigator.clipboard.writeText(block);
        success('Saved + copied secrets', 'Paste all 5 lines into SecretVM, then restart');
      } catch (e) {
        showError('Copy failed', e instanceof Error ? e.message : 'Clipboard error');
        success('Config saved', 'Downloaded JSON — use Copy secrets from the bar');
      }
    } else {
      success('Backend saved', 'Session JSON updated — Copy secrets when ready');
    }

    setStep('done');
  };

  if (!model) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editMode ? 'Change bid' : step === 'price' ? 'Add bid' : step === 'backend' ? 'Configure backend' : 'Almost live'}
            {' · '}
            {model.Name}
          </DialogTitle>
          <DialogDescription>
            {step === 'price' &&
              (editMode
                ? 'Update on-chain price (MOR/hour). Fee may apply on some networks.'
                : `On-chain bid (~${bidFeeMor} MOR fee). Then add MODELS_CONFIG for the VM.`)}
            {step === 'backend' &&
              'Bid is on-chain. Add backend details so Copy secrets includes this model.'}
            {step === 'done' &&
              'Bid is live on-chain. Until you paste secrets and restart, health shows “bid · VM pending”.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'price' && (
          <div className="space-y-4 mt-2">
            <div className="rounded-md border border-zinc-700 bg-zinc-950/60 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-foreground">Marketplace (active.mor.org)</span>
                <a
                  href={EXTERNAL_LINKS.activeStatus}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  status <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {loadingMarket ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading competitors…
                </p>
              ) : market && market.bidCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {market.providers || market.bidCount} provider
                  {(market.providers || market.bidCount) === 1 ? '' : 's'}
                  {' · '}
                  {formatMorHr(market.lowMorHr!)}
                  {market.highMorHr != null && market.highMorHr !== market.lowMorHr
                    ? `–${formatMorHr(market.highMorHr)}`
                    : ''}{' '}
                  MOR/hr
                  {activeModel?.health?.status ? ` · model ${activeModel.health.status}` : ''}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No competing bids found yet.</p>
              )}
              {competitors.length > 0 && (
                <ul className="max-h-36 overflow-auto space-y-1 text-[11px] font-mono border-t border-zinc-800 pt-2">
                  {competitors.map((c, i) => (
                    <li key={`${c.provider}-${i}`} className="flex justify-between gap-2 text-zinc-300">
                      <span className="truncate opacity-80">
                        {c.provider.slice(0, 8)}…{c.provider.slice(-4)}
                        {c.status ? ` · ${c.status}` : ''}
                        {c.latencyMs != null ? ` · ${c.latencyMs}ms` : ''}
                      </span>
                      <span className="text-amber-200 shrink-0">{formatMorHr(c.morHr)} MOR/hr</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bid-mor-hr">Your price (MOR / hour)</Label>
              <Input
                id="bid-mor-hr"
                type="number"
                step="0.0001"
                min={0}
                value={morPerHour}
                onChange={(e) => setMorPerHour(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                = {weiPerSec} wei/sec on-chain
                {' · '}
                contract minimum {bidBounds.minWei} wei/sec (~{formatMorHr(minMorHr)} MOR/hr)
                {bidBounds.maxWei ? ` · maximum ${bidBounds.maxWei}` : ''}
              </p>
            </div>

            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
              disabled={isSubmitting}
              onClick={() => void submitPrice()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {editMode ? 'Updating…' : 'Creating bid…'}
                </>
              ) : editMode ? (
                'Update bid'
              ) : (
                `Create bid (~${bidFeeMor} MOR fee)`
              )}
            </Button>
          </div>
        )}

        {step === 'backend' && (
          <div className="space-y-3 mt-2">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100">
              Bid posted for <strong>{model.Name}</strong>. Add backend so the node can serve it.
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Backend modelName</Label>
              <Input
                value={backendModelName}
                onChange={(e) => setBackendModelName(e.target.value)}
                placeholder="e.g. gemma4:31b / gpt-oss:120b"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Backend apiUrl</Label>
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://host/v1/chat/completions"
              />
              <div className="flex flex-wrap gap-1">
                {(['/v1/chat/completions', '/v1/embeddings'] as const).map((path) => (
                  <Button
                    key={path}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      const base = apiUrl
                        .replace(/\/v1\/(chat\/completions|embeddings|audio\/speech)\/?$/i, '')
                        .replace(/\/$/, '');
                      const root =
                        base && /^https?:\/\//i.test(base) ? base : 'https://your-backend';
                      setApiUrl(`${root}${path}`);
                    }}
                  >
                    {path.split('/').pop()}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">API key (optional)</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Concurrent slots</Label>
              <Input
                type="number"
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                min={1}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
                onClick={() => void saveBackendAndSecrets(true)}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Save + Copy all 5 secrets
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void saveBackendAndSecrets(false)}
              >
                Save to session JSON only
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-3 mt-2 text-sm text-muted-foreground">
            <div className="rounded-md border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs text-orange-50">
              Middle state: marketplace sees your bid, but this VM cannot serve it yet.
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-xs">
              <li>Paste the 5-line secrets into SecretVM → restart</li>
              <li>Wait 2–3 min → Refresh node health</li>
              <li>
                Status should leave <code className="text-[10px]">bid · VM pending</code> and
                become healthy
              </li>
            </ol>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                onFinished?.();
              }}
            >
              Done — back to fleet
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
