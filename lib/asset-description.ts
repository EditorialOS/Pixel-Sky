import { getOpenAIClient } from './openai';

const DEFAULT_VISION_MODEL = 'gpt-4o-mini';

export type AssetVisualDescription = {
  description: string;
  subjects: string[];
  setting: string[];
  mood: string[];
  colors: string[];
  visual_tags: string[];
  visible_text: string[];
};

const DESCRIPTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    description: { type: 'string' },
    subjects: { type: 'array', items: { type: 'string' } },
    setting: { type: 'array', items: { type: 'string' } },
    mood: { type: 'array', items: { type: 'string' } },
    colors: { type: 'array', items: { type: 'string' } },
    visual_tags: { type: 'array', items: { type: 'string' } },
    visible_text: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'description',
    'subjects',
    'setting',
    'mood',
    'colors',
    'visual_tags',
    'visible_text',
  ],
} as const;

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean))]
    .slice(0, 30);
}

export function parseAssetVisualDescription(value: string): AssetVisualDescription {
  const parsed = JSON.parse(value) as Record<string, unknown>;
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
  if (!description) throw new Error('The vision model returned an empty description.');

  return {
    description,
    subjects: stringArray(parsed.subjects),
    setting: stringArray(parsed.setting),
    mood: stringArray(parsed.mood),
    colors: stringArray(parsed.colors),
    visual_tags: stringArray(parsed.visual_tags),
    visible_text: stringArray(parsed.visible_text),
  };
}

export function visualDescriptionTerms(description: AssetVisualDescription) {
  return [...new Set([
    ...description.subjects,
    ...description.setting,
    ...description.mood,
    ...description.colors,
    ...description.visual_tags,
    ...description.visible_text,
  ])];
}

export async function describeAsset(imageUrl: string, metadataText: string) {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_VISION_MODEL || DEFAULT_VISION_MODEL;
  const response = await client.responses.create({
    model,
    store: false,
    max_output_tokens: 700,
    instructions: [
      'Describe this image for accurate natural-language retrieval in a digital asset library.',
      'Be concrete about visible subjects, actions, setting, composition, mood, colors, season, and legible text.',
      'Do not infer identity, ethnicity, health, religion, politics, sexuality, licensing, usage rights, or approval status.',
      'Do not invent brand, campaign, location, or date information that is not visibly present or supplied in metadata.',
      'Use concise noun phrases for array values.',
    ].join(' '),
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: `Existing asset metadata (may be incomplete): ${metadataText || 'none'}`,
        },
        { type: 'input_image', image_url: imageUrl, detail: 'low' },
      ],
    }],
    text: {
      format: {
        type: 'json_schema',
        name: 'asset_visual_description',
        strict: true,
        schema: DESCRIPTION_SCHEMA,
      },
    },
  });

  if (!response.output_text) {
    throw new Error('The vision model did not return a description.');
  }
  return parseAssetVisualDescription(response.output_text);
}
