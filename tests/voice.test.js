// Which device voice the announcer uses: Microsoft David whenever the device has it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseVoice } from '../src/audio.js';

const v = (name, lang) => ({ name, lang });
const DAVID = v('Microsoft David - English (United States)', 'en-US');
const HEERA = v('Microsoft Heera - English (India)', 'en-IN');
const ZIRA = v('Microsoft Zira - English (United States)', 'en-US');
const GOOGLE_UK = v('Google UK English Male', 'en-GB');
const HINDI = v('Google हिन्दी', 'hi-IN');

test('Microsoft David is picked whenever the device has it', () => {
  assert.equal(chooseVoice([HEERA, ZIRA, HINDI, DAVID]), DAVID);
  assert.equal(chooseVoice([DAVID]), DAVID);
});

test('Edge lists David under a slightly different name, and that counts too', () => {
  const edgeDavid = v('Microsoft David Desktop - English (United States)', 'en-US');
  assert.equal(chooseVoice([HEERA, edgeDavid]), edgeDavid);
});

test('without David (phones), the old choice stands: Indian English, then British, then any English', () => {
  assert.equal(chooseVoice([ZIRA, HEERA, HINDI]), HEERA);
  assert.equal(chooseVoice([ZIRA, GOOGLE_UK]), GOOGLE_UK);
  assert.equal(chooseVoice([HINDI, ZIRA]), ZIRA);
  assert.equal(chooseVoice([HINDI]), null);
  assert.equal(chooseVoice([]), null);
});
