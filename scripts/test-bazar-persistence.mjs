import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migration = await readFile("supabase/drafts/bazar_persistence.sql", "utf8");
const writer = "00000000-0000-4000-8000-000000000111";
const viewer = "00000000-0000-4000-8000-000000000222";
const stranger = "00000000-0000-4000-8000-000000000333";
const uuid = n => "00000000-0000-4000-8000-" + String(n).padStart(12,"0");
const db = new PGlite();
const query = async(sql,params=[]) => (await db.query(sql,params)).rows;
const setUser = async id => query("select set_config('request.jwt.claim.sub',$1,false)",[id]);

try {
  await db.exec([
    "create role anon;",
    "create role authenticated;",
    "create schema auth;",
    "create function auth.uid() returns uuid language sql stable as $$",
    "  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid",
    "$$;",
    "create table public.profiles (id uuid primary key, role text not null);",
    "grant usage on schema public to authenticated;",
    "grant usage on schema auth to authenticated;",
    "grant execute on function auth.uid() to authenticated;"
  ].join("\n"));
  for(const [id,role] of [[writer,"staff"],[viewer,"viewer"],[stranger,"invalid"]]) {
    await query("insert into public.profiles(id,role) values ($1,$2)",[id,role]);
  }
  await db.exec(migration);
  const lookup = async price => Number((await query(
    "select quantity from public.bazar_inventory where price_cents=$1",[price]
  ))[0].quantity);

  await test("draft creates three isolated commercial tables",async()=>{
    const rows = await query("select tablename from pg_tables where schemaname='public' order by tablename");
    assert.deepEqual(rows.map(x=>x.tablename),[
      "bazar_inventory","bazar_movements","bazar_sales","profiles"
    ]);
  });
  await test("production inventory starts with zero pieces",async()=>{
    assert.equal((await query("select sum(quantity)::int as total from public.bazar_inventory"))[0].total,0);
  });
  await test("batch entry is idempotent",async()=>{
    await setUser(writer);
    await query("select public.bazar_add_stock(500,4,$1::uuid)",[uuid(1)]);
    const duplicate=await query("select public.bazar_add_stock(500,4,$1::uuid) as result",[uuid(1)]);
    assert.equal(duplicate[0].result.duplicate,true);
    assert.equal(await lookup(500),4);
  });
  await test("reprice transfers pieces; retry does not change totals",async()=>{
    await setUser(writer);
    await query("select public.bazar_reprice_stock(500,1000,2,$1::uuid)",[uuid(2)]);
    await query("select public.bazar_reprice_stock(500,1000,2,$1::uuid)",[uuid(2)]);
    assert.equal(await lookup(500),2);
    assert.equal(await lookup(1000),2);
    assert.equal((await query("select sum(quantity)::int total from public.bazar_inventory"))[0].total,4);
  });
  await test("checkout uses cents, is atomic and idempotent",async()=>{
    await setUser(writer);
    const cart=JSON.stringify([{price_cents:500,quantity:1},{price_cents:1000,quantity:1}]);
    const sale=await query("select public.bazar_checkout($1::jsonb,$2::uuid) as result",[cart,uuid(3)]);
    assert.equal(sale[0].result.amount_cents,1500);
    assert.equal(await lookup(500),1);
    assert.equal(await lookup(1000),1);
    const duplicate=await query("select public.bazar_checkout($1::jsonb,$2::uuid) as result",[cart,uuid(3)]);
    assert.equal(duplicate[0].result.duplicate,true);
    assert.equal((await query("select count(*)::int total from public.bazar_sales"))[0].total,1);
  });
  await test("overselling and invalid cart roll back every stock change",async()=>{
    await setUser(writer);
    const carts = [
      [{price_cents:500,quantity:99}],
      [{price_cents:500,quantity:1},{price_cents:500,quantity:1}],
      [{price_cents:500,quantity:1},{price_cents:1000,quantity:99}]
    ];
    for(let i=0;i<carts.length;i++) {
      await assert.rejects(()=>query("select public.bazar_checkout($1::jsonb,$2::uuid)",[
        JSON.stringify(carts[i]),uuid(10+i)
      ]));
    }
    assert.equal(await lookup(500),1);
    assert.equal(await lookup(1000),1);
    assert.equal((await query("select count(*)::int total from public.bazar_sales"))[0].total,1);
  });
  await test("viewer and non-team users cannot write",async()=>{
    for(const id of [viewer,stranger]){
      await setUser(id);
      await assert.rejects(()=>query("select public.bazar_add_stock(500,1,$1::uuid)",[uuid(20)]),/não autorizado|permission denied/i);
    }
    await setUser(writer);
    assert.equal(await lookup(500),1);
  });
  await test("anonymous role has no direct table or RPC access",async()=>{
    await setUser(writer);
    await db.exec("set role anon");
    try {
      await assert.rejects(()=>query("select * from public.bazar_inventory"),/permission denied/i);
      await assert.rejects(()=>query("select public.bazar_add_stock(500,1,$1::uuid)",[uuid(21)]),/permission denied/i);
    } finally {await db.exec("reset role");}
  });
  await test("authenticated role cannot insert stock directly",async()=>{
    await setUser(writer);
    await db.exec("set role authenticated");
    try {await assert.rejects(()=>query("insert into public.bazar_inventory values (999,1)"),/permission denied/i);}
    finally {await db.exec("reset role");}
  });
} finally {await db.close();}
