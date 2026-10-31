package expo.modules.streakengine

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.time.LocalDate
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class HabitRepositoryTest {
  private lateinit var repository: HabitRepository
  private var day = LocalDate.of(2026, 10, 1)

  @Before fun setup() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    HabitDatabase.get(context).clearAllTables()
    day = LocalDate.of(2026, 10, 1)
    repository = HabitRepository(context) { day }
  }

  private fun input(target: Int = 1) = JSONObject().put("name", "Water").put("icon", "water")
    .put("color", "#B5FF70").put("days", JSONArray(listOf(1, 2, 3, 4, 5, 6, 7)))
    .put("target", target).put("unit", "glasses").put("reminderStart", 540).put("reminderEnd", 1320)

  private fun create(target: Int = 1): String = repository.execute(JSONObject().put("type", "create").put("habit", input(target)))
    .getJSONArray("habits").getJSONObject(0).getString("id")

  private fun habit(): JSONObject = repository.snapshot().getJSONArray("habits").getJSONObject(0)
  private fun complete(id: String, value: Int = 1, commandId: String = UUID.randomUUID().toString()): JSONObject =
    repository.execute(JSONObject().put("type", "progress").put("id", id).put("date", day.toString())
      .put("value", value).put("commandId", commandId))

  @Test fun sevenWinsThenMissSpendsFreezeExactlyOnce() {
    val id = create()
    repeat(7) { complete(id); day = day.plusDays(1) }
    assertEquals(1, habit().getInt("freezes"))
    day = day.plusDays(1)
    assertEquals(7, habit().getInt("currentStreak"))
    assertEquals(0, habit().getInt("freezes"))
    assertEquals("frozen", habit().getJSONArray("history").getJSONObject(1).getString("status"))
    assertEquals(0, habit().getInt("freezes"))
    day = day.plusDays(1)
    assertEquals(0, habit().getInt("currentStreak"))
    assertEquals(7, habit().getInt("bestStreak"))
  }

  @Test fun firstHabitAndOnboardingCommitTogether() {
    val snapshot = repository.execute(JSONObject().put("type", "create").put("habit", input()).put("onboard", true))
    assertTrue(snapshot.getBoolean("onboarded"))
    assertEquals(1, snapshot.getJSONArray("habits").length())
    assertTrue(repository.snapshot().getBoolean("onboarded"))
  }

  @Test fun numericActionIsIdempotentAndUndoIsReversible() {
    val id = create(8)
    val command = JSONObject().put("type", "progress").put("id", id).put("date", day.toString())
      .put("delta", 1).put("commandId", "same-action")
    repository.execute(command)
    repository.execute(command)
    assertEquals(1, habit().getJSONObject("today").getInt("progress"))
    complete(id, 8)
    assertEquals(1, habit().getInt("currentStreak"))
    complete(id, 0)
    assertEquals(0, habit().getInt("currentStreak"))
  }

  @Test fun scheduleAndTargetEditsApplyTomorrow() {
    val id = create(1)
    repository.execute(JSONObject().put("type", "edit").put("id", id).put("habit", input(8)))
    assertEquals(1, habit().getJSONObject("today").getInt("target"))
    complete(id)
    day = day.plusDays(1)
    assertEquals(8, habit().getJSONObject("today").getInt("target"))
    assertEquals(1, habit().getInt("currentStreak"))
  }

  @Test fun clockRollbackCannotReopenFinalizedDay() {
    val id = create()
    complete(id)
    day = day.plusDays(2)
    repository.snapshot()
    day = day.minusDays(1)
    assertTrue(habit().isNull("today"))
    try { complete(id); fail("Finalized progress must be rejected") } catch (_: IllegalArgumentException) { }
  }

  @Test fun backupRoundTripAndMalformedImportIsAtomic() {
    val id = create(8)
    complete(id, 3)
    val backup = repository.exportBackup()
    complete(id, 8)
    repository.importBackup(backup)
    assertEquals(3, habit().getJSONObject("today").getInt("progress"))
    val malformed = JSONObject(backup)
    malformed.getJSONObject("state").getJSONArray("habits").getJSONObject(0).put("target", -1)
    try { repository.importBackup(malformed.toString()); fail("Invalid backup accepted") } catch (_: IllegalArgumentException) { }
    assertEquals(3, habit().getJSONObject("today").getInt("progress"))
  }

  @Test fun unscheduledDaysDoNotBreakStreak() {
    val oneDay = input().put("days", JSONArray(listOf(day.dayOfWeek.value)))
    val id = repository.execute(JSONObject().put("type", "create").put("habit", oneDay))
      .getJSONArray("habits").getJSONObject(0).getString("id")
    complete(id)
    day = day.plusDays(6)
    assertTrue(habit().isNull("today"))
    assertEquals(1, habit().getInt("currentStreak"))
    day = day.plusDays(1)
    complete(id)
    assertEquals(2, habit().getInt("currentStreak"))
  }

  @Test fun invalidFreezeLedgerIsRejectedWithoutReplacingData() {
    val id = create()
    repeat(7) { complete(id); day = day.plusDays(1) }
    day = day.plusDays(1)
    repository.snapshot()
    val backup = JSONObject(repository.exportBackup())
    val records = backup.getJSONObject("state").getJSONArray("habits").getJSONObject(0).getJSONArray("occurrences")
    for (i in 0 until records.length()) {
      if (records.getJSONObject(i).getString("status") == "frozen") records.getJSONObject(i).put("status", "missed")
    }
    try { repository.importBackup(backup.toString()); fail("Invalid freeze conservation accepted") } catch (_: IllegalArgumentException) { }
    assertEquals(7, habit().getInt("currentStreak"))
  }

  @Test fun backupRejectsOccurrencesBeyondFinalizedTimeline() {
    create()
    val backup = JSONObject(repository.exportBackup())
    val records = backup.getJSONObject("state").getJSONArray("habits").getJSONObject(0).getJSONArray("occurrences")
    records.put(JSONObject().put("date", day.plusDays(2).toString()).put("target", 1).put("progress", 1).put("status", "completed"))
    try { repository.importBackup(backup.toString()); fail("Future occurrence accepted") } catch (_: IllegalArgumentException) { }
    assertEquals(0, habit().getInt("completedTotal"))
  }
}
