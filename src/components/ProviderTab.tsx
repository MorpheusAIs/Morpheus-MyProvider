'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { ApiService } from '@/lib/apiService';
import type { Provider } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';
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
  const [currentProvider, setCurrentProvider] = useState<Provider | null>(null);
  
  // Form state
  const [endpoint, setEndpoint] = useState('');
  const [stakeMor, setStakeMor] = useState(formatMor(CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE));

  const PROVIDER_MIN_STAKE_MOR = formatMor(CONTRACT_MINIMUMS.PROVIDER_MIN_STAKE);

  useEffect(() => {
    if (apiService) {
      loadProviders();
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
      await loadProviders();
    } catch (err) {
      error('Provider Creation Failed', ApiService.parseError(err));
    } finally {
      setIsCreating(false);
    }
  };

  const isMyProvider = (provider: Provider) => {
    if (!walletBalance?.address || !provider.Address) return false;
    return walletBalance.address.toLowerCase() === provider.Address.toLowerCase();
  };

  return (
    <div className="space-y-6">
      {/* Create Provider Form */}
      <Card className="border-gray-700 bg-gray-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            {currentProvider ? 'Update Provider' : 'Create Provider'}
          </CardTitle>
          <CardDescription>
            {currentProvider ? (
              <span className="text-green-400">
                ✓ You are registered as a provider. Update your endpoint or stake below.
              </span>
            ) : (
              `Register as a provider or update your stake (Min: ${PROVIDER_MIN_STAKE_MOR} MOR)`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endpoint">Provider Endpoint</Label>
              <Input
                id="endpoint"
                type="text"
                placeholder="morpheus.titan.io:3333"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
              />
              {currentProvider ? (
                <p className="text-xs text-blue-400">
                  Current: {currentProvider.Endpoint}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Your provider endpoint (host:port)
                </p>
              )}
            </div>
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
          <Button
            onClick={handleCreateProvider}
            disabled={isCreating || !apiService}
            className="w-full"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create / Update Provider'
            )}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}

