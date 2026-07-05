export type VariantPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  transformation: Array<Record<string, string | number>>;
};

export const VARIANT_PRESETS: VariantPreset[] = [
  {
    id: 'instagram_square',
    label: 'Instagram Square (1:1)',
    width: 1080,
    height: 1080,
    transformation: [
      { width: 1080, height: 1080, crop: 'fill', gravity: 'auto' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  },
  {
    id: 'instagram_portrait',
    label: 'Instagram Portrait (4:5)',
    width: 1080,
    height: 1350,
    transformation: [
      { width: 1080, height: 1350, crop: 'fill', gravity: 'auto' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  },
  {
    id: 'pinterest_standard',
    label: 'Pinterest Standard (2:3)',
    width: 1000,
    height: 1500,
    transformation: [
      { width: 1000, height: 1500, crop: 'fill', gravity: 'auto' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  },
  {
    id: 'pinterest_long',
    label: 'Pinterest Long (1:2.1)',
    width: 1000,
    height: 2100,
    transformation: [
      { width: 1000, height: 2100, crop: 'fill', gravity: 'auto' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  },
  {
    id: 'pinterest_square',
    label: 'Pinterest Square',
    width: 1000,
    height: 1000,
    transformation: [
      { width: 1000, height: 1000, crop: 'fill', gravity: 'auto' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  },
  {
    id: 'banner',
    label: 'Banner (3:1)',
    width: 1500,
    height: 500,
    transformation: [
      { width: 1500, height: 500, crop: 'fill', gravity: 'auto' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  },
];

export function getVariantPresetById(presetId: string) {
  return VARIANT_PRESETS.find((preset) => preset.id === presetId) ?? null;
}
