import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useHabits } from '../../src/core/store';
import { requestNotificationPermission } from '../../src/core/backend';
import { HabitInput } from '../../src/core/types';
import { Action, ErrorBanner, Field, Header, Icon, Loading, Notice, Panel, Screen, SectionTitle, s } from '../../src/ui/components';
import { C, clock, habitColors, habitIcons, parseClock, weekdayLabels, weekdayNames } from '../../src/ui/theme';

const initial: HabitInput = { name: '', icon: '🌱', color: C.lime, days: [1, 2, 3, 4, 5, 6, 7], target: 1, unit: 'times', reminderStart: 540, reminderEnd: 1320 };
const presets = [{ name: 'Drink water', icon: '💧', color: C.blue, target: 8, unit: 'glasses' }, { name: 'Move my body', icon: '🏃', color: C.orange, target: 30, unit: 'minutes' }, { name: 'Read a little', icon: '📚', color: C.purple, target: 20, unit: 'pages' }];
export default function EditHabitScreen() {
  const { id, onboarding } = useLocalSearchParams<{ id?: string; onboarding?: string }>();
  const { snapshot, run } = useHabits();
  const [form, setForm] = useState<HabitInput>(initial);
  const [targetText, setTargetText] = useState('1');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('22:00');
  const [numeric, setNumeric] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const hydrated = useRef<string | null>(null);
  const existing = snapshot?.habits.find(h => h.id === id);
  useEffect(() => {
    if (existing && hydrated.current !== existing.id) { setForm(existing); setNumeric(existing.target !== 1); setTargetText(String(existing.target)); setStart(clock(existing.reminderStart)); setEnd(clock(existing.reminderEnd)); hydrated.current = existing.id; }
  }, [existing]);
  if (!snapshot) return <Loading />;
  if (id && !existing) return <Screen><Header title="Habit not found" back /><Notice>This habit may have been deleted.</Notice></Screen>;
  const patch = (part: Partial<HabitInput>) => setForm(f => ({ ...f, ...part }));
  const save = async () => {
    if (busyRef.current) return;
    const target = numeric ? Number(targetText) : 1;
    const reminderStart = parseClock(start), reminderEnd = parseClock(end);
    if (!form.name.trim()) { setValidation('Give your habit a name first.'); return; }
    if (!form.days.length) { setValidation('Choose at least one scheduled day.'); return; }
    if (!Number.isSafeInteger(target) || target < 1 || target > 1000000) { setValidation('Your goal must be a whole number between 1 and 1,000,000.'); return; }
    if (numeric && !form.unit.trim()) { setValidation('Add a unit, such as glasses, pages, or minutes.'); return; }
    if (reminderStart === null || reminderEnd === null || reminderStart >= reminderEnd) { setValidation('Use 24-hour times (HH:MM), with the start before the cutoff.'); return; }
    setValidation(null); setBusy(true); busyRef.current = true;
    try {
      const habit = { ...form, name: form.name.trim(), target, unit: numeric ? form.unit.trim() : 'times', reminderStart, reminderEnd };
      if (id) await run({ type: 'edit', id, habit }); else await run({ type: 'create', habit, onboard: onboarding === '1' });
      if (onboarding === '1') {
        try { const result = await requestNotificationPermission(); if (!result.granted) Alert.alert('Your habit is ready', 'Reminders are off for now. Enable them any time in Settings.'); } catch { Alert.alert('Your habit is ready', 'You can enable reminders in Settings.'); }
      }
      if (id && router.canGoBack()) router.back(); else router.replace('/');
    } catch { /* shared banner */ } finally { setBusy(false); busyRef.current = false; }
  };
  return <Screen>
    <Header title={id ? 'Make it yours.' : 'A new promise.'} subtitle={id ? 'EDIT HABIT' : onboarding === '1' ? 'YOUR FIRST STEP' : 'BUILD SOMETHING GOOD'} back />
    <ErrorBanner />
    {!id && <><SectionTitle title="A little inspiration" /><View style={styles.presets}>{presets.map(p => <Pressable key={p.name} accessibilityRole="button" accessibilityLabel={`Use ${p.name} template`} onPress={() => { patch(p); setNumeric(true); setTargetText(String(p.target)); }} style={styles.preset}><Text style={{ fontSize: 22 }}>{p.icon}</Text><Text style={styles.presetText}>{p.name}</Text></Pressable>)}</View></>}
    <Field label="What’s your promise?" placeholder="e.g. Read before bed" value={form.name} onChangeText={name => patch({ name })} maxLength={80} autoCapitalize="sentences" />
    <View style={{ gap: 11 }}><Text style={s.label}>Give it a personality</Text><View style={styles.icons}>{habitIcons.map(icon => <Pressable key={icon} accessibilityRole="radio" accessibilityLabel={`Habit icon ${icon}`} accessibilityState={{ selected: form.icon === icon }} onPress={() => patch({ icon })} style={[styles.icon, form.icon === icon && { borderColor: form.color, backgroundColor: `${form.color}18` }]}><Text style={{ fontSize: 23 }}>{icon}</Text></Pressable>)}</View><View style={styles.colors}>{habitColors.map((color, i) => <Pressable key={color} accessibilityRole="radio" accessibilityLabel={`${['Lime', 'Orange', 'Purple', 'Blue', 'Coral', 'Yellow'][i]} habit color`} accessibilityState={{ selected: form.color === color }} onPress={() => patch({ color })} style={[styles.colorHit, { borderColor: form.color === color ? color : 'transparent' }]}><View style={[styles.color, { backgroundColor: color }]}>{form.color === color && <Icon name="checkmark" size={17} color={C.bg} />}</View></Pressable>)}</View></View>
    <SectionTitle title="What counts as a win?" />
    <View style={styles.segment}>{[{ label: 'Just show up', value: false }, { label: 'Hit a number', value: true }].map(option => <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ selected: numeric === option.value }} onPress={() => { setNumeric(option.value); if (option.value && targetText === '1') setTargetText('8'); }} style={[styles.segmentOption, numeric === option.value && styles.segmentSelected]}><Text style={[styles.segmentText, numeric === option.value && { color: C.text }]}>{option.label}</Text></Pressable>)}</View>
    {numeric ? <View style={styles.row}><View style={{ flex: 1 }}><Field label="Daily target" value={targetText} onChangeText={setTargetText} keyboardType="number-pad" maxLength={7} placeholder="8" /></View><View style={{ flex: 1.8 }}><Field label="Unit" value={form.unit} onChangeText={unit => patch({ unit })} placeholder="glasses, pages, minutes…" maxLength={24} autoCapitalize="none" /></View></View> : <Text style={s.hint}>One checkmark completes this habit for the day.</Text>}
    <SectionTitle title="Make room for it" />
    <View style={styles.days}>{weekdayLabels.map((label, index) => {
      const selected = form.days.includes(index + 1);
      return <Pressable key={index} accessibilityRole="checkbox" accessibilityLabel={weekdayNames[index]} accessibilityState={{ checked: selected }} onPress={() => patch({ days: selected ? form.days.filter(d => d !== index + 1) : [...form.days, index + 1].sort((a, b) => a - b) })} style={[styles.day, selected && styles.daySelected]}><Text style={[styles.dayText, selected && { color: C.bg }]}>{label}</Text></Pressable>;
    })}</View>
    <Panel><View style={styles.row}><Icon name="notifications-outline" color={C.lime} /><Text style={s.sectionTitle}>The nudge window</Text></View><Text style={s.hint}>Gentle at first. More persistent near the cutoff. Stops as soon as you finish.</Text><View style={styles.row}><View style={{ flex: 1 }}><Field label="Start · 24h" value={start} onChangeText={setStart} placeholder="09:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View><View style={{ flex: 1 }}><Field label="Cutoff · 24h" value={end} onChangeText={setEnd} placeholder="22:00" keyboardType="numbers-and-punctuation" maxLength={5} /></View></View><Text style={s.hint}>Global quiet hours and the daily alert cap still apply. You can log progress until midnight.</Text></Panel>
    {id && <Notice>Schedule and goal changes start tomorrow. Your name, icon, color, and reminder window update immediately.</Notice>}
    {validation && <View accessibilityLiveRegion="polite" style={styles.validation}><Icon name="alert-circle-outline" color={C.coral} /><Text style={{ color: C.coral, flex: 1, fontSize: 13, lineHeight: 20 }}>{validation}</Text></View>}
    <Action title={id ? 'Save my changes' : 'Let’s make it happen'} icon={id ? 'checkmark' : 'arrow-forward'} onPress={() => void save()} loading={busy} />
    <Text style={[s.hint, { textAlign: 'center' }]}>Every scheduled day is a chance to start something.</Text>
  </Screen>;
}
const styles = StyleSheet.create({
  presets: { flexDirection: 'row', gap: 9 }, preset: { flex: 1, gap: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 17, padding: 13 }, presetText: { color: C.muted, fontSize: 10, fontWeight: '700', lineHeight: 15 }, icons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, icon: { height: 47, width: 47, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }, colors: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' }, colorHit: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, color: { height: 29, width: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, segment: { flexDirection: 'row', padding: 5, borderRadius: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border }, segmentOption: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, segmentSelected: { backgroundColor: C.raised }, segmentText: { color: C.dim, fontSize: 13, fontWeight: '700' }, row: { flexDirection: 'row', gap: 12, alignItems: 'center' }, days: { flexDirection: 'row', gap: 6 }, day: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel }, daySelected: { backgroundColor: C.lime, borderColor: C.lime }, dayText: { color: C.muted, fontWeight: '800', fontSize: 12 }, validation: { flexDirection: 'row', gap: 10, backgroundColor: '#FF7F8312', padding: 14, borderRadius: 14 },
});
