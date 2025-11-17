'use client';

import { useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Wallet, RefreshCw, Copy, Network, AlertCircle } from 'lucide-react';
import { formatMor, weiToEth, shortenAddress } from '@/lib/utils';
import { useNotification } from '@/lib/NotificationContext';
import { CHAINS } from '@/lib/constants';

/**
 * WalletDisplay shows both wallet info and node configuration after connection
 */
export default function WalletDisplay() {
  const { isConfigured, walletBalance, refreshWallet, chain, network, configValidation } = useApi();
  const { success } = useNotification();

  useEffect(() => {
    if (isConfigured && !walletBalance) {
      refreshWallet();
    }
  }, [isConfigured, walletBalance, refreshWallet]);

  const handleCopyAddress = () => {
    if (walletBalance?.address) {
      navigator.clipboard.writeText(walletBalance.address);
      success('Copied', 'Wallet address copied to clipboard');
    }
  };

  return (
    <Card className="border-gray-700 bg-gray-800/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-blue-400" />
              <CardTitle>Node Configuration & Wallet</CardTitle>
            </div>
            {configValidation?.actualConfig?.Version && (
              <p className="text-xs text-muted-foreground">
                Morpheus Lumerin Node {configValidation.actualConfig.Version}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshWallet}
            title="Refresh wallet balance"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Node Configuration */}
          {chain && network && configValidation?.actualConfig && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-blue-400">✓ Node Configuration Verified</p>
              
              <div className="space-y-3">
                {/* Chain and Network on same line */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Chain</Label>
                    <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm">
                      {chain === 'arbitrum' ? '⚡ Arbitrum' : '🔵 Base'}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Network (Chain ID: {configValidation.actualConfig.chainId})</Label>
                    <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm">
                      {network === 'mainnet' ? '🟢 Mainnet' : '🟡 Testnet'}
                    </div>
                  </div>
                </div>
                
                {/* Inference Contract and MOR Token on same line */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Inference Contract</p>
                      <p className="font-mono text-xs text-foreground truncate">
                        {configValidation.actualConfig.diamondContract.substring(0, 10)}...{configValidation.actualConfig.diamondContract.substring(configValidation.actualConfig.diamondContract.length - 8)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 flex-shrink-0 h-8"
                      onClick={() => {
                        navigator.clipboard.writeText(configValidation.actualConfig?.diamondContract || '');
                        success('Copied', 'Inference contract address copied to clipboard');
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">MOR Token</p>
                      <p className="font-mono text-xs text-foreground truncate">
                        {configValidation.actualConfig.morTokenContract.substring(0, 10)}...{configValidation.actualConfig.morTokenContract.substring(configValidation.actualConfig.morTokenContract.length - 8)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 flex-shrink-0 h-8"
                      onClick={() => {
                        navigator.clipboard.writeText(configValidation.actualConfig?.morTokenContract || '');
                        success('Copied', 'MOR token address copied to clipboard');
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Column - Wallet Information */}
          {walletBalance ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-green-400">💰 Wallet Information</p>
              
              <div className="space-y-3">
                {/* MOR and ETH balances as read-only text boxes */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>MOR Balance</Label>
                    <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-bold text-green-400">
                      {walletBalance.balance ? formatMor(walletBalance.balance) : '0'} MOR
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>ETH Balance</Label>
                    <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-bold text-blue-400">
                      {walletBalance.ethBalance ? weiToEth(walletBalance.ethBalance) : '0'} ETH
                    </div>
                  </div>
                </div>
                
                {/* Low Balance Warning */}
                {(() => {
                  const morBalance = walletBalance.balance ? parseFloat(formatMor(walletBalance.balance).replace(/,/g, '')) : 0;
                  const ethBalance = walletBalance.ethBalance ? parseFloat(weiToEth(walletBalance.ethBalance)) : 0;
                  const lowMor = morBalance < 1;
                  const lowEth = ethBalance < 0.001;
                  
                  if (lowMor || lowEth) {
                    return (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-red-400">Insufficient Balance</p>
                            <p className="text-xs text-red-300">
                              {lowMor && lowEth && 'You need at least 1 MOR and 0.001 ETH to register as a provider and add models/bids.'}
                              {lowMor && !lowEth && 'You need at least 1 MOR to register as a provider and add models/bids.'}
                              {!lowMor && lowEth && 'You need at least 0.001 ETH to cover transaction costs for registration.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                
                {/* Wallet Address - full width to align with contract addresses above */}
                {walletBalance.address && (
                  <div className="flex items-center justify-between p-2 rounded-md bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Wallet Address</p>
                      <p className="font-mono text-xs text-foreground truncate">
                        {walletBalance.address.substring(0, 10)}...{walletBalance.address.substring(walletBalance.address.length - 8)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 flex-shrink-0 h-8"
                      onClick={handleCopyAddress}
                      title="Copy address"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-green-400">💰 Wallet Information</p>
              <p className="text-sm text-gray-400">Loading wallet...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

