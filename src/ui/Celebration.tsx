import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Action, Icon } from './components';
import { C } from './theme';

export type Reward = { name: string; streak: number; dayComplete: boolean; milestone: boolean };
export function Celebration({ reward, onClose, reducedMotion }: { reward: Reward | null; onClose: () => void; reducedMotion: boolean }) {
  const systemReducedMotion = useReducedMotion();
  const quietMotion = reducedMotion || systemReducedMotion;
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (reward) {
      if (quietMotion) { scale.value = 1; opacity.value = 1; }
      else { scale.value = 0.8; opacity.value = 0; scale.value = withSpring(1, { damping: 15 }); opacity.value = withTiming(1, { duration: 180 }); }
    }
  }, [reward, quietMotion, opacity, scale]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  return <Modal visible={!!reward} transparent animationType="none" onRequestClose={onClose}><View style={styles.scrim}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss celebration" /><Animated.View style={[styles.card, animated]} accessibilityViewIsModal>
    <View style={styles.starRow}><Icon name="sparkles" color={C.lime} size={25} /><Text style={styles.eyebrow}>{reward?.dayComplete ? 'EVERY PROMISE. KEPT.' : reward?.milestone ? 'A NEW MILESTONE' : 'PROMISE KEPT'}</Text><Icon name="sparkles" color={C.lime} size={25} /></View>
    <View style={styles.flame}><Icon name={reward?.dayComplete ? 'trophy' : 'flame'} color={C.lime} size={86} /></View>
    <Text accessibilityRole="header" style={styles.title}>{reward?.dayComplete ? 'You owned today.' : reward?.milestone ? 'Look at you go.' : 'That’s the feeling.'}</Text>
    <Text style={styles.description}>{reward?.name} is done.{reward?.streak ? `\n${reward.streak} scheduled ${reward.streak === 1 ? 'day' : 'days'} of showing up.` : '\nA little effort. A better you.'}</Text>
    {reward?.streak ? <View style={styles.badge}><Icon name="flame" color={C.orange} size={20} /><Text style={styles.badgeText}>{reward.streak} day streak</Text></View> : null}
    <Action title={reward?.dayComplete ? 'Enjoy your well-earned peace' : 'Keep the good going'} onPress={onClose} />
  </Animated.View></View></Modal>;
}
const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: '#000C', justifyContent: 'center', padding: 25 }, card: { backgroundColor: C.panel, borderRadius: 30, borderColor: '#D4FF6444', borderWidth: 1, padding: 25, gap: 22, alignItems: 'stretch' }, starRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, eyebrow: { fontSize: 9, letterSpacing: 1.5, color: C.lime, fontWeight: '800' }, flame: { width: 134, height: 134, borderRadius: 67, backgroundColor: '#D4FF6410', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, title: { color: C.text, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -1 }, description: { color: C.muted, textAlign: 'center', fontSize: 15, lineHeight: 24 }, badge: { flexDirection: 'row', gap: 7, alignSelf: 'center', alignItems: 'center', backgroundColor: '#FF9D6614', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 22 }, badgeText: { color: C.orange, fontWeight: '700' },
});
