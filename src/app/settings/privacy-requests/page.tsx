import Link from "next/link";
import { PrivacyOperatorPanel } from "@/modules/privacy/presentation/privacy-operator-panel";
export default function PrivacyOperatorPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-100">
      <Link href="/settings" className="text-blue-300 hover:underline">
        Retour aux paramètres
      </Link>
      <h1 className="text-3xl font-bold">Traitement des demandes — responsable</h1>
      <p>
        Accès temporaire réservé au responsable désigné. Cette interface enregistre une réponse et
        son historique. Elle ne supprime aucune donnée, n’exécute aucune correction et n’envoie
        aucun email.
      </p>
      <PrivacyOperatorPanel />
    </main>
  );
}
