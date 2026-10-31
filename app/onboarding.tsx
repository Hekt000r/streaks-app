import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, Redirect } from 'expo-router';
import { useHabits } from '../src/core/store';
import { Action, Icon, Loading, Screen, s } from '../src/ui/components';
import { C } from '../src/ui/theme';
import { Celebration } from '../src/ui/Celebration';
import { playCompletionSound } from '../src/core/feedback';
import * as Haptics from 'expo-haptics';

export default function OnboardingScreen() {
  const { snapshot } = useHabits();
  const [preview, setPreview] = useState(false);
  if (!snapshot) return <Loading />;
  if (snapshot.onboarded) return <Redirect href="/" />;
  return <Screen>
    <View style={styles.brand}><Icon name="flame" color={C.lime} size={24} /><Text style={styles.brandName}>STREAKS</Text><View style={styles.badge}><Text style={styles.badgeText}>A LITTLE EVERY DAY</Text></View></View>
    <View style={styles.art}><View style={styles.orbitOuter} /><View style={styles.orbitInner} /><View style={styles.flame}><Icon name="flame" color={C.lime} size={106} /></View><View style={styles.floatingCheck}><Icon name="checkmark" color={C.bg} size={27} /></View><View style={styles.floatingFreeze}><Icon name="snow-outline" color={C.blue} size={25} /></View><View style={styles.miniBadge}><Icon name="flame" color={C.orange} size={17} /><Text style={styles.miniText}>7 day streak</Text></View></View>
    <Text accessibilityRole="header" style={styles.title}>Small promises.{"\n"}<Text style={{ color: C.lime }}>Big main-character{"\n"}energy.</Text></Text>
    <Text style={s.body}>Build the habits you keep putting off. Feel every win. And meet the reminders that refuse to let you forget.</Text>
    <View style={{ gap: 17, marginVertical: 8 }}>{[{ icon: 'flame-outline' as const, title: 'Keep your streak glowing', body: 'One scheduled day at a time. Every win counts.' }, { icon: 'notifications-outline' as const, title: 'A lovingly persistent nudge', body: 'Reminders get firmer as your deadline gets closer.' }, { icon: 'snow-outline' as const, title: 'Earn a little breathing room', body: 'Show up seven times. Earn a streak-saving freeze.' }].map(item => <View key={item.title} style={styles.feature}><View style={styles.featureIcon}><Icon name={item.icon} color={C.lime} size={22} /></View><View style={{ flex: 1, gap: 3 }}><Text style={styles.featureTitle}>{item.title}</Text><Text style={s.hint}>{item.body}</Text></View></View>)}</View>
    <Action title="Make your first promise" icon="arrow-forward" onPress={() => router.push({ pathname: '/habit/edit', params: { onboarding: '1' } })} />
    <Pressable accessibilityRole="button" onPress={() => { setPreview(true); if (snapshot.settings.sound) void playCompletionSound(); if (snapshot.settings.haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); }} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 }}><Text style={{ color: C.lime, fontSize: 12, fontWeight: '700' }}>Preview your first win ✨</Text></Pressable>
    <Text style={styles.footer}>Your phone. Your progress. No account needed.</Text>
    <Celebration reward={preview ? { name: 'Your first promise', streak: 1, milestone: false, dayComplete: false } : null} reducedMotion={snapshot.settings.reducedMotion} onClose={() => setPreview(false)} />
  </Screen>;
}
const styles = StyleSheet.create({ brand: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 6 }, brandName: { fontSize: 15, fontWeight: '900', color: C.text, letterSpacing: 2 }, badge: { marginLeft: 'auto', paddingVertical: 7, paddingHorizontal: 9, borderRadius: 20, borderWidth: 1, borderColor: C.border }, badgeText: { color: C.muted, fontSize: 7, letterSpacing: 0.8, fontWeight: '800' }, art: { height: 230, alignItems: 'center', justifyContent: 'center', marginVertical: 4 }, orbitOuter: { position: 'absolute', width: 224, height: 224, borderRadius: 112, borderColor: C.border, borderWidth: 1, borderStyle: 'dashed' }, orbitInner: { position: 'absolute', width: 166, height: 166, borderRadius: 83, backgroundColor: '#D4FF6406', borderColor: '#D4FF6415', borderWidth: 1 }, flame: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] }, floatingCheck: { position: 'absolute', backgroundColor: C.lime, width: 49, height: 49, borderRadius: 16, alignItems: 'center', justifyContent: 'center', right: 40, top: 39, transform: [{ rotate: '12deg' }] }, floatingFreeze: { position: 'absolute', backgroundColor: C.raised, borderWidth: 1, borderColor: C.border, width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', left: 33, top: 124, transform: [{ rotate: '-12deg' }] }, miniBadge: { position: 'absolute', bottom: 7, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', gap: 6, alignItems: 'center', transform: [{ rotate: '-5deg' }] }, miniText: { color: C.text, fontWeight: '700', fontSize: 12 }, title: { fontSize: 35, fontWeight: '800', color: C.text, letterSpacing: -1.3, lineHeight: 42 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 12 }, featureIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: C.panel, justifyContent: 'center', alignItems: 'center' }, featureTitle: { color: C.text, fontWeight: '700', fontSize: 13 }, footer: { textAlign: 'center', fontSize: 11, color: C.dim, marginTop: -7 }, });
