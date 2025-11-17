'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { ApiService } from '@/lib/apiService';
import type { Model, Bid } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RefreshCw, Plus, Loader2, Tag, Copy, Edit, Trash2, ChevronDown, AlertCircle } from 'lucide-react';
import { weiToMor, formatMor, morToWei, shortenAddress, isValidPositiveNumber } from '@/lib/utils';
import { CONTRACT_MINIMUMS } from '@/lib/constants';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ModelConfigGenerator from '@/components/ModelConfigGenerator';
import ConfirmDialog from './ConfirmDialog';

/**
 * ModelTab manages models and bids with 4 distinct sections
 */
export default function ModelTab() {
  const { apiService, walletBalance, getNetworkConfig } = useApi();
  const { success, error, warning } = useNotification();
  
  const [models, setModels] = useState<Model[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [checkingProvider, setCheckingProvider] = useState(true);
  
  // Form state for creating model + bid
  const [modelName, setModelName] = useState('');
  const [stakeMor, setStakeMor] = useState(formatMor(CONTRACT_MINIMUMS.MODEL_MIN_STAKE));
  const [feeMor, setFeeMor] = useState(formatMor(CONTRACT_MINIMUMS.MARKETPLACE_BID_FEE));
  const [tags, setTags] = useState('LLM');
  const [bidPrice, setBidPrice] = useState(CONTRACT_MINIMUMS.BID_PRICE_PER_SEC_MIN);

  // Form state for adding/changing bid
  const [newBidPrice, setNewBidPrice] = useState(CONTRACT_MINIMUMS.BID_PRICE_PER_SEC_MIN);

  // Confirmation dialogs state
  const [deleteModelConfirm, setDeleteModelConfirm] = useState<{
    open: boolean;
    model: Model | null;
  }>({ open: false, model: null });
  
  const [deleteBidConfirm, setDeleteBidConfirm] = useState<{
    open: boolean;
    bidId: string;
    modelName: string;
  }>({ open: false, bidId: '', modelName: '' });

  const MODEL_MIN_STAKE_MOR = formatMor(CONTRACT_MINIMUMS.MODEL_MIN_STAKE);
  const MIN_FEE_WEI = CONTRACT_MINIMUMS.MARKETPLACE_BID_FEE;
  const MIN_BID_PRICE = CONTRACT_MINIMUMS.BID_PRICE_PER_SEC_MIN;

  useEffect(() => {
    if (apiService) {
      checkProviderStatus();
      loadData();
    }
  }, [apiService]);

  const checkProviderStatus = async () => {
    if (!apiService || !walletBalance) return;
    
    setCheckingProvider(true);
    try {
      const status = await apiService.getProviderStatus();
      setIsRegistered(status.isRegistered);
    } catch (err) {
      console.error('Provider status check failed:', err);
      setIsRegistered(false);
    } finally {
      setCheckingProvider(false);
    }
  };

  const loadData = async () => {
    if (!apiService) return;
    
    setIsLoading(true);
    try {
      const [modelsData, bidsData] = await Promise.all([
        apiService.getModels(),
        apiService.getBids()
      ]);
      // Filter for active models and bids only
      const activeModels = modelsData.filter(m => !m.IsDeleted);
      const activeBids = bidsData.filter(b => b.DeletedAt === '0' || b.DeletedAt === null || b.DeletedAt === '');
      
      setModels(activeModels);
      setBids(activeBids);
    } catch (err) {
      error('Failed to Load', ApiService.parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to generate a unique model ID and IPFS CID
  const generateIds = () => {
    const randomBytes = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    const generateHex = () => '0x' + Array.from({ length: 32 }, randomBytes).join('');
    
    return {
      modelId: generateHex(),
      ipfsCid: generateHex()
    };
  };

  // Check if we own this model
  const isMyModel = (model: Model): boolean => {
    if (!walletBalance?.address || !model.Owner) return false;
    return model.Owner.toLowerCase() === walletBalance.address.toLowerCase();
  };

  // Get our bid for a specific model (only one bid per provider per model)
  const getMyBidForModel = (modelId: string): Bid | null => {
    if (!walletBalance?.address) return null;
    const bid = bids.find(
      bid => bid.ModelAgentId === modelId && 
             bid.Provider.toLowerCase() === walletBalance.address.toLowerCase()
    );
    return bid || null;
  };

  // Get total bid count for a model (from all providers, not just ours)
  const getTotalBidCountForModel = (modelId: string): number => {
    return bids.filter(bid => bid.ModelAgentId === modelId).length;
  };

  // Split models into 4 sections
  const ownedModelsWithBids = models.filter(m => isMyModel(m) && getMyBidForModel(m.Id) !== null);
  const notOwnedWithBids = models.filter(m => !isMyModel(m) && getMyBidForModel(m.Id) !== null);
  const ownedModelsNoBids = models.filter(m => isMyModel(m) && getMyBidForModel(m.Id) === null);
  const notOwnedNoBids = models.filter(m => !isMyModel(m) && getMyBidForModel(m.Id) === null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    success('Copied', `${label} copied to clipboard`);
  };

  const handleCreateModelAndBid = async () => {
    if (!apiService || !walletBalance) return;

    const networkConfig = getNetworkConfig();
    if (!networkConfig) {
      error('Configuration Error', 'Network configuration not available');
      return;
    }

    // Validation
    if (!modelName) {
      warning('Validation Error', 'Please enter a model name');
      return;
    }

    if (!isValidPositiveNumber(stakeMor)) {
      warning('Validation Error', 'Please enter a valid stake amount');
      return;
    }

    const stakeNum = parseFloat(stakeMor);
    if (stakeNum < parseFloat(MODEL_MIN_STAKE_MOR)) {
      warning('Insufficient Stake', `Minimum model stake is ${MODEL_MIN_STAKE_MOR} MOR`);
      return;
    }

    if (!isValidPositiveNumber(feeMor)) {
      warning('Validation Error', 'Please enter a valid marketplace fee');
      return;
    }

    const feeNum = parseFloat(feeMor);
    const minFeeNum = parseFloat(formatMor(MIN_FEE_WEI));
    if (feeNum < minFeeNum) {
      warning('Insufficient Fee', `Minimum fee is ${formatMor(MIN_FEE_WEI)} MOR`);
      return;
    }

    if (!isValidPositiveNumber(bidPrice)) {
      warning('Validation Error', 'Please enter a valid bid price');
      return;
    }

    if (BigInt(bidPrice) < BigInt(MIN_BID_PRICE)) {
      warning('Price Too Low', `Minimum price is ${MIN_BID_PRICE} wei/sec`);
      return;
    }

    setIsCreating(true);
    try {
      // Step 1: Generate model ID and IPFS CID
      const { modelId, ipfsCid } = generateIds();
      console.log('[ModelTab] Generated Model ID:', modelId);
      console.log('[ModelTab] Generated IPFS CID:', ipfsCid);

      // Step 2: Calculate total allowance needed (user's stake + user's marketplace bid fee)
      const modelStakeWei = morToWei(stakeMor);
      const bidFeeWei = morToWei(feeMor);
      const totalAllowanceNeeded = BigInt(modelStakeWei) + BigInt(bidFeeWei);
      const totalAllowanceStr = totalAllowanceNeeded.toString();
      
      const diamondContract = networkConfig.diamondContract;
      
      console.log('[ModelTab] User stake amount:', stakeMor, 'MOR =', modelStakeWei, 'wei');
      console.log('[ModelTab] User fee amount:', feeMor, 'MOR =', bidFeeWei, 'wei');
      console.log('[ModelTab] Total allowance needed (wei):', totalAllowanceStr);

      // Step 3: Check and request approval
      const currentAllowance = await apiService.getAllowance(diamondContract);
      console.log('[ModelTab] Current allowance:', currentAllowance);

      const currentAllowanceBigInt = BigInt(currentAllowance);

      if (currentAllowanceBigInt < totalAllowanceNeeded) {
        console.log('[ModelTab] Allowance insufficient, requesting approval...');
        warning(
          'Approval Required',
          `Approving ${weiToMor(totalAllowanceStr)} MOR (${weiToMor(modelStakeWei)} for model + ${weiToMor(bidFeeWei)} for bid)...`
        );

        const transaction = await apiService.approve(diamondContract, totalAllowanceStr);
        console.log('[ModelTab] Approval transaction:', transaction);
        
        success(
          'Approval Successful - Waiting for Confirmation',
          `Transaction submitted. Waiting for blockchain confirmation...`
        );

        console.log('[ModelTab] Waiting 5 seconds for blockchain confirmation...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        success('Blockchain Confirmed', 'Proceeding with model creation...');
      } else {
        console.log('[ModelTab] Allowance sufficient, proceeding...');
      }

      // Step 4: Create model with retry logic
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t);
      let createdModel = null;
      let retryCount = 0;
      const maxRetries = 5;
      
      while (retryCount < maxRetries && !createdModel) {
        try {
          if (retryCount > 0) {
            const waitTime = retryCount * 3;
            console.log(`[ModelTab] Retry attempt ${retryCount}/${maxRetries} - waiting ${waitTime}s...`);
            warning('Retrying', `Waiting ${waitTime} seconds before retry ${retryCount}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          }
          
          createdModel = await apiService.createModel({
            id: modelId,
            name: modelName,
            ipfsID: ipfsCid,
            stake: modelStakeWei,
            fee: bidFeeWei,
            tags: tagArray,
          });
          
          console.log('[ModelTab] Model created:', createdModel);
          success('Model Created', `Model "${modelName}" created successfully`);
          break;
          
        } catch (retryError) {
          retryCount++;
          console.error(`[ModelTab] Model creation attempt ${retryCount} failed:`, retryError);
          
          if (retryCount >= maxRetries) {
            throw retryError;
          }
        }
      }

      if (!createdModel) {
        throw new Error('Failed to create model after retries');
      }

      // Step 5: Get the actual model ID from the response
      const actualModelId = createdModel.Id;
      console.log('[ModelTab] Actual Model ID from response:', actualModelId);

      // Step 6: Create bid for the new model
      console.log('[ModelTab] Creating bid for model...');
      retryCount = 0;
      let createdBid = null;

      while (retryCount < maxRetries && !createdBid) {
        try {
          if (retryCount > 0) {
            const waitTime = retryCount * 3;
            console.log(`[ModelTab] Bid retry attempt ${retryCount}/${maxRetries} - waiting ${waitTime}s...`);
            warning('Retrying Bid', `Waiting ${waitTime} seconds before retry ${retryCount}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          }

          createdBid = await apiService.createBid({
            modelID: actualModelId,
            pricePerSecond: bidPrice,
          });

          console.log('[ModelTab] Bid created:', createdBid);
          success('Bid Created', `Bid created with price ${bidPrice} wei/sec`);
          break;

        } catch (retryError) {
          retryCount++;
          console.error(`[ModelTab] Bid creation attempt ${retryCount} failed:`, retryError);
          
          if (retryCount >= maxRetries) {
            throw retryError;
          }
        }
      }

      // Success! Reset form and reload
      setModelName('');
      setStakeMor(MODEL_MIN_STAKE_MOR);
      setFeeMor(formatMor(MIN_FEE_WEI));
      setTags('LLM');
      setBidPrice(MIN_BID_PRICE);
      setCreateDialogOpen(false);
      await loadData();

    } catch (err) {
      error('Creation Failed', ApiService.parseError(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleBidAction = async () => {
    if (!apiService || !selectedModel) return;

    if (!isValidPositiveNumber(newBidPrice)) {
      warning('Validation Error', 'Please enter a valid bid price');
      return;
    }

    if (BigInt(newBidPrice) < BigInt(MIN_BID_PRICE)) {
      warning('Price Too Low', `Minimum price is ${MIN_BID_PRICE} wei/sec`);
      return;
    }

    setIsCreating(true);
    try {
      const networkConfig = getNetworkConfig();
      if (!networkConfig) {
        error('Configuration Error', 'Network configuration not available');
        return;
      }

      // Check and request approval for bid fee
      const bidFeeWei = CONTRACT_MINIMUMS.MARKETPLACE_BID_FEE;
      const diamondContract = networkConfig.diamondContract;
      
      const currentAllowance = await apiService.getAllowance(diamondContract);
      const currentAllowanceBigInt = BigInt(currentAllowance);
      const requiredBigInt = BigInt(bidFeeWei);

      if (currentAllowanceBigInt < requiredBigInt) {
        warning('Approval Required', `Approving ${weiToMor(bidFeeWei)} MOR for bid...`);
        
        await apiService.approve(diamondContract, bidFeeWei);
        success('Approval Successful - Waiting for Confirmation', 'Transaction submitted...');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        success('Blockchain Confirmed', `${isEditMode ? 'Updating' : 'Creating'} bid...`);
      }

      // Create/update bid with retry
      let retryCount = 0;
      const maxRetries = 5;
      let bid = null;

      while (retryCount < maxRetries && !bid) {
        try {
          if (retryCount > 0) {
            const waitTime = retryCount * 3;
            warning('Retrying', `Waiting ${waitTime} seconds before retry ${retryCount}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          }

          bid = await apiService.createBid({
            modelID: selectedModel.Id,
            pricePerSecond: newBidPrice,
          });

          success(
            isEditMode ? 'Bid Updated' : 'Bid Created',
            `Bid ${isEditMode ? 'updated' : 'created'} for ${selectedModel.Name}`
          );
          break;

        } catch (retryError) {
          retryCount++;
          if (retryCount >= maxRetries) throw retryError;
        }
      }

      setNewBidPrice(MIN_BID_PRICE);
      setBidDialogOpen(false);
      setSelectedModel(null);
      setIsEditMode(false);
      await loadData();

    } catch (err) {
      error(`Bid ${isEditMode ? 'Update' : 'Creation'} Failed`, ApiService.parseError(err));
    } finally {
      setIsCreating(false);
    }
  };

  const openBidDialog = (model: Model, editMode: boolean) => {
    setSelectedModel(model);
    setIsEditMode(editMode);
    if (editMode) {
      const existingBid = getMyBidForModel(model.Id);
      if (existingBid) {
        setNewBidPrice(existingBid.PricePerSecond);
      }
    } else {
      setNewBidPrice(MIN_BID_PRICE);
    }
    setBidDialogOpen(true);
  };

  const handleDeleteModelClick = (model: Model) => {
    const totalBids = getTotalBidCountForModel(model.Id);
    if (totalBids > 0) {
      warning('Cannot Delete', 'This model has active bids. Cannot delete.');
      return;
    }
    setDeleteModelConfirm({ open: true, model });
  };

  const handleDeleteModelConfirm = async () => {
    if (!apiService || !deleteModelConfirm.model) return;

    const model = deleteModelConfirm.model;
    setDeleteModelConfirm({ open: false, model: null });
    setIsCreating(true);
    try {
      await apiService.deleteModel(model.Id);
      success('Model Deleted', `Model "${model.Name}" has been removed`);
      await loadData();
    } catch (err) {
      const errMsg = ApiService.parseError(err);
      if (errMsg.includes('CORS') || errMsg.includes('Access-Control-Allow-Methods')) {
        error(
          'Server Configuration Issue',
          'The API server needs to enable DELETE method in CORS configuration. Please contact the API administrator.'
        );
      } else {
        error('Delete Failed', errMsg);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBidClick = (bid: Bid | null, modelName: string) => {
    if (!bid) return;
    setDeleteBidConfirm({ open: true, bidId: bid.Id, modelName });
  };

  const handleDeleteBidConfirm = async () => {
    if (!apiService || !deleteBidConfirm.bidId) return;

    const { bidId, modelName } = deleteBidConfirm;
    setDeleteBidConfirm({ open: false, bidId: '', modelName: '' });
    setIsCreating(true);
    try {
      await apiService.deleteBid(bidId);
      success('Bid Deleted', `Your bid for "${modelName}" has been removed`);
      await loadData();
    } catch (err) {
      const errMsg = ApiService.parseError(err);
      if (errMsg.includes('CORS') || errMsg.includes('Access-Control-Allow-Methods')) {
        error(
          'Server Configuration Issue',
          'The API server needs to enable DELETE method in CORS configuration. Please contact the API administrator.'
        );
      } else {
        error('Delete Failed', errMsg);
      }
    } finally {
      setIsCreating(false);
    }
  };

  // Collapsible model card component (mobile-friendly)
  const ModelCard = ({ 
    model, 
    bid, 
    action, 
    totalBids, 
    showDelete 
  }: { 
    model: Model; 
    bid: Bid | null; 
    action: React.ReactNode;
    totalBids?: number;
    showDelete?: boolean;
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
      <div className="border border-border/40 rounded-lg overflow-hidden hover:border-primary/40 transition-colors">
        {/* Collapsed View - Model Name Only */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left p-3 hover:bg-card/50 transition-colors flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-semibold text-sm md:text-base truncate">{model.Name}</h3>
            {bid && (
              <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/30 text-green-400 flex-shrink-0">
                Your Bid
              </Badge>
            )}
            {model.Tags?.slice(0, 2).map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs hidden sm:inline-flex">
                {tag}
              </Badge>
            ))}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Expanded View - Full Details */}
        {isExpanded && (
          <div className="px-3 pt-3 pb-3 space-y-3 border-t border-border/20">
            {/* Model Details */}
            <div className="space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground flex-shrink-0">ID:</span>
                  <code className="font-mono text-xs truncate">{shortenAddress(model.Id, 6)}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(model.Id, 'Model ID'); }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground flex-shrink-0">Owner:</span>
                  <code className="font-mono text-xs truncate">{shortenAddress(model.Owner, 6)}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 flex-shrink-0"
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(model.Owner, 'Owner Address'); }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-muted-foreground">Stake:</span> <span className="font-medium">{formatMor(model.Stake)} MOR</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fee:</span> <span className="font-medium">{formatMor(model.Fee)} MOR</span>
                </div>
                {totalBids !== undefined && (
                  <div>
                    <span className="text-muted-foreground">Bids:</span> <span className="font-medium">{totalBids}</span>
                  </div>
                )}
              </div>
              {model.Tags && model.Tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-muted-foreground">Tags:</span>
                  {model.Tags.map((tag, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Bid Info */}
            {bid && (
              <div className="bg-green-500/5 border border-green-500/20 rounded p-2">
                <p className="text-xs text-muted-foreground mb-0.5">Your Bid</p>
                <p className="text-sm font-semibold text-green-400">
                  {formatMor(bid.PricePerSecond)} MOR/sec
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2">
              {showDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteModelClick(model)}
                  disabled={isCreating}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Model
                </Button>
              )}
              <div className="flex gap-2 w-full sm:w-auto">
                {action}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Provider Registration Warning */}
      {!checkingProvider && !isRegistered && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-5 w-5" />
              Not Registered as Provider
            </CardTitle>
            <CardDescription className="text-red-300/80">
              You must register your node as a provider before you can create models and bids. 
              Please go to the <span className="font-semibold">Provider</span> tab and click "Create Provider" to register.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Model Configuration Generator */}
      <ModelConfigGenerator />

      {/* Create Model + Bid Section */}
      <Card className="border-primary/20 bg-card/50">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create New Model & Bid
              </CardTitle>
              <CardDescription>
                Register a new model and create your first bid in one step
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-primary flex-shrink-0"
                  disabled={!isRegistered}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Model & Bid
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Model & Bid</DialogTitle>
                  <DialogDescription>
                    Enter model details and your bid. The system will generate IDs and handle approvals automatically.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="modelName">Model Name *</Label>
                      <Input
                        id="modelName"
                        placeholder="Hermes-2-Theta-Llama-3-8B"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modelStake">Model Stake (MOR)</Label>
                      <Input
                        id="modelStake"
                        type="text"
                        placeholder={MODEL_MIN_STAKE_MOR}
                        value={stakeMor}
                        onChange={(e) => setStakeMor(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Minimum: {formatMor(CONTRACT_MINIMUMS.MODEL_MIN_STAKE)} MOR</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="modelFee">Marketplace Fee (MOR)</Label>
                      <Input
                        id="modelFee"
                        type="text"
                        placeholder={formatMor(MIN_FEE_WEI)}
                        value={feeMor}
                        onChange={(e) => setFeeMor(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Minimum: {formatMor(MIN_FEE_WEI)} MOR</p>
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="tags">Tags (comma-separated)</Label>
                      <Input
                        id="tags"
                        placeholder="LLM,Titan,Llama"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="bidPrice">Bid Price Per Second (wei)</Label>
                      <Input
                        id="bidPrice"
                        type="text"
                        placeholder={MIN_BID_PRICE}
                        value={bidPrice}
                        onChange={(e) => setBidPrice(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Minimum: {MIN_BID_PRICE} wei/sec</p>
                    </div>
                  </div>
                  <Button
                    onClick={handleCreateModelAndBid}
                    disabled={isCreating}
                    className="w-full"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Model & Bid...
                      </>
                    ) : (
                      'Create Model & Bid'
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Collapsible Sections */}
      <Accordion type="multiple" className="space-y-4">
        {/* Section 1: Models We Own with Our Bids */}
        {ownedModelsWithBids.length > 0 && (
          <AccordionItem value="section-1" className="border border-border/40 bg-card/50 rounded-lg overflow-hidden">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="text-left">
                  <div className="font-semibold text-base">Your Models with Bids ({ownedModelsWithBids.length})</div>
                  <div className="text-sm text-muted-foreground">Models you own and have active bids on</div>
                </div>
                <div 
                  onClick={(e) => { e.stopPropagation(); loadData(); }} 
                  className="flex-shrink-0 p-2 hover:bg-accent rounded-md cursor-pointer transition-colors"
                  role="button"
                  aria-label="Refresh models"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-2">
                {ownedModelsWithBids.map((model) => (
                  <ModelCard
                    key={model.Id}
                    model={model}
                    bid={getMyBidForModel(model.Id)}
                    action={
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteBidClick(getMyBidForModel(model.Id), model.Name)}
                          disabled={isCreating}
                          className="w-full sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Delete Bid</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openBidDialog(model, true)}
                          className="w-full sm:w-auto"
                        >
                          <Edit className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Change Bid</span>
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Section 2: Models We Don't Own but Have Bids On */}
        {notOwnedWithBids.length > 0 && (
          <AccordionItem value="section-2" className="border border-border/40 bg-card/50 rounded-lg overflow-hidden">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="text-left">
                <div className="font-semibold text-base">Other Models with Your Bids ({notOwnedWithBids.length})</div>
                <div className="text-sm text-muted-foreground">Models you have active bids on but don't own</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-2">
                {notOwnedWithBids.map((model) => (
                  <ModelCard
                    key={model.Id}
                    model={model}
                    bid={getMyBidForModel(model.Id)}
                    action={
                      <>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteBidClick(getMyBidForModel(model.Id), model.Name)}
                          disabled={isCreating}
                          className="w-full sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Delete Bid</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openBidDialog(model, true)}
                          className="w-full sm:w-auto"
                        >
                          <Edit className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Change Bid</span>
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Section 3: Our Models Without Bids */}
        {ownedModelsNoBids.length > 0 && (
          <AccordionItem value="section-3" className="border border-border/40 bg-card/50 rounded-lg overflow-hidden">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="text-left">
                <div className="font-semibold text-base">Your Models Without Bids ({ownedModelsNoBids.length})</div>
                <div className="text-sm text-muted-foreground">Models you own but haven't bid on yet</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-2">
                {ownedModelsNoBids.map((model) => {
                  const totalBids = getTotalBidCountForModel(model.Id);
                  return (
                    <ModelCard
                      key={model.Id}
                      model={model}
                      bid={null}
                      totalBids={totalBids}
                      showDelete={totalBids === 0}
                      action={
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openBidDialog(model, false)}
                          className="w-full sm:w-auto"
                        >
                          <Plus className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Add Bid</span>
                        </Button>
                      }
                    />
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Section 4: Available Models (Not Owned, No Bids from Me) */}
        {notOwnedNoBids.length > 0 && (
          <AccordionItem value="section-4" className="border border-border/40 bg-card/50 rounded-lg overflow-hidden">
            <AccordionTrigger className="px-6 hover:no-underline">
              <div className="text-left">
                <div className="font-semibold text-base">Available Models ({notOwnedNoBids.length})</div>
                <div className="text-sm text-muted-foreground">Active models from other providers available for bidding</div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="space-y-2">
                {notOwnedNoBids.map((model) => (
                  <ModelCard
                    key={model.Id}
                    model={model}
                    bid={null}
                    action={
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => openBidDialog(model, false)}
                        className="w-full sm:w-auto"
                      >
                        <Plus className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Add Bid</span>
                      </Button>
                    }
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Empty State */}
      {!isLoading && models.length === 0 && (
        <Card className="border-border/40 bg-card/50">
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              No models available. Create your first model to get started!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bid Dialog (Add or Change) */}
      <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? 'Change Bid' : 'Add Bid'} for {selectedModel?.Name}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? 'Update your bid price per second' : 'Enter your bid price per second'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="newBidPrice">Price Per Second (wei)</Label>
              <Input
                id="newBidPrice"
                type="text"
                placeholder={MIN_BID_PRICE}
                value={newBidPrice}
                onChange={(e) => setNewBidPrice(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minimum: {MIN_BID_PRICE} wei/sec</p>
            </div>
            <Button
              onClick={handleBidAction}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditMode ? 'Updating' : 'Creating'} Bid...
                </>
              ) : (
                isEditMode ? 'Update Bid' : 'Create Bid'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Model Confirmation Dialog */}
      <ConfirmDialog
        open={deleteModelConfirm.open}
        onOpenChange={(open) => setDeleteModelConfirm({ ...deleteModelConfirm, open })}
        onConfirm={handleDeleteModelConfirm}
        title="Delete Model"
        description={`Are you sure you want to delete model "${deleteModelConfirm.model?.Name}"? This action cannot be undone.`}
        confirmText="Delete Model"
        cancelText="Cancel"
        variant="destructive"
      />

      {/* Delete Bid Confirmation Dialog */}
      <ConfirmDialog
        open={deleteBidConfirm.open}
        onOpenChange={(open) => setDeleteBidConfirm({ ...deleteBidConfirm, open })}
        onConfirm={handleDeleteBidConfirm}
        title="Delete Bid"
        description={`Are you sure you want to delete your bid for "${deleteBidConfirm.modelName}"? This action cannot be undone.`}
        confirmText="Delete Bid"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
