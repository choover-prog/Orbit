package app.orbit.companion

import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoogleHomeInventoryNormalizerTest {
    private val clock = Clock.fixed(Instant.parse("2026-07-20T04:00:00Z"), ZoneOffset.UTC)
    private val normalizer = GoogleHomeInventoryNormalizer(
        pseudonymizer = ProviderIdPseudonymizer {
            "opaque-device-${it.hashCode().toUInt().toString(16).padStart(8, '0')}"
        },
        clock = clock,
    )

    @Test
    fun `normalizes a bounded read-only inventory without raw provider ids`() {
        val inventory = normalizer.normalize(
            listOf(
                GoogleHomeDeviceRecord("raw-secret-id", "Hall lamp", "light", "Hall", "ONLINE"),
                GoogleHomeDeviceRecord("raw-secret-id", "Duplicate", "light", "Hall", "ONLINE"),
            ),
        )

        assertEquals(1, inventory.observations.size)
        val observation = inventory.observations.single()
        assertFalse(observation.id.contains("raw-secret-id"))
        assertFalse(observation.identity.single().value.contains("raw-secret-id"))
        assertEquals(listOf("observe.connectivity"), observation.capabilityIds)
        assertEquals(listOf("manual_refresh"), observation.monitoringModes)
        assertEquals("off", inventory.localDiscoveryMode)
    }

    @Test
    fun `maps provider connectivity conservatively`() {
        val statuses = listOf("ONLINE", "PARTIALLY_ONLINE", "OFFLINE", "UNRECOGNIZED")
            .mapIndexed { index, status ->
                GoogleHomeDeviceRecord("id-$index", "Device $index", "other", null, status)
            }
        assertEquals(
            listOf("online", "online", "offline", "unknown"),
            normalizer.normalize(statuses).observations.map(AtlasObservation::status),
        )
    }

    @Test
    fun `drops invalid records and enforces the bridge observation bound`() {
        val records = (0..MAXIMUM_GOOGLE_HOME_OBSERVATIONS + 10).map {
            GoogleHomeDeviceRecord("id-$it", "Device $it", "other", null, "ONLINE")
        } + GoogleHomeDeviceRecord("", "No id", "other", null, "ONLINE")

        val inventory = normalizer.normalize(records)
        assertEquals(MAXIMUM_GOOGLE_HOME_OBSERVATIONS, inventory.observations.size)
        assertTrue(inventory.observations.all { it.consent.granted })
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects an unsafe pseudonymizer result`() {
        GoogleHomeInventoryNormalizer(
            pseudonymizer = ProviderIdPseudonymizer { "raw provider id" },
            clock = clock,
        ).normalize(
            listOf(GoogleHomeDeviceRecord("private", "Lamp", "light", null, "ONLINE")),
        )
    }
}
