// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
// Porte depuis clovis-mobile/android-legacy-natif (Lot 4, ControleSessionScreen.kt
// + ControleSessionRepository.kt) : meme logique DND/volume, l'ecran est
// retire (UI cote clovis-frontend web desormais).
//
// 09/09/2026, Bourama : session desormais basee sur une duree choisie par
// l'etudiant (bouton manuel ET IA), au lieu d'un arret manuel uniquement.
// La logique (persistance d'etat + alarme d'auto-arret) vit maintenant
// dans ControleSessionRepository.demarrer/arreter (reutilisee telle
// quelle par ActionsAppareilExecuteur.kt cote IA) : ce plugin ne fait
// plus que traduire entre l'appel JS et le repository.
//
// Cote JS :
//   const ControleSession = registerPlugin<any>('ControleSession');
//   await ControleSession.permissionAccordee();          // { accordee: bool }
//   await ControleSession.ouvrirReglagesPermission();     // ouvre les Reglages systeme
//   await ControleSession.demarrerSession({ dureeMinutes }); // capture l'etat + active DND/coupe le son + programme l'auto-arret
//   await ControleSession.arreterSession();               // restaure l'etat initial exact + annule l'auto-arret programme
package com.clovis.app.controlesession

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ControleSession")
class ControleSessionPlugin : Plugin() {

    private val repo by lazy { ControleSessionRepository(context) }

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
        val dureeMinutes = call.getInt("dureeMinutes")
        if (dureeMinutes == null || dureeMinutes <= 0) {
            call.reject("dureeMinutes manquant ou invalide.")
            return
        }
        repo.demarrer(dureeMinutes).fold(
            onSuccess = { call.resolve() },
            onFailure = { call.reject(it.message ?: "Échec du démarrage de la session.") }
        )
    }

    @PluginMethod
    fun arreterSession(call: PluginCall) {
        repo.arreter().fold(
            onSuccess = { call.resolve() },
            onFailure = { call.reject(it.message ?: "Échec de l'arrêt de la session.") }
        )
    }
}
