'use client';

import { useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, RefreshCw, Copy } from 'lucide-react';
import { formatMor, weiToEth, shortenAddress } from '@/lib/utils';
import { useNotification } from '@/lib/NotificationContext';

/**
 * WalletDisplay shows the current wallet address and balance
 * Provides refresh and copy functionality
 */
export default function WalletDisplay() {
  const { isConfigured, walletBalance, refreshWallet } = useApi();
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

  if (!isConfigured) {
    return (
      <Card className="border-gray-700 bg-gray-800/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-gray-400" />
            <CardTitle>Wallet</CardTitle>
          </div>
          <CardDescription>Connect API to view wallet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-gray-700 bg-gray-800/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-400" />
            <CardTitle>Wallet</CardTitle>
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
      <CardContent className="space-y-3">
        {walletBalance ? (
          <>
            {walletBalance.address && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Address</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-sm px-2 py-0.5">
                    {shortenAddress(walletBalance.address)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleCopyAddress}
                    title="Copy address"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">MOR Balance</p>
                <p className="text-base font-bold text-green-400">
                  {walletBalance.balance ? formatMor(walletBalance.balance) : '0'} MOR
                </p>
              </div>
              {walletBalance.ethBalance && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ETH Balance</p>
                  <p className="text-base font-bold text-blue-400">
                    {weiToEth(walletBalance.ethBalance)} ETH
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400">Loading wallet...</p>
        )}
      </CardContent>
    </Card>
  );
}

