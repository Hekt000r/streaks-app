import { requireOptionalNativeModule } from 'expo-modules-core';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Command, PermissionStatus, Snapshot } from './types';
import { parseSnapshot, assertBackupText } from './wire.mjs';

type NativeEngine = {
  getSnapshot(): Promise<string>;
  command(json: string): Promise<string>;
  exportBackup(): Promise<string>;
  importBackup(json: string): Promise<string>;
  getPermissionStatus(): Promise<PermissionStatus>;
  requestNotificationPermission(): Promise<PermissionStatus>;
  openNotificationSettings(): Promise<void>;
  testNotification(): Promise<void>;
  addListener(name: string, listener: (event: { snapshot: string }) => void): { remove(): void };
};

const native = requireOptionalNativeModule<NativeEngine>('StreakEngine');
function engine(): NativeEngine {
  if (!native) throw new Error('Streaks needs its Android development build. Install the APK or run npm run android; Expo Go does not contain the habit engine.');
  return native;
}
function snapshot(json: string): Snapshot { return parseSnapshot(json) as Snapshot; }
export async function getSnapshot() { return snapshot(await engine().getSnapshot()); }
export async function execute(command: Command) { return snapshot(await engine().command(JSON.stringify(command))); }
export function subscribe(listener: (value: Snapshot) => void) {
  return native?.addListener('onChange', ({ snapshot: json }) => listener(snapshot(json))) ?? { remove() {} };
}
export function getPermissionStatus() { return engine().getPermissionStatus(); }
export function requestNotificationPermission() { return engine().requestNotificationPermission(); }
export function openNotificationSettings() { return engine().openNotificationSettings(); }
export function testNotification() { return engine().testNotification(); }
export async function shareBackup() {
  const contents = await engine().exportBackup();
  const file = new File(Paths.cache, 'streaks-backup.json');
  try {
    file.create({ overwrite: true });
    file.write(contents);
    if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Streaks backup' });
  } finally {
    // Cache backup contains private history; retain no temporary copy after the share sheet closes.
    try { if (file.exists) file.delete(); } catch { /* Cleanup must not turn a saved operation into a false failure. */ }
  }
}
export async function pickBackup(): Promise<Snapshot | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true });
  if (picked.canceled) return null;
  const file = new File(picked.assets[0].uri);
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error('Backup is too large (maximum 10 MB).');
    const text = await file.text();
    assertBackupText(text);
    return snapshot(await engine().importBackup(text));
  } finally { try { if (file.exists) file.delete(); } catch { /* OS will evict private cache if cleanup is unavailable. */ } }
}
