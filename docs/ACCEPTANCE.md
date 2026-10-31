# Android acceptance checklist

Run repository instrumentation on an emulator and notification lifecycle checks on at least one physical Android13+ phone. Also test Android8/API26 compatibility when available. Run these before treating a release as device-validated.

## Core lifecycle

- Fresh install → onboarding → create a daily check-off → allow or deny notification permission → Today.
- Add a selected-weekday habit and a numeric8-glass goal. Check off the binary goal; increment/log numeric progress and correct today's progress.
- Confirm one full celebration per completion transition and small feedback for partial progress. Sound/haptic/reduced-motion switches work independently.
- Reopen the app in airplane mode; all saved progress and settings remain.
- Edit a numeric target or weekdays: today's occurrence stays unchanged, tomorrow uses the edit.
- Archive a habit, restart, restore it, and permanently delete with confirmation.
- Exercise screen readers, largest text settings, back navigation, and keyboard entry without clipped controls.

## Domain recovery (automated repository tests)

- Seven wins earn one freeze; a miss spends it once; the next unprotected miss resets the streak.
- Frozen/unscheduled days never earn rewards; more than two stored freezes cannot accumulate.
- Undo/recomplete today's seventh win does not generate extra freezes.
- Long absences reconcile every missed scheduled date once.
- Clock rollback cannot reopen finalized occurrences.
- Export/import round-trips progress and settings. Malformed JSON, unsupported versions, contradictory history, invalid freeze records, and oversized inputs fail without replacing data.

## Reminder lifecycle

- Use short test reminder windows to exercise start, final-three-hour, and final-hour phases. Compare requested slots to observed delivery times.
- Test Done, numeric+1, and30-minute Snooze from the lock screen with UI foregrounded, backgrounded, and process-killed. Verify the UI reflects the same persisted state afterward.
- Complete the goal before the next alert; no stale reminder should post for that occurrence.
- Post an alert before midnight; it should clear at rollover and old actions must not affect today.
- Schedule several simultaneous habits; expect one group, priority by cutoff, rotation among ties, and no more than the configured global daily alert cap.
- Quiet hours spanning midnight suppress alerts. After quiet hours, never burst replay missed slots. Snooze does not bypass quiet hours or the cap.
- Reboot, update, and change timezone/clock; future alarms recover without duplicated alerts or progress.
- Deny permission, disable its channel, and re-enable through Android settings. The Settings screen status should match Android.
- Force-stop via Android settings: expect no delivery until reopening, then recovery without a backlog burst.
- Enter Doze using `adb shell dumpsys deviceidle force-idle`, observe actual delayed delivery, then restore with `adb shell dumpsys deviceidle unforce`. Repeat with the manufacturer's battery-saving mode.
- Check the test notification explicitly; it bypasses reminder quiet hours/cap as a diagnostic and does not alter habit progress.

## Build and update

- Run JS, UI, Kotlin unit, and connected Room tests.
- Build the signed release APK with `npm run build:apk` and install it without Metro.
- Create progress, increment versionCode, rebuild with the same signing key, and install using `adb install -r`; history remains.
- Export a backup, reinstall, and import it. Review reminder permissions after reinstall.

Record device model, Android version, battery mode, build identifier, requested/observed alert times, and results. The signed ARM64 APK and24 component/unit tests have passed build validation. No hardware delivery results have been collected; connected Room and Maestro tests still need a device.
