// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor), iOS.
// Porte depuis clovis-mobile/ios-legacy-natif (Lot 5, ConnecteursScreen.swift) :
// meme mecanisme ASWebAuthenticationSession (callbackURLScheme="clovismobile"),
// qui n'a PAS besoin d'etre declare dans Info.plist (CFBundleURLTypes) :
// contrairement a l'equivalent Android (Custom Tabs + intent-filter dans
// AndroidManifest.xml), la session intercepte elle-meme sa propre navigation
// avant que l'OS n'essaie de la router.
//
// Cote JS (identique Android en surface, mais demarrerConnexionNotion() sur
// iOS est BLOQUANT : il gere lui-meme code+state en interne et resout
// directement le statut, pas besoin d'ecouter un evenement retourOAuth
// separe comme sur Android) :
//   const Connecteurs = registerPlugin<any>('Connecteurs');
//   await Connecteurs.statutNotion();
//   await Connecteurs.demarrerConnexionNotion();  // ouvre + attend + finalise, tout-en-un
//   await Connecteurs.rechercherNotion({ requete });
import Foundation
import Capacitor
import AuthenticationServices
import UIKit

@objc(ConnecteursPlugin)
public class ConnecteursPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "ConnecteursPlugin"
    public let jsName = "Connecteurs"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "statutNotion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "demarrerConnexionNotion", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "rechercherNotion", returnType: CAPPluginReturnPromise)
    ]

    // Garde une reference forte le temps de la session, sinon ARC la libere
    // avant la fin du flux (meme piege que SessionConnexionNotion legacy,
    // qui s'en sortait via @StateObject -- pas disponible ici).
    private var sessionEnCours: ASWebAuthenticationSession?

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        DispatchQueue.main.sync {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .first?.windows.first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }
    }

    @objc func statutNotion(_ call: CAPPluginCall) {
        Task {
            do {
                let statut = try await ClovisApiClient.statutNotion()
                call.resolve(["connecte": statut.connecte])
            } catch {
                call.reject("Echec de la lecture du statut Notion.", nil, error)
            }
        }
    }

    @objc func demarrerConnexionNotion(_ call: CAPPluginCall) {
        Task {
            do {
                let reponse = try await ClovisApiClient.demarrerConnexionNotion()
                guard let url = URL(string: reponse.url_autorisation) else {
                    call.reject("URL d'autorisation Notion invalide.")
                    return
                }
                let (code, state) = try await lancerSessionOAuth(url: url)
                let resultat = try await ClovisApiClient.finaliserConnexionNotion(code: code, state: state)
                call.resolve(["connecte": resultat.connecte, "espace": resultat.espace as Any])
            } catch {
                call.reject("Connexion Notion echouee.", nil, error)
            }
        }
    }

    @MainActor
    private func lancerSessionOAuth(url: URL) async throws -> (code: String, state: String) {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "clovismobile") { callbackURL, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard
                    let callbackURL,
                    let composants = URLComponents(url: callbackURL, resolvingAgainstBaseURL: false),
                    let code = composants.queryItems?.first(where: { $0.name == "code" })?.value,
                    let state = composants.queryItems?.first(where: { $0.name == "state" })?.value
                else {
                    continuation.resume(throwing: NSError(
                        domain: "ConnecteursPlugin", code: 1,
                        userInfo: [NSLocalizedDescriptionKey: "Reponse de connexion incomplete."]
                    ))
                    return
                }
                continuation.resume(returning: (code, state))
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            self.sessionEnCours = session
            session.start()
        }
    }

    @objc func rechercherNotion(_ call: CAPPluginCall) {
        guard let requete = call.getString("requete") else {
            call.reject("Parametre 'requete' manquant.")
            return
        }
        Task {
            do {
                let reponse = try await ClovisApiClient.rechercherNotion(requete)
                let resultats = reponse.resultats.map {
                    ["id": $0.id, "type": $0.type, "url": $0.url as Any] as [String: Any]
                }
                call.resolve(["resultats": resultats])
            } catch {
                call.reject("Echec de la recherche Notion.", nil, error)
            }
        }
    }
}
