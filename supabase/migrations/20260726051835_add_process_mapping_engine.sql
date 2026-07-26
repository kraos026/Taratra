create type public.process_pattern_status as enum ('draft','published','archived');
create type public.process_map_status as enum ('draft','validated','published','archived');
create type public.process_validation_severity as enum ('error','warning','information');
create type public.process_node_type as enum ('process','step','decision','document','actor','system','event','input','output');
create type public.process_edge_type as enum ('produces','consumes','uses','sends','approves','transfers','depends_on','triggers');

create table public.process_patterns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null check(code ~ '^[a-z][a-z0-9_.]{2,119}$'),
  version integer not null check(version > 0),
  status public.process_pattern_status not null default 'draft',
  name text not null,
  description text,
  industry_scope jsonb not null default '[]' check(jsonb_typeof(industry_scope)='array'),
  required_facts jsonb not null check(jsonb_typeof(required_facts)='array'),
  optional_facts jsonb not null default '[]' check(jsonb_typeof(optional_facts)='array'),
  graph_template jsonb not null check(jsonb_typeof(graph_template)='object'),
  validation_rules jsonb not null check(jsonb_typeof(validation_rules)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create unique index process_patterns_system_version_idx on public.process_patterns(code,version) where organization_id is null;
create unique index process_patterns_org_version_idx on public.process_patterns(organization_id,code,version) where organization_id is not null;

create table public.process_maps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  knowledge_snapshot_id uuid not null,
  process_pattern_id uuid not null references public.process_patterns(id),
  process_pattern_version integer not null,
  previous_version_id uuid,
  version_number integer not null check(version_number > 0),
  status public.process_map_status not null default 'draft',
  lock_version integer not null default 1 check(lock_version > 0),
  name text not null,
  graph_json jsonb not null check(jsonb_typeof(graph_json)='object'),
  validation_json jsonb not null default '[]' check(jsonb_typeof(validation_json)='array'),
  provenance_json jsonb not null check(jsonb_typeof(provenance_json)='object'),
  completeness_percentage numeric(5,2) not null check(completeness_percentage between 0 and 100),
  confidence_percentage numeric(5,2) not null check(confidence_percentage between 0 and 100),
  coverage_percentage numeric(5,2) not null check(coverage_percentage between 0 and 100),
  ready_for_business_intelligence boolean not null default false,
  created_by uuid not null references auth.users(id),
  validated_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key(knowledge_snapshot_id,organization_id) references public.knowledge_snapshots(id,organization_id),
  foreign key(previous_version_id,organization_id) references public.process_maps(id,organization_id),
  unique(id,organization_id),
  unique(organization_id,company_id,process_pattern_id,version_number)
);

create table public.process_map_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_map_id uuid not null,
  node_key text not null,
  node_type public.process_node_type not null,
  name text not null,
  description text,
  sequence integer,
  department_knowledge_node_id uuid,
  actor_knowledge_node_id uuid,
  system_knowledge_node_id uuid,
  knowledge_fact_ids uuid[] not null default '{}',
  estimated_duration_minutes numeric(12,2),
  frequency text,
  execution_mode text check(execution_mode is null or execution_mode in ('manual','automatic','ai_assisted','mixed')),
  attributes_json jsonb not null default '{}' check(jsonb_typeof(attributes_json)='object'),
  created_at timestamptz not null default now(),
  foreign key(process_map_id,organization_id) references public.process_maps(id,organization_id) on delete cascade,
  unique(process_map_id,node_key),
  unique(id,process_map_id,organization_id)
);

create table public.process_map_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_map_id uuid not null,
  from_node_id uuid not null,
  to_node_id uuid not null,
  edge_type public.process_edge_type not null,
  attributes_json jsonb not null default '{}' check(jsonb_typeof(attributes_json)='object'),
  created_at timestamptz not null default now(),
  foreign key(from_node_id,process_map_id,organization_id) references public.process_map_nodes(id,process_map_id,organization_id) on delete cascade,
  foreign key(to_node_id,process_map_id,organization_id) references public.process_map_nodes(id,process_map_id,organization_id) on delete cascade,
  unique(process_map_id,from_node_id,to_node_id,edge_type)
);

create table public.process_map_ownership (
  process_map_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_knowledge_node_id uuid,
  department_knowledge_node_id uuid,
  participant_knowledge_node_ids uuid[] not null default '{}',
  supporting_system_node_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key(process_map_id,organization_id) references public.process_maps(id,organization_id) on delete cascade
);

