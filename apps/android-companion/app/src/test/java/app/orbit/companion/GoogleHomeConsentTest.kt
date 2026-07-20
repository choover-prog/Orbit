package app.orbit.companion

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoogleHomeConsentTest {
    @Test
    fun `inventory remains unavailable until permission is granted`() {
        val requesting = reduceGoogleHomeConsent(
            GoogleHomeConsentState(),
            GoogleHomeConsentEvent.RequestStarted,
        )
        assertFalse(requesting.canReadInventory)

        val connected = reduceGoogleHomeConsent(
            requesting,
            GoogleHomeConsentEvent.PermissionGranted(1, 7),
        )
        assertTrue(connected.canReadInventory)
        assertEquals(7, connected.selectedDeviceCount)
    }

    @Test
    fun `denial and revocation retain no inventory counts`() {
        val connected = GoogleHomeConsentState(
            status = GoogleHomeConsentStatus.CONNECTED,
            selectedStructureCount = 1,
            selectedDeviceCount = 7,
        )

        for (event in listOf(
            GoogleHomeConsentEvent.PermissionDenied,
            GoogleHomeConsentEvent.PermissionRevoked,
            GoogleHomeConsentEvent.DisconnectLocal,
        )) {
            val state = reduceGoogleHomeConsent(connected, event)
            assertFalse(state.canReadInventory)
            assertEquals(0, state.selectedStructureCount)
            assertEquals(0, state.selectedDeviceCount)
        }
    }

    @Test
    fun `failure messages are bounded and never grant access`() {
        val state = reduceGoogleHomeConsent(
            GoogleHomeConsentState(),
            GoogleHomeConsentEvent.Failed("x".repeat(500)),
        )
        assertEquals(GoogleHomeConsentStatus.ERROR, state.status)
        assertFalse(state.canReadInventory)
        assertEquals(180, state.explanation.length)
    }
}
