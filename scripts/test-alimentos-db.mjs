import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const query = async (sql, params = []) => (await db.query(sql, params)).rows;
const setUser = async id => query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const staff='00000000-0000-4000-8000-000000000111';
const viewer='00000000-0000-4000-8000-000000000222';
const household='00000000-0000-4000-8000-000000000333';
const u=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const draft=await readFile('supabase/drafts/food_pantry.sql','utf8');
try {
  await db.exec(`create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    create table public.profiles(id uuid primary key,role text not null);
    create table public.families(id uuid primary key,family_code text not null);
    grant usage on schema public to authenticated;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);
  await query('insert into public.profiles(id,role) values ($1,$2)',[staff,'staff']);
  await query('insert into public.profiles(id,role) values ($1,$2)',[viewer,'viewer']);
  await query('insert into public.families(id,family_code) values ($1,$2)',[household,'SIM-001']);
  await db.exec(draft);
  const item = async name => (await query('select id,stock,per_basket from public.food_items where name=$1',[name]))[0];
  await test('schema isolado inclui tabelas e estoque inicial vazio',async()=>{
    const names=(await query("select tablename from pg_tables where schemaname='public' and tablename like 'food_%' order by tablename")).map(x=>x.tablename);
    assert.deepEqual(names,['food_distributions','food_items','food_settings','food_stock_entries','food_target_changes','food_template_changes']);
    assert.equal((await query('select count(*)::int n from public.food_items'))[0].n,0);
  });
  await test('cadastro e composição idempotentes',async()=>{
    await setUser(staff);
    let r=await query('select public.food_add_item($1,$2,$3,$4::uuid) r',['Arroz','pacote de 5 kg',1,u(1)]);
    assert.equal(r[0].r.duplicate,false);
    r=await query('select public.food_add_item($1,$2,$3,$4::uuid) r',['Arroz','pacote de 5 kg',1,u(1)]);
    assert.equal(r[0].r.duplicate,true);
    await query('select public.food_add_item($1,$2,$3,$4::uuid)',['Feijão','pacote de 1 kg',2,u(2)]);
    assert.equal((await query('select count(*)::int n from public.food_items'))[0].n,2);
  });
  await test('entrada com retry não duplica estoque',async()=>{
    await setUser(staff);
    const arroz=await item('Arroz'),feijao=await item('Feijão');
    await query('select public.food_receive_stock($1::uuid,20,$2::uuid)',[arroz.id,u(3)]);
    const r=await query('select public.food_receive_stock($1::uuid,20,$2::uuid) r',[arroz.id,u(3)]);
    assert.equal(r[0].r.duplicate,true);
    await query('select public.food_receive_stock($1::uuid,30,$2::uuid)',[feijao.id,u(4)]);
    assert.equal((await item('Arroz')).stock,20);
    assert.equal((await item('Feijão')).stock,30);
    assert.equal((await query('select count(*)::int n from public.food_stock_entries'))[0].n,2);
  });
  await test('alteração de cesta e meta guardam auditoria',async()=>{
    await setUser(staff);
    const arroz=await item('Arroz');
    await query('select public.food_update_basket($1::uuid,2,$2::uuid)',[arroz.id,u(5)]);
    const r=await query('select public.food_update_basket($1::uuid,2,$2::uuid) r',[arroz.id,u(5)]);
    assert.equal(r[0].r.duplicate,true);
    await query('select public.food_update_target(10,$1::uuid)',[u(6)]);
    assert.equal((await query('select monthly_families from public.food_settings'))[0].monthly_families,10);
    assert.equal((await query('select count(*)::int n from public.food_template_changes'))[0].n,1);
    assert.equal((await item('Arroz')).per_basket,2);
  });
  await test('entrega atômica com snapshot e sem duplo débito',async()=>{
    await setUser(staff);
    let r=await query('select public.food_distribute($1::uuid,$2::uuid) r',[household,u(7)]);
    assert.equal(r[0].r.duplicate,false);
    assert.equal(r[0].r.total_units,4);
    r=await query('select public.food_distribute($1::uuid,$2::uuid) r',[household,u(7)]);
    assert.equal(r[0].r.duplicate,true);
    assert.equal((await item('Arroz')).stock,18);
    assert.equal((await item('Feijão')).stock,28);
    const rows=await query('select lines,reference_month from public.food_distributions');
    assert.equal(rows.length,1);
    assert.equal(rows[0].lines.length,2);
    assert.equal(rows[0].lines.find(x=>x.name==='Arroz').quantity,2);
  });
  await test('bloqueio de segundo protocolo para a mesma família/mês',async()=>{
    await setUser(staff);
    await assert.rejects(()=>query('select public.food_distribute($1::uuid,$2::uuid)',[household,u(8)]),/já atendida|unique/i);
    assert.equal((await item('Arroz')).stock,18);
    assert.equal((await query('select count(*)::int n from public.food_distributions'))[0].n,1);
  });
  await test('viewer não registra entradas nem distribuições',async()=>{
    await setUser(viewer);
    const arroz=await item('Arroz');
    await assert.rejects(()=>query('select public.food_receive_stock($1::uuid,1,$2::uuid)',[arroz.id,u(9)]),/Acesso não autorizado|permission denied/i);
    await assert.rejects(()=>query('select public.food_distribute($1::uuid,$2::uuid)',[household,u(10)]),/Acesso não autorizado|permission denied/i);
  });
  await test('visitante anônimo não lê alimentos e não executa RPC',async()=>{
    await setUser(staff);
    await db.exec('set role anon');
    try {
      await assert.rejects(()=>query('select * from public.food_items'),/permission denied/i);
      await assert.rejects(()=>query('select public.food_distribute($1::uuid,$2::uuid)',[household,u(11)]),/permission denied/i);
    } finally { await db.exec('reset role'); }
  });
  await test('autenticado sem gravação direta',async()=>{
    await setUser(staff);
    await db.exec('set role authenticated');
    try { await assert.rejects(()=>query('update public.food_items set stock=999'),/permission denied/i); }
    finally { await db.exec('reset role'); }
  });
  await test('RLS restringe leitura ao staff/admin',async()=>{
    await setUser(viewer);
    await db.exec('set role authenticated');
    try { assert.equal((await query('select count(*)::int n from public.food_items'))[0].n,0); }
    finally { await db.exec('reset role'); }
    await setUser(staff);
    await db.exec('set role authenticated');
    try { assert.equal((await query('select count(*)::int n from public.food_items'))[0].n,2); }
    finally { await db.exec('reset role'); }
  });
} finally { await db.close(); }
