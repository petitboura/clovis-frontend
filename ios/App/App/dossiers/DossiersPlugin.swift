// Cree le 25/08/2026, Bourama : Lot 3B Partie 3 mobile (fusion Capacitor), iOS.
// Porte depuis clovis-mobile/ios-legacy-natif (Lot 2, DossiersScreen.swift
// + DossiersDesignesRepository.swift, copie telle quelle a cote de ce
// fichier) : meme logique (security-scoped bookmarks), l'ecran SwiftUI est
// retire, le UIDocumentPickerViewController est presente directement en
// UIKit depuis ce plugin (pas d'equivalent SwiftUI natif, meme raison
// documentee dans le fichier legacy).
//
// Cote JS (identique Android, mais uri devient un id de bookmark base64,
// PAS un chemin de fichier reel -- ne jamais l'afficher/interpreter cote
// web, le passer tel quel aux autres methodes de ce plugin) :
//   const Dossiers = registerPlugin<any>('Dossiers');
//   await Dossiers.choisirDossier();
//   await Dossiers.listerDossiersDesignes();
//   await Dossiers.listerContenu({ uri });
//   await Dossiers.creerSousDossier({ parentUri, nom });
//   await Dossiers.creerFichier({ parentUri, nom });
//   await Dossiers.renommer({ elementUri, nouveauNom });
//   await Dossiers.supprimer({ elementUri });
//   await Dossiers.deplacer({ elementUri, nouveauParentUri });
//   await Dossiers.retirerDossierDesigne({ uri });
import Foundation
import Capacitor
import UIKit
import UniformTypeIdentifiers

