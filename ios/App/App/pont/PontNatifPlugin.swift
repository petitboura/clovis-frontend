// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor), iOS.
// Equivalent exact de PontNatifPlugin.kt (Android, meme lot). Enregistrement
// automatique via CAPBridgedPlugin, pas besoin de fichier .m ni de
// declaration manuelle ailleurs.
//
// Cote JS (identique Android) :
//   const PontNatif = registerPlugin<any>('PontNatif');
//   await PontNatif.enregistrerToken({ token: session.access_token });
import Foundation
import Capacitor

@objc(PontNatifPlugin)
public class PontNatifPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PontNatifPlugin"
    public let jsName = "PontNatif"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "enregistrerToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deconnexion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "rattraperActionsEnAttente", returnType: CAPPluginReturnPromise)
    ]

    @objc func enregistrerToken(_ call: CAPPluginCall) {
        guard let token = call.getString("token") else {
            call.reject("Parametre 'token' manquant.")
            return
        }
        StockageToken.enregistrer(token)
        call.resolve()
    }

    @objc func deconnexion(_ call: CAPPluginCall) {
        StockageToken.effacer()
        call.resolve()
    }

    /// Filet de secours, a appeler depuis le JS a chaque ouverture/reprise
    /// de l'app (meme role que rattraperActionsEnAttente cote Android).
    @objc func rattraperActionsEnAttente(_ call: CAPPluginCall) {
        Task {
            do {
                let reponse = try await ClovisApiClient.obtenirActionsEnAttente(appareilId: IdentifiantAppareil.obtenirId())
                for action in reponse.actions {
                    await ActionsAppareilExecuteur.executerAction(actionId: action.id)
                }
                call.resolve(["traitees": reponse.actions.count])
            } catch {
                call.reject("Echec rattrapage actions en attente.", nil, error)
            }
        }
    }
}
