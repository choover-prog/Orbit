package app.orbit.companion

enum class AtlasSource { GOOGLE_HOME, GOVEE, MATTER, LOCAL_MDNS }

data class AtlasIdentityEvidence(
    val kind: String,
    val value: String,
    val strength: String,
)

data class AtlasConsent(
    val granted: Boolean,
    val scope: String,
)

data class AtlasObservation(
    val id: String,
    val source: AtlasSource,
    val displayName: String,
    val category: String,
    val roomLabel: String?,
    val sourceLabel: String,
    val observedAt: String,
    val freshnessSeconds: Int,
    val capabilityIds: List<String>,
    val identity: List<AtlasIdentityEvidence>,
    val consent: AtlasConsent,
    val transport: String,
    val status: String,
    val monitoringModes: List<String>,
)

data class CompanionInventory(
    val schemaVersion: String = "1",
    val generatedAt: String,
    val observations: List<AtlasObservation>,
    val localDiscoveryMode: String = "off",
)

interface HomeInventorySource {
    suspend fun inventory(): CompanionInventory
}

interface OrbitLocalBridge {
    /** Publishes the exact signed UTF-8 JSON bytes; native SDK objects never cross this boundary. */
    suspend fun publish(message: SignedBridgeMessage): BridgeReceipt
}

data class SignedBridgeMessage(
    val sessionId: String,
    val rawPayloadUtf8: ByteArray,
    val signature: ByteArray,
)

data class BridgeReceipt(
    val accepted: Boolean,
    val acceptedObservationCount: Int,
    val message: String,
)
