package expo.modules.streakengine

import org.junit.Assert.assertEquals
import org.junit.Test

class StreakRulesTest {
  private fun completed(n: Int) = List(n) { StreakEntry("completed") }

  @Test fun sevenCompletionsEarnFreeze() {
    val stats = StreakRules.replay(completed(7))
    assertEquals(7, stats.current)
    assertEquals(1, stats.freezes)
    assertEquals(7, stats.nextFreezeIn)
  }

  @Test fun frozenDayPreservesButDoesNotIncreaseStreakOrEarnings() {
    val stats = StreakRules.replay(completed(7) + StreakEntry("frozen"))
    assertEquals(7, stats.current)
    assertEquals(7, stats.completed)
    assertEquals(0, stats.freezes)
  }

  @Test fun missedDayResetsCurrentAndPreservesRecord() {
    val stats = StreakRules.replay(completed(6) + StreakEntry("missed") + completed(2))
    assertEquals(2, stats.current)
    assertEquals(6, stats.best)
  }

  @Test fun fullWalletDiscardsAwards() {
    val before = StreakRules.replay(completed(21))
    val spent = StreakRules.apply(before, "frozen")
    assertEquals(2, before.freezes)
    assertEquals(1, spent.freezes)
  }

  @Test fun reversibleTodayDoesNotFarmFreezes() {
    val base = completed(6)
    repeat(20) {
      assertEquals(1, StreakRules.replay(base + StreakEntry("completed")).freezes)
      assertEquals(0, StreakRules.replay(base + StreakEntry("pending")).freezes)
    }
  }

  @Test(expected = IllegalArgumentException::class)
  fun cannotSpendUnownedFreeze() { StreakRules.apply(StreakStats(), "frozen") }
}
