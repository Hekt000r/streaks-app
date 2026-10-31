package expo.modules.streakengine

/** Pure local-clock policy, kept independent of Android for deterministic tests. */
object ReminderPolicy {
  fun slots(start: Int, end: Int): List<Int> {
    require(start in 0..1439 && end in 1..1439 && start < end)
    val result = sortedSetOf(start)
    // Anchor each phase independently so a long earlier interval cannot skip escalation.
    var minute = start
    while (minute < end - 180) { result.add(minute); minute += 120 }
    minute = maxOf(start, end - 180)
    while (minute < end - 60) { result.add(minute); minute += 60 }
    minute = maxOf(start, end - 60)
    while (minute < end) { result.add(minute); minute += 30 }
    return result.filter { it in start until end }
  }

  fun isQuiet(minute: Int, start: Int, end: Int): Boolean = when {
    start == end -> false
    start < end -> minute in start until end
    else -> minute >= start || minute < end
  }

  fun dueSlot(slots: List<Int>, minute: Int, lastMinute: Int): Int? =
    slots.lastOrNull { it <= minute && it > lastMinute }

  fun shouldCancelDisplayed(postedDate: String?, date: String, postedIds: Set<String>, pendingIds: Set<String>): Boolean =
    postedDate != null && (postedDate != date || postedIds.isEmpty() || postedIds.any { it !in pendingIds })
}
