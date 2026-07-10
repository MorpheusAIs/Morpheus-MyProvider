# MyProvider onboarding

Interactive UI: [https://myprovider.mor.org](https://myprovider.mor.org)  
Agent corpus: [llms-full.txt](./llms-full.txt) · [llms.txt](./llms.txt) · [AGENTS.md](./AGENTS.md)

Canonical protocol docs: [nodedocs.mor.org](https://nodedocs.mor.org) · MCP `https://nodedocs.mor.org/mcp` · [llms-full.txt](https://nodedocs.mor.org/llms-full.txt)

## Before you start

1. Fund a BASE wallet with MOR + ETH (gas).
2. Look up the model you will serve on [active.mor.org/status](https://active.mor.org/status). **Reuse an existing model Id** when possible.
3. Choose a deploy path below.

Private keys typed in MyProvider stay in the browser session only.

## Deploy paths

### SecretVM

1. Download digest-pinned compose from [Releases](https://github.com/MorpheusAIs/Morpheus-Lumerin-Node/releases).
2. In MyProvider onboarding, fill the 5 secrets and copy them.
3. Create VM at [SecretVM portal](https://secretai.scrtlabs.com/secret-vms/create).
4. `curl https://<vm>/healthcheck`
5. Connect MyProvider to `https://<vm>/` with Basic Auth → register → bid on existing Id.

Details: [SecretVM quickstart](https://nodedocs.mor.org/providers/full/secretvm-quickstart)

### Container

1. Generate `.env` in MyProvider Bootstrap (Container tab).
2. `docker pull ghcr.io/morpheusais/morpheus-lumerin-node:<version>`
3. Run with ports `3333` (public) and `8082` (admin / HTTPS).
4. Connect MyProvider → register → bid.

Details: [Docker provider](https://nodedocs.mor.org/providers/full/proxy-router-docker)

### Release binary

1. Download platform binary from Releases via Bootstrap.
2. Place `.env` beside the binary; start it.
3. Connect (use desktop/local MyProvider if admin is HTTP-only).

Details: [Full P-Node quickstart](https://nodedocs.mor.org/providers/full/quickstart)

### GitHub / source

```bash
git clone https://github.com/MorpheusAIs/Morpheus-Lumerin-Node.git
cd Morpheus-Lumerin-Node/proxy-router && ./build.sh
```

Then `.env` + run + MyProvider as above.

## Backend note (Venice / Diem)

Point `apiUrl` at Venice and set `apiKey`. Bid on the Morpheus model name that matches. Do not use the `tee` tag.  
[Reselling Venice](https://nodedocs.mor.org/providers/resale/reselling-venice)

## After deploy

[Register on chain](https://nodedocs.mor.org/providers/full/register-onchain) · [Verify setup](https://nodedocs.mor.org/providers/full/verify-setup)
