// Cree le 23/08/2026, Bourama : Lot 7 (actions pilotees), flavor externe uniquement.
//
// Journal distinct de JournalAccessibilite.kt (Lot 6, lecture passive) :
// ici on trace des tentatives d'ACTION avec leur resultat (succes/echec) --
// necessaire pour le critere de fin du lot ("comportement de repli verifie
// en cassant volontairement le scenario").
package com.clovis.app.accessibilite

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class EntreeAction(
    val nomPaquet: String,
    val cible: String,
    val succes: Boolean,
    val message: String,
    val horodatage: Long
)

object JournalActions {
    private const val TAILLE_MAX = 100

    private val _entrees = MutableStateFlow<List<EntreeAction>>(emptyList())
    val entrees: StateFlow<List<EntreeAction>> = _entrees

    fun ajouter(entree: EntreeAction) {
        _entrees.value = (listOf(entree) + _entrees.value).take(TAILLE_MAX)
    }
}
