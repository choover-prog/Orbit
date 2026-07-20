package app.orbit.companion

enum class AtlasSource { GOOGLE_HOME, GOVEE, MATTER, LOCAL_MDNS }

data class AtlasObservation(
    val id: String,
    val source: AtlasSource,
    val displayName: String,
    val category: String,
    val roomLabel: String?,
    val capabilityIds: List<String>,
    val consentScope: String,
    val status: String,
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
    /** Publishes provider-neutral observations only; native SDK objects never cross this boundary. */
    suspend fun publish(inventory: CompanionInventory): BridgeReceipt
}

data class BridgeReceipt(
    val accepted: Boolean,
    val acceptedObservationCount: Int,
    val message: String,
)
