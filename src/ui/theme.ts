export const C = {
  bg: '#101310', panel: '#1B201B', raised: '#262D25', border: '#323A30',
  text: '#F4F6EA', muted: '#A0AA9A', dim: '#65715F', lime: '#D4FF64',
  orange: '#FF9D66', coral: '#FF7F83', purple: '#BEA1FF', blue: '#86D6F8',
};
export const habitColors = [C.lime, C.orange, C.purple, C.blue, C.coral, '#FFE68B'];
export const habitIcons = ['💧', '🏃', '📚', '🧘', '💪', '🌱', '🎨', '🎸', '✍️', '🛏️', '🥗', '☀️'];
export const weekdayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function clock(minutes: number) {
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
export function parseClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const h = Number(match[1]), m = Number(match[2]);
  return h <= 23 && m <= 59 ? h * 60 + m : null;
}
export function dateLabel(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', options ?? { month: 'short', day: 'numeric' });
}
export function commandId() {
  return `ui-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
