// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
// Porte depuis clovis-mobile/android-legacy-natif (Lot 4, ControleSessionScreen.kt
// + ControleSessionRepository.kt) : meme logique DND/volume, l'ecran est
// retire (UI cote clovis-frontend web desormais).
//
// Cote JS :
//   const ControleSession = registerPlugin<any>('ControleSession');
//   await ControleSession.permissionAccordee();      // { accordee: bool }
//   await ControleSession.ouvrirReglagesPermission(); // ouvre les Reglages systeme
//   await ControleSession.demarrerSession();          // capture l'etat + active DND/coupe le son
//   await ControleSession.arreterSession();           // restaure l'etat initial exact
package com.clovis.app.controlesession

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ControleSession")
class ControleSessionPlugin : Plugin() {

    private val repo by lazy { ControleSessionRepository(context) }

    // Etat de la session en cours, garde en memoire le temps que l'app tourne
    // (equivalent du remember { } cote Compose), une session ne survit pas
    // a un kill de process, meme limite deja documentee dans le README.
    private var etatInitial: EtatInitialSession? = null

    @PluginMethod
    fun permissionAccordee(call: PluginCall) {
        call.resolve(JSObject().put("accordee", repo.permissionAccordee()))
    }

    @PluginMethod
    fun ouvrirReglagesPermission(call: PluginCall) {
        repo.ouvrirReglagesPermission()
        call.resolve()
    }

    @PluginMethod
    fun demarrerSession(call: PluginCall) {
        if (!repo.permissionAccordee()) {
            call.reject("Permission 'Acces a la Politique de Notification' non accordee.")
            return
        }
        etatInitial = repo.capturerEtatInitial()
        repo.activerNePasDeranger()
        repo.couperSonnerieEtNotifications()
        call.resolve()
    }

    @PluginMethod
    fun arreterSession(call: PluginCall) {
        val etat = etatInitial
        if (etat == null) {
            call.reject("Aucune session en cours (demarrerSession jamais appele ou deja arretee).")
            return
        }
        repo.restaurerEtatInitial(etat)
        etatInitial = null
        call.resolve()
    }
}
