'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { ApiService } from '@/lib/apiService';
import type { Bid, Model, LocalModel, ModelConfigEntry, ModelSyncStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Copy, RefreshCw, FileCode, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ConfirmDialog from './ConfirmDialog';
import { formatModelsConfigContent, type ModelsConfigModel } from '@/lib/modelsConfigFormat';
import { VENICE_PRESETS } from '@/lib/venicePresets';
import {
  buildOperatorSecretsEnv,
  loadProviderSecretsSession,
  modelsFromLocalWithSessionKeys,
} from '@/lib/providerSession';

interface ModelConfigGeneratorProps {
  onRefresh?: () => void;
  refreshTrigger?: number;
}

export default function ModelConfigGenerator({
  onRefresh,
  refreshTrigger,
}: ModelConfigGeneratorProps) {
  const { apiService, walletBalance } = useApi();
  const { success, error: showError, warning } = useNotification();

  const [isLoading, setIsLoading] = useState(false);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [blockchainBids, setBlockchainBids] = useState<Bid[]>([]);
  const [blockchainModels, setBlockchainModels] = useState<Model[]>([]);
  const [syncStatus, setSyncStatus] = useState<ModelSyncStatus[]>([]);
  const [modelConfigs, setModelConfigs] = useState<Record<string, ModelConfigEntry>>({});
  const [showEnvOutput, setShowEnvOutput] = useState(false);
  const [deletingBidId, setDeletingBidId] = useState<string | null>(null);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    bidId: string;
    modelName: string;
  }>({ open: false, bidId: '', modelName: '' });

  useEffect(() => {
    if (apiService && walletBalance?.address) {
      void loadData();
    }
  }, [apiService, walletBalance?.address]);

  // React to parent refresh trigger (e.g., after create/delete operations)
  useEffect(() => {
    if (apiService && walletBalance?.address && refreshTrigger !== undefined && refreshTrigger > 0) {
      void loadData();
    }
  }, [refreshTrigger]);

  const loadData = async () => {
    if (!apiService || !walletBalance?.address) return;

    setIsLoading(true);
    try {
      // Load local models from the node (/v1/models returns array directly)
      const localModelsData = await apiService.getLocalModels();
      setLocalModels(localModelsData || []);

      // Load ACTIVE blockchain bids for this provider (endpoint returns only active bids)
      const activeBidsData = await apiService.getBids();
      setBlockchainBids(activeBidsData);

      // Load blockchain models
      const modelsData = await apiService.getModels();
      setBlockchainModels(modelsData);

      // Compare and create sync status
      analyzeSyncStatus(localModelsData || [], activeBidsData, modelsData);
    } catch (err) {
      showError('Failed to Load', ApiService.parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh both this component and parent component
  const handleRefresh = async () => {
    await loadData();
    onRefresh?.();
  };

  const analyzeSyncStatus = (
    local: LocalModel[],
    bids: Bid[],
    models: Model[]
  ) => {
    const status: ModelSyncStatus[] = [];

    // Check each bid - these are models the blockchain thinks we're serving
    bids.forEach((bid) => {
      const model = models.find((m) => m.Id === bid.ModelAgentId);
      const localModel = local.find((l) => l.Id === bid.ModelAgentId);

      status.push({
        modelId: bid.ModelAgentId,
        modelName: model?.Name || 'Unknown Model',
        onBlockchain: true,
        onLocalNode: !!localModel,
        bidExists: true,
        needsConfiguration: !localModel, // Needs config if not on local node
        bidId: bid.Id, // Include bid ID for deletion
      });
    });

    // Check local models that might not have bids
    local.forEach((localModel) => {
      const hasBid = bids.some((b) => b.ModelAgentId === localModel.Id);
      if (!hasBid) {
        const model = models.find((m) => m.Id === localModel.Id);
        status.push({
          modelId: localModel.Id,
          modelName: model?.Name || localModel.Name,
          onBlockchain: !!model,
          onLocalNode: true,
          bidExists: false,
          needsConfiguration: false, // Already configured locally, just no bid
        });
      }
    });

    setSyncStatus(status);

    // Initialize model configs for models that need configuration
    const configs: Record<string, ModelConfigEntry> = {};
    status
      .filter((s) => s.needsConfiguration)
      .forEach((s) => {
        configs[s.modelId] = {
          modelId: s.modelId,
          modelName: s.modelName,
          apiType: 'openai',
          apiUrl: '',
          apiKey: '',
          concurrentSlots: 8,
          capacityPolicy: 'simple',
        };
      });
    setModelConfigs(configs);
  };

  const updateModelConfig = (modelId: string, field: keyof ModelConfigEntry, value: any) => {
    setModelConfigs((prev) => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        [field]: value,
      },
    }));
  };

  const generateModelsConfigContent = (format: 'heredoc' | 'single-line' | 'secretvm-value' = 'heredoc'): string => {
    // Validate all user-configured models before generating
    for (const config of Object.values(modelConfigs)) {
      if (!config.apiUrl) {
        throw new Error(`API URL is required for ${config.modelName}`);
      }
      if (!config.concurrentSlots || config.concurrentSlots < 1) {
        throw new Error(`Concurrent Slots must be at least 1 for ${config.modelName}`);
      }
    }

    // Build the COMPLETE config: existing local models + new models
    const allModels: ModelsConfigModel[] = [];

    // Add all existing local models (they're already configured and working)
    // NOTE: API keys are NOT returned by /v1/models endpoint (security), so if you have
    // models with API keys, you'll need to manually add them back to this config
    localModels.forEach((local) => {
      allModels.push({
        modelId: local.Id,
        modelName: local.Name,
        apiType: local.ApiType,
        apiUrl: local.ApiUrl,
        concurrentSlots: local.Slots,
        capacityPolicy: local.CapacityPolicy,
      });
    });

    // Add newly configured models (that need to be added)
    Object.values(modelConfigs).forEach((config) => {
      const entry: ModelsConfigModel = {
        modelId: config.modelId,
        modelName: config.modelName,
        apiType: config.apiType,
        apiUrl: config.apiUrl,
        concurrentSlots: Number(config.concurrentSlots),
        capacityPolicy: config.capacityPolicy,
      };
      if (config.apiKey) entry.apiKey = config.apiKey;

      const existingIndex = allModels.findIndex((c) => c.modelId === config.modelId);
      if (existingIndex >= 0) {
        allModels[existingIndex] = entry;
      } else {
        allModels.push(entry);
      }
    });

    return formatModelsConfigContent(allModels, format);
  };

  const generateNewModelsOnly = (): string => {
    // Generate ONLY the new models that need to be added (partial/incremental update)
    // This allows you to manually merge these into your existing MODELS_CONFIG_CONTENT
    // without losing API keys from existing models
    
    const newConfigs: any[] = [];
    
    Object.values(modelConfigs).forEach((config) => {
      newConfigs.push({
        modelId: config.modelId,
        modelName: config.modelName,
        apiType: config.apiType,
        apiUrl: config.apiUrl,
        ...(config.apiKey && { apiKey: config.apiKey }),
        concurrentSlots: config.concurrentSlots,
        capacityPolicy: config.capacityPolicy,
      });
    });

    // Format WITHOUT square brackets, WITH leading comma for easy paste after last model
    // This makes it simple: find your last model, paste this after it
    const modelsJson = newConfigs.map(model => 
      JSON.stringify(model, null, 4)
    ).join(',\n');
    
    return `,\n${modelsJson}`;
  };

  const handleCopyConfig = (format: 'heredoc' | 'single-line' | 'secretvm-value' = 'heredoc') => {
    try {
      const config = generateModelsConfigContent(format);
      navigator.clipboard.writeText(config);
      success(
        'Copied!',
        format === 'secretvm-value'
          ? 'SecretVM value copied — paste into MODELS_CONFIG_CONTENT secret (no KEY= prefix)'
          : format === 'heredoc'
            ? 'HEREDOC format copied - paste in shell script or .env'
            : 'Single-line format copied'
      );
    } catch (err) {
      showError('Validation Error', err instanceof Error ? err.message : 'Please check all fields');
    }
  };

  const handleDeleteBidClick = (bidId: string, modelName: string) => {
    setConfirmDialog({ open: true, bidId, modelName });
  };

  const handleDeleteBidConfirm = async () => {
    if (!apiService) return;

    const { bidId, modelName } = confirmDialog;
    setConfirmDialog({ open: false, bidId: '', modelName: '' });
    setDeletingBidId(bidId);

    try {
      await apiService.deleteBid(bidId);
      success('Bid Deleted', `Bid for ${modelName} has been removed from the blockchain`);
      
      // Reload data to refresh the sync status (both this component and parent)
      await loadData();
      onRefresh?.();
    } catch (err) {
      showError('Delete Failed', ApiService.parseError(err));
    } finally {
      setDeletingBidId(null);
    }
  };

  const modelsNeedingConfig = syncStatus.filter((s) => s.needsConfiguration);

  return (
    <div className="space-y-6">
      {/* Status Overview */}
      <Card className="border-gray-700 bg-gray-800/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              <CardTitle>Bid ↔ VM config</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription>
            On-chain bids vs what this machine has loaded in MODELS_CONFIG
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading model data...</p>
          ) : syncStatus.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No models or bids found</p>
              <p className="text-xs text-muted-foreground mt-2">
                Create bids on the Models & Bids tab to get started
              </p>
            </div>
          ) : (
            <>
              {/* Sync Status Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(() => {
                  const inSyncCount = syncStatus.filter((s) => !s.needsConfiguration && s.bidExists).length;
                  const isActive = inSyncCount > 0;
                  return (
                    <div className={`rounded-md p-3 ${
                      isActive 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-gray-500/10 border border-gray-500/30'
                    }`}>
                      <div className={`flex items-center gap-2 ${isActive ? 'text-green-400' : 'text-gray-500'}`}>
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-semibold">In Sync</span>
                      </div>
                      <p className={`text-2xl font-bold mt-1 ${isActive ? 'text-green-400' : 'text-gray-500'}`}>
                        {inSyncCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Models configured and with active bids
                      </p>
                    </div>
                  );
                })()}

                {(() => {
                  const needsConfigCount = modelsNeedingConfig.length;
                  const isActive = needsConfigCount > 0;
                  return (
                    <div className={`rounded-md p-3 ${
                      isActive 
                        ? 'bg-orange-500/10 border border-orange-500/40' 
                        : 'bg-gray-500/10 border border-gray-500/30'
                    }`}>
                      <div className={`flex items-center gap-2 ${isActive ? 'text-orange-300' : 'text-gray-500'}`}>
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-semibold">Needs Config</span>
                      </div>
                      <p className={`text-2xl font-bold mt-1 ${isActive ? 'text-orange-300' : 'text-gray-500'}`}>
                        {needsConfigCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Bid on-chain · not in this VM&apos;s MODELS_CONFIG yet
                      </p>
                    </div>
                  );
                })()}

                {(() => {
                  const noBidsCount = syncStatus.filter((s) => !s.bidExists).length;
                  const isActive = noBidsCount > 0;
                  return (
                    <div className={`rounded-md p-3 ${
                      isActive 
                        ? 'bg-yellow-500/10 border border-yellow-500/30' 
                        : 'bg-gray-500/10 border border-gray-500/30'
                    }`}>
                      <div className={`flex items-center gap-2 ${isActive ? 'text-yellow-400' : 'text-gray-500'}`}>
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-semibold">No Bids</span>
                      </div>
                      <p className={`text-2xl font-bold mt-1 ${isActive ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {noBidsCount}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Models configured locally but no active bids
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Always-available SecretVM export — full 5-line secrets (not MODELS alone) */}
              {localModels.length > 0 && modelsNeedingConfig.length === 0 && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-2">
                  <p className="text-sm font-medium">Export SecretVM secrets (all 5 lines)</p>
                  <p className="text-xs text-muted-foreground">
                    SecretVM replaces the whole secrets blob — copy the full block (wallet, RPC, URL,
                    cookie, MODELS_CONFIG), not MODELS_CONFIG alone.
                  </p>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
                    onClick={() => {
                      try {
                        const session = loadProviderSecretsSession();
                        const models = modelsFromLocalWithSessionKeys(localModels, session);
                        // Prefer backend modelName from node (Model) when present
                        const withNames = models.map((m, i) => ({
                          ...m,
                          modelName: localModels[i]?.Model || localModels[i]?.Name || m.modelName,
                          apiType: localModels[i]?.ApiType || m.apiType,
                          apiUrl: localModels[i]?.ApiUrl || m.apiUrl,
                          concurrentSlots: localModels[i]?.Slots || m.concurrentSlots,
                          capacityPolicy: localModels[i]?.CapacityPolicy || m.capacityPolicy,
                        }));
                        const block = buildOperatorSecretsEnv(withNames, session);
                        navigator.clipboard.writeText(block);
                        success('Copied secrets', 'All 5 lines — paste into SecretVM encrypted secrets');
                      } catch (e) {
                        showError(
                          'Export failed',
                          e instanceof Error ? e.message : 'Load a secrets file first, then retry'
                        );
                      }
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy SecretVM secrets
                  </Button>
                </div>
              )}

              {/* Models Needing Configuration */}
              {modelsNeedingConfig.length > 0 && (
                <div className="space-y-3 rounded-md border border-orange-500/40 bg-orange-500/10 p-3">
                  <h3 className="text-sm font-semibold text-orange-200">
                    Middle state — bid live, VM not updated ({modelsNeedingConfig.length})
                  </h3>
                  <p className="text-xs text-orange-100/85 leading-relaxed">
                    Marketplace can see these bids, but this machine cannot serve them until you add
                    them to MODELS_CONFIG, Copy secrets, paste into SecretVM, and restart. Or delete
                    the bid if you are not going to serve the model.
                  </p>

                  <Accordion type="multiple" className="w-full">
                    {modelsNeedingConfig.map((status) => (
                      <AccordionItem key={status.modelId} value={status.modelId}>
                        <div className="flex items-center justify-between pr-4">
                          <AccordionTrigger className="text-sm flex-1">
                            {status.modelName} ({status.modelId.slice(0, 10)}...{status.modelId.slice(-6)})
                          </AccordionTrigger>
                          {status.bidId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBidClick(status.bidId!, status.modelName);
                              }}
                              disabled={deletingBidId === status.bidId}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              title="Delete this bid (you're not serving this model)"
                            >
                              {deletingBidId === status.bidId ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete Bid
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            {/* Prominent Model ID Field */}
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <Label className="text-blue-400 text-xs font-semibold">Model ID (for your config)</Label>
                                  <code className="block mt-1 text-xs bg-muted/50 px-2 py-1.5 rounded font-mono break-all select-all">
                                    {status.modelId}
                                  </code>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    navigator.clipboard.writeText(status.modelId);
                                    success('Copied!', 'Model ID copied to clipboard');
                                  }}
                                  className="flex-shrink-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                >
                                  <Copy className="h-4 w-4 mr-1" />
                                  Copy
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label>API Type</Label>
                                <Select
                                  value={modelConfigs[status.modelId]?.apiType || 'openai'}
                                  onValueChange={(value) =>
                                    updateModelConfig(status.modelId, 'apiType', value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="openai">OpenAI Compatible</SelectItem>
                                    <SelectItem value="claudeai">Claude AI</SelectItem>
                                    <SelectItem value="prodia-v2">Prodia V2</SelectItem>
                                    <SelectItem value="hyperbolic-sd">Hyperbolic SD</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label>Concurrent Slots</Label>
                                <Input
                                  type="number"
                                  placeholder="8"
                                  value={modelConfigs[status.modelId]?.concurrentSlots ?? 8}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    updateModelConfig(
                                      status.modelId,
                                      'concurrentSlots',
                                      val === '' ? '' : parseInt(val) || 0
                                    );
                                  }}
                                />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label>API URL *</Label>
                              <div className="flex flex-wrap gap-1 mb-1">
                                {VENICE_PRESETS.map((p) => (
                                  <Button
                                    key={p.id}
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px]"
                                    onClick={() => {
                                      updateModelConfig(status.modelId, 'apiUrl', p.apiUrl);
                                      updateModelConfig(status.modelId, 'apiType', p.apiType);
                                      updateModelConfig(status.modelId, 'concurrentSlots', p.concurrentSlots);
                                      updateModelConfig(status.modelId, 'capacityPolicy', p.capacityPolicy);
                                    }}
                                  >
                                    {p.label}
                                  </Button>
                                ))}
                              </div>
                              <Input
                                type="text"
                                placeholder="http://localhost:11434/v1/chat/completions"
                                value={modelConfigs[status.modelId]?.apiUrl || ''}
                                onChange={(e) =>
                                  updateModelConfig(status.modelId, 'apiUrl', e.target.value)
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                Full endpoint URL including path. Venice Diem presets fill api.venice.ai — paste your Venice API key below.
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label>API Key (Optional)</Label>
                              <Input
                                type="password"
                                placeholder="sk-..."
                                value={modelConfigs[status.modelId]?.apiKey || ''}
                                onChange={(e) =>
                                  updateModelConfig(status.modelId, 'apiKey', e.target.value)
                                }
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Capacity Policy</Label>
                              <Select
                                value={modelConfigs[status.modelId]?.capacityPolicy || 'simple'}
                                onValueChange={(value) =>
                                  updateModelConfig(status.modelId, 'capacityPolicy', value)
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="simple">Simple</SelectItem>
                                  <SelectItem value="idle_timeout">Idle Timeout</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  <Button
                    onClick={() => setShowEnvOutput(true)}
                    className="w-full"
                    disabled={modelsNeedingConfig.some(
                      (s) => !modelConfigs[s.modelId]?.apiUrl
                    )}
                  >
                    <FileCode className="mr-2 h-4 w-4" />
                    Generate MODELS_CONFIG_CONTENT
                  </Button>
                </div>
              )}

              {/* ENV Output */}
              {showEnvOutput && (
                <div className="space-y-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-md p-4">
                    <p className="text-sm text-green-400 font-semibold">
                      ✓ Configuration Generated!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose your update method below.
                    </p>
                  </div>

                  {/* Warning about API keys if existing models present */}
                  {localModels.length > 0 && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-4">
                      <div className="flex gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                        <div className="text-sm space-y-2">
                          <p className="font-semibold text-yellow-400">⚠️ API Key Warning</p>
                          <p className="text-muted-foreground">
                            Your existing {localModels.length} model{localModels.length > 1 ? 's' : ''} may have API keys configured, 
                            but the /v1/models endpoint doesn't expose them (security). If you replace the full config, 
                            you'll need to manually add back any API keys.
                          </p>
                          <p className="text-blue-400 text-xs">
                            💡 Tip: Use "New Models Only" option to safely add new models without affecting existing ones.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-4">
                    <p className="text-sm font-semibold text-blue-400 mb-3">How to Update Your .env File:</p>
                    
                    <Tabs defaultValue="secretvm" className="w-full">
                      <TabsList className="w-full mb-4 border-b border-zinc-700">
                        <TabsTrigger value="secretvm">SecretVM</TabsTrigger>
                        <TabsTrigger value="binary">Standalone Binary</TabsTrigger>
                        <TabsTrigger value="docker">Docker</TabsTrigger>
                      </TabsList>

                      <TabsContent value="secretvm" className="space-y-4">
                        <div className="bg-primary/10 border border-primary/30 rounded p-3">
                          <p className="text-xs text-primary">
                            SecretVM updates replace the <strong>entire</strong> secrets blob. Copy all
                            5 <code className="bg-muted px-1 rounded">KEY=</code> lines (not MODELS alone).
                          </p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">Full SecretVM secrets</p>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
                              onClick={() => {
                                try {
                                  const session = loadProviderSecretsSession();
                                  const fromForm = Object.values(modelConfigs).filter(
                                    (c) => c.modelId && c.apiUrl
                                  ) as ModelsConfigModel[];
                                  const models: ModelsConfigModel[] =
                                    fromForm.length > 0
                                      ? fromForm.map((c) => ({
                                          modelId: c.modelId,
                                          modelName: c.modelName,
                                          apiType: c.apiType,
                                          apiUrl: c.apiUrl,
                                          apiKey: c.apiKey,
                                          concurrentSlots:
                                            typeof c.concurrentSlots === 'number'
                                              ? c.concurrentSlots
                                              : 1,
                                          capacityPolicy: c.capacityPolicy || 'simple',
                                        }))
                                      : modelsFromLocalWithSessionKeys(localModels, session);
                                  const block = buildOperatorSecretsEnv(models, session);
                                  navigator.clipboard.writeText(block);
                                  success(
                                    'Copied secrets',
                                    'All 5 lines — paste into SecretVM encrypted secrets'
                                  );
                                } catch (e) {
                                  showError(
                                    'Copy failed',
                                    e instanceof Error
                                      ? e.message
                                      : 'Load a secrets file first, then retry'
                                  );
                                }
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy all 5 secrets
                            </Button>
                          </div>
                          <pre className="text-[10px] overflow-x-auto max-h-40 bg-black/50 p-3 rounded border border-zinc-700 whitespace-pre-wrap break-all">
                            {(() => {
                              try {
                                const session = loadProviderSecretsSession();
                                const fromForm = Object.values(modelConfigs).filter(
                                  (c) => c.modelId && c.apiUrl
                                ) as ModelsConfigModel[];
                                const models: ModelsConfigModel[] =
                                  fromForm.length > 0
                                    ? fromForm.map((c) => ({
                                        modelId: c.modelId,
                                        modelName: c.modelName,
                                        apiType: c.apiType,
                                        apiUrl: c.apiUrl,
                                        apiKey: c.apiKey,
                                        concurrentSlots:
                                          typeof c.concurrentSlots === 'number'
                                            ? c.concurrentSlots
                                            : 1,
                                        capacityPolicy: c.capacityPolicy || 'simple',
                                      }))
                                    : modelsFromLocalWithSessionKeys(localModels, session);
                                return buildOperatorSecretsEnv(models, session);
                              } catch (e) {
                                return e instanceof Error
                                  ? e.message
                                  : 'Load a secrets file first to preview the full block';
                              }
                            })()}
                          </pre>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          After updating secrets, redeploy/restart the VM, then reconnect MyProvider and
                          verify <code className="bg-muted px-1 rounded">/healthcheck</code>.
                        </p>
                      </TabsContent>

                      {/* Standalone Binary Instructions */}
                      <TabsContent value="binary" className="space-y-4">
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                          <p className="text-xs text-yellow-400">
                            ⚠️ <span className="font-medium">Standalone Binary users must use Full Replace.</span> Incremental updates are not supported with Single-Line format.
                          </p>
                        </div>

                        {/* Full Config for Binary */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Full Config (All Models)</Label>
                              <p className="text-xs text-muted-foreground">
                                Complete MODELS_CONFIG_CONTENT in Single-Line format
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleCopyConfig('single-line')}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy Single-Line
                            </Button>
                          </div>
                          <pre className="bg-muted/30 border border-border rounded-md p-4 text-xs whitespace-pre-wrap break-words overflow-y-auto max-h-48">
                            {generateModelsConfigContent('single-line')}
                          </pre>
                        </div>

                        <div className="border-t border-border pt-3">
                          <p className="text-sm font-medium mb-3">Update Instructions:</p>
                          <ol className="list-decimal space-y-3 text-sm text-foreground">
                            <li className="ml-5">
                              <span className="font-medium">Click "Copy Single-Line" button above</span>
                              <p className="text-xs text-muted-foreground mt-1">Single-Line format is required for standalone binaries (HEREDOC will cause errors)</p>
                            </li>
                          
                          <li className="ml-5">
                            <span className="font-medium">Edit your .env file:</span>
                            <div className="relative group mt-2">
                              <pre className="bg-muted/50 p-3 rounded text-xs">nano ~/morpheus-node/.env</pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  navigator.clipboard.writeText('nano ~/morpheus-node/.env');
                                  success('Copied!', 'Command copied to clipboard');
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              Alternative editors: <code className="bg-muted px-1 rounded">vim .env</code> or <code className="bg-muted px-1 rounded">code .env</code>
                            </p>
                          </li>

                          <li className="ml-5">
                            <span className="font-medium">Find and replace MODELS_CONFIG_CONTENT line:</span>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-muted-foreground mt-2">
                              <li>Find the line starting with <code className="bg-muted px-1 rounded">MODELS_CONFIG_CONTENT=</code></li>
                              <li>Delete the entire line (including the <code className="bg-muted px-1 rounded">=</code> sign and everything after it)</li>
                              <li>Paste the new Single-Line configuration you copied</li>
                            </ul>
                          </li>

                          <li className="ml-5">
                            <span className="font-medium">Save and exit:</span>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-muted-foreground mt-2">
                              <li>In nano: Press Ctrl+O, then Enter to save; Ctrl+X to exit</li>
                              <li>In vim: Press Esc, type <code className="bg-muted px-1 rounded">:wq</code>, then Enter</li>
                            </ul>
                          </li>

                          <li className="ml-5">
                            <span className="font-medium">Restart your proxy-router:</span>
                            <div className="relative group mt-2">
                              <pre className="bg-muted/50 p-3 rounded text-xs whitespace-pre-wrap break-words">{`# Stop the current process (if running in foreground)
# Press Ctrl+C

# If running in background, find and kill the process:
pkill -f proxy-router

# Start it again:
cd ~/morpheus-node
./proxy-router`}</pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  navigator.clipboard.writeText('pkill -f proxy-router\ncd ~/morpheus-node\n./proxy-router');
                                  success('Copied!', 'Commands copied to clipboard');
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </li>

                            <li className="ml-5">
                              <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                                <p className="text-green-400 font-medium">✅ Done! Your node should now serve the updated models.</p>
                              </div>
                            </li>
                          </ol>
                        </div>
                      </TabsContent>

                      {/* Docker Instructions */}
                      <TabsContent value="docker" className="space-y-4">
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                          <p className="text-xs text-blue-400 mb-2">
                            <span className="font-medium">💡 Docker users have two options:</span>
                          </p>
                          <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                            <li><span className="font-medium text-foreground">Incremental Update (Safest):</span> Use "New Models Only" below - paste into existing config without affecting API keys</li>
                            <li><span className="font-medium text-foreground">Full Replace:</span> Use "Full Config" below - replaces entire MODELS_CONFIG_CONTENT</li>
                          </ul>
                        </div>

                        {/* Full Config for Docker */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Full Config (All Models)</Label>
                              <p className="text-xs text-muted-foreground">
                                Complete MODELS_CONFIG_CONTENT in HEREDOC format
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleCopyConfig('heredoc')}>
                              <Copy className="h-4 w-4 mr-2" />
                              Copy HEREDOC
                            </Button>
                          </div>
                          <pre className="bg-muted/30 border border-border rounded-md p-4 text-xs whitespace-pre-wrap break-words overflow-y-auto max-h-48">
                            {generateModelsConfigContent('heredoc')}
                          </pre>
                        </div>

                        {/* New Models Only for Docker */}
                        {Object.keys(modelConfigs).length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label>New Models Only ⭐ (Recommended for incremental updates)</Label>
                                <p className="text-xs text-muted-foreground">
                                  Only the {Object.keys(modelConfigs).length} new model{Object.keys(modelConfigs).length > 1 ? 's' : ''} with leading comma - 
                                  paste after your last existing model
                                </p>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  navigator.clipboard.writeText(generateNewModelsOnly());
                                  success('Copied!', 'New models configuration copied');
                                }}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Models
                              </Button>
                            </div>
                            <pre className="bg-muted/30 border border-border rounded-md p-4 text-xs whitespace-pre-wrap break-words overflow-y-auto max-h-48">
                              {generateNewModelsOnly()}
                            </pre>
                          </div>
                        )}

                        <div className="border-t border-border pt-3">
                          <p className="text-sm font-medium mb-3">Update Instructions:</p>
                          <ol className="list-decimal space-y-3 text-sm text-foreground">
                            <li className="ml-5">
                              <span className="font-medium">Choose your approach and copy above:</span>
                              <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-muted-foreground mt-2">
                                <li><span className="font-medium text-foreground">Incremental:</span> Click "Copy Models" in "New Models Only"</li>
                                <li><span className="font-medium text-foreground">Full Replace:</span> Click "Copy HEREDOC" in "Full Config"</li>
                              </ul>
                            </li>
                          
                          <li className="ml-5">
                            <span className="font-medium">Edit your .env file:</span>
                            <div className="relative group mt-2">
                              <pre className="bg-muted/50 p-3 rounded text-xs">nano .env</pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  navigator.clipboard.writeText('nano .env');
                                  success('Copied!', 'Command copied to clipboard');
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              Alternative editors: <code className="bg-muted px-1 rounded">vim .env</code> or <code className="bg-muted px-1 rounded">code .env</code>
                            </p>
                          </li>

                          <li className="ml-5">
                            <span className="font-medium">Update MODELS_CONFIG_CONTENT section:</span>
                            <div className="mt-2 space-y-2">
                              <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                                <p className="text-xs text-green-400 font-medium mb-1">Option A: Incremental Update (Recommended)</p>
                                <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-muted-foreground">
                                  <li>Find the <code className="bg-muted px-1 rounded">"models": [...]</code> array in your MODELS_CONFIG_CONTENT</li>
                                  <li>Scroll to your last existing model's closing <code className="bg-muted px-1 rounded">{'}'}</code></li>
                                  <li>Paste the new models right after that <code className="bg-muted px-1 rounded">{'}'}</code> (comma is already included!)</li>
                                  <li>Existing models and their API keys stay untouched! 🎉</li>
                                </ul>
                              </div>
                              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
                                <p className="text-xs text-blue-400 font-medium mb-1">Option B: Full Replace</p>
                                <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-muted-foreground">
                                  <li>Find the line starting with <code className="bg-muted px-1 rounded">MODELS_CONFIG_CONTENT=$(cat &lt;&lt;'EOF'</code></li>
                                  <li>Delete from that line down to the matching <code className="bg-muted px-1 rounded">EOF</code> and <code className="bg-muted px-1 rounded">)</code></li>
                                  <li>Paste the new HEREDOC configuration you copied</li>
                                  <li>⚠️ You'll need to manually re-add any API keys</li>
                                </ul>
                              </div>
                            </div>
                          </li>

                          <li className="ml-5">
                            <span className="font-medium">Save and exit:</span>
                            <ul className="list-disc list-inside space-y-1 ml-2 text-xs text-muted-foreground mt-2">
                              <li>In nano: Press Ctrl+O, then Enter to save; Ctrl+X to exit</li>
                              <li>In vim: Press Esc, type <code className="bg-muted px-1 rounded">:wq</code>, then Enter</li>
                            </ul>
                          </li>

                          <li className="ml-5">
                            <span className="font-medium">Restart your Docker container:</span>
                            <div className="relative group mt-2">
                              <pre className="bg-muted/50 p-3 rounded text-xs">docker restart morpheus-proxy-router</pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  navigator.clipboard.writeText('docker restart morpheus-proxy-router');
                                  success('Copied!', 'Command copied to clipboard');
                                }}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </li>

                            <li className="ml-5">
                              <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                                <p className="text-green-400 font-medium">✅ Done! Your node should now serve the updated models.</p>
                              </div>
                            </li>
                          </ol>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={handleDeleteBidConfirm}
        title="Delete Bid"
        description={`Are you sure you want to delete the bid for ${confirmDialog.modelName}? This action cannot be undone.`}
        confirmText="Delete Bid"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}

