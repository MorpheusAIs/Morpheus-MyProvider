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
import { ExternalLink, HelpCircle } from 'lucide-react';

/**
 * Explains ETH_NODE_ADDRESS and links to free Alchemy / Infura signup.
 * Typical provider envs use HTTPS JSON-RPC (not WSS).
 */
export default function EthNodeHelper() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-blue-400">
          <HelpCircle className="h-3.5 w-3.5 mr-1" />
          What is this?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ETH_NODE_ADDRESS (Base RPC)</DialogTitle>
          <DialogDescription>
            Your proxy-router needs a reliable Base JSON-RPC endpoint. Public free endpoints are
            rate-limited — use your own Alchemy / Infura key.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            <Label className="text-foreground">
              Recommended (HTTPS — matches most provider .env files)
            </Label>
          </p>
          <pre className="text-xs bg-muted/40 p-2 rounded overflow-x-auto">
            {`https://base-mainnet.g.alchemy.com/v2/<YOUR_API_KEY>`}
          </pre>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Create a free account at{' '}
              <a
                href="https://www.alchemy.com/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Alchemy <ExternalLink className="h-3 w-3" />
              </a>{' '}
              or{' '}
              <a
                href="https://www.infura.io/"
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                Infura <ExternalLink className="h-3 w-3" />
              </a>
              .
            </li>
            <li>
              Create an app on <strong>Base Mainnet</strong> (chain id 8453).
            </li>
            <li>
              Paste the <strong>HTTPS</strong> URL into ETH_NODE_ADDRESS (typical provider envs use{' '}
              <code className="text-[10px]">https://</code>, not <code className="text-[10px]">wss://</code>).
            </li>
          </ol>
          <p className="text-xs">
            Docs:{' '}
            <a
              href="https://nodedocs.mor.org/reference/env-proxy-router"
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline"
            >
              env-proxy-router
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
