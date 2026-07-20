package app.orbit.companion

enum class GoogleHomeConsentStatus {
    NOT_CONNECTED,
    REQUESTING,
    CONNECTED,
    DENIED,
    REVOKED,
    UNAVAILABLE,
    ERROR,
}

data class GoogleHomeConsentState(
    val status: GoogleHomeConsentStatus = GoogleHomeConsentStatus.NOT_CONNECTED,
    val selectedStructureCount: Int = 0,
    val selectedDeviceCount: Int = 0,
    val explanation: String = "Google Home is not connected.",
) {
    val canReadInventory: Boolean
        get() = status == GoogleHomeConsentStatus.CONNECTED
}

sealed interface GoogleHomeConsentEvent {
    data object RequestStarted : GoogleHomeConsentEvent
    data class PermissionGranted(
        val structureCount: Int,
        val deviceCount: Int,
    ) : GoogleHomeConsentEvent
    data object PermissionDenied : GoogleHomeConsentEvent
    data object PermissionRevoked : GoogleHomeConsentEvent
    data object ProviderUnavailable : GoogleHomeConsentEvent
    data class Failed(val safeMessage: String) : GoogleHomeConsentEvent
    data object DisconnectLocal : GoogleHomeConsentEvent
}

fun reduceGoogleHomeConsent(
    current: GoogleHomeConsentState,
    event: GoogleHomeConsentEvent,
): GoogleHomeConsentState = when (event) {
    GoogleHomeConsentEvent.RequestStarted -> GoogleHomeConsentState(
        status = GoogleHomeConsentStatus.REQUESTING,
        explanation = "Choose the home and devices Orbit may read. Nothing is controlled.",
    )
    is GoogleHomeConsentEvent.PermissionGranted -> GoogleHomeConsentState(
        status = GoogleHomeConsentStatus.CONNECTED,
        selectedStructureCount = event.structureCount.coerceAtLeast(0),
        selectedDeviceCount = event.deviceCount.coerceAtLeast(0),
        explanation = "Orbit can read only the home and devices selected in Google's consent screen.",
    )
    GoogleHomeConsentEvent.PermissionDenied -> GoogleHomeConsentState(
        status = GoogleHomeConsentStatus.DENIED,
        explanation = "Access was not granted. Orbit stored no Google Home inventory.",
    )
    GoogleHomeConsentEvent.PermissionRevoked -> GoogleHomeConsentState(
        status = GoogleHomeConsentStatus.REVOKED,
        explanation = "Google Home access was removed. Local inventory was deleted.",
    )
    GoogleHomeConsentEvent.ProviderUnavailable -> GoogleHomeConsentState(
        status = GoogleHomeConsentStatus.UNAVAILABLE,
        explanation = "Google Home permissions are unavailable on this device.",
    )
    is GoogleHomeConsentEvent.Failed -> GoogleHomeConsentState(
        status = GoogleHomeConsentStatus.ERROR,
        explanation = event.safeMessage.take(180).ifBlank { "Orbit could not read Google Home." },
    )
    GoogleHomeConsentEvent.DisconnectLocal -> GoogleHomeConsentState(
        status = GoogleHomeConsentStatus.NOT_CONNECTED,
        explanation = "Local Google Home inventory and bridge credentials were deleted. Manage provider consent in Google Home.",
    )
}
