import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Streaks',
  slug: 'streaks',
  version: '1.0.0',
  scheme: 'streaks',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  icon: './assets/icon.png',
  android: {
    package: 'app.streaks.personal',
    versionCode: 1,
    allowBackup: false,
    permissions: ['POST_NOTIFICATIONS', 'RECEIVE_BOOT_COMPLETED'],
    blockedPermissions: ['android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.USE_EXACT_ALARM', 'android.permission.RECORD_AUDIO'],
    adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#13151C' },
  },
  plugins: [
    'expo-router',
    './plugins/withReleaseSigning',
    ['expo-build-properties', { android: { minSdkVersion: 26 } }],
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false }],
    'expo-document-picker',
  ],
  experiments: { typedRoutes: false },
};
export default config;
