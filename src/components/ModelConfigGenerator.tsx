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
import ConfirmDialog from './ConfirmDialog';

export default function ModelConfigGenerator() {
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
    if (apiService) {
      loadData();
    }
  }, [apiService]);

  const loadData = async () => {
    if (!apiService || !walletBalance) return;

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

  const generateModelsConfigContent = (format: 'heredoc' | 'single-line' = 'heredoc'): string => {
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
    const allModels: any[] = [];

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
      const existingIndex = allModels.findIndex((c) => c.modelId === config.modelId);
      if (existingIndex >= 0) {
        // Update existing entry with new configuration
        allModels[existingIndex] = {
          modelId: config.modelId,
          modelName: config.modelName,
          apiType: config.apiType,
          apiUrl: config.apiUrl,
          ...(config.apiKey && { apiKey: config.apiKey }),
          concurrentSlots: config.concurrentSlots,
          capacityPolicy: config.capacityPolicy,
        };
      } else {
        // Add new model configuration
        allModels.push({
          modelId: config.modelId,
          modelName: config.modelName,
          apiType: config.apiType,
          apiUrl: config.apiUrl,
          ...(config.apiKey && { apiKey: config.apiKey }),
          concurrentSlots: config.concurrentSlots,
          capacityPolicy: config.capacityPolicy,
        });
      }
    });

    // Build the correct schema format with $schema and models array
    const configObject = {
      $schema: "https://raw.githubusercontent.com/MorpheusAIs/Morpheus-Lumerin-Node/a719073670adb17de6282b12d1852d39d629cb6e/proxy-router/internal/config/models-config-schema.json",
      models: allModels
    };

    if (format === 'single-line') {
      const minifiedJson = JSON.stringify(configObject);
      return `MODELS_CONFIG_CONTENT='${minifiedJson}'`;
    } else {
      // HEREDOC format - much easier to read and manually edit
      const prettyJson = JSON.stringify(configObject, null, 4);
      return `MODELS_CONFIG_CONTENT=$(cat <<'EOF'\n${prettyJson}\nEOF\n)`;
    }
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

  const handleCopyConfig = (format: 'heredoc' | 'single-line' = 'heredoc') => {
    try {
      const config = generateModelsConfigContent(format);
      navigator.clipboard.writeText(config);
      success(
        'Copied!', 
        format === 'heredoc' 
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
      
      // Reload data to refresh the sync status
      await loadData();
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
              <CardTitle>Model Configuration Sync</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            Compare your blockchain bids with your local node configuration
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
                <div className="bg-green-500/10 border border-green-500/30 rounded-md p-3">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-semibold">In Sync</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400 mt-1">
                    {syncStatus.filter((s) => !s.needsConfiguration && s.bidExists).length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Models configured and with active bids
                  </p>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-semibold">Needs Config</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-400 mt-1">
                    {modelsNeedingConfig.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Bids exist but models not configured locally
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3">
                  <div className="flex items-center gap-2 text-blue-400">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm font-semibold">No Bids</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-400 mt-1">
                    {syncStatus.filter((s) => !s.bidExists).length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Models configured locally but no active bids
                  </p>
                </div>
              </div>

              {/* Models Needing Configuration */}
              {modelsNeedingConfig.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-yellow-400">
                    Configure Models ({modelsNeedingConfig.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    These models have active bids but are not configured on your local node.
                    You can either fill in the details to configure them, or delete the bids if you don't plan to serve these models.
                  </p>

                  <Accordion type="multiple" className="w-full">
                    {modelsNeedingConfig.map((status) => (
                      <AccordionItem key={status.modelId} value={status.modelId}>
                        <div className="flex items-center justify-between pr-4">
                          <AccordionTrigger className="text-sm flex-1">
                            {status.modelName} ({status.modelId})
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
                              <Input
                                type="text"
                                placeholder="http://localhost:11434/v1/chat/completions"
                                value={modelConfigs[status.modelId]?.apiUrl || ''}
                                onChange={(e) =>
                                  updateModelConfig(status.modelId, 'apiUrl', e.target.value)
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                Full endpoint URL including path (e.g., /v1/chat/completions for LLMs, /v1/embeddings for embeddings)
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

                  {/* Option 1: Full Config */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Full Config (All Models) - HEREDOC Format</Label>
                        <p className="text-xs text-muted-foreground">
                          Complete MODELS_CONFIG_CONTENT - Easy to read and manually edit
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleCopyConfig('heredoc')}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy HEREDOC
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleCopyConfig('single-line')}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Single-Line
                        </Button>
                      </div>
                    </div>
                    <pre className="bg-muted/30 border border-border rounded-md p-4 text-xs whitespace-pre-wrap break-words overflow-y-auto max-h-64">
                      {generateModelsConfigContent('heredoc')}
                    </pre>
                    <p className="text-xs text-muted-foreground">
                      💡 HEREDOC format makes it easy to see and manually edit each model entry. 
                      Just copy this entire block into your .env file or shell script.
                    </p>
                  </div>

                  {/* Option 2: New Models Only (if there are new models to add) */}
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
                      <pre className="bg-muted/30 border border-border rounded-md p-4 text-xs whitespace-pre-wrap break-words overflow-y-auto max-h-64">
                        {generateNewModelsOnly()}
                      </pre>
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 text-xs space-y-2">
                        <p className="font-semibold text-blue-400">How to merge (super easy!):</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                          <li>Open your .env file and find the MODELS_CONFIG_CONTENT HEREDOC</li>
                          <li>Find your last existing model in the <code className="bg-muted px-1 rounded">"models": [...]</code> array</li>
                          <li>Position cursor right after the closing <code className="bg-muted px-1 rounded">{'}'}</code> of that last model</li>
                          <li>Copy the new models above (already has comma prefix!)</li>
                          <li>Paste directly after your last model - that's it!</li>
                          <li>Save and restart - existing models with API keys stay intact! 🎉</li>
                        </ol>
                        <p className="text-blue-400 mt-2">
                          💡 The leading comma is already included, so just paste after your last model's closing brace.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-4">
                    <p className="text-sm font-semibold text-blue-400">Quick Start:</p>
                    <div className="text-xs text-muted-foreground mt-2 space-y-2">
                      <p className="font-semibold">Option A: Incremental Update (Safest - No API Key Loss)</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Use "New Models Only" section above</li>
                        <li>Find your last model in .env's "models" array</li>
                        <li>Paste new models right after that last model's closing brace</li>
                        <li>Restart container - done! ✅</li>
                      </ol>
                      
                      <p className="font-semibold mt-3">Option B: Full Replace</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Copy "Full Config" HEREDOC format</li>
                        <li>Replace your entire MODELS_CONFIG_CONTENT in .env</li>
                        <li>Manually add back any API keys needed (check your notes!)</li>
                        <li>Restart container</li>
                      </ol>
                      
                      <p className="text-blue-400 mt-3">
                        💡 Tip: HEREDOC format means you can edit the JSON as multiple lines in your .env file - much easier than single-line!
                      </p>
                    </div>
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

