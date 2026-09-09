// Cree le 23/08/2026 (Lot 3, clovis-mobile), porte tel quel le 25/08/2026
// dans le plugin Capacitor (Lot 3B). Valeurs reelles renseignees le
// 09/09/2026 (Bourama a cree le projet Firebase clovis-fd17d) -- voir
// android/app/google-services.json, meme projet, source de verite pour
// ces 4 valeurs si elles doivent etre regenerees un jour.
package com.clovis.app.notifications

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions

private const val FIREBASE_APPLICATION_ID = "1:950974138724:android:392e52557b67382dcbd271"
private const val FIREBASE_API_KEY = "AIzaSyBpry-myl5cMZKVid0MWiCcL35Tu5pgffQ"
private const val FIREBASE_PROJECT_ID = "clovis-fd17d"
private const val FIREBASE_GCM_SENDER_ID = "950974138724"

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
