# AGENTS.md — Morpheus MyProvider

If you are an LLM helping someone become a Morpheus **provider**, read https://myprovider.mor.org/llms-full.txt first.

## Product

- **URL:** https://myprovider.mor.org
- **Auth to node:** HTTP Basic Auth (`COOKIE_CONTENT`), not a browser wallet
- **Secrets:** session-only or local JSON file — not stored server-side

## SecretVM order (preferred)

1. Fund Base wallet (MOR + ETH) → node secrets (models may be empty)
2. Digest-pinned compose → deploy VM → set WEB_PUBLIC_URL → re-paste secrets
3. Connect → register provider
4. Models & backends (Venice picker per bid; reuse API key) → re-paste MODELS_CONFIG → restart → place bids (MOR/hour → wei/sec)

`modelId` = on-chain Id. Config `modelName` = backend/Venice id. Do not conflate.

## Hard rules

- Never invent contract addresses, chain IDs, or live prices
- Never confuse proxy-router with hosted Inference API (api.mor.org)
- `:8082` admin must not be public; `:3333` is public on providers
