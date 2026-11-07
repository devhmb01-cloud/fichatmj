-- DRAFT for isolated staging / local tests only. NEVER apply to NGO production without approval.
-- Does not alter existing beneficiary tables; only references public.families(id).
begin;
create table public.food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  unit text not null check (length(btrim(unit)) between 2 and 60),
  stock integer not null default 0 check (stock between 0 and 10000000),
  per_basket integer not null default 0 check (per_basket between 0 and 100),
  updated_at timestamptz not null default now()
);
create unique index food_items_unique_name_package on public.food_items (lower(name),lower(unit));
create table public.food_stock_entries (
  id uuid primary key,
  item_id uuid not null references public.food_items(id),
  quantity integer not null check (quantity between 1 and 10000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.food_template_changes (
  id uuid primary key,
  item_id uuid not null references public.food_items(id),
  before_qty integer not null,
  after_qty integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.food_settings (
  id smallint primary key check (id = 1),
  monthly_families integer not null check (monthly_families between 1 and 10000),
  updated_at timestamptz not null default now()
);
insert into public.food_settings (id,monthly_families) values (1,1);
create table public.food_target_changes (
  id uuid primary key,
  before_target integer not null,
  after_target integer not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.food_distributions (
  id uuid primary key,
  family_id uuid not null references public.families(id),
  reference_month date not null,
  lines jsonb not null check (jsonb_typeof(lines)='array' and jsonb_array_length(lines)>0),
  total_units integer not null check (total_units>0),
  created_by uuid not null references public.profiles(id),
  delivered_at timestamptz not null default now(),
  unique (family_id,reference_month)
);
create index food_distributions_delivered_at_idx on public.food_distributions(delivered_at desc);
create index food_distributions_family_idx on public.food_distributions(family_id,delivered_at desc);

alter table public.food_items enable row level security;
alter table public.food_stock_entries enable row level security;
alter table public.food_template_changes enable row level security;
alter table public.food_settings enable row level security;
alter table public.food_target_changes enable row level security;
alter table public.food_distributions enable row level security;
revoke all on public.food_items,public.food_stock_entries,public.food_template_changes,
  public.food_settings,public.food_target_changes,public.food_distributions from public,anon,authenticated;
grant select on public.food_items,public.food_stock_entries,public.food_template_changes,
  public.food_settings,public.food_target_changes,public.food_distributions to authenticated;
create policy food_items_team_read on public.food_items for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')));
create policy food_entries_team_read on public.food_stock_entries for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')));
create policy food_changes_team_read on public.food_template_changes for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')));
create policy food_settings_team_read on public.food_settings for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')));
create policy food_target_changes_team_read on public.food_target_changes for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')));
create policy food_distributions_team_read on public.food_distributions for select to authenticated
  using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')));

-- SECURITY DEFINER needed for atomic audited multi-table updates; each RPC checks auth.uid()
-- and staff/admin from database-owned profiles; direct client writes stay revoked.
create function public.food_add_item(p_name text,p_unit text,p_per_basket integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null or not exists(select 1 from public.profiles where id=v_user and role in ('staff','admin'))
    then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
  if p_request_id is null or p_name is null or p_unit is null or p_per_basket is null
    or length(btrim(p_name)) not between 2 and 100 or length(btrim(p_unit)) not between 2 and 60
    or p_per_basket not between 0 and 100
    then raise exception 'Cadastro inválido' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  if exists(select 1 from public.food_items where id=p_request_id)
    then return pg_catalog.jsonb_build_object('duplicate',true); end if;
  insert into public.food_items(id,name,unit,per_basket)
    values(p_request_id,btrim(p_name),btrim(p_unit),p_per_basket);
  return pg_catalog.jsonb_build_object('duplicate',false);
end; $$;

create function public.food_receive_stock(p_item_id uuid,p_quantity integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null or not exists(select 1 from public.profiles where id=v_user and role in ('staff','admin'))
    then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
  if p_request_id is null or p_item_id is null or p_quantity is null or p_quantity not between 1 and 10000
    then raise exception 'Entrada inválida' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  if exists(select 1 from public.food_stock_entries where id=p_request_id)
    then return pg_catalog.jsonb_build_object('duplicate',true); end if;
  update public.food_items set stock=stock+p_quantity,updated_at=now()
    where id=p_item_id and stock+p_quantity<=10000000;
  if not found then raise exception 'Alimento inválido ou limite de estoque excedido' using errcode='22023'; end if;
  insert into public.food_stock_entries(id,item_id,quantity,created_by)
    values(p_request_id,p_item_id,p_quantity,v_user);
  return pg_catalog.jsonb_build_object('duplicate',false);
end; $$;

create function public.food_update_basket(p_item_id uuid,p_per_basket integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_before integer;
begin
  if v_user is null or not exists(select 1 from public.profiles where id=v_user and role in ('staff','admin'))
    then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
  if p_request_id is null or p_item_id is null or p_per_basket is null or p_per_basket not between 0 and 100
    then raise exception 'Quantidade inválida' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  if exists(select 1 from public.food_template_changes where id=p_request_id)
    then return pg_catalog.jsonb_build_object('duplicate',true); end if;
  select per_basket into v_before from public.food_items where id=p_item_id for update;
  if not found then raise exception 'Alimento inválido' using errcode='22023'; end if;
  update public.food_items set per_basket=p_per_basket,updated_at=now() where id=p_item_id;
  insert into public.food_template_changes(id,item_id,before_qty,after_qty,created_by)
    values(p_request_id,p_item_id,v_before,p_per_basket,v_user);
  return pg_catalog.jsonb_build_object('duplicate',false);
end; $$;

create function public.food_update_target(p_monthly_families integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_before integer;
begin
  if v_user is null or not exists(select 1 from public.profiles where id=v_user and role in ('staff','admin'))
    then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
  if p_request_id is null or p_monthly_families is null or p_monthly_families not between 1 and 10000
    then raise exception 'Meta inválida' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  if exists(select 1 from public.food_target_changes where id=p_request_id)
    then return pg_catalog.jsonb_build_object('duplicate',true); end if;
  select monthly_families into v_before from public.food_settings where id=1 for update;
  if not found then raise exception 'Configuração inexistente' using errcode='22023'; end if;
  update public.food_settings set monthly_families=p_monthly_families,updated_at=now() where id=1;
  insert into public.food_target_changes(id,before_target,after_target,created_by)
    values(p_request_id,v_before,p_monthly_families,v_user);
  return pg_catalog.jsonb_build_object('duplicate',false);
end; $$;

create function public.food_distribute(p_family_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := (select auth.uid());
  v_item record;
  v_lines jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_period date := pg_catalog.date_trunc('month', now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user is null or not exists(select 1 from public.profiles where id=v_user and role in ('staff','admin'))
    then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
  if p_request_id is null or p_family_id is null then
    raise exception 'Família ou operação inválida' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  if exists(select 1 from public.food_distributions where id=p_request_id)
    then return pg_catalog.jsonb_build_object('duplicate',true); end if;
  if not exists(select 1 from public.families where id=p_family_id)
    then raise exception 'Família não cadastrada' using errcode='22023'; end if;
  -- Different request IDs for the same household/month are forbidden too.
  if exists(select 1 from public.food_distributions where family_id=p_family_id and reference_month=v_period)
    then raise exception 'Família já atendida neste mês' using errcode='23505'; end if;
  -- Stable row lock order: rollback of any failed item rolls back the entire basket.
  for v_item in select id,name,unit,per_basket from public.food_items
    where per_basket>0 order by id for update loop
    update public.food_items set stock=stock-v_item.per_basket,updated_at=now()
      where id=v_item.id and stock>=v_item.per_basket;
    if not found then raise exception 'Estoque insuficiente para cesta' using errcode='22023'; end if;
    v_lines := v_lines || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('itemId',v_item.id,'name',v_item.name,'unit',v_item.unit,'quantity',v_item.per_basket)
    );
    v_total := v_total+v_item.per_basket;
  end loop;
  if v_total=0 then raise exception 'A cesta padrão está vazia' using errcode='22023'; end if;
  insert into public.food_distributions(id,family_id,reference_month,lines,total_units,created_by)
    values(p_request_id,p_family_id,v_period,v_lines,v_total,v_user);
  return pg_catalog.jsonb_build_object('duplicate',false,'total_units',v_total);
end; $$;

revoke all on function public.food_add_item(text,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.food_receive_stock(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.food_update_basket(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.food_update_target(integer,uuid) from public,anon,authenticated;
revoke all on function public.food_distribute(uuid,uuid) from public,anon,authenticated;
grant execute on function public.food_add_item(text,text,integer,uuid) to authenticated;
grant execute on function public.food_receive_stock(uuid,integer,uuid) to authenticated;
grant execute on function public.food_update_basket(uuid,integer,uuid) to authenticated;
grant execute on function public.food_update_target(integer,uuid) to authenticated;
grant execute on function public.food_distribute(uuid,uuid) to authenticated;
commit;
