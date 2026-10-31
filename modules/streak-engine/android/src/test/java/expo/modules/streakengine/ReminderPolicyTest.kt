package expo.modules.streakengine

import org.junit.Assert.*
import org.junit.Test

class ReminderPolicyTest {
  @Test fun escalationAnchorsBeforeDeadline() {
    assertEquals(listOf(540, 660, 780, 900, 1020, 1140, 1200, 1260, 1290), ReminderPolicy.slots(540, 1320))
  }
  @Test fun shortWindowDoesNotEmitOutsideWindow() {
    assertEquals(listOf(600, 630), ReminderPolicy.slots(600, 650))
  }
  @Test fun quietHoursWrapMidnight() {
    assertTrue(ReminderPolicy.isQuiet(0, 1320, 540))
    assertTrue(ReminderPolicy.isQuiet(1320, 1320, 540))
    assertFalse(ReminderPolicy.isQuiet(540, 1320, 540))
    assertFalse(ReminderPolicy.isQuiet(800, 1320, 540))
  }
  @Test fun equalQuietHoursDisableQuietPeriod() {
    assertFalse(ReminderPolicy.isQuiet(0, 600, 600))
  }
  @Test fun delayedWakeOnlyChoosesLatestSlot() {
    assertEquals(1200, ReminderPolicy.dueSlot(ReminderPolicy.slots(540, 1320), 1225, 900))
    assertNull(ReminderPolicy.dueSlot(ReminderPolicy.slots(540, 1320), 1225, 1225))
  }
  @Test fun priorDayNotificationIsRemovedEvenWithoutNewCandidates() {
    assertTrue(ReminderPolicy.shouldCancelDisplayed("2026-10-23", "2026-10-24", setOf("a"), emptySet()))
  }
  @Test fun completedOrUnscheduledHabitInvalidatesDisplayedAlert() {
    assertTrue(ReminderPolicy.shouldCancelDisplayed("2026-10-23", "2026-10-23", setOf("a", "b"), setOf("b")))
    assertFalse(ReminderPolicy.shouldCancelDisplayed("2026-10-23", "2026-10-23", setOf("a"), setOf("a")))
    assertFalse(ReminderPolicy.shouldCancelDisplayed(null, "2026-10-23", emptySet(), emptySet()))
  }
}
