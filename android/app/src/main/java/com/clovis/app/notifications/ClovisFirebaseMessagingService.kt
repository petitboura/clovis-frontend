// Cree le 23/08/2026 (Lot 3, clovis-mobile), etendu 24/08 (Lot 1A/1B),
// porte le 25/08/2026 dans le plugin Capacitor (Lot 3B), meme logique,
// seul le package du dispatcher change (com.clovis.app.pont au lieu de
// com.clovis.app.data).
package com.clovis.app.notifications

import android.util.Log
import com.clovis.app.pont.ActionsAppareilExecuteur
import com.clovis.app.pont.ClovisApiClient
import com.clovis.app.pont.IdentifiantAppareil
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ClovisFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val appareilId = IdentifiantAppareil.obtenirId(applicationContext)
                ClovisApiClient(applicationContext).enregistrerTokenPush("android", token, appareilId)
            } catch (e: Exception) {
                Log.w("ClovisFCM", "Echec enregistrement nouveau token push.", e)
            }
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        // Push type="action" (silencieux, voir _envoyer_fcm_action cote
        // backend) -> executer, pas de notification affichee.
        if (message.data["type"] == "action") {
            val actionId = message.data["action_id"]
            if (actionId == null) {
                Log.w("ClovisFCM", "Push type=action recu sans action_id, ignore.")
                return
            }
            CoroutineScope(Dispatchers.IO).launch {
                ActionsAppareilExecuteur.executerAction(applicationContext, actionId)
            }
            return
        }

        val titre = message.data["title"] ?: "Clovis"
        val corps = message.data["body"] ?: ""
        val prioritaire = message.data["prioritaire"] == "true"
        NotificationsNatives.afficherRappel(applicationContext, titre, corps, prioritaire)
    }
}
