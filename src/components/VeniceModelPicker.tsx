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
import { Loader2 } from 'lucide-react';
import {
  fetchVeniceModels,
  rankVeniceModels,
  suggestVeniceApiUrl,
  type VeniceModel,
} from '@/lib/veniceModels';
import { VENICE_DOCS } from '@/lib/venicePresets';

interface VeniceModelPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  morpheusName: string;
  onSelect: (choice: { backendModelName: string; apiUrl: string }) => void;
}

export default function VeniceModelPicker({
  open,
  onOpenChange,
  morpheusName,
  onSelect,
}: VeniceModelPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [models, setModels] = useState<VeniceModel[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchVeniceModels()
      .then((list) => {
        if (!cancelled) setModels(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load Venice models');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const ranked = useMemo(() => {
    const base = rankVeniceModels(morpheusName, models, 40);
    const q = filter.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.type.toLowerCase().includes(q)
    );
  }, [models, morpheusName, filter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Pick a Venice model id</DialogTitle>
          <DialogDescription>
            Morpheus marketplace name is <strong>{morpheusName}</strong>. Choose the Venice id your
            proxy-router will send as OpenAI <code className="text-xs">model</code> — they often
            differ.{' '}
            <a
              href={VENICE_DOCS.models}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline"
            >
              Venice docs
            </a>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs">Filter</Label>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search Venice ids…"
          />
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2 py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Venice catalog…
          </p>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {!loading && !error && (
          <ul className="overflow-y-auto max-h-[50vh] space-y-1 pr-1">
            {ranked.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="w-full text-left rounded-md border border-zinc-700 hover:border-primary/60 hover:bg-primary/5 px-3 py-2"
                  onClick={() => {
                    onSelect({
                      backendModelName: m.id,
                      apiUrl: suggestVeniceApiUrl(morpheusName, m.id),
                    });
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-foreground">{m.id}</span>
                    {i < 3 && !filter && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-400">
                        close match
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {m.name} · {m.type}
                  </div>
                </button>
              </li>
            ))}
            {!ranked.length && (
              <li className="text-sm text-muted-foreground py-4 text-center">No matches</li>
            )}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
