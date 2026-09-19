import test from 'node:test';
import assert from 'node:assert/strict';
import { assetIsInWorkspaceFolder } from '../lib/cloudinary';
import { buildTagExpression, rankStrictAssets } from '../lib/dam-search';
import { agentCandidate, agentDraftPack } from '../lib/agent-output';
import { assertApprovalActive, assertApprovedVersion, AssetUseError } from '../lib/asset-use-requests';
import { parseAssetVisualDescription, visualDescriptionTerms } from '../lib/asset-description';
import { buildEmbeddingText } from '../lib/embeddings';

test('strict search finds an older Cloudinary asset by its travel tag', () => {
  assert.equal(buildTagExpression('Travel'), 'resource_type:image AND type:upload AND (tags:travel)');
  const resources = Array.from({ length: 125 }, (_, index) => ({
    public_id: `campaign/photo-${index}`,
    filename: `photo-${index}`,
    tags: index === 120 ? ['Travel'] : ['portrait'],
  }));
  const matches = rankStrictAssets(resources, 'travel');
  assert.deepEqual(matches.map((asset) => asset.public_id), ['campaign/photo-120']);
});

test('delivery requires active approval for the same Cloudinary version', () => {
  const valid = { status: 'approved' as const, expires_at: '2026-09-19T00:00:00Z', asset_id: 'a1', asset_version: 5 };
  assert.doesNotThrow(() => assertApprovalActive(valid, Date.parse('2026-09-18T00:00:00Z')));
  assert.throws(() => assertApprovalActive({ ...valid, status: 'pending' }, Date.parse('2026-09-18T00:00:00Z')), AssetUseError);
  assert.throws(() => assertApprovalActive(valid, Date.parse('2026-09-20T00:00:00Z')), AssetUseError);
  assert.doesNotThrow(() => assertApprovedVersion(valid, { asset_id: 'a1', version: 5 }));
  assert.throws(() => assertApprovedVersion(valid, { asset_id: 'a1', version: 6 }), AssetUseError);
});

test('folder scoping includes children in both Cloudinary folder modes', () => {
  assert.equal(assetIsInWorkspaceFolder({ public_id: 'different/id', asset_folder: 'approved/travel' }, 'approved'), true);
  assert.equal(assetIsInWorkspaceFolder({ public_id: 'approved/old-id', asset_folder: 'archive' }, 'approved'), false);
  assert.equal(assetIsInWorkspaceFolder({ public_id: 'approved/travel/image', folder: 'approved/travel' }, 'approved'), true);
  assert.equal(assetIsInWorkspaceFolder({ public_id: 'elsewhere/image', folder: 'elsewhere' }, 'approved'), false);
});

test('agent candidate and draft outputs omit delivery URLs', () => {
  const candidate = agentCandidate({
    id: 'asset-1', public_id: 'travel/one', filename: 'one', tags: [], context: {}, metadata: {},
    source_url: 'https://source.example', secure_url: 'https://source.example',
    preview_url: 'https://preview.example', download_url: 'https://download.example',
    agent_download_url: 'https://agent-download.example',
  });
  assert.equal(candidate.preview_url, 'https://preview.example');
  assert.equal('source_url' in candidate, false);
  assert.equal('download_url' in candidate, false);
  assert.equal('agent_download_url' in candidate, false);

  const draft = agentDraftPack({
    id: 'pack-1', org_id: 'org-1', title: 'Travel', brief: 'Travel images', channels: [], notes: null,
    status: 'draft', created_by: 'agent', reviewed_by: null, reviewed_at: null,
    created_at: '2026-09-18T00:00:00Z', updated_at: '2026-09-18T00:00:00Z',
    assets: [{
      asset_id: 'asset-1', public_id: 'travel/one', filename: 'one',
      source_url: 'https://source.example', download_url: 'https://download.example',
      preview_url: 'https://preview.example', tags: [], campaign: null, usage_rights: null,
      description: null, rationale: null, variants: [{ id: 'square', label: 'Square', width: 1, height: 1, delivery_url: 'https://variant.example' }],
    }],
  });
  assert.deepEqual(draft.assets[0], { public_id: 'travel/one', preview_url: 'https://preview.example' });
});

test('visual descriptions become searchable embedding content', () => {
  const description = parseAssetVisualDescription(JSON.stringify({
    description: 'A cyclist rides along a coastal road at golden hour.',
    subjects: ['cyclist'],
    setting: ['coastal road'],
    mood: ['adventurous'],
    colors: ['golden'],
    visual_tags: ['travel', 'outdoors'],
    visible_text: [],
  }));
  const content = buildEmbeddingText({
    public_id: 'campaign/ride',
    filename: 'IMG_1024.jpg',
    tags: ['launch'],
    visual_description: description.description,
    visual_tags: visualDescriptionTerms(description),
  });

  assert.match(content, /cyclist rides along a coastal road/i);
  assert.match(content, /adventurous/);
  assert.match(content, /travel/);
});
