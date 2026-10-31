package expo.modules.streakengine

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.Callable

/** Canonical native domain. Every public operation is atomic, including missed-day recovery. */
class HabitRepository(context: Context, private val dateProvider: () -> LocalDate = { LocalDate.now() }) {
  private val db = HabitDatabase.get(context)

  companion object {
    private val lock = Any()
    private const val BACKUP_VERSION = 1
    private const val MAX_HABITS = 200
    private const val MAX_BACKUP_BYTES = 10 * 1024 * 1024
    private val habitKeys = listOf("name", "icon", "color", "days", "target", "unit", "reminderStart", "reminderEnd")
  }

  private fun today(): LocalDate = dateProvider()
  private fun freshState() = JSONObject()
    .put("habits", JSONArray()).put("onboarded", false)
    .put("settings", JSONObject().put("dailyCap", 12).put("quietStart", 1320).put("quietEnd", 540)
      .put("sound", true).put("haptics", true).put("reducedMotion", false))
    .put("commands", JSONArray())

  private fun <T> transaction(block: (JSONObject, LocalDate) -> T): T = synchronized(lock) {
    db.runInTransaction(Callable {
      val date = today()
      val state = db.state().get()?.let { JSONObject(it.payload) } ?: freshState()
      reconcile(state, date)
      val result = block(state, date)
      db.state().put(HabitStateRow(payload = state.toString()))
      result
    })
  }

  fun snapshot(): JSONObject = transaction { state, date -> toSnapshot(state, date) }

  fun execute(command: JSONObject): JSONObject = transaction { state, date ->
    when (command.getString("type")) {
      "create" -> {
        val input = validateHabit(command.getJSONObject("habit"))
        val habits = state.getJSONArray("habits")
        require(habits.length() < MAX_HABITS) { "Maximum $MAX_HABITS habits reached" }
        val habit = JSONObject(input.toString()).put("id", UUID.randomUUID().toString())
          .put("createdDate", date.toString()).put("archived", false)
          .put("closedThrough", date.minusDays(1).toString()).put("occurrences", JSONArray())
          .put("revisions", JSONArray().put(revision(input, date)))
        habits.put(habit)
        ensureToday(habit, date)
        if (command.optBoolean("onboard", false)) state.put("onboarded", true)
      }
      "edit" -> {
        val habit = findHabit(state, command.getString("id"))
        val input = validateHabit(command.getJSONObject("habit"))
        habitKeys.forEach { habit.put(it, input.get(it)) }
        val revisions = habit.getJSONArray("revisions")
        val nextEffective = maxOf(date, LocalDate.parse(habit.getString("closedThrough"))).plusDays(1)
        val effective = nextEffective.toString()
        val kept = JSONArray()
        for (i in 0 until revisions.length()) {
          val existing = revisions.getJSONObject(i)
          if (existing.getString("effective") < effective) kept.put(existing)
        }
        kept.put(revision(input, nextEffective))
        habit.put("revisions", kept)
      }
      "archive" -> {
        val habit = findHabit(state, command.getString("id"))
        habit.put("archived", command.getBoolean("archived"))
        if (habit.getBoolean("archived")) {
          val kept = JSONArray()
          val occurrences = habit.getJSONArray("occurrences")
          for (i in 0 until occurrences.length()) {
            val occurrence = occurrences.getJSONObject(i)
            if (occurrence.getString("status") != "pending") kept.put(occurrence)
          }
          habit.put("occurrences", kept)
        } else ensureToday(habit, date)
      }
      "delete" -> {
        val id = command.getString("id")
        findHabit(state, id)
        val old = state.getJSONArray("habits")
        val kept = JSONArray()
        for (i in 0 until old.length()) if (old.getJSONObject(i).getString("id") != id) kept.put(old.get(i))
        state.put("habits", kept)
      }
      "progress" -> {
        val commandId = command.getString("commandId")
        require(commandId.length in 1..200) { "Invalid action identifier" }
        val commands = state.getJSONArray("commands")
        var duplicate = false
        for (i in 0 until commands.length()) if (commands.getJSONObject(i).getString("id") == commandId) duplicate = true
        if (!duplicate) {
          val habit = findHabit(state, command.getString("id"))
          require(!habit.getBoolean("archived")) { "Archived habits cannot be completed" }
          require(command.getString("date") == date.toString()) { "Only today's progress can change" }
          require(date.isAfter(LocalDate.parse(habit.getString("closedThrough")))) { "This date is already finalized" }
          val occurrence = findOccurrence(habit, date.toString()) ?: throw IllegalArgumentException("Habit is not scheduled today")
          require(command.has("value") xor command.has("delta")) { "Provide either progress or an increment" }
          val proposed = if (command.has("value")) strictInt(command, "value", 0, 1_000_000)
            else occurrence.getInt("progress") + strictInt(command, "delta", -1_000_000, 1_000_000)
          require(proposed >= 0) { "Progress cannot be negative" }
          val progress = minOf(proposed, occurrence.getInt("target"))
          occurrence.put("progress", progress).put("status", if (progress >= occurrence.getInt("target")) "completed" else "pending")
          if (progress >= occurrence.getInt("target")) occurrence.put("completedAt", System.currentTimeMillis())
          else occurrence.remove("completedAt")
          commands.put(JSONObject().put("id", commandId).put("date", date.toString()))
        }
      }
      "snooze" -> {
        val habit = findHabit(state, command.getString("id"))
        require(command.getString("date") == date.toString() && !habit.getBoolean("archived")) { "Cannot snooze an inactive occurrence" }
      }
      "settings" -> state.put("settings", validateSettings(command.getJSONObject("settings")))
      "onboard" -> state.put("onboarded", true)
      else -> throw IllegalArgumentException("Unknown habit command")
    }
    toSnapshot(state, date)
  }

