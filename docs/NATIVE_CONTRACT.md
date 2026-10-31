# Native contract — shared implementation boundary

Package `expo.modules.streakengine`, local module `StreakEngine`.

JS types are in `src/core/types.ts`. All dates ISO YYYY-MM-DD local device dates, ISO weekdays 1–7, minutes 0–1439. Reminder windows do not cross midnight; quiet hours may. Defaults cap12/quiet22:00–09:00/sound+haptics true/reducedMotion false.

## Domain agent owns

`HabitDatabase.kt`, `HabitRepository.kt`, `StreakRules.kt`, and domain tests/build-independent tests as appropriate. Expose class `HabitRepository(context: Context)` with:

- `fun snapshot(): JSONObject` matching Snapshot (history descending, last90; today null if unscheduled).
- `fun execute(command: JSONObject): JSONObject` matching Command, returns fresh snapshot. Validate all input. Today-only progress. Duplicate commandId ignored. Synchronize all operations using shared process-wide lock and Room transactions.
- Create accepts optional `onboard: true` to atomically finish onboarding with the first habit.
- `fun exportBackup(): String`
- `fun importBackup(json: String): JSONObject` validate whole backup before atomic replacement. Versioned JSON.

Reminder snooze may be stored by reminder module, not domain: domain execute snooze is a no-op; native module intercepts it. Domain must reject unknown commands, invalid ids, backdated progress. Expose app-private Room DB with migrations, no destructive fallback. Earn every7 completions, cap2, frozen days preserve but do not increment streak. Recompute immutable finalized history plus today's reversible outcomes to prevent freeze farming. Edits affect next day schedule/target, immediate cosmetic and reminder changes. Archive current day exempt/cancel and preserve past. Reconcile missed scheduled days on every operation. Long absence must work. Keep past closed dates immutable under timezone/clock rollback.

## Reminder agent owns

`StreakEngineModule.kt`, `ReminderScheduler.kt`, `ReminderReceiver.kt`, AndroidManifest.xml, android/build.gradle, expo-module.config.json, root module package.json. Can initially assume repository methods above, then integrate with domain agent. Module owns Android notification permissions, channels, alarms, action intents, change events, document-picker backup IO.

Expo async methods (all on IO queue as appropriate): `getSnapshot(): String`, `command(input: String): String`, `exportBackup(): String`, `importBackup(input: String): String`, `getPermissionStatus(): {granted,channelEnabled}`, `requestNotificationPermission(): {granted,channelEnabled}`, `openNotificationSettings(): void`, `testNotification(): void`, `shareBackup(): void`, `pickBackup(): String?` (returns fresh snapshot JSON or null after cancellation). Native event `onChange` payload `{ snapshot: String }`. `command` handles snooze then delegates repository and reschedules. Use app currentActivity and Android document intents for backups (or leave export/import IO to coordinator if intent async complex; notify coordinator).

Native scheduler reads snapshot JSON. Store scheduler-only dispatch/snooze counters in private SharedPreferences; use one global alarm, at most1 app notification per wake with bundled due habits and actions for top habit. Daily cap counts alerts. Start09:00/end22:00 defaults, escalation2h/1h final3h/30m final1h. Snooze30m. Complete from notification requires `progress` with value=today.target, numeric +1 uses delta1; both commandId. Notification action date must be today's occurrence or ignored. Rebuild on boot/time/timezone/package replace, app resume; never burst replay. No exact alarm, FGS, remote pushes, or JS background timer. Blocked notifications never count as delivered. `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS`, allowBackup false. Deep link `streaks://habit/<id>`. No automatic requests for exact alarms.

## UI agent owns

`src/ui/**`, `app/**` excluding coordinator-owned `app/_layout.tsx`. Depend on `useHabits()` from `src/core/store.tsx`: `{snapshot: Snapshot|null, loading:boolean, error:string|null, refresh():Promise<void>, run(command:Command):Promise<Snapshot>, clearError():void}`. Backend imported from `src/core/backend.ts`: `getPermissionStatus`, `requestNotificationPermission`, `openNotificationSettings`, `testNotification`, `shareBackup`, `pickBackup`. All async. `pickBackup()` returns Snapshot|null; refresh store afterwards. Reward sound `playCompletionSound()` from `src/core/feedback.ts`, haptics use expo-haptics. Design dark playful bright lime/coral/violet with comprehensive accessible screens, no external images needed. Use Reanimated, expo-router, @expo/vector-icons, react-native-safe-area-context. Numeric manual entry, current-day undo, archive/delete confirmations, pending edit next day note. Shared contract types must not be edited without coordinator agreement.
