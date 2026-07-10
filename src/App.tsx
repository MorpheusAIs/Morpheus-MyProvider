import { useState } from 'react';
import { useApi } from '@/lib/ApiContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import ApiConfig from '@/components/ApiConfig';
import WalletDisplay from '@/components/WalletDisplay';
import Bootstrap from '@/components/Bootstrap';
import OnboardingWizard from '@/components/OnboardingWizard';
import ProviderTab from '@/components/ProviderTab';
import ModelTab from '@/components/ModelTab';
import NotificationManager from '@/components/NotificationManager';
import type { DeployPath } from '@/lib/deployPaths';

// Get version from package.json at build time
const version = __APP_VERSION__;

function App() {
  const { isConfigured } = useApi();
  const [deployPath, setDeployPath] = useState<DeployPath>('secretvm');
  const [bootstrapOpen, setBootstrapOpen] = useState(false);

  return (
    <main className="min-h-screen">
      <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-6">
        {/* Header */}
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
            Onboard a provider: look up models on active.mor.org, craft config in-session, deploy
            (SecretVM / container / release / source), then connect and bid.
          </p>
        </div>

        <OnboardingWizard
          deployPath={deployPath}
          onDeployPathChange={setDeployPath}
          onOpenBootstrap={() => setBootstrapOpen(true)}
        />

        <Bootstrap
          open={bootstrapOpen}
          onOpenChange={setBootstrapOpen}
          deployPath={deployPath}
        />

        <ApiConfig />

        {isConfigured && <WalletDisplay />}

        {isConfigured && (
          <Card className="border-zinc-700/50 bg-zinc-900/95 backdrop-blur-sm shadow-lg">
            <CardContent className="pt-6">
              <Tabs defaultValue="provider" className="w-full">
                <TabsList className="w-full border-b border-zinc-700">
                  <TabsTrigger value="provider">Provider</TabsTrigger>
                  <TabsTrigger value="model">Models & Bids</TabsTrigger>
                </TabsList>
                <TabsContent value="provider" className="mt-6">
                  <ProviderTab />
                </TabsContent>
                <TabsContent value="model" className="mt-6">
                  <ModelTab />
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
