// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor), iOS.
// Porte depuis clovis-mobile/ios-legacy-natif (Lot 4, ControleSessionScreen.swift).
//
// IMPORTANT, limites reelles deja verifiees et documentees dans le fichier
// legacy (voir 04-controles-session.md) : contrairement a Android
// (ControleSessionPlugin.kt, DND + volume reellement pilotables), Apple ne
// fournit AUCUNE API publique permettant a une app tierce de :
//  - basculer le Focus/Ne pas deranger systeme (seul contournement : un
//    Raccourci que l'etudiant configure lui-meme une fois, voir
//    ouvrirConfigurationRaccourci ci-dessous) ;
//  - regler le volume sonnerie/notifications systeme (uniquement le volume
//    media de l'app elle-meme, sans interet ici).
// Ce plugin ne PRETEND donc pas piloter quoi que ce soit : il expose
// seulement l'ouverture de l'app Raccourcis. Le minuteur de session
// lui-meme (aucune limite systeme) est une simple horloge : autant le
// garder cote JS/web plutot que d'ajouter un timer natif ici pour rien.
//
// Cote JS :
//   const ControleSession = registerPlugin<any>('ControleSession');
//   await ControleSession.disponible();               // { dndPilotable: false, volumePilotable: false }
//   await ControleSession.ouvrirConfigurationRaccourci();
import Foundation
import Capacitor
import UIKit

@objc(ControleSessionPlugin)
public class ControleSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ControleSessionPlugin"
    public let jsName = "ControleSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "disponible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ouvrirConfigurationRaccourci", returnType: CAPPluginReturnPromise)
    ]

    @objc func disponible(_ call: CAPPluginCall) {
        call.resolve(["dndPilotable": false, "volumePilotable": false])
    }

    @objc func ouvrirConfigurationRaccourci(_ call: CAPPluginCall) {
        guard let url = URL(string: "shortcuts://") else {
            call.reject("URL Raccourcis invalide.")
            return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url) { succes in
                if succes {
                    call.resolve()
                } else {
                    call.reject("Impossible d'ouvrir l'app Raccourcis.")
                }
            }
        }
    }
}
