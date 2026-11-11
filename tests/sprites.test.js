import { test } from 'node:test';
import assert from 'node:assert';

/* Регрессионный тест бага «в магазине всё пропало»: composeHat раньше возвращал МАССИВ строк,
   а drawPixelArt ждал строку (art.trim()) — createSprite падал на первой шляпе, и renderShop()
   умирал, не дорисовав остальные секции. Здесь минимальный DOM-стаб и прогон всех фабрик со шляпами. */

global.document = {
  createElement: () => ({
    className: '', style: {}, width: 0, height: 0,
    children: [],
    appendChild(c) { this.children.push(c); return c; },
    getContext: () => new Proxy({}, { get: (t, p) => (p === 'canvas' ? {} : () => {}) })
  })
};

import { createSprite, composeHat, SPRITE_FACTORIES } from '../src/render/pixel-sprites.js';

test('composeHat returns a STRING (drawPixelArt requires string art)', () => {
  const out = composeHat('AAAA\nBBBB', 'hat_cap', 0, 0);
  assert.equal(typeof out, 'string');
  assert.ok(out.split('\n').every((l) => typeof l === 'string'));
  // null / неизвестная шляпа — passthrough без изменений
  assert.equal(composeHat('AAAA\nBBBB', null, 0, 0), 'AAAA\nBBBB');
  assert.equal(composeHat('AAAA\nBBBB', 'hat_unknown', 0, 0), 'AAAA\nBBBB');
});

test('all hat sprites render without throwing on every Hori context (regression)', () => {
  const hats = ['hat_cap', 'hat_bow', 'hat_crown', 'hat_ph', null];
  for (const hat of hats) {
    assert.doesNotThrow(() => createSprite('hori_head', 3, hat), 'hori_head ' + hat);
    assert.doesNotThrow(() => createSprite('hori_body', 3, hat), 'hori_body ' + hat);
    assert.doesNotThrow(() => createSprite('hori_desk', 4, hat), 'hori_desk ' + hat);
  }
});

test('food + satiety icons render without throwing', () => {
  for (const name of ['food_seeds_icon', 'food_cake_icon', 'food_tea_icon', 'sat_icon']) {
    assert.ok(SPRITE_FACTORIES[name], 'factory exists: ' + name);
    assert.doesNotThrow(() => createSprite(name, 3));
  }
});

test('hat art overlays onto the head area (cap outline lands on top rows)', () => {
  const base = '....................\n....................\n....................\n....................';
  const withHat = composeHat(base, 'hat_cap', 0, 0);
  assert.ok(withHat.split('\n')[0].includes('K'), 'cap outline lands on row 0');
  const head = createSprite('hori_head', 2, 'hat_cap');
  assert.ok(head.width > 0 && head.height > 0);
});
