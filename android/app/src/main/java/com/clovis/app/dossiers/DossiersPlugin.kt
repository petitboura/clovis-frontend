// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
// Porte depuis clovis-mobile/android-legacy-natif (Lot 2, DossiersScreen.kt
// + DossiersDesignesRepository.kt) : meme logique SAF, l'UI (liste/navigation/
// dialogues) est retiree ici, a construire cote clovis-frontend (web) qui
// appelle ce plugin -- voir echange avec Bourama (25/08, Lot 3B).
//
// Cote JS :
//   import { registerPlugin } from '@capacitor/core';
//   const Dossiers = registerPlugin<any>('Dossiers');
//   await Dossiers.choisirDossier();               // ouvre le selecteur systeme
//   await Dossiers.listerDossiersDesignes();
//   await Dossiers.listerContenu({ uri });
//   await Dossiers.creerSousDossier({ parentUri, nom });
//   await Dossiers.creerFichier({ parentUri, nom, typeMime });
//   await Dossiers.renommer({ elementUri, nouveauNom });
//   await Dossiers.supprimer({ elementUri });
//   await Dossiers.deplacer({ elementUri, ancienParentUri, nouveauParentUri });
//   await Dossiers.retirerDossierDesigne({ uri });
package com.clovis.app.dossiers

import android.content.Intent
import android.net.Uri
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "Dossiers")
class DossiersPlugin : Plugin() {

    private val repo by lazy { DossiersDesignesRepository(context) }

    private fun DossierDesigne.toJson() = JSObject().apply {
        put("uri", uri.toString())
        put("nom", nom)
    }

    private fun ElementDossier.toJson() = JSObject().apply {
        put("uri", uri.toString())
        put("nom", nom)
        put("estDossier", estDossier)
        put("tailleOctets", tailleOctets)
    }

    @PluginMethod
    fun listerDossiersDesignes(call: PluginCall) {
        val tableau = JSArray()
        repo.listerDossiersDesignes().forEach { tableau.put(it.toJson()) }
        call.resolve(JSObject().put("dossiers", tableau))
    }

    /**
     * Ouvre le selecteur systeme (ACTION_OPEN_DOCUMENT_TREE). Le resultat
     * arrive dans handleChoixDossier ci-dessous (pattern Capacitor standard,
     * remplace rememberLauncherForActivityResult utilise cote Compose).
     */
    @PluginMethod
    fun choisirDossier(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
        saveCall(call)
        startActivityForResult(call, intent, "handleChoixDossier")
    }

    @ActivityCallback
    private fun handleChoixDossier(call: PluginCall?, result: androidx.activity.result.ActivityResult) {
        val call = call ?: return
        val uri: Uri? = result.data?.data
        if (result.resultCode != android.app.Activity.RESULT_OK || uri == null) {
            call.reject("Aucun dossier choisi.")
            return
        }
        repo.ajouterDossierDesigne(uri)
        val dossier = repo.listerDossiersDesignes().firstOrNull { it.uri == uri }
        if (dossier == null) {
            call.reject("Dossier ajoute mais introuvable juste apres (cas inattendu).")
            return
        }
        call.resolve(dossier.toJson())
    }

    @PluginMethod
    fun retirerDossierDesigne(call: PluginCall) {
        val uri = call.getString("uri")
        if (uri == null) {
            call.reject("Parametre 'uri' manquant.")
            return
        }
        repo.retirerDossierDesigne(Uri.parse(uri))
        call.resolve()
    }

    @PluginMethod
    fun listerContenu(call: PluginCall) {
        val uri = call.getString("uri")
        if (uri == null) {
            call.reject("Parametre 'uri' manquant.")
            return
        }
        val tableau = JSArray()
        repo.listerContenu(Uri.parse(uri)).forEach { tableau.put(it.toJson()) }
        call.resolve(JSObject().put("elements", tableau))
    }

    @PluginMethod
    fun creerSousDossier(call: PluginCall) {
        val parentUri = call.getString("parentUri")
        val nom = call.getString("nom")
        if (parentUri == null || nom == null) {
            call.reject("Parametres 'parentUri' et 'nom' requis.")
            return
        }
        val ok = repo.creerSousDossier(Uri.parse(parentUri), nom)
        if (ok) call.resolve() else call.reject("Echec de la creation du sous-dossier.")
    }

    @PluginMethod
    fun creerFichier(call: PluginCall) {
        val parentUri = call.getString("parentUri")
        val nom = call.getString("nom")
        val typeMime = call.getString("typeMime") ?: "text/plain"
        if (parentUri == null || nom == null) {
            call.reject("Parametres 'parentUri' et 'nom' requis.")
            return
        }
        val ok = repo.creerFichier(Uri.parse(parentUri), nom, typeMime)
        if (ok) call.resolve() else call.reject("Echec de la creation du fichier.")
    }

    @PluginMethod
    fun renommer(call: PluginCall) {
        val elementUri = call.getString("elementUri")
        val nouveauNom = call.getString("nouveauNom")
        if (elementUri == null || nouveauNom == null) {
            call.reject("Parametres 'elementUri' et 'nouveauNom' requis.")
            return
        }
        val ok = repo.renommer(Uri.parse(elementUri), nouveauNom)
        if (ok) call.resolve() else call.reject("Echec du renommage.")
    }

    @PluginMethod
    fun supprimer(call: PluginCall) {
        val elementUri = call.getString("elementUri")
        if (elementUri == null) {
            call.reject("Parametre 'elementUri' manquant.")
            return
        }
        val ok = repo.supprimer(Uri.parse(elementUri))
        if (ok) call.resolve() else call.reject("Echec de la suppression.")
    }

    @PluginMethod
    fun deplacer(call: PluginCall) {
        val elementUri = call.getString("elementUri")
        val ancienParentUri = call.getString("ancienParentUri")
        val nouveauParentUri = call.getString("nouveauParentUri")
        if (elementUri == null || ancienParentUri == null || nouveauParentUri == null) {
            call.reject("Parametres 'elementUri', 'ancienParentUri' et 'nouveauParentUri' requis.")
            return
        }
        val ok = repo.deplacer(Uri.parse(elementUri), Uri.parse(ancienParentUri), Uri.parse(nouveauParentUri))
        if (ok) call.resolve() else call.reject("Echec du deplacement.")
    }
}
