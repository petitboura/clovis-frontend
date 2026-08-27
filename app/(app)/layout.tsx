import { AppShell } from "@/components/AppShell";

// Route group (app) : n'affecte pas les URLs (bureau, comportements,
// bibliotheque, memoire restent à la racine)
// mais isole la nav + le chat flottant de /connexion et /inscription, qui
// restent en dehors de ce groupe et n'ont donc pas ce chrome.
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
