import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TodayScreen from '../app/index';
import EditHabitScreen from '../app/habit/edit';
import { HabitCard } from '../src/ui/HabitCard';
import type { Habit, Snapshot } from '../src/core/types';

const mockRun = jest.fn();
const mockParams: Record<string, string> = {};
const mockSnapshot: Snapshot = {
  date: '2026-10-23', onboarded: true,
  settings: { dailyCap: 12, quietStart: 1320, quietEnd: 540, sound: false, haptics: false, reducedMotion: true },
  habits: [{ id: 'read', name: 'Read a little', icon: '📚', color: '#D4FF64', days: [1, 2, 3, 4, 5, 6, 7], target: 1, unit: 'times', reminderStart: 540, reminderEnd: 1320, createdDate: '2026-10-23', archived: false, today: { date: '2026-10-23', target: 1, progress: 0, status: 'pending' }, history: [], currentStreak: 0, bestStreak: 0, freezes: 0, completedTotal: 0, nextFreezeIn: 7 }],
};
jest.mock('../src/core/store', () => ({ useHabits: () => ({ snapshot: mockSnapshot, run: mockRun, refresh: jest.fn(), error: null, clearError: jest.fn() }) }));
jest.mock('../src/core/backend', () => ({ requestNotificationPermission: jest.fn(async () => ({ granted: true, channelEnabled: true })) }));
jest.mock('../src/core/feedback', () => ({ playCompletionSound: jest.fn() }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), impactAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' }, ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }, useLocalSearchParams: () => mockParams, usePathname: () => '/', Redirect: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('../src/ui/Celebration', () => ({ Celebration: ({ reward }: { reward: unknown }) => reward ? require('react').createElement(require('react-native').Text, null, 'Celebration is visible') : null }));

beforeEach(() => { mockRun.mockReset(); Object.keys(mockParams).forEach(key => delete mockParams[key]); });

test('a failed progress save never celebrates or claims the habit is complete', async () => {
  mockRun.mockRejectedValue(new Error('Disk full'));
  render(<TodayScreen />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Complete Read a little')); });
  expect(mockRun).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Celebration is visible')).toBeNull();
  expect(screen.getByText('Ready when you are')).toBeTruthy();
});

test('a persisted completion celebrates the saved streak and completed day', async () => {
  mockRun.mockResolvedValue({ ...mockSnapshot, habits: [{ ...mockSnapshot.habits[0], currentStreak: 1, today: { date: mockSnapshot.date, target: 1, progress: 1, status: 'completed' } }] });
  render(<TodayScreen />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Complete Read a little')); });
  expect(screen.getByText('Celebration is visible')).toBeTruthy();
  expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ type: 'progress', id: 'read', date: mockSnapshot.date, delta: 1 }));
});

test('first habit creation finishes onboarding in the same command', async () => {
  mockParams.onboarding = '1';
  mockRun.mockResolvedValue(mockSnapshot);
  render(<EditHabitScreen />);
  fireEvent.changeText(screen.getByLabelText('What’s your promise?'), 'Read before bed');
  await act(async () => { fireEvent.press(screen.getByText('Let’s make it happen')); });
  expect(mockRun).toHaveBeenCalledTimes(1);
  expect(mockRun).toHaveBeenCalledWith(expect.objectContaining({ type: 'create', onboard: true, habit: expect.objectContaining({ name: 'Read before bed' }) }));
});

test('a pending completion blocks repeated taps until persistence finishes', async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const onProgress = jest.fn(() => pending);
  render(<HabitCard habit={mockSnapshot.habits[0]} onProgress={onProgress} />);
  const button = screen.getByLabelText('Complete Read a little');
  fireEvent.press(button);
  fireEvent.press(button);
  expect(onProgress).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  await act(async () => { finish(); await pending; });
  await waitFor(() => expect(screen.getByLabelText('Complete Read a little')).not.toBeDisabled());
});

test('new habits validate the name and reject nonpositive numeric goals before saving', () => {
  render(<EditHabitScreen />);
  fireEvent.press(screen.getByText('Let’s make it happen'));
  expect(screen.getByText('Give your habit a name first.')).toBeTruthy();
  expect(mockRun).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('What’s your promise?'), 'Drink water');
  fireEvent.press(screen.getByText('Hit a number'));
  fireEvent.changeText(screen.getByLabelText('Daily target'), '0');
  fireEvent.press(screen.getByText('Let’s make it happen'));
  expect(screen.getByText('Your goal must be a whole number between 1 and 1,000,000.')).toBeTruthy();
  expect(mockRun).not.toHaveBeenCalled();
});

test('numeric actions increment a unit rather than falsely completing the full target', async () => {
  const habit: Habit = { ...mockSnapshot.habits[0], target: 8, unit: 'glasses', today: { date: mockSnapshot.date, target: 8, progress: 2, status: 'pending' } };
  const onProgress = jest.fn(async () => {});
  render(<HabitCard habit={habit} onProgress={onProgress} />);
  await act(async () => { fireEvent.press(screen.getByLabelText('Add 1 glasses to Read a little')); });
  expect(onProgress).toHaveBeenCalledWith(habit);
  expect(screen.getByText('2 / 8 glasses')).toBeTruthy();
});