  fun exportBackup(): String = transaction { state, _ ->
    JSONObject().put("format", "streaks-backup").put("version", BACKUP_VERSION)
      .put("exportedAt", System.currentTimeMillis()).put("state", state).toString(2)
  }

  fun importBackup(json: String): JSONObject = synchronized(lock) {
    val date = today()
    require(json.toByteArray(Charsets.UTF_8).size <= MAX_BACKUP_BYTES) { "Backup exceeds 10 MB" }
    val backup = JSONObject(json)
    require(backup.getString("format") == "streaks-backup") { "Not a Streaks backup" }
    require(strictInt(backup, "version", 1, Int.MAX_VALUE) == BACKUP_VERSION) { "Unsupported backup version" }
    val candidate = JSONObject(backup.getJSONObject("state").toString())
    validateState(candidate)
    reconcile(candidate, date)
    db.runInTransaction { db.state().put(HabitStateRow(payload = candidate.toString())) }
    toSnapshot(candidate, date)
  }

  private fun revision(input: JSONObject, date: LocalDate) = JSONObject()
    .put("effective", date.toString()).put("days", JSONArray(input.getJSONArray("days").toString()))
    .put("target", input.getInt("target"))

  private fun plan(habit: JSONObject, date: LocalDate): JSONObject? {
    val revisions = habit.getJSONArray("revisions")
    var selected: JSONObject? = null
    for (i in 0 until revisions.length()) {
      val revision = revisions.getJSONObject(i)
      if (revision.getString("effective") <= date.toString()) selected = revision
    }
    return selected
  }

  private fun isScheduled(habit: JSONObject, date: LocalDate): Boolean {
    val days = plan(habit, date)?.getJSONArray("days") ?: return false
    return (0 until days.length()).any { days.getInt(it) == date.dayOfWeek.value }
  }

  private fun createOccurrence(habit: JSONObject, date: LocalDate): JSONObject {
    val occurrence = JSONObject().put("date", date.toString()).put("target", plan(habit, date)!!.getInt("target"))
      .put("progress", 0).put("status", "pending")
    habit.getJSONArray("occurrences").put(occurrence)
    return occurrence
  }

  private fun ensureToday(habit: JSONObject, date: LocalDate) {
    if (!habit.getBoolean("archived") && date.isAfter(LocalDate.parse(habit.getString("closedThrough"))) &&
      isScheduled(habit, date) && findOccurrence(habit, date.toString()) == null) createOccurrence(habit, date)
  }

  private fun reconcile(state: JSONObject, now: LocalDate) {
    val habits = state.getJSONArray("habits")
    for (i in 0 until habits.length()) {
      val habit = habits.getJSONObject(i)
      val closedThrough = LocalDate.parse(habit.getString("closedThrough"))
      var date = closedThrough.plusDays(1)
      val byDate = occurrences(habit).associateBy { it.getString("date") }.toMutableMap()
      // No changes to finalized dates even if travel or a clock rollback revisits them.
      var stats = stats(habit, closedThrough.toString())
      while (date.isBefore(now)) {
        var occurrence = byDate[date.toString()]
        if (occurrence == null && !habit.getBoolean("archived") && isScheduled(habit, date)) {
          occurrence = createOccurrence(habit, date)
          byDate[date.toString()] = occurrence
        }
        if (occurrence != null) {
          if (occurrence.getString("status") == "pending") occurrence.put("status", StreakRules.closeMiss(stats))
          val before = stats
          stats = StreakRules.apply(stats, occurrence.getString("status"))
          occurrence.put("freezeAwarded", occurrence.getString("status") == "completed" && stats.completed % 7 == 0 && before.freezes < 2)
        }
        date = date.plusDays(1)
      }
      if (now.minusDays(1).isAfter(closedThrough)) habit.put("closedThrough", now.minusDays(1).toString())
      ensureToday(habit, now)
    }
    // Today-only action identities remain durable; obsolete dates cannot be changed anyway.
    val commands = state.getJSONArray("commands")
    val kept = JSONArray()
    for (i in 0 until commands.length()) {
      val item = commands.getJSONObject(i)
      if (item.getString("date") >= now.toString()) kept.put(item)
    }
    state.put("commands", kept)
  }

