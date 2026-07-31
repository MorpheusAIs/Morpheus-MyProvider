import { useState } from 'react';
import { useApi } from '@/lib/ApiContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ConnectedNodeBar from '@/components/ConnectedNodeBar';
import WalletDisplay from '@/components/WalletDisplay';
import Bootstrap from '@/components/Bootstrap';
import OnboardingWizard from '@/components/OnboardingWizard';
import ProviderTab from '@/components/ProviderTab';
import ModelTab from '@/components/ModelTab';
import NotificationManager from '@/components/NotificationManager';
import type { DeployPath } from '@/lib/deployPaths';
import { Rocket, Wrench } from 'lucide-react';

const version = __APP_VERSION__;

function App() {
  const { isConfigured } = useApi();
  const [deployPath, setDeployPath] = useState<DeployPath>('secretvm');
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  /** Connected operators stay in fleet mode unless they open bootstrap. */
  const [showBootstrap, setShowBootstrap] = useState(false);
  /** Unconfigured: connect-first; opt into full SecretVM bootstrap. */
  const [showNewBootstrap, setShowNewBootstrap] = useState(false);

  const inOperatorMode = isConfigured && !showBootstrap;
  const showOnboarding = !isConfigured || showBootstrap;

  return (
    <main className="min-h-screen">
      <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
        {inOperatorMode ? (
          <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/images/mor_mark_white.png"
                alt=""
                className="h-9 w-9 object-contain opacity-90 shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate">
                  MyProvider
                </h1>
                <p className="text-xs text-muted-foreground">
                  Operator console — bids, health, and MODELS_CONFIG
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                setShowNewBootstrap(true);
                setShowBootstrap(true);
              }}
            >
              <Rocket className="h-3.5 w-3.5 mr-1.5" />
              New provider bootstrap
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4 py-8">
            <div className="flex items-center justify-center gap-4">
              <div className="relative w-12 h-12">
                <img
                  src="/images/mor_mark_white.png"
                  alt="Morpheus Logo"
                  className="w-full h-full object-contain opacity-90"
                />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
                Morpheus MyProvider
              </h1>
            </div>
            <p className="text-muted-foreground text-lg max-w-3xl mx-auto">
              {isConfigured
                ? 'Bootstrap a new node, or return to your operator console.'
                : showNewBootstrap
                  ? 'Bootstrap a new SecretVM provider — or go back to connect an existing node.'
                  : 'Connect to an existing provider, or bootstrap a new SecretVM node.'}
            </p>
            {isConfigured && (
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-black font-semibold"
                onClick={() => setShowBootstrap(false)}
              >
                <Wrench className="h-3.5 w-3.5 mr-1.5" />
                Back to operator console
              </Button>
            )}
          </div>
        )}

        {showOnboarding && (
          <OnboardingWizard
            deployPath={deployPath}
            onDeployPathChange={setDeployPath}
            onOpenBootstrap={() => setBootstrapOpen(true)}
            onEnteredOperator={() => setShowBootstrap(false)}
            showNewBootstrap={showNewBootstrap || (isConfigured && showBootstrap)}
            onShowNewBootstrapChange={setShowNewBootstrap}
          />
        )}

        <Bootstrap
          open={bootstrapOpen}
          onOpenChange={setBootstrapOpen}
          deployPath={deployPath}
        />

        {isConfigured && <ConnectedNodeBar />}
        {isConfigured && <WalletDisplay />}

        {isConfigured && (
          <Card className="border-zinc-700/50 bg-zinc-900/95 backdrop-blur-sm shadow-lg">
            <CardContent className="pt-6">
              <Tabs defaultValue="model" className="w-full">
                <TabsList className="w-full border-b border-zinc-700">
                  <TabsTrigger value="model">Fleet (models & bids)</TabsTrigger>
                  <TabsTrigger value="provider">Provider</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="model"
                  className="mt-6 data-[state=inactive]:hidden"
                  forceMount
                >
                  <ModelTab />
                </TabsContent>
                <TabsContent
                  value="provider"
                  className="mt-6 data-[state=inactive]:hidden"
                  forceMount
                >
                  <ProviderTab />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="fixed bottom-4 right-4 text-xs text-white/40 font-mono flex flex-col items-end gap-1">
        <a
          href="/llms.txt"
          className="text-white/50 hover:text-primary underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Agents: /llms.txt
        </a>
        <span>v{version}</span>
      </div>

      <NotificationManager />
    </main>
  );
}

export default App;
