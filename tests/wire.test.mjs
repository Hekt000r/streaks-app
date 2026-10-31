import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSnapshot, assertBackupText } from '../src/core/wire.mjs';

const snapshot = { date: '2026-10-23', habits: [], settings: {}, onboarded: false };
test('empty first-launch snapshot is accepted', () => {
  assert.deepEqual(parseSnapshot(JSON.stringify(snapshot)), snapshot);
});
test('corrupt bridge responses fail before reaching screens', () => {
  for (const response of [null, [], { ...snapshot, date: null }, { ...snapshot, habits: {} }, { ...snapshot, onboarded: 'false' }]) {
    assert.throws(() => parseSnapshot(JSON.stringify(response)));
  }
});
test('malformed individual habit fails with a recoverable error', () => {
  assert.throws(() => parseSnapshot(JSON.stringify({ ...snapshot, habits: [{ id: 'a', name: 'Read', days: [1] }] })), /habit data/);
});
test('non-JSON, primitive and oversized backups are rejected before native import', () => {
  for (const input of ['not json', 'null', '[]', '42', '"backup"']) assert.throws(() => assertBackupText(input));
  assert.throws(() => assertBackupText('x'.repeat(10 * 1024 * 1024 + 1)), /too large/);
});
test('backup parser preserves input for full transactional native validation', () => {
  const backup = { version: 1, habits: [], settings: {} };
  assert.deepEqual(assertBackupText(JSON.stringify(backup)), backup);
});
