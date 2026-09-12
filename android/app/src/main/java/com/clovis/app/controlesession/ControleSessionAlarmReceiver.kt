// Cree le 09/09/2026, Bourama : session de concentration basee sur une
// duree (au lieu d'un arret manuel uniquement). Meme patron que
// RappelAlarmReceiver.kt (notifications/) : declenche par AlarmManager,
// tourne meme si l'app/le plugin ne sont plus en vie.
//
// Restaure l'etat sauvegarde par ControleSessionRepository (SharedPreferences,
// pas la memoire du plugin) : c'est precisement ce qui rend l'auto-arret
// fiable meme si l'app a ete tuee entre le demarrage de la session et la
// fin de la duree choisie.
package com.clovis.app.controlesession

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ControleSessionAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ControleSessionRepository(context).restaurerEtatALaFinDeLaSession()
    }
}
