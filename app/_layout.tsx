import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HabitsProvider } from '../src/core/store';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <HabitsProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#101116' }, animation: 'slide_from_right' }} />
      </HabitsProvider>
    </SafeAreaProvider>
  );
}
