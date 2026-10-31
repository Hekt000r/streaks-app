import React, { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useHabits } from '../core/store';
import { C } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, color = C.text, size = 22 }: { name: IconName; color?: string; size?: number }) {
  return <Ionicons name={name} color={color} size={size} />;
}
export function IconButton({ name, label, onPress, color = C.text }: { name: IconName; label: string; onPress: () => void; color?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.iconButton, pressed && { opacity: 0.6 }]}><Icon name={name} color={color} /></Pressable>;
}
export function Action({ title, onPress, secondary, disabled, loading, icon, danger }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean; loading?: boolean; icon?: IconName; danger?: boolean }) {
  const color = secondary ? (danger ? C.coral : C.text) : C.bg;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading }} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [s.action, secondary && s.secondary, danger && !secondary && { backgroundColor: C.coral }, (disabled || loading) && { opacity: 0.45 }, pressed && { transform: [{ scale: 0.98 }] }]}>
    {loading ? <ActivityIndicator color={color} /> : icon ? <Icon name={icon} color={color} size={20} /> : null}<Text style={[s.actionText, { color }]}>{title}</Text>
  </Pressable>;
}
export function Screen({ children, tabs, scroll = true }: { children: ReactNode; tabs?: boolean; scroll?: boolean }) {
  return <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
    {scroll ? <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView> : <View style={[s.content, { flex: 1 }]}>{children}</View>}
    {tabs && <BottomNav />}
  </SafeAreaView>;
}
export function Header({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: boolean; right?: ReactNode }) {
  return <View style={s.header}><View style={{ flex: 1 }}>{back && <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.back}><Icon name="arrow-back" size={20} /><Text style={s.backText}>Back</Text></Pressable>}{subtitle && <Text style={s.eyebrow}>{subtitle}</Text>}<Text accessibilityRole="header" style={s.title}>{title}</Text></View>{right}</View>;
}
export function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return <View style={s.sectionHeader}><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>{aside && <Text style={s.muted}>{aside}</Text>}</View>;
}
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return <View style={{ gap: 8 }}><Text style={s.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={C.dim} style={[s.input, props.style]} selectionColor={C.lime} />{hint && <Text style={s.hint}>{hint}</Text>}</View>;
}
export function Panel({ children, color }: { children: ReactNode; color?: string }) {
  return <View style={[s.panel, color ? { backgroundColor: color } : null]}>{children}</View>;
}
export function Notice({ children, icon = 'information-circle-outline' }: { children: ReactNode; icon?: IconName }) {
  return <View style={s.notice}><Icon name={icon} size={20} color={C.lime} /><Text style={s.noticeText}>{children}</Text></View>;
}
export function Glyph({ icon, color, size = 52 }: { icon: string; color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size * 0.31, backgroundColor: `${color}20`, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: size * 0.49 }}>{icon}</Text></View>;
}
export function ErrorBanner() {
  const { error, clearError } = useHabits();
  return error ? <Pressable accessibilityRole="button" accessibilityLabel={`${error}. Dismiss error`} onPress={clearError} style={s.error}><Icon name="alert-circle-outline" color={C.coral} /><Text style={[s.noticeText, { color: C.coral, flex: 1 }]}>{error}</Text><Icon name="close" color={C.coral} size={18} /></Pressable> : null;
}
export function Loading() {
  const { error, refresh } = useHabits();
  return <Screen scroll={false}><View style={s.center}><Icon name="flame" color={C.lime} size={52} /><Text style={s.sectionTitle}>{error ? 'A little hiccup' : 'Warming up…'}</Text>{error ? <><Text style={s.body}>{error}</Text><Action title="Try again" onPress={() => void refresh()} /></> : <ActivityIndicator color={C.lime} />}</View></Screen>;
}
function BottomNav() {
  const path = usePathname();
  return <View style={s.nav}>{([{ href: '/', label: 'Today', icon: 'grid-outline' }, { href: '/habits', label: 'My habits', icon: 'flame-outline' }, { href: '/settings', label: 'Settings', icon: 'options-outline' }] as const).map(tab => {
    const active = path === tab.href;
    return <Pressable key={tab.href} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: active }} onPress={() => router.replace(tab.href)} style={s.navItem}><Icon name={tab.icon} color={active ? C.lime : C.dim} /><Text style={[s.navLabel, active && { color: C.lime }]}>{tab.label}</Text>{active && <View style={s.navDot} />}</Pressable>;
  })}</View>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg }, content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 30, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  title: { fontSize: 34, fontWeight: '800', color: C.text, letterSpacing: -1.2 }, eyebrow: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 7 }, sectionTitle: { color: C.text, fontSize: 19, fontWeight: '700', letterSpacing: -0.4 },
  body: { color: C.muted, fontSize: 15, lineHeight: 23 }, muted: { color: C.muted, fontSize: 12 }, hint: { color: C.muted, fontSize: 12, lineHeight: 18 },
  panel: { backgroundColor: C.panel, borderColor: C.border, borderWidth: 1, borderRadius: 22, padding: 20, gap: 14 },
  action: { minHeight: 54, borderRadius: 17, backgroundColor: C.lime, flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13 },
  actionText: { fontSize: 15, fontWeight: '800' }, secondary: { backgroundColor: C.raised, borderWidth: 1, borderColor: C.border },
  iconButton: { height: 48, width: 48, borderRadius: 16, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  label: { color: C.text, fontSize: 13, fontWeight: '700' }, input: { backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, borderRadius: 14, minHeight: 52, color: C.text, paddingHorizontal: 15, paddingVertical: 12, fontSize: 16 },
  notice: { flexDirection: 'row', gap: 10, backgroundColor: '#D4FF640A', borderRadius: 15, padding: 15, borderWidth: 1, borderColor: '#D4FF6422' }, noticeText: { flex: 1, color: C.muted, fontSize: 13, lineHeight: 20 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, backgroundColor: '#FF7F8315' },
  back: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingRight: 16, marginBottom: 10 }, backText: { color: C.text, fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  nav: { flexDirection: 'row', backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, paddingBottom: 6 }, navItem: { flex: 1, alignItems: 'center', gap: 5, minHeight: 56 }, navLabel: { fontSize: 10, color: C.dim, fontWeight: '700' }, navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.lime },
});
