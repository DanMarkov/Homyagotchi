import { test } from 'node:test';
import assert from 'node:assert';
import { tick, feed, play, petState, PET_STATES } from '../src/core/pet.js';
import { freshState } from '../src/core/store.js';

test('tick decays stats and floors at 0', () => {
  const s = freshState();
  tick(s, 10);
  assert.equal(s.health, 77);
  assert.equal(s.mood, 67.5);
  tick(s, 10000);
  assert.equal(s.health, 0);
  assert.equal(s.mood, 0);
  assert.equal(s.sec, 0);
});

test('feed caps at 100 and sets eating state', () => {
  const s = freshState();
  s.health = 95;
  feed(s);
  assert.equal(s.health, 100);
  assert.equal(s._eating, 8);
  assert.equal(petState(s), PET_STATES.EATING);
});

test('low health means sick state', () => {
  const s = freshState();
  s.health = 10;
  assert.equal(petState(s), PET_STATES.SICK);
});

test('high mood means happy state', () => {
  const s = freshState();
  s.mood = 80;
  assert.equal(petState(s), PET_STATES.HAPPY);
});

test('play boosts mood and drains health', () => {
  const s = freshState();
  play(s);
  assert.equal(s.mood, 82);
  assert.equal(s.health, 78);
  assert.equal(petState(s), PET_STATES.JUMPING);
});
