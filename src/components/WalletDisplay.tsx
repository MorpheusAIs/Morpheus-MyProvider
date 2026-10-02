'use client';

import { useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Copy, RefreshCw } from 'lucide-react';
import { formatMor, weiToEth, shortenAddress } from '@/lib/utils';
import { useNotification } from '@/lib/NotificationContext';

/**
 * Compact chain + wallet strip (matches Connected bar density).
 */
export default function WalletDisplay() {
  const { isConfigured, walletBalance, refreshWallet, chain, network, configValidation, getNetworkConfig } =
    useApi();
  const { success } = useNotification();

  useEffect(() => {
    if (isConfigured && !walletBalance) {
      void refreshWallet();
    }
  }, [isConfigured, walletBalance, refreshWallet]);

  if (!isConfigured) return null;

  const net = getNetworkConfig();
  const chainId = configValidation?.actualConfig?.chainId ?? (net ? Number(net.chainId) : null);
  const diamond =
    configValidation?.actualConfig?.diamondContract || net?.diamondContract || '';
  const morToken =
    configValidation?.actualConfig?.morTokenContract || net?.morTokenContract || '';
  const version = configValidation?.actualConfig?.Version;

  const morBal = walletBalance?.balance ? formatMor(walletBalance.balance) : '…';
  const ethBal = walletBalance?.ethBalance ? weiToEth(walletBalance.ethBalance) : '…';
  const morNum = walletBalance?.balance
    ? parseFloat(formatMor(walletBalance.balance).replace(/,/g, ''))
    : 0;
  const ethNum = walletBalance?.ethBalance ? parseFloat(weiToEth(walletBalance.ethBalance)) : 0;
  const lowMor = walletBalance != null && morNum < 1;
  const lowEth = walletBalance != null && ethNum < 0.001;

  const chainLabel = chain === 'arbitrum' ? 'Arbitrum' : chain === 'base' ? 'Base' : '—';
  const netLabel = network === 'mainnet' ? 'Mainnet' : network === 'testnet' ? 'Testnet' : '—';

  const copy = (label: string, value: string) => {
    if (!value) return;
    void navigator.clipboard.writeText(value);
    success('Copied', label);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-950/50 px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
          <Badge
            variant="outline"
            className="border-blue-500/40 text-blue-200 bg-blue-500/10 text-[10px] font-medium"
          >
            {chainLabel} · {netLabel}
            {chainId != null ? ` · ${chainId}` : ''}
          </Badge>

          {version && (
            <span className="text-muted-foreground whitespace-nowrap">node {version}</span>
          )}

          <span className="text-emerald-300 font-semibold whitespace-nowrap">{morBal} MOR</span>
          <span className="text-sky-300 font-semibold whitespace-nowrap">{ethBal} ETH</span>

          {walletBalance?.address && (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-mono text-zinc-300 hover:text-foreground"
              title={walletBalance.address}
              onClick={() => copy('Wallet address', walletBalance.address)}
            >
              {shortenAddress(walletBalance.address, 4)}
              <Copy className="h-3 w-3 opacity-70" />
            </button>
          )}

          {diamond && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-foreground"
              title={diamond}
              onClick={() => copy('Diamond / inference contract', diamond)}
            >
              Diamond {shortenAddress(diamond, 4)}
              <Copy className="h-3 w-3 opacity-60" />
            </button>
          )}

          {morToken && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-foreground"
              title={morToken}
              onClick={() => copy('MOR token', morToken)}
            >
              MOR {shortenAddress(morToken, 4)}
              <Copy className="h-3 w-3 opacity-60" />
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => void refreshWallet()}
          title="Refresh wallet balance"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {(lowMor || lowEth) && (
        <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] text-red-200">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {lowMor && lowEth && 'Low MOR and ETH — need ≥1 MOR and ~0.001 ETH for provider ops.'}
            {lowMor && !lowEth && 'Low MOR — need ≥1 MOR for stake / bids.'}
            {!lowMor && lowEth && 'Low ETH — need ~0.001 ETH for gas.'}
          </span>
        </div>
      )}
    </div>
  );
}
