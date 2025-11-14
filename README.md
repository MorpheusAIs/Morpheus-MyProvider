# Morpheus Provider Dashboard

A Next.js web application for managing providers, models, and bids on the Morpheus Proxy Router blockchain. Simplifies provider onboarding and management through an intuitive GUI.

## Features

- 🔌 **API Connection Management** - Connect to Proxy Router with credentials
- 👛 **Wallet Display** - View address and MOR balance
- 🏢 **Provider Management** - Register and update provider stakes
- 🤖 **Model Management** - Create and manage AI models
- 💰 **Bid Management** - Create competitive bids for models
- 🔔 **Notifications** - Real-time feedback for all operations
- 🌙 **Dark Theme** - Modern, sleek interface
- 📦 **Static Export** - Deploy to S3/CloudFront

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- npm or yarn
- Access to Morpheus Proxy Router API

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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
npm run dev      # Start development server with Turbopack
npm run build    # Build for production (static export)
npm run start    # Serve production build locally
npm run lint     # Run ESLint
```

## Configuration

### Network Configuration

All network settings and contract addresses are configured in `src/lib/constants.ts`:

- **API URLs**: Default API endpoints for mainnet and testnet (users can override these at runtime)
- **Contract Addresses**: Diamond and MOR token contracts for both networks
- **Minimum Values**: Provider stake, model stake, marketplace fee, and bid price minimums (in wei)

**Note:** API URLs in the constants are placeholders. Users will enter their actual Proxy Router API URL when connecting through the UI.

## Deployment

This application is automatically deployed to AWS S3 and CloudFront via GitHub Actions.

**Production URL:** https://myprovider.mor.org

### Automated Deployment

Every push to the `main` branch automatically:
1. Builds the Next.js application
2. Uploads static files to S3
3. Invalidates CloudFront cache
4. Makes the new version live

For detailed deployment documentation, infrastructure setup, and manual deployment instructions, see [DEPLOYMENT.md](./.ai-docs/DEPLOYMENT.md).

## Architecture

See [ARCHITECTURE.md](./.ai-docs/ARCHITECTURE.md) for detailed technical documentation including:

- Component structure
- API service layer
- State management
- Type definitions
- Deployment strategies

## Technology Stack

- **Next.js 15** - React framework with static export
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
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

**Version:** 0.1.0  
**Built with** ❤️ **for the Morpheus ecosystem**

