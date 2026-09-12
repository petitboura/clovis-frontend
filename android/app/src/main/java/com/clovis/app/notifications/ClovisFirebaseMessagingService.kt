// Cree le 23/08/2026 (Lot 3, clovis-mobile), etendu 24/08 (Lot 1A/1B),
// porte le 25/08/2026 dans le plugin Capacitor (Lot 3B), meme logique,
// seul le package du dispatcher change (com.clovis.app.pont au lieu de
// com.clovis.app.data).
package com.clovis.app.notifications

import android.util.Log
import com.clovis.app.pont.ActionsAppareilExecuteur
import com.clovis.app.pont.ClovisApiClient
import com.clovis.app.pont.IdentifiantAppareil
import com.clovis.app.pont.StockageToken
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.ktor.http.isSuccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ClovisFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        // Ajoute le 12/09/2026 (suite) : extrait d'onNewToken pour etre
        // aussi appelable depuis une demande EXPLICITE du token au
        // demarrage (voir ClovisFirebaseApp.kt) -- onNewToken seul ne se
        // declenchait jamais sur l'appareil de Bourama (aucune ligne
        // "Aucun token push local a renvoyer" n'etait jamais devenue un
        // vrai token dans les logs), sans aucune erreur nulle part : ce
        // callback ne dit jamais POURQUOI il ne se declenche pas.
        fun traiterNouveauToken(context: android.content.Context, token: String) {
            // Garde le token localement quoi qu'il arrive : si l'envoi ci-dessous
            // echoue (typiquement parce que le JS n'a pas encore eu le temps de
            // transmettre la session Supabase a ce demarrage de l'app),
            // PontNatifPlugin.enregistrerToken le renverra des qu'une session
            // valide sera disponible (voir ce fichier, 12/09/2026).
            StockageToken.enregistrerTokenPush(context, token)
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    val appareilId = IdentifiantAppareil.obtenirId(context)
                    val reponse = ClovisApiClient(context).enregistrerTokenPush("android", token, appareilId)
                    if (!reponse.status.isSuccess()) {
                        Log.w("ClovisFCM", "Envoi du nouveau token push refuse par le serveur (statut ${reponse.status}), sera retente a la prochaine connexion.")
                    }
                } catch (e: Exception) {
                    Log.w("ClovisFCM", "Echec reseau lors de l'envoi du nouveau token push, sera retente a la prochaine connexion.", e)
                }
            }
        }
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        traiterNouveauToken(applicationContext, token)
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