  private fun occurrences(habit: JSONObject): List<JSONObject> {
    val records = habit.getJSONArray("occurrences")
    return (0 until records.length()).map { records.getJSONObject(it) }.sortedBy { it.getString("date") }
  }

  private fun stats(habit: JSONObject, through: String): StreakStats = StreakRules.replay(
    occurrences(habit).filter { it.getString("date") <= through }.map { StreakEntry(it.getString("status")) }
  )

  private fun toSnapshot(state: JSONObject, date: LocalDate): JSONObject {
    val habits = JSONArray()
    val source = state.getJSONArray("habits")
    for (i in 0 until source.length()) {
      val habit = source.getJSONObject(i)
      val output = JSONObject()
      habitKeys.forEach { output.put(it, habit.get(it)) }
      val through = maxOf(date.toString(), habit.getString("closedThrough"))
      val stats = stats(habit, through)
      val occurrence = if (habit.getBoolean("archived") || date.toString() <= habit.getString("closedThrough")) null else findOccurrence(habit, date.toString())
      output.put("id", habit.getString("id")).put("createdDate", habit.getString("createdDate"))
        .put("archived", habit.getBoolean("archived")).put("today", occurrence ?: JSONObject.NULL)
        .put("history", JSONArray(occurrences(habit).filter { it.getString("date") <= date.toString() }.takeLast(90).reversed()))
        .put("currentStreak", stats.current).put("bestStreak", stats.best).put("freezes", stats.freezes)
        .put("completedTotal", stats.completed).put("nextFreezeIn", stats.nextFreezeIn)
      habits.put(output)
    }
    return JSONObject().put("date", date.toString()).put("habits", habits)
      .put("settings", state.getJSONObject("settings")).put("onboarded", state.getBoolean("onboarded"))
  }

  private fun findHabit(state: JSONObject, id: String): JSONObject {
    val habits = state.getJSONArray("habits")
    for (i in 0 until habits.length()) if (habits.getJSONObject(i).getString("id") == id) return habits.getJSONObject(i)
    throw IllegalArgumentException("Habit no longer exists")
  }

  private fun findOccurrence(habit: JSONObject, date: String): JSONObject? {
    val records = habit.getJSONArray("occurrences")
    for (i in 0 until records.length()) if (records.getJSONObject(i).getString("date") == date) return records.getJSONObject(i)
    return null
  }

  private fun strictInt(input: JSONObject, key: String, min: Int, max: Int): Int {
    val raw = input.get(key)
    require(raw is Number && raw.toDouble().isFinite() && raw.toDouble() == raw.toInt().toDouble() && raw.toInt() in min..max) { "Invalid $key" }
    return raw.toInt()
  }

  private fun validateDays(days: JSONArray) {
    require(days.length() in 1..7) { "Choose at least one weekday" }
    val values = (0 until days.length()).map {
      val raw = days.get(it)
      require(raw is Number && raw.toDouble() == raw.toInt().toDouble() && raw.toInt() in 1..7) { "Invalid weekday" }
      (raw as Number).toInt()
    }
    require(values.distinct().size == values.size) { "Duplicate weekday" }
  }

  private fun validateHabit(input: JSONObject): JSONObject {
    val name = input.getString("name").trim()
    require(name.length in 1..80) { "Habit name must contain 1–80 characters" }
    require(input.getString("icon").length in 1..32) { "Choose an icon" }
    require(input.getString("color").matches(Regex("#[0-9a-fA-F]{6}"))) { "Invalid color" }
    validateDays(input.getJSONArray("days"))
    strictInt(input, "target", 1, 1_000_000)
    require(input.getString("unit").length <= 30) { "Unit must be 30 characters or fewer" }
    val start = strictInt(input, "reminderStart", 0, 1439)
    val end = strictInt(input, "reminderEnd", 0, 1439)
    require(start < end) { "Reminder end must be after its start" }
    return JSONObject().also { out -> habitKeys.forEach { out.put(it, input.get(it)) }; out.put("name", name) }
  }