create table public.process_map_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_map_id uuid not null,
  code text not null,
  severity public.process_validation_severity not null,
  message text not null,
  node_key text,
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json)='object'),
  created_at timestamptz not null default now(),
  foreign key(process_map_id,organization_id) references public.process_maps(id,organization_id) on delete cascade
);

create table public.process_map_fact_usage (
  process_map_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  knowledge_fact_id uuid not null,
  usage text not null check(usage in ('consumed','ignored')),
  reason text not null,
  importance_weight numeric(8,2) not null check(importance_weight >= 0),
  created_at timestamptz not null default now(),
  primary key(process_map_id,knowledge_fact_id),
  foreign key(process_map_id,organization_id) references public.process_maps(id,organization_id) on delete cascade
);

create index process_maps_company_status_idx on public.process_maps(organization_id,company_id,status,version_number desc);
create index process_maps_snapshot_idx on public.process_maps(knowledge_snapshot_id);
create index process_map_nodes_map_sequence_idx on public.process_map_nodes(process_map_id,sequence);
create index process_map_validations_map_severity_idx on public.process_map_validations(process_map_id,severity);

create trigger process_patterns_set_updated_at before update on public.process_patterns for each row execute function private.set_updated_at();
create trigger process_maps_set_updated_at before update on public.process_maps for each row execute function private.set_updated_at();

create function private.prevent_published_process_pattern_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='published' then raise exception 'Published process patterns are immutable'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_published_process_pattern_mutation() from public,anon,authenticated;
create trigger process_patterns_immutable before update or delete on public.process_patterns
for each row execute function private.prevent_published_process_pattern_mutation();

create function private.prevent_published_process_map_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
declare map_id uuid; published boolean;
begin
  if tg_table_name = 'process_maps' then
    if old.status = 'published' then raise exception 'Published process maps are immutable'; end if;
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  if tg_op='DELETE' then map_id:=old.process_map_id; else map_id:=new.process_map_id; end if;
  select exists(select 1 from public.process_maps where id=map_id and status='published') into published;
  if published then raise exception 'Published process maps are immutable'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_published_process_map_mutation() from public,anon,authenticated;
create trigger process_maps_immutable before update or delete on public.process_maps for each row execute function private.prevent_published_process_map_mutation();
do $$ declare t text; begin foreach t in array array['process_map_nodes','process_map_edges','process_map_ownership','process_map_validations','process_map_fact_usage'] loop
 execute format('create trigger %I_immutable before insert or update or delete on public.%I for each row execute function private.prevent_published_process_map_mutation()',t,t);
end loop; end $$;

