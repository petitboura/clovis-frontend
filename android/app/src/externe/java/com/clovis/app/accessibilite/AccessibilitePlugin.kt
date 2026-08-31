// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
// Porte depuis clovis-mobile/android-legacy-natif (Lot 6-7, EcranAccessibilite.kt
// + ModuleAccessibilite.kt) : meme logique (AppsAutorisees, ExecuteurActions,
// JournalAccessibilite/Actions, ServiceAccessibiliteClovis, copies telles
// quelles a cote de ce fichier), l'ecran Compose est retire.
//
// Flavor "externe" UNIQUEMENT (voir 00-commun.md, isolation au niveau des
// sources compilees), ce fichier n'existe pas dans le flavor "play", voir
// src/play/.../accessibilite/AccessibilitePlugin.kt (stub).
//
// Cote JS :
//   const Accessibilite = registerPlugin<any>('Accessibilite');
//   await Accessibilite.disponible();                    // { disponible: true } (toujours, ce flavor)
//   await Accessibilite.serviceActif();                   // { actif: bool }
//   await Accessibilite.ouvrirReglagesService();
//   await Accessibilite.listerAppsAutorisees();
//   await Accessibilite.autoriserApp({ nomPaquet });
//   await Accessibilite.revoquerApp({ nomPaquet });
//   await Accessibilite.journalAccessibilite();            // dernieres lectures passives
//   await Accessibilite.journalActions();                  // dernieres tentatives d'action
//   await Accessibilite.cliquerParTexte({ texteCible });
//   await Accessibilite.saisirTexteParCible({ texteCible, valeur });
//   await Accessibilite.listerAppsInstallees();             // { apps: [{ nomPaquet, nomAffiche, icone }] }
//
// 31/08/2026 : listerAppsAutorisees()/journalAccessibilite()/journalActions()
// ne renvoyaient que nomPaquet brut, affiche tel quel cote web, et il
// n'existait aucun moyen de choisir une app installee (saisie manuelle du
// nom de paquet uniquement). Ajout de nomAffiche/icone (via ResolveurApps,
// util partage) sur les trois, et de listerAppsInstallees() pour un vrai
// selecteur cote web (voir <queries> ajoute dans le manifest "externe").
package com.clovis.app.accessibilite

import android.content.Intent
import android.provider.Settings
import com.clovis.app.util.ResolveurApps
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Accessibilite")
class AccessibilitePlugin : Plugin() {

    init {
        AppsAutorisees.initialiser(context)
    }

    @PluginMethod
    fun disponible(call: PluginCall) {
        call.resolve(JSObject().put("disponible", true))
    }

    @PluginMethod
    fun serviceActif(call: PluginCall) {
        call.resolve(JSObject().put("actif", ServiceAccessibiliteClovis.instance != null))
    }

    @PluginMethod
    fun ouvrirReglagesService(call: PluginCall) {
        context.startActivity(
            Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
        call.resolve()
    }

    @PluginMethod
    fun listerAppsAutorisees(call: PluginCall) {
        val tableau = JSArray()
        AppsAutorisees.autorisees.value.forEach { nomPaquet ->
            val resolue = ResolveurApps.resoudre(context, nomPaquet)
            tableau.put(
                JSObject()
                    .put("nomPaquet", nomPaquet)
                    .put("nomAffiche", resolue.nomAffiche)
                    .put("icone", resolue.icone)
            )
        }
        call.resolve(JSObject().put("apps", tableau))
    }

    @PluginMethod
    fun listerAppsInstallees(call: PluginCall) {
        val tableau = JSArray()
        ResolveurApps.listerAppsInstallees(context).forEach { app ->
            tableau.put(
                JSObject()
                    .put("nomPaquet", app.nomPaquet)
                    .put("nomAffiche", app.nomAffiche)
                    .put("icone", app.icone)
            )
        }
        call.resolve(JSObject().put("apps", tableau))
    }

    @PluginMethod
    fun autoriserApp(call: PluginCall) {
        val nomPaquet = call.getString("nomPaquet")
        if (nomPaquet == null) {
            call.reject("Parametre 'nomPaquet' manquant.")
            return
        }
        AppsAutorisees.autoriser(nomPaquet)
        call.resolve()
    }

    @PluginMethod
    fun revoquerApp(call: PluginCall) {
        val nomPaquet = call.getString("nomPaquet")
        if (nomPaquet == null) {
            call.reject("Parametre 'nomPaquet' manquant.")
            return
        }
        AppsAutorisees.revoquer(nomPaquet)
        call.resolve()
    }

    @PluginMethod
    fun journalAccessibilite(call: PluginCall) {
        val tableau = JSArray()
        JournalAccessibilite.entrees.value.forEach {
            val resolue = ResolveurApps.resoudre(context, it.nomPaquet)
            tableau.put(
                JSObject()
                    .put("nomPaquet", it.nomPaquet)
                    .put("nomAffiche", resolue.nomAffiche)
                    .put("icone", resolue.icone)
                    .put("typeEvenement", it.typeEvenement)
                    .put("nombreNoeudsLus", it.nombreNoeudsLus)
                    .put("horodatage", it.horodatage)
            )
        }
        call.resolve(JSObject().put("entrees", tableau))
    }

    @PluginMethod
    fun journalActions(call: PluginCall) {
        val tableau = JSArray()
        JournalActions.entrees.value.forEach {
            val resolue = ResolveurApps.resoudre(context, it.nomPaquet)
            tableau.put(
                JSObject()
                    .put("nomPaquet", it.nomPaquet)
                    .put("nomAffiche", resolue.nomAffiche)
                    .put("icone", resolue.icone)
                    .put("cible", it.cible)
                    .put("succes", it.succes)
                    .put("message", it.message)
                    .put("horodatage", it.horodatage)
            )
        }
        call.resolve(JSObject().put("entrees", tableau))
    }

    @PluginMethod
    fun cliquerParTexte(call: PluginCall) {
        val texteCible = call.getString("texteCible")
        if (texteCible == null) {
            call.reject("Parametre 'texteCible' manquant.")
            return
        }
        val resultat = ExecuteurActions.cliquerParTexte(texteCible)
        call.resolve(JSObject().put("succes", resultat.succes).put("message", resultat.message))
    }

    @PluginMethod
    fun saisirTexteParCible(call: PluginCall) {
        val texteCible = call.getString("texteCible")
        val valeur = call.getString("valeur")
        if (texteCible == null || valeur == null) {
            call.reject("Parametres 'texteCible' et 'valeur' requis.")
            return
        }
        val resultat = ExecuteurActions.saisirTexteParCible(texteCible, valeur)
        call.resolve(JSObject().put("succes", resultat.succes).put("message", resultat.message))
    }
}
