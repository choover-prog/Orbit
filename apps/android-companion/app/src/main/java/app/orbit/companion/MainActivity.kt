package app.orbit.companion

import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var status: TextView
    private lateinit var connect: Button
    private lateinit var refresh: Button
    private lateinit var disconnect: Button
    private var source: GoogleHomeSdkInventorySource? = null
    private var consent = GoogleHomeConsentState()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildContent())
        render()
        restoreProviderState()
    }

    private fun buildContent(): View {
        val density = resources.displayMetrics.density
        val padding = (24 * density).toInt()
        val gap = (12 * density).toInt()
        val minimumTouch = (48 * density).toInt()

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(padding, padding, padding, padding)
            setBackgroundColor(Color.rgb(247, 244, 238))

            addView(TextView(context).apply {
                text = getString(R.string.app_name)
                textSize = 34f
                setTextColor(Color.rgb(23, 23, 21))
            })
            addView(TextView(context).apply {
                text = getString(R.string.google_home_privacy_explanation)
                textSize = 18f
                setTextColor(Color.rgb(75, 73, 69))
                setPadding(0, padding, 0, gap)
            }, matchWrap())

            status = TextView(context).apply {
                textSize = 17f
                setTextColor(Color.rgb(75, 73, 69))
                accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
            }
            addView(status, matchWrap())

            connect = actionButton(getString(R.string.connect_google_home), minimumTouch) {
                connectGoogleHome()
            }
            refresh = actionButton(getString(R.string.refresh_inventory), minimumTouch) {
                refreshInventory()
            }
            disconnect = actionButton(getString(R.string.disconnect_google_home), minimumTouch) {
                disconnectLocal()
            }
            addView(connect, matchWrap())
            addView(refresh, matchWrap())
            addView(disconnect, matchWrap())
        }
        return ScrollView(this).apply {
            isFillViewport = true
            addView(
                content,
                ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
        }
    }

    private fun actionButton(label: String, minimumTouch: Int, action: () -> Unit) =
        Button(this).apply {
            text = label
            minHeight = minimumTouch
            setOnClickListener { action() }
        }

    private fun connectGoogleHome() {
        lifecycleScope.launch {
            updateConsent(GoogleHomeConsentEvent.RequestStarted)
            try {
                val sdkSource = source ?: createSource().also { source = it }
                when (sdkSource.requestPermission()) {
                    GoogleHomeProviderPermissionResult.SUCCESS -> readInventory(sdkSource)
                    GoogleHomeProviderPermissionResult.CANCELLED ->
                        updateConsent(GoogleHomeConsentEvent.PermissionDenied)
                    GoogleHomeProviderPermissionResult.ERROR -> updateConsent(
                        GoogleHomeConsentEvent.Failed("Google Home could not grant access."),
                    )
                    GoogleHomeProviderPermissionResult.SDK_NOT_PROVISIONED -> updateConsent(
                        GoogleHomeConsentEvent.ProviderUnavailable,
                    )
                }
            } catch (_: Exception) {
                updateConsent(GoogleHomeConsentEvent.Failed("Orbit could not connect to Google Home."))
            }
        }
    }

    private fun restoreProviderState() {
        lifecycleScope.launch {
            val sdkSource = source ?: createSource().also { source = it }
            try {
                when (sdkSource.permissionState()) {
                    GoogleHomeProviderPermission.GRANTED -> readInventory(sdkSource)
                    GoogleHomeProviderPermission.NOT_GRANTED,
                    GoogleHomeProviderPermission.UNINITIALIZED -> Unit
                    GoogleHomeProviderPermission.UNAVAILABLE ->
                        updateConsent(GoogleHomeConsentEvent.ProviderUnavailable)
                }
            } catch (_: Exception) {
                updateConsent(GoogleHomeConsentEvent.Failed("Orbit could not restore Google Home."))
            }
        }
    }

    private fun createSource() = GoogleHomeSdkInventorySource(
        UnprovisionedGoogleHomeSdkClient(),
    )

    private fun refreshInventory() {
        val current = source ?: return
        lifecycleScope.launch {
            try {
                readInventory(current)
            } catch (_: IllegalStateException) {
                updateConsent(GoogleHomeConsentEvent.PermissionRevoked)
            } catch (_: Exception) {
                updateConsent(GoogleHomeConsentEvent.Failed("Orbit could not refresh Google Home."))
            }
        }
    }

    private suspend fun readInventory(current: GoogleHomeSdkInventorySource) {
        val inventory = current.inventory()
        updateConsent(
            GoogleHomeConsentEvent.PermissionGranted(
                structureCount = if (inventory.observations.isEmpty()) 0 else 1,
                deviceCount = inventory.observations.size,
            ),
        )
    }

    private fun disconnectLocal() {
        source = null
        AndroidKeystoreProviderIdPseudonymizer().delete()
        AndroidKeystoreDeviceSigner().delete()
        AndroidBridgeSequenceStore(this).clear()
        updateConsent(GoogleHomeConsentEvent.DisconnectLocal)
    }

    private fun updateConsent(event: GoogleHomeConsentEvent) {
        consent = reduceGoogleHomeConsent(consent, event)
        render()
    }

    private fun render() {
        status.text = buildString {
            append(consent.explanation)
            if (consent.canReadInventory) {
                append("\n\n")
                append(resources.getQuantityString(
                    R.plurals.selected_devices,
                    consent.selectedDeviceCount,
                    consent.selectedDeviceCount,
                ))
            }
        }
        val busy = consent.status == GoogleHomeConsentStatus.REQUESTING
        connect.isEnabled = !busy && !consent.canReadInventory
        refresh.isEnabled = !busy && consent.canReadInventory
        disconnect.isEnabled = !busy && consent.status != GoogleHomeConsentStatus.NOT_CONNECTED
    }

    private fun matchWrap() = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
    )
}
