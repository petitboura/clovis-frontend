// Cree le 23/08/2026 (Lot 3, clovis-mobile), porte tel quel le 25/08/2026
// dans le plugin Capacitor (Lot 3B) -- meme mecanique, memes placeholders
// tant que Bourama n'a pas cree le projet Firebase (voir TODO ci-dessous,
// inchange par rapport a clovis-mobile).
package com.clovis.app.notifications

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

private const val FIREBASE_APPLICATION_ID = "A_REMPLACER_PAR_APPLICATION_ID_FIREBASE"
private const val FIREBASE_API_KEY = "A_REMPLACER_PAR_API_KEY_FIREBASE"
private const val FIREBASE_PROJECT_ID = "A_REMPLACER_PAR_PROJECT_ID_FIREBASE"
private const val FIREBASE_GCM_SENDER_ID = "A_REMPLACER_PAR_GCM_SENDER_ID_FIREBASE"

fun firebaseConfigureDisponible(): Boolean = !FIREBASE_APPLICATION_ID.startsWith("A_REMPLACER")

fun firebaseConfigure(context: Context) {
    if (!firebaseConfigureDisponible()) return
    if (FirebaseApp.getApps(context).isNotEmpty()) return

    val options = FirebaseOptions.Builder()
        .setApplicationId(FIREBASE_APPLICATION_ID)
        .setApiKey(FIREBASE_API_KEY)
        .setProjectId(FIREBASE_PROJECT_ID)
        .setGcmSenderId(FIREBASE_GCM_SENDER_ID)
        .build()
    FirebaseApp.initializeApp(context, options)
}
