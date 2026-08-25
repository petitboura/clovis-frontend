// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor), iOS.
// Porte depuis clovis-mobile/ios-legacy-natif (Lot 3, RappelsScreen.swift) :
// meme logique (NotificationsNatives, RappelsNatifs, copies telles quelles
// a cote de ce fichier), l'ecran SwiftUI est retire.
//
// Voir NotificationsNatives.swift pour la limite documentee : AUCUNE alerte
// plein ecran cote iOS (contrairement a Android, AlerteRappelActivity),
// uniquement des notifications standards (banner + son), meme en priorite
// time-sensitive.
//
// Cote JS :
//   const Notifications = registerPlugin<any>('Notifications');
//   await Notifications.demanderAutorisation();      // { accordee: bool }
//   await Notifications.autorisationAccordee();       // { accordee: bool }
//   await Notifications.afficherNotificationTest({ titre, corps, prioritaire });
//   await Notifications.programmerRappel({ titre, corps, dateEpochMs });
//   await Notifications.creerEvenementCalendrier({ titre, debutEpochMs, finEpochMs }); // { sauvegarde: bool }
//   await Notifications.ouvrirApp({ schema });
import Foundation
import Capacitor
import EventKitUI

@objc(NotificationsPlugin)
public class NotificationsPlugin: CAPPlugin, CAPBridgedPlugin, EKEventEditViewDelegate {
    public let identifier = "NotificationsPlugin"
    public let jsName = "Notifications"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "demanderAutorisation", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "autorisationAccordee", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "afficherNotificationTest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "programmerRappel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "creerEvenementCalendrier", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ouvrirApp", returnType: CAPPluginReturnPromise)
    ]

    // Appel JS en attente pendant que l'editeur d'evenement EventKit est
    // affiche (un seul a la fois, meme raison que DossiersPlugin).
    private var appelEvenementEnCours: CAPPluginCall?

    @objc func demanderAutorisation(_ call: CAPPluginCall) {
        Task {
            let accordee = await NotificationsNatives.demanderAutorisation()
            call.resolve(["accordee": accordee])
        }
    }

    @objc func autorisationAccordee(_ call: CAPPluginCall) {
        Task {
            let accordee = await NotificationsNatives.autorisationAccordee()
            call.resolve(["accordee": accordee])
        }
    }

    @objc func afficherNotificationTest(_ call: CAPPluginCall) {
        guard let titre = call.getString("titre"), let corps = call.getString("corps") else {
            call.reject("Parametres 'titre' et 'corps' requis.")
            return
        }
        let prioritaire = call.getBool("prioritaire") ?? false
        NotificationsNatives.afficherNotificationTest(titre: titre, corps: corps, prioritaire: prioritaire)
        call.resolve()
    }

    @objc func programmerRappel(_ call: CAPPluginCall) {
        guard let titre = call.getString("titre"), let corps = call.getString("corps"),
              let dateEpochMs = call.getDouble("dateEpochMs") else {
            call.reject("Parametres 'titre', 'corps' et 'dateEpochMs' requis.")
            return
        }
        let date = Date(timeIntervalSince1970: dateEpochMs / 1000)
        NotificationsNatives.programmerRappel(titre: titre, corps: corps, date: date)
        call.resolve()
    }

    @objc func creerEvenementCalendrier(_ call: CAPPluginCall) {
        guard let titre = call.getString("titre"),
              let debutEpochMs = call.getDouble("debutEpochMs"),
              let finEpochMs = call.getDouble("finEpochMs") else {
            call.reject("Parametres 'titre', 'debutEpochMs' et 'finEpochMs' requis.")
            return
        }
        DispatchQueue.main.async {
            guard let racine = self.bridge?.viewController else {
                call.reject("Impossible d'ouvrir l'editeur d'evenement (pas de fenetre active).")
                return
            }
            self.appelEvenementEnCours = call
            RappelsNatifs.presenterEditeurEvenement(
                titre: titre,
                debut: Date(timeIntervalSince1970: debutEpochMs / 1000),
                fin: Date(timeIntervalSince1970: finEpochMs / 1000),
                depuis: racine,
                delegue: self
            )
        }
    }

    public func eventEditViewController(
        _ controller: EKEventEditViewController,
        didCompleteWith action: EKEventEditViewAction
    ) {
        controller.dismiss(animated: true)
        appelEvenementEnCours?.resolve(["sauvegarde": action == .saved])
        appelEvenementEnCours = nil
    }

    @objc func ouvrirApp(_ call: CAPPluginCall) {
        guard let schema = call.getString("schema") else {
            call.reject("Parametre 'schema' manquant.")
            return
        }
        DispatchQueue.main.async {
            let ouverte = RappelsNatifs.ouvrirApp(schema: schema)
            if ouverte {
                call.resolve()
            } else {
                call.reject("App introuvable ou schema non declare dans LSApplicationQueriesSchemes.")
            }
        }
    }
}
