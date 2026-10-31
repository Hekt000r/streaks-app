package expo.modules.streakengine

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class StreakEngineModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  private fun work(promise: Promise, block: () -> Any?) {
    NativeWork.executor.execute {
      try { promise.resolve(block()) }
      catch (error: Exception) { promise.reject("ERR_STREAK_ENGINE", error.message, error) }
    }
  }

  /** Persisted habit data is authoritative; an OS scheduling failure must not invite a duplicate retry. */
  private fun reconcileBestEffort(currentContext: Context, snapshot: JSONObject, reset: Boolean = false) {
    if (reset) {
      try { ReminderScheduler.reset(currentContext) }
      catch (error: Exception) { Log.w("StreakEngine", "Backup restored but reminder reset failed", error) }
    }
    try { ReminderScheduler.reconcile(currentContext, supplied = snapshot) }
    catch (error: Exception) {
      Log.w("StreakEngine", "Habit data saved but reminder scheduling failed", error)
      // Still refresh other UI subscribers if scheduling failed before its normal event emission.
      try { EngineEvents.emit(snapshot) }
      catch (eventError: Exception) { Log.w("StreakEngine", "Could not publish saved habit data", eventError) }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("StreakEngine")
    Events("onChange")

    OnCreate {
      EngineEvents.onChange = { snapshot -> sendEvent("onChange", mapOf("snapshot" to snapshot)) }
    }

    OnDestroy {
      EngineEvents.onChange = null
    }

    OnActivityEntersForeground {
      val currentContext = context
      NativeWork.executor.execute {
        try { ReminderScheduler.reconcile(currentContext) }
        catch (error: Exception) { Log.w("StreakEngine", "Could not reconcile reminders", error) }
      }
    }

    AsyncFunction("getSnapshot") { promise: Promise ->
      work(promise) {
        val currentContext = context
        val snapshot = HabitRepository(currentContext).snapshot()
        reconcileBestEffort(currentContext, snapshot)
        snapshot.toString()
      }
    }

    AsyncFunction("command") { input: String, promise: Promise ->
      work(promise) {
        val currentContext = context
        val command = JSONObject(input)
        val repository = HabitRepository(currentContext)
        val snapshot = if (command.getString("type") == "snooze") {
          ReminderScheduler.snooze(currentContext, command.getString("id"), command.getString("date"))
          repository.snapshot()
        } else repository.execute(command)
        reconcileBestEffort(currentContext, snapshot)
        snapshot.toString()
      }
    }

    AsyncFunction("exportBackup") { promise: Promise -> work(promise) { HabitRepository(context).exportBackup() } }

    AsyncFunction("importBackup") { input: String, promise: Promise ->
      work(promise) {
        val currentContext = context
        val snapshot = HabitRepository(currentContext).importBackup(input)
        reconcileBestEffort(currentContext, snapshot, reset = true)
        snapshot.toString()
      }
    }

    AsyncFunction("getPermissionStatus") { promise: Promise ->
      work(promise) {
        ReminderScheduler.permissionStatus(context, HabitRepository(context).snapshot().getJSONObject("settings"))
      }
    }

    AsyncFunction("requestNotificationPermission") { promise: Promise ->
      val currentContext = context
      val finish = {
        NativeWork.executor.execute {
          try {
            val snapshot = HabitRepository(currentContext).snapshot()
            reconcileBestEffort(currentContext, snapshot)
            promise.resolve(ReminderScheduler.permissionStatus(currentContext, snapshot.getJSONObject("settings")))
          } catch (error: Exception) {
            promise.reject("ERR_NOTIFICATION_PERMISSION", error.message, error)
          }
        }
        Unit
      }
      NativeWork.executor.execute {
        try {
          ReminderScheduler.ensureChannel(currentContext, HabitRepository(currentContext).snapshot().getJSONObject("settings"))
          if (Build.VERSION.SDK_INT >= 33) {
            Handler(Looper.getMainLooper()).post {
              try {
                val permissions = appContext.permissions
                if (permissions == null) promise.reject("ERR_NOTIFICATION_PERMISSION", "Android permissions module is unavailable.", null)
                else permissions.askForPermissions({ finish() }, Manifest.permission.POST_NOTIFICATIONS)
              } catch (error: Exception) {
                promise.reject("ERR_NOTIFICATION_PERMISSION", error.message, error)
              }
            }
          } else finish()
        } catch (error: Exception) {
          promise.reject("ERR_NOTIFICATION_PERMISSION", error.message, error)
        }
      }
    }

    AsyncFunction("openNotificationSettings") {
      context.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
        .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    AsyncFunction("testNotification") { promise: Promise -> work(promise) { ReminderScheduler.test(context); null } }
  }
}
