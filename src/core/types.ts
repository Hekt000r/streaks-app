export type HabitInput = {
  name: string;
  icon: string;
  color: string;
  days: number[]; // ISO weekdays: Monday=1 … Sunday=7
  target: number;
  unit: string;
  reminderStart: number; // minutes since local midnight
  reminderEnd: number;
};
export type Occurrence = {
  date: string;
  target: number;
  progress: number;
  status: 'pending' | 'completed' | 'frozen' | 'missed';
};
export type Habit = HabitInput & {
  id: string;
  createdDate: string;
  archived: boolean;
  today: Occurrence | null;
  history: Occurrence[];
  currentStreak: number;
  bestStreak: number;
  freezes: number;
  completedTotal: number;
  nextFreezeIn: number;
};
export type Settings = {
  dailyCap: number;
  quietStart: number;
  quietEnd: number;
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
};
export type Snapshot = {
  date: string;
  habits: Habit[];
  settings: Settings;
  onboarded: boolean;
};
export type Command =
  | { type: 'create'; habit: HabitInput; onboard?: boolean }
  | { type: 'edit'; id: string; habit: HabitInput }
  | { type: 'archive'; id: string; archived: boolean }
  | { type: 'delete'; id: string }
  | { type: 'progress'; id: string; date: string; value?: number; delta?: number; commandId: string }
  | { type: 'snooze'; id: string; date: string }
  | { type: 'settings'; settings: Settings }
  | { type: 'onboard' };
export type PermissionStatus = { granted: boolean; channelEnabled: boolean };
