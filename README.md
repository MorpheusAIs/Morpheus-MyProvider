# Morpheus Provider Dashboard

A cross-platform desktop application and web interface for managing providers, models, and bids on the Morpheus Proxy Router blockchain. Built with Vite + React + Tauri for native desktop performance and S3/CloudFront web deployment.

## Features

- 🖥️ **Cross-Platform Desktop App** - Native apps for macOS (Intel/ARM), Linux, and Windows
- 🌐 **Web Deployment** - Static web hosting on S3/CloudFront
- 🔌 **API Connection Management** - Connect to Proxy Router with credentials
- 🚀 **Provider Bootstrap** - Generate complete ENV configurations
- 👛 **Multi-Chain Support** - Arbitrum and Base networks (mainnet + testnet)
- 🏢 **Provider Management** - Register and update provider stakes
- 🤖 **Model Management** - Create and manage AI models with sync
- 💰 **Bid Management** - Create competitive bids for models
- 🔔 **Notifications** - Real-time feedback for all operations
- 🌙 **Dark Theme** - Modern, sleek interface with purple accents

## Quick Start

### Desktop App (Recommended)

Download the latest release for your platform:

**macOS:**
- [Apple Silicon (M1/M2/M3)](https://github.com/MorpheusAIs/Morpheus-MyProvider/releases/latest/download/Morpheus_MyProvider-mac-arm64.dmg)
- [Intel (x64)](https://github.com/MorpheusAIs/Morpheus-MyProvider/releases/latest/download/Morpheus_MyProvider-mac-x64.dmg)

**Linux:**
- [AppImage (x64)](https://github.com/MorpheusAIs/Morpheus-MyProvider/releases/latest/download/Morpheus_MyProvider-linux-x64.AppImage)
- [Debian Package](https://github.com/MorpheusAIs/Morpheus-MyProvider/releases/latest/download/Morpheus_MyProvider-linux-x64.deb)

**Windows:**
- [MSI Installer](https://github.com/MorpheusAIs/Morpheus-MyProvider/releases/latest/download/Morpheus_MyProvider-windows-x64.msi)

### Web App (Alternative)

Access the hosted version at [https://myprovider.mor.org](https://myprovider.mor.org)

### Development Setup

**Prerequisites:**
- Node.js >= 20.0.0
- Rust >= 1.75.0 (for Tauri desktop builds)
- npm or yarn

**Installation:**

```bash
# Install dependencies
npm install

# Start development server (web only)
npm run dev

# Start Tauri development (desktop app with hot reload)
npm run tauri:dev
```

**Web dev server:** [http://localhost:3000](http://localhost:3000)

## 🔒 HTTPS Requirement

**Important:** The hosted version at [https://myprovider.mor.org](https://myprovider.mor.org) can **only connect to HTTPS-enabled proxy-routers** due to browser Mixed Content security policies.

### If Your Proxy Router Uses HTTP (not HTTPS):

You have three options:

**Option 1: Enable HTTPS (Recommended for Production)**
- Use an Application Load Balancer (ALB) with ACM certificate
- Use CloudFront with custom domain and TLS
- Use nginx/caddy as reverse proxy with Let's Encrypt
- Direct TLS configuration on your proxy-router

**Option 2: Run Locally**
```bash
npm install
npm run dev
# Access at http://localhost:3000
```
From `http://localhost:3000`, you can connect to HTTP endpoints without browser restrictions.

**Option 3: Disable Mixed Content Blocking (Chrome/Brave/Edge)**

For testing purposes, you can temporarily disable Mixed Content blocking in Chromium-based browsers:

1. Visit `https://myprovider.mor.org`
2. Click the **shield icon** 🛡️ in the address bar (left side)
3. Click **"Load unsafe scripts"**
4. Page will reload with HTTP connections allowed

*Note: This is per-session and resets when you close the tab. Not recommended for production use.*

**Alternative (Persistent):**
```bash
# Launch Chrome with security disabled (testing only)
# macOS
open -a "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome_dev"

# Linux
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev"

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --disable-web-security --user-data-dir="C:\tmp\chrome_dev"
```

**⚠️ Warning:** Running with `--disable-web-security` disables all browser security features. Only use for testing with trusted endpoints.

## Usage

### 1. Connect to API

1. Enter your Proxy Router API URL (e.g., `http://your-provider.domain.io:8082`)
2. Provide admin username and password
3. Click "Connect"

The app will verify the connection and load your wallet information.

### 2. Manage Providers

- View all registered providers
- Create new provider with endpoint and stake (min 0.2 MOR)
- Update existing provider stake

### 3. Manage Models

- Browse registered models
- Create new models with:
  - Model ID (0x...)
  - IPFS CID (0x...)
  - Stake (min 0.1 MOR)
  - Fee (min 300000000000 wei)
  - Tags (comma-separated)

### 4. Create Bids

- Select a model from dropdown
- Set price per second (min 10000000000 wei)
- Submit bid

## Scripts

```bash
# Web Development
npm run dev             # Start Vite dev server (web only)
npm run build           # Build for web (static files to dist/)
npm run preview         # Preview production build locally

# Desktop Development (Tauri)
npm run tauri:dev       # Start Tauri dev (desktop app with hot reload)
npm run tauri:build     # Build desktop app for current platform
npm run tauri:build:debug  # Build debug desktop app (faster, larger)

# Code Quality
npm run lint            # Run ESLint
```

## Configuration

### Network Configuration

All network settings and contract addresses are configured in `src/lib/constants.ts`:

- **API URLs**: Default API endpoints for mainnet and testnet (users can override these at runtime)
- **Contract Addresses**: Diamond and MOR token contracts for both networks
- **Minimum Values**: Provider stake, model stake, marketplace fee, and bid price minimums (in wei)

**Note:** API URLs in the constants are placeholders. Users will enter their actual Proxy Router API URL when connecting through the UI.

## Deployment

### Web Deployment (S3/CloudFront)

The web version is automatically deployed via GitHub Actions on push to `main`:

1. Builds Vite application → `dist/`
2. Uploads static files to S3
3. Invalidates CloudFront cache
4. Live at: **https://myprovider.mor.org**

### Desktop App Releases

Desktop apps are automatically built and released via GitHub Actions:

**Version Strategy:**
- Push to `main` → Increments **major** version (v1.0.0, v2.0.0, v3.0.0)
- Push to `cicd/*` → Increments **minor** version (v1.1.0, v1.2.0)

**Artifacts:** Versionless filenames for clean download URLs:
- `Morpheus_MyProvider-mac-arm64.dmg`
- `Morpheus_MyProvider-mac-x64.dmg`
- `Morpheus_MyProvider-linux-x64.AppImage`
- `Morpheus_MyProvider-linux-x64.deb`
- `Morpheus_MyProvider-windows-x64.msi`

**Latest Release:** [GitHub Releases](https://github.com/MorpheusAIs/Morpheus-MyProvider/releases/latest)

### Local Desktop Build

```bash
# Install Rust if not already installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build for your current platform
npm run tauri:build

# Output location:
# macOS: src-tauri/target/release/bundle/dmg/
# Linux: src-tauri/target/release/bundle/appimage/
# Windows: src-tauri/target/release/bundle/msi/
```

## Architecture

See [ARCHITECTURE.md](./.ai-docs/ARCHITECTURE.md) for detailed technical documentation including:

- Component structure
- API service layer
- State management
- Type definitions
- Deployment strategies

## Technology Stack

- **Vite 7** - Lightning-fast build tool
- **React 18** - UI library
- **TypeScript 5** - Type-safe development
- **Tauri 2** - Rust-powered desktop framework
- **Tailwind CSS 3** - Utility-first styling
- **Radix UI** - Accessible component primitives
- **Axios** - HTTP client
- **Lucide React** - Icon library

## Contract Minimums

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| Provider Stake | 0.2 MOR | 200000000000000000 wei |
| Model Stake | 0.1 MOR | 100000000000000000 wei |
| Bid Fee | 0.3 MOR | 300000000000000000 wei |
| Bid Price/Sec | 0.00000001 MOR | 10000000000 wei |

**Recommended:** Have at least 1 MOR in wallet for full setup.

## API Endpoints

### Base URLs
Configure your Proxy Router API endpoints:
- Mainnet: `http://your-mainnet-provider.domain.io:8082`
- Testnet: `http://your-testnet-provider.domain.io:8082`

### Key Endpoints
- `GET /healthcheck` - API health
- `GET /blockchain/balance` - Wallet info
- `GET /blockchain/providers` - List providers
- `POST /blockchain/providers` - Create provider
- `GET /blockchain/models` - List models
- `POST /blockchain/models` - Create model
- `DELETE /blockchain/models/{id}` - Delete model (no bids)
- `GET /blockchain/providers/{id}/bids` - List bids by provider
- `POST /blockchain/bids` - Create bid
- `DELETE /blockchain/bids/{id}` - Delete bid
- `GET /blockchain/allowance` - Check allowance
- `POST /blockchain/approve` - Approve spending
- `GET /swagger/doc.json` - Full API docs

## Security

- Credentials stored in sessionStorage (cleared on browser close)
- Basic authentication over HTTPS recommended
- All inputs validated before API calls
- Error messages sanitized

## Troubleshooting

### Connection Issues
- Verify API URL and credentials
- Check network connectivity
- Test healthcheck endpoint directly
- Review browser console for errors

### Transaction Failures
- Ensure sufficient MOR balance
- Verify minimum stake requirements
- Check API error messages
- Confirm wallet has proper authorization

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## License

MIT License - See LICENSE file for details

## Support

For issues and questions:
- Check [ARCHITECTURE.md](./.ai-docs/ARCHITECTURE.md) for technical details
- See [DEPLOYMENT.md](./.ai-docs/DEPLOYMENT.md) for deployment issues
- Review API documentation at `/swagger/doc.json`
- Open an issue on GitHub

---

**Current Version:** 0.1.0  
**Platform:** Vite + React + Tauri  
**Built with** ❤️ **for the Morpheus ecosystem**

