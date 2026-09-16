begin;
alter table public.families add column request_id uuid unique;
-- Preserve earlier records while enforcing dates on new writes.
alter table public.families add constraint families_birth_not_future check (responsible_birth_date <= current_date) not valid;
alter table public.families add constraint families_activation_not_future check (activation_date <= current_date) not valid;
alter table public.children add constraint children_birth_not_future check (birth_date <= current_date) not valid;

create function public.register_family(p_request_id uuid, p_family jsonb, p_children jsonb, p_note text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  result_id uuid;
  family public.families;
  child public.children;
  item jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and role in ('staff','admin')) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if p_request_id is null or p_family is null or jsonb_typeof(p_family) <> 'object' or p_children is null or jsonb_typeof(p_children) <> 'array' then
    raise exception 'Invalid registration payload' using errcode = '22023';
  end if;
  -- Serialize repeated requests, including concurrent retries after a network failure.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select id into result_id from public.families where request_id = p_request_id;
  if result_id is not null then return result_id; end if;
  family := jsonb_populate_record(null::public.families, p_family);
  if family.number_of_children is null or jsonb_array_length(p_children) <> family.number_of_children or jsonb_array_length(p_children) > 30 then
    raise exception 'Child count mismatch' using errcode = '22023';
  end if;
  insert into public.families(request_id, responsible_name, responsible_birth_date, phone, email, profession, address, city, cep, housing_type, housing_other, household_size, working_people, income_range, number_of_children, activation_date, status)
    values (p_request_id, family.responsible_name, family.responsible_birth_date, family.phone, family.email, family.profession, family.address, family.city, family.cep, family.housing_type, family.housing_other, family.household_size, family.working_people, family.income_range, family.number_of_children, family.activation_date, family.status) returning id into result_id;
  for item in select value from jsonb_array_elements(p_children) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'Invalid child' using errcode = '22023'; end if;
    child := jsonb_populate_record(null::public.children, item);
    insert into public.children(family_id, name, birth_date, has_special_needs, condition, cid, in_treatment, treatment_description, additional_information, clothing_size, shoe_size, uses_diaper, diaper_size, studies, school, school_grade, education_level)
      values(result_id, child.name, child.birth_date, child.has_special_needs, child.condition, child.cid, child.in_treatment, child.treatment_description, child.additional_information, child.clothing_size, child.shoe_size, child.uses_diaper, child.diaper_size, child.studies, child.school, child.school_grade, child.education_level);
  end loop;
  if nullif(trim(p_note), '') is not null then
    insert into public.family_notes(family_id, author_id, content) values (result_id, auth.uid(), trim(p_note));
  end if;
  return result_id;
end;
$$;
revoke all on function public.register_family(uuid,jsonb,jsonb,text) from public, anon;
grant execute on function public.register_family(uuid,jsonb,jsonb,text) to authenticated;
commit;
