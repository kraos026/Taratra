"use client";

import { Component, useState, type FormEvent, type ReactNode } from "react";
import { ConvexReactClient, useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { api } from "../../../convex/_generated/api";
import { convexAuthClient } from "./auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/modules/auth/presentation/auth-shell";
import { OptivosLogo } from "@/components/brand/optivos-logo";

async function signOut() {
  const result = await convexAuthClient.signOut();
  if (!result.error) window.location.reload();
}

class AccessBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <AuthShell
          title="Espace indisponible"
          description="Votre accès a peut-être changé. Reconnectez-vous pour réessayer."
        >
          <Button onClick={() => void signOut()}>Se déconnecter</Button>
        </AuthShell>
      );
    return this.props.children;
  }
}

export function ConvexPilot({ url }: { url: string }) {
  const [client] = useState(() => new ConvexReactClient(url));
  return (
    <ConvexBetterAuthProvider client={client} authClient={convexAuthClient}>
      <AccessBoundary>
        <PilotContent />
      </AccessBoundary>
    </ConvexBetterAuthProvider>
  );
}

function PilotContent() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading)
    return (
      <AuthShell title="Optivos" description="Chargement de votre espace…">
        <p role="status">Connexion en cours…</p>
      </AuthShell>
    );
  return isAuthenticated ? <Workspace /> : <Authentication />;
}

function Authentication() {
  const [signup, setSignup] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const credentials = {
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    };
    try {
      const result = signup
        ? await convexAuthClient.signUp.email({
            ...credentials,
            name: String(form.get("name") ?? "").trim(),
          })
        : await convexAuthClient.signIn.email(credentials);
      if (result.error)
        setMessage(
          result.error.status === 429
            ? "Trop de tentatives. Patientez avant de réessayer."
            : signup
              ? "Création impossible. Vérifiez vos informations ou connectez-vous si le compte existe déjà."
              : "Connexion impossible. Vérifiez votre adresse et votre mot de passe.",
        );
    } catch {
      setMessage("Le service est indisponible. Réessayez dans quelques instants.");
    } finally {
      setPending(false);
    }
  }
  return (
    <AuthShell
      title={signup ? "Créer un compte pilote" : "Connexion au pilote Optivos"}
      description="Testez votre nouvel espace et vos entreprises sur Convex. Les audits seront disponibles après leur migration."
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        {signup && (
          <div className="space-y-2">
            <Label htmlFor="pilot-name">Votre nom</Label>
            <Input id="pilot-name" name="name" required maxLength={160} autoComplete="name" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="pilot-email">Adresse e-mail</Label>
          <Input id="pilot-email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pilot-password">Mot de passe</Label>
          <Input
            id="pilot-password"
            name="password"
            type="password"
            required
            minLength={signup ? 12 : 1}
            maxLength={128}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </div>
        {signup && (
          <p className="text-xs text-slate-400">
            Au moins 12 caractères. Ce compte crée un espace neuf ; il ne donne pas accès aux
            anciens dossiers.
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Veuillez patienter…" : signup ? "Créer mon compte" : "Se connecter"}
        </Button>
        {message && (
          <p role="alert" className="text-sm text-amber-200">
            {message}
          </p>
        )}
      </form>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setSignup(!signup);
          setMessage(undefined);
        }}
        className="mt-5 text-sm text-blue-400 underline"
      >
        {signup ? "J’ai déjà un compte pilote" : "Créer un nouveau compte pilote"}
      </button>
    </AuthShell>
  );
}

function Workspace() {
  const workspace = useQuery(api.workspaces.current);
  const create = useMutation(api.workspaces.create);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage(undefined);
    try {
      await create({ name: String(form.get("organization") ?? "") });
    } catch {
      setMessage("Création de l’espace impossible. Réessayez.");
    } finally {
      setPending(false);
    }
  }
  if (workspace === undefined)
    return (
      <AuthShell title="Votre espace" description="Chargement…">
        <p role="status">Chargement de votre organisation…</p>
      </AuthShell>
    );
  if (workspace === null)
    return (
      <AuthShell
        title="Créer votre espace entreprise"
        description="Choisissez le nom de votre organisation. Vous pourrez ensuite y ajouter vos entreprises."
      >
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <Label htmlFor="pilot-organization">Nom de l’organisation</Label>
          <Input
            id="pilot-organization"
            name="organization"
            required
            minLength={2}
            maxLength={160}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Création…" : "Créer mon espace"}
          </Button>
          {message && <p role="alert">{message}</p>}
        </form>
        <button type="button" onClick={() => void signOut()} className="mt-5 text-sm underline">
          Se déconnecter
        </button>
      </AuthShell>
    );
  return <Companies organizationName={workspace.name} />;
}

function Companies({ organizationName }: { organizationName: string }) {
  const page = useQuery(api.companies.list, { includeArchived: true, pageSize: 100 });
  const create = useMutation(api.companies.create);
  const archive = useMutation(api.companies.archive);
  const restore = useMutation(api.companies.restore);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  async function perform(operation: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setMessage(undefined);
    try {
      await operation();
    } catch {
      setMessage("L’opération n’a pas abouti. Vérifiez votre accès et réessayez.");
    } finally {
      setPending(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("company") ?? "");
    void perform(async () => {
      await create({ input: { name } });
      form.reset();
    });
  }
  return (
    <main className="min-h-screen bg-[#030817] px-5 py-8 text-slate-100 [&_input]:border-white/15 [&_input]:bg-slate-900 [&_input]:text-slate-100 [&_label]:text-slate-200">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-5">
          <OptivosLogo subtitle={organizationName} />
          <Button variant="outline" onClick={() => void signOut()}>
            Se déconnecter
          </Button>
        </header>
        <section className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-5">
          <h1 className="text-xl font-semibold">Vos entreprises</h1>
          <p className="mt-2 text-sm text-slate-400">
            Pilote de migration : vos données sont enregistrées dans Convex. Le parcours d’audit est
            encore en cours de raccordement.
          </p>
        </section>
        {page?.permissions.canWrite && (
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1 space-y-2">
              <Label htmlFor="pilot-company">Nom de l’entreprise</Label>
              <Input id="pilot-company" name="company" required minLength={2} maxLength={160} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Ajouter une entreprise"}
            </Button>
          </form>
        )}
        {message && (
          <p role="alert" className="text-amber-200">
            {message}
          </p>
        )}
        {page === undefined ? (
          <p role="status">Chargement des entreprises…</p>
        ) : page.items.length === 0 ? (
          <p className="rounded-xl border border-white/10 p-8 text-slate-400">
            Aucune entreprise pour le moment. Ajoutez votre première entreprise.
          </p>
        ) : (
          <ul className="space-y-3">
            {page.items.map((company) => (
              <li
                key={company.id}
                className="flex items-center justify-between gap-5 rounded-xl border border-white/10 p-5"
              >
                <div>
                  <h2 className="font-medium">{company.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {company.deletedAt ? "Archivée" : "Active"}
                  </p>
                </div>
                {page.permissions.canWrite && (
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      void perform(() =>
                        company.deletedAt
                          ? restore({ id: company.id })
                          : archive({ id: company.id }),
                      )
                    }
                  >
                    {company.deletedAt ? "Restaurer" : "Archiver"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {page && page.total > page.items.length && (
          <p className="text-sm text-slate-400">
            Les 100 premières entreprises sont affichées sur ce pilote.
          </p>
        )}
      </div>
    </main>
  );
}
