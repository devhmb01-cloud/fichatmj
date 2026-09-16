-- Initial schema. Team access is explicitly provisioned by a database administrator.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check (length(trim(full_name)) between 1 and 200),
 role text not null default 'viewer' check (role in ('admin','staff','viewer')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.families (
 id uuid primary key default gen_random_uuid(),
 family_code text not null unique default ('TMJ-' || gen_random_uuid()::text),
 responsible_name text not null check (length(trim(responsible_name)) between 1 and 200),
 responsible_birth_date date not null,
 phone text, email text, profession text, address text, city text, cep text,
 housing_type text check (housing_type in ('aluguel','própria','invasão/ocupação','área de risco','outro')),
 housing_other text,
 household_size integer not null check (household_size between 1 and 100),
 working_people integer not null default 0 check (working_people between 0 and household_size),
 income_range text check (income_range in ('sem renda','até 1 salário mínimo','de 1 a 2 salários mínimos','de 2 a 3 salários mínimos','acima de 3 salários mínimos','não informado')),
 number_of_children integer not null default 0 check (number_of_children between 0 and 30),
 activation_date date,
 status text not null default 'em análise' check (status in ('ativa','inativa','em análise')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (housing_type is distinct from 'outro' or nullif(trim(housing_other),'') is not null),
 check (status <> 'ativa' or activation_date is not null),
 check (cep is null or cep ~ '^[0-9]{5}-?[0-9]{3}$')
);
create table public.children (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 name text not null check (length(trim(name)) between 1 and 200), birth_date date not null,
 has_special_needs boolean not null default false, condition text, cid text,
 in_treatment boolean not null default false, treatment_description text,
 additional_information text, clothing_size text, shoe_size text,
 uses_diaper boolean not null default false, diaper_size text,
 studies boolean not null default false, school text, school_grade text, education_level text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (not has_special_needs or nullif(trim(condition),'') is not null),
 check (not in_treatment or (has_special_needs and nullif(trim(treatment_description),'') is not null)),
 check (not uses_diaper or nullif(trim(diaper_size),'') is not null),
 check (not studies or nullif(trim(school),'') is not null)
);
create table public.family_notes (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 author_id uuid references public.profiles(id) on delete set null,
 content text not null check (length(trim(content)) between 1 and 5000),
 created_at timestamptz not null default now()
);
create index children_family_id_idx on public.children(family_id);
create index families_status_idx on public.families(status);
create index families_created_at_idx on public.families(created_at desc);
create index family_notes_family_created_idx on public.family_notes(family_id,created_at desc);
create index family_notes_author_idx on public.family_notes(author_id);
create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.created_at := old.created_at; new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger families_updated before update on public.families for each row execute function public.set_updated_at();
create trigger children_updated before update on public.children for each row execute function public.set_updated_at();
revoke all on function public.set_updated_at() from public;
-- Deny access until an administrator provisions a profile. No self-enrollment or role changes.
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.children enable row level security;
alter table public.family_notes enable row level security;
revoke all on public.profiles, public.families, public.children, public.family_notes from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.families, public.children to authenticated;
grant select, insert on public.family_notes to authenticated;
create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy families_read_team on public.families for select to authenticated using (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','staff','viewer')));
create policy families_insert_team on public.families for insert to authenticated with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','staff')));
create policy families_update_team on public.families for update to authenticated using (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','staff'))) with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','staff')));
create policy children_read_team on public.children for select to authenticated using (exists (select 1 from public.families where id = family_id));
create policy children_insert_team on public.children for insert to authenticated with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','staff')) and exists (select 1 from public.families where id = family_id));
create policy children_update_team on public.children for update to authenticated using (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','staff'))) with check (exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','staff')) and exists (select 1 from public.families where id = family_id));
create policy notes_read_team on public.family_notes for select to authenticated using (exists (select 1 from public.families where id = family_id));
create policy notes_insert_team on public.family_notes for insert to authenticated with check (author_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and role in ('admin','staff')) and exists (select 1 from public.families where id = family_id));
commit;
