import Link from "next/link";
export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-slate-100">
      <Link href="/" className="text-blue-300 hover:underline">
        Retour à mon espace
      </Link>
      <h1 className="text-3xl font-bold">Vos données et votre compte</h1>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">Télécharger un profil entreprise</h2>
        <p>
          Le propriétaire ou un administrateur peut télécharger le profil depuis le dossier
          entreprise, y compris son profil archivé.
        </p>
        <p>
          Ce fichier contient uniquement le profil et ses notes. Il ne contient pas les entretiens,
          preuves, analyses, résultats, données d’authentification, journaux ou sauvegardes. Ce
          n’est pas un export complet du compte.
        </p>
        <p>
          Conservez le fichier dans un emplacement privé : il peut contenir des coordonnées ou des
          informations que vous avez saisies.
        </p>
        <Link href="/companies" className="inline-block text-blue-300 hover:underline">
          Ouvrir mes dossiers entreprise
        </Link>
      </section>
      <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900 p-6">
        <h2 className="text-xl font-semibold">
          Demander un accès, une correction ou une suppression
        </h2>
        <p>
          Écrivez à Taratra Miarintsoa, responsable déclaré à Madagascar, à kraosltd2@gmail.com.
          Indiquez le compte concerné et votre demande, sans mot de passe, lien de connexion ni
          document confidentiel.
        </p>
        <a
          href="mailto:kraosltd2@gmail.com?subject=Optivos%20%E2%80%94%20demande%20relative%20aux%20donn%C3%A9es"
          className="inline-block text-blue-300 hover:underline"
        >
          Préparer un email de demande
        </a>
        <p>
          L’ouverture de cet email ne l’envoie pas et n’enregistre pas une demande dans Optivos.
          Vous devrez l’envoyer vous-même.
        </p>
        <p>
          Archiver un dossier masque son profil sans effacer ses données. Supprimer une entreprise
          n’efface pas automatiquement son compte, ses audits, les journaux ou les sauvegardes. Les
          actions réalisées et leurs limites doivent être confirmées lors du traitement de votre
          demande.
        </p>
      </section>
    </main>
  );
}
