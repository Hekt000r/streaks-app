package expo.modules.streakengine

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZonedDateTime
import java.util.UUID

internal object EngineEvents {
  @Volatile var onChange: ((String) -> Unit)? = null
  fun emit(snapshot: JSONObject) { onChange?.invoke(snapshot.toString()) }
}

/** One native alarm and one grouped alert. Never depends on a running JS runtime. */
object ReminderScheduler {
  const val ACTION_ALARM = "expo.modules.streakengine.REMIND"
  const val ACTION_PROGRESS = "expo.modules.streakengine.PROGRESS"
  const val ACTION_SNOOZE = "expo.modules.streakengine.SNOOZE"
  private const val NOTIFICATION_ID = 4101
  private const val TEST_ID = 4102
  private val lock = Any()

  private fun preferences(context: Context) =
    context.getSharedPreferences("streak_reminders_v1", Context.MODE_PRIVATE)

  private fun channelId(settings: JSONObject): String =
    "habit_reminders_${if (settings.optBoolean("sound", true)) 1 else 0}_${if (settings.optBoolean("haptics", true)) 1 else 0}"

  fun ensureChannel(context: Context, settings: JSONObject): String {
    val id = channelId(settings)
    val channel = NotificationChannel(id, "Habit reminders", NotificationManager.IMPORTANCE_HIGH)
    channel.description = "Escalating reminders for your unfinished habits"
    channel.enableVibration(settings.optBoolean("haptics", true))
    if (!settings.optBoolean("sound", true)) channel.setSound(null, null)
    context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    return id
  }

  fun permissionStatus(context: Context, settings: JSONObject): Map<String, Boolean> {
    val channel = ensureChannel(context, settings)
    val runtimeGranted = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(
      context, Manifest.permission.POST_NOTIFICATIONS
    ) == PackageManager.PERMISSION_GRANTED
    val channelEnabled = context.getSystemService(NotificationManager::class.java)
      .getNotificationChannel(channel)?.importance != NotificationManager.IMPORTANCE_NONE
    return mapOf(
      "granted" to (runtimeGranted && NotificationManagerCompat.from(context).areNotificationsEnabled()),
      "channelEnabled" to channelEnabled
    )
  }

