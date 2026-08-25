// Cree le 24/08/2026 (Lot 1B, clovis-mobile), porte le 25/08/2026 dans le
// plugin Capacitor (Lot 3B), iOS. Equivalent exact d'ActionsAppareilExecuteur.kt
// (Android, meme lot) : point d'extension unique, aucun type_action reel
// emis par l'agent pour l'instant, voir
// clovis-backend/core/actions_appareil_mobile.py.
import Foundation
import os.log

enum ActionsAppareilExecuteur {

    private static let log = OSLog(subsystem: "ai.clovis.pont", category: "ActionsAppareil")

    static func executerAction(actionId: String) async {
        let action: ActionAppareil
        do {
            action = try await ClovisApiClient.obtenirAction(actionId)
        } catch {
            os_log("Echec recuperation action %{public}@, abandon (pas de retry ici).", log: log, type: .default, actionId)
            return
        }

        let resultat: ResultatAction
        switch action.type_action {
        default:
            resultat = ResultatAction(
                succes: false,
                resultat: "type_action \"\(action.type_action)\" non reconnu par l'app."
            )
        }

        do {
            try await ClovisApiClient.rapporterResultatAction(actionId, resultat: resultat)
        } catch {
            os_log("Echec rapport resultat pour action %{public}@ (pas de retry ici).", log: log, type: .default, actionId)
        }
    }
}
