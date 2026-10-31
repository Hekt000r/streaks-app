import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useHabits } from '../src/core/store';
import { Habit } from '../src/core/types';
import { playCompletionSound } from '../src/core/feedback';
import { Action, ErrorBanner, Header, Icon, IconButton, Loading, Notice, Panel, Screen, SectionTitle, s } from '../src/ui/components';
import { HabitCard } from '../src/ui/HabitCard';
import { Celebration, Reward } from '../src/ui/Celebration';
import { C, commandId, dateLabel } from '../src/ui/theme';

export default function TodayScreen() {
  const { snapshot, run, refresh } = useHabits();
  const [reward, setReward] = useState<Reward | null>(null);
  if (!snapshot) return <Loading />;
  if (!snapshot.onboarded) return <Redirect href="/onboarding" />;
  const habits = snapshot.habits.filter(h => !h.archived && h.today);
  const completed = habits.filter(h => h.today?.status === 'completed').length;
  const allDone = habits.length > 0 && completed === habits.length;
  const longest = Math.max(0, ...snapshot.habits.filter(h => !h.archived).map(h => h.currentStreak));
  const date = new Date(`${snapshot.date}T12:00:00`);
  const weekday = (date.getDay() + 6) % 7;
  const progress = async (habit: Habit) => {
    try {
      const updated = await run({ type: 'progress', id: habit.id, date: snapshot.date, delta: 1, commandId: commandId() });
      const next = updated.habits.find(h => h.id === habit.id);
      if (habit.today?.status !== 'completed' && next?.today?.status === 'completed') {
        if (updated.settings.haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (updated.settings.sound) void playCompletionSound();
        const scheduled = updated.habits.filter(h => !h.archived && h.today);
        setReward({ name: habit.name, streak: next.currentStreak, milestone: [3, 7, 14, 30, 60, 100].includes(next.currentStreak), dayComplete: scheduled.every(h => h.today?.status === 'completed') });
      } else if (updated.settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch { /* shared error banner owns operation errors */ }
  };
  return <Screen tabs>
    <Header title="Show up for you." subtitle={dateLabel(snapshot.date, { weekday: 'long', month: 'short', day: 'numeric' })} right={<IconButton name="add" label="Create a habit" onPress={() => router.push('/habit/edit')} color={C.lime} />} />
    <ErrorBanner />
    <View style={styles.hero}>
      <View style={styles.heroTop}><View style={styles.live}><View style={styles.liveDot} /><Text style={styles.heroEyebrow}>{allDone ? 'MISSION ACCOMPLISHED' : 'YOUR DAILY SPARK'}</Text></View><Icon name="open-outline" color="#344020" size={20} /></View>
      <View style={styles.heroBody}><View style={{ flex: 1 }}><Text style={styles.heroNumber}>{completed}<Text style={styles.heroOf}> / {habits.length}</Text></Text><Text style={styles.heroCaption}>{allDone ? 'All done. Feels good, right?' : 'small wins. big momentum.'}</Text></View><View style={styles.flameRing}><Icon name={allDone ? 'trophy' : 'flame'} color="#344020" size={53} /></View></View>
      <View style={styles.heroTrack}><View style={[styles.heroFill, { width: `${habits.length ? completed / habits.length * 100 : 0}%` }]} /></View>
      <View style={styles.heroFoot}><Text style={styles.heroSmall}>{allDone ? 'No more reminders today. You earned it.' : 'A better you is one checkmark away.'}</Text><Text style={styles.heroSmall}>{habits.length ? Math.round(completed / habits.length * 100) : 0}%</Text></View>
    </View>
    <View style={styles.week}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => {
      const day = new Date(date); day.setDate(date.getDate() - weekday + i);
      return <View key={i} style={[styles.day, weekday === i && styles.activeDay]}><Text style={[styles.dayLabel, weekday === i && styles.activeDayText]}>{d}</Text><Text style={[styles.dayNumber, weekday === i && styles.activeDayText]}>{day.getDate()}</Text>{weekday === i && <View style={styles.dayDot} />}</View>;
    })}</View>
    <SectionTitle title="Today’s promises" aside={`${habits.length - completed} left to keep`} />
    {!habits.length ? <Panel><Icon name="leaf-outline" color={C.lime} size={36} /><Text style={s.sectionTitle}>{snapshot.habits.some(h => !h.archived) ? 'A little breathing room.' : 'Your next chapter starts small.'}</Text><Text style={s.body}>{snapshot.habits.some(h => !h.archived) ? 'Nothing is scheduled today. Enjoy the pause, or make room for a new habit.' : 'Pick one thing you want to do for yourself. We’ll make showing up feel good.'}</Text><Action title="Add a habit" icon="add" onPress={() => router.push('/habit/edit')} /></Panel> : <View style={{ gap: 12 }}>{habits.map(h => <HabitCard key={h.id} habit={h} onProgress={progress} />)}</View>}
    <Pressable accessibilityRole="button" onPress={() => router.push('/habits')} style={styles.record}><View style={styles.recordIcon}><Icon name="flame-outline" color={C.orange} size={27} /></View><View style={{ flex: 1, gap: 5 }}><Text style={styles.recordTitle}>{longest ? `${longest} days of showing up` : 'Consistency starts with one'}</Text><Text style={s.hint}>{longest ? 'Your strongest active streak. Keep it glowing.' : 'Every streak has a day one. Make this yours.'}</Text></View><Icon name="chevron-forward" size={17} color={C.muted} /></Pressable>
    <Notice icon="snow-outline">A little backup for real life: every 7 completions earns a streak freeze. You can hold two per habit.</Notice>
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh progress" onPress={() => void refresh()} style={{ alignSelf: 'center', padding: 8 }}><Text style={s.muted}>Refresh progress</Text></Pressable>
    <Celebration reward={reward} reducedMotion={snapshot.settings.reducedMotion} onClose={() => setReward(null)} />
  </Screen>;
}
const styles = StyleSheet.create({
  hero: { backgroundColor: C.lime, borderRadius: 27, padding: 23, gap: 19 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, live: { flexDirection: 'row', gap: 7, alignItems: 'center' }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#344020' }, heroEyebrow: { fontSize: 9, fontWeight: '800', color: '#344020', letterSpacing: 1.4 }, heroBody: { flexDirection: 'row', alignItems: 'center', gap: 8 }, heroNumber: { color: C.bg, fontSize: 61, fontWeight: '900', letterSpacing: -3 }, heroOf: { color: '#6E823E', fontSize: 35, fontWeight: '600', letterSpacing: -1 }, heroCaption: { color: '#344020', fontWeight: '600', fontSize: 12, marginTop: 3 }, flameRing: { height: 88, width: 88, borderRadius: 44, borderWidth: 1, borderColor: '#34402030', backgroundColor: '#FFFFFF1A', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] }, heroTrack: { height: 7, borderRadius: 5, backgroundColor: '#34402022', overflow: 'hidden' }, heroFill: { height: 7, borderRadius: 5, backgroundColor: '#344020' }, heroFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: -8 }, heroSmall: { fontSize: 10, color: '#344020', fontWeight: '600', flexShrink: 1 }, week: { flexDirection: 'row', justifyContent: 'space-between', gap: 5 }, day: { flex: 1, paddingVertical: 13, alignItems: 'center', gap: 8, borderRadius: 17, minHeight: 77 }, activeDay: { backgroundColor: C.raised, borderWidth: 1, borderColor: '#D4FF6444' }, dayLabel: { fontSize: 10, color: C.dim, fontWeight: '700' }, dayNumber: { fontSize: 15, color: C.muted, fontWeight: '700' }, activeDayText: { color: C.lime }, dayDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: C.lime, position: 'absolute', bottom: 7 }, record: { backgroundColor: '#FF9D6609', borderColor: '#FF9D6622', borderWidth: 1, borderRadius: 20, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 13 }, recordIcon: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' }, recordTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
});
