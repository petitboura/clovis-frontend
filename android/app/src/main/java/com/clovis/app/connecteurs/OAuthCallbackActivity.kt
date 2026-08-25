// Porte depuis clovis-mobile/android-legacy-natif (Lot 5, OAuthCallbackActivity.kt)
// dans le plugin Capacitor (Lot 3B, 25/08/2026). Logique inchangee : active
// invisible (theme translucide) dediee a intercepter clovismobile://oauth-callback,
// declenchee par Android apres que Custom Tabs a suivi la redirection depuis
// Notion. Ne montre aucune UI : extrait code/state, les publie via
// RetourOAuth (collecte par ConnecteursPlugin), relance MainActivity, se termine.
package com.clovis.app.connecteurs

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import com.clovis.app.MainActivity
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.launch

/** Code + state recus lors d'un retour OAuth, publies pour ConnecteursPlugin. */
object RetourOAuth {
    val evenements = MutableSharedFlow<Pair<String, String>>(extraBufferCapacity = 1)
}

class OAuthCallbackActivity : ComponentActivity() {
    @OptIn(DelicateCoroutinesApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val uri = intent?.data
        val code = uri?.getQueryParameter("code")
        val state = uri?.getQueryParameter("state")

        if (code != null && state != null) {
            // GlobalScope volontaire ici : cette Activity se termine tout de
            // suite (finish() juste apres), une portee liee a son cycle de
            // vie serait annulee avant que l'evenement parte.
            GlobalScope.launch { RetourOAuth.evenements.emit(code to state) }
        }

        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        })
        finish()
    }
}
