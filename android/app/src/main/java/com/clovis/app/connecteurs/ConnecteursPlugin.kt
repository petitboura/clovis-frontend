// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
// Porte depuis clovis-mobile/android-legacy-natif (Lot 5, ConnecteursScreen.kt
// + OAuthCallbackActivity.kt + ClovisApiClient methodes Notion) : meme flow
// Custom Tabs + retour sur clovismobile://oauth-callback, ecran retire.
//
// Cote JS :
//   const Connecteurs = registerPlugin<any>('Connecteurs');
//   await Connecteurs.statutNotion();                    // { connecte: bool }
//   await Connecteurs.demarrerConnexionNotion();          // ouvre Custom Tabs (Notion)
//   await Connecteurs.rechercherNotion({ requete });
//   Connecteurs.addListener('retourOAuth', ({ code, state }) => { ... }) // apres finaliserConnexionNotion cote backend
// L'app doit appeler finaliserConnexionNotion() elle-meme (pas ce plugin) une
// fois code/state recus, comme le faisait ConnecteursScreen.kt, ce plugin
// se contente de relayer l'evenement OAuth, pas de decider la logique.
package com.clovis.app.connecteurs

import android.content.Intent
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import com.clovis.app.pont.ClovisApiClient
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "Connecteurs")
class ConnecteursPlugin : Plugin() {

    private val client by lazy { ClovisApiClient(context) }

    override fun load() {
        super.load()
        // S'enregistre pour recevoir l'evenement publie par OAuthCallbackActivity
        // (meme mecanisme RetourOAuth que la version legacy, garde tel quel).
        CoroutineScope(Dispatchers.Main).launch {
            RetourOAuth.evenements.collect { (code, state) ->
                notifyListeners("retourOAuth", JSObject().put("code", code).put("state", state))
            }
        }
    }

    @PluginMethod
    fun statutNotion(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val statut = client.statutNotion()
                call.resolve(JSObject().put("connecte", statut.connecte))
            } catch (e: Exception) {
                call.reject("Echec de la lecture du statut Notion.", e)
            }
        }
    }

    @PluginMethod
    fun demarrerConnexionNotion(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val reponse = client.demarrerConnexionNotion()
                CoroutineScope(Dispatchers.Main).launch {
                    val customTabsIntent = CustomTabsIntent.Builder().build()
                    customTabsIntent.launchUrl(context, Uri.parse(reponse.url_autorisation))
                    call.resolve()
                }
            } catch (e: Exception) {
                call.reject("Echec du demarrage de la connexion Notion.", e)
            }
        }
    }

    @PluginMethod
    fun finaliserConnexionNotion(call: PluginCall) {
        val code = call.getString("code")
        val state = call.getString("state")
        if (code == null || state == null) {
            call.reject("Parametres 'code' et 'state' requis.")
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val reponse = client.finaliserConnexionNotion(code, state)
                call.resolve(JSObject().put("connecte", reponse.connecte).put("espace", reponse.espace))
            } catch (e: Exception) {
                call.reject("Echec de la finalisation de la connexion Notion.", e)
            }
        }
    }

    @PluginMethod
    fun rechercherNotion(call: PluginCall) {
        val requete = call.getString("requete")
        if (requete == null) {
            call.reject("Parametre 'requete' manquant.")
            return
        }
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val reponse = client.rechercherNotion(requete)
                val tableau = com.getcapacitor.JSArray()
                reponse.resultats.forEach {
                    tableau.put(JSObject().put("id", it.id).put("type", it.type).put("url", it.url))
                }
                call.resolve(JSObject().put("resultats", tableau))
            } catch (e: Exception) {
                call.reject("Echec de la recherche Notion.", e)
            }
        }
    }
}
