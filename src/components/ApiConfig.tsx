'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Check, X, AlertTriangle } from 'lucide-react';
import { getNetworkConfig } from '@/lib/constants';

/**
 * ApiConfig component handles API connection configuration
 * - Base URL
 * - Username
 * - Password
 * - Tests connection and authenticates
 */
export default function ApiConfig() {
  const { isConfigured, clearConfig, network: currentNetwork, chain: currentChain, configValidation } = useApi();
  const { configure } = useApi();
  const { success, error, warning } = useNotification();
  
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
        // Normalize URL for parsing (add http:// if missing)
        const urlToParse = baseUrl.startsWith('http://') || baseUrl.startsWith('https://') 
          ? baseUrl 
          : `http://${baseUrl}`;
        const url = new URL(urlToParse);
        setShowMixedContentWarning(url.protocol === 'http:');
      } catch {
        setShowMixedContentWarning(false);
      }
    } else {
      setShowMixedContentWarning(false);
    }
  }, [baseUrl, isHttpsPage]);

  const normalizeBaseUrl = (url: string): string => {
    // Trim whitespace
    url = url.trim();
    
    // If URL already has http:// or https://, keep it as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Otherwise, prepend http://
    return `http://${url}`;
  };

  const handleConnect = async () => {
    if (!baseUrl || !username || !password) {
      error('Validation Error', 'Please fill in all fields');
      return;
    }

    // Normalize the base URL (add http:// if no protocol specified)
    const normalizedUrl = normalizeBaseUrl(baseUrl);

    console.log('[Connect] Attempting to connect and auto-detect chain/network...');
    console.log('[Connect] Original URL:', baseUrl);
    console.log('[Connect] Normalized URL:', normalizedUrl);
    console.log('[Connect] Username:', username);

    setIsLoading(true);
    try {
      await configure({ baseUrl: normalizedUrl, username, password });
      
      // Success! Chain and network were auto-detected
      if (currentChain && currentNetwork) {
        const networkConfig = getNetworkConfig(currentChain, currentNetwork);
        success(
          'Connected & Auto-Detected', 
          `Connected to ${networkConfig.name} Proxy Router`
        );
      } else {
        success('Connected', 'Successfully connected to Proxy Router');
      }
    } catch (err) {
      console.log('[Connect] Caught error:', err);
      
      if (!(err instanceof Error)) {
        error('Connection Error', 'An unexpected error occurred');
        return;
      }
      
      const errorMessage = err.message;
      console.log('[Connect] Error message:', errorMessage);
      
      // Handle specific error types
      switch (errorMessage) {
        case 'HEALTHCHECK_FAILED':
          error('Connection Failed', 'Cannot reach API endpoint. Check URL and network connectivity.');
          break;
        
        case 'CONFIG_FETCH_FAILED':
          error('Configuration Error', 'Connected to node but unable to retrieve configuration. Check API permissions.');
          break;
        
        case 'AUTH_FAILED':
          error('Authentication Failed', 'Cannot authenticate with provided credentials. Check username and password.');
          break;
        
        case 'CHAIN_NOT_RECOGNIZED':
          error(
            'Unknown Chain Configuration',
            'Could not recognize the blockchain configuration from your node. This may be an unsupported chain or network.'
          );
          break;
        
        default:
          // Generic error handler
          if (errorMessage.includes('Network Error') || errorMessage.includes('ERR_')) {
            error('Connection Failed', 'Cannot reach API endpoint. Check URL and network connectivity.');
          } else {
            error('Connection Error', errorMessage);
          }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    // Clear API config (session storage and state)
    clearConfig();
    
    // Note: We don't clear form fields - user can reconnect with same credentials
    success('Disconnected', 'API connection cleared');
  };

  return (
    <Card className="border-gray-700 bg-gray-800/50">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>Connect to Node</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
        <form 
          onSubmit={(e) => { 
            e.preventDefault(); 
            if (!isConfigured && !isLoading && baseUrl && username && password) {
              handleConnect();
            }
          }} 
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="baseUrl">Proxy Router API Base URL</Label>
            <Input
              id="baseUrl"
              type="text"
              placeholder="localhost:8082 or myprovider.domain.io:8082"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={isConfigured}
            />
            <p className="text-xs text-muted-foreground">
              Protocol (http://) will be added automatically. Use https:// explicitly if needed.
            </p>
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
                type="submit"
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Connecting...' : 'Connect'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleDisconnect}
                variant="destructive"
                className="w-full"
              >
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

