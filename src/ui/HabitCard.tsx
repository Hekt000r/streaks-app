import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Habit } from '../core/types';
import { Glyph, Icon } from './components';
import { C } from './theme';

export function HabitCard({ habit, onProgress }: { habit: Habit; onProgress: (habit: Habit) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const occurrence = habit.today;
  const complete = occurrence?.status === 'completed';
  const progress = occurrence?.progress ?? 0;
  const target = occurrence?.target ?? habit.target;
  const percentage = Math.min(1, progress / target);
  const submit = async () => { if (busyRef.current) return; busyRef.current = true; setBusy(true); try { await onProgress(habit); } finally { setBusy(false); busyRef.current = false; } };
  return <View style={[styles.card, complete && { borderColor: '#D4FF644A' }]}>
    <View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel={`View ${habit.name}`} onPress={() => router.push({ pathname: '/habit/[id]', params: { id: habit.id } })} style={styles.identity}><Glyph icon={habit.icon} color={habit.color} /><View style={{ flex: 1, gap: 5 }}><Text style={styles.name}>{habit.name}</Text><Text style={styles.target}>{target === 1 ? 'One promise. Every scheduled day.' : `${target} ${habit.unit || 'times'} · daily goal`}</Text></View></Pressable><View style={styles.streak}><Icon name="flame" color={habit.currentStreak ? C.orange : C.dim} size={17} /><Text style={[styles.streakNumber, !habit.currentStreak && { color: C.dim }]}>{habit.currentStreak}</Text></View></View>
    <View style={styles.bottom}><View style={{ flex: 1, gap: 9 }}><View style={styles.progressLabels}><Text style={[styles.progressText, complete && { color: C.lime }]}>{complete ? 'Promise kept' : target === 1 ? 'Ready when you are' : `${progress} / ${target} ${habit.unit}`}</Text>{habit.freezes > 0 && <View style={styles.freeze}><Icon name="snow-outline" size={13} color={C.blue} /><Text style={styles.freezeText}>{habit.freezes}</Text></View>}</View><View style={styles.track}><View style={[styles.fill, { width: `${percentage * 100}%`, backgroundColor: complete ? C.lime : habit.color }]} /></View></View>
      <Pressable accessibilityRole="button" accessibilityLabel={complete ? `${habit.name} completed. View details to correct` : target === 1 ? `Complete ${habit.name}` : `Add 1 ${habit.unit || 'unit'} to ${habit.name}`} accessibilityState={{ disabled: busy, checked: complete }} disabled={busy} onPress={complete ? () => router.push({ pathname: '/habit/[id]', params: { id: habit.id } }) : () => void submit()} style={({ pressed }) => [styles.check, complete && styles.checked, pressed && { opacity: 0.65 }]}>{busy ? <ActivityIndicator color={C.lime} /> : <Icon name={complete ? 'checkmark' : target === 1 ? 'checkmark' : 'add'} color={complete ? C.bg : C.text} size={26} />}</Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 23, padding: 17, gap: 20 }, top: { flexDirection: 'row', gap: 8, alignItems: 'center' }, identity: { flexDirection: 'row', alignItems: 'center', gap: 13, flex: 1 }, name: { color: C.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 }, target: { color: C.muted, fontSize: 11, lineHeight: 16 }, streak: { flexDirection: 'row', gap: 3, alignItems: 'center', alignSelf: 'flex-start', marginTop: 2 }, streakNumber: { color: C.orange, fontSize: 15, fontWeight: '800' }, bottom: { flexDirection: 'row', alignItems: 'center', gap: 19 }, progressLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, progressText: { color: C.muted, fontSize: 11, fontWeight: '600' }, track: { height: 5, borderRadius: 3, backgroundColor: C.raised, overflow: 'hidden' }, fill: { height: 5, borderRadius: 3 }, check: { height: 45, width: 48, borderRadius: 15, backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: C.lime, borderColor: C.lime }, freeze: { flexDirection: 'row', gap: 3, alignItems: 'center' }, freezeText: { color: C.blue, fontSize: 10, fontWeight: '700' },
});
