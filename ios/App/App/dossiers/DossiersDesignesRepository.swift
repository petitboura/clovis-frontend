// Cree le 23/08/2026, Bourama : Lot 2 Partie 3 (app mobile), fichiers/dossiers designes, iOS.
//
// UIDocumentPickerViewController (mode dossier) + security-scoped bookmarks
// pour la persistance (voir 02-fichiers-dossiers.md). Contrairement a
// Android (une permission URI persistante suffit), iOS exige de
// "start/stopAccessingSecurityScopedResource()" a CHAQUE usage -- ce n'est
// pas une permission qu'on prend une fois pour toutes cote systeme, c'est
// une session d'acces a ouvrir/fermer a chaque operation. D'ou le wrapper
// `avecAcces(...)` ci-dessous, utilise par toutes les operations.
//
// Bookmarks stockes dans UserDefaults (Data en base64 implicite via
// UserDefaults). Pas besoin d'entitlement special pour ceci -- contrairement
// a Screen Time (voir README.md), UIDocumentPickerViewController fonctionne
// sur un compte Apple Developer standard.
import Foundation

private let CLE_BOOKMARKS = "dossiers_designes_bookmarks"

struct DossierDesigne: Identifiable {
    let id: String // bookmark encode en base64, sert aussi de cle de retrait
    let url: URL
}

struct ElementDossier: Identifiable {
    let id: String
    let url: URL
    let nom: String
    let estDossier: Bool
    let tailleOctets: Int64
}

enum DossiersDesignesRepository {

    // MARK: - Liste des dossiers designes

    static func listerDossiersDesignes() -> [DossierDesigne] {
        let bookmarks = UserDefaults.standard.array(forKey: CLE_BOOKMARKS) as? [Data] ?? []
        return bookmarks.compactMap { bookmark in
            var estPerime = false
            guard let url = try? URL(
                resolvingBookmarkData: bookmark,
                options: [],
                relativeTo: nil,
                bookmarkDataIsStale: &estPerime
            ) else { return nil }
            // Un bookmark perime (dossier deplace/renomme cote systeme) est quand
            // meme retourne ici -- il sera simplement retire au prochain retrait
            // manuel si l'acces echoue reellement. Ne pas le faire disparaitre
            // silencieusement de la liste, l'etudiant doit pouvoir le voir et le retirer.
            return DossierDesigne(id: bookmark.base64EncodedString(), url: url)
        }
    }

    static func ajouterDossierDesigne(url: URL) {
        guard url.startAccessingSecurityScopedResource() else { return }
        defer { url.stopAccessingSecurityScopedResource() }
        guard let bookmark = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) else { return }
        var bookmarks = UserDefaults.standard.array(forKey: CLE_BOOKMARKS) as? [Data] ?? []
        bookmarks.append(bookmark)
        UserDefaults.standard.set(bookmarks, forKey: CLE_BOOKMARKS)
    }

    static func retirerDossierDesigne(id: String) {
        var bookmarks = UserDefaults.standard.array(forKey: CLE_BOOKMARKS) as? [Data] ?? []
        bookmarks.removeAll { $0.base64EncodedString() == id }
        UserDefaults.standard.set(bookmarks, forKey: CLE_BOOKMARKS)
    }

    // MARK: - Acces securise (a ouvrir/fermer a chaque operation, voir en-tete)

    private static func avecAcces<T>(_ url: URL, _ operation: () throws -> T) -> T? {
        guard url.startAccessingSecurityScopedResource() else { return nil }
        defer { url.stopAccessingSecurityScopedResource() }
        return try? operation()
    }

    // MARK: - CRUD

    static func listerContenu(_ dossier: URL) -> [ElementDossier] {
        avecAcces(dossier) {
            let fm = FileManager.default
            let enfants = try fm.contentsOfDirectory(
                at: dossier,
                includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey],
                options: [.skipsHiddenFiles]
            )
            return enfants.map { url in
                let valeurs = try? url.resourceValues(forKeys: [.isDirectoryKey, .fileSizeKey])
                let estDossier = valeurs?.isDirectory ?? false
                let taille = Int64(valeurs?.fileSize ?? 0)
                return ElementDossier(id: url.path, url: url, nom: url.lastPathComponent, estDossier: estDossier, tailleOctets: taille)
            }.sorted {
                if $0.estDossier != $1.estDossier { return $0.estDossier && !$1.estDossier }
                return $0.nom.localizedCaseInsensitiveCompare($1.nom) == .orderedAscending
            }
        } ?? []
    }

    static func creerSousDossier(dansParent parent: URL, nom: String) -> Bool {
        avecAcces(parent) {
            let destination = parent.appendingPathComponent(nom, isDirectory: true)
            try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: false)
        } != nil
    }

    static func creerFichier(dansParent parent: URL, nom: String) -> Bool {
        avecAcces(parent) {
            let destination = parent.appendingPathComponent(nom, isDirectory: false)
            guard FileManager.default.createFile(atPath: destination.path, contents: Data()) else {
                throw NSError(domain: "DossiersDesignesRepository", code: 1)
            }
        } != nil
    }

    static func renommer(_ element: URL, nouveauNom: String) -> Bool {
        avecAcces(element.deletingLastPathComponent()) {
            let destination = element.deletingLastPathComponent().appendingPathComponent(nouveauNom)
            try FileManager.default.moveItem(at: element, to: destination)
        } != nil
    }

    static func supprimer(_ element: URL) -> Bool {
        avecAcces(element.deletingLastPathComponent()) {
            try FileManager.default.removeItem(at: element)
        } != nil
    }

    static func deplacer(_ element: URL, versParent nouveauParent: URL) -> Bool {
        avecAcces(nouveauParent) {
            let destination = nouveauParent.appendingPathComponent(element.lastPathComponent)
            try FileManager.default.moveItem(at: element, to: destination)
        } != nil
    }
}
