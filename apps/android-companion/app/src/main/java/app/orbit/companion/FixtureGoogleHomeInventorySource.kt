package app.orbit.companion

class FixtureGoogleHomeInventorySource : HomeInventorySource {
    override suspend fun inventory() = CompanionInventory(
        generatedAt = "2026-07-19T14:30:00.000Z",
        observations = listOf(
            AtlasObservation(
                id = "fixture-google-home-entry-lamp",
                source = AtlasSource.GOOGLE_HOME,
                displayName = "Entry lamp",
                category = "light",
                roomLabel = "Entry",
                sourceLabel = "Google Home companion",
                observedAt = "2026-07-19T14:30:00.000Z",
                freshnessSeconds = 300,
                capabilityIds = listOf("observe.power", "control.power", "control.brightness"),
                identity = listOf(
                    AtlasIdentityEvidence("provider_link", "fictional:govee:entry-lamp-01", "strong"),
                ),
                consent = AtlasConsent(true, "Selected fictional home and devices"),
                transport = "hybrid",
                status = "online",
                monitoringModes = listOf("bounded_poll"),
            ),
            AtlasObservation(
                id = "fixture-google-home-coffee-plug",
                source = AtlasSource.MATTER,
                displayName = "Coffee plug",
                category = "outlet",
                roomLabel = "Kitchen",
                sourceLabel = "Selected Matter service",
                observedAt = "2026-07-19T14:30:00.000Z",
                freshnessSeconds = 30,
                capabilityIds = listOf("observe.power", "control.power"),
                identity = listOf(
                    AtlasIdentityEvidence("matter_node", "fixture-fabric-1:node-22", "strong"),
                ),
                consent = AtlasConsent(true, "Selected fictional home and devices"),
                transport = "local",
                status = "online",
                monitoringModes = listOf("event_subscription"),
            ),
        ),
    )
}
