import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
const migrationDir = new URL("../supabase/migrations/", import.meta.url);
for (const name of readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort())
  await db.exec(
    readFileSync(new URL(name, migrationDir), "utf8").replace(/^\uFEFF/, ""),
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
    (error) => error.code === "42501",
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
const requestId = "00000000-0000-4000-8000-000000000010";
const familyPayload = {
  responsible_name: "TEST RPC",
  responsible_birth_date: "2000-01-01",
  household_size: 1,
  working_people: 0,
  number_of_children: 1,
  status: "em análise",
};
const childPayload = {
  name: "TEST CHILD",
  birth_date: "2020-01-01",
  has_special_needs: false,
  in_treatment: false,
  uses_diaper: false,
  studies: false,
};
const sqlLiteral = (value) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const rpc = (request, children = [childPayload], note = "TEST NOTE") =>
  `select public.register_family('${request}',${sqlLiteral(familyPayload)},${sqlLiteral(children)},'${note}') as id`;
await denied("anon", "", rpc(requestId));
await denied("authenticated", viewer, rpc(requestId));
await denied("authenticated", outsider, rpc(requestId));
const registered = (await as("authenticated", staff, rpc(requestId))).rows[0]
  .id;
assert.equal(
  (await as("authenticated", staff, rpc(requestId))).rows[0].id,
  registered,
);
assert.equal(
  (
    await db.query(
      `select * from public.children where family_id='${registered}'`,
    )
  ).rows.length,
  1,
);
assert.equal(
  (
    await db.query(
      `select * from public.family_notes where family_id='${registered}'`,
    )
  ).rows.length,
  1,
);
const rollbackId = "00000000-0000-4000-8000-000000000011";
await assert.rejects(
  () =>
    as(
      "authenticated",
      staff,
      rpc(rollbackId, [{ ...childPayload, name: "" }]),
    ),
  /check constraint/,
);
assert.equal(
  (
    await db.query(
      `select * from public.families where request_id='${rollbackId}'`,
    )
  ).rows.length,
  0,
);
await assert.rejects(
  () => as("authenticated", staff, rpc(rollbackId, [])),
  /Child count mismatch/,
);
await assert.rejects(
  () =>
    as(
      "authenticated",
      staff,
      rpc(rollbackId, [childPayload], "X".repeat(5001)),
    ),
  /check constraint/,
);
assert.equal(
  (
    await db.query(
      `select * from public.families where request_id='${rollbackId}'`,
    )
  ).rows.length,
  0,
);
console.log(
  "PASS: transactional registration, retry idempotency, child-count validation, rollback on invalid child/note and RPC access controls.",
);
// Editing is transactional, preserves identities and guards concurrent writers.
const editingFamily = {
  ...familyPayload,
  responsible_name: "EDITED MOTHER",
  household_size: 3,
  responsible_residence_status: "mora na casa",
  responsible_work_status: "trabalhando",
  responsible_situation_notes: "Started work",
  responsible_health_notes: "Follow-up",
  responsible_treatment_notes: "Treatment",
  responsible_education_notes: "Studying",
};
const childId = (
  await db.query(
    `select id from public.children where family_id='${registered}'`,
  )
).rows[0].id;
const existingChild = {
  ...childPayload,
  id: childId,
  profession: null,
  residence_status: "mora na casa",
  work_status: "não se aplica",
  situation_notes: "Changed school",
};
const otherMember = {
  ...existingChild,
  id: "00000000-0000-4000-8000-000000000020",
  name: "TEST FATHER",
  birth_date: "1990-01-01",
  relationship: "Pai",
};
const version = async () =>
  (
    await db.query(
      `select updated_at::text as version from public.families where id='${registered}'`,
    )
  ).rows[0].version;
const edit = (
  stamp,
  children = [existingChild],
  members = [otherMember],
  f = editingFamily,
  note = "EDIT NOTE",
) =>
  `select public.edit_family('${registered}','${stamp}',${sqlLiteral(f)},${sqlLiteral(children)},${sqlLiteral(members)},'${note}')`;
const originalVersion = await version();
await denied("anon", "", edit(originalVersion));
await denied("authenticated", viewer, edit(originalVersion));
await denied("authenticated", outsider, edit(originalVersion));
await as("authenticated", staff, edit(originalVersion));
assert.equal(
  (
    await db.query(
      `select responsible_name from public.families where id='${registered}'`,
    )
  ).rows[0].responsible_name,
  "EDITED MOTHER",
);
assert.equal(
  (
    await db.query(
      `select id from public.children where family_id='${registered}'`,
    )
  ).rows[0].id,
  childId,
);
assert.equal(
  (await as("authenticated", viewer, `select * from public.family_members`))
    .rows.length,
  1,
);
await denied("anon", "", "select * from public.family_members");
assert.equal(
  (await as("authenticated", outsider, "select * from public.family_members"))
    .rows.length,
  0,
);
assert.equal(
  (
    await as(
      "authenticated",
      viewer,
      "update public.family_members set name='BAD' returning id",
    )
  ).rows.length,
  0,
);
await denied("authenticated", staff, "delete from public.family_members");
await assert.rejects(
  () => as("authenticated", staff, edit(originalVersion)),
  /Family changed/,
);
const currentVersion = await version();
await assert.rejects(
  () =>
    as(
      "authenticated",
      staff,
      edit(currentVersion, [], [otherMember], {
        ...editingFamily,
        number_of_children: 0,
      }),
    ),
  /retained/,
);
await assert.rejects(
  () => as("authenticated", staff, edit(currentVersion, [existingChild], [])),
  /retained/,
);
await assert.rejects(
  () =>
    as(
      "authenticated",
      staff,
      edit(currentVersion, [existingChild, existingChild], [otherMember], {
        ...editingFamily,
        number_of_children: 2,
      }),
    ),
  /duplicate/,
);
await assert.rejects(
  () =>
    as(
      "authenticated",
      staff,
      edit(currentVersion, [existingChild], [{ ...otherMember, name: "" }], {
        ...editingFamily,
        responsible_name: "MUST ROLLBACK",
      }),
    ),
  /check constraint/,
);
assert.equal(await version(), currentVersion);
assert.equal(
  (
    await db.query(
      `select responsible_name from public.families where id='${registered}'`,
    )
  ).rows[0].responsible_name,
  "EDITED MOTHER",
);
// An ID from another family must not be moved or overwritten.
const foreignChild = (
  await db.query(`select id from public.children where family_id='${family}'`)
).rows[0].id;
await assert.rejects(
  () =>
    as(
      "authenticated",
      staff,
      edit(
        currentVersion,
        [existingChild, { ...existingChild, id: foreignChild }],
        [otherMember],
        { ...editingFamily, number_of_children: 2 },
      ),
    ),
  /another family/,
);
const newChild = {
  ...existingChild,
  id: "00000000-0000-4000-8000-000000000021",
  name: "NEW CHILD",
};
await as(
  "authenticated",
  staff,
  edit(
    currentVersion,
    [{ ...existingChild, residence_status: "não mora na casa" }, newChild],
    [{ ...otherMember, residence_status: "falecido" }],
    { ...editingFamily, number_of_children: 2 },
  ),
);
assert.equal(
  (
    await db.query(
      `select number_of_children from public.families where id='${registered}'`,
    )
  ).rows[0].number_of_children,
  2,
);
assert.equal(
  (
    await db.query(
      `select residence_status from public.family_members where id='${otherMember.id}'`,
    )
  ).rows[0].residence_status,
  "falecido",
);
const beforeDirectChange = await version();
await as(
  "authenticated",
  staff,
  `update public.children set school='Changed directly' where id='${childId}'`,
);
assert.notEqual(await version(), beforeDirectChange);
console.log(
  "PASS: family editing, mother changes, member addition/status, retained IDs, no omission, no cross-family moves, rollback, concurrency and RLS.",
);
await db.close();
console.log(
  "PASS: migration, anonymous denial, unprovisioned denial, team permissions, role escalation denial, note authorship, constraints and timestamps.",
);
