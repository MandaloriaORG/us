-- ═══════════════════════════════════════════════════════════════════════════
-- 0023 — Council/admin & message-edit documented gaps (registry §2.12)
--
-- Forward-only closure of the DB-backed support the three §2.12 UI gaps need.
-- No existing column, enum or stable RPC signature is altered. Two of the three
-- gaps were already satisfied at the database layer by earlier migrations, so
-- this file only adds the one genuinely missing piece and documents the rest:
--
-- 1. Message edit-history viewer (gap 13). The read RPC `list_chat_message_edits`
--    already exists (0017) and is gated to the message author plus chat
--    moderators; the UI consumes it directly. No DB change needed here.
-- 2. Reaction-type Council UI (gap 14). `admin_upsert_reaction_type` and
--    `admin_set_reaction_type_active` already exist (0008), but the only public
--    listing — `list_reaction_types()` — returns *active* types only, so a
--    Council screen could never see an inactive type to re-activate it. This
--    file adds `admin_list_reaction_types()`, a Council-only listing that
--    returns every reaction type with its full state (`is_active`,
--    `affects_reputation`), gated on `admin.manage_settings`.
-- 3. Per-plaza posting permission field (gap 15). `admin_create_plaza` and
--    `admin_update_plaza` already accept `p_required_post_permission` (added in
--    0018). No DB change needed here; only the Council Plaza UI is missing.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Gap 14: Council-only reaction-type listing ──────────────────────────────

-- Every reaction type, active or not, with its full administrative state. Only
-- a Council member holding `admin.manage_settings` may read it; the RPC is
-- security definer so it can bypass the deny-by-default table grants, and the
-- permission is re-checked inside the function (the same contract the other
-- reaction admin RPCs use). The public `list_reaction_types()` is untouched and
-- still serves the pickers with active types only.
create or replace function public.admin_list_reaction_types()
returns table (
  key text,
  label text,
  emoji text,
  is_active boolean,
  affects_reputation boolean,
  sort_order integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
rows 100
as $$
begin
  perform private.require_permission('admin.manage_settings');

  return query
  select reactions.key,
         reactions.label,
         reactions.emoji,
         reactions.is_active,
         reactions.affects_reputation,
         reactions.sort_order,
         reactions.created_at
  from public.reactions
  order by reactions.sort_order, reactions.label;
end;
$$;

-- Deny by default, then open to authenticated callers only; the function itself
-- re-checks `admin.manage_settings`, so an authenticated user without the
-- permission gets a `42501` from the authority check, not the row content.
revoke all on function public.admin_list_reaction_types()
  from public, anon, authenticated;

grant execute on function public.admin_list_reaction_types() to authenticated;

-- ── Gap 15: clear a Plaza's posting-permission restriction ─────────────────

-- `admin_update_plaza` (0018) can *set* `required_post_permission` but, by a
-- deliberate guard, cannot clear it: a null/empty argument leaves the current
-- value alone so re-saving the same form never silently removes a restriction.
-- That leaves no path to lift a posting gate once set. This adds a forward-only
-- overload with an explicit `p_clear_post_permission` flag: when true the
-- column is set to NULL (no restriction) regardless of the other argument. The
-- original 8-argument signature is untouched and remains valid for any existing
-- caller; only the Council Plaza form calls this 9-argument overload.
create or replace function public.admin_update_plaza(
  p_plaza_id uuid,
  p_slug text,
  p_name text,
  p_description text,
  p_rules text,
  p_visibility public.plaza_visibility,
  p_sort_order integer,
  p_required_post_permission text default null,
  p_clear_post_permission boolean default false
)
returns table (plaza_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
  plaza_row public.plazas;
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
  clean_name text := btrim(coalesce(p_name, ''));
begin
  actor_id := private.require_permission('admin.manage_plazas');

  select * into plaza_row from public.plazas where plazas.id = p_plaza_id for update;

  if plaza_row.id is null then
    raise exception using errcode = 'P0002', message = 'plaza not found';
  end if;

  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(clean_slug) not between 2 and 48 then
    raise exception using errcode = '22023', message = 'slug must be a lowercase hyphenated identifier';
  end if;

  if char_length(clean_name) not between 2 and 80 then
    raise exception using errcode = '22023', message = 'name must contain between 2 and 80 characters';
  end if;

  if not p_clear_post_permission
     and p_required_post_permission is not null
     and not exists (
       select 1 from public.permissions where permissions.name = p_required_post_permission
     ) then
    raise exception using errcode = '22023', message = 'post permission does not exist';
  end if;

  update public.plazas
  set slug = clean_slug,
      name = clean_name,
      description = nullif(btrim(p_description), ''),
      rules = nullif(btrim(p_rules), ''),
      visibility = p_visibility,
      sort_order = coalesce(p_sort_order, plaza_row.sort_order),
      required_post_permission = case
        when p_clear_post_permission then null
        else coalesce(nullif(p_required_post_permission, ''), plaza_row.required_post_permission)
      end
  where plazas.id = plaza_row.id;

  perform private.write_audit_log(
    actor_id,
    'plaza.update',
    'plaza',
    plaza_row.id,
    null,
    jsonb_build_object(
      'slug', plaza_row.slug,
      'name', plaza_row.name,
      'visibility', plaza_row.visibility,
      'required_post_permission', plaza_row.required_post_permission
    ),
    jsonb_build_object(
      'slug', clean_slug,
      'name', clean_name,
      'visibility', p_visibility,
      'required_post_permission',
        case when p_clear_post_permission then null else p_required_post_permission end
    )
  );

  return query select plaza_row.id;
end;
$$;

revoke all on function public.admin_update_plaza(
  uuid, text, text, text, text, public.plaza_visibility, integer, text, boolean
) from public, anon, authenticated;

grant execute on function public.admin_update_plaza(
  uuid, text, text, text, text, public.plaza_visibility, integer, text, boolean
) to authenticated;
