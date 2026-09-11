// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor).
//
// Choix d'architecture : contrairement au socle natif clovis-mobile (qui
// avait sa PROPRE auth Supabase native, voir SupabaseAuthClient.kt), ce
// plugin n'authentifie plus rien lui-meme ; l'utilisateur est deja
// connecte cote WEB (clovis-frontend, dans la WebView Capacitor, via le
// SDK Supabase JS existant). Dupliquer une deuxieme session native aurait
// recree exactement le probleme de compte separe deja rencontre
// (connexion native qui echouait independamment de la session web).
//
// Le pont recoit donc le token d'acces directement du JS (voir
// PontNatifPlugin.enregistrerToken, appele par clovis-frontend apres
// connexion/rafraichissement Supabase) et le garde en local chiffre,
// necessaire pour que le service FCM puisse appeler clovis-backend meme
// quand l'app est reveillee en tache de fond, WebView fermee.
package com.clovis.app.pont

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

private const val FICHIER_PREFS = "clovis_pont_securise"
private const val CLE_TOKEN = "supabase_access_token"
// Ajoute le 12/09/2026 : dernier token push FCM obtenu de Google, garde en
// local independamment du succes de son envoi au serveur. onNewToken
// (ClovisFirebaseMessagingService) peut se declencher avant que le JS ait
// eu le temps d'appeler enregistrerToken (session Supabase pas encore
// prete) -- sans ce stockage, ce premier envoi echouait silencieusement
// (401, jamais verifie) et n'etait jamais retente, car Firebase ne
// redonne generalement ce token qu'une seule fois par installation.
private const val CLE_TOKEN_PUSH = "dernier_token_push_fcm"

object StockageToken {

    private fun prefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        FICHIER_PREFS,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun enregistrer(context: Context, token: String) {
        prefs(context).edit().putString(CLE_TOKEN, token).apply()
    }

    fun lire(context: Context): String? = prefs(context).getString(CLE_TOKEN, null)

    fun effacer(context: Context) {
        prefs(context).edit().remove(CLE_TOKEN).apply()
    }

    fun enregistrerTokenPush(context: Context, tokenPush: String) {
        prefs(context).edit().putString(CLE_TOKEN_PUSH, tokenPush).apply()
    }

    fun lireTokenPush(context: Context): String? = prefs(context).getString(CLE_TOKEN_PUSH, null)
}
