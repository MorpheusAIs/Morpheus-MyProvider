# Morpheus Provider Dashboard - Architecture

## Overview

The Morpheus Provider Dashboard is a Next.js 15 application that provides a web interface for managing providers, models, and bids on the Morpheus Proxy Router blockchain. It enables provider onboarding, model registration, and bid management through a user-friendly GUI.

**Key Features:**
- API connection management with authentication
- Wallet balance display and monitoring
- Provider registration and stake management
- Model creation with IPFS integration
- Bid creation and tracking
- Real-time blockchain data synchronization
- Static site generation for S3/CloudFront deployment

---

## Technology Stack

### Frontend Framework
- **Next.js 15.3.2** with static export (`output: 'export'`)
- **React 18.2.0**
- **TypeScript 5.x**
- **Tailwind CSS 3.4.1** for styling

### UI Components
- **Radix UI** primitives for accessible components
- **shadcn/ui** component library (customized)
- **Lucide React** for icons
- **class-variance-authority** for component variants

### HTTP Client
- **Axios 1.9.0** for API communication
- Basic authentication with username/password
- Request/response interceptors for logging

### State Management
- **React Context API**
  - `ApiContext` - API service and configuration
  - `NotificationContext` - Toast notifications

### Storage
- **sessionStorage** for API configuration persistence
- Cleared on browser close for security

---

## Project Structure

```
provider-dash/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with providers
│   │   ├── page.tsx            # Main dashboard page
│   │   └── globals.css         # Global styles with dark theme
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui base components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── table.tsx
│   │   │   ├── badge.tsx
│   │   │   └── dialog.tsx
│   │   ├── ApiConfig.tsx       # API connection setup
│   │   ├── WalletDisplay.tsx   # Wallet info display
│   │   ├── ProviderTab.tsx     # Provider CRUD operations
│   │   ├── ModelTab.tsx        # Model CRUD operations
│   │   ├── BidTab.tsx          # Bid CRUD operations
│   │   └── NotificationManager.tsx  # Toast notifications
│   ├── lib/                    # Core libraries
│   │   ├── ApiContext.tsx      # API state management
│   │   ├── NotificationContext.tsx  # Notification system
│   │   ├── apiService.ts       # API client wrapper
│   │   ├── types.ts            # TypeScript definitions
│   │   └── utils.ts            # Helper functions
├── package.json                # Dependencies
├── next.config.ts              # Next.js configuration
├── tailwind.config.js          # Tailwind CSS config
├── tsconfig.json               # TypeScript config
└── ARCHITECTURE.md             # This file
```

---

## Core Components

### 1. ApiConfig Component
**Purpose:** Manages API connection configuration

**Features:**
- Input fields for API URL, username, password
- Connection status indicator (Connected/Not Connected)
- Tests connection via healthcheck endpoint
- Validates authentication by fetching wallet balance
- Stores configuration in sessionStorage
- Disconnect functionality

**State Management:**
- Uses `ApiContext` for global API service
- Local state for form inputs
- Connection status reflected in badge

### 2. WalletDisplay Component
**Purpose:** Shows wallet address and MOR balance

**Features:**
- Displays wallet address (shortened)
- Shows balance in MOR (converted from wei)
- Copy address to clipboard
- Manual refresh button
- Auto-refresh on configuration

**Data Source:**
- `GET /blockchain/balance` endpoint
- Returns address and balance in wei

### 3. ProviderTab Component
**Purpose:** Manage provider registration and stake

**Features:**
- List all providers from blockchain
- Create new provider or update existing
- Endpoint and stake configuration
- Validation for minimum stake (0.2 MOR)
- Highlights user's own provider
- Real-time status updates

**API Endpoints:**
- `GET /blockchain/providers` - List providers
- `POST /blockchain/providers` - Create/update provider

**Validation:**
- Endpoint must be valid host:port format
- Stake must be >= 0.2 MOR (200000000000000000 wei)

### 4. ModelTab Component
**Purpose:** Manage model registration and bidding

**Features:**
- List all models from blockchain in 4 sections:
  1. **Your Models with Bids** - Models you own with your active bids (Change Bid, Delete Bid)
  2. **Other Models with Your Bids** - Models you don't own but have bids on (Change Bid, Delete Bid)
  3. **Your Models Without Bids** - Models you own with no bids (Add Bid, Remove Model if no other bids)
  4. **Available Models** - Other models you haven't bid on (Add Bid)
