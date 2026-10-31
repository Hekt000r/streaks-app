import React, { useEffect, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useHabits } from '../src/core/store';
import * as backend from '../src/core/backend';
import { PermissionStatus } from '../src/core/types';
import { Action, ErrorBanner, Field, Header, Icon, Loading, Notice, Panel, Screen, SectionTitle, s } from '../src/ui/components';
import { C, clock, parseClock } from '../src/ui/theme';

export default function SettingsScreen() {
  const { snapshot, run, refresh } = useHabits();
  const [permission, setPermission] = useState<PermissionStatus | null>(null);
  const [cap, setCap] = useState('12');
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  useEffect(() => {
    const check = () => { void backend.getPermissionStatus().then(setPermission).catch(() => {}); };
    check();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') check(); });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (snapshot) { setCap(String(snapshot.settings.dailyCap)); setQuietStart(clock(snapshot.settings.quietStart)); setQuietEnd(clock(snapshot.settings.quietEnd)); }
  }, [snapshot?.settings.dailyCap, snapshot?.settings.quietStart, snapshot?.settings.quietEnd]);
  if (!snapshot) return <Loading />;
  const settings = snapshot.settings;
  const setOption = async (key: 'sound' | 'haptics' | 'reducedMotion', value: boolean) => {
    setBusy(true); try { await run({ type: 'settings', settings: { ...settings, [key]: value } }); } catch { /* banner */ } finally { setBusy(false); }
  };
  const save = async () => {
    const dailyCap = Number(cap), start = parseClock(quietStart), end = parseClock(quietEnd);
    if (!Number.isSafeInteger(dailyCap) || dailyCap < 1 || dailyCap > 100) { setValidation('Choose a daily alert cap between 1 and 100.'); return; }
    if (start === null || end === null) { setValidation('Enter quiet-hour times in 24-hour HH:MM format.'); return; }
    setValidation(null); setBusy(true);
    try { await run({ type: 'settings', settings: { ...settings, dailyCap, quietStart: start, quietEnd: end } }); Alert.alert('Your rules. Saved.', 'Reminder limits and quiet hours are updated.'); } catch { /* banner */ } finally { setBusy(false); }
  };
  const permissionAction = async () => {
    try {
      const result = await backend.requestNotificationPermission(); setPermission(result);
      if (!result.granted || !result.channelEnabled) await backend.openNotificationSettings();
    } catch (error) { Alert.alert('Couldn’t open notification controls', error instanceof Error ? error.message : 'Try Android Settings → Apps → Streaks → Notifications.'); }
  };
  const backup = async () => {
    setBackupBusy(true);
    try { await backend.shareBackup(); } catch (error) { Alert.alert('Backup didn’t finish', error instanceof Error ? error.message : 'Please try again.'); } finally { setBackupBusy(false); }
  };
  const restore = () => Alert.alert('Replace this phone’s progress?', 'Importing a backup replaces your current habits, history, freezes, and settings. Export a backup first if you want to keep them.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Choose backup', style: 'destructive', onPress: () => { void (async () => {
    setBackupBusy(true); try { const result = await backend.pickBackup(); if (result) { await refresh(); Alert.alert('Back in your groove', 'Your backup is restored, and reminders have been rebuilt.'); } } catch (error) { Alert.alert('Backup wasn’t restored', error instanceof Error ? error.message : 'The file could not be imported. Your existing data is unchanged.'); } finally { setBackupBusy(false); }
  })(); } }]);
  const notificationsOn = permission?.granted && permission?.channelEnabled;
  return <Screen tabs><Header title="Your rules." subtitle="MAKE IT WORK FOR YOU" /><ErrorBanner />
    <Panel><View style={styles.row}><View style={[styles.permissionIcon, notificationsOn && { backgroundColor: '#D4FF6414' }]}><Icon name={notificationsOn ? 'notifications' : 'notifications-off-outline'} color={notificationsOn ? C.lime : C.orange} size={23} /></View><View style={{ flex: 1, gap: 5 }}><Text style={s.sectionTitle}>{permission ? notificationsOn ? 'Nudges are on' : 'Nudges are off' : 'Your notification controls'}</Text><Text style={s.hint}>{notificationsOn ? 'Your future self has backup.' : 'Enable notifications so we can keep you honest.'}</Text></View></View><Action title={notificationsOn ? 'Android notification settings' : 'Enable reminders'} secondary icon="notifications-outline" onPress={() => { if (notificationsOn) void backend.openNotificationSettings().catch(() => {}); else void permissionAction(); }} /><Pressable accessibilityRole="button" onPress={() => { void backend.getPermissionStatus().then(setPermission).catch(() => {}); }} style={styles.textButton}><Text style={styles.textButtonLabel}>Refresh notification status</Text></Pressable></Panel>
    <SectionTitle title="Persistent. On your terms." />
    <Panel><View style={styles.row}><View style={styles.pill}><Text style={styles.pillText}>ESCALATING PRESSURE</Text></View></View><Text style={s.body}>A nudge every 2 hours. Every hour in the final 3 hours. Every 30 minutes in the final hour.</Text><Text style={s.hint}>A habit’s reminder window controls the finish line. Complete it or snooze it for 30 minutes to get some peace. Set matching quiet times to disable quiet hours.</Text><Field label="Maximum alerts per day · across all habits" value={cap} onChangeText={setCap} keyboardType="number-pad" maxLength={3} hint="1–100 alerts. When habits are due together, we bundle them into one notification." /><View style={styles.row}><View style={{ flex: 1 }}><Field label="Quiet from · 24h" value={quietStart} onChangeText={setQuietStart} maxLength={5} keyboardType="numbers-and-punctuation" /></View><View style={{ flex: 1 }}><Field label="Quiet until · 24h" value={quietEnd} onChangeText={setQuietEnd} maxLength={5} keyboardType="numbers-and-punctuation" /></View></View>{validation && <Text accessibilityLiveRegion="polite" style={{ color: C.coral, fontSize: 13 }}>{validation}</Text>}<Action title="Save reminder rules" loading={busy} onPress={() => void save()} /></Panel>
    <Notice icon="phone-portrait-outline">Android may delay reminders to save battery. After force-stopping the app, reopen it to resume scheduling. Your streak still follows the actual completion day.</Notice>
    <Action title="Send a test notification" secondary icon="paper-plane-outline" onPress={() => { void backend.testNotification().then(() => Alert.alert('Test sent', 'Check your notifications. If it didn’t appear, check Android’s notification and channel settings.')).catch(error => Alert.alert('Test couldn’t be sent', error instanceof Error ? error.message : 'Check your notification permissions.')); }} />
    <SectionTitle title="Make your wins feel right" />
    <Panel><Toggle title="Celebration sounds" description="A little soundtrack for showing up." value={settings.sound} disabled={busy} onChange={v => void setOption('sound', v)} /><View style={styles.divider} /><Toggle title="Haptic feedback" description="Feel the checkmark, not just see it." value={settings.haptics} disabled={busy} onChange={v => void setOption('haptics', v)} /><View style={styles.divider} /><Toggle title="Reduced motion" description="The same wins, with quieter animations." value={settings.reducedMotion} disabled={busy} onChange={v => void setOption('reducedMotion', v)} /></Panel>
    <SectionTitle title="Your progress belongs to you" />
    <Panel><View style={styles.row}><Icon name="shield-checkmark-outline" color={C.purple} size={27} /><Text style={s.sectionTitle}>Local. Personal. Yours.</Text></View><Text style={s.body}>Your habits stay on this phone. No account, no server, no analytics.</Text><Text style={s.hint}>Export a backup before changing phones or uninstalling. Backup files include your habit names and progress; keep them somewhere private.</Text><Action title="Export a backup" secondary icon="download-outline" disabled={backupBusy} onPress={() => void backup()} /><Action title="Restore from backup" secondary icon="cloud-upload-outline" disabled={backupBusy} onPress={restore} /></Panel>
    <View style={styles.footer}><View style={styles.row}><Icon name="flame" color={C.lime} size={18} /><Text style={styles.brand}>STREAKS</Text></View><Text style={s.hint}>A little every day. A lot over time.</Text><Text style={{ color: C.dim, fontSize: 10 }}>Version 1.0.0 · Made for your momentum</Text></View>
  </Screen>;
}
function Toggle({ title, description, value, disabled, onChange }: { title: string; description: string; value: boolean; disabled: boolean; onChange: (v: boolean) => void }) {
  return <View style={styles.row}><View style={{ flex: 1, gap: 5 }}><Text style={styles.toggleTitle}>{title}</Text><Text style={s.hint}>{description}</Text></View><Switch accessibilityLabel={title} value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: C.border, true: '#D4FF6477' }} thumbColor={value ? C.lime : C.muted} /></View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, permissionIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#FF9D6614', alignItems: 'center', justifyContent: 'center' }, textButton: { alignSelf: 'center', minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }, textButtonLabel: { color: C.muted, fontSize: 11, textDecorationLine: 'underline' }, pill: { backgroundColor: '#D4FF6412', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7 }, pillText: { color: C.lime, fontSize: 8, fontWeight: '800', letterSpacing: 1 }, divider: { height: 1, backgroundColor: C.border }, toggleTitle: { color: C.text, fontSize: 14, fontWeight: '700' }, footer: { alignItems: 'center', gap: 10, paddingVertical: 13 }, brand: { color: C.text, fontSize: 11, fontWeight: '800', letterSpacing: 2 } });
