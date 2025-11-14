'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Check, X, Network, AlertTriangle } from 'lucide-react';
import { NETWORKS } from '@/lib/constants';
import type { Network as NetworkType } from '@/lib/types';

/**
 * ApiConfig component handles API connection configuration
 * - Base URL
 * - Username
 * - Password
 * - Tests connection and authenticates
 */
export default function ApiConfig() {
  const { isConfigured, clearConfig, network: currentNetwork } = useApi();
  const { configure } = useApi();
  const { success, error } = useNotification();
  
  const [network, setNetwork] = useState<NetworkType>('mainnet');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMixedContentWarning, setShowMixedContentWarning] = useState(false);
  const [isHttpsPage, setIsHttpsPage] = useState(false);

  // Check if page is loaded over HTTPS
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsHttpsPage(window.location.protocol === 'https:');
    }
  }, []);

  // Check for mixed content when URL changes
  useEffect(() => {
    if (isHttpsPage && baseUrl) {
      try {
        const url = new URL(baseUrl);
        setShowMixedContentWarning(url.protocol === 'http:');
      } catch {
        setShowMixedContentWarning(false);
      }
    } else {
      setShowMixedContentWarning(false);
    }
  }, [baseUrl, isHttpsPage]);

  // Update network selection
  const handleNetworkChange = (newNetwork: NetworkType) => {
    setNetwork(newNetwork);
  };

  const handleConnect = async () => {
    if (!baseUrl || !username || !password) {
      error('Validation Error', 'Please fill in all fields');
      return;
    }

    console.log('[Connect] Attempting to connect...');
    console.log('[Connect] Network:', network);
    console.log('[Connect] Base URL:', baseUrl);
    console.log('[Connect] Username:', username);

    setIsLoading(true);
    try {
      const result = await configure({ baseUrl, username, password, network });
      if (result) {
        success('Connected', `Successfully connected to ${NETWORKS[network].name} Proxy Router`);
      } else {
        error('Connection Failed', 'Unable to connect to API. Please check your credentials and API URL.');
      }
    } catch (err) {
      console.error('[Connect] Error:', err);
      error('Connection Error', 'Failed to establish connection. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearConfig();
    success('Disconnected', 'API connection cleared');
  };

  return (
    <Card className="border-gray-700 bg-gray-800/50">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>API Configuration</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {currentNetwork && (
              <Badge variant="outline" className="font-mono text-xs">
                <Network className="h-3 w-3 mr-1" />
                {NETWORKS[currentNetwork].name}
              </Badge>
            )}
            {isConfigured ? (
              <Badge variant="default" className="bg-green-600 text-xs">
                <Check className="h-3 w-3 mr-1" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-gray-600 text-xs">
                <X className="h-3 w-3 mr-1" /> Not Connected
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Connect to the Morpheus Proxy Router API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="network">Network</Label>
          <select
            id="network"
            value={currentNetwork || network}
            onChange={(e) => handleNetworkChange(e.target.value as NetworkType)}
            disabled={isConfigured}
            className="flex h-10 w-full rounded-md border border-input bg-input px-3 py-2 text-base text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="mainnet">🟢 Mainnet (Production)</option>
            <option value="testnet">🟡 Testnet (Development)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Diamond: {NETWORKS[currentNetwork || network].diamondContract.substring(0, 10)}...
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="baseUrl">Proxy Router API Base URL</Label>
          <Input
            id="baseUrl"
            type="text"
            placeholder="http://myprovider.domain.io:port or ip_address:port"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            disabled={isConfigured}
          />
        </div>

        {showMixedContentWarning && (
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <p className="text-sm font-semibold text-yellow-500">Mixed Content Warning: HTTP API on HTTPS Page</p>
                <p className="text-sm text-muted-foreground">
                  This page is loaded over HTTPS, but your API endpoint uses HTTP. Modern browsers block this for security reasons.
                </p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">To resolve this, choose one option:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><span className="font-semibold">Enable HTTPS on your Proxy Router</span> (Recommended for production)</li>
                    <li><span className="font-semibold">Run Locally:</span> <code className="bg-black/30 px-1 py-0.5 rounded">npm install && npm run dev</code> then access at <code className="bg-black/30 px-1 py-0.5 rounded">http://localhost:3000</code></li>
                    <li><span className="font-semibold">Disable Mixed Content:</span> Click the shield icon 🛡️ in the address bar and select "Load unsafe scripts" (Chromium browsers only, per-session)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isConfigured}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isConfigured}
              autoComplete="current-password"
            />
          </div>
        </div>
        <div className="flex gap-2">
          {!isConfigured ? (
            <Button
              onClick={handleConnect}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </Button>
          ) : (
            <Button
              onClick={handleDisconnect}
              variant="destructive"
              className="w-full"
            >
              Disconnect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

