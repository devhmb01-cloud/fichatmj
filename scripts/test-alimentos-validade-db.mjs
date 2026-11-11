import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const staff = '00000000-0000-4000-8000-000000000111';
const viewer = '00000000-0000-4000-8000-000000000222';
const family = '00000000-0000-4000-8000-000000000333';
const u = n => '33333333-3333-4333-8333-' + String(n).padStart(12, '0');
const asUser = id => query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
try {
  await db.exec([
    'create role anon',
    'create role authenticated',
    'create schema auth',
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$",
    'create table public.profiles(id uuid primary key,role text not null)',
    'create table public.families(id uuid primary key,family_code text not null)',
    'grant usage on schema public to authenticated',
    'grant usage on schema auth to authenticated',
    'grant select on public.profiles to authenticated',
    'grant execute on function auth.uid() to authenticated',
  ].join('; ') + ';');
  await query('insert into public.profiles(id,role) values ($1,$2)', [staff,'staff']);
  await query('insert into public.profiles(id,role) values ($1,$2)', [viewer,'viewer']);
  await query('insert into public.families(id,family_code) values ($1,$2)', [family,'FAM-SIM-001']);
  await db.exec(await readFile('supabase/drafts/food_pantry.sql','utf8'));
  await asUser(staff);
  await query('select public.food_add_item($1,$2,1,$3::uuid)', ['Leite','caixa de 1L',u(1)]);
  const item = (await query("select id from public.food_items where name='Leite'"))[0].id;
  await query('select public.food_receive_stock($1::uuid,5,$2::uuid)', [item,u(2)]);
  await test('migração mantém estoque anterior sem inventar validade', async () => {
    await db.exec(await readFile('supabase/drafts/food_expiry_lots.sql','utf8'));
    const rows = await query('select remaining,origin,expires_on from public.food_lots where item_id=$1',[item]);
    assert.equal(rows.length,1);
    assert.equal(rows[0].remaining,5);
    assert.equal(rows[0].origin,'legacy');
    assert.equal(rows[0].expires_on,null);
  });
  await test('entrada datada atômica, idempotente e recusa produto vencido', async () => {
    await asUser(staff);
    const future = (await query("select (current_date+30)::text as d"))[0].d;
    let r = await query('select public.food_receive_lot($1::uuid,3,$2::date,$3::uuid) as r',[item,future,u(3)]);
    assert.equal(r[0].r.duplicate,false);
    r = await query('select public.food_receive_lot($1::uuid,3,$2::date,$3::uuid) as r',[item,future,u(3)]);
    assert.equal(r[0].r.duplicate,true);
    assert.equal((await query('select stock from public.food_items where id=$1',[item]))[0].stock,8);
    assert.equal((await query('select count(*)::int n from public.food_lots where item_id=$1',[item]))[0].n,2);
    const past = (await query("select (current_date-1)::text as d"))[0].d;
    await assert.rejects(()=>query('select public.food_receive_lot($1::uuid,1,$2::date,$3::uuid)',[item,past,u(4)]),/vencido|inválida/i);
  });
  await test('perda baixa o lote e saldo agregado uma vez', async () => {
    let r = await query('select public.food_record_loss($1::uuid,2,$2,$3::uuid) as r',[u(3),'damaged',u(5)]);
    assert.equal(r[0].r.duplicate,false);
    r = await query('select public.food_record_loss($1::uuid,2,$2,$3::uuid) as r',[u(3),'damaged',u(5)]);
    assert.equal(r[0].r.duplicate,true);
    assert.equal((await query('select stock from public.food_items where id=$1',[item]))[0].stock,6);
    assert.equal((await query('select remaining from public.food_lots where id=$1',[u(3)]))[0].remaining,1);
    await assert.rejects(()=>query('select public.food_record_loss($1::uuid,3,$2,$3::uuid)',[u(3),'damaged',u(6)]),/saldo do lote/);
  });
  await test('entrega usa validade mais próxima antes de lote desconhecido', async () => {
    const r = await query('select public.food_distribute($1::uuid,$2::uuid) as r',[family,u(7)]);
    assert.equal(r[0].r.duplicate,false);
    assert.equal((await query('select remaining from public.food_lots where id=$1',[u(3)]))[0].remaining,0);
    assert.equal((await query("select remaining from public.food_lots where origin='legacy' and item_id=$1",[item]))[0].remaining,5);
    assert.equal((await query('select stock from public.food_items where id=$1',[item]))[0].stock,5);
  });
  await test('alimento vencido nunca é distribuído; falha não causa débito parcial', async () => {
    const past = (await query("select (current_date-1)::text as d"))[0].d;
    const legacy = (await query("select id from public.food_lots where origin='legacy' and item_id=$1",[item]))[0].id;
    await query('update public.food_lots set expires_on=$1::date where id=$2::uuid',[past,legacy]);
    const fam2 = '00000000-0000-4000-8000-000000000444';
    await query('insert into public.families(id,family_code) values ($1,$2)',[fam2,'FAM-SIM-002']);
    await assert.rejects(()=>query('select public.food_distribute($1::uuid,$2::uuid)',[fam2,u(8)]),/válido insuficiente/i);
    assert.equal((await query('select stock from public.food_items where id=$1',[item]))[0].stock,5);
    assert.equal((await query('select count(*)::int n from public.food_distributions'))[0].n,1);
  });
  await test('viewer e anon não veem lotes nem podem registrar perda', async () => {
    await asUser(viewer);
    await assert.rejects(()=>query('select public.food_record_loss($1::uuid,1,$2,$3::uuid)',[u(3),'other',u(9)]),/não autorizado/i);
    await db.exec('set role authenticated');
    try {
      assert.equal((await query('select count(*)::int n from public.food_lots'))[0].n,0);
      await assert.rejects(()=>query('update public.food_lots set remaining=300'),/permission denied/i);
    } finally { await db.exec('reset role'); }
    await db.exec('set role anon');
    try { await assert.rejects(()=>query('select * from public.food_losses'),/permission denied/i); }
    finally { await db.exec('reset role'); }
  });
} finally { await db.close(); }
