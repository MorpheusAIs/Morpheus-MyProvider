'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Plus, Search } from 'lucide-react';
import {
  ACTIVE_MOR_ORG,
  fetchActiveBids,
  fetchActiveModels,
  findModelsByName,
  getCompetingBids,
  weiPerSecToMorPerHour,
  type ActiveBid,
  type ActiveModel,
} from '@/lib/activeMorOrg';
import { formatBidContext } from '@/lib/bidPricing';

interface ActiveModelSearchProps {
  /** Single-select (legacy create dialog) */
  onSelect?: (model: ActiveModel) => void;
  /** Multi-select: add model to the basket */
  onAdd?: (model: ActiveModel, allBids: ActiveBid[]) => void;
  selectedIds?: string[];
  initialQuery?: string;
  preferTag?: string;
  compact?: boolean;
  multi?: boolean;
}

export default function ActiveModelSearch({
  onSelect,
  onAdd,
  selectedIds = [],
  initialQuery = '',
  preferTag,
  compact = false,
  multi = false,
}: ActiveModelSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [models, setModels] = useState<ActiveModel[]>([]);
  const [bids, setBids] = useState<ActiveBid[]>([]);
  const [results, setResults] = useState<ActiveModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ActiveModel | null>(null);
  const [competitors, setCompetitors] = useState<ActiveBid[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [m, b] = await Promise.all([fetchActiveModels(), fetchActiveBids()]);
        if (!cancelled) {
          setModels(m);
          setBids(b);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load active.mor.org');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let list = findModelsByName(query, models);
    if (preferTag) {
      const tagged = list.filter((m) =>
        (m.Tags || []).some((t) => t.toLowerCase() === preferTag.toLowerCase())
      );
      if (tagged.length) list = [...tagged, ...list.filter((m) => !tagged.includes(m))];
    }
    setResults(list);
  }, [query, models, preferTag]);

  const handlePick = (model: ActiveModel) => {
    setSelected(model);
    setCompetitors(getCompetingBids(model.Name, bids).slice(0, 8));
    if (multi && onAdd) {
      onAdd(model, bids);
    } else {
      onSelect?.(model);
    }
  };

  return (
    <div className={`space-y-3 ${compact ? '' : 'rounded-lg border border-zinc-700/60 bg-zinc-900/50 p-4'}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">
          {multi ? 'Add models from active.mor.org' : 'Look up existing models (active.mor.org)'}
        </Label>
        <a
          href={ACTIVE_MOR_ORG.status}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
        >
          Open status <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        {multi
          ? 'Search and add multiple models. Each row shows current marketplace pricing so you can set competitive bids.'
          : 'Prefer bidding on an existing model Id. Mint a new model only when nothing suitable exists.'}
      </p>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search model name (e.g. glm-5, llama-3.3)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading marketplace snapshot…
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400">
          {error}. Prefer <code className="bg-muted px-1 rounded">http://localhost:3000</code> (Vite
          proxies <code className="bg-muted px-1 rounded">/active-mor</code>). Or browse{' '}
          <a href={ACTIVE_MOR_ORG.status} className="underline" target="_blank" rel="noreferrer">
            active.mor.org/status
          </a>
          .
        </p>
      )}
      {!loading && query.trim() && results.length === 0 && (
        <p className="text-xs text-amber-400">
          No matches. Try{' '}
          <a href={ACTIVE_MOR_ORG.status} className="underline" target="_blank" rel="noreferrer">
            active.mor.org/status
          </a>
          .
        </p>
      )}
      {results.length > 0 && (
        <ul className="max-h-56 overflow-y-auto space-y-1 border border-zinc-700/50 rounded-md divide-y divide-zinc-800">
          {results.map((m) => {
            const ctx = formatBidContext(m, bids);
            const already = selectedIds.includes(m.Id);
            const isSel = !multi && selected?.Id === m.Id;
            return (
              <li key={m.Id}>
                <button
                  type="button"
                  disabled={multi && already}
                  onClick={() => handlePick(m)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800/80 disabled:opacity-50 ${
                    isSel || already ? 'bg-primary/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-foreground">{m.Name}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{m.Id}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {(m.Tags || []).slice(0, 4).join(', ') || 'no tags'}
                        {ctx.lowestMorHr != null
                          ? ` · lowest ${ctx.lowestMorHr.toFixed(4)} MOR/hr`
                          : ''}
                        {ctx.medianMorHr != null
                          ? ` · median ~${ctx.medianMorHr.toFixed(4)} MOR/hr`
                          : ''}
                        {ctx.bidCount ? ` · ${ctx.bidCount} bid(s)` : ''}
                      </div>
                    </div>
                    {multi && (
                      <span className="flex-shrink-0 text-xs text-primary inline-flex items-center gap-1">
                        {already ? 'Added' : (
                          <>
                            <Plus className="h-3 w-3" /> Add
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!multi && selected && (
        <div className="space-y-2 rounded-md bg-green-500/10 border border-green-500/30 p-3">
          <p className="text-sm text-green-400 font-medium">Selected: {selected.Name}</p>
          <p className="text-xs font-mono break-all text-muted-foreground">{selected.Id}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => navigator.clipboard.writeText(selected.Id)}
          >
            Copy model Id
          </Button>
          {competitors.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-medium mb-1">Competing bids (lowest first)</p>
              <ul className="text-xs space-y-1 max-h-28 overflow-y-auto">
                {competitors.map((b) => (
                  <li key={b.Id} className="flex justify-between gap-2 font-mono">
                    <span className="truncate text-muted-foreground">{b.Provider.slice(0, 10)}…</span>
                    <span>{weiPerSecToMorPerHour(b.PricePerSecond).toFixed(4)} MOR/hr</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

