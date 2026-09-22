begin;
alter table public.families add column responsible_residence_status text not null default 'não informado' check (responsible_residence_status in ('não informado','mora na casa','não mora na casa','falecido'));
alter table public.children add column residence_status text not null default 'não informado' check (residence_status in ('não informado','mora na casa','não mora na casa','falecido'));
alter table public.families add column responsible_work_status text not null default 'não informado' check (responsible_work_status in ('não informado','trabalhando','desempregado','aposentado / pensionista','não se aplica'));
alter table public.children add column work_status text not null default 'não informado' check (work_status in ('não informado','trabalhando','desempregado','aposentado / pensionista','não se aplica'));
alter table public.families add column responsible_situation_notes text check (length(responsible_situation_notes) <= 5000);
alter table public.children add column situation_notes text check (length(situation_notes) <= 5000);
alter table public.children add column profession text check(length(profession)<=200);
alter table public.families add column responsible_health_notes text check(length(responsible_health_notes)<=5000);
alter table public.families add column responsible_treatment_notes text check(length(responsible_treatment_notes)<=5000);
alter table public.families add column responsible_education_notes text check(length(responsible_education_notes)<=5000);
create table public.family_members (
id uuid primary key default gen_random_uuid(),
family_id uuid not null references public.families(id) on delete cascade,
relationship text not null check(length(trim(relationship)) between 1 and 200),
residence_status text not null default 'não informado' check (residence_status in ('não informado','mora na casa','não mora na casa','falecido')),
work_status text not null default 'não informado' check (work_status in ('não informado','trabalhando','desempregado','aposentado / pensionista','não se aplica')),
situation_notes text check (length(situation_notes) <= 5000),
profession text check(length(profession)<=200),
created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
name text not null check (length(trim(name)) between 1 and 200),
birth_date date not null check (birth_date <= current_date),
has_special_needs boolean not null default false, condition text, cid text,
in_treatment boolean not null default false, treatment_description text,
additional_information text check(length(additional_information)<=5000), clothing_size text, shoe_size text,
uses_diaper boolean not null default false, diaper_size text,
studies boolean not null default false, school text, school_grade text, education_level text,
check (not has_special_needs or nullif(trim(condition),'') is not null),
check (not in_treatment or (has_special_needs and nullif(trim(treatment_description),'') is not null)),
check (not uses_diaper or nullif(trim(diaper_size),'') is not null),
check (not studies or nullif(trim(school),'') is not null)
);
create index family_members_family_id_idx on public.family_members(family_id);
create trigger family_members_updated before update on public.family_members for each row execute function public.set_updated_at();
alter table public.family_members enable row level security;
revoke all on public.family_members from anon, authenticated;
grant select, insert, update on public.family_members to authenticated;
create policy members_read_team on public.family_members for select to authenticated using (exists (select 1 from public.families where id = family_id));
create policy members_insert_team on public.family_members for insert to authenticated with check (exists (select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','staff')) and exists(select 1 from public.families where id=family_id));
create policy members_update_team on public.family_members for update to authenticated using (exists (select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','staff'))) with check (exists (select 1 from public.profiles where id=(select auth.uid()) and role in ('admin','staff')) and exists(select 1 from public.families where id=family_id));
-- Member writes also invalidate open family editors, including direct API writes.
create function public.touch_member_family() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  update public.families set updated_at = now() where id = new.family_id;
  if tg_op='UPDATE' and old.family_id is distinct from new.family_id then
    update public.families set updated_at = now() where id=old.family_id;
  end if;
  return new;
end; $$;
revoke all on function public.touch_member_family() from public, anon, authenticated;
create trigger children_touch_family after insert or update on public.children for each row execute function public.touch_member_family();
create trigger members_touch_family after insert or update on public.family_members for each row execute function public.touch_member_family();

create function public.edit_family(p_id uuid, p_updated_at timestamptz, p_family jsonb, p_children jsonb, p_members jsonb, p_note text default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  current_family public.families;
  f public.families;
  c public.children;
  m public.family_members;
  item jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','staff')) then
    raise exception 'Not authorized' using errcode='42501';
  end if;
  if p_family is null or jsonb_typeof(p_family)<>'object' or p_children is null or jsonb_typeof(p_children)<>'array' or p_members is null or jsonb_typeof(p_members)<>'array' then
    raise exception 'Invalid edit payload' using errcode='22023';
  end if;
  select * into current_family from public.families where id=p_id for update;
  if not found then raise exception 'Family not found' using errcode='P0002'; end if;
  if p_updated_at is null or current_family.updated_at is distinct from p_updated_at then
    raise exception 'Family changed; reload before editing' using errcode='40001';
  end if;
  f := jsonb_populate_record(null::public.families,p_family);
  if f.number_of_children is null or jsonb_array_length(p_children)<>f.number_of_children or jsonb_array_length(p_children)>30 or jsonb_array_length(p_members)>100 then
    raise exception 'Member count mismatch' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(p_children || p_members) e where jsonb_typeof(e)<>'object' or nullif(e->>'id','') is null) or
     (select count(*) from jsonb_array_elements(p_children || p_members)) <> (select count(distinct e->>'id') from jsonb_array_elements(p_children || p_members) e) then
    raise exception 'Invalid or duplicate member ID' using errcode='22023';
  end if;
  -- Omitting an existing member must never delete or silently hide their record.
  if exists(select 1 from public.children existing_child where existing_child.family_id=p_id and not exists(select 1 from jsonb_array_elements(p_children) e where (e->>'id')::uuid=existing_child.id)) or
     exists(select 1 from public.family_members existing_member where existing_member.family_id=p_id and not exists(select 1 from jsonb_array_elements(p_members) e where (e->>'id')::uuid=existing_member.id)) then
    raise exception 'Existing members must be retained' using errcode='22023';
  end if;
  update public.families set responsible_name=f.responsible_name, responsible_birth_date=f.responsible_birth_date, phone=f.phone, email=f.email, profession=f.profession, address=f.address, city=f.city, cep=f.cep, housing_type=f.housing_type, housing_other=f.housing_other, household_size=f.household_size, working_people=f.working_people, income_range=f.income_range, number_of_children=f.number_of_children, activation_date=f.activation_date, status=f.status, responsible_residence_status=f.responsible_residence_status, responsible_work_status=f.responsible_work_status, responsible_situation_notes=f.responsible_situation_notes, responsible_health_notes=f.responsible_health_notes, responsible_treatment_notes=f.responsible_treatment_notes, responsible_education_notes=f.responsible_education_notes where id=p_id;

  for item in select value from jsonb_array_elements(p_children) loop
    c := jsonb_populate_record(null::public.children,item);
    if exists(select 1 from public.children where id=c.id and family_id<>p_id) then
      raise exception 'Member belongs to another family' using errcode='22023';
    end if;
    if exists(select 1 from public.children where id=c.id and family_id=p_id) then
      update public.children set name=c.name, birth_date=c.birth_date, has_special_needs=c.has_special_needs, condition=c.condition, cid=c.cid, in_treatment=c.in_treatment, treatment_description=c.treatment_description, additional_information=c.additional_information, clothing_size=c.clothing_size, shoe_size=c.shoe_size, uses_diaper=c.uses_diaper, diaper_size=c.diaper_size, studies=c.studies, school=c.school, school_grade=c.school_grade, education_level=c.education_level, residence_status=c.residence_status, work_status=c.work_status, situation_notes=c.situation_notes, profession=c.profession where id=c.id and family_id=p_id;
    else
      insert into public.children(id,family_id,name,birth_date,has_special_needs,condition,cid,in_treatment,treatment_description,additional_information,clothing_size,shoe_size,uses_diaper,diaper_size,studies,school,school_grade,education_level,residence_status,work_status,situation_notes,profession) values(c.id,p_id,c.name,c.birth_date,c.has_special_needs,c.condition,c.cid,c.in_treatment,c.treatment_description,c.additional_information,c.clothing_size,c.shoe_size,c.uses_diaper,c.diaper_size,c.studies,c.school,c.school_grade,c.education_level,c.residence_status,c.work_status,c.situation_notes,c.profession);
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_members) loop
    m := jsonb_populate_record(null::public.family_members,item);
    if exists(select 1 from public.family_members where id=m.id and family_id<>p_id) then
      raise exception 'Member belongs to another family' using errcode='22023';
    end if;
    if exists(select 1 from public.family_members where id=m.id and family_id=p_id) then
      update public.family_members set name=m.name, birth_date=m.birth_date, has_special_needs=m.has_special_needs, condition=m.condition, cid=m.cid, in_treatment=m.in_treatment, treatment_description=m.treatment_description, additional_information=m.additional_information, clothing_size=m.clothing_size, shoe_size=m.shoe_size, uses_diaper=m.uses_diaper, diaper_size=m.diaper_size, studies=m.studies, school=m.school, school_grade=m.school_grade, education_level=m.education_level, residence_status=m.residence_status, work_status=m.work_status, situation_notes=m.situation_notes, profession=m.profession, relationship=m.relationship where id=m.id and family_id=p_id;
    else
      insert into public.family_members(id,family_id,name,birth_date,has_special_needs,condition,cid,in_treatment,treatment_description,additional_information,clothing_size,shoe_size,uses_diaper,diaper_size,studies,school,school_grade,education_level,residence_status,work_status,situation_notes,profession,relationship) values(m.id,p_id,m.name,m.birth_date,m.has_special_needs,m.condition,m.cid,m.in_treatment,m.treatment_description,m.additional_information,m.clothing_size,m.shoe_size,m.uses_diaper,m.diaper_size,m.studies,m.school,m.school_grade,m.education_level,m.residence_status,m.work_status,m.situation_notes,m.profession,m.relationship);
    end if;
  end loop;

  if nullif(trim(p_note),'') is not null then
    insert into public.family_notes(family_id,author_id,content) values(p_id,auth.uid(),trim(p_note));
  end if;
  return p_id;
end; $$;
revoke all on function public.edit_family(uuid,timestamptz,jsonb,jsonb,jsonb,text) from public, anon;
grant execute on function public.edit_family(uuid,timestamptz,jsonb,jsonb,jsonb,text) to authenticated;
commit;
