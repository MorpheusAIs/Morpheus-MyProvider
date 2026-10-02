'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useNotification } from '@/lib/NotificationContext';
import {
  modelsConfigToPlanned,
  parseModelsConfigPaste,
} from '@/lib/modelsConfigFormat';
import {
  loadProviderSecretsSession,
  saveProviderSecretsSession,
} from '@/lib/providerSession';
import { buildSecretsFile, downloadSecretsFile } from '@/lib/secretsFile';
import { FileInput } from 'lucide-react';

interface ImportModelsConfigButtonProps {
  /** Compact toolbar style (operator bar) */
  variant?: 'bar' | 'default';
  onImported?: (count: number) => void;
}

/**
 * Paste production MODELS_CONFIG_CONTENT into the local session JSON
 * (keeps apiKeys) so MyProvider can edit and re-export all 5 secrets.
 */
export default function ImportModelsConfigButton({
  variant = 'bar',
  onImported,
}: ImportModelsConfigButtonProps) {
  const { success, error: showError, warning } = useNotification();
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [alsoDownload, setAlsoDownload] = useState(true);

  const importPaste = () => {
    try {
      const models = parseModelsConfigPaste(paste);
      const planned = modelsConfigToPlanned(models);
      const session = loadProviderSecretsSession();
      if (!session) {
        warning(
          'No base session yet',
          'Load your secrets JSON first (wallet/RPC/URL/password), then import MODELS_CONFIG'
        );
        return;
      }

      // Merge by modelId — paste wins for backend fields; keep prior priceMorPerHour when set
      const byId = new Map((session.planned || []).map((p) => [p.modelId.toLowerCase(), p]));
      const merged = planned.map((p) => {
        const prev = byId.get(p.modelId.toLowerCase());
        return {
          ...p,
          priceMorPerHour: prev?.priceMorPerHour || p.priceMorPerHour,
          modelName: prev?.modelName && prev.modelName !== p.backendModelName ? prev.modelName : p.modelName,
        };
      });

      const next = { ...session, planned: merged };
      saveProviderSecretsSession(next);

      if (alsoDownload) {
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
      }

      success(
        'MODELS_CONFIG imported',
        `${merged.length} model(s) stored in session${alsoDownload ? ' + downloaded JSON' : ''}`
      );
      setPaste('');
      setOpen(false);
      onImported?.(merged.length);
    } catch (e) {
      showError('Import failed', e instanceof Error ? e.message : 'Invalid paste');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={variant === 'bar' ? 'outline' : 'secondary'}
          className={variant === 'bar' ? 'h-7 text-xs' : undefined}
        >
          <FileInput className="h-3.5 w-3.5 mr-1" />
          Import MODELS_CONFIG
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import MODELS_CONFIG_CONTENT</DialogTitle>
          <DialogDescription>
            Paste your production line (or raw JSON). We store backends + API keys in the local
            session file so Copy secrets / Save config can manage SecretVM from MyProvider.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Paste</Label>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              spellCheck={false}
              placeholder={`MODELS_CONFIG_CONTENT='{"models":[...]}'`}
              className="w-full min-h-[160px] text-[10px] font-mono bg-black/50 border border-zinc-700 rounded p-2 text-zinc-200"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={alsoDownload}
              onChange={(e) => setAlsoDownload(e.target.checked)}
            />
            Also download updated morpheus-provider-secrets.json
          </label>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
            disabled={!paste.trim()}
            onClick={importPaste}
          >
            Import into session
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Tip: load your secrets JSON first (wallet / RPC / URL / admin), connect, then import this
            so Copy secrets emits all 5 lines with real apiKeys.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
