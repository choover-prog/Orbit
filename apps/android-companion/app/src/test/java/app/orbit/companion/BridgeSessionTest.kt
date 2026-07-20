package app.orbit.companion

import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeSessionTest {
    @Test
    fun `signs exact bytes with a device session and public verification key`() {
        val signer = JvmSigner()
        val store = MemorySequenceStore()
        val session = DeviceBoundBridgeSession(signer, store)
        val inventory = emptyInventory()
        val encoder = BridgePayloadEncoder { sequence, _ ->
            "{\"protocol\":\"orbit.device-atlas.v1\",\"sequence\":$sequence}".toByteArray()
        }

        val message = session.sign(inventory, encoder)
        assertEquals(session.pairingDescriptor().sessionId, message.sessionId)
        assertTrue(
            signer.verify(
                bridgeSignatureInput(message.sessionId, message.rawPayloadUtf8),
                message.signature,
            ),
        )
        assertFalse(signer.verify(message.rawPayloadUtf8, message.signature))
        assertFalse(
            signer.verify(
                bridgeSignatureInput("different-session-1234567890", message.rawPayloadUtf8),
                message.signature,
            ),
        )
        assertTrue(message.rawPayloadUtf8.decodeToString().contains("\"sequence\":0"))
        assertEquals(0L, store.sequence)
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects oversized payloads before signing`() {
        DeviceBoundBridgeSession(JvmSigner(), MemorySequenceStore())
            .sign(emptyInventory()) { _, _ -> ByteArray(MAXIMUM_BRIDGE_PAYLOAD_BYTES + 1) }
    }

    @Test
    fun `disconnect destroys the signing key and local session metadata`() {
        val signer = JvmSigner()
        val store = MemorySequenceStore()
        val session = DeviceBoundBridgeSession(signer, store)
        session.pairingDescriptor()

        session.disconnect()

        assertTrue(signer.deleted)
        assertEquals(null, store.sessionId)
        assertEquals(-1L, store.sequence)
    }
}

private class MemorySequenceStore : BridgeSequenceStore {
    var sessionId: String? = null
    var sequence = -1L

    override fun currentSessionId(): String? = sessionId
    override fun createSessionId(): String =
        "test-device-session-1234567890".also { sessionId = it }
    override fun nextSequence(): Long = ++sequence
    override fun clear() {
        sessionId = null
        sequence = -1L
    }
}

private fun emptyInventory() = CompanionInventory(
    generatedAt = "2026-07-20T04:00:00Z",
    observations = emptyList(),
)

private class JvmSigner : DeviceBoundSigner {
    private val keyPair = KeyPairGenerator.getInstance("EC").run {
        initialize(ECGenParameterSpec("secp256r1"))
        generateKeyPair()
    }
    var deleted = false

    override val publicKeyDer: ByteArray = keyPair.public.encoded
    override fun sign(payload: ByteArray): ByteArray = Signature.getInstance("SHA256withECDSA").run {
        initSign(keyPair.private)
        update(payload)
        sign()
    }
    fun verify(payload: ByteArray, signature: ByteArray): Boolean =
        Signature.getInstance("SHA256withECDSA").run {
            initVerify(keyPair.public)
            update(payload)
            verify(signature)
        }
    override fun delete() {
        deleted = true
    }
}
