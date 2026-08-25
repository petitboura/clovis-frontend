// Cree le 23/08/2026, Bourama : Lot 3 Partie 3 (app mobile), notifications & rappels.
package com.clovis.app.notifications

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import kotlin.random.Random

object NotificationsNatives {

    /** true si Clovis a le droit d'envoyer une notification du tout (Android 13+). */
    fun permissionNotificationsAccordee(context: Context): Boolean =
        NotificationManagerCompat.from(context).areNotificationsEnabled()

    /**
     * true si Android autorise reellement l'alerte plein ecran pour Clovis
     * (API 34+ seulement -- avant cette API, la permission etait accordee
     * d'office a l'installation, pas de verification possible autrement
     * qu'en essayant). Voir CanalNotifications.kt pour le contexte complet.
     */
    fun pleinEcranAutorise(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 34) return true
        return NotificationManagerCompat.from(context).canUseFullScreenIntent()
    }

    /** Ouvre l'ecran systeme ou l'etudiant peut activer lui-meme l'alerte plein ecran (API 34+). */
    fun ouvrirReglagesPleinEcran(context: Context) {
        if (Build.VERSION.SDK_INT < 34) return
        val intent = Intent(android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
            .setData(android.net.Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    /**
     * `prioritaire` correspond a l'alerte plein ecran demandee par
     * 03-notifications-rappels.md. Si Android ne l'autorise pas
     * effectivement (voir pleinEcranAutorise), repli automatique sur une
     * notification heads-up classique -- jamais d'echec silencieux total.
     */
    fun afficherRappel(context: Context, titre: String, corps: String, prioritaire: Boolean = false) {
        if (!permissionNotificationsAccordee(context)) return

        val demanderPleinEcran = prioritaire && pleinEcranAutorise(context)
        val canal = if (prioritaire) CANAL_RAPPELS_URGENTS else CANAL_RAPPELS

        val builder = NotificationCompat.Builder(context, canal)
            .setContentTitle(titre)
            .setContentText(corps)
            .setSmallIcon(com.clovis.app.R.drawable.ic_clovis_notification)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        if (demanderPleinEcran) {
            val intentAlerte = Intent(context, AlerteRappelActivity::class.java).apply {
                putExtra(EXTRA_TITRE_ALERTE, titre)
                putExtra(EXTRA_CORPS_ALERTE, corps)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val pending = PendingIntent.getActivity(
                context, Random.nextInt(), intentAlerte,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.setFullScreenIntent(pending, true)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
        }

        NotificationManagerCompat.from(context).notify(Random.nextInt(), builder.build())
    }
}
