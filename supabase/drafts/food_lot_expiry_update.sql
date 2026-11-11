-- DRAFT only for isolated Devhmb staging / PGlite. Do not apply to NGO production.
-- Recover expiry information on existing lots without changing inventory totals.
begin;
create table public.food_lot_expiry_updates (
  id uuid primary key,
  lot_id uuid not null references public.food_lots(id),
  previous_expires_on date,
  new_expires_on date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (new_expires_on between date '2000-01-01' and date '2100-12-31')
);
create index food_lot_expiry_updates_lot_idx
  on public.food_lot_expiry_updates(lot_id,created_at desc);
alter table public.food_lot_expiry_updates enable row level security;
revoke all on public.food_lot_expiry_updates from public,anon,authenticated;
grant select on public.food_lot_expiry_updates to authenticated;
create policy food_expiry_updates_team_read on public.food_lot_expiry_updates
  for select to authenticated using (
    exists (select 1 from public.profiles
      where id=(select auth.uid()) and role in ('staff','admin'))
  );

-- SECURITY DEFINER necessary for audited atomic writes. Never grant writes on tables directly.
-- Function checks database-owned staff/admin role and validates request before any updates.
create function public.food_confirm_lot_expiry(
  p_lot_id uuid,p_expires_on date,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user uuid := (select auth.uid());
  v_old date;
  v_remaining integer;
  v_prior record;
begin
  if v_user is null or not exists (
    select 1 from public.profiles where id=v_user and role in ('staff','admin')
  ) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
  if p_lot_id is null or p_request_id is null or p_expires_on is null
    or p_expires_on not between date '2000-01-01' and date '2100-12-31'
  then raise exception 'Lote ou data inválidos' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  select lot_id,new_expires_on into v_prior
    from public.food_lot_expiry_updates where id=p_request_id;
  if found then
    if v_prior.lot_id<>p_lot_id or v_prior.new_expires_on<>p_expires_on
    then raise exception 'Identificador reutilizado com dados diferentes' using errcode='22023'; end if;
    return pg_catalog.jsonb_build_object('duplicate',true);
  end if;
  select expires_on,remaining into v_old,v_remaining
    from public.food_lots where id=p_lot_id for update;
  if not found or v_remaining=0
  then raise exception 'Lote inexistente ou sem saldo' using errcode='22023'; end if;
  if v_old is not null
  then raise exception 'Este lote já possui validade cadastrada' using errcode='22023'; end if;
  -- Historical dates are accepted: expired lots become non-distributable immediately.
  update public.food_lots set expires_on=p_expires_on where id=p_lot_id;
  insert into public.food_lot_expiry_updates
    (id,lot_id,previous_expires_on,new_expires_on,created_by)
  values (p_request_id,p_lot_id,v_old,p_expires_on,v_user);
  return pg_catalog.jsonb_build_object('duplicate',false);
end; $$;
revoke all on function public.food_confirm_lot_expiry(uuid,date,uuid)
  from public,anon,authenticated;
grant execute on function public.food_confirm_lot_expiry(uuid,date,uuid)
  to authenticated;
commit;
