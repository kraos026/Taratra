create table public.privacy_requests (
  id uuid primary key,
  requester_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  kind text not null check (kind in ('ACCESS','CORRECTION','DELETION')),
  description text not null check (char_length(btrim(description)) between 5 and 1000),
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','IN_REVIEW','NEEDS_INFORMATION','COMPLETED','DECLINED')),
  public_response text check (char_length(public_response) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('COMPLETED','DECLINED') or public_response is not null)
);
create index privacy_requests_requester_created_idx
  on public.privacy_requests(requester_id, created_at desc);
create unique index privacy_requests_open_kind_idx
  on public.privacy_requests(requester_id, kind)
  where status in ('RECEIVED','IN_REVIEW','NEEDS_INFORMATION');
alter table public.privacy_requests enable row level security;
revoke all on public.privacy_requests from public, anon, authenticated, service_role;
grant select on public.privacy_requests to authenticated;
grant insert(id, requester_id, organization_id, kind, description)
  on public.privacy_requests to authenticated;
create policy privacy_requests_self_read on public.privacy_requests
  for select to authenticated using (requester_id = (select auth.uid()));
create policy privacy_requests_self_create on public.privacy_requests
  for insert to authenticated with check (
    requester_id = (select auth.uid()) and status = 'RECEIVED'
    and public_response is null
    and exists (select 1 from public.organization_members m
      where m.organization_id = privacy_requests.organization_id
        and m.user_id = (select auth.uid()))
  );
-- No authenticated UPDATE/DELETE grant or policy; handling is privileged/manual.
-- No cascade and no automatic erasure is attached to this registry.
