import { redirect } from "next/navigation";

// 30/08/2026, audit navigation web mobile vs natif, étape 1 : cette page
// portait l'onglet "Plus" de l'ancienne barre du bas web mobile
// (BarreOngletsWeb.tsx). Cet onglet est retiré (web mobile a maintenant
// les 5 mêmes onglets directs que le natif) et son contenu passe dans un
// panneau flottant (MenuHamburgerWeb.tsx, même mécanique que le natif,
// voir MenuHamburgerNatif.tsx) plutôt qu'une page à part. La route reste
// en place, en simple redirection, pour ne pas casser un lien ou un
// marque-page existant qui pointerait encore vers /plus.
export default function PagePlus() {
  redirect("/");
}
