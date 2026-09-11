// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
//
// Point d'entree JS -> natif. Cote clovis-frontend (TypeScript), appeler :
//   import { registerPlugin } from '@capacitor/core';
//   const PontNatif = registerPlugin<any>('PontNatif');
//   await PontNatif.enregistrerToken({ token: session.access_token });
// A appeler une fois apres connexion Supabase ET a chaque rafraichissement
// de token (onAuthStateChange), pour que StockageToken reste a jour et que
// le service FCM puisse appeler clovis-backend meme WebView fermee.
package com.clovis.app.pont

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import io.ktor.http.isSuccess
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "PontNatif")
class PontNatifPlugin : Plugin() {

    @PluginMethod
    fun enregistrerToken(call: PluginCall) {
        val token = call.getString("token")
        if (token == null) {
            call.reject("Parametre 'token' manquant.")
            return
        }
        StockageToken.enregistrer(context, token)
        call.resolve()
        // Ajoute le 12/09/2026 : si Google avait deja donne un token push a
        // l'app avant cette connexion (ou avant que cette session ne soit
        // transmise), le tout premier envoi a pu echouer faute de session
        // valide a ce moment-la (voir ClovisFirebaseMessagingService.kt).
        // On le retente ici, a chaque connexion/rafraichissement, avec la
        // session qu'on vient de recevoir.
        val tokenPush = StockageToken.lireTokenPush(context) ?: return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val appareilId = IdentifiantAppareil.obtenirId(context)
                val reponse = ClovisApiClient(context).enregistrerTokenPush("android", tokenPush, appareilId)
                if (!reponse.status.isSuccess()) {
                    Log.w("PontNatif", "Renvoi du token push a la connexion refuse par le serveur (statut ${reponse.status}).")
                }
            } catch (e: Exception) {
                Log.w("PontNatif", "Echec reseau lors du renvoi du token push a la connexion.", e)
            }
        }
    }

    @PluginMethod
    fun deconnexion(call: PluginCall) {
        StockageToken.effacer(context)
        call.resolve()
    }

    /**
     * Filet de secours (equivalent de rattraperActionsEnAttente dans
     * MainActivity.kt cote clovis-mobile) : a appeler depuis le JS a
     * chaque ouverture/reprise de l'app (ex. useEffect au montage du
     * layout principal), pour rattraper les actions dont le push n'est
     * jamais arrive.
     */
    @PluginMethod
    fun rattraperActionsEnAttente(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val client = ClovisApiClient(context)
                val appareilId = IdentifiantAppareil.obtenirId(context)
                val actions = client.obtenirActionsEnAttente(appareilId).actions
                for (action in actions) {
                    ActionsAppareilExecuteur.executerAction(context, action.id)
                }
                call.resolve(JSObject().put("traitees", actions.size))
            } catch (e: Exception) {
                call.reject("Echec rattrapage actions en attente.", e)
            }
        }
    }
}
