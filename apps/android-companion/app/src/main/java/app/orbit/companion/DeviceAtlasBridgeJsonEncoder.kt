package app.orbit.companion

class DeviceAtlasBridgeJsonEncoder : BridgePayloadEncoder {
    override fun encode(sequence: Long, inventory: CompanionInventory): ByteArray {
        require(sequence in 0..9_007_199_254_740_991L) { "Bridge sequence is outside the safe range" }
        require(inventory.observations.size <= MAXIMUM_GOOGLE_HOME_OBSERVATIONS) {
            "Inventory exceeds the observation limit"
        }
        val json = buildString {
            append("{\"protocol\":\"orbit.device-atlas.v1\",\"sequence\":")
            append(sequence)
            append(",\"capturedAt\":")
            appendJsonString(inventory.generatedAt)
            append(",\"observations\":[")
            inventory.observations.forEachIndexed { index, observation ->
                if (index > 0) append(',')
                appendObservation(observation)
            }
            append("]}")
        }
        return json.toByteArray(Charsets.UTF_8)
    }
}

private fun StringBuilder.appendObservation(value: AtlasObservation) {
    append("{\"id\":")
    appendJsonString(value.id)
    append(",\"source\":")
    appendJsonString(value.source.name.lowercase())
    append(",\"sourceLabel\":")
    appendJsonString(value.sourceLabel)
    append(",\"displayName\":")
    appendJsonString(value.displayName)
    append(",\"category\":")
    appendJsonString(value.category)
    value.roomLabel?.let {
        append(",\"roomLabel\":")
        appendJsonString(it)
    }
    append(",\"observedAt\":")
    appendJsonString(value.observedAt)
    append(",\"freshnessSeconds\":")
    append(value.freshnessSeconds)
    append(",\"capabilities\":")
    appendJsonArray(value.capabilityIds)
    append(",\"identity\":[")
    value.identity.forEachIndexed { index, identity ->
        if (index > 0) append(',')
        append("{\"kind\":")
        appendJsonString(identity.kind)
        append(",\"value\":")
        appendJsonString(identity.value)
        append(",\"strength\":")
        appendJsonString(identity.strength)
        append('}')
    }
    append("],\"consent\":{\"granted\":")
    append(value.consent.granted)
    append(",\"scope\":")
    appendJsonString(value.consent.scope)
    append("},\"transport\":")
    appendJsonString(value.transport)
    append(",\"status\":")
    appendJsonString(value.status)
    append(",\"monitoringModes\":")
    appendJsonArray(value.monitoringModes)
    append('}')
}

private fun StringBuilder.appendJsonArray(values: List<String>) {
    append('[')
    values.forEachIndexed { index, value ->
        if (index > 0) append(',')
        appendJsonString(value)
    }
    append(']')
}

private fun StringBuilder.appendJsonString(value: String) {
    append('"')
    value.forEach { character ->
        when (character) {
            '"' -> append("\\\"")
            '\\' -> append("\\\\")
            '\b' -> append("\\b")
            '\u000C' -> append("\\f")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> if (character.code < 0x20) {
                append("\\u")
                append(character.code.toString(16).padStart(4, '0'))
            } else {
                append(character)
            }
        }
    }
    append('"')
}
