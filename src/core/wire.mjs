// Runtime checks at the native bridge boundary; deliberately dependency-free for testing.
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const date = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
export function parseSnapshot(text) {
  const result = JSON.parse(text);
  if (!record(result) || !date(result.date) || !Array.isArray(result.habits) || !record(result.settings) || typeof result.onboarded !== 'boolean') {
    throw new Error('The habit engine returned an invalid snapshot. Please restart Streaks.');
  }
  for (const habit of result.habits) {
    if (!record(habit) || typeof habit.id !== 'string' || !Array.isArray(habit.days) || !Array.isArray(habit.history) || typeof habit.name !== 'string') {
      throw new Error('The habit engine returned invalid habit data.');
    }
  }
  return result;
}
export function assertBackupText(text) {
  if (typeof text !== 'string' || text.length > 10 * 1024 * 1024) throw new Error('Backup is too large (maximum 10 MB).');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('This file is not a valid JSON backup.'); }
  if (!record(value)) throw new Error('This file is not a Streaks backup.');
  // Schema/version and every row are validated transactionally by the native repository.
  return value;
}
