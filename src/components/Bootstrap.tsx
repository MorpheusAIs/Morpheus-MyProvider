'use client';

import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Copy, Rocket, AlertCircle, CheckCircle2, Wallet, Network as NetworkIcon, Server, HelpCircle, Download, ExternalLink, ChevronRight } from 'lucide-react';
import { useNotification } from '@/lib/NotificationContext';
import { getNetworkConfig } from '@/lib/constants';
import type { Chain, Network } from '@/lib/types';

interface GitHubRelease {
  tag_name: string;
  name: string;
  prerelease: boolean;
  published_at: string;
}

export default function Bootstrap() {
  const [isOpen, setIsOpen] = useState(false);
  const [chain, setChain] = useState<Chain>('arbitrum');
  const [network, setNetwork] = useState<Network>('testnet');
  const [walletPrivateKey, setWalletPrivateKey] = useState('');
  const [webPublicUrl, setWebPublicUrl] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [proxyPort, setProxyPort] = useState('3333');
  const [apiPort, setApiPort] = useState('8082');
  const [showEnvFile, setShowEnvFile] = useState(false);
  const [showPrereqs, setShowPrereqs] = useState(true);
  const [binaryPlatform, setBinaryPlatform] = useState('linux-x86_64');
  const [selectedVersion, setSelectedVersion] = useState('v5.6.0');
  const [availableReleases, setAvailableReleases] = useState<GitHubRelease[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchReleases();
    }
  }, [isOpen]);

  const fetchReleases = async () => {
    setIsLoadingReleases(true);
    try {
      const response = await fetch(
        'https://api.github.com/repos/MorpheusAIs/Morpheus-Lumerin-Node/releases?per_page=30'
      );
      const releases: GitHubRelease[] = await response.json();
      
      // Get latest stable release (no prerelease flag, no suffix)
      const latestStable = releases.find(r => !r.prerelease && !r.tag_name.includes('-'));
      
      // Get latest test release (has -test suffix)
      const latestTest = releases.find(r => r.tag_name.includes('-test'));
      
      // Order: Latest Stable first, then Latest Test
      const filteredReleases: GitHubRelease[] = [];
      if (latestStable) filteredReleases.push(latestStable);
      if (latestTest) filteredReleases.push(latestTest);
      
      setAvailableReleases(filteredReleases);
      
      // Set the latest stable as default
      if (latestStable) {
        setSelectedVersion(latestStable.tag_name);
      }
    } catch (err) {
      console.error('Failed to fetch releases:', err);
      // Fallback to hardcoded version
      setAvailableReleases([{ 
        tag_name: 'v5.6.0', 
        name: 'v5.6.0',
        prerelease: false,
        published_at: new Date().toISOString()
      }]);
    } finally {
      setIsLoadingReleases(false);
    }
  };
  
  const getBinaryDownloadUrl = (platform: string, version: string) => {
    const versionNum = version.startsWith('v') ? version.substring(1) : version;
    return `https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases/download/${version}/${platform}-morpheus-router-${versionNum}`;
  };

  const getPlatformName = (platform: string) => {
    const names: Record<string, string> = {
      'linux-x86_64': 'Linux (x86_64)',
      'linux-aarch64': 'Linux (ARM64)',
      'darwin-x86_64': 'macOS (Intel)',
      'darwin-aarch64': 'macOS (Apple Silicon)',
      'mac-x64': 'macOS (Intel)',
      'mac-arm64': 'macOS (Apple Silicon)'
    };
    return names[platform] || platform;
  };

  const { success, error: showError } = useNotification();

  const generateEnvFile = () => {
    // Allow generation even with empty fields - they'll get placeholders
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
# Chain: Arbitrum
# Network: ${network === 'mainnet' ? 'Mainnet' : 'Testnet'}

# Blockchain Configuration
ETH_NODE_CHAIN_ID=${networkConfig.chainId}
BLOCKSCOUT_API_URL=${networkConfig.blockscoutApiUrl}
DIAMOND_CONTRACT_ADDRESS=${networkConfig.diamondContract}
MOR_TOKEN_ADDRESS=${networkConfig.morTokenContract}

# Wallet Configuration
WALLET_PRIVATE_KEY=${walletPrivateKey.trim() || '<FILL_ME_IN_YOUR_PRIVATE_KEY>'}

# Web Configuration
WEB_PUBLIC_URL=${webPublicUrl.trim() || '<FILL_ME_IN_YOUR_PUBLIC_URL>'}
WEB_ADDRESS=0.0.0.0:${apiPort || '8082'}

# Proxy Configuration
PROXY_ADDRESS=0.0.0.0:${proxyPort || '3333'}

# Logging Configuration
LOG_IS_PROD=false
LOG_LEVEL_APP=info
LOG_JSON=true
LOG_COLOR=true

# Environment
ENVIRONMENT=production

# Admin Authentication (username is always 'admin')
COOKIE_CONTENT=admin:${adminPassword.trim() || '<FILL_ME_IN_YOUR_ADMIN_PASSWORD>'}

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
          {!showPrereqs && !showEnvFile && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-yellow-400">Configuration Guide</p>
                  <div className="text-muted-foreground space-y-2">
                    <p>
                      Complete the form below and click <span className="font-medium text-foreground">Next</span> to generate your ENV file and review startup instructions.
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li><span className="font-medium text-foreground">Select your blockchain network</span> - Choose the chain and network type (mainnet or testnet)</li>
                      <li><span className="font-medium text-foreground">Enter your credentials</span> - Provide your wallet private key and admin password</li>
                      <li><span className="font-medium text-foreground">Configure network ports</span> - Set the ports for proxy routing and API management</li>
                      <li><span className="font-medium text-foreground">Specify your public URL</span> - Enter how your node will be accessed externally</li>
                    </ul>
                    <div className="bg-yellow-500/20 border border-yellow-500/40 rounded p-2 mt-3">
                      <p className="text-xs text-yellow-300 flex items-start gap-1">
                        <HelpCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        <span>
                          <span className="font-medium">Tip:</span> Don't have all the information yet? No problem! 
                          Leave any field blank and the generated ENV file will include{' '}
                          <code className="bg-muted px-1 rounded text-yellow-200">&lt;FILL_ME_IN&gt;</code> placeholders 
                          that you can fill in later on your server.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {showPrereqs ? (
            <>
              {/* Prerequisites Section */}
              <div className="space-y-4">
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-md p-4">
                  <h3 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Before You Begin - Prerequisites Checklist
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please ensure you have the following ready before bootstrapping your node:
                  </p>

                  <div className="space-y-4">
                    {/* Prereq 1: LLM Compute Infrastructure */}
                    <div className="bg-card/50 border border-border/40 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Rocket className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-2">
                          <h4 className="font-semibold text-base">1. LLM Service to Offer</h4>
                          <p className="text-sm text-muted-foreground">
                            You need access to running AI model(s) that you'll offer to the Morpheus network. Your model must be accessible from the proxy-router via network address (FQDN:port or IP:port).
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Example endpoint format:</span>{' '}
                            <code className="bg-muted px-1 rounded">http://mymodel.domain.com:5464/v1/chat/completions</code>
                          </p>
                          
                          <Accordion type="single" collapsible className="mt-2">
                            <AccordionItem value="llm-platforms" className="border-purple-500/20">
                              <AccordionTrigger className="text-xs text-purple-300 hover:text-purple-200 py-2 hover:no-underline">
                                <span className="flex items-center gap-1">
                                  <HelpCircle className="h-3 w-3" />
                                  Where to host AI models (reference links)
                                </span>
                              </AccordionTrigger>
                              <AccordionContent className="text-xs space-y-2 pt-2">
                                <p className="text-muted-foreground mb-2">Common options (external guides):</p>
                                <ul className="space-y-1.5 text-muted-foreground">
                                  <li className="flex items-start gap-2">
                                    <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                    <span>
                                      <span className="font-medium text-foreground">Own Hardware:</span> Run Ollama or llama.cpp locally
                                      <a 
                                        href="https://ollama.ai/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                      >
                                        Ollama <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                      {' / '}
                                      <a 
                                        href="https://github.com/ggerganov/llama.cpp" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline inline-flex items-center gap-0.5"
                                      >
                                        llama.cpp <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                    <span>
                                      <span className="font-medium text-foreground">Cloud GPU:</span> RunPod, Vast.ai, or similar
                                      <a 
                                        href="https://www.runpod.io/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                      >
                                        RunPod <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                    <span>
                                      <span className="font-medium text-foreground">Decentralized:</span> Akash Network GPU marketplace
                                      <a 
                                        href="https://akash.network/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                      >
                                        Akash <ExternalLink className="h-2.5 w-2.5" />
                                      </a>
                                    </span>
                                  </li>
                                </ul>
                                <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 mt-2">
                                  <p className="text-xs text-blue-400 flex items-start gap-1">
                                    <HelpCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                    <span>
                                      <span className="font-medium">Note:</span> You'll configure your model details (name, type, endpoint URL) later in the Model Configuration section.
                                    </span>
                                  </p>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </div>
                      </div>
                    </div>

                    {/* Prereq 2: Wallet */}
                    <div className="bg-card/50 border border-border/40 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Wallet className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-2">
                          <h4 className="font-semibold text-base">2. Funded Wallet & Private Key</h4>
                          <p className="text-sm text-muted-foreground">
                            You need a wallet funded with both ETH (for gas fees) and MOR tokens on the blockchain network you plan to use. 
                          </p>
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mt-2">
                            <p className="text-xs text-yellow-400 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              <span className="font-medium">Important:</span> Your private key will never leave your machine. It's only used to generate the configuration file locally.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Prereq 3: Network & Host Setup */}
                    <div className="bg-card/50 border border-border/40 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <NetworkIcon className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-3">
                          <h4 className="font-semibold text-base">3. Network & Host Configuration</h4>
                          <p className="text-sm text-muted-foreground">
                            The proxy-router software requires two ports on your host (typically 3333 and 8082):
                          </p>
                          
                          <div className="space-y-3 ml-2">
                            {/* Port 3333 - Critical */}
                            <div className="bg-red-500/10 border border-red-500/30 rounded p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="h-4 w-4 text-red-400" />
                                <p className="font-medium text-red-400 text-sm">Port 3333 - Proxy Routing (CRITICAL)</p>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                <span className="font-medium text-red-300">Must be publicly accessible from the internet.</span> This is where users connect to use your AI models. 
                                Without internet access to this port, your node cannot serve requests.
                              </p>
                              
                              <Accordion type="single" collapsible className="mt-2">
                                <AccordionItem value="port-3333-help" className="border-red-500/20">
                                  <AccordionTrigger className="text-xs text-red-300 hover:text-red-200 py-2 hover:no-underline">
                                    <span className="flex items-center gap-1">
                                      <HelpCircle className="h-3 w-3" />
                                      How to make port 3333 publicly accessible
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent className="text-xs space-y-2 pt-2">
                                    <p className="text-muted-foreground mb-2">Common methods (external guides):</p>
                                    <ul className="space-y-1.5 text-muted-foreground">
                                      <li className="flex items-start gap-2">
                                        <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                        <span>
                                          <span className="font-medium text-foreground">Port Forwarding:</span> Configure your router to forward port 3333
                                          <a 
                                            href="https://portforward.com/" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                          >
                                            Guide <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                        <span>
                                          <span className="font-medium text-foreground">Cloud Provider:</span> Use security groups/firewall rules (AWS, GCP, Azure)
                                          <a 
                                            href="https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                          >
                                            AWS <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                        <span>
                                          <span className="font-medium text-foreground">Tunneling Service:</span> Use ngrok or similar for testing
                                          <a 
                                            href="https://ngrok.com/docs" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                          >
                                            ngrok <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                        <span>
                                          <span className="font-medium text-foreground">Reverse Proxy:</span> Nginx/Caddy with public IP
                                          <a 
                                            href="https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                          >
                                            Nginx <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </span>
                                      </li>
                                    </ul>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </div>

                            {/* Port 8082 - Important */}
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Server className="h-4 w-4 text-blue-400" />
                                <p className="font-medium text-blue-400 text-sm">Port 8082 - API Management (Recommended HTTPS)</p>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                Admin/management interface for registering providers, models, and bids. Ideally accessible via HTTPS from the internet 
                                (protected by your admin password), but can be local network only if needed.
                              </p>
                              <p className="text-xs text-muted-foreground mb-2">
                                <span className="font-medium text-blue-300">Public URL Examples:</span><br/>
                                • With TLS/Load Balancer: <code className="bg-muted px-1 rounded">https://proxyapi.yourhost.com</code><br/>
                                • Direct: <code className="bg-muted px-1 rounded">http://your-ip:8082</code> or <code className="bg-muted px-1 rounded">http://hostname:8082</code>
                              </p>
                              
                              <Accordion type="single" collapsible className="mt-2">
                                <AccordionItem value="port-8082-help" className="border-blue-500/20">
                                  <AccordionTrigger className="text-xs text-blue-300 hover:text-blue-200 py-2 hover:no-underline">
                                    <span className="flex items-center gap-1">
                                      <HelpCircle className="h-3 w-3" />
                                      How to setup HTTPS/TLS for port 8082
                                    </span>
                                  </AccordionTrigger>
                                  <AccordionContent className="text-xs space-y-2 pt-2">
                                    <p className="text-muted-foreground mb-2">Common HTTPS setup methods (external guides):</p>
                                    <ul className="space-y-1.5 text-muted-foreground">
                                      <li className="flex items-start gap-2">
                                        <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                        <span>
                                          <span className="font-medium text-foreground">Let's Encrypt + Nginx:</span> Free SSL certificates with reverse proxy
                                          <a 
                                            href="https://certbot.eff.org/instructions" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                          >
                                            Certbot <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                        <span>
                                          <span className="font-medium text-foreground">Caddy Server:</span> Automatic HTTPS with zero configuration
                                          <a 
                                            href="https://caddyserver.com/docs/automatic-https" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                          >
                                            Caddy <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                        <span>
                                          <span className="font-medium text-foreground">Cloud Load Balancer:</span> AWS ALB, GCP Load Balancer, Cloudflare
                                          <a 
                                            href="https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                          >
                                            AWS <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </span>
                                      </li>
                                      <li className="flex items-start gap-2">
                                        <ChevronRight className="h-3 w-3 flex-shrink-0 mt-0.5 text-purple-400" />
                                        <span>
                                          <span className="font-medium text-foreground">Home Router + DuckDNS:</span> Dynamic DNS + port 443 forwarding
                                          <a 
                                            href="https://www.duckdns.org/" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:underline ml-1 inline-flex items-center gap-0.5"
                                          >
                                            DuckDNS <ExternalLink className="h-2.5 w-2.5" />
                                          </a>
                                        </span>
                                      </li>
                                    </ul>
                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mt-2">
                                      <p className="text-xs text-yellow-400 flex items-start gap-1">
                                        <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                        <span>
                                          <span className="font-medium">Best with dashboard:</span> HTTPS endpoints work best with{' '}
                                          <code className="bg-muted px-1 rounded">https://myprovider.mor.org</code>
                                        </span>
                                      </p>
                                    </div>
                                  </AccordionContent>
                                </AccordionItem>
                              </Accordion>
                            </div>
                          </div>

                          <div className="border-t border-border/20 pt-3 mt-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Server className="h-4 w-4 text-purple-400" />
                              <p className="font-medium text-sm text-foreground">Host Software</p>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">
                              Your server needs one of the following to run the proxy-router:
                            </p>
                            <ul className="text-xs text-muted-foreground space-y-1.5 ml-2">
                              <li className="flex items-start gap-2">
                                <span className="text-purple-400 flex-shrink-0">•</span>
                                <span><span className="font-medium text-foreground">Docker</span> - Container runtime (recommended for easy setup)</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-purple-400 flex-shrink-0">•</span>
                                <span><span className="font-medium text-foreground">Direct Binary</span> - Ability to download and run the proxy-router binary</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={() => setShowPrereqs(false)} 
                    className="flex-1"
                    size="lg"
                  >
                    I'm Ready - Continue to Setup
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    size="lg"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          ) : !showEnvFile ? (
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Proxy Routing Port</Label>
                    <Input
                      type="text"
                      placeholder="3333"
                      value={proxyPort}
                      onChange={(e) => setProxyPort(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Port where users connect to your AI models (must be publicly accessible)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>API Management Port</Label>
                    <Input
                      type="text"
                      placeholder="8082"
                      value={apiPort}
                      onChange={(e) => setApiPort(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Port for admin/management interface
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Public API URL *</Label>
                  <Input
                    type="text"
                    placeholder="proxyapi.example.com:8082 or https://proxyapi.example.com"
                    value={webPublicUrl}
                    onChange={(e) => setWebPublicUrl(e.target.value)}
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      The public URL where your API management interface can be reached. This is what you'll use to connect this app to your node.
                    </p>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2">
                      <p className="text-xs text-blue-400">
                        <span className="font-medium">Examples:</span><br/>
                        • With HTTPS/reverse proxy: <code className="bg-muted px-1 rounded">https://proxyapi.yourhost.com</code><br/>
                        • Direct (with port): <code className="bg-muted px-1 rounded">proxyapi.yourhost.com:8082</code> or <code className="bg-muted px-1 rounded">123.45.67.89:8082</code><br/>
                        <br/>
                        <span className="font-medium">Note:</span> Don't include "http://" in the value - just the hostname/IP and optional port.
                      </p>
                    </div>
                  </div>
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

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowPrereqs(true)}
                  className="flex-1"
                >
                  ← Back to Prerequisites
                </Button>
                <Button onClick={generateEnvFile} className="flex-1" size="lg">
                  Next: Generate ENV File
                </Button>
              </div>
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
                  <p className="font-semibold text-blue-400 mb-3">Setup Instructions:</p>
                  
                  <Tabs defaultValue="binary" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="binary">Standalone Binary</TabsTrigger>
                      <TabsTrigger value="docker">Docker</TabsTrigger>
                    </TabsList>

                    <TabsContent value="docker" className="space-y-3">
                      <ol className="list-decimal space-y-3 text-sm text-foreground">
                        <li className="ml-5">
                          <span className="font-medium">Save the ENV content above to a file named <code className="bg-muted px-1 rounded">.env</code></span>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Pull the latest Docker image:</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto">docker pull ghcr.io/morpheusais/morpheus-lumerin-node:latest</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText('docker pull ghcr.io/morpheusais/morpheus-lumerin-node:latest');
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Run the container with your ENV file:</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">{`docker run -d \\
  --name morpheus-proxy-router \\
  --env-file .env \\
  -p ${proxyPort}:${proxyPort} \\
  -p ${apiPort}:${apiPort} \\
  ghcr.io/morpheusais/morpheus-lumerin-node:latest`}</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                const cmd = `docker run -d \\
  --name morpheus-proxy-router \\
  --env-file .env \\
  -p ${proxyPort}:${proxyPort} \\
  -p ${apiPort}:${apiPort} \\
  ghcr.io/morpheusais/morpheus-lumerin-node:latest`;
                                navigator.clipboard.writeText(cmd);
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Verify the node is running:</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto">curl http://localhost:{apiPort}/healthcheck</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText(`curl http://localhost:${apiPort}/healthcheck`);
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Once healthy, connect using the API Configuration section above!</span>
                        </li>
                      </ol>
                    </TabsContent>

                    <TabsContent value="binary" className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-blue-400 mb-2 block">Select Platform:</Label>
                          <Select value={binaryPlatform} onValueChange={setBinaryPlatform}>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="linux-x86_64">Linux (x86_64)</SelectItem>
                              <SelectItem value="mac-arm64">macOS (Apple Silicon)</SelectItem>
                              <SelectItem value="mac-x64">macOS (Intel)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-blue-400 mb-2 block">Select Version:</Label>
                          <Select value={selectedVersion} onValueChange={setSelectedVersion} disabled={isLoadingReleases}>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue>
                                {isLoadingReleases ? 'Loading versions...' : selectedVersion}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {availableReleases.map((release) => (
                                <SelectItem key={release.tag_name} value={release.tag_name}>
                                  {release.tag_name}
                                  {release.tag_name.includes('-test') ? ' (Test)' : ' (Stable)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <ol className="list-decimal space-y-3 text-sm text-foreground">
                        <li className="ml-5">
                          <span className="font-medium">Create a directory and navigate to it:</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">{`mkdir -p ~/morpheus-node
cd ~/morpheus-node`}</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText(`mkdir -p ~/morpheus-node\ncd ~/morpheus-node`);
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Save the ENV content above to a file named .env:</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">nano .env</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText('nano .env');
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Copy the ENV content from above, paste it into the editor, then save (Ctrl+O, Enter) and exit (Ctrl+X).
                            <br/>
                            <span className="font-medium">Alternative editors:</span> <code className="bg-muted px-1 rounded">vim .env</code> or <code className="bg-muted px-1 rounded">code .env</code> (VS Code)
                          </p>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Download the proxy-router binary ({getPlatformName(binaryPlatform)}):</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">{`wget ${getBinaryDownloadUrl(binaryPlatform, selectedVersion)} -O proxy-router`}</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText(`wget ${getBinaryDownloadUrl(binaryPlatform, selectedVersion)} -O proxy-router`);
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            <span className="font-medium">Release:</span>{' '}
                            <a 
                              href={`https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases/tag/${selectedVersion}`}
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              {selectedVersion}
                            </a>
                          </p>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Make the binary executable:</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">chmod +x proxy-router</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText('chmod +x proxy-router');
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Run the proxy-router (it will automatically load the .env file):</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">./proxy-router</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText('./proxy-router');
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2 mt-2">
                            <p className="text-xs text-yellow-400 flex items-start gap-1">
                              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                              <span>
                                <span className="font-medium">Note:</span> The process will run in the foreground. 
                                To run it in the background, use <code className="bg-muted px-1 rounded whitespace-nowrap">nohup ./proxy-router &</code> 
                                or set it up as a system service.
                              </span>
                            </p>
                          </div>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Verify the node is running (in a new terminal):</span>
                          <div className="relative group mt-2">
                            <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap break-words">{`curl http://localhost:${apiPort}/healthcheck`}</pre>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                navigator.clipboard.writeText(`curl http://localhost:${apiPort}/healthcheck`);
                                success('Copied!', 'Command copied to clipboard');
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                        <li className="ml-5">
                          <span className="font-medium">Once healthy, connect using the API Configuration section above!</span>
                        </li>
                      </ol>
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowEnvFile(false);
                      setShowPrereqs(true);
                    }}
                    className="flex-1"
                  >
                    Start Over
                  </Button>
                  <Button
                    onClick={() => {
                      setIsOpen(false);
                      setShowPrereqs(true);
                      setShowEnvFile(false);
                    }}
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

