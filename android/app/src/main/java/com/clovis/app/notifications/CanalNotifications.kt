// Cree le 23/08/2026 (Lot 3, clovis-mobile), porte tel quel le 25/08/2026
// dans le plugin Capacitor (Lot 3B).
package com.clovis.app.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

const val CANAL_RAPPELS = "rappels"
const val CANAL_RAPPELS_URGENTS = "rappels_urgents"

fun creerCanauxNotifications(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    val gestionnaire = context.getSystemService(NotificationManager::class.java)

    val canalStandard = NotificationChannel(
        CANAL_RAPPELS,
        "Rappels Clovis",
        NotificationManager.IMPORTANCE_HIGH
    ).apply {
        description = "Rappels et notifications programmés par Clovis."
    }

    val canalUrgent = NotificationChannel(
        CANAL_RAPPELS_URGENTS,
        "Rappels prioritaires Clovis",
        NotificationManager.IMPORTANCE_HIGH
    ).apply {
        description = "Rappels importants (type alarme), affichage plein écran si autorisé."
    }

    gestionnaire.createNotificationChannel(canalStandard)
    gestionnaire.createNotificationChannel(canalUrgent)
}