- Create new models and bids in one flow
- Adjustable model stake and marketplace fee (with minimums)
- Smart MOR formatting for display
- Allowance checking and approval flow
- Tag management (comma-separated)
- Model ID and owner address with copy functionality
- Total bid count for each model

**API Endpoints:**
- `GET /blockchain/models` - List models
- `POST /blockchain/models` - Create model
- `DELETE /blockchain/models/{id}` - Delete model (only if no bids exist)
- `GET /blockchain/providers/{id}/bids` - List bids for provider
- `POST /blockchain/bids` - Create bid
- `DELETE /blockchain/bids/{id}` - Delete bid
- `GET /blockchain/allowance` - Check spending allowance
- `POST /blockchain/approve` - Approve spending

**Validation:**
- Model ID must be valid address (0x...)
- IPFS ID must be valid address (0x...)
- Stake must be >= 0.1 MOR (100000000000000000 wei)
- Fee must be >= 300000000000 wei
- Name is required
- Bid price must be >= 10000000000 wei

### 5. BidTab Component
**Purpose:** Manage bid creation for models

**Features:**
- List all bids from blockchain
- Create bids for existing models
- Model selection dropdown
- Price per second configuration
- Highlights user's own bids
- Active/deleted status tracking

**API Endpoints:**
- `GET /blockchain/bids` - List bids
- `POST /blockchain/bids` - Create bid
- `GET /blockchain/models` - Load models for selection

**Validation:**
- Model must be selected
- Price per second must be >= 10000000000 wei

### 6. NotificationManager Component
**Purpose:** Display toast notifications

**Features:**
- Top-right corner positioning
- Success, error, warning, info types
- Auto-dismiss after duration
- Manual dismiss button
- Animated slide-in effect
- Color-coded by type

---

## API Service Layer

### ApiService Class (`lib/apiService.ts`)

Handles all communication with the Morpheus Proxy Router backend.

**Constructor:**
```typescript
new ApiService(baseUrl: string, username: string, password: string)
```

**Authentication:**
- Basic Authentication using Base64 encoded credentials
- `Authorization: Basic ${btoa(username:password)}`

**Key Methods:**

1. **healthCheck()** - Test API connectivity
   - `GET /healthcheck`
   - Returns boolean

2. **getBalance()** - Get wallet info
   - `GET /blockchain/balance`
   - Returns `{ address, balance }`

3. **getProviders()** - List providers
   - `GET /blockchain/providers`
   - Returns array of Provider objects

4. **createProvider(data)** - Create/update provider
   - `POST /blockchain/providers`
   - Body: `{ endpoint, stake }`

5. **getModels()** - List models
   - `GET /blockchain/models`
   - Returns array of Model objects

6. **createModel(data)** - Create model
   - `POST /blockchain/models`
   - Body: `{ id, name, ipfsID, stake, fee, tags }`

7. **getBids()** - List bids for current provider
   - `GET /blockchain/providers/{address}/bids`
   - Returns array of Bid objects for the authenticated wallet

8. **createBid(data)** - Create bid
   - `POST /blockchain/bids`
   - Body: `{ modelID, pricePerSecond }`

9. **approve(spender, amount)** - Approve token spending
   - `POST /blockchain/approve?spender={}&amount={}`
   - For Diamond contract approvals

**Error Handling:**
- Static `parseError()` method extracts user-friendly messages
- Axios interceptors log requests/responses
- Errors propagated to components for notification display

---

## State Management

### ApiContext

**Purpose:** Global API service and configuration state

**State:**
- `apiService` - ApiService instance or null
- `isConfigured` - Boolean connection status
- `walletBalance` - Wallet address and balance
- `configure()` - Connect to API
- `refreshWallet()` - Reload wallet data
- `clearConfig()` - Disconnect and clear session

**Storage:**
- Configuration saved to `sessionStorage` as JSON
- Key: `morpheus_provider_dashboard_config`
- Restored on page load if available
- Cleared on logout or browser close

### NotificationContext

**Purpose:** Global notification system

**State:**
- `notifications` - Array of active notifications
- `showNotification()` - Add notification
- `dismissNotification()` - Remove notification
- `success()` - Show success toast
- `error()` - Show error toast
- `warning()` - Show warning toast
- `info()` - Show info toast

