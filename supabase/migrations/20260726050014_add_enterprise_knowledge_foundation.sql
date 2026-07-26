create type public.knowledge_snapshot_status as enum ('building','ready','failed');
create type public.knowledge_source_type as enum ('discovery','interview','connector','manual_validation','ai_inference');

create table public.knowledge_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  version integer not null check(version > 0),
  status public.knowledge_snapshot_status not null default 'building',
  schema_version integer not null default 1 check(schema_version > 0),
  generated_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  unique(organization_id,company_id,version),
  unique(id,organization_id)
);

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  source_type public.knowledge_source_type not null,
  source_id uuid not null,
  source_version integer not null check(source_version > 0),
  validated_at timestamptz,
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(snapshot_id,organization_id) references public.knowledge_snapshots(id,organization_id) on delete cascade,
  unique(snapshot_id,source_type,source_id),
  unique(id,snapshot_id,organization_id)
);

create table public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  node_key text not null check(node_key ~ '^[a-z][a-z0-9_.:-]{2,199}$'),
  node_type text not null check(node_type ~ '^[a-z][a-z0-9_]{1,79}$'),
  domain text not null check(domain ~ '^[a-z][a-z0-9_]{1,79}$'),
  label text not null,
  canonical_entity_type text,
  canonical_entity_id uuid,
  confidence_percentage numeric(5,2) not null check(confidence_percentage between 0 and 100),
  attributes_json jsonb not null default '{}' check(jsonb_typeof(attributes_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(snapshot_id,organization_id) references public.knowledge_snapshots(id,organization_id) on delete cascade,
  unique(snapshot_id,node_key),
  unique(id,snapshot_id,organization_id)
);

create table public.knowledge_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  node_id uuid,
  fact_key text not null check(fact_key ~ '^[a-z][a-z0-9_.:-]{2,199}$'),
  domain text not null check(domain ~ '^[a-z][a-z0-9_]{1,79}$'),
  value_json jsonb not null,
  value_type text not null check(value_type in ('string','number','boolean','string_array','object')),
  confidence_percentage numeric(5,2) not null check(confidence_percentage between 0 and 100),
  created_at timestamptz not null default now(),
  foreign key(snapshot_id,organization_id) references public.knowledge_snapshots(id,organization_id) on delete cascade,
  foreign key(node_id,snapshot_id,organization_id) references public.knowledge_nodes(id,snapshot_id,organization_id),
  unique(snapshot_id,fact_key),
  unique(id,snapshot_id,organization_id)
);

create table public.knowledge_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  from_node_id uuid not null,
  to_node_id uuid not null,
  relationship_type text not null check(relationship_type ~ '^[a-z][a-z0-9_]{1,79}$'),
  confidence_percentage numeric(5,2) not null check(confidence_percentage between 0 and 100),
  attributes_json jsonb not null default '{}' check(jsonb_typeof(attributes_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(from_node_id,snapshot_id,organization_id) references public.knowledge_nodes(id,snapshot_id,organization_id),
  foreign key(to_node_id,snapshot_id,organization_id) references public.knowledge_nodes(id,snapshot_id,organization_id),
  unique(snapshot_id,from_node_id,to_node_id,relationship_type)
);

create table public.knowledge_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  fact_id uuid not null,
  source_id uuid not null,
  source_record_type text not null,
  source_record_id uuid not null,
  evidence_type text not null check(evidence_type in ('validated_entity','validated_answer','manual_validation','connector_record','inference')),
  confidence_percentage numeric(5,2) not null check(confidence_percentage between 0 and 100),
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(fact_id,snapshot_id,organization_id) references public.knowledge_facts(id,snapshot_id,organization_id) on delete cascade,
  foreign key(source_id,snapshot_id,organization_id) references public.knowledge_sources(id,snapshot_id,organization_id) on delete cascade,
  unique(fact_id,source_id,source_record_type,source_record_id)
);

create index knowledge_snapshots_company_idx on public.knowledge_snapshots(organization_id,company_id,version desc);
create index knowledge_facts_domain_idx on public.knowledge_facts(snapshot_id,domain);
create index knowledge_nodes_type_idx on public.knowledge_nodes(snapshot_id,node_type);
create index knowledge_evidence_source_idx on public.knowledge_evidence(source_id,source_record_id);

create trigger knowledge_snapshots_set_updated_at before update on public.knowledge_snapshots
for each row execute function private.set_updated_at();

create function private.prevent_ready_knowledge_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_snapshot uuid;
begin
  if tg_op = 'DELETE' then target_snapshot := old.snapshot_id;
  else target_snapshot := new.snapshot_id;
  end if;
  if exists(select 1 from public.knowledge_snapshots where id = target_snapshot and status = 'ready') then
    raise exception 'Ready knowledge snapshots are immutable';
  end if;
  if tg_op = 'DELETE' then return old;
  else return new;
  end if;
end $$;
revoke execute on function private.prevent_ready_knowledge_mutation() from public,anon,authenticated;

do $$ declare t text; begin foreach t in array array[
  'knowledge_sources','knowledge_nodes','knowledge_facts','knowledge_relationships','knowledge_evidence'
] loop
 execute format('create trigger %I_immutable before insert or update or delete on public.%I for each row execute function private.prevent_ready_knowledge_mutation()',t,t);
end loop; end $$;

create function private.prevent_ready_snapshot_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'ready' then raise exception 'Ready knowledge snapshots are immutable'; end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_ready_snapshot_mutation() from public,anon,authenticated;
create trigger knowledge_snapshots_immutable before update or delete on public.knowledge_snapshots
for each row execute function private.prevent_ready_snapshot_mutation();

do $$ declare t text; begin foreach t in array array[
  'knowledge_snapshots','knowledge_sources','knowledge_nodes','knowledge_facts','knowledge_relationships','knowledge_evidence'
] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

do $$ declare t text; begin foreach t in array array[
  'knowledge_snapshots','knowledge_sources','knowledge_nodes','knowledge_facts','knowledge_relationships','knowledge_evidence'
] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "editors build %1$s" on public.%1$I for all to authenticated using ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
end loop; end $$;

grant select,insert,update,delete on public.knowledge_snapshots,public.knowledge_sources,public.knowledge_nodes,public.knowledge_facts,public.knowledge_relationships,public.knowledge_evidence to authenticated;
