// Cree le 26/08/2026, Bourama : construction des interfaces manquantes,
// Partie 3 mobile : declenche par AlarmManager (voir NotificationsPlugin.kt,
// programmerRappel), affiche la notification via NotificationsNatives
// (meme mecanisme que le reste des rappels, deja utilise pour les push
// FCM entrants : pas de deuxieme systeme d'affichage invente ici).
package com.clovis.app.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

const val EXTRA_TITRE_RAPPEL = "titre_rappel"
const val EXTRA_CORPS_RAPPEL = "corps_rappel"

class RappelAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val titre = intent.getStringExtra(EXTRA_TITRE_RAPPEL) ?: return
        val corps = intent.getStringExtra(EXTRA_CORPS_RAPPEL) ?: ""
        NotificationsNatives.afficherRappel(context, titre, corps)
    }
}
