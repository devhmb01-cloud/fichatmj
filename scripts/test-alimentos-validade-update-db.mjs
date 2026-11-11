import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const q=async (sql,args=[]) => (await db.query(sql,args)).rows;
const staff='00000000-0000-4000-8000-000000000111';
const viewer='00000000-0000-4000-8000-000000000222';
const family='00000000-0000-4000-8000-000000000333';
const u=n=>'77777777-7777-4777-8777-'+String(n).padStart(12,'0');
const setUser=async id=>q("select set_config('request.jwt.claim.sub',$1,false)",[id]);
try {
 await db.exec([
   'create role anon', 'create role authenticated','create schema auth',
   "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$",
   'create table public.profiles(id uuid primary key,role text not null)',
   'create table public.families(id uuid primary key,family_code text not null)',
   'grant usage on schema public to authenticated',
   'grant usage on schema auth to authenticated',
   'grant select on public.profiles to authenticated',
   'grant execute on function auth.uid() to authenticated',
 ].join('; ')+';');
 await q('insert into public.profiles(id,role) values ($1,$2)',[staff,'staff']);
 await q('insert into public.profiles(id,role) values ($1,$2)',[viewer,'viewer']);
 await q('insert into public.families(id,family_code) values ($1,$2)',[family,'SIM-001']);
 await db.exec(await readFile('supabase/drafts/food_pantry.sql','utf8'));
 await setUser(staff);
 await q('select public.food_add_item($1,$2,1,$3::uuid)',['Arroz','pacote de 5kg',u(1)]);
 const item=(await q("select id from public.food_items where name='Arroz'"))[0].id;
 await q('select public.food_receive_stock($1::uuid,5,$2::uuid)',[item,u(2)]);
 await db.exec(await readFile('supabase/drafts/food_expiry_lots.sql','utf8'));
 await db.exec(await readFile('supabase/drafts/food_lot_expiry_update.sql','utf8'));
 const lot=(await q("select id from public.food_lots where item_id=$1 and origin='legacy'",[item]))[0].id;
 const oldStock=(await q('select stock from public.food_items where id=$1',[item]))[0].stock;
 await test('confirma validade histórica e preserva estoque e saldo do lote',async()=>{
   const yesterday=(await q("select (current_date-1)::text as d"))[0].d;
   let r=await q('select public.food_confirm_lot_expiry($1::uuid,$2::date,$3::uuid) as r',[lot,yesterday,u(3)]);
   assert.equal(r[0].r.duplicate,false);
   r=await q('select public.food_confirm_lot_expiry($1::uuid,$2::date,$3::uuid) as r',[lot,yesterday,u(3)]);
   assert.equal(r[0].r.duplicate,true);
   const row=(await q('select expires_on::text as expiry,remaining from public.food_lots where id=$1',[lot]))[0];
   assert.equal(row.expiry,yesterday);
   assert.equal(row.remaining,5);
   assert.equal((await q('select stock from public.food_items where id=$1',[item]))[0].stock,oldStock);
   assert.equal((await q('select count(*)::int n from public.food_lot_expiry_updates'))[0].n,1);
   assert.equal((await q('select previous_expires_on from public.food_lot_expiry_updates'))[0].previous_expires_on,null);
 });
 await test('bloqueia segunda alteração e tentativa de reaproveitar identificador',async()=>{
   const tomorrow=(await q("select (current_date+1)::text as d"))[0].d;
   await assert.rejects(()=>q('select public.food_confirm_lot_expiry($1::uuid,$2::date,$3::uuid)',[lot,tomorrow,u(4)]),/já possui validade/);
   await assert.rejects(()=>q('select public.food_confirm_lot_expiry($1::uuid,$2::date,$3::uuid)',[lot,tomorrow,u(3)]),/reutilizado/);
   await assert.rejects(()=>q('select public.food_confirm_lot_expiry($1::uuid,$2::date,$3::uuid)',[lot,'1999-01-01',u(5)]),/inválid/);
 });
 await test('validade retroativa vencida impede entrega, sem débito parcial',async()=>{
   await assert.rejects(()=>q('select public.food_distribute($1::uuid,$2::uuid)',[family,u(6)]),/válido insuficiente/);
   assert.equal((await q('select stock from public.food_items where id=$1',[item]))[0].stock,oldStock);
   assert.equal((await q('select count(*)::int n from public.food_distributions'))[0].n,0);
 });
 await test('visualizador e anônimo sem leitura ou alteração',async()=>{
   await setUser(viewer);
   await assert.rejects(()=>q('select public.food_confirm_lot_expiry($1::uuid,$2::date,$3::uuid)',[lot,'2027-03-01',u(7)]),/não autorizado/);
   await db.exec('set role authenticated');
   try{
     assert.equal((await q('select count(*)::int n from public.food_lot_expiry_updates'))[0].n,0);
     await assert.rejects(()=>q('update public.food_lot_expiry_updates set new_expires_on=current_date'),/permission denied/i);
   }finally{await db.exec('reset role');}
   await db.exec('set role anon');
   try{await assert.rejects(()=>q('select * from public.food_lot_expiry_updates'),/permission denied/i);}
   finally{await db.exec('reset role');}
 });
} finally{await db.close();}
