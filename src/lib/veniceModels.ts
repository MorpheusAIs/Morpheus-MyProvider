/**
 * Live Venice model catalog + fuzzy match against Morpheus marketplace names.
 * GET /api/v1/models is public (CORS *); inference still needs an API key.
 */

import { VENICE_CHAT_URL, VENICE_EMBED_URL, VENICE_TTS_URL } from './venicePresets';

export interface VeniceModel {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface VeniceModelsResponse {
  data?: Array<{
    id: string;
    model_spec?: { name?: string; description?: string };
  }>;
  type?: string;
}

let cache: VeniceModel[] | null = null;
let cacheAt = 0;
const CACHE_MS = 30 * 60 * 1000;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(/\s+/).filter(Boolean);
}

/** Higher = better match to Morpheus marketplace name */
export function scoreVeniceMatch(morpheusName: string, venice: VeniceModel): number {
  const m = normalize(morpheusName);
  const id = normalize(venice.id);
  const name = normalize(venice.name);
  if (!m) return 0;
  if (id === m || name === m) return 1000;
  if (id.includes(m) || m.includes(id)) return 800;
  if (name.includes(m) || m.includes(name)) return 700;
  const mt = tokens(morpheusName);
  const vt = new Set([...tokens(venice.id), ...tokens(venice.name)]);
  let overlap = 0;
  for (const t of mt) {
    if (t.length < 2) continue;
    if (vt.has(t)) overlap += 40;
    for (const v of vt) {
      if (v.includes(t) || t.includes(v)) overlap += 15;
    }
  }
  return overlap;
}

export function rankVeniceModels(morpheusName: string, models: VeniceModel[], limit = 12): VeniceModel[] {
  return [...models]
    .map((v) => ({ v, s: scoreVeniceMatch(morpheusName, v) }))
    .sort((a, b) => b.s - a.s || a.v.id.localeCompare(b.v.id))
    .slice(0, limit)
    .map((x) => x.v);
}

export function suggestVeniceApiUrl(morpheusName: string, veniceId: string): string {
  const n = `${morpheusName} ${veniceId}`.toLowerCase();
  if (n.includes('embed') || n.includes('bge')) return VENICE_EMBED_URL;
  if (n.includes('tts') || n.includes('kokoro') || n.includes('speech')) return VENICE_TTS_URL;
  return VENICE_CHAT_URL;
}

async function fetchType(type: string): Promise<VeniceModel[]> {
  const res = await fetch(`https://api.venice.ai/api/v1/models?type=${encodeURIComponent(type)}`);
  if (!res.ok) return [];
  const body = (await res.json()) as VeniceModelsResponse;
  return (body.data || []).map((m) => ({
    id: m.id,
    name: m.model_spec?.name || m.id,
    type,
    description: m.model_spec?.description,
  }));
}

/** text + embedding + tts — enough for typical Morpheus bids */
export async function fetchVeniceModels(force = false): Promise<VeniceModel[]> {
  if (!force && cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const [text, embedding, tts] = await Promise.all([
    fetchType('text'),
    fetchType('embedding'),
    fetchType('tts'),
  ]);
  const byId = new Map<string, VeniceModel>();
  for (const m of [...text, ...embedding, ...tts]) {
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  cache = [...byId.values()];
  cacheAt = Date.now();
  return cache;
}
