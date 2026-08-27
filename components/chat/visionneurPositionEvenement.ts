// Séparé de VisionneurPositionGlobal.tsx à dessein (26/08) : ce fichier
// ne doit JAMAIS importer react-pdf/pdfjs-dist. VisionneurPositionGlobal
// est chargé via next/dynamic({ssr:false}) UNIQUEMENT dans ChatIA.tsx
// pour éviter que pdfjs-dist (qui touche des API navigateur dès son
// import) casse le rendu serveur -- si ce fichier-ci importait
// VisionneurPositionGlobal.tsx, tout endroit import ouvrirPosition
// (SourcesBulle.tsx, BulleMessage.tsx, tous deux rendus bien plus tôt
// dans l'arbre) réintroduirait le même risque via un import statique
// détourné. Donc : ce module ne contient QUE le type + le petit
// dispatcher d'évènement, rien d'autre.

export type DetailOuverturePosition = {
  url: string;
  titre: string;
  positionType?: "page" | "timestamp" | null;
  positionValeur?: number | null;
  // Ajouté 2026-08-27 (demande Bourama : "que tout reste en popup
  // interne, meme les sites") -- type MIME réel du fichier bibliothèque
  // (voir core/bibliotheque_rag.py:formater_source_bibliotheque), pour
  // que le visionneur choisisse le bon aperçu (image, Office, texte...)
  // sans deviner par extension d'URL. undefined/null pour une source
  // qui n'est PAS un fichier de bibliothèque (résultat de recherche web
  // par ex.) -- le visionneur retombe alors sur une carte d'aperçu de
  // site + bouton explicite pour sortir de l'app (voir LinkPreview.tsx,
  // même principe déjà en place pour les liens classiques du chat).
  typeMime?: string | null;
};

export const EVENEMENT_OUVRIR_POSITION = "clovis:ouvrir-position";

export function ouvrirPosition(detail: DetailOuverturePosition) {
  window.dispatchEvent(new CustomEvent<DetailOuverturePosition>(EVENEMENT_OUVRIR_POSITION, { detail }));
}
