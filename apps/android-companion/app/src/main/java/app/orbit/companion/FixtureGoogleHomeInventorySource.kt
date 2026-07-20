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
                capabilityIds = listOf("observe.power", "control.power", "control.brightness"),
                consentScope = "Selected fictional home and devices",
                status = "online",
            ),
            AtlasObservation(
                id = "fixture-google-home-coffee-plug",
                source = AtlasSource.MATTER,
                displayName = "Coffee plug",
                category = "outlet",
                roomLabel = "Kitchen",
                capabilityIds = listOf("observe.power", "control.power"),
                consentScope = "Selected fictional home and devices",
                status = "online",
            ),
        ),
    )
}
