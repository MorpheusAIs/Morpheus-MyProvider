/**
 * Venice AI (Diem) resale presets for models-config apiUrl / apiType.
 * Confirm Venice TOS before reselling.
 */

export interface VenicePreset {
  id: string;
  label: string;
  modelNameHint: string;
  apiType: string;
  apiUrl: string;
  concurrentSlots: number;
  capacityPolicy: string;
  notes: string;
}

export const VENICE_PRESETS: VenicePreset[] = [
  {
    id: 'venice-chat',
    label: 'Venice — Chat completions',
    modelNameHint: 'Match an existing Morpheus model name from active.mor.org',
    apiType: 'openai',
    apiUrl: 'https://api.venice.ai/api/v1/chat/completions',
    concurrentSlots: 4,
    capacityPolicy: 'simple',
    notes: 'Use your Venice Diem API key. Bid on an existing marketplace model Id when possible.',
  },
  {
    id: 'venice-embeddings',
    label: 'Venice — Embeddings',
    modelNameHint: 'text-embedding-bge-m3 (or matching on-chain name)',
    apiType: 'openai',
    apiUrl: 'https://api.venice.ai/api/v1/embeddings',
    concurrentSlots: 8,
    capacityPolicy: 'simple',
    notes: 'Embeddings resale — look up the on-chain model Id before minting.',
  },
  {
    id: 'venice-tts',
    label: 'Venice — TTS / speech',
    modelNameHint: 'tts-kokoro (or matching on-chain name)',
    apiType: 'openai',
    apiUrl: 'https://api.venice.ai/api/v1/audio/speech',
    concurrentSlots: 2,
    capacityPolicy: 'simple',
    notes: 'Speech models — confirm Venice supports the model you bid on.',
  },
];

export const VENICE_DOCS = {
  venice: 'https://venice.ai',
  nodedocs: 'https://nodedocs.mor.org/providers/resale/reselling-venice',
  register: 'https://nodedocs.mor.org/providers/full/register-onchain',
};
