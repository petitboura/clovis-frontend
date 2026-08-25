// Cree le 23/08/2026, Bourama : Lot 6 (service d'accessibilite, flavor externe uniquement).
//
// Journalisation/tracabilite de ce que le service observe (portee du Lot 6,
// voir 06-service-accessibilite.md). Pour l'instant : en memoire seulement,
// affiche dans l'onglet Accessibilite pour audit/debug. Pas encore envoye au
// backend -- rien dans le Lot 6 ne le demande, a voir si un lot ulterieur en
// a besoin.
package com.clovis.app.accessibilite

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class EntreeJournal(
    val nomPaquet: String,
    val typeEvenement: String,
    val nombreNoeudsLus: Int,
    val horodatage: Long
)

object JournalAccessibilite {
    private const val TAILLE_MAX = 200

    private val _entrees = MutableStateFlow<List<EntreeJournal>>(emptyList())
    val entrees: StateFlow<List<EntreeJournal>> = _entrees

    fun ajouter(entree: EntreeJournal) {
        _entrees.value = (listOf(entree) + _entrees.value).take(TAILLE_MAX)
    }
}
