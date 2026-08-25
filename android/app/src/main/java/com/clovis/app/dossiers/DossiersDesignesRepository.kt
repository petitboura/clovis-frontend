// Porte depuis clovis-mobile/android-legacy-natif (Lot 2 Partie 3, 23/08/2026)
// dans le plugin Capacitor (Lot 3B, 25/08/2026). Logique inchangee, seul le
// package a change (com.clovis.app.data -> com.clovis.app.dossiers).
//
// Storage Access Framework (SAF). L'etudiant designe un dossier une seule
// fois via le selecteur systeme (ACTION_OPEN_DOCUMENT_TREE) ; on prend une
// permission URI PERSISTANTE (takePersistableUriPermission) pour ne plus
// jamais avoir a la redemander -- voir 02-fichiers-dossiers.md, "Objectif".
//
// Liste des dossiers designes stockee en local (SharedPreferences, Set<String>
// d'URI serialisees) : pas besoin de synchro serveur pour ca, c'est propre a
// cet appareil (l'acces SAF lui-meme est lie a l'appareil, pas au compte).
//
// Operations CRUD via DocumentFile (creer/lire/modifier) + DocumentsContract
// pour deplacer un document a l'interieur d'un meme arbre (moveDocument,
// dispo depuis l'API 24, minSdk du projet = 26).
package com.clovis.app.dossiers

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile

private const val PREFS_NOM = "dossiers_designes"
private const val CLE_URIS = "uris"

data class DossierDesigne(val uri: Uri, val nom: String)

data class ElementDossier(
    val uri: Uri,
    val nom: String,
    val estDossier: Boolean,
    val tailleOctets: Long
)

class DossiersDesignesRepository(private val context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NOM, Context.MODE_PRIVATE)

    /** Dossiers designes actuellement, avec leur nom lisible. */
    fun listerDossiersDesignes(): List<DossierDesigne> {
        val uris = prefs.getStringSet(CLE_URIS, emptySet()) ?: emptySet()
        return uris.mapNotNull { brut ->
            val uri = Uri.parse(brut)
            val doc = DocumentFile.fromTreeUri(context, uri)
            if (doc != null && doc.exists()) {
                DossierDesigne(uri, doc.name ?: uri.lastPathSegment ?: "Dossier")
            } else {
                null // dossier devenu inaccessible (supprime/deplace hors de l'app) -- ignore silencieusement ici, nettoye au prochain ajout/retrait
            }
        }
    }

    /**
     * A appeler avec l'Uri renvoyee par le selecteur systeme
     * (ActivityResultContracts.OpenDocumentTree), apres que l'utilisateur a
     * choisi un dossier. Prend la permission persistante et l'ajoute a la liste.
     */
    fun ajouterDossierDesigne(uri: Uri) {
        context.contentResolver.takePersistableUriPermission(
            uri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
        )
        val actuels = (prefs.getStringSet(CLE_URIS, emptySet()) ?: emptySet()).toMutableSet()
        actuels.add(uri.toString())
        prefs.edit().putStringSet(CLE_URIS, actuels).apply()
    }

    /** Retire un dossier de la liste designee et libere la permission persistante. */
    fun retirerDossierDesigne(uri: Uri) {
        try {
            context.contentResolver.releasePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
        } catch (e: SecurityException) {
            // Permission deja perdue (dossier supprime cote systeme) -- rien a liberer.
        }
        val actuels = (prefs.getStringSet(CLE_URIS, emptySet()) ?: emptySet()).toMutableSet()
        actuels.remove(uri.toString())
        prefs.edit().putStringSet(CLE_URIS, actuels).apply()
    }

    /** Contenu direct d'un dossier (designe ou sous-dossier), trie dossiers puis fichiers, alphabetique. */
    fun listerContenu(dossierUri: Uri): List<ElementDossier> {
        val doc = DocumentFile.fromTreeUri(context, dossierUri) ?: DocumentFile.fromSingleUri(context, dossierUri)
        val enfants = doc?.listFiles() ?: emptyArray()
        return enfants
            .filter { it.name != null }
            .map { ElementDossier(it.uri, it.name!!, it.isDirectory, if (it.isDirectory) 0L else it.length()) }
            .sortedWith(compareBy({ !it.estDossier }, { it.nom.lowercase() }))
    }

    fun creerSousDossier(parentUri: Uri, nom: String): Boolean {
        val parent = DocumentFile.fromTreeUri(context, parentUri) ?: return false
        return parent.createDirectory(nom) != null
    }

    fun creerFichier(parentUri: Uri, nom: String, typeMime: String = "text/plain"): Boolean {
        val parent = DocumentFile.fromTreeUri(context, parentUri) ?: return false
        return parent.createFile(typeMime, nom) != null
    }

    fun renommer(elementUri: Uri, nouveauNom: String): Boolean {
        val doc = DocumentFile.fromSingleUri(context, elementUri) ?: return false
        return doc.renameTo(nouveauNom)
    }

    fun supprimer(elementUri: Uri): Boolean {
        val doc = DocumentFile.fromSingleUri(context, elementUri) ?: return false
        return doc.delete()
    }

    /**
     * Deplace un document vers un autre dossier PARENT, a l'interieur du meme
     * arbre designe (DocumentsContract.moveDocument ne fonctionne qu'au sein
     * d'un meme fournisseur de documents). anciensParentUri et nouveauParentUri
     * sont les Uri des dossiers source/destination (pas du document lui-meme).
     */
    fun deplacer(elementUri: Uri, ancienParentUri: Uri, nouveauParentUri: Uri): Boolean {
        return try {
            val resolver: ContentResolver = context.contentResolver
            val ancienParentDocId = DocumentsContract.getTreeDocumentId(ancienParentUri)
                .let { DocumentsContract.buildDocumentUriUsingTree(ancienParentUri, it) }
            val nouveauParentDocId = DocumentsContract.getTreeDocumentId(nouveauParentUri)
                .let { DocumentsContract.buildDocumentUriUsingTree(nouveauParentUri, it) }
            DocumentsContract.moveDocument(resolver, elementUri, ancienParentDocId, nouveauParentDocId) != null
        } catch (e: Exception) {
            false
        }
    }
}
