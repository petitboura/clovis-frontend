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
        // Ajoute le 12/09/2026 : si iOS avait deja donne un token push a
        // l'app avant cette connexion (ou avant que cette session ne soit
        // transmise), le tout premier envoi a pu echouer faute de session
        // valide a ce moment-la (voir AppDelegate.swift). On le retente ici,
        // a chaque connexion/rafraichissement, avec la session recue.
        guard let tokenPush = StockageToken.lireTokenPush() else { return }
        Task {
            do {
                try await ClovisApiClient.enregistrerPushToken(
                    TokenPush(plateforme: "ios", token: tokenPush, appareil_id: IdentifiantAppareil.obtenirId())
                )
            } catch {
                print("PontNatif: echec renvoi du token push a la connexion. \(error)")
            }
        }
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
