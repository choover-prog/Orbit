package app.orbit.companion

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val padding = (24 * resources.displayMetrics.density).toInt()
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(padding, padding, padding, padding)
            setBackgroundColor(Color.rgb(247, 244, 238))
        }
        content.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 34f
            setTextColor(Color.rgb(23, 23, 21))
        })
        content.addView(TextView(this).apply {
            text = getString(R.string.companion_status)
            textSize = 18f
            setTextColor(Color.rgb(109, 106, 100))
            setPadding(0, padding, 0, 0)
        }, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setContentView(content)
    }
}
