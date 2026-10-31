# Implementation notes

## Ownership and flow

`src/core/types.ts` defines the UI/native interface. `backend.ts` loads StreakEngine, parses snapshots, and handles document/share APIs. The store serializes user commands and refreshes on native events and foreground entry. NativeWork serializes module calls and broadcast processing; the Room repository adds its own process-wide synchronization and transactions.

The native module registers Android notification channels and delegates to the repository and scheduler. The scheduler uses one inexact AlarmManager PendingIntent. It computes fixed escalation slots from each habit's reminder window, combines due habits, checks the global budget, and posts one notification with actions for its first habit. Remaining due habits rotate through ties. Completion and snooze cancel the displayed group and recompute the next eligible alarm.

Persistent occurrence state and action identifiers live in Room. Reminder dispatch counts/last slots/snoozes live in a private SharedPreferences file; this is scheduling metadata, not another habit database. Native receivers inspect canonical progress immediately before posting or changing progress. Reboot, timezone, wall-clock, package replacement, and foreground events reconcile without replaying missed reminders.

## Streaks and dates

The repository maintains effective-dated weekday/target revisions and immutable finalized occurrences. It reconciles every elapsed date before serving commands or snapshots. Completed days increment the streak and completion total; every seventh completion awards a freeze up to two. At closure, pending occurrences consume a freeze if available, otherwise become missed and reset the streak. Frozen occurrences preserve the streak length.

Today's progress is reversible. Current stats are replayed from history, so repeatedly completing/undoing cannot mint extra freezes. Command IDs prevent duplicate increments from the same action. A closed-through marker prevents reopening history after clock rollback or timezone travel. Revisited finalized dates are read-only; future local dates resume ordinary scheduling. Time is supplied to repository tests through a date-provider function.

## Backup and recovery

The version1 backup envelope contains format, version, exportedAt, and the full domain state. The repository validates settings, habit IDs, revisions, weekdays, targets, occurrence chronology, progress/status consistency, freeze conservation, and command identifiers before committing replacement state. Import is limited to10MB. Scheduler metadata is reset and recomputed after import.

The Room schema starts at version1; the first schema JSON has been generated and retained in the module's schemas directory. Keep future schema versions and explicit migration tests in source control. Preserve release signing keys independently of data backups.

## Known delivery limits

Android controls actual delivery time, notification permission/channel settings, Doze throttling, and force-stop behavior. UI warnings describe real permission status; the app does not claim exact delivery. A failed receiver action logs locally and leaves persisted domain data intact. Receivers finish their asynchronous work without starting a long-running foreground service.

Personal-release scope intentionally excludes cloud sync, monetary consequences, social competition, flexible weekly quotas, timers, and automated sensor tracking.
