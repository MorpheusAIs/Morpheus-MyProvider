'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Rocket, AlertCircle } from 'lucide-react';
import { useNotification } from '@/lib/NotificationContext';
import { getNetworkConfig } from '@/lib/constants';
import type { Chain, Network } from '@/lib/types';

export default function Bootstrap() {
  const [isOpen, setIsOpen] = useState(false);
  const [chain, setChain] = useState<Chain>('arbitrum');
  const [network, setNetwork] = useState<Network>('testnet');
  const [walletPrivateKey, setWalletPrivateKey] = useState('');
  const [webPublicUrl, setWebPublicUrl] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showEnvFile, setShowEnvFile] = useState(false);

  const { success, error: showError } = useNotification();

  const generateEnvFile = () => {
    if (!walletPrivateKey.trim()) {
      showError('Missing Field', 'Please provide your wallet private key');
      return;
    }

    if (!webPublicUrl.trim()) {
      showError('Missing Field', 'Please provide your public URL');
      return;
    }

    if (!adminPassword.trim()) {
      showError('Missing Field', 'Please provide an admin password for API access');
      return;
    }

    setShowEnvFile(true);
  };

  const handleCopyEnv = () => {
    const envContent = getEnvFileContent();
    navigator.clipboard.writeText(envContent);
    success('Copied!', 'ENV file content copied to clipboard');
  };

  const getEnvFileContent = (): string => {
    const networkConfig = getNetworkConfig(chain, network);

    return `# Morpheus Proxy Router Configuration
# Chain: ${chain === 'arbitrum' ? 'Arbitrum' : 'Base'}
# Network: ${network === 'mainnet' ? 'Mainnet' : 'Testnet'}

# Blockchain Configuration
ETH_NODE_CHAIN_ID=${networkConfig.chainId}
BLOCKSCOUT_API_URL=${networkConfig.blockscoutApiUrl}
DIAMOND_CONTRACT_ADDRESS=${networkConfig.diamondContract}
MOR_TOKEN_ADDRESS=${networkConfig.morTokenContract}

# Wallet Configuration
WALLET_PRIVATE_KEY=${walletPrivateKey}

# Web Configuration
WEB_PUBLIC_URL=${webPublicUrl}
WEB_ADDRESS=0.0.0.0:8082

# Proxy Configuration
PROXY_ADDRESS=0.0.0.0:3333

# Logging Configuration
LOG_IS_PROD=false
LOG_LEVEL_APP=info
LOG_JSON=true
LOG_COLOR=true

# Environment
ENVIRONMENT=production

# Admin Authentication (username is always 'admin')
COOKIE_CONTENT=admin:${adminPassword}

# Models Configuration (Add this after registering your models)
# After you've registered your provider and models on the blockchain,
# use the "Model Configuration Sync" section to generate this content in HEREDOC format
# Example (uncomment and replace with your generated config):
# MODELS_CONFIG_CONTENT=$(cat <<'EOF'
# {
#     "$schema": "https://raw.githubusercontent.com/MorpheusAIs/Morpheus-Lumerin-Node/a719073670adb17de6282b12d1852d39d629cb6e/proxy-router/internal/config/models-config-schema.json",
#     "models": [
#         {
#             "modelId": "0x...",
#             "modelName": "YourModelName",
#             "apiType": "openai",
#             "apiUrl": "http://your-model-endpoint/v1/chat/completions",
#             "concurrentSlots": 8,
#             "capacityPolicy": "simple"
#         }
#     ]
# }
# EOF
# )
`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Card className="border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer transition-colors">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Rocket className="h-6 w-6 text-purple-400" />
              <div>
                <CardTitle>Bootstrap New Node</CardTitle>
                <CardDescription>
                  Haven't set up your Proxy Router yet? Start here.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Bootstrap Your Morpheus Proxy Router
          </DialogTitle>
          <DialogDescription>
            Generate the ENV configuration file needed to start your node
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!showEnvFile ? (
            <>
              {/* Configuration Form */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Chain</Label>
                    <Select
                      value={chain}
                      onValueChange={(value) => setChain(value as Chain)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arbitrum">⚡ Arbitrum</SelectItem>
                        <SelectItem value="base">🔵 Base</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Network</Label>
                    <Select
                      value={network}
                      onValueChange={(value) => setNetwork(value as Network)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mainnet">🟢 Mainnet (Production)</SelectItem>
                        <SelectItem value="testnet">🟡 Testnet (Development)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Wallet Private Key *</Label>
                  <Input
                    type="password"
                    placeholder="0x..."
                    value={walletPrivateKey}
                    onChange={(e) => setWalletPrivateKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your wallet's private key. Keep this secure and never share it.
                  </p>
                  <p className="text-xs text-blue-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    This information stays on your machine - it's only used to generate the ENV file locally
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Public URL *</Label>
                  <Input
                    type="text"
                    placeholder="myprovider.example.com:8082 or your-ip-address:8082"
                    value={webPublicUrl}
                    onChange={(e) => setWebPublicUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: hostname:port or ip:port (no http://). This is the API management endpoint (port 8082), not the proxy routing port (3333).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Admin Password *</Label>
                  <Input
                    type="password"
                    placeholder="Enter a secure password for API access"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    This password will be used to connect to your node's API (username is always "admin")
                  </p>
                  <p className="text-xs text-blue-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    This information stays on your machine - it's only used to generate the ENV file locally
                  </p>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2">
                    <p className="font-semibold text-blue-400">What happens next?</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>We'll generate your ENV configuration file</li>
                      <li>You'll copy it to your server</li>
                      <li>Run the Docker container with this configuration</li>
                      <li>Come back here to connect and manage your provider</li>
                    </ol>
                  </div>
                </div>
              </div>

              <Button onClick={generateEnvFile} className="w-full" size="lg">
                Generate ENV File
              </Button>
            </>
          ) : (
            <>
              {/* ENV File Display */}
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-md p-4">
                  <p className="text-sm text-green-400 font-semibold">
                    ✓ Configuration Generated!
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Copy the ENV file below and follow the setup instructions.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>ENV File Content</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyEnv}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-muted/30 border border-border rounded-md p-4 text-xs whitespace-pre-wrap break-words overflow-y-auto max-h-96">
                    {getEnvFileContent()}
                  </pre>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-4">
                  <div className="text-sm space-y-3">
                    <p className="font-semibold text-blue-400">Setup Instructions:</p>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>
                        Save the ENV content above to a file named <code className="bg-muted px-1 rounded">.env</code>
                      </li>
                      <li>
                        Pull the latest Docker image:
                        <pre className="bg-muted/50 mt-1 p-2 rounded text-xs">
                          docker pull ghcr.io/morpheusais/morpheus-lumerin-node:latest
                        </pre>
                      </li>
                      <li>
                        Run the container with your ENV file:
                        <pre className="bg-muted/50 mt-1 p-2 rounded text-xs">
                          docker run -d \<br/>
                          {'  '}--name morpheus-proxy-router \<br/>
                          {'  '}--env-file .env \<br/>
                          {'  '}-p 3333:3333 \<br/>
                          {'  '}-p 8082:8082 \<br/>
                          {'  '}ghcr.io/morpheusais/morpheus-lumerin-node:latest
                        </pre>
                      </li>
                      <li>
                        Verify the node is running:
                        <pre className="bg-muted/50 mt-1 p-2 rounded text-xs">
                          curl http://localhost:8082/healthcheck
                        </pre>
                      </li>
                      <li>
                        Once healthy, connect using the API Configuration section above!
                      </li>
                    </ol>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowEnvFile(false)}
                    className="flex-1"
                  >
                    Generate Another
                  </Button>
                  <Button
                    onClick={() => setIsOpen(false)}
                    className="flex-1"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

