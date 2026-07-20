package app.orbit.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceAtlasBridgeJsonEncoderTest {
    @Test
    fun `encodes the server bridge schema with matching sequence and field names`() {
        val inventory = CompanionInventory(
            generatedAt = "2026-07-20T04:00:00Z",
            observations = listOf(
                AtlasObservation(
                    id = "google-home:opaque",
                    source = AtlasSource.GOOGLE_HOME,
                    displayName = "Desk \"lamp\"",
                    category = "light",
                    roomLabel = null,
                    sourceLabel = "Google Home companion",
                    observedAt = "2026-07-20T04:00:00Z",
                    freshnessSeconds = 300,
                    capabilityIds = listOf("observe.connectivity"),
                    identity = listOf(AtlasIdentityEvidence("provider_link", "opaque", "strong")),
                    consent = AtlasConsent(true, "Selected devices"),
                    transport = "hybrid",
                    status = "online",
                    monitoringModes = listOf("manual_refresh"),
                ),
            ),
        )

        val json = DeviceAtlasBridgeJsonEncoder().encode(3, inventory).decodeToString()
        assertTrue(json.startsWith("{\"protocol\":\"orbit.device-atlas.v1\",\"sequence\":3"))
        assertTrue(json.contains("\"capabilities\":[\"observe.connectivity\"]"))
        assertTrue(json.contains("\"source\":\"google_home\""))
        assertTrue(json.contains("Desk \\\"lamp\\\""))
        assertFalse(json.contains("capabilityIds"))
        assertFalse(json.contains("roomLabel"))
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects unsafe sequence values`() {
        DeviceAtlasBridgeJsonEncoder().encode(
            9_007_199_254_740_992L,
            CompanionInventory(generatedAt = "2026-07-20T04:00:00Z", observations = emptyList()),
        )
    }
}
