-- DRAFT only for isolated staging/PGlite; never apply to ONG production without explicit approval.
begin;
create table public.food_lots (
 id uuid primary key,
 item_id uuid not null references public.food_items(id),
 remaining integer not null check (remaining between 0 and 10000000),
 expires_on date,
 origin text not null check(origin in ('legacy','donation')),
 created_by uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create index food_lots_fefo on public.food_lots(item_id,expires_on asc nulls last,created_at,id) where remaining>0;
-- Preserve old balances as unknown-validity lots, never invent expiry dates.
insert into public.food_lots(id,item_id,remaining,expires_on,origin,created_by)
select gen_random_uuid(),id,stock,null,'legacy',null from public.food_items where stock>0;
create table public.food_losses (
 id uuid primary key,
 item_id uuid not null references public.food_items(id),
 lot_id uuid not null references public.food_lots(id),
 quantity integer not null check(quantity between 1 and 10000),
 reason text not null check(reason in ('expired','damaged','unfit','other')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index food_losses_newest on public.food_losses(created_at desc);
alter table public.food_lots enable row level security;
alter table public.food_losses enable row level security;
revoke all on public.food_lots,public.food_losses from public,anon,authenticated;
grant select on public.food_lots,public.food_losses to authenticated;
create policy food_lots_team_read on public.food_lots for select to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')));
create policy food_losses_team_read on public.food_losses for select to authenticated
 using (exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('staff','admin')));

create function public.food_receive_lot(p_item_id uuid,p_quantity integer,p_expires_on date,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if v_user is null or not exists(select 1 from public.profiles where id=v_user and role in ('staff','admin'))
  then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if p_item_id is null or p_request_id is null or p_quantity is null or p_quantity not between 1 and 10000
  or (p_expires_on is not null and p_expires_on<v_today)
  then raise exception 'Entrada inválida ou alimento vencido' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
 if exists(select 1 from public.food_stock_entries where id=p_request_id)
  then return pg_catalog.jsonb_build_object('duplicate',true); end if;
 update public.food_items set stock=stock+p_quantity,updated_at=now()
  where id=p_item_id and stock+p_quantity<=10000000;
 if not found then raise exception 'Alimento inválido ou estoque excedido' using errcode='22023'; end if;
 insert into public.food_stock_entries(id,item_id,quantity,created_by)
 values(p_request_id,p_item_id,p_quantity,v_user);
 insert into public.food_lots(id,item_id,remaining,expires_on,origin,created_by)
 values(p_request_id,p_item_id,p_quantity,p_expires_on,'donation',v_user);
 return pg_catalog.jsonb_build_object('duplicate',false);
end; $$;

-- Preserve original RPC signature used by older clients.
create or replace function public.food_receive_stock(p_item_id uuid,p_quantity integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return public.food_receive_lot(p_item_id,p_quantity,null,p_request_id);
end; $$;

create function public.food_record_loss(p_lot_id uuid,p_quantity integer,p_reason text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_item uuid;
begin
 if v_user is null or not exists(select 1 from public.profiles where id=v_user and role in ('staff','admin'))
  then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if p_lot_id is null or p_request_id is null or p_quantity is null or p_quantity not between 1 and 10000
  or p_reason is null or p_reason not in ('expired','damaged','unfit','other')
  then raise exception 'Perda inválida' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
 if exists(select 1 from public.food_losses where id=p_request_id)
  then return pg_catalog.jsonb_build_object('duplicate',true); end if;
 select item_id into v_item from public.food_lots where id=p_lot_id;
 if not found then raise exception 'Lote inexistente' using errcode='22023'; end if;
 perform 1 from public.food_items where id=v_item for update;
 update public.food_lots set remaining=remaining-p_quantity
  where id=p_lot_id and remaining>=p_quantity;
 if not found then raise exception 'Quantidade maior que o saldo do lote' using errcode='22023'; end if;
 update public.food_items set stock=stock-p_quantity,updated_at=now()
  where id=v_item and stock>=p_quantity;
 if not found then raise exception 'Estoque inconsistente' using errcode='22023'; end if;
 insert into public.food_losses(id,item_id,lot_id,quantity,reason,created_by)
 values(p_request_id,v_item,p_lot_id,p_quantity,p_reason,v_user);
 return pg_catalog.jsonb_build_object('duplicate',false);
end; $$;

-- FEFO. Expired stock is never distributed even if aggregate stock includes it.
create or replace function public.food_distribute(p_family_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_user uuid := (select auth.uid());
 v_item record; v_lot record; v_take integer; v_missing integer;
 v_lines jsonb := '[]'::jsonb; v_total integer := 0;
 v_period date := pg_catalog.date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
 v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
 if v_user is null or not exists(select 1 from public.profiles where id=v_user and role in ('staff','admin'))
  then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if p_request_id is null or p_family_id is null
  then raise exception 'Família ou operação inválida' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_id::text));
 if exists(select 1 from public.food_distributions where id=p_request_id)
  then return pg_catalog.jsonb_build_object('duplicate',true); end if;
 if not exists(select 1 from public.families where id=p_family_id)
  then raise exception 'Família não cadastrada' using errcode='22023'; end if;
 if exists(select 1 from public.food_distributions where family_id=p_family_id and reference_month=v_period)
  then raise exception 'Família já atendida neste mês' using errcode='23505'; end if;
 for v_item in select id,name,unit,per_basket from public.food_items
   where per_basket>0 order by id for update loop
   v_missing := v_item.per_basket;
   for v_lot in select id,remaining from public.food_lots
     where item_id=v_item.id and remaining>0 and (expires_on is null or expires_on>=v_today)
     order by expires_on asc nulls last,created_at,id for update loop
     v_take := least(v_missing,v_lot.remaining);
     update public.food_lots set remaining=remaining-v_take where id=v_lot.id;
     v_missing := v_missing-v_take;
     exit when v_missing=0;
   end loop;
   if v_missing<>0 then raise exception 'Estoque válido insuficiente para cesta' using errcode='22023'; end if;
   update public.food_items set stock=stock-v_item.per_basket,updated_at=now()
     where id=v_item.id and stock>=v_item.per_basket;
   if not found then raise exception 'Estoque inconsistente' using errcode='22023'; end if;
   v_lines := v_lines || pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_build_object('itemId',v_item.id,'name',v_item.name,'unit',v_item.unit,'quantity',v_item.per_basket)
   );
   v_total := v_total + v_item.per_basket;
 end loop;
 if v_total=0 then raise exception 'A cesta padrão está vazia' using errcode='22023'; end if;
 insert into public.food_distributions(id,family_id,reference_month,lines,total_units,created_by)
 values(p_request_id,p_family_id,v_period,v_lines,v_total,v_user);
 return pg_catalog.jsonb_build_object('duplicate',false,'total_units',v_total);
end; $$;
revoke all on function public.food_receive_lot(uuid,integer,date,uuid) from public,anon,authenticated;
revoke all on function public.food_receive_stock(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.food_record_loss(uuid,integer,text,uuid) from public,anon,authenticated;
revoke all on function public.food_distribute(uuid,uuid) from public,anon,authenticated;
grant execute on function public.food_receive_lot(uuid,integer,date,uuid) to authenticated;
grant execute on function public.food_receive_stock(uuid,integer,uuid) to authenticated;
grant execute on function public.food_record_loss(uuid,integer,text,uuid) to authenticated;
grant execute on function public.food_distribute(uuid,uuid) to authenticated;
commit;
