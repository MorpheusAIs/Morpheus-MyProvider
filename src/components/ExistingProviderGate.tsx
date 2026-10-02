'use client';

import { useEffect, useRef, useState } from 'react';
import { useApi } from '@/lib/ApiContext';
import { useNotification } from '@/lib/NotificationContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FolderOpen, Link2, Loader2, Rocket } from 'lucide-react';
import {
  readSecretsFile,
  secretsFileCanConnect,
} from '@/lib/secretsFile';
import {
  saveProviderSecretsSession,
  secretsSessionFromFile,
} from '@/lib/providerSession';
import { normalizeSecretVmPublicUrl } from '@/lib/secretvmSecrets';

interface ExistingProviderGateProps {
  onConnected?: () => void;
  onStartBootstrap?: () => void;
}

/**
 * Default landing for operators who already have a node:
 * connect with URL + admin, or Load secrets JSON and jump to fleet.
 */
export default function ExistingProviderGate({
  onConnected,
  onStartBootstrap,
}: ExistingProviderGateProps) {
  const { configure, isConfigured } = useApi();
  const { success, error, warning } = useNotification();

  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [showMixedContentWarning, setShowMixedContentWarning] = useState(false);
  const [isHttpsPage, setIsHttpsPage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsHttpsPage(window.location.protocol === 'https:');
    }
  }, []);

  useEffect(() => {
    if (isHttpsPage && baseUrl) {
      try {
        const urlToParse =
          baseUrl.startsWith('http://') || baseUrl.startsWith('https://')
            ? baseUrl
            : `http://${baseUrl}`;
        setShowMixedContentWarning(new URL(urlToParse).protocol === 'http:');
      } catch {
        setShowMixedContentWarning(false);
      }
    } else {
      setShowMixedContentWarning(false);
    }
  }, [baseUrl, isHttpsPage]);

  const normalizeBaseUrl = (url: string): string => {
    url = url.trim();
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `http://${url}`;
  };

  const stashMinimalSession = (url: string, user: string, pass: string) => {
    saveProviderSecretsSession({
      deployPath: 'secretvm',
      walletPrivateKey: '',
      ethNodeAddress: '',
      webPublicUrl: url,
      adminUser: user,
      adminPass: pass,
    });
  };

  const handleConnectError = (err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : '';
    switch (errorMessage) {
      case 'HEALTHCHECK_FAILED':
        error('Connection Failed', 'Cannot reach API. Check URL and that the node is up.');
        break;
      case 'CONFIG_FETCH_FAILED':
        error('Configuration Error', 'Reached node but could not read /config.');
        break;
      case 'AUTH_FAILED':
        error('Authentication Failed', 'Check admin username and password.');
        break;
      case 'CHAIN_NOT_RECOGNIZED':
        error('Unknown chain', 'Node chain/Diamond not recognized by MyProvider.');
        break;
      default:
        if (errorMessage.includes('Network Error') || errorMessage.includes('ERR_')) {
          error('Connection Failed', 'Cannot reach API endpoint.');
        } else {
          error('Connection Error', errorMessage || 'Unexpected error');
        }
    }
  };

  const handleConnect = async () => {
    if (!baseUrl.trim() || !username.trim() || !password) {
      error('Validation Error', 'URL, username, and password are required');
      return;
    }
    const normalizedUrl = normalizeBaseUrl(baseUrl);
    setIsLoading(true);
    try {
      await configure({
        baseUrl: normalizedUrl,
        username: username.trim(),
        password,
      });
      stashMinimalSession(normalizedUrl, username.trim(), password);
      success('Connected', 'Opening operator console');
      onConnected?.();
    } catch (err) {
      handleConnectError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadFile = async (file: File) => {
    setLoadingFile(true);
    try {
      const data = await readSecretsFile(file);
      saveProviderSecretsSession(secretsSessionFromFile(data));

      if (!secretsFileCanConnect(data)) {
        warning(
          'File loaded — incomplete',
          'Need WEB_PUBLIC_URL + admin password to connect. Start bootstrap to finish, or connect manually below.'
        );
        onStartBootstrap?.();
        return;
      }

      const url = normalizeSecretVmPublicUrl(data.webPublicUrl);
      await configure({
        baseUrl: url,
        username: (data.adminUser || 'admin').trim(),
        password: data.adminPass,
      });
      success('Connected from file', `${url} — opening operator console`);
      onConnected?.();
    } catch (err) {
      if (err instanceof SyntaxError || (err instanceof Error && /version/i.test(err.message))) {
        error('Invalid file', err instanceof Error ? err.message : 'Could not parse JSON');
      } else {
        handleConnectError(err);
      }
    } finally {
      setLoadingFile(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (isConfigured) return null;

  return (
    <Card className="border-emerald-500/30 bg-zinc-900/95 shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Link2 className="h-5 w-5 text-emerald-400" />
          Connect to your provider
        </CardTitle>
        <CardDescription>
          Already running a node? Use the HTTPS admin URL and cookie credentials — no bootstrap
          required. Optional: load a saved secrets JSON to connect and restore MODELS_CONFIG keys.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
          <p className="text-xs text-emerald-100/90 max-w-xl">
            Have <code className="text-[10px]">morpheus-provider-secrets.json</code>? Load it to
            connect and jump straight to the fleet console.
          </p>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleLoadFile(f);
              }}
            />
            <Button
              type="button"
              size="sm"
              className="h-8 bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
              disabled={loadingFile}
              onClick={() => fileRef.current?.click()}
            >
              {loadingFile ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5 mr-1" />
              )}
              Load &amp; connect
            </Button>
          </div>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isLoading) void handleConnect();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="gate-url" className="text-xs">
              Node admin URL
            </Label>
            <Input
              id="gate-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-vm.secretvm… or host:8082"
              className="h-9 text-sm"
              autoComplete="url"
            />
            <p className="text-[10px] text-muted-foreground">
              SecretVM: public HTTPS URL. Protocol added as http:// if omitted — use https:// for
              TEE.
            </p>
          </div>

          {showMixedContentWarning && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-400" />
              <span>
                This page is HTTPS but the URL is HTTP — browsers may block it. Prefer the SecretVM
                HTTPS URL, or run MyProvider locally over HTTP.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gate-user" className="text-xs">
                Admin user
              </Label>
              <Input
                id="gate-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-9 text-sm"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gate-pass" className="text-xs">
                Admin password
              </Label>
              <Input
                id="gate-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 text-sm"
                autoComplete="current-password"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting…
              </>
            ) : (
              'Connect to operator console'
            )}
          </Button>
        </form>

        <div className="border-t border-zinc-800 pt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            New node? Bootstrap SecretVM (wallet key → deploy → hostname → models).
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onStartBootstrap}>
            <Rocket className="h-3.5 w-3.5 mr-1.5" />
            New provider bootstrap
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
