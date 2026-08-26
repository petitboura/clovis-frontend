// Cree le 26/08/2026, Bourama : construction des interfaces manquantes,
// Partie 3 mobile. Porte depuis clovis-mobile/android-legacy-natif
// (Lot 3, RappelsNatifs.kt).
//
// DIFFERENCE avec le legacy : creerAlarme() (AlarmClock.ACTION_SET_ALARM,
// vers l'app Horloge) n'est PAS repris ici. Le plugin iOS deja construit
// (NotificationsPlugin.swift, cote ios/App/App/notifications/) n'expose
// que demanderAutorisation/autorisationAccordee/afficherNotificationTest/
// programmerRappel/creerEvenementCalendrier/ouvrirApp : pas d'equivalent
// "alarme horloge" cote iOS (aucune app Horloge tierce a viser sur iOS).
// Pour que la MEME interface web fonctionne identiquement sur les deux
// plateformes, ce plugin Android suit ce contrat deja fixe plutot que
// d'ajouter une 7e methode sans equivalent iOS. A signaler a Bourama si
// l'alarme Horloge doit malgre tout etre ajoutee en plus (spécifique
// Android, geree a part).
//
// Chaque fonction renvoie un Boolean (succes/echec) plutot que le Toast du
// legacy : c'est au plugin (NotificationsPlugin.kt) de resoudre/rejeter
// l'appel JS en consequence, pas a cette classe de decider comment
// informer l'etudiant.
package com.clovis.app.notifications

import android.content.Context
import android.content.Intent
import android.provider.CalendarContract

object RappelsNatifs {

    /**
     * Toujours vrai en pratique sur cette methode d'insertion (delegue a
     * l'app Calendrier, qui affiche sa propre UI de confirmation : voir
     * commentaire du fichier legacy sur le choix de ACTION_INSERT plutot
     * qu'un ContentResolver direct). Renvoie quand meme false si aucune
     * app Calendrier n'est installee, cas reel sur certains appareils.
     */
    fun ajouterEvenementCalendrier(
        context: Context,
        titre: String,
        description: String,
        debutMillis: Long,
        finMillis: Long
    ): Boolean {
        val intent = Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.Events.TITLE, titre)
            putExtra(CalendarContract.Events.DESCRIPTION, description)
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, debutMillis)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME, finMillis)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        if (intent.resolveActivity(context.packageManager) == null) return false
        context.startActivity(intent)
        return true
    }

    /**
     * Ne fonctionne que pour un `nomPaquet` deja declare dans le bloc
     * <queries> de AndroidManifest.xml (restriction de visibilite des
     * packages depuis Android 11, deja documentee dans le legacy). Ce
     * bloc est actuellement VIDE : aucune app tierce n'est donc ouvrable
     * pour l'instant, a completer par Bourama une fois qu'il aura
     * confirme lesquelles (WhatsApp, Calculatrice...), pas devine ici.
     */
    fun ouvrirApp(context: Context, nomPaquet: String): Boolean {
        val intent = context.packageManager.getLaunchIntentForPackage(nomPaquet) ?: return false
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        return true
    }
}
