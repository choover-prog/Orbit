package app.orbit.companion

/**
 * Narrow seam implemented by the official Google Home Android SDK adapter once the authenticated
 * SDK download and app registration are configured. Google SDK objects must never cross this seam.
 */
interface GoogleHomeSdkClient {
    suspend fun permissionState(): GoogleHomeProviderPermission
    suspend fun requestPermission(): GoogleHomeProviderPermissionResult
    suspend fun readSelectedDevices(): List<GoogleHomeSdkDevice>
}

enum class GoogleHomeProviderPermission {
    GRANTED,
    NOT_GRANTED,
    UNAVAILABLE,
    UNINITIALIZED,
}

enum class GoogleHomeProviderPermissionResult {
    SUCCESS,
    CANCELLED,
    ERROR,
    SDK_NOT_PROVISIONED,
}

data class GoogleHomeSdkDevice(
    val providerId: String,
    val displayName: String,
    val category: String,
    val roomName: String?,
    val connectivity: String,
)

class GoogleHomeSdkInventorySource(
    private val client: GoogleHomeSdkClient,
    pseudonymizer: ProviderIdPseudonymizer = AndroidKeystoreProviderIdPseudonymizer(),
) : HomeInventorySource {
    private val normalizer = GoogleHomeInventoryNormalizer(pseudonymizer)

    suspend fun permissionState(): GoogleHomeProviderPermission = client.permissionState()

    suspend fun requestPermission(): GoogleHomeProviderPermissionResult = client.requestPermission()

    override suspend fun inventory(): CompanionInventory {
        check(permissionState() == GoogleHomeProviderPermission.GRANTED) {
            "Google Home permission is not granted"
        }
        return normalizer.normalize(
            client.readSelectedDevices().map { device ->
                GoogleHomeDeviceRecord(
                    providerId = device.providerId,
                    displayName = device.displayName,
                    category = device.category,
                    roomName = device.roomName,
                    connectivity = device.connectivity,
                )
            },
        )
    }
}

/** Safe workstation build used until the SDK download and OAuth app are configured locally. */
class UnprovisionedGoogleHomeSdkClient : GoogleHomeSdkClient {
    override suspend fun permissionState() = GoogleHomeProviderPermission.UNAVAILABLE
    override suspend fun requestPermission() = GoogleHomeProviderPermissionResult.SDK_NOT_PROVISIONED
    override suspend fun readSelectedDevices(): List<GoogleHomeSdkDevice> = emptyList()
}
