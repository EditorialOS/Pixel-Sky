import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReadableCloudinaryAssets, assetIsInWorkspaceFolder } from '../lib/cloudinary';
import { buildTagExpression, rankStrictAssets } from '../lib/dam-search';
import { agentAssetUseRequest, agentCandidate, agentDraftPack } from '../lib/agent-output';
import { assertApprovalActive, assertApprovedVersion, AssetUseError } from '../lib/asset-use-requests';
import { parseAssetVisualDescription, visualDescriptionTerms } from '../lib/asset-description';
import { buildEmbeddingText } from '../lib/embeddings';
import { mcpOAuthResource, UNIVERSAL_MCP_PATH } from '../lib/mcp-oauth';

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

test('Cloudinary asset visibility failures are not reported as an empty library', () => {
  assert.doesNotThrow(() => assertReadableCloudinaryAssets(0, 0));
  assert.doesNotThrow(() => assertReadableCloudinaryAssets(15, 15));
  assert.throws(
    () => assertReadableCloudinaryAssets(15, 0),
    /API key cannot read their details/,
  );
});

test('agent candidate and draft outputs omit delivery URLs', () => {
  const candidate = agentCandidate({
    id: 'asset-1', asset_id: 'cloudinary-asset-1', version: 3, public_id: 'travel/one', filename: 'one', tags: [], context: {}, metadata: {},
    source_url: 'https://source.example', secure_url: 'https://source.example',
    preview_url: 'https://preview.example', download_url: 'https://download.example',
    agent_download_url: 'https://agent-download.example',
  });
  assert.equal(candidate.preview_url, 'https://preview.example');
  assert.equal('source_url' in candidate, false);
  assert.equal('download_url' in candidate, false);
  assert.equal('agent_download_url' in candidate, false);
  assert.equal('id' in candidate, false);
  assert.equal('asset_id' in candidate, false);
  assert.equal('version' in candidate, false);

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

test('agent asset-use output omits tenant and identity fields', () => {
  const request = agentAssetUseRequest({
    id: 'request-1', org_id: 'org-secret', public_id: 'travel/one', asset_id: 'asset-secret',
    asset_version: 3, filename: 'one', preview_url: 'https://preview.example', usage_rights: null,
    credit: null, tags: ['travel'], channel: 'email', campaign: 'Autumn', placement: 'hero',
    region: 'US', purpose: 'Launch', status: 'pending', requested_by: 'user-secret', reviewed_by: null,
    reviewed_at: null, expires_at: null, created_at: '2026-09-21T00:00:00Z', updated_at: '2026-09-21T00:00:00Z',
  });
  assert.equal(request.id, 'request-1');
  assert.equal('org_id' in request, false);
  assert.equal('asset_id' in request, false);
  assert.equal('requested_by' in request, false);
  assert.equal('reviewed_by' in request, false);
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

test('public ChatGPT MCP uses one universal resource while private connections stay workspace-bound', () => {
  const request = new Request('https://light-dam-v1.vercel.app/api/mcp/oauth/authorize');
  assert.deepEqual(
    mcpOAuthResource(`https://light-dam-v1.vercel.app${UNIVERSAL_MCP_PATH}`, request),
    { kind: 'universal' },
  );
  assert.deepEqual(
    mcpOAuthResource('https://light-dam-v1.vercel.app/api/mcp/3ae5ccb8-aa09-4168-a824-622d1579caad', request),
    { kind: 'connection', connectionId: '3ae5ccb8-aa09-4168-a824-622d1579caad' },
  );
  assert.equal(mcpOAuthResource('https://evil.example/api/mcp/chatgpt', request), null);
});
