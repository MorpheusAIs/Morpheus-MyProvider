/**
 * Venice AI (Diem) resale helpers for models-config.
 * modelId = Morpheus on-chain Id; modelName = Venice/backend model string sent to the API.
 */

export interface VeniceEndpoint {
  id: string;
  label: string;
  apiUrl: string;
  /** Suggested backend model string if known; user must confirm against Venice docs */
  suggestedBackendModel?: string;
  concurrentSlots: number;
  notes: string;
}

export const VENICE_CHAT_URL = 'https://api.venice.ai/api/v1/chat/completions';
export const VENICE_EMBED_URL = 'https://api.venice.ai/api/v1/embeddings';
export const VENICE_TTS_URL = 'https://api.venice.ai/api/v1/audio/speech';

export const VENICE_ENDPOINTS: VeniceEndpoint[] = [
  {
    id: 'chat',
    label: 'Chat completions',
    apiUrl: VENICE_CHAT_URL,
    concurrentSlots: 4,
    notes: 'Set backend model name to Venice’s model id (not the Morpheus marketplace name).',
  },
  {
    id: 'embeddings',
    label: 'Embeddings',
    apiUrl: VENICE_EMBED_URL,
    suggestedBackendModel: 'text-embedding-bge-m3',
    concurrentSlots: 8,
    notes: 'Common Venice embedding model id.',
  },
  {
    id: 'tts',
    label: 'TTS / speech',
    apiUrl: VENICE_TTS_URL,
    suggestedBackendModel: 'tts-kokoro',
    concurrentSlots: 2,
    notes: 'Confirm the speech model id in Venice’s docs.',
  },
];

/** Heuristic: guess Venice endpoint + backend model from Morpheus marketplace name */
export function suggestVeniceForMorpheusName(morpheusName: string): {
  apiUrl: string;
  backendModelName: string;
  concurrentSlots: number;
} {
  const n = morpheusName.toLowerCase();
  if (n.includes('embed') || n.includes('bge')) {
    return {
      apiUrl: VENICE_EMBED_URL,
      backendModelName: 'text-embedding-bge-m3',
      concurrentSlots: 8,
    };
  }
  if (n.includes('tts') || n.includes('kokoro') || n.includes('speech')) {
    return {
      apiUrl: VENICE_TTS_URL,
      backendModelName: 'tts-kokoro',
      concurrentSlots: 2,
    };
  }
  // Chat: leave backend model blank for user — Morpheus name ≠ Venice id
  return {
    apiUrl: VENICE_CHAT_URL,
    backendModelName: '',
    concurrentSlots: 4,
  };
}

export const VENICE_DOCS = {
  venice: 'https://venice.ai',
  models: 'https://docs.venice.ai/models/text',
  nodedocs: 'https://nodedocs.mor.org/providers/resale/reselling-venice',
  register: 'https://nodedocs.mor.org/providers/full/register-onchain',
};

/** @deprecated use VENICE_ENDPOINTS */
export const VENICE_PRESETS = VENICE_ENDPOINTS.map((e) => ({
  id: e.id,
  label: e.label,
  modelNameHint: e.suggestedBackendModel || 'Venice model id',
  apiType: 'openai',
  apiUrl: e.apiUrl,
  concurrentSlots: e.concurrentSlots,
  capacityPolicy: 'simple',
  notes: e.notes,
}));
