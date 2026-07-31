'use client';

import { useCallback, useState } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Save, Unplug } from 'lucide-react';
import { ApiService } from '@/lib/apiService';
import { buildSecretsFile, downloadSecretsFile } from '@/lib/secretsFile';
import {
  buildOperatorSecretsEnv,
  loadProviderSecretsSession,
  modelsFromLocalWithSessionKeys,
  saveProviderSecretsSession,
} from '@/lib/providerSession';
import type { ModelsConfigModel } from '@/lib/modelsConfigFormat';
import ImportModelsConfigButton from '@/components/ImportModelsConfigButton';

/**
 * Slim connection status + Save / Copy secrets for SecretVM updates.
 */
export default function ConnectedNodeBar() {
  const { isConfigured, clearConfig, walletBalance, apiService } = useApi();
  const { success, warning, error: showError } = useNotification();
  const [busy, setBusy] = useState(false);

  const buildSecretsText = useCallback(async (): Promise<string | null> => {
    const session = loadProviderSecretsSession();
    if (!session?.adminPass && !session?.walletPrivateKey) {
      warning(
        'No session secrets',
        'Load a secrets file (or finish bootstrap Save) once so we can rebuild SecretVM paste'
      );
      return null;
    }

    // Prefer imported/edited planned (keeps apiKeys). Fall back to live /v1/models + key overlay.
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
      try {
        const local = await apiService.getLocalModels();
        models = modelsFromLocalWithSessionKeys(local || [], session);
      } catch (err) {
        showError('Could not read /v1/models', ApiService.parseError(err));
        return null;
      }
    }

    try {
      return buildOperatorSecretsEnv(models, session);
    } catch (e) {
      warning('Cannot build secrets', e instanceof Error ? e.message : 'Unknown error');
      return null;
    }
  }, [apiService, showError, warning]);

  const copySecrets = async () => {
    setBusy(true);
    try {
      const text = await buildSecretsText();
      if (!text) return;
      await navigator.clipboard.writeText(text);
      success('Copied secrets', 'All 5 lines — paste into SecretVM encrypted secrets');
    } catch (e) {
      showError('Copy failed', e instanceof Error ? e.message : 'Clipboard error');
    } finally {
      setBusy(false);
    }
  };

  const saveConfig = async () => {
    setBusy(true);
    try {
      const session = loadProviderSecretsSession();
      if (!session) {
        warning('Nothing to save', 'Load a secrets file first, or Save during bootstrap');
        return;
      }

      let planned = session.planned || [];
      if (apiService) {
        try {
          const local = await apiService.getLocalModels();
          const keyMap = new Map<string, string>();
          for (const p of planned) {
            if (p.apiKey) keyMap.set(p.modelId.toLowerCase(), p.apiKey);
          }
          planned = (local || []).map((m) => {
            const prev = planned.find((p) => p.modelId.toLowerCase() === m.Id.toLowerCase());
            return {
              modelId: m.Id,
              modelName: m.Name,
              priceMorPerHour: prev?.priceMorPerHour ?? 0,
              backendKind: prev?.backendKind ?? 'own',
              backendModelName: m.Model || prev?.backendModelName || m.Name,
              apiUrl: m.ApiUrl || prev?.apiUrl || '',
              apiKey: keyMap.get(m.Id.toLowerCase()) || prev?.apiKey || '',
              concurrentSlots: m.Slots || prev?.concurrentSlots || 1,
            };
          });
        } catch {
          /* keep planned as-is */
        }
      }

      const next = {
        ...session,
        planned,
        webPublicUrl: session.webPublicUrl,
      };
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
      success('Saved', 'morpheus-provider-secrets.json');
    } finally {
      setBusy(false);
    }
  };

  if (!isConfigured) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="bg-emerald-600 text-xs">
          <Check className="h-3 w-3 mr-1" /> Connected
        </Badge>
        {walletBalance?.address && (
          <code className="text-emerald-100/90">
            {walletBalance.address.slice(0, 8)}…{walletBalance.address.slice(-6)}
          </code>
        )}
        <span className="text-muted-foreground">Operator mode</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <ImportModelsConfigButton variant="bar" />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={busy}
          onClick={() => void saveConfig()}
        >
          <Save className="h-3.5 w-3.5 mr-1" />
          Save config
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
          disabled={busy}
          onClick={() => void copySecrets()}
        >
          <Copy className="h-3.5 w-3.5 mr-1" />
          Copy secrets
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-zinc-400 hover:text-foreground"
          onClick={() => {
            clearConfig();
            success('Disconnected', 'API session cleared — secrets file stays in this tab for Save/Copy');
          }}
        >
          <Unplug className="h-3.5 w-3.5 mr-1" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
