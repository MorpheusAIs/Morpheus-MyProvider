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
