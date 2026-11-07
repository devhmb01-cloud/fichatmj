-- Draft only. Do NOT apply to the real ONG database without explicit release approval.
-- Bazar aggregate stock, audited movements, and atomic checkout.
-- Separate tables: does not change the family registration schema.
begin;

create table public.bazar_inventory (
  price_cents integer primary key
    check (price_cents in (200,500,800,1000,1200,1500,3000,6000)),
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now()
);

create table public.bazar_movements (
  id uuid primary key,
  kind text not null check (kind in ('entry','reprice')),
  from_price_cents integer references public.bazar_inventory(price_cents),
  to_price_cents integer references public.bazar_inventory(price_cents),
  quantity integer not null check (quantity between 1 and 10000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (
    (kind='entry' and from_price_cents is null and to_price_cents is not null)
    or (kind='reprice' and from_price_cents is not null
        and to_price_cents is not null and from_price_cents <> to_price_cents)
  )
);

create table public.bazar_sales (
  id uuid primary key,
  quantity integer not null check (quantity between 1 and 80000),
  amount_cents integer not null check (amount_cents > 0),
  lines jsonb not null check (jsonb_typeof(lines)='array'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index bazar_sales_created_at_idx on public.bazar_sales(created_at desc);

insert into public.bazar_inventory(price_cents,quantity) values
  (200,0),(500,0),(800,0),(1000,0),(1200,0),(1500,0),(3000,0),(6000,0);

alter table public.bazar_inventory enable row level security;
alter table public.bazar_movements enable row level security;
alter table public.bazar_sales enable row level security;

revoke all on public.bazar_inventory, public.bazar_movements, public.bazar_sales
  from public, anon, authenticated;
grant select on public.bazar_inventory, public.bazar_movements, public.bazar_sales
  to authenticated;

create policy bazar_inventory_read on public.bazar_inventory
for select to authenticated using (
  exists(select 1 from public.profiles
         where id = (select auth.uid()) and role in ('admin','staff','viewer'))
);
create policy bazar_movements_read on public.bazar_movements
for select to authenticated using (
  exists(select 1 from public.profiles
         where id = (select auth.uid()) and role in ('admin','staff','viewer'))
);
create policy bazar_sales_read on public.bazar_sales
for select to authenticated using (
  exists(select 1 from public.profiles
         where id = (select auth.uid()) and role in ('admin','staff','viewer'))
);

-- Every write requires an existing, approved staff/admin profile.
-- SECURITY DEFINER is restricted to these three audited functions;
-- the direct tables do not grant INSERT, UPDATE or DELETE to client roles.
create function public.bazar_add_stock(
  p_price_cents integer, p_quantity integer, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_stock integer;
begin
  if v_user is null or not exists (
    select 1 from public.profiles where id=v_user and role in ('admin','staff')
  ) then
    raise exception 'Acesso não autorizado ao bazar' using errcode='42501';
  end if;
  if p_request_id is null or p_quantity is null or p_quantity not between 1 and 10000 then
    raise exception 'Quantidade ou operação inválida' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  if exists(select 1 from public.bazar_movements where id=p_request_id) then
    return pg_catalog.jsonb_build_object('duplicate',true);
  end if;
  update public.bazar_inventory
    set quantity = quantity + p_quantity, updated_at = now()
    where price_cents = p_price_cents returning quantity into v_stock;
  if not found then
    raise exception 'Preço inválido' using errcode='22023';
  end if;
  insert into public.bazar_movements
    (id,kind,from_price_cents,to_price_cents,quantity,created_by)
    values (p_request_id,'entry',null,p_price_cents,p_quantity,v_user);
  return pg_catalog.jsonb_build_object('duplicate',false,'quantity',v_stock);
end;
$$;

create function public.bazar_reprice_stock(
  p_from_cents integer, p_to_cents integer,
  p_quantity integer, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_stock integer;
begin
  if v_user is null or not exists (
    select 1 from public.profiles where id=v_user and role in ('admin','staff')
  ) then
    raise exception 'Acesso não autorizado ao bazar' using errcode='42501';
  end if;
  if p_request_id is null or p_quantity is null or p_quantity not between 1 and 10000
     or p_from_cents is null or p_to_cents is null or p_from_cents=p_to_cents then
    raise exception 'Reprecificação inválida' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  if exists(select 1 from public.bazar_movements where id=p_request_id) then
    return pg_catalog.jsonb_build_object('duplicate',true);
  end if;
  perform 1 from public.bazar_inventory
    where price_cents in (p_from_cents,p_to_cents)
    order by price_cents for update;
  if not exists(select 1 from public.bazar_inventory where price_cents=p_from_cents)
     or not exists(select 1 from public.bazar_inventory where price_cents=p_to_cents) then
    raise exception 'Preço inválido' using errcode='22023';
  end if;
  update public.bazar_inventory
    set quantity = quantity-p_quantity, updated_at=now()
    where price_cents=p_from_cents and quantity>=p_quantity
    returning quantity into v_stock;
  if not found then
    raise exception 'Estoque insuficiente' using errcode='22023';
  end if;
  update public.bazar_inventory
    set quantity=quantity+p_quantity, updated_at=now()
    where price_cents=p_to_cents;
  insert into public.bazar_movements
    (id,kind,from_price_cents,to_price_cents,quantity,created_by)
    values (p_request_id,'reprice',p_from_cents,p_to_cents,p_quantity,v_user);
  return pg_catalog.jsonb_build_object('duplicate',false);
end;
$$;

create function public.bazar_checkout(
  p_lines jsonb, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_seen jsonb := '{}'::jsonb;
  v_price integer;
  v_quantity integer;
  v_total integer := 0;
  v_pieces integer := 0;
begin
  if v_user is null or not exists (
    select 1 from public.profiles where id=v_user and role in ('admin','staff')
  ) then
    raise exception 'Acesso não autorizado ao bazar' using errcode='42501';
  end if;
  if p_request_id is null or p_lines is null or pg_catalog.jsonb_typeof(p_lines)<>'array'
    or pg_catalog.jsonb_array_length(p_lines) not between 1 and 8 then
    raise exception 'Carrinho inválido' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
  if exists(select 1 from public.bazar_sales where id=p_request_id) then
    return pg_catalog.jsonb_build_object('duplicate',true);
  end if;
  for v_line in select value from pg_catalog.jsonb_array_elements(p_lines) loop
    if pg_catalog.jsonb_typeof(v_line)<>'object'
      or pg_catalog.jsonb_typeof(v_line->'price_cents')<>'number'
      or pg_catalog.jsonb_typeof(v_line->'quantity')<>'number' then
      raise exception 'Item inválido' using errcode='22023';
    end if;
    v_price := (v_line->>'price_cents')::integer;
    v_quantity := (v_line->>'quantity')::integer;
    if v_price not in (200,500,800,1000,1200,1500,3000,6000)
      or v_quantity not between 1 and 10000 or v_seen ? v_price::text then
      raise exception 'Preço, quantidade ou repetição inválida' using errcode='22023';
    end if;
    v_seen := v_seen || pg_catalog.jsonb_build_object(v_price::text,true);
    v_pieces := v_pieces+v_quantity;
    v_total := v_total+(v_price*v_quantity);
    v_lines := v_lines || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('price_cents',v_price,'quantity',v_quantity)
    );
  end loop;
  -- Lock in deterministic price order; a failure rolls the entire sale back.
  for v_line in select value from pg_catalog.jsonb_array_elements(v_lines)
    order by (value->>'price_cents')::integer loop
    v_price := (v_line->>'price_cents')::integer;
    v_quantity := (v_line->>'quantity')::integer;
    update public.bazar_inventory
      set quantity=quantity-v_quantity, updated_at=now()
      where price_cents=v_price and quantity>=v_quantity;
    if not found then
      raise exception 'Estoque insuficiente' using errcode='22023';
    end if;
  end loop;
  insert into public.bazar_sales
    (id,quantity,amount_cents,lines,created_by)
    values (p_request_id,v_pieces,v_total,v_lines,v_user);
  return pg_catalog.jsonb_build_object('duplicate',false,'amount_cents',v_total);
end;
$$;

revoke all on function public.bazar_add_stock(integer,integer,uuid) from public, anon, authenticated;
revoke all on function public.bazar_reprice_stock(integer,integer,integer,uuid) from public, anon, authenticated;
revoke all on function public.bazar_checkout(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.bazar_add_stock(integer,integer,uuid) to authenticated;
grant execute on function public.bazar_reprice_stock(integer,integer,integer,uuid) to authenticated;
grant execute on function public.bazar_checkout(jsonb,uuid) to authenticated;

commit;