  fun snooze(context: Context, id: String, date: String, commandId: String? = null) = synchronized(lock) {
    require(date == LocalDate.now().toString()) { "Only today's habits can be snoozed." }
    val prefs = preferences(context)
    val actionKey = commandId?.let { "action:$it:$date" }
    if (actionKey != null && prefs.getBoolean(actionKey, false)) return@synchronized
    val snapshot = HabitRepository(context).snapshot()
    val habits = snapshot.getJSONArray("habits")
    val habit = (0 until habits.length()).map { habits.getJSONObject(it) }
      .firstOrNull { it.getString("id") == id && !it.getBoolean("archived") }
      ?: throw IllegalArgumentException("Habit not found.")
    require(habit.optJSONObject("today")?.optString("status") == "pending") { "This habit is not pending today." }
    val edit = prefs.edit().putLong("snooze:$id:$date", System.currentTimeMillis() + 30 * 60_000L)
    if (actionKey != null) edit.putBoolean(actionKey, true)
    edit.commit()
    try { NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID) }
    catch (error: Exception) { Log.w("StreakEngine", "Snooze saved but notification cancellation failed", error) }
  }

  fun reset(context: Context) = synchronized(lock) {
    preferences(context).edit().clear().commit()
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  fun reconcile(context: Context, dispatch: Boolean = false, supplied: JSONObject? = null) = synchronized(lock) {
    val snapshot = supplied ?: HabitRepository(context).snapshot()
    val settings = snapshot.getJSONObject("settings")
    val now = ZonedDateTime.now()
    val date = now.toLocalDate().toString()
    val minute = now.hour * 60 + now.minute
    val prefs = preferences(context)
    val all = snapshot.getJSONArray("habits")
    val unarchived = (0 until all.length()).map { all.getJSONObject(it) }.filter { !it.getBoolean("archived") }
    val active = unarchived.filter {
      !it.getBoolean("archived") && it.optJSONObject("today")?.optString("status") == "pending"
    }
    val postedIds = prefs.getString("postedIds", "").orEmpty().split(',').filter { it.isNotBlank() }.toSet()
    val pendingIds = active.map { it.getString("id") }.toSet()
    if (ReminderPolicy.shouldCancelDisplayed(prefs.getString("postedDate", null), date, postedIds, pendingIds)) {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
      prefs.edit().remove("postedDate").remove("postedIds").apply()
    }
    val permission = permissionStatus(context, settings)
    val allowed = permission.getValue("granted") && permission.getValue("channelEnabled")
    val cap = settings.getInt("dailyCap")
    val countKey = "count:$date"
    val count = prefs.getInt(countKey, 0)
    val quietStart = settings.getInt("quietStart")
    val quietEnd = settings.getInt("quietEnd")

    if (!dispatch) {
      // Opening/reconfiguring the app skips old requested slots and removes stale actions.
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
      val edit = prefs.edit().remove("postedDate").remove("postedIds")
      active.forEach { edit.putInt("last:${it.getString("id")}:$date", minute) }
      edit.apply()
    }

    fun slots(habit: JSONObject): List<Int> {
      val start = habit.getInt("reminderStart")
      val end = habit.getInt("reminderEnd")
      val id = habit.getString("id")
      val snoozeAt = prefs.getLong("snooze:$id:$date", 0)
      val snoozeTime = if (snoozeAt > 0) java.time.Instant.ofEpochMilli(snoozeAt).atZone(now.zone) else null
      val extra = if (snoozeTime?.toLocalDate() == now.toLocalDate()) {
        listOf(snoozeTime.hour * 60 + snoozeTime.minute)
      } else emptyList()
      return (ReminderPolicy.slots(start, end) + extra).distinct().sorted().filter {
        it in start until end && !ReminderPolicy.isQuiet(it, quietStart, quietEnd)
      }
    }

    if (dispatch && allowed && count < cap && !ReminderPolicy.isQuiet(minute, quietStart, quietEnd)) {
      val rotation = prefs.getInt("rotation", 0)
      val candidates = active.withIndex().filter { (_, habit) ->
        val id = habit.getString("id")
        val snoozed = prefs.getLong("snooze:$id:$date", 0) > now.toInstant().toEpochMilli()
        !snoozed && minute in habit.getInt("reminderStart") until habit.getInt("reminderEnd") &&
          ReminderPolicy.dueSlot(slots(habit), minute, prefs.getInt("last:$id:$date", -1)) != null
      }.sortedWith(compareBy<IndexedValue<JSONObject>> { it.value.getInt("reminderEnd") }
        .thenBy { Math.floorMod(it.index - rotation, maxOf(1, active.size)) }).map { it.value }

      if (candidates.isNotEmpty()) {
        try {
          post(context, candidates, settings, date, minute)
          val edit = prefs.edit().putInt(countKey, count + 1)
            .putInt("rotation", (rotation + 1) % maxOf(1, active.size))
            .putString("postedDate", date)
            .putString("postedIds", candidates.joinToString(",") { it.getString("id") })
          candidates.forEach {
            val id = it.getString("id")
            edit.putInt("last:$id:$date", minute).remove("snooze:$id:$date")
          }
          // Keep dispatch metadata bounded; the current date's counters remain durable.
          prefs.all.keys.filter { key ->
            (key != "rotation" && !key.endsWith(date) &&
              (key.startsWith("last:") || key.startsWith("snooze:") || key.startsWith("action:"))) ||
              (key.startsWith("count:") && key.substringAfter("count:") < now.toLocalDate().minusDays(366).toString())
          }.forEach { edit.remove(it) }
          edit.commit()
        } catch (_: SecurityException) {
          // Permission may be revoked between the check and notify. Do not consume budget.
        }
      }
    }

    var next = now.toLocalDate().plusDays(1).atStartOfDay(now.zone).plusSeconds(5).toInstant().toEpochMilli()
    if (allowed && prefs.getInt(countKey, 0) < cap) {
      active.forEach { habit ->
        val id = habit.getString("id")
        val snoozeAt = prefs.getLong("snooze:$id:$date", 0)
        slots(habit).forEach { slot ->
          if (slot > minute) {
            val at = now.toLocalDate().atTime(slot / 60, slot % 60).atZone(now.zone).toInstant().toEpochMilli()
            if (at >= snoozeAt && at > System.currentTimeMillis()) next = minOf(next, at)
          }
        }
        if (snoozeAt > System.currentTimeMillis()) {
          val until = java.time.Instant.ofEpochMilli(snoozeAt).atZone(now.zone)
          val untilMinute = until.hour * 60 + until.minute
          if (until.toLocalDate() == now.toLocalDate() &&
            untilMinute in habit.getInt("reminderStart") until habit.getInt("reminderEnd") &&
            !ReminderPolicy.isQuiet(untilMinute, quietStart, quietEnd)) next = minOf(next, snoozeAt)
        }
      }
    }
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    val alarm = PendingIntent.getBroadcast(context, 4100,
      Intent(context, ReminderReceiver::class.java).setAction(ACTION_ALARM),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    alarmManager.cancel(alarm)
    if (unarchived.isNotEmpty()) alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarm)
    EngineEvents.emit(snapshot)
  }

  private fun contentIntent(context: Context, id: String?): PendingIntent {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(Intent.ACTION_VIEW)
    intent.data = Uri.parse(if (id == null) "streaks://" else "streaks://habit/$id")
    intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(context, 4103, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun actionIntent(context: Context, action: String, habit: JSONObject, date: String): PendingIntent {
    val commandId = UUID.randomUUID().toString()
    val intent = Intent(context, ReminderReceiver::class.java).setAction(action)
      .setData(Uri.parse("streaks-action://$commandId"))
      .putExtra("id", habit.getString("id")).putExtra("date", date)
      .putExtra("commandId", commandId)
    return PendingIntent.getBroadcast(context, 0, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun post(context: Context, habits: List<JSONObject>, settings: JSONObject, date: String, minute: Int) {
    val first = habits.first()
    val occurrence = first.getJSONObject("today")
    val remaining = first.getInt("reminderEnd") - minute
    val title = when {
      remaining <= 60 -> "Last call. Your streak is waiting."
      remaining <= 180 -> "Your streak won't grow itself."
      else -> "Tiny effort. Bigger streak."
    }
    val body = habits.take(6).joinToString("\n") { habit ->
      val today = habit.getJSONObject("today")
      "${habit.getString("name")} · ${today.getInt("progress")}/${today.getInt("target")} ${habit.getString("unit")}".trim()
    } + if (habits.size > 6) "\n+${habits.size - 6} more habits" else ""
    val numeric = occurrence.getInt("target") > 1
    val notification = NotificationCompat.Builder(context, ensureChannel(context, settings))
      .setSmallIcon(R.drawable.ic_streak_notification)
      .setColor(Color.rgb(203, 255, 112))
      .setContentTitle(title).setContentText(body.replace('\n', ' '))
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(contentIntent(context, first.getString("id")))
      .setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .addAction(0, if (numeric) "+1 · ${first.getString("name")}" else "Done · ${first.getString("name")}",
        actionIntent(context, ACTION_PROGRESS, first, date))
      .addAction(0, "Snooze 30m", actionIntent(context, ACTION_SNOOZE, first, date))
      .build()
    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
  }

  fun test(context: Context) {
    val settings = HabitRepository(context).snapshot().getJSONObject("settings")
    val status = permissionStatus(context, settings)
    check(status.getValue("granted") && status.getValue("channelEnabled")) {
      "Enable notifications and the Habit reminders channel first."
    }
    // Explicit test bypasses quiet hours and the reminder budget.
    NotificationManagerCompat.from(context).notify(TEST_ID,
      NotificationCompat.Builder(context, ensureChannel(context, settings))
        .setSmallIcon(R.drawable.ic_streak_notification)
        .setContentTitle("Your future streak says hello.")
        .setContentText("Reminders are ready. Now give them something to celebrate.")
        .setContentIntent(contentIntent(context, null)).setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH).build())
  }
}
