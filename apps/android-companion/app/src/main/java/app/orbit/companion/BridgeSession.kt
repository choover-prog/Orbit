package app.orbit.companion

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.Base64
import javax.crypto.KeyGenerator
import javax.crypto.Mac

internal const val MAXIMUM_BRIDGE_PAYLOAD_BYTES = 256 * 1024

interface DeviceBoundSigner {
    val publicKeyDer: ByteArray
    fun sign(payload: ByteArray): ByteArray
    fun delete()
}

interface BridgeSequenceStore {
    fun currentSessionId(): String?
    fun createSessionId(): String
    fun nextSequence(): Long
    fun clear()
}

fun interface BridgePayloadEncoder {
    fun encode(sequence: Long, inventory: CompanionInventory): ByteArray
}

data class BridgePairingDescriptor(
    val protocol: String = "orbit.device-atlas.v1",
    val sessionId: String,
    val publicKeyDerBase64Url: String,
    val publicKeySha256: String,
)

class DeviceBoundBridgeSession(
    private val signer: DeviceBoundSigner,
    private val sequenceStore: BridgeSequenceStore,
) {
    private val sessionId: String = sequenceStore.currentSessionId()
        ?: sequenceStore.createSessionId()

    fun pairingDescriptor(): BridgePairingDescriptor {
        val publicKey = signer.publicKeyDer
        return BridgePairingDescriptor(
            sessionId = sessionId,
            publicKeyDerBase64Url = publicKey.base64Url(),
            publicKeySha256 = MessageDigest.getInstance("SHA-256").digest(publicKey).base64Url(),
        )
    }

    fun sign(inventory: CompanionInventory, encoder: BridgePayloadEncoder): SignedBridgeMessage {
        val sequence = sequenceStore.nextSequence()
        val rawPayloadUtf8 = encoder.encode(sequence, inventory)
        require(rawPayloadUtf8.isNotEmpty()) { "Bridge payload must not be empty" }
        require(rawPayloadUtf8.size <= MAXIMUM_BRIDGE_PAYLOAD_BYTES) {
            "Bridge payload exceeds the byte limit"
        }
        return SignedBridgeMessage(
            sessionId = sessionId,
            rawPayloadUtf8 = rawPayloadUtf8.copyOf(),
            signature = signer.sign(bridgeSignatureInput(sessionId, rawPayloadUtf8)),
        )
    }

    fun disconnect() {
        signer.delete()
        sequenceStore.clear()
    }
}

internal fun bridgeSignatureInput(sessionId: String, payload: ByteArray): ByteArray {
    require(sessionId.matches(Regex("^[A-Za-z0-9_-]{24,128}$"))) {
        "Bridge session id is invalid"
    }
    val domain = "orbit.device-atlas.signature.v1\u0000".toByteArray(Charsets.US_ASCII)
    val session = sessionId.toByteArray(Charsets.US_ASCII)
    return domain + session + byteArrayOf(0) + payload
}

class AndroidKeystoreDeviceSigner(
    private val alias: String = "orbit.device-atlas.bridge.signing.v1",
) : DeviceBoundSigner {
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun ensureKey() {
        if (keyStore.containsAlias(alias)) return
        val generator = KeyPairGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_EC,
            "AndroidKeyStore",
        )
        generator.initialize(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
            )
                .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .build(),
        )
        generator.generateKeyPair()
    }

    override val publicKeyDer: ByteArray
        get() {
            ensureKey()
            return requireNotNull(keyStore.getCertificate(alias)).publicKey.encoded.copyOf()
        }

    override fun sign(payload: ByteArray): ByteArray {
        ensureKey()
        val privateKey = requireNotNull(keyStore.getKey(alias, null))
        return Signature.getInstance("SHA256withECDSA").run {
            initSign(privateKey as java.security.PrivateKey)
            update(payload)
            sign()
        }
    }

    override fun delete() {
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }
}

class AndroidKeystoreProviderIdPseudonymizer(
    private val alias: String = "orbit.device-atlas.provider-id-hmac.v1",
) : ProviderIdPseudonymizer {
    private val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun ensureKey() {
        if (keyStore.containsAlias(alias)) return
        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_HMAC_SHA256,
            "AndroidKeyStore",
        )
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
            )
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(false)
                .build(),
        )
        generator.generateKey()
    }

    override fun pseudonymize(providerId: String): String {
        require(providerId.isNotBlank()) { "Provider id must not be blank" }
        ensureKey()
        val key = requireNotNull(keyStore.getKey(alias, null))
        return Mac.getInstance("HmacSHA256").run {
            init(key)
            doFinal(providerId.toByteArray(Charsets.UTF_8)).base64Url()
        }
    }

    fun delete() {
        if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias)
    }
}

class AndroidBridgeSequenceStore(context: Context) : BridgeSequenceStore {
    private val preferences = context.getSharedPreferences(
        "orbit_device_atlas_bridge",
        Context.MODE_PRIVATE,
    )

    override fun currentSessionId(): String? = preferences.getString("session_id", null)

    override fun createSessionId(): String {
        val random = ByteArray(24).also(SecureRandom()::nextBytes).base64Url()
        preferences.edit().putString("session_id", random).putLong("sequence", -1L).apply()
        return random
    }

    @Synchronized
    override fun nextSequence(): Long {
        val next = Math.addExact(preferences.getLong("sequence", -1L), 1L)
        preferences.edit().putLong("sequence", next).commit()
        return next
    }

    override fun clear() {
        preferences.edit().clear().apply()
    }
}

private fun ByteArray.base64Url(): String = Base64.getUrlEncoder()
    .withoutPadding()
    .encodeToString(this)
