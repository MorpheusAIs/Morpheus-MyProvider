'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { ApiService } from '@/lib/apiService';
import type { Provider, ProviderStatus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2, Trash2, CheckCircle, XCircle, AlertCircle, Copy } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { weiToMor, formatMor, morToWei, isValidPositiveNumber } from '@/lib/utils';
import { CONTRACT_MINIMUMS } from '@/lib/constants';

/**
 * ProviderTab manages provider CRUD operations
 * - List all providers from blockchain
 * - Create new provider or update stake
 * - Validation for minimum stake requirements
 */
export default function ProviderTab() {
  const { apiService, walletBalance, getNetworkConfig } = useApi();
  const { success, error, warning } = useNotification();
  
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<Provider | null>(null);
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [isCheckingEndpoint, setIsCheckingEndpoint] = useState(false);
  const [endpointStatus, setEndpointStatus] = useState<'unchecked' | 'checking' | 'reachable' | 'unreachable' | 'unverifiable'>('unchecked');
  const [diagnosticMessage, setDiagnosticMessage] = useState<string>('');
  
  // Form state
  const [endpoint, setEndpoint] = useState('');
  const [stakeMor, setStakeMor] = useState(formatMor(CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE));
  
  // Confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const PROVIDER_MIN_STAKE_MOR = formatMor(CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE);

  useEffect(() => {
    if (apiService) {
      loadProviders();
      loadProviderStatus();
    }
  }, [apiService]);

  // Update form when providers or wallet changes
  useEffect(() => {
    if (walletBalance?.address && providers.length > 0) {
      const myProvider = providers.find(
        p => p.Address.toLowerCase() === walletBalance.address.toLowerCase() && !p.IsDeleted
      );
      
      if (myProvider) {
        setCurrentProvider(myProvider);
        setEndpoint(myProvider.Endpoint);
        // Don't pre-fill stake - keep it at minimum to avoid doubling when updating
        // User's current stake is shown as "Current: X MOR" in the helper text
      } else {
        setCurrentProvider(null);
      }
    }
  }, [walletBalance, providers]);

  const loadProviders = async () => {
    if (!apiService) return;
    
    setIsLoading(true);
    try {
      const data = await apiService.getProviders();
      setProviders(data);
    } catch (err) {
      error('Failed to Load', ApiService.parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const loadProviderStatus = async () => {
    if (!apiService) return;
    
    try {
      const status = await apiService.getProviderStatus();
      setProviderStatus(status);
      console.log('[ProviderTab] Provider status:', status);
    } catch (err) {
      console.error('[ProviderTab] Failed to load provider status:', err);
    }
  };

  const checkEndpointReachability = async () => {
    if (!endpoint.trim()) {
      warning('Validation Error', 'Please enter an endpoint to check');
      return;
    }

    // Validate endpoint format (should be host:port, no http://)
    const endpointPattern = /^[a-zA-Z0-9.-]+:\d+$/;
    if (!endpointPattern.test(endpoint)) {
      warning('Invalid Format', 'Endpoint must be in format: hostname:port or ip:port (e.g., morpheus.example.com:3333)');
      return;
    }

    setIsCheckingEndpoint(true);
    setEndpointStatus('checking');
    setDiagnosticMessage('');
    try {
      const result = await apiService!.checkEndpointReachability(endpoint);
      if (result.isOpen) {
        setEndpointStatus('reachable');
        success('Port Open ✓', 'Your provider endpoint port is accessible from the internet');
      } else {
        const diagMsg = result.diagnostics?.message || 'The port is not accessible. Check your firewall, port forwarding, and ensure your node is running.';
        
        // Check if this is a mixed content issue (can't verify, not actually unreachable)
        if (diagMsg.includes('Cannot verify HTTP port from HTTPS')) {
          setEndpointStatus('unverifiable');
          setDiagnosticMessage(diagMsg);
          warning('Cannot Verify Port', 'Browser security prevents verification. Ensure your port is open before proceeding.');
        } else {
          setEndpointStatus('unreachable');
          setDiagnosticMessage(diagMsg);
          warning('Port Closed', diagMsg);
        }
      }
    } catch (err) {
      setEndpointStatus('unreachable');
      const errorMsg = err instanceof Error ? err.message : 'Could not verify endpoint reachability';
      setDiagnosticMessage(errorMsg);
      error('Validation Error', errorMsg);
    } finally {
      setIsCheckingEndpoint(false);
    }
  };

  const handleCreateProvider = async () => {
    if (!apiService || !walletBalance) return;

    const networkConfig = getNetworkConfig();
    if (!networkConfig) {
      error('Configuration Error', 'Network configuration not available');
      return;
    }

    // Validation
    if (!endpoint) {
      warning('Validation Error', 'Please enter a provider endpoint');
      return;
    }

    if (endpointStatus !== 'reachable' && endpointStatus !== 'unverifiable') {
      warning('Validation Error', 'Please verify your endpoint is accessible by clicking the "Check" button before creating or updating your provider.');
      return;
    }

    if (!isValidPositiveNumber(stakeMor)) {
      warning('Validation Error', 'Please enter a valid stake amount');
      return;
    }

    const stakeNum = parseFloat(stakeMor);
    if (stakeNum < parseFloat(PROVIDER_MIN_STAKE_MOR)) {
      warning(
        'Insufficient Stake',
        `Minimum provider stake is ${PROVIDER_MIN_STAKE_MOR} MOR`
      );
      return;
    }

    setIsCreating(true);
    try {
      // Convert user's entered stake to wei
      const stakeWei = morToWei(stakeMor);
      const diamondContract = networkConfig.diamondContract;
      // Approval amount should match the stake amount the user wants to add
      const approvalAmountWei = stakeWei;
      
      console.log('[ProviderTab] Checking allowance for Diamond contract:', diamondContract);
      console.log('[ProviderTab] User stake amount:', stakeMor, 'MOR =', stakeWei, 'wei');
      console.log('[ProviderTab] Approval amount (wei):', approvalAmountWei);

      // Step 1: Check current allowance
      const currentAllowance = await apiService.getAllowance(diamondContract);
      console.log('[ProviderTab] Current allowance:', currentAllowance);

      const currentAllowanceBigInt = BigInt(currentAllowance);
      const requiredAllowanceBigInt = BigInt(approvalAmountWei);

      // Step 2: If allowance is insufficient, request approval for the user's stake amount
      if (currentAllowanceBigInt < requiredAllowanceBigInt) {
        console.log('[ProviderTab] Allowance insufficient, requesting approval for', stakeMor, 'MOR...');
        warning(
          'Approval Required',
          `Approving Diamond contract to spend ${stakeMor} MOR tokens...`
        );

        const transaction = await apiService.approve(diamondContract, approvalAmountWei);
        console.log('[ProviderTab] Approval transaction:', transaction);
        
        success(
          'Approval Successful - Waiting for Confirmation',
          `Transaction submitted. Waiting for blockchain confirmation...`
        );

        // Wait for blockchain confirmation before proceeding
        console.log('[ProviderTab] Waiting 5 seconds for blockchain confirmation...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        success('Blockchain Confirmed', 'Proceeding with provider update...');
      } else {
        console.log('[ProviderTab] Allowance sufficient, proceeding with provider update');
      }

      // Step 3: Check if provider already exists
      const existingProvider = providers.find(
        p => p.Address.toLowerCase() === walletBalance.address.toLowerCase()
      );

      if (existingProvider) {
        warning(
          'Updating Existing Provider',
          'This wallet is already a provider. Updating stake...'
        );
      }

      // Step 4: Create/update provider with retry logic
      let provider = null;
      let retryCount = 0;
      const maxRetries = 5;
      
      while (retryCount < maxRetries && !provider) {
        try {
          if (retryCount > 0) {
            const waitTime = retryCount * 3; // 3, 6, 9, 12, 15 seconds
            console.log(`[ProviderTab] Retry attempt ${retryCount}/${maxRetries} - waiting ${waitTime}s...`);
            warning(
              'Retrying',
              `Waiting ${waitTime} seconds before retry ${retryCount}/${maxRetries}...`
            );
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          }
          
          provider = await apiService.createProvider({
            endpoint,
            stake: stakeWei,
          });
          
          success(
            'Provider Created',
            `Provider ${existingProvider ? 'updated' : 'created'} successfully`
          );
          break;
          
        } catch (retryError) {
          retryCount++;
          console.error(`[ProviderTab] Attempt ${retryCount} failed:`, retryError);
          
          if (retryCount >= maxRetries) {
            throw retryError; // Re-throw on final failure
          }
        }
      }
      
      // Reset form and reload
      setEndpoint('');
      setStakeMor(PROVIDER_MIN_STAKE_MOR);
      setEndpointStatus('unchecked');
      await loadProviders();
      await loadProviderStatus();
    } catch (err) {
      error('Provider Creation Failed', ApiService.parseError(err));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProviderClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteProviderConfirm = async () => {
    if (!apiService || !currentProvider) return;

    setShowDeleteConfirm(false);
    setIsDeleting(true);
    try {
      warning('Deleting Provider', 'Removing provider registration...');
      
      // Call the DELETE endpoint with the provider address
      await apiService.deleteProvider(currentProvider.Address);
      
      success('Provider Deleted', 'Your provider registration has been removed');
      setEndpoint('');
      setStakeMor(PROVIDER_MIN_STAKE_MOR);
      setEndpointStatus('unchecked');
      await loadProviders();
      await loadProviderStatus();
    } catch (err) {
      error('Delete Failed', ApiService.parseError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const isMyProvider = (provider: Provider) => {
    if (!walletBalance?.address || !provider.Address) return false;
    return walletBalance.address.toLowerCase() === provider.Address.toLowerCase();
  };

  return (
    <div className="space-y-6">
      {/* Provider Status Info */}
      {providerStatus && (
        <Card className={`border ${
          providerStatus.isRegistered 
            ? 'border-green-500/30 bg-green-500/5' 
            : 'border-blue-500/30 bg-blue-500/5'
        }`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              {providerStatus.isRegistered ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-green-400">Provider Registered</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-400">Not Registered as Provider</span>
                </>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {providerStatus.isRegistered ? (
                <>
                  Your wallet is registered as a provider. You can update your endpoint or stake, or manage your models and bids.
                </>
              ) : (
                <>
                  Register your node as a provider to start serving models and earning rewards.
                </>
              )}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Create/Update Provider Form */}
      <Card className="border-gray-700 bg-gray-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {providerStatus?.isRegistered ? 'Update Provider' : 'Add Node as a Provider'}
          </CardTitle>
          <CardDescription>
            {providerStatus?.isRegistered ? (
              <span className="text-green-400">
                ✓ Update your endpoint or increase your stake below.
              </span>
            ) : (
              `Register as a provider to start serving models (Min stake: ${PROVIDER_MIN_STAKE_MOR} MOR)`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Endpoint Field with Validation */}
            <div className="space-y-2">
              <Label htmlFor="endpoint">Provider Endpoint</Label>
              <div className="flex gap-2">
                <Input
                  id="endpoint"
                  type="text"
                  placeholder="morpheus.example.com:3333 or 192.168.1.100:3333"
                  value={endpoint}
                  onChange={(e) => {
                    setEndpoint(e.target.value);
                    setEndpointStatus('unchecked');
                  }}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={checkEndpointReachability}
                  disabled={isCheckingEndpoint || !endpoint.trim()}
                  className="min-w-[100px]"
                >
                  {isCheckingEndpoint ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Checking
                    </>
                  ) : endpointStatus === 'reachable' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-400" />
                      Open
                    </>
                  ) : endpointStatus === 'unreachable' ? (
                    <>
                      <XCircle className="h-4 w-4 mr-2 text-red-400" />
                      Check
                    </>
                  ) : endpointStatus === 'unverifiable' ? (
                    <>
                      <AlertCircle className="h-4 w-4 mr-2 text-blue-400" />
                      Unverifiable
                    </>
                  ) : (
                    'Check Port'
                  )}
                </Button>
              </div>
              {currentProvider ? (
                <p className="text-xs text-blue-400">
                  Current: {currentProvider.Endpoint}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Format: hostname:port or ip:port (no http://). Your proxy endpoint must be publicly accessible on port 3333.
                </p>
              )}
              {endpointStatus === 'unreachable' && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3">
                  <p className="text-xs text-yellow-400 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{diagnosticMessage || 'Port not accessible from internet. Check firewall rules, port forwarding, and ensure your node is running.'}</span>
                  </p>
                </div>
              )}
              {endpointStatus === 'unverifiable' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3">
                  <p className="text-xs text-blue-400 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{diagnosticMessage || 'Cannot verify port from HTTPS page due to browser security. Please ensure your port is open and forwarded correctly before proceeding.'}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Stake Field */}
            <div className="space-y-2">
              <Label htmlFor="stake">Stake (MOR)</Label>
              <Input
                id="stake"
                type="text"
                placeholder={PROVIDER_MIN_STAKE_MOR}
                value={stakeMor}
                onChange={(e) => setStakeMor(e.target.value)}
              />
              {currentProvider ? (
                <p className="text-xs text-blue-400">
                  Current stake: {formatMor(currentProvider.Stake)} MOR. Enter amount to add (min {formatMor(CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE)} MOR)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Minimum: {formatMor(CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE)} MOR. You can stake more for higher priority.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            {endpointStatus !== 'reachable' && endpointStatus !== 'unverifiable' && endpoint.trim() && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-md p-3">
                <p className="text-xs text-orange-400 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Please verify your endpoint is accessible by clicking the "Check" button before creating or updating your provider.</span>
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleCreateProvider}
                disabled={isCreating || !apiService || (endpointStatus !== 'reachable' && endpointStatus !== 'unverifiable')}
                className="flex-1"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {providerStatus?.isRegistered ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {providerStatus?.isRegistered ? 'Update Provider' : 'Create Provider'}
                  </>
                )}
              </Button>
            
            {providerStatus?.isRegistered && (
              <Button
                variant="destructive"
                onClick={handleDeleteProviderClick}
                disabled={isDeleting || !apiService}
                className="min-w-[140px]"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Provider
                  </>
                )}
              </Button>
            )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteProviderConfirm}
        title="Delete Provider"
        description="Are you sure you want to delete your provider registration? This action cannot be undone."
        confirmText="Delete Provider"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}

