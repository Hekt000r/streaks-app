package expo.modules.streakengine

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

/** One transactional aggregate ensures UI actions and native receivers cannot diverge. */
@Entity(tableName = "habit_state")
data class HabitStateRow(@PrimaryKey val id: Int = 1, val payload: String)

@Dao
interface HabitStateDao {
  @Query("SELECT * FROM habit_state WHERE id = 1")
  fun get(): HabitStateRow?

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  fun put(state: HabitStateRow)
}

@Database(entities = [HabitStateRow::class], version = 1, exportSchema = true)
abstract class HabitDatabase : RoomDatabase() {
  abstract fun state(): HabitStateDao

  companion object {
    @Volatile private var instance: HabitDatabase? = null
    fun get(context: Context): HabitDatabase = instance ?: synchronized(this) {
      instance ?: Room.databaseBuilder(context.applicationContext, HabitDatabase::class.java, "streaks.db")
        // Future versions must add explicit migrations; never use destructive fallback.
        .build().also { instance = it }
    }
  }
}
