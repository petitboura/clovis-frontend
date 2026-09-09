// Ajoute le 09/09/2026, Bourama : remplace l'ancien stub (Play Store gerait
// la mise a jour lui-meme). La publication sur le vrai Play Store est
// abandonnee, ce flavor est desormais distribue hors Play Store comme
// "externe" -- meme logique de verification/telechargement, dupliquee ici
// plutot que partagee pour ne rien toucher au flavor "externe" (voir ce
// dossier-la pour l'original).
//
// Cote JS :
//   const MiseAJour = registerPlugin<any>('MiseAJour');
//   await MiseAJour.disponible();  // { disponible: true } (toujours, ce flavor)
//   await MiseAJour.verifier();    // { misAJourDisponible: bool, version?, urlTelechargement?, urlPage? }
//   await MiseAJour.ouvrirTelechargement({ urlTelechargement });
package com.clovis.app.miseajour

import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "MiseAJour")
class MiseAJourPlugin : Plugin() {

    @PluginMethod
    fun disponible(call: PluginCall) {
        call.resolve(JSObject().put("disponible", true))
    }

    @PluginMethod
    fun verifier(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val info = VerificateurMiseAJour.verifier()
                if (info == null) {
                    call.resolve(JSObject().put("misAJourDisponible", false))
                } else {
                    call.resolve(
                        JSObject()
                            .put("misAJourDisponible", true)
                            .put("version", info.version)
                            .put("urlTelechargement", info.urlTelechargement)
                            .put("urlPage", info.urlPage)
                    )
                }
            } catch (e: Exception) {
                // Pas de connexion ou API indisponible : pas une erreur bloquante,
                // meme comportement que le flavor externe (n'embete pas l'etudiant).
                call.resolve(JSObject().put("misAJourDisponible", false))
            }
        }
    }

    @PluginMethod
    fun ouvrirTelechargement(call: PluginCall) {
        val url = call.getString("urlTelechargement")
        if (url == null) {
            call.reject("Parametre 'urlTelechargement' manquant.")
            return
        }
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        call.resolve()
    }
}
