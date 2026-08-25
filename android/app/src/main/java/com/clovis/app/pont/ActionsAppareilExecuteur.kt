// Cree le 24/08/2026 (Lot 1B, clovis-mobile), porte tel quel le 25/08/2026
// dans le plugin Capacitor (Lot 3B). Voir clovis-backend/core/actions_appareil_mobile.py
// pour ce qui n'est PAS encore branche (aucun type_action reel emis par
// l'agent -- ce fichier reste le point d'extension unique, inchange).
package com.clovis.app.pont

import android.content.Context
import android.util.Log

object ActionsAppareilExecuteur {

    private const val TAG = "ActionsAppareil"

    suspend fun executerAction(context: Context, actionId: String) {
        val client = ClovisApiClient(context)
        val action = try {
            client.obtenirAction(actionId)
        } catch (e: Exception) {
            Log.w(TAG, "Echec recuperation action $actionId, abandon (pas de retry ici).", e)
            return
        }

        val resultat = when (action.type_action) {
            else -> ResultatAction(
                succes = false,
                resultat = "type_action \"${action.type_action}\" non reconnu par l'app."
            )
        }

        try {
            client.rapporterResultatAction(actionId, resultat)
        } catch (e: Exception) {
            Log.w(TAG, "Echec rapport resultat pour action $actionId (pas de retry ici).", e)
        }
    }
}
