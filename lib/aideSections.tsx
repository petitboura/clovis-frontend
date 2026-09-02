import Link from "next/link";

// Créé le 01/09/2026, correctif (Bourama : "les descriptions de section,
// c'est pas la norme mobile, trouve où ça doit aller").
//
// Norme trouvée (Android Developers / Material Design, guide "Settings") :
// pas de paragraphe permanent sous un titre d'écran -- si une explication
// plus longue est nécessaire, elle va sur un second écran, accessible
// depuis un point d'entrée dédié. Motif exact retenu (eBay/Balsamiq,
// "infotip") : petit bouton "i" à côté du titre, qui ouvre une bulle
// courte avec un lien "En savoir plus" vers ce second écran.
//
// Ce fichier est la SOURCE UNIQUE des textes : la bulle (texteCourt) et
// la page Aide et support (texteComplet) lisent le même id ici, pour ne
// jamais avoir deux versions du même texte qui divergent avec le temps.
// EspaceParametres.tsx lit ce registre pour construire la liste des
// rubriques de "Aide et support", et pour savoir sur quelle rubrique
// scroller/ouvrir quand on y arrive via ?aide=<id> (lien "En savoir plus"
// depuis une bulle).
//
// texteCourt/texteComplet en React.ReactNode, pas juste string (passage
// en .tsx le 02/09/2026, suite audit Bourama sur les 6 écrans oubliés du
// premier passage) : la rubrique "bibliotheque-publique" porte un rappel
// légal avec liens cliquables (CGU, politique de copyright) qui doit
// suivre le texte tel quel, pas être réduit à du texte brut.
export type RubriqueAide = {
  id: string;
  titre: string;
  texteCourt: React.ReactNode;
  texteComplet: React.ReactNode;
};

