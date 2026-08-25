// Porte depuis clovis-mobile/ios-legacy-natif (Lot 3, 23/08/2026) dans le
// plugin Capacitor (Lot 3B, 25/08/2026). Logique inchangee, sauf
// creerControleurEvenement (qui retournait un EKEventEditViewController pour
// un wrapper SwiftUI, retire) : remplace par presenterEditeurEvenement, qui
// presente directement le controleur EventKit en UIKit depuis
// NotificationsPlugin.swift (pas d'ecran SwiftUI dedie desormais).
import EventKit
import EventKitUI
import UIKit

enum RappelsNatifs {

    /// Presente l'UI native EventKit de creation d'evenement (l'etudiant
    /// confirme avant tout ajout reel), depuis le view controller donne.
    /// `surDelegue` recoit le resultat (annule ou sauvegarde) -- a fournir
    /// par l'appelant (NotificationsPlugin), qui gere la fermeture du
    /// controleur et resout l'appel JS en attente.
    @MainActor
    static func presenterEditeurEvenement(
        titre: String,
        debut: Date,
        fin: Date,
        depuis racine: UIViewController,
        delegue: EKEventEditViewDelegate
    ) {
        let store = EKEventStore()
        let evenement = EKEvent(eventStore: store)
        evenement.title = titre
        evenement.startDate = debut
        evenement.endDate = fin

        let controleur = EKEventEditViewController()
        controleur.eventStore = store
        controleur.event = evenement
        controleur.editViewDelegate = delegue
        racine.present(controleur, animated: true)
    }

    /// `schema` ex: "whatsapp://" -- doit etre declare dans
    /// LSApplicationQueriesSchemes (Info.plist) pour que canOpenURL()
    /// fonctionne.
    @MainActor
    static func ouvrirApp(schema: String) -> Bool {
        guard let url = URL(string: schema), UIApplication.shared.canOpenURL(url) else {
            return false
        }
        UIApplication.shared.open(url)
        return true
    }
}