@objc(DossiersPlugin)
public class DossiersPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "DossiersPlugin"
    public let jsName = "Dossiers"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "choisirDossier", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listerDossiersDesignes", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "retirerDossierDesigne", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listerContenu", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "creerSousDossier", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "creerFichier", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "renommer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "supprimer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deplacer", returnType: CAPPluginReturnPromise)
    ]

    // Ajoute le 26/08/2026 : miroir cote backend (voir
    // clovis-backend/core/dossiers_designes_mobile.py), meme role que cote
    // Android -- appele a l'ouverture de l'app (load()) et apres CHAQUE
    // changement, jamais bloquant (echec silencieux, log seulement).
    public override func load() {
        super.load()
        synchroniserAvecBackend()
    }

    private func synchroniserAvecBackend() {
        let noms = DossiersDesignesRepository.listerDossiersDesignes().map { $0.url.lastPathComponent }
        Task {
            try? await ClovisApiClient.synchroniserDossiers(noms)
        }
    }

    // Appel JS en attente pendant que le picker systeme est affiche (un seul
    // a la fois, coherent avec le fait que choisirDossier() bloque le JS
    // jusqu'a resolution de toute facon).
    private var appelChoixEnCours: CAPPluginCall?

    // Retrouve un dossier designe/element par son id (bookmark base64) parmi
    // les dossiers deja enregistres -- ne fonctionne QUE pour les dossiers
    // eux-memes (racine designee), pas pour un sous-element (voir
    // resoudreUrlElement pour le cas general, base sur le chemin).
    private func dossierDesigne(id: String) -> DossierDesigne? {
        DossiersDesignesRepository.listerDossiersDesignes().first { $0.id == id }
    }

    private func elementJson(_ e: ElementDossier) -> JSObject {
        JSObject([
            "uri": e.url.path,
            "nom": e.nom,
            "estDossier": e.estDossier,
            "tailleOctets": e.tailleOctets
        ])
    }

    @objc func choisirDossier(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let racine = self.bridge?.viewController else {
                call.reject("Impossible d'ouvrir le selecteur (pas de fenetre active).")
                return
            }
            self.appelChoixEnCours = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
            picker.delegate = self
            racine.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = appelChoixEnCours, let url = urls.first else {
            appelChoixEnCours?.reject("Aucun dossier choisi.")
            appelChoixEnCours = nil
            return
        }
        DossiersDesignesRepository.ajouterDossierDesigne(url: url)
        if let dossier = DossiersDesignesRepository.listerDossiersDesignes().first(where: { $0.url == url }) {
            synchroniserAvecBackend()
            call.resolve(["uri": dossier.id, "nom": dossier.url.lastPathComponent])
        } else {
            call.reject("Dossier ajoute mais introuvable juste apres (cas inattendu).")
        }
        appelChoixEnCours = nil
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        appelChoixEnCours?.reject("Selection annulee.")
        appelChoixEnCours = nil
    }

    @objc func listerDossiersDesignes(_ call: CAPPluginCall) {
        let tableau = DossiersDesignesRepository.listerDossiersDesignes().map {
            ["uri": $0.id, "nom": $0.url.lastPathComponent] as [String: Any]
        }
        call.resolve(["dossiers": tableau])
    }

    @objc func retirerDossierDesigne(_ call: CAPPluginCall) {
        guard let uri = call.getString("uri") else {
            call.reject("Parametre 'uri' manquant.")
            return
        }
        DossiersDesignesRepository.retirerDossierDesigne(id: uri)
        synchroniserAvecBackend()
        call.resolve()
    }

    // 'uri' est soit un id de bookmark (dossier designe = racine), soit un
    // chemin de fichier reel deja resolu (sous-element, renvoye par
    // listerContenu ci-dessous) -- on tente les deux dans cet ordre.
    private func resoudreUrl(_ uri: String) -> URL? {
        if let dossier = dossierDesigne(id: uri) { return dossier.url }
        return URL(fileURLWithPath: uri)
    }

    @objc func listerContenu(_ call: CAPPluginCall) {
        guard let uri = call.getString("uri"), let url = resoudreUrl(uri) else {
            call.reject("Parametre 'uri' manquant ou invalide.")
            return
        }
        let elements = DossiersDesignesRepository.listerContenu(url).map { elementJson($0) }
        call.resolve(["elements": elements])
    }

    @objc func creerSousDossier(_ call: CAPPluginCall) {
        guard let parentUri = call.getString("parentUri"), let nom = call.getString("nom"),
              let parent = resoudreUrl(parentUri) else {
            call.reject("Parametres 'parentUri' et 'nom' requis.")
            return
        }
        if DossiersDesignesRepository.creerSousDossier(dansParent: parent, nom: nom) {
            call.resolve()
        } else {
            call.reject("Echec de la creation du sous-dossier.")
        }
    }

    @objc func creerFichier(_ call: CAPPluginCall) {
        guard let parentUri = call.getString("parentUri"), let nom = call.getString("nom"),
              let parent = resoudreUrl(parentUri) else {
            call.reject("Parametres 'parentUri' et 'nom' requis.")
            return
        }
        if DossiersDesignesRepository.creerFichier(dansParent: parent, nom: nom) {
            call.resolve()
        } else {
            call.reject("Echec de la creation du fichier.")
        }
    }

    @objc func renommer(_ call: CAPPluginCall) {
        guard let elementUri = call.getString("elementUri"), let nouveauNom = call.getString("nouveauNom"),
              let element = resoudreUrl(elementUri) else {
            call.reject("Parametres 'elementUri' et 'nouveauNom' requis.")
            return
        }
        if DossiersDesignesRepository.renommer(element, nouveauNom: nouveauNom) {
            call.resolve()
        } else {
            call.reject("Echec du renommage.")
        }
    }

    @objc func supprimer(_ call: CAPPluginCall) {
        guard let elementUri = call.getString("elementUri"), let element = resoudreUrl(elementUri) else {
            call.reject("Parametre 'elementUri' manquant.")
            return
        }
        if DossiersDesignesRepository.supprimer(element) {
            call.resolve()
        } else {
            call.reject("Echec de la suppression.")
        }
    }

    @objc func deplacer(_ call: CAPPluginCall) {
        guard let elementUri = call.getString("elementUri"), let nouveauParentUri = call.getString("nouveauParentUri"),
              let element = resoudreUrl(elementUri), let nouveauParent = resoudreUrl(nouveauParentUri) else {
            call.reject("Parametres 'elementUri' et 'nouveauParentUri' requis.")
            return
        }
        if DossiersDesignesRepository.deplacer(element, versParent: nouveauParent) {
            call.resolve()
        } else {
            call.reject("Echec du deplacement.")
        }
    }
}