**Notification Object:**
```typescript
{
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;  // Auto-dismiss after ms
}
```

---

## Type Definitions

### Core Types (`lib/types.ts`)

**ApiConfig:**
```typescript
{
  baseUrl: string;
  username: string;
  password: string;
}
```

**Provider:**
```typescript
{
  Address: string;
  Endpoint: string;
  Stake: string;         // wei
  CreatedAt: string;     // timestamp
  IsDeleted: boolean;
}
```

**Model:**
```typescript
{
  Id: string;
  IpfsCID: string;
  Fee: number;           // wei
  Stake: string;         // wei
  Owner: string;
  Name: string;
  Tags: string[];
  CreatedAt: number;     // timestamp
  IsDeleted: boolean;
  ModelType?: string;
}
```

**Bid:**
```typescript
{
  Id: string;
  Provider: string;
  ModelAgentId: string;
  PricePerSecond: string;  // wei
  Nonce: string;
  CreatedAt: string;       // timestamp
  DeletedAt: string;       // timestamp or "0"
}
```

**WalletBalance:**
```typescript
{
  address: string;
  balance: string;       // wei
  balanceMOR?: string;   // MOR (formatted)
}
```

---

## Utility Functions

### Wei/MOR Conversion (`lib/utils.ts`)

**weiToMor(wei)** - Convert wei to MOR (divide by 10^18)
- Returns string with 6 decimal places

**morToWei(mor)** - Convert MOR to wei (multiply by 10^18)
- Returns string representing BigInt

### Address Formatting

**shortenAddress(address, chars)** - Shorten address for display
- Default: `0x1234...5678` (4 chars each side)

### Validation

**isValidAddress(address)** - Check if valid Ethereum address
- Pattern: `^0x[a-fA-F0-9]{40}$`

**isValidPositiveNumber(value)** - Check if positive number
- Returns true if parsed number > 0

### Time Formatting

**formatTimestamp(timestamp)** - Convert Unix timestamp to readable date
- Multiplies by 1000 for JavaScript Date
- Uses `toLocaleString()` for formatting

---

## Styling & Theme

### Dark Theme
- Background: Gray-900 with gradient
- Cards: Gray-800 with transparency
- Borders: Gray-700
- Text: White/Gray-400

### Color Scheme
- **Primary:** Default blue/white
- **Success:** Green-600
- **Error:** Red-600
- **Warning:** Yellow-600
- **Info:** Blue-600

### Custom CSS
```css
.neon-border {
  box-shadow: 0 0 5px primary, 0 0 10px primary;
}

.neon-text {
  text-shadow: 0 0 10px primary;
}
```

### Responsive Design
- Mobile-first approach
- Grid layouts adjust for small screens
- Tables scroll horizontally on mobile
- Forms stack vertically on mobile

---

## Configuration & Deployment

### Configuration File

**`src/lib/constants.ts`:**

All network configurations and contract minimums are defined in this file:

```typescript
export const NETWORKS = {
  mainnet: {
    name: 'Mainnet',
    apiUrl: 'http://your-mainnet-provider.domain.io:8082', // Placeholder
    diamondContract: '0xDE819AaEE474626E3f34Ef0263373357e5a6C71b',
    morTokenContract: '0x092bAaDB7DEf4C3981454dD9c0A0D7FF07bCFc86',
  },
  testnet: {
    name: 'Testnet',
    apiUrl: 'http://your-testnet-provider.domain.io:8082', // Placeholder
    diamondContract: '0xb8C55cD613af947E73E262F0d3C54b7211Af16CF',
    morTokenContract: '0x34a285a1b1c166420df5b6630132542923b5b27e',
  },
};

export const CONTRACT_MINIMUMS = {
  PROVIDER_MIN_STAKE: '200000000000000000', // 0.2 MOR
  MODEL_MIN_STAKE: '100000000000000000', // 0.1 MOR
  MARKETPLACE_BID_FEE: '300000000000000000', // 0.3 MOR
  BID_PRICE_PER_SEC_MIN: '10000000000', // 0.00000001 MOR/sec
};
```

**Note:** API URLs are placeholders. Users enter their actual Proxy Router API URL at runtime through the UI.

### Build Commands

**Development:**
```bash
npm run dev          # Start dev server with Turbopack
```