do $$ declare t text; begin foreach t in array array['process_patterns','process_maps','process_map_nodes','process_map_edges','process_map_ownership','process_map_validations','process_map_fact_usage'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy "members read process patterns" on public.process_patterns for select to authenticated using(process_patterns.organization_id is null or (select private.has_organization_role(process_patterns.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins manage process patterns" on public.process_patterns for all to authenticated using(process_patterns.organization_id is not null and (select private.has_organization_role(process_patterns.organization_id,array['owner','admin']::public.organization_role[]))) with check(process_patterns.organization_id is not null and (select private.has_organization_role(process_patterns.organization_id,array['owner','admin']::public.organization_role[])));
do $$ declare t text; begin foreach t in array array['process_map_nodes','process_map_edges','process_map_ownership','process_map_validations','process_map_fact_usage'] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
end loop; end $$;
create policy "members read process maps" on public.process_maps for select to authenticated
using((select private.has_organization_role(process_maps.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create process maps" on public.process_maps for insert to authenticated
with check((select private.has_organization_role(process_maps.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update process maps" on public.process_maps for update to authenticated
using((select private.has_organization_role(process_maps.organization_id,array['owner','admin','consultant']::public.organization_role[])))
with check(
  (select private.has_organization_role(process_maps.organization_id,array['owner','admin','consultant']::public.organization_role[]))
  and (
    process_maps.status <> 'published'
    or (select private.has_organization_role(process_maps.organization_id,array['owner','admin']::public.organization_role[]))
  )
);
grant select,insert,update,delete on public.process_patterns,public.process_maps,public.process_map_nodes,public.process_map_edges,public.process_map_ownership,public.process_map_validations,public.process_map_fact_usage to authenticated;

insert into public.process_patterns(code,version,status,name,industry_scope,required_facts,optional_facts,graph_template,validation_rules,published_at) values
('invoice_processing',1,'published','Traitement des factures','[]','[{"match":"invoice","weight":5}]','[{"match":"finance","weight":2},{"match":"software","weight":2},{"match":"manual","weight":1}]',
'{"nodes":[{"key":"receive","type":"step","name":"Recevoir la facture"},{"key":"validate","type":"decision","name":"Valider"},{"key":"account","type":"step","name":"Comptabiliser"},{"key":"approve","type":"decision","name":"Approuver"},{"key":"pay","type":"step","name":"Payer"},{"key":"archive","type":"step","name":"Archiver"}],"edges":[["receive","validate","triggers"],["validate","account","transfers"],["account","approve","triggers"],["approve","pay","triggers"],["pay","archive","transfers"]]}',
'[{"code":"start","severity":"error"},{"code":"end","severity":"error"},{"code":"owner","severity":"error"},{"code":"cycle","severity":"warning"}]',now()),
('recruitment',1,'published','Recrutement','[]','[{"match":"recruit","weight":5}]','[{"match":"hr","weight":3},{"match":"candidate","weight":2}]',
'{"nodes":[{"key":"need","type":"event","name":"Identifier le besoin"},{"key":"publish","type":"step","name":"Publier l’offre"},{"key":"screen","type":"step","name":"Présélectionner"},{"key":"interview","type":"step","name":"Conduire les entretiens"},{"key":"decide","type":"decision","name":"Décider"},{"key":"onboard","type":"output","name":"Préparer l’intégration"}],"edges":[["need","publish","triggers"],["publish","screen","transfers"],["screen","interview","triggers"],["interview","decide","triggers"],["decide","onboard","produces"]]}',
'[{"code":"start","severity":"error"},{"code":"end","severity":"error"},{"code":"owner","severity":"error"},{"code":"cycle","severity":"warning"}]',now()),
('customer_support',1,'published','Support client','[]','[{"match":"support","weight":5}]','[{"match":"customer","weight":3},{"match":"ticket","weight":2}]',
'{"nodes":[{"key":"request","type":"event","name":"Recevoir la demande"},{"key":"classify","type":"decision","name":"Qualifier"},{"key":"resolve","type":"step","name":"Résoudre"},{"key":"escalate","type":"decision","name":"Escalader si nécessaire"},{"key":"reply","type":"step","name":"Répondre"},{"key":"close","type":"output","name":"Clôturer"}],"edges":[["request","classify","triggers"],["classify","resolve","transfers"],["resolve","escalate","triggers"],["escalate","reply","transfers"],["reply","close","produces"]]}',
'[{"code":"start","severity":"error"},{"code":"end","severity":"error"},{"code":"owner","severity":"error"},{"code":"cycle","severity":"warning"}]',now()),
('stock_management',1,'published','Gestion des stocks','[]','[{"match":"stock","weight":5}]','[{"match":"inventory","weight":3},{"match":"purchase","weight":2}]',
'{"nodes":[{"key":"monitor","type":"step","name":"Contrôler le stock"},{"key":"threshold","type":"decision","name":"Détecter le seuil"},{"key":"order","type":"step","name":"Commander"},{"key":"receive","type":"step","name":"Réceptionner"},{"key":"update","type":"step","name":"Mettre à jour le stock"}],"edges":[["monitor","threshold","triggers"],["threshold","order","triggers"],["order","receive","transfers"],["receive","update","produces"]]}',
'[{"code":"start","severity":"error"},{"code":"end","severity":"error"},{"code":"owner","severity":"error"},{"code":"cycle","severity":"warning"}]',now()),
('order_processing',1,'published','Traitement des commandes','[]','[{"match":"order","weight":5}]','[{"match":"sales","weight":3},{"match":"delivery","weight":2}]',
'{"nodes":[{"key":"receive","type":"event","name":"Recevoir la commande"},{"key":"validate","type":"decision","name":"Valider la commande"},{"key":"prepare","type":"step","name":"Préparer"},{"key":"ship","type":"step","name":"Expédier ou délivrer"},{"key":"confirm","type":"output","name":"Confirmer la réalisation"}],"edges":[["receive","validate","triggers"],["validate","prepare","triggers"],["prepare","ship","transfers"],["ship","confirm","produces"]]}',
'[{"code":"start","severity":"error"},{"code":"end","severity":"error"},{"code":"owner","severity":"error"},{"code":"cycle","severity":"warning"}]',now());
