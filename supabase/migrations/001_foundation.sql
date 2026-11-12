-- Smart RT Foundation V1
-- Run in Supabase SQL Editor on a new project.
create extension if not exists pgcrypto;

create table if not exists public.houses (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (length(trim(code)) between 1 and 40),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(trim(full_name)) between 1 and 150),
 phone text,
 house_id uuid references public.houses(id),
 resident_type text not null default 'permanent' check (resident_type in ('permanent','temporary')),
 status text not null default 'pending' check (status in ('pending','active','inactive')),
 created_at timestamptz not null default now()
);

create table if not exists public.registration_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 house_id uuid not null references public.houses(id),
 full_name text not null check (length(trim(full_name)) between 1 and 150),
 phone text not null check (length(trim(phone)) between 7 and 25),
 resident_type text not null check (resident_type in ('permanent','temporary')),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id)
);
create unique index if not exists one_pending_registration_per_user on public.registration_requests(user_id) where status='pending';

create table if not exists public.role_assignments (
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('super_admin','ketua_rt','bu_rt','sekretaris_rt','bendahara_rt','bendahara_arisan')),
 created_at timestamptz not null default now(),
 primary key(user_id,role)
);

create table if not exists public.audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id),
 action text not null,
 entity_type text not null,
 entity_id uuid,
 details jsonb,
 created_at timestamptz not null default now()
);

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.role_assignments where user_id=(select auth.uid()) and role='super_admin'); $$;

create or replace function public.is_active_resident()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.profiles where id=(select auth.uid()) and status='active'); $$;

alter table public.houses enable row level security;
alter table public.profiles enable row level security;
alter table public.registration_requests enable row level security;
alter table public.role_assignments enable row level security;
alter table public.audit_logs enable row level security;

create policy "houses readable by signed in" on public.houses for select to authenticated using (active=true or public.is_super_admin());
create policy "houses managed by admin" on public.houses for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy "profile own or admin" on public.profiles for select to authenticated using (id=(select auth.uid()) or public.is_super_admin());
-- No profile insert/update/delete policy: only trusted approval RPC manages profiles.
create policy "registration own or admin select" on public.registration_requests for select to authenticated using (user_id=(select auth.uid()) or public.is_super_admin());
create policy "registration insert own" on public.registration_requests for insert to authenticated with check (
 user_id=(select auth.uid()) and status='pending' and reviewed_at is null and reviewed_by is null
 and exists (select 1 from public.houses where id=house_id and active=true)
);
create policy "roles own or admin" on public.role_assignments for select to authenticated using (user_id=(select auth.uid()) or public.is_super_admin());
-- No direct role writes allowed.
create policy "audit admin read" on public.audit_logs for select to authenticated using (public.is_super_admin());

-- Serialized approval protects the 2-active-accounts-per-house rule under concurrency.
create or replace function public.review_registration(request_id uuid, approve boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare
 v_req public.registration_requests%rowtype;
 v_count integer;
 v_profile public.profiles%rowtype;
begin
 if not public.is_super_admin() then raise exception 'Not authorized'; end if;
 select * into v_req from public.registration_requests where id=request_id and status='pending' for update;
 if not found then raise exception 'Request not found or already processed'; end if;
 if v_req.user_id=(select auth.uid()) then raise exception 'Cannot review your own registration'; end if;
 if approve then
  perform 1 from public.houses where id=v_req.house_id and active=true for update;
  if not found then raise exception 'House inactive or missing'; end if;
  select count(*) into v_count from public.profiles where house_id=v_req.house_id and status='active';
  select * into v_profile from public.profiles where id=v_req.user_id for update;
  if found and v_profile.status='active' and v_profile.house_id<>v_req.house_id then
    raise exception 'Existing active membership requires separate transfer workflow';
  end if;
  if v_count >= 2 and not (v_profile.id is not null and v_profile.status='active' and v_profile.house_id=v_req.house_id) then
   raise exception 'House already has 2 active accounts';
  end if;
  insert into public.profiles(id,full_name,phone,house_id,resident_type,status)
  values(v_req.user_id,v_req.full_name,v_req.phone,v_req.house_id,v_req.resident_type,'active')
  on conflict(id) do update set full_name=excluded.full_name, phone=excluded.phone, house_id=excluded.house_id, resident_type=excluded.resident_type, status='active';
 end if;
 update public.registration_requests set status=case when approve then 'approved' else 'rejected' end,
  reviewed_at=now(), reviewed_by=(select auth.uid()) where id=request_id;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values ((select auth.uid()), case when approve then 'registration.approved' else 'registration.rejected' end,'registration_request',request_id,jsonb_build_object('house_id',v_req.house_id,'user_id',v_req.user_id));
end;
$$;
revoke all on function public.review_registration(uuid,boolean) from public;
grant execute on function public.review_registration(uuid,boolean) to authenticated;

-- Bootstrap first administrator using Supabase SQL Editor only, AFTER user signs up:
-- insert into public.role_assignments(user_id,role)
-- select id,'super_admin' from auth.users where email='ADMIN_EMAIL_HERE'
-- on conflict do nothing;
-- This initialization is intentionally not exposed to public API or the web app.
