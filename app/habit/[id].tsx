import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useHabits } from '../../src/core/store';
import { playCompletionSound } from '../../src/core/feedback';
import { Occurrence } from '../../src/core/types';
import { Action, ErrorBanner, Field, Glyph, Header, Icon, IconButton, Loading, Notice, Panel, Screen, SectionTitle, s } from '../../src/ui/components';
import { Celebration, Reward } from '../../src/ui/Celebration';
import { C, clock, commandId, dateLabel, weekdayNames } from '../../src/ui/theme';

const statusColors: Record<Occurrence['status'], string> = { completed: C.lime, frozen: C.blue, missed: C.coral, pending: C.dim };
export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, run } = useHabits();
  const habit = snapshot?.habits.find(h => h.id === id);
  const [value, setValue] = useState('0');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [reward, setReward] = useState<Reward | null>(null);
  useEffect(() => { setValue(String(habit?.today?.progress ?? 0)); }, [habit?.today?.progress]);
  if (!snapshot) return <Loading />;
  if (!habit) return <Screen><Header title="Habit not found" back /><Notice>This habit may have been deleted.</Notice><Action title="Back to my habits" onPress={() => router.replace('/habits')} /></Screen>;
  const occurrence = habit.today;
  const completed = occurrence?.status === 'completed';
  const progress = occurrence?.progress ?? 0;
  const target = occurrence?.target ?? habit.target;
  const apply = async (nextValue: number) => {
    if (busyRef.current) return;
    if (!Number.isSafeInteger(nextValue) || nextValue < 0 || nextValue > 1000000) { setValidation('Enter a whole number from 0 to 1,000,000.'); return; }
    setValidation(null); setBusy(true); busyRef.current = true;
    try {
      const updated = await run({ type: 'progress', id: habit.id, date: snapshot.date, value: nextValue, commandId: commandId() });
      const next = updated.habits.find(h => h.id === habit.id);
      if (!completed && next?.today?.status === 'completed') {
        if (updated.settings.haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (updated.settings.sound) void playCompletionSound();
        const scheduled = updated.habits.filter(h => !h.archived && h.today);
        setReward({ name: habit.name, streak: next.currentStreak, milestone: [3, 7, 14, 30, 60, 100].includes(next.currentStreak), dayComplete: scheduled.every(h => h.today?.status === 'completed') });
      }
    } catch { /* shared error banner */ } finally { setBusy(false); busyRef.current = false; }
  };
  const archive = () => Alert.alert(habit.archived ? 'Bring this promise back?' : 'Pause this promise?', habit.archived ? 'The habit returns to your active collection. Past history stays as it was.' : 'Archiving stops reminders and keeps your history. Today is exempt; your existing streak is preserved.', [{ text: 'Cancel', style: 'cancel' }, { text: habit.archived ? 'Bring it back' : 'Archive habit', onPress: () => { void run({ type: 'archive', id: habit.id, archived: !habit.archived }).catch(() => {}); } }]);
  const remove = () => Alert.alert('Delete this habit forever?', 'Its progress, history, and earned freezes will be removed. This cannot be undone.', [{ text: 'Keep it', style: 'cancel' }, { text: 'Delete habit', style: 'destructive', onPress: () => { void run({ type: 'delete', id: habit.id }).then(() => router.replace('/habits')).catch(() => {}); } }]);
  const calendar = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(`${snapshot.date}T12:00:00`); d.setDate(d.getDate() - 34 + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const record = date === snapshot.date ? occurrence : habit.history.find(h => h.date === date);
    return { date, day: d.getDate(), record };
  });
  return <Screen><Header title={habit.name} subtitle={habit.archived ? 'ON THE SHELF, NOT FORGOTTEN' : 'YOUR PROMISE TO YOU'} back right={!habit.archived ? <IconButton name="create-outline" label="Edit habit" onPress={() => router.push({ pathname: '/habit/edit', params: { id: habit.id } })} /> : null} /><ErrorBanner />
    <View style={[styles.streakHero, { borderColor: `${habit.color}40` }]}><Glyph icon={habit.icon} color={habit.color} size={62} /><View style={{ flex: 1 }}><Text style={styles.big}>{habit.currentStreak}<Text style={styles.bigUnit}> day streak</Text></Text><Text style={s.hint}>{habit.currentStreak ? 'A little proof that you can count on you.' : 'Every great streak starts with today.'}</Text></View><Icon name="flame" color={C.orange} size={35} /></View>
    <View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{habit.bestStreak}</Text><Text style={s.hint}>personal best</Text></View><View style={styles.stat}><Text style={styles.statValue}>{habit.completedTotal}</Text><Text style={s.hint}>promises kept</Text></View><View style={styles.stat}><Text style={[styles.statValue, { color: C.blue }]}>{habit.freezes}<Text style={{ fontSize: 15, color: C.dim }}> / 2</Text></Text><Text style={s.hint}>streak freezes</Text></View></View>
    {!habit.archived && occurrence ? <Panel><View style={styles.row}><Text style={[s.sectionTitle, { flex: 1 }]}>Today’s check-in</Text><Text style={{ color: completed ? C.lime : C.muted, fontSize: 11, fontWeight: '700' }}>{completed ? 'PROMISE KEPT ✓' : 'YOU’VE GOT THIS'}</Text></View><View style={styles.progressRow}><Text style={styles.progressNumber}>{progress}<Text style={{ color: C.dim, fontSize: 21 }}> / {target}</Text></Text><Text style={s.muted}>{target === 1 ? 'check-in' : habit.unit}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${Math.min(1, progress / target) * 100}%`, backgroundColor: habit.color }]} /></View>
      {!completed && <Action title={target === 1 ? 'Keep this promise' : `Add 1 ${habit.unit || 'unit'}`} icon={target === 1 ? 'checkmark' : 'add'} loading={busy} onPress={() => void apply(Math.min(1000000, progress + 1))} />}
      {target > 1 && <><Field label="Or enter today’s total" value={value} onChangeText={setValue} keyboardType="number-pad" maxLength={7} /><Action title="Save today’s total" secondary disabled={busy || value === String(progress) || value.trim() === ''} loading={busy} onPress={() => void apply(Number(value))} /></>}
      {validation && <Text accessibilityLiveRegion="polite" style={{ color: C.coral, fontSize: 13 }}>{validation}</Text>}
      {completed && <Action title="Correct today’s check-in" secondary disabled={busy} onPress={() => Alert.alert('Undo today’s completion?', 'Today’s progress will return to zero, and its streak and freeze rewards will be recalculated.', [{ text: 'Keep my win', style: 'cancel' }, { text: 'Undo check-in', onPress: () => void apply(0) }])} />}
      {!completed && <Pressable accessibilityRole="button" accessibilityLabel="Snooze reminders for 30 minutes" onPress={() => { void run({ type: 'snooze', id: habit.id, date: snapshot.date }).then(() => Alert.alert('A little breathing room', 'Reminders for this habit are snoozed for 30 minutes.')).catch(() => {}); }} style={styles.snooze}><Icon name="moon-outline" size={15} color={C.muted} /><Text style={s.hint}>Give me 30 minutes</Text></Pressable>}
    </Panel> : <Notice icon={habit.archived ? 'archive-outline' : 'calendar-outline'}>{habit.archived ? 'This habit is archived. Its reminders are off, and its history is saved.' : 'Not on the schedule today. Your streak is taking a well-earned breather.'}</Notice>}
    <Panel><View style={styles.row}><Icon name="snow-outline" color={C.blue} /><Text style={s.sectionTitle}>A little insurance</Text></View><Text style={s.body}>{habit.freezes === 2 ? 'Your freeze stash is full. Two missed scheduled days are covered.' : `${habit.nextFreezeIn} more ${habit.nextFreezeIn === 1 ? 'completion' : 'completions'} until your next freeze.`}</Text><Text style={s.hint}>A freeze automatically saves your streak on a missed day. It preserves your progress without adding another streak day.</Text></Panel>
    <SectionTitle title="The proof is in the showing up" aside="Last 35 days" />
    <Panel><View style={styles.calendar}>{calendar.map(day => <View key={day.date} accessible accessibilityLabel={`${dateLabel(day.date)}, ${day.record?.status ?? 'not scheduled'}`} style={[styles.cell, { backgroundColor: day.record ? `${statusColors[day.record.status]}24` : C.raised, borderColor: day.date === snapshot.date ? C.text : 'transparent' }]}><Text style={{ color: day.record ? statusColors[day.record.status] : C.dim, fontSize: 11, fontWeight: '700' }}>{day.day}</Text>{day.record?.status === 'completed' ? <Icon name="checkmark" size={12} color={C.lime} /> : day.record?.status === 'frozen' ? <Icon name="snow-outline" size={11} color={C.blue} /> : <View style={{ height: 12 }} />}</View>)}</View><View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>{[{ label: 'Kept', color: C.lime }, { label: 'Frozen', color: C.blue }, { label: 'Missed', color: C.coral }].map(item => <View key={item.label} style={[styles.row, { gap: 5 }]}><View style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: item.color }} /><Text style={s.hint}>{item.label}</Text></View>)}</View></Panel>
    <SectionTitle title="The plan" /><Panel><Text style={s.body}>{habit.days.length === 7 ? 'Every day' : habit.days.map(d => weekdayNames[d - 1]).join(', ')}</Text><Text style={s.hint}>{habit.target === 1 ? 'One check-in' : `${habit.target} ${habit.unit}`} · Reminders {clock(habit.reminderStart)}–{clock(habit.reminderEnd)}</Text><Text style={s.hint}>Progress closes at local midnight. Unscheduled days never break your streak.</Text></Panel>
    <Action title={habit.archived ? 'Bring this habit back' : 'Archive this habit'} secondary icon={habit.archived ? 'refresh-outline' : 'archive-outline'} onPress={archive} /><Action title="Delete habit and history" secondary danger icon="trash-outline" onPress={remove} />
    <Celebration reward={reward} reducedMotion={snapshot.settings.reducedMotion} onClose={() => setReward(null)} />
  </Screen>;
}
const styles = StyleSheet.create({
  streakHero: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18, borderRadius: 22, backgroundColor: C.panel, borderWidth: 1 }, big: { color: C.text, fontSize: 36, fontWeight: '800', letterSpacing: -1 }, bigUnit: { color: C.muted, fontSize: 15, fontWeight: '600', letterSpacing: -0.3 }, stats: { flexDirection: 'row', gap: 7 }, stat: { flex: 1, backgroundColor: C.panel, borderRadius: 17, paddingVertical: 17, alignItems: 'center', gap: 7 }, statValue: { color: C.text, fontSize: 25, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'center', gap: 9 }, progressRow: { flexDirection: 'row', gap: 12, alignItems: 'baseline' }, progressNumber: { color: C.text, fontSize: 42, fontWeight: '800', letterSpacing: -1 }, track: { backgroundColor: C.raised, height: 7, borderRadius: 4, overflow: 'hidden' }, fill: { height: 7, borderRadius: 4 }, snooze: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, minHeight: 44 }, calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, cell: { width: '12%', flexGrow: 1, minHeight: 43, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, gap: 3 },
});