export const RUBRIQUES_AIDE: RubriqueAide[] = [
  {
    id: "accessibilite",
    titre: "Accessibilité",
    texteCourt: "Autorise Clovis à lire et agir dans les apps que tu choisis, une par une.",
    texteComplet:
      "Autorise Clovis à lire et agir dans les apps que tu choisis, une par une. Le service d'accessibilité de Clovis doit être activé dans les réglages système du téléphone pour que ça fonctionne. Tu contrôles précisément quelles apps sont autorisées, et un journal garde la trace de ce que Clovis y a lu ou fait.",
  },
  {
    id: "controle-session",
    titre: "Contrôle de session",
    texteCourt: "Coupe les sonneries et notifications, et active Ne pas déranger le temps de ta session.",
    texteComplet:
      "Coupe les sonneries et notifications, et active Ne pas déranger le temps de ta session de travail. L'activation se fait dans les réglages système (Accessibilité), en dehors de l'app.",
  },
  {
    id: "diffuser",
    titre: "Diffuser",
    texteCourt: "Ajouté à la bibliothèque de chacun de ceux qui ont entré ce code, privé à ce lien.",
    texteComplet:
      "Diffuser ajoute le contenu choisi à la bibliothèque personnelle de chacun de ceux qui ont entré ce code précis. C'est privé à ce lien : seuls ceux qui ont le code y ont accès.",
  },
  {
    id: "entrer-code",
    titre: "Entrer un code",
    texteCourt: "Quelqu'un t'a donné un code ? Entre-le ici pour recevoir tout ce qu'il partage.",
    texteComplet:
      "Si quelqu'un t'a donné un code, entre-le ici pour recevoir tout ce qu'il partage : comportement, bibliothèque, ou texte, selon ce que la personne y a mis.",
  },
  {
    id: "ecrire-matiere",
    titre: "Écrire une matière",
    texteCourt: "Choisis une matière et écris ce que Clovis doit savoir ou comment il doit répondre.",
    texteComplet:
      "Choisis une matière et écris ce que Clovis doit savoir ou comment il doit répondre. Un code se génère à l'enregistrement : partage-le, il débloque exactement ce texte pour celui qui l'entre.",
  },
  {
    id: "rappels",
    titre: "Rappels",
    texteCourt: "Notifications, rappels programmés et événements de calendrier.",
    texteComplet:
      "Regroupe les notifications classiques, les rappels programmés à une heure précise, et les événements ajoutés au calendrier du téléphone. Nécessite l'app mobile Clovis.",
  },
  {
    id: "temps-ecran",
    titre: "Temps d'écran",
    texteCourt: "Temps passé aujourd'hui dans chaque app, et les 7 derniers jours.",
    texteComplet:
      "Affiche le temps passé aujourd'hui dans chaque app installée, avec un historique sur les 7 derniers jours. Nécessite l'app mobile Clovis (Android uniquement pour l'instant).",
  },
  {
    id: "mes-codes",
    titre: "Mes codes",
    texteCourt: "Crée un code et partage-le : tous ceux qui l'entrent reçoivent ce que tu y mets.",
    texteComplet:
      "Crée un code et partage-le : tous ceux qui l'entrent reçoivent tout ce que tu y mets (comportement, bibliothèque, texte). Modifiable après coup, tout le monde voit la mise à jour dès qu'elle est faite.",
  },
  // Les 6 rubriques suivantes ajoutées le 02/09/2026 -- écrans oubliés du
  // premier passage du 01/09 (signalé par Bourama), textes repris tels
  // quels des paragraphes fixes qu'ils remplacent, sans reformulation.
  {
    id: "bibliotheque-perso",
    titre: "Bibliothèque",
    texteCourt: "Les documents ajoutés ici sont personnels : toi seul y as accès, et Clovis peut les consulter pendant une conversation.",
    texteComplet:
      "Les documents ajoutés ici sont personnels : toi seul y as accès, et Clovis peut les consulter pendant une conversation.",
  },
  {
    id: "bibliotheque-publique",
    titre: "Bibliothèque publique",
    texteCourt: (
      <>
        Un catalogue de documents partagé par tout le monde : ajoute un fichier, un lien ou une note avec un nom et
        une description pour que les autres le retrouvent facilement. En publiant, tu garantis détenir les droits sur
        ce contenu, voir les{" "}
        <Link href="/cgu" className="underline hover:text-dj-texte">
          CGU
        </Link>{" "}
        et la{" "}
        <Link href="/copyright" className="underline hover:text-dj-texte">
          politique de copyright
        </Link>
        .
      </>
    ),
    texteComplet: (
      <>
        Un catalogue de documents partagé par tout le monde : ajoute un fichier, un lien ou une note avec un nom et
        une description pour que les autres le retrouvent facilement. En publiant, tu garantis détenir les droits sur
        ce contenu, voir les{" "}
        <Link href="/cgu" className="underline hover:text-dj-texte">
          CGU
        </Link>{" "}
        et la{" "}
        <Link href="/copyright" className="underline hover:text-dj-texte">
          politique de copyright
        </Link>
        .
      </>
    ),
  },
  {
    id: "mes-skills",
    titre: "Mes skills",
    texteCourt:
      "Tes consignes perso pour Clovis, en plus de ce que ton enseignant a déjà mis en place. Tu peux en ajouter plusieurs, clique sur l'une d'elles pour l'ouvrir en grand et la modifier tranquillement.",
    texteComplet:
      "Tes consignes perso pour Clovis, en plus de ce que ton enseignant a déjà mis en place. Tu peux en ajouter plusieurs, clique sur l'une d'elles pour l'ouvrir en grand et la modifier tranquillement.",
  },
  {
    id: "skills-publics",
    titre: "Skills publics",
    texteCourt:
      "Des comportements publiés par d'autres étudiants. Active celui qui t'intéresse : une copie s'ajoute directement dans « Mes comportements », prête à l'emploi.",
    texteComplet:
      "Des comportements publiés par d'autres étudiants. Active celui qui t'intéresse : une copie s'ajoute directement dans « Mes comportements », prête à l'emploi.",
  },
  {
    id: "connecter-claude",
    titre: "Utiliser Clovis dans Claude",
    texteCourt:
      "Connecte ton compte Clovis à Claude pour que Claude puisse utiliser ce que tu as dans Clovis (ta mémoire, tes skills, ta bibliothèque) directement dans vos conversations. Ça se fait une seule fois.",
    texteComplet:
      "Connecte ton compte Clovis à Claude pour que Claude puisse utiliser ce que tu as dans Clovis (ta mémoire, tes skills, ta bibliothèque) directement dans vos conversations. Ça se fait une seule fois.",
  },
  {
    id: "memoire",
    titre: "Ma mémoire",
    texteCourt:
      "Résumé de ce que Clovis retient de tes conversations passées, pour personnaliser vos échanges. Se met à jour automatiquement au fil des discussions, tu peux aussi le corriger ou l'effacer toi-même ici.",
    texteComplet:
      "Résumé de ce que Clovis retient de tes conversations passées, pour personnaliser vos échanges. Se met à jour automatiquement au fil des discussions, tu peux aussi le corriger ou l'effacer toi-même ici.",
  },
];

export function trouverRubriqueAide(id: string): RubriqueAide | undefined {
  return RUBRIQUES_AIDE.find((r) => r.id === id);
}
