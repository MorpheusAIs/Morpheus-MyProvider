'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import {
  ACTIVE_MOR_ORG,
  fetchActiveBids,
  fetchActiveModels,
  findModelsByName,
  getCompetingBids,
  lowestPricePerSecond,
  weiPerSecToMorPerHour,
  type ActiveBid,
  type ActiveModel,
} from '@/lib/activeMorOrg';

interface ActiveModelSearchProps {
  onSelect: (model: ActiveModel) => void;
  initialQuery?: string;
  /** Prefer models that include this tag (e.g. tee) */
  preferTag?: string;
  compact?: boolean;
}

export default function ActiveModelSearch({
  onSelect,
  initialQuery = '',
  preferTag,
  compact = false,
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

  const handleSelect = (model: ActiveModel) => {
    setSelected(model);
    setCompetitors(getCompetingBids(model.Name, bids).slice(0, 8));
    onSelect(model);
  };

  return (
    <div className={`space-y-3 ${compact ? '' : 'rounded-lg border border-zinc-700/60 bg-zinc-900/50 p-4'}`}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Look up existing models (active.mor.org)</Label>
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
        Prefer bidding on an existing model Id. Mint a new model only when nothing suitable exists.
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
          {error}. If you are on <code className="bg-muted px-1 rounded">127.0.0.1</code>, reload via{' '}
          <code className="bg-muted px-1 rounded">http://localhost:3000</code> or use the Vite{' '}
          <code className="bg-muted px-1 rounded">/active-mor</code> proxy (restart{' '}
          <code className="bg-muted px-1 rounded">npm run dev</code>). You can still browse{' '}
          <a href={ACTIVE_MOR_ORG.status} className="underline" target="_blank" rel="noreferrer">
            active.mor.org/status
          </a>
          .
        </p>
      )}
      {!loading && query.trim() && results.length === 0 && (
        <p className="text-xs text-amber-400">
          No matches in active models. Check spelling, try{' '}
          <a href={ACTIVE_MOR_ORG.status} className="underline" target="_blank" rel="noreferrer">
            active.mor.org/status
          </a>
          , or mint only if this is a genuinely new offering.
        </p>
      )}
      {results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto space-y-1 border border-zinc-700/50 rounded-md divide-y divide-zinc-800">
          {results.map((m) => {
            const low = lowestPricePerSecond(m);
            const isSel = selected?.Id === m.Id;
            return (
              <li key={m.Id}>
                <button
                  type="button"
                  onClick={() => handleSelect(m)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800/80 ${
                    isSel ? 'bg-primary/20' : ''
                  }`}
                >
                  <div className="font-medium text-foreground">{m.Name}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{m.Id}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {(m.Tags || []).slice(0, 4).join(', ') || 'no tags'}
                    {low
                      ? ` · from ${weiPerSecToMorPerHour(low).toFixed(4)} MOR/hr`
                      : ''}
                    {m.health?.healthyBids != null
                      ? ` · ${m.health.healthyBids} healthy bid(s)`
                      : ''}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && (
        <div className="space-y-2 rounded-md bg-green-500/10 border border-green-500/30 p-3">
          <p className="text-sm text-green-400 font-medium">Selected: {selected.Name}</p>
          <p className="text-xs font-mono break-all text-muted-foreground">{selected.Id}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              navigator.clipboard.writeText(selected.Id);
            }}
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
                    <span>
                      {weiPerSecToMorPerHour(b.PricePerSecond).toFixed(4)} MOR/hr
                    </span>
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
