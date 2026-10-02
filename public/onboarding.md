# MyProvider onboarding

Interactive UI: [https://myprovider.mor.org](https://myprovider.mor.org)  
Agent corpus: [llms-full.txt](./llms-full.txt) · [llms.txt](./llms.txt) · [AGENTS.md](./AGENTS.md)

Canonical protocol docs: [nodedocs.mor.org](https://nodedocs.mor.org)

## Before you start

1. Fund a BASE wallet with MOR + ETH (gas).
2. Look up models on [active.mor.org/status](https://active.mor.org/status). **Reuse existing model Ids.**
3. Choose a deploy path: SecretVM | Container | Release | GitHub.

Private keys typed in MyProvider stay in the browser session only.

## Three GUI steps

### 1. Models & bids

For each marketplace model:

- Bid in **MOR/hour** (converted to wei/sec for the chain).
- Choose backend: own OpenAI-compatible **or** Venice.
- Set **backend model name** separately from the Morpheus marketplace name (`modelId` / Name ≠ Venice/local model id).
- Set `apiUrl`, optional API key, slots.

### 2. Secrets

Wallet key, Base RPC (`ETH_NODE_ADDRESS` — Alchemy/Infura), admin cookie, and (when known) `WEB_PUBLIC_URL`. Copy the full secrets / `.env` block (includes MODELS_CONFIG + bid plan comments).

### 3. Deploy

Follow the path checklist in the UI, then Connect → register → bid.

## Deploy paths

### SecretVM (two-phase URL)

1. Fetch **digest-pinned** compose from Releases (UI button; not `:latest`).
2. Create VM at [SecretVM portal](https://secretai.scrtlabs.com/secret-vms/create); paste compose + secrets.
3. Start VM → copy hostname into `WEB_PUBLIC_URL` → **re-copy and update secrets** on the VM.
4. Healthcheck → Connect MyProvider → register → bid.

Details: [SecretVM quickstart](https://nodedocs.mor.org/providers/full/secretvm-quickstart)

### Container

1. Copy `.env` from step 2.
2. `docker pull` + run with ports `3333` (public) and `8082` (admin / HTTPS).
3. Connect → register → bid.

Details: [Docker provider](https://nodedocs.mor.org/providers/full/proxy-router-docker)

### Release binary

1. Download platform binary from Releases.
2. Place `.env` beside the binary; start; healthcheck.
3. Connect → register → bid.

Details: [Full P-Node quickstart](https://nodedocs.mor.org/providers/full/quickstart)

### GitHub / source

```bash
git clone https://github.com/MorpheusAIs/Morpheus-Lumerin-Node.git
cd Morpheus-Lumerin-Node/proxy-router
./build.sh
```

Then `.env` + run + MyProvider as above.

## Backend note (Venice / Diem)

Per bid: point `apiUrl` at Venice, set `apiKey`, and set **backend model name** to Venice’s model id. Bid on the Morpheus `modelId`. Do not use the `tee` tag for Venice.  
[Reselling Venice](https://nodedocs.mor.org/providers/resale/reselling-venice)

## After deploy

[Register on chain](https://nodedocs.mor.org/providers/full/register-onchain) · [Verify setup](https://nodedocs.mor.org/providers/full/verify-setup)
