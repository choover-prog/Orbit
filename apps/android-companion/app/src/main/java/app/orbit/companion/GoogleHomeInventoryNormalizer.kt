package app.orbit.companion

import java.time.Clock
import java.time.Instant

internal const val MAXIMUM_GOOGLE_HOME_OBSERVATIONS = 250

internal data class GoogleHomeDeviceRecord(
    val providerId: String,
    val displayName: String,
    val category: String,
    val roomName: String?,
    val connectivity: String,
)

fun interface ProviderIdPseudonymizer {
    fun pseudonymize(providerId: String): String
}

internal class GoogleHomeInventoryNormalizer(
    private val pseudonymizer: ProviderIdPseudonymizer,
    private val clock: Clock = Clock.systemUTC(),
) {
    fun normalize(records: List<GoogleHomeDeviceRecord>): CompanionInventory {
        val observedAt = Instant.now(clock).toString()
        val observations = records
            .asSequence()
            .filter { it.providerId.isNotBlank() && it.displayName.isNotBlank() }
            .distinctBy { it.providerId }
            .take(MAXIMUM_GOOGLE_HOME_OBSERVATIONS)
            .map { record ->
                val opaqueId = pseudonymizer.pseudonymize(record.providerId)
                require(opaqueId.matches(Regex("^[A-Za-z0-9_-]{16,128}$"))) {
                    "Provider pseudonym is not a bounded base64url value"
                }
                AtlasObservation(
                    id = "google-home:$opaqueId",
                    source = AtlasSource.GOOGLE_HOME,
                    displayName = record.displayName.take(256),
                    category = record.category.ifBlank { "other" }.take(256),
                    roomLabel = record.roomName?.takeIf(String::isNotBlank)?.take(256),
                    sourceLabel = "Google Home companion",
                    observedAt = observedAt,
                    freshnessSeconds = 300,
                    capabilityIds = listOf("observe.connectivity"),
                    identity = listOf(
                        AtlasIdentityEvidence("provider_link", opaqueId, "strong"),
                    ),
                    consent = AtlasConsent(true, "Selected Google Home structures and devices"),
                    transport = "hybrid",
                    status = normalizeConnectivity(record.connectivity),
                    monitoringModes = listOf("manual_refresh"),
                )
            }
            .toList()

        return CompanionInventory(
            generatedAt = observedAt,
            observations = observations,
            localDiscoveryMode = "off",
        )
    }

    private fun normalizeConnectivity(connectivity: String): String = when (connectivity) {
        "ONLINE", "PARTIALLY_ONLINE" -> "online"
        "OFFLINE" -> "offline"
        else -> "unknown"
    }
}