**Production Build:**
```bash
npm run build        # Build static site
npm run start        # Serve production build locally
```

**Static Export:**
- Next.js configured with `output: 'export'`
- Generates static HTML/CSS/JS in `/out` directory
- No server-side rendering
- All routes pre-rendered at build time

### Deployment to S3/CloudFront

1. **Build static site:**
   ```bash
   npm run build
   ```

2. **Upload `/out` directory to S3 bucket**

3. **Configure CloudFront:**
   - Origin: S3 bucket
   - Default root object: `index.html`
   - Error pages: Redirect 404 to `index.html`

4. **Optional: Amplify deployment**
   - Push to Git repository
   - Connect Amplify to repo
   - Auto-deploy on push

---

## Security Considerations

### Authentication
- Basic Auth over HTTPS (recommended)
- Credentials stored in sessionStorage (cleared on close)
- No persistent storage of sensitive data

### Data Validation
- All inputs validated before API calls
- Address format validation
- Minimum stake/fee enforcement
- Positive number checks

### API Security
- All requests authenticated
- No CORS issues (direct API calls)
- Error messages sanitized for display
- No sensitive data in error responses

---

## Future Enhancements

### Potential Features
1. **Approval Management:**
   - UI for token approvals to Diamond contract
   - Check current allowances
   - Approve spending with custom amounts

2. **Provider Status:**
   - Delete/deactivate providers
   - Update provider endpoints

3. **Model Management:**
   - Update model metadata
   - Delete models
   - Upload IPFS files directly

4. **Bid Management:**
   - Update bid prices
   - Cancel/delete bids
   - Bid history tracking

5. **Analytics Dashboard:**
   - Provider earnings tracking
   - Model usage statistics
   - Bid performance metrics

6. **Multi-wallet Support:**
   - Connect multiple wallets
   - Switch between accounts
   - MetaMask integration

7. **Testnet/Mainnet Toggle:**
   - Quick switch between networks
   - Different contract addresses
   - Network-specific data

---

## Troubleshooting

### Common Issues

**1. Connection Failed**
- Check API URL is correct
- Verify username/password
- Ensure API is accessible (no firewall)
- Check healthcheck endpoint directly

**2. Transaction Failures**
- Verify sufficient MOR balance
- Check minimum stake requirements
- Ensure wallet has gas for transactions
- Review API error messages

**3. Data Not Loading**
- Check network connectivity
- Verify API authentication
- Try manual refresh
- Check browser console for errors

**4. Build Errors**
- Run `npm install` to ensure dependencies
- Check TypeScript errors with `npm run build`
- Verify all imports are correct
- Clear `.next` directory and rebuild

---

## API Endpoints Reference

### Base URL
Configure your Proxy Router API endpoints:
- **Mainnet:** `http://your-mainnet-provider.domain.io:8082`
- **Testnet:** `http://your-testnet-provider.domain.io:8082`

### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/healthcheck` | API health check | No |
| GET | `/blockchain/balance` | Get wallet info | Basic |
| GET | `/blockchain/providers` | List providers | Basic |
| POST | `/blockchain/providers` | Create provider | Basic |
| GET | `/blockchain/models` | List models | Basic |
| POST | `/blockchain/models` | Create model | Basic |
| DELETE | `/blockchain/models/{id}` | Delete model (no bids) | Basic |
| GET | `/blockchain/providers/{id}/bids` | List bids by provider | Basic |
| POST | `/blockchain/bids` | Create bid | Basic |
| DELETE | `/blockchain/bids/{id}` | Delete bid | Basic |
| POST | `/blockchain/approve` | Approve spending | Basic |
| GET | `/swagger/doc.json` | API documentation | No |

### Authentication Header
```
Authorization: Basic {base64(username:password)}
```

---

## Development Workflow

### Setup
1. Clone repository
2. Run `npm install`
3. Run `npm run dev`
4. Configure API endpoint in the UI when connecting

### Code Organization
- Components in `/src/components`
- API logic in `/src/lib`
- Types in `/src/lib/types.ts`
- Utils in `/src/lib/utils.ts`
- Styles in `/src/app/globals.css`

### Best Practices
- Use TypeScript for type safety
- Validate all user inputs
- Handle errors gracefully with notifications
- Keep components focused and reusable
- Document complex logic
- Test API calls thoroughly

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** Development Team

