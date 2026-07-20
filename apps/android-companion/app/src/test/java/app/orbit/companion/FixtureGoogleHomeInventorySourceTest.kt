package app.orbit.companion

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class FixtureGoogleHomeInventorySourceTest {
    @Test
    fun inventoryIsFictionalBoundedAndDiscoveryOff() = runBlocking {
        val inventory = FixtureGoogleHomeInventorySource().inventory()
        assertEquals("off", inventory.localDiscoveryMode)
        assertEquals(2, inventory.observations.size)
        assertTrue(inventory.observations.all { it.consentScope.contains("fictional") })
    }
}
