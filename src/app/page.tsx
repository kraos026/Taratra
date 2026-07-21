import { ArrowRight, BarChart3, Building2, Check, ChevronRight, CircleGauge, Clock3, FileText, LayoutDashboard, Lightbulb, Search, Settings, Sparkles, Target, Users } from "lucide-react";

const nav = [
  [LayoutDashboard, "Vue d’ensemble", true],
  [Building2, "Entreprises", false],
  [Users, "CRM", false],
  [CircleGauge, "Audits", false],
  [Lightbulb, "Recommandations", false],
  [FileText, "Rapports", false],
] as const;

const companies = [
  { initials: "NV", name: "Nova Conseil", sector: "Conseil", status: "Audit en cours", progress: 68, color: "violet" },
  { initials: "AM", name: "Atelier Mécanique", sector: "Automobile", status: "À démarrer", progress: 0, color: "orange" },
  { initials: "CL", name: "Clinique Lumière", sector: "Santé", status: "Rapport prêt", progress: 100, color: "blue" },
] as const;

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Sparkles size={19} /></span><span>Automate<span>X</span></span></div>
        <nav aria-label="Navigation principale">
          <p className="nav-label">ESPACE DE TRAVAIL</p>
          {nav.map(([Icon, label, active]) => <a className={active ? "nav-item active" : "nav-item"} href="#" key={label}><Icon size={19}/><span>{label}</span>{label === "Audits" && <b>3</b>}</a>)}
          <p className="nav-label second">GESTION</p>
          <a className="nav-item" href="#"><BarChart3 size={19}/><span>Base de connaissances</span></a>
          <a className="nav-item" href="#"><Settings size={19}/><span>Paramètres</span></a>
        </nav>
        <div className="upgrade"><span><Sparkles size={17}/></span><strong>Passez à AutomateX Pro</strong><p>Débloquez des audits illimités et les rapports personnalisés.</p><button>Découvrir Pro <ArrowRight size={14}/></button></div>
        <div className="profile"><div className="avatar">JD</div><div><strong>Jean Dupont</strong><small>Consultant</small></div><span>•••</span></div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="search"><Search size={18}/><input aria-label="Rechercher" placeholder="Rechercher une entreprise, un audit..."/><kbd>⌘ K</kbd></div><button className="help">?</button><button className="primary"><Sparkles size={17}/>Nouvel audit</button></header>

        <div className="page">
          <div className="heading"><div><p className="eyebrow">MARDI 21 JUILLET</p><h1>Bonjour Jean <span>👋</span></h1><p>Voici ce qui se passe dans votre activité aujourd’hui.</p></div><button className="outline">Voir mon activité <ChevronRight size={16}/></button></div>

          <div className="stats">
            <article><div className="stat-icon purple"><Building2/></div><div><p>Entreprises</p><strong>12</strong><small><b>+2</b> ce mois-ci</small></div></article>
            <article><div className="stat-icon blue"><CircleGauge/></div><div><p>Audits en cours</p><strong>5</strong><small>3 à finaliser</small></div></article>
            <article><div className="stat-icon green"><Target/></div><div><p>Opportunités détectées</p><strong>47</strong><small><b>+12%</b> ce mois-ci</small></div></article>
            <article><div className="stat-icon orange"><Clock3/></div><div><p>Heures économisables</p><strong>186 h</strong><small>Estimation mensuelle</small></div></article>
          </div>

          <div className="grid">
            <section className="panel companies"><div className="panel-head"><div><h2>Entreprises récentes</h2><p>Suivez l’avancement de vos derniers clients</p></div><a href="#">Voir toutes <ArrowRight size={15}/></a></div>
              <div className="company-list">{companies.map(c => <div className="company" key={c.name}><div className={`company-logo ${c.color}`}>{c.initials}</div><div className="company-name"><strong>{c.name}</strong><small>{c.sector}</small></div><div className={`badge ${c.progress === 100 ? "done" : c.progress === 0 ? "todo" : "running"}`}><i/>{c.status}</div><div className="progress-wrap"><div><span>Progression</span><b>{c.progress}%</b></div><div className="progress"><i style={{width:`${c.progress}%`}}/></div></div><button aria-label={`Ouvrir ${c.name}`}><ChevronRight/></button></div>)}</div>
            </section>

            <section className="panel score"><div className="panel-head"><div><h2>Performance globale</h2><p>Moyenne de vos audits</p></div><button>30 derniers jours⌄</button></div><div className="score-body"><div className="ring"><div><strong>74</strong><span>/100</span></div></div><div className="score-copy"><span className="excellent"><Check size={13}/>Excellent</span><h3>Beau potentiel !</h3><p>Vos clients ont un fort potentiel d’automatisation.</p><a href="#">Voir l’analyse <ArrowRight size={14}/></a></div></div></section>

            <section className="panel activity"><div className="panel-head"><div><h2>Activité récente</h2><p>Dernières actions de votre équipe</p></div><button>•••</button></div><div className="timeline"><div><i className="violet"><FileText/></i><p><strong>Rapport généré</strong><span>Clinique Lumière</span><small>Il y a 2 heures</small></p></div><div><i className="blue"><CircleGauge/></i><p><strong>Audit mis à jour</strong><span>Nova Conseil · 68%</span><small>Il y a 5 heures</small></p></div><div><i className="orange"><Building2/></i><p><strong>Entreprise ajoutée</strong><span>Atelier Mécanique</span><small>Hier à 16:42</small></p></div></div></section>

            <section className="cta"><div className="cta-icon"><Sparkles/></div><div><span>PRÊT À COMMENCER ?</span><h2>Lancez votre prochain audit</h2><p>Identifiez les meilleures opportunités d’automatisation en moins d’une heure.</p></div><button>Démarrer un audit <ArrowRight size={17}/></button></section>
          </div>
          <footer><span>AutomateX v0.1 · Fondations sécurisées</span><span>Les données affichées sont des exemples d’interface — aucune recommandation ni projection ROI n’est produite sans règles validées.</span></footer>
        </div>
      </section>
    </main>
  );
}
