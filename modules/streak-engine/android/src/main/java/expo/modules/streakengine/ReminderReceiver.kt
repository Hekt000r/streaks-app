package expo.modules.streakengine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject
import java.time.LocalDate
import java.util.concurrent.Executors

internal object NativeWork {
  val executor = Executors.newSingleThreadExecutor()
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pendingResult = goAsync()
    NativeWork.executor.execute {
      try {
        val repository = HabitRepository(context)
        when (intent.action) {
          ReminderScheduler.ACTION_PROGRESS, ReminderScheduler.ACTION_SNOOZE -> {
            val id = intent.getStringExtra("id") ?: return@execute
            val date = intent.getStringExtra("date") ?: return@execute
            // Old notification buttons can never mutate a different day's occurrence.
            if (date != LocalDate.now().toString()) return@execute
            val snapshot = repository.snapshot()
            val habits = snapshot.getJSONArray("habits")
            val habit = (0 until habits.length()).map { habits.getJSONObject(it) }
              .firstOrNull { it.getString("id") == id && !it.getBoolean("archived") }
              ?: return@execute
            val today = habit.optJSONObject("today") ?: return@execute
            if (today.optString("status") != "pending" || today.getString("date") != date) return@execute
            if (intent.action == ReminderScheduler.ACTION_SNOOZE) {
              val commandId = intent.getStringExtra("commandId") ?: return@execute
              ReminderScheduler.snooze(context, id, date, commandId)
            } else {
              val commandId = intent.getStringExtra("commandId") ?: return@execute
              val command = JSONObject().put("type", "progress").put("id", id)
                .put("date", date).put("commandId", commandId)
              if (today.getInt("target") > 1) command.put("delta", 1)
              else command.put("value", today.getInt("target"))
              repository.execute(command)
            }
            ReminderScheduler.reconcile(context)
          }
          ReminderScheduler.ACTION_ALARM -> ReminderScheduler.reconcile(context, dispatch = true)
          Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED,
          Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> ReminderScheduler.reconcile(context)
        }
      } catch (error: Exception) {
        // Do not crash a broadcast worker if a stale action or invalid backup state is encountered.
        Log.w("StreakEngine", "Reminder recovery/action failed", error)
      } finally {
        pendingResult.finish()
      }
    }
  }
}
