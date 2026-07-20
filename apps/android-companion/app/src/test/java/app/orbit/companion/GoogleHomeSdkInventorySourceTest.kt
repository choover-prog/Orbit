package app.orbit.companion

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class GoogleHomeSdkInventorySourceTest {
    @Test
    fun `reads and normalizes only after provider permission is granted`() = runBlocking {
        val client = FakeGoogleHomeClient(
            permission = GoogleHomeProviderPermission.GRANTED,
            devices = listOf(
                GoogleHomeSdkDevice("private-id", "Desk lamp", "light", "Office", "ONLINE"),
            ),
        )
        val source = GoogleHomeSdkInventorySource(
            client = client,
            pseudonymizer = ProviderIdPseudonymizer { "opaque-device-id" },
        )

        val observation = source.inventory().observations.single()
        assertEquals("Desk lamp", observation.displayName)
        assertEquals("google-home:opaque-device-id", observation.id)
        assertFalse(observation.id.contains("private-id"))
    }

    @Test(expected = IllegalStateException::class)
    fun `refuses inventory when provider consent is absent`() {
        runBlocking {
            GoogleHomeSdkInventorySource(
                client = FakeGoogleHomeClient(GoogleHomeProviderPermission.NOT_GRANTED),
                pseudonymizer = ProviderIdPseudonymizer { "opaque-device-id" },
            ).inventory()
        }
    }

    @Test
    fun `unprovisioned build fails closed without provider calls`() = runBlocking {
        val client = UnprovisionedGoogleHomeSdkClient()
        assertEquals(
            GoogleHomeProviderPermissionResult.SDK_NOT_PROVISIONED,
            client.requestPermission(),
        )
        assertEquals(emptyList<GoogleHomeSdkDevice>(), client.readSelectedDevices())
    }
}

private class FakeGoogleHomeClient(
    private val permission: GoogleHomeProviderPermission,
    private val devices: List<GoogleHomeSdkDevice> = emptyList(),
) : GoogleHomeSdkClient {
    override suspend fun permissionState() = permission
    override suspend fun requestPermission() = when (permission) {
        GoogleHomeProviderPermission.GRANTED -> GoogleHomeProviderPermissionResult.SUCCESS
        else -> GoogleHomeProviderPermissionResult.CANCELLED
    }
    override suspend fun readSelectedDevices() = devices
}
