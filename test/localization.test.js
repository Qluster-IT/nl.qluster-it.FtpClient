'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const languages = ['en', 'nl', 'de', 'fr', 'it', 'es', 'sv', 'no', 'da', 'ru', 'pl', 'ko', 'ar'];
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const placeholders = text => (text.match(/\[\[[^\]]+\]\]|__[a-zA-Z]+__/g) || []).sort();

function flatten(value, prefix = '', result = {}) {
  for (const [key, item] of Object.entries(value)) {
    const name = prefix ? prefix + '.' + key : key;
    if (typeof item === 'string') result[name] = item;
    else flatten(item, name, result);
  }
  return result;
}

test('every runtime language covers the repair UI and preserves interpolation parameters', () => {
  const english = flatten(read('.homeycompose/locales/en.json'));
  for (const lang of languages) {
    const locale = flatten(read('.homeycompose/locales/' + lang + '.json'));
    assert.deepEqual(Object.keys(locale).sort(), Object.keys(english).sort(), lang);
    for (const [key, text] of Object.entries(locale)) {
      assert.ok(text.trim().length > 0, lang + ':' + key);
      assert.ok(!text.includes('\ufffd'), lang + ':' + key);
      assert.deepEqual(placeholders(text), placeholders(english[key]), lang + ':' + key);
    }
  }
  const sources = ['app.js', 'drivers/ftpconnection/driver.js', 'drivers/ftpconnection/device.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8'));
  for (const name of ['repair', 'pair']) {
    const folder = path.join(root, 'drivers', 'ftpconnection', name);
    for (const file of fs.readdirSync(folder).filter(file => /\.(js|html)$/.test(file))) sources.push(fs.readFileSync(path.join(folder, file), 'utf8'));
  }
  for (const source of sources) {
    for (const [key] of source.matchAll(/\b(?:repair|errors|pair|monitor)\.[a-zA-Z]+/g)) assert.ok(key in english, key);
  }
});

test('Compose labels and Flow titles cover every Homey language without changing Flow placeholders', () => {
  function check(value, location) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.en === 'string' || Array.isArray(value.en)) {
      for (const lang of languages) {
        assert.ok(lang in value, location + ':' + lang);
        if (typeof value.en === 'string') assert.deepEqual(placeholders(value[lang]), placeholders(value.en), location + ':' + lang);
      }
      return;
    }
    for (const [key, item] of Object.entries(value)) check(item, location + '.' + key);
  }
  check(read('.homeycompose/app.json'), 'app');
  check(read('drivers/ftpconnection/driver.compose.json'), 'driver');
  for (const directory of ['capabilities', 'flow/actions', 'flow/conditions', 'flow/triggers']) {
    const folder = path.join('.homeycompose', directory);
    for (const file of fs.readdirSync(path.join(root, folder))) check(read(path.join(folder, file)), file);
  }
});
