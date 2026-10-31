package expo.modules.streakengine

/** Pure, deterministic streak accounting, shared by live progress and reconciliation. */
data class StreakEntry(val status: String)
data class StreakStats(
  val current: Int = 0,
  val best: Int = 0,
  val freezes: Int = 0,
  val completed: Int = 0
) {
  val nextFreezeIn: Int get() = 7 - completed % 7
}

object StreakRules {
  fun apply(stats: StreakStats, status: String): StreakStats = when (status) {
    "completed" -> {
      val completed = stats.completed + 1
      val current = stats.current + 1
      stats.copy(
        current = current,
        best = maxOf(stats.best, current),
        completed = completed,
        freezes = if (completed % 7 == 0) minOf(2, stats.freezes + 1) else stats.freezes
      )
    }
    "frozen" -> {
      require(stats.freezes > 0) { "A frozen day needs an earned freeze" }
      stats.copy(freezes = stats.freezes - 1)
    }
    "missed" -> stats.copy(current = 0)
    "pending" -> stats
    else -> throw IllegalArgumentException("Unknown occurrence status")
  }

  fun replay(entries: Iterable<StreakEntry>): StreakStats =
    entries.fold(StreakStats()) { stats, entry -> apply(stats, entry.status) }

  fun closeMiss(stats: StreakStats): String = if (stats.freezes > 0) "frozen" else "missed"
}
