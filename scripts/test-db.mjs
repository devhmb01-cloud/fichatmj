import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
await db.exec(
  readFileSync(
    new URL(
      "../supabase/migrations/20260916204009_initial_schema.sql",
      import.meta.url,
    ),
    "utf8",
  ).replace(/^\uFEFF/, ""),
);
const staff = "00000000-0000-4000-8000-000000000001",
  viewer = "00000000-0000-4000-8000-000000000002",
  outsider = "00000000-0000-4000-8000-000000000003";
await db.exec(`insert into auth.users values ('${staff}'),('${viewer}'),('${outsider}');
insert into public.profiles(id,full_name,role) values ('${staff}','TEST STAFF','staff'),('${viewer}','TEST VIEWER','viewer');`);
async function as(role, id, query) {
  await db.exec(`set role ${role}; set request.jwt.claim.sub = '${id}';`);
  try {
    return await db.query(query);
  } finally {
    await db.exec("reset role");
  }
}
async function denied(role, id, sql) {
  await assert.rejects(
    () => as(role, id, sql),
    /permission denied|row-level security/,
  );
}
await denied("anon", "", `select * from public.families`);
await denied("anon", "", `select * from public.children`);
await denied("anon", "", `select * from public.family_notes`);
const insert = `insert into public.families(responsible_name,responsible_birth_date,household_size) values ('TEST ONLY','2000-01-01',1) returning id`;
await denied("authenticated", outsider, insert);
await denied("authenticated", viewer, insert);
const family = (await as("authenticated", staff, insert)).rows[0].id;
await as(
  "authenticated",
  staff,
  `insert into public.children(family_id,name,birth_date) values ('${family}','TEST CHILD','2020-01-01')`,
);
assert.equal(
  (await as("authenticated", viewer, "select * from public.families")).rows
    .length,
  1,
);
assert.equal(
  (await as("authenticated", viewer, "select * from public.children")).rows
    .length,
  1,
);
assert.equal(
  (await as("authenticated", outsider, "select * from public.families")).rows
    .length,
  0,
);
assert.equal(
  (await as("authenticated", outsider, "select * from public.children")).rows
    .length,
  0,
);
assert.equal(
  (
    await as(
      "authenticated",
      viewer,
      `update public.families set status='inativa' returning id`,
    )
  ).rows.length,
  0,
);
await denied("authenticated", staff, `update public.profiles set role='admin'`);
await denied("authenticated", staff, `delete from public.families`);
await denied(
  "authenticated",
  staff,
  `insert into public.family_notes(family_id,author_id,content) values ('${family}','${viewer}','TEST')`,
);
await as(
  "authenticated",
  staff,
  `insert into public.family_notes(family_id,author_id,content) values ('${family}','${staff}','TEST')`,
);
assert.equal(
  (await as("authenticated", outsider, "select * from public.family_notes"))
    .rows.length,
  0,
);
await assert.rejects(
  () =>
    as(
      "authenticated",
      staff,
      `update public.families set working_people=2 where id='${family}'`,
    ),
  /check constraint/,
);
const before = (
  await db.query(`select updated_at from public.families where id='${family}'`)
).rows[0].updated_at;
await as(
  "authenticated",
  staff,
  `update public.families set status='inativa' where id='${family}'`,
);
const after = (
  await db.query(`select updated_at from public.families where id='${family}'`)
).rows[0].updated_at;
assert.ok(new Date(after) >= new Date(before));
await db.close();
console.log(
  "PASS: migration, anonymous denial, unprovisioned denial, team permissions, role escalation denial, note authorship, constraints and timestamps.",
);
