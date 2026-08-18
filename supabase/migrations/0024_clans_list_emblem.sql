-- 0024: expose clan emblem path on the list endpoint.
-- The list view (Clans & Casas) only showed the initial letter because
-- list_clans() did not return emblem_path; get_clan() (detail) did, so the
-- photo only appeared once inside the clan. This surfaces emblem_path on the
-- list so the frontend can resolve a signed storage URL, same pattern used by
-- the detail route. Applies on top of 0016 (which owns list_clans).

-- create or replace cannot change the OUT-param row type, so drop then create.
drop function if exists public.list_clans();

create or replace function public.list_clans()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  emblem_path text,
  privacy public.clan_privacy,
  mission text,
  leader_id uuid,
  leader_display_name text,
  member_count integer,
  caller_is_member boolean,
  caller_role public.clan_member_role
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  return query
  select
    clans.id,
    clans.slug,
    clans.name,
    clans.description,
    clans.emblem_path,
    clans.privacy,
    clans.mission,
    clans.leader_id,
    leader.display_name,
    clans.member_count,
    exists (
      select 1
      from public.clan_members
      where clan_members.clan_id = clans.id
        and clan_members.member_id = v_actor_id
        and clan_members.status = 'active'
    ),
    (
      select clan_members.role
      from public.clan_members
      where clan_members.clan_id = clans.id
        and clan_members.member_id = v_actor_id
        and clan_members.status = 'active'
      limit 1
    )
  from public.clans
  left join public.profiles leader on leader.id = clans.leader_id
  where private.clan_is_visible_to_caller(clans.id)
  order by clans.name;
end;
$$;

-- Re-grant after the drop (revoked by DROP FUNCTION).
grant execute on function public.list_clans() to anon, authenticated;
