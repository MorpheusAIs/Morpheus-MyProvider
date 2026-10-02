/**
 * Format models-config for .env / Docker / SecretVM paste.
 */

export interface ModelsConfigModel {
  modelId: string;
  modelName: string;
  apiType: string;
  apiUrl: string;
  apiKey?: string;
  concurrentSlots: number;
  capacityPolicy: string;
}

export type ModelsConfigFormat = 'heredoc' | 'single-line' | 'secretvm-value' | 'json-pretty';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/MorpheusAIs/Morpheus-Lumerin-Node/main/proxy-router/internal/config/models-config-schema.json';

export function buildModelsConfigObject(
  models: ModelsConfigModel[],
  includeSchema = true
): Record<string, unknown> {
  if (includeSchema) {
    return { $schema: SCHEMA_URL, models };
  }
  return { models };
}

export function formatModelsConfigContent(
  models: ModelsConfigModel[],
  format: ModelsConfigFormat = 'single-line'
): string {
  if (format === 'secretvm-value') {
    // SecretVM encrypted-secrets panel wants the raw JSON value (no KEY= wrapper, no $schema).
    return JSON.stringify(buildModelsConfigObject(models, false));
  }

  const configObject = buildModelsConfigObject(models, true);
  if (format === 'json-pretty') {
    return JSON.stringify(configObject, null, 2);
  }
  if (format === 'single-line') {
    return `MODELS_CONFIG_CONTENT='${JSON.stringify(configObject)}'`;
  }
  // heredoc
  const prettyJson = JSON.stringify(configObject, null, 4);
  return `MODELS_CONFIG_CONTENT=$(cat <<'EOF'\n${prettyJson}\nEOF\n)`;
}

/**
 * Parse a pasted MODELS_CONFIG from production into structured models.
 * Accepts:
 * - MODELS_CONFIG_CONTENT='{...}'
 * - MODELS_CONFIG_CONTENT={...}
 * - raw JSON object / {"models":[...]}
 * - a full 5-line secrets block (extracts the MODELS line)
 */
export function parseModelsConfigPaste(raw: string): ModelsConfigModel[] {
  let text = raw.trim();
  if (!text) throw new Error('Paste is empty');

  // If a multi-line secrets dump, prefer the MODELS_CONFIG_CONTENT line
  if (text.includes('\n') && /MODELS_CONFIG_CONTENT\s*=/.test(text)) {
    const line = text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('MODELS_CONFIG_CONTENT='));
    if (line) text = line;
  }

  if (text.startsWith('MODELS_CONFIG_CONTENT=')) {
    text = text.slice('MODELS_CONFIG_CONTENT='.length).trim();
  }

  // Strip wrapping single/double quotes
  if (
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('"') && text.endsWith('"'))
  ) {
    text = text.slice(1, -1);
  }

  // Unescape common shell-escaped single quotes: '\'' → '
  text = text.replace(/'\\''/g, "'");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Could not parse JSON — paste MODELS_CONFIG_CONTENT='{...}' or raw JSON");
  }

  let modelsRaw: unknown[] = [];
  if (Array.isArray(parsed)) {
    modelsRaw = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { models?: unknown }).models)
  ) {
    modelsRaw = (parsed as { models: unknown[] }).models;
  } else {
    throw new Error('JSON must be {"models":[...]} or a models array');
  }

  const models: ModelsConfigModel[] = modelsRaw.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`models[${i}] is not an object`);
    }
    const m = item as Record<string, unknown>;
    const modelId = String(m.modelId || '').trim();
    const modelName = String(m.modelName || '').trim();
    const apiType = String(m.apiType || 'openai').trim();
    const apiUrl = String(m.apiUrl || '').trim();
    if (!modelId || !modelName || !apiUrl) {
      throw new Error(`models[${i}] needs modelId, modelName, and apiUrl`);
    }
    const entry: ModelsConfigModel = {
      modelId,
      modelName,
      apiType,
      apiUrl,
      concurrentSlots: Number(m.concurrentSlots) > 0 ? Number(m.concurrentSlots) : 1,
      capacityPolicy: String(m.capacityPolicy || 'simple'),
    };
    if (typeof m.apiKey === 'string' && m.apiKey.trim()) {
      entry.apiKey = m.apiKey.trim();
    }
    return entry;
  });

  if (!models.length) throw new Error('No models found in paste');
  return models;
}

export function modelsConfigToPlanned(
  models: ModelsConfigModel[]
): Array<{
  modelId: string;
  modelName: string;
  priceMorPerHour: number;
  backendKind: 'own' | 'venice';
  backendModelName: string;
  apiUrl: string;
  apiKey: string;
  concurrentSlots: number;
}> {
  return models.map((m) => ({
    modelId: m.modelId,
    modelName: m.modelName,
    priceMorPerHour: 0,
    backendKind: /venice\.ai/i.test(m.apiUrl) ? 'venice' : 'own',
    backendModelName: m.modelName,
    apiUrl: m.apiUrl,
    apiKey: m.apiKey || '',
    concurrentSlots: m.concurrentSlots,
  }));
}
