import { test } from 'node:test';
import assert from 'node:assert';

global.window = { __SUPABASE_URL__: 'https://test.supabase.co', __SUPABASE_ANON_KEY__: 'anon-test' };

const { isCloudConfigured, getSession } = await import('../src/core/cloud.js');

test('isCloudConfigured true when both keys set', () => {
  assert.equal(isCloudConfigured(), true);
});

test('getSession returns null before sign-in', () => {
  assert.equal(getSession(), null);
});