  private fun validateSettings(input: JSONObject): JSONObject {
    strictInt(input, "dailyCap", 1, 100)
    strictInt(input, "quietStart", 0, 1439)
    strictInt(input, "quietEnd", 0, 1439)
    listOf("sound", "haptics", "reducedMotion").forEach { require(input.get(it) is Boolean) { "Invalid $it" } }
    return JSONObject().also { output ->
      listOf("dailyCap", "quietStart", "quietEnd", "sound", "haptics", "reducedMotion").forEach { output.put(it, input.get(it)) }
    }
  }

  private fun validateState(state: JSONObject) {
    validateSettings(state.getJSONObject("settings"))
    require(state.get("onboarded") is Boolean) { "Invalid onboarding state" }
    val habits = state.getJSONArray("habits")
    require(habits.length() <= MAX_HABITS) { "Too many habits" }
    val ids = HashSet<String>()
    for (i in 0 until habits.length()) {
      val habit = habits.getJSONObject(i)
      validateHabit(habit)
      val id = habit.getString("id")
      require(id.matches(Regex("[A-Za-z0-9_-]{1,100}")) && ids.add(id)) { "Invalid or duplicate habit identifier" }
      require(habit.get("archived") is Boolean) { "Invalid archive state" }
      val created = LocalDate.parse(habit.getString("createdDate"))
      val closed = LocalDate.parse(habit.getString("closedThrough"))
      require(created.year in 2000..2200 && closed >= created.minusDays(1) && closed.year <= 2200) { "Invalid history range" }
      val revisions = habit.getJSONArray("revisions")
      require(revisions.length() in 1..10000) { "Invalid revisions" }
      var previous: LocalDate? = null
      for (j in 0 until revisions.length()) {
        val revision = revisions.getJSONObject(j)
        val effective = LocalDate.parse(revision.getString("effective"))
        if (j == 0) require(effective == created) { "Missing original schedule" }
        require(previous == null || effective > previous) { "Schedules must be ordered" }
        require(effective.year <= 2200) { "Invalid schedule date" }
        validateDays(revision.getJSONArray("days"))
        strictInt(revision, "target", 1, 1_000_000)
        previous = effective
      }
      val seenDates = HashSet<String>()
      val records = habit.getJSONArray("occurrences")
      require(records.length() <= 75000) { "History too large" }
      for (j in 0 until records.length()) {
        val occurrence = records.getJSONObject(j)
        val date = LocalDate.parse(occurrence.getString("date"))
        require(date >= created && date.year <= 2200 && seenDates.add(date.toString())) { "Invalid or duplicate occurrence date" }
        require(date <= closed.plusDays(1)) { "Occurrence is beyond the reconciled timeline" }
        require(isScheduled(habit, date)) { "Occurrence falls on an unscheduled date" }
        val target = strictInt(occurrence, "target", 1, 1_000_000)
        require(target == plan(habit, date)!!.getInt("target")) { "Occurrence target does not match its historical schedule" }
        val progress = strictInt(occurrence, "progress", 0, target)
        val status = occurrence.getString("status")
        require(status in setOf("pending", "completed", "frozen", "missed")) { "Invalid occurrence state" }
        require((status == "completed") == (progress == target)) { "Completion does not match progress" }
        require(status != "pending" || date > closed) { "Finalized history cannot be pending" }
        require(status !in setOf("frozen", "missed") || date <= closed) { "Unfinalized miss" }
      }
      // Validate the whole historical ledger, including automatic freeze use and awards.
      var stats = StreakStats()
      occurrences(habit).forEach { occurrence ->
        val status = occurrence.getString("status")
        if (status == "missed") require(stats.freezes == 0) { "A missed day must consume available protection" }
        val expectedAward = status == "completed" && (stats.completed + 1) % 7 == 0 && stats.freezes < 2
        if (occurrence.has("freezeAwarded")) require(occurrence.get("freezeAwarded") == expectedAward) { "Invalid freeze award ledger" }
        stats = StreakRules.apply(stats, status)
      }
    }
    val commands = state.getJSONArray("commands")
    require(commands.length() <= 100000) { "Too many action identifiers" }
    val commandIds = HashSet<String>()
    for (i in 0 until commands.length()) {
      val command = commands.getJSONObject(i)
      require(command.getString("id").length in 1..200 && commandIds.add(command.getString("id"))) { "Invalid action identifier" }
      LocalDate.parse(command.getString("date"))
    }
  }
}
