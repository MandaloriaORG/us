-- 0027: free-emoji reactions (Discord-style).
-- The catalog is still curated (the five creed reactions and any admin-added
-- ones keep their keys and reputation rules), but a member may now react with
-- ANY unicode emoji: the toggle RPCs upsert an unknown key that looks like an
-- emoji (non-ASCII, e.g. "😎" or a ZWJ sequence) into the catalog on the fly
-- with affects_reputation=false, instead of failing with P0002. ASCII keys
-- that do not exist in the catalog still fail, so the "unknown reaction type
-- is rejected" contract stays intact.

-- 1. Relax the catalog key format: slugs stay allowed (they satisfy the old
--    regex), emoji keys become allowed too. Length widened for ZWJ sequences.
alter table public.reactions
  drop constraint reactions_key_format;
alter table public.reactions
  add constraint reactions_key_format
  check (char_length(key) between 1 and 64);

-- A free emoji used as its own label is a single code point, so widen the
-- label check from a minimum of 2 to 1 (upper bound unchanged).
alter table public.reactions
  drop constraint reactions_label_length;
alter table public.reactions
  add constraint reactions_label_length
  check (char_length(btrim(label)) between 1 and 40);

-- 2. Helper: return the catalog row for a key, upserting an emoji-looking key
--    on first use. Non-emoji (ASCII) unknown keys return null -> P0002.
create or replace function private.upsert_emoji_reaction(p_key text)
returns public.reactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.reactions;
begin
  select * into v_row
  from public.reactions
  where reactions.key = p_key;

  if v_row.id is not null then
    return v_row;
  end if;

  -- Emoji keys contain at least one non-ASCII character (the whole point of a
  -- free emoji reaction); slugs are pure ASCII and stay curated-only.
  if p_key !~ '^[ -~]+$' then
    insert into public.reactions (key, label, emoji, affects_reputation, sort_order)
    values (p_key, p_key, p_key, false, 990)
    on conflict (key) do nothing;

    select * into v_row
    from public.reactions
    where reactions.key = p_key;

    return v_row;
  end if;

  return null;
end;
$$;

-- 3. toggle_post_reaction: upsert before toggling.
create or replace function public.toggle_post_reaction(
  p_post_id uuid,
  p_reaction_key text
)
returns table (reaction_key text, total integer, caller_reacted boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  reaction_row public.reactions;
  removed boolean := false;
begin
  v_actor_id := private.require_permission('react.create');

  reaction_row := private.upsert_emoji_reaction(p_reaction_key);
  if reaction_row.id is null or not reaction_row.is_active then
    raise exception using errcode = 'P0002', message = 'reaction type not found';
  end if;

  if not private.post_accepts_engagement(p_post_id) then
    raise exception using errcode = 'P0002', message = 'post not found';
  end if;

  perform private.enforce_engagement_rate_limit(v_actor_id);

  delete from public.content_reactions
  where content_reactions.actor_id = v_actor_id
    and content_reactions.post_id = p_post_id
    and content_reactions.reaction_id = reaction_row.id;

  removed := found;

  if not removed then
    insert into public.content_reactions (reaction_id, actor_id, post_id)
    values (reaction_row.id, v_actor_id, p_post_id);
  end if;

  return query
    select
      reaction_row.key,
      (
        select count(*)::integer
        from public.content_reactions
        where content_reactions.post_id = p_post_id
          and content_reactions.reaction_id = reaction_row.id
      ),
      not removed;
end;
$$;

-- toggle_comment_reaction: same upsert treatment.
create or replace function public.toggle_comment_reaction(
  p_comment_id uuid,
  p_reaction_key text
)
returns table (reaction_key text, total integer, caller_reacted boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  reaction_row public.reactions;
  removed boolean := false;
begin
  v_actor_id := private.require_permission('react.create');

  reaction_row := private.upsert_emoji_reaction(p_reaction_key);
  if reaction_row.id is null or not reaction_row.is_active then
    raise exception using errcode = 'P0002', message = 'reaction type not found';
  end if;

  if not private.comment_accepts_engagement(p_comment_id) then
    raise exception using errcode = 'P0002', message = 'comment not found';
  end if;

  perform private.enforce_engagement_rate_limit(v_actor_id);

  delete from public.content_reactions
  where content_reactions.actor_id = v_actor_id
    and content_reactions.comment_id = p_comment_id
    and content_reactions.reaction_id = reaction_row.id;

  removed := found;

  if not removed then
    insert into public.content_reactions (reaction_id, actor_id, comment_id)
    values (reaction_row.id, v_actor_id, p_comment_id);
  end if;

  return query
    select
      reaction_row.key,
      (
        select count(*)::integer
        from public.content_reactions
        where content_reactions.comment_id = p_comment_id
          and content_reactions.reaction_id = reaction_row.id
      ),
      not removed;
end;
$$;

-- toggle_chat_reaction: same upsert treatment.
create or replace function public.toggle_chat_reaction(
  p_message_id uuid,
  p_reaction_key text
)
returns table (reaction_key text, total integer, caller_reacted boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_reaction public.reactions;
  v_message public.chat_messages;
  v_removed boolean := false;
begin
  v_actor_id := private.require_permission('chat.send');

  v_reaction := private.upsert_emoji_reaction(p_reaction_key);
  if v_reaction.id is null or not v_reaction.is_active then
    raise exception using errcode = 'P0002', message = 'reaction type not found';
  end if;

  select * into v_message from public.chat_messages where chat_messages.id = p_message_id;

  if v_message.id is null or not private.chat_message_is_visible_to_caller(v_message.id) then
    raise exception using errcode = 'P0002', message = 'message not found';
  end if;

  -- Reacting is a direct interaction with the author.
  if private.users_are_blocked(v_actor_id, v_message.author_id) then
    raise exception using errcode = '42501', message = 'cannot react to this message';
  end if;

  delete from public.chat_reactions
  where chat_reactions.actor_id = v_actor_id
    and chat_reactions.message_id = p_message_id
    and chat_reactions.reaction_id = v_reaction.id;

  v_removed := found;

  if not v_removed then
    insert into public.chat_reactions (reaction_id, message_id, actor_id)
    values (v_reaction.id, p_message_id, v_actor_id);
  end if;

  return query
  select
    v_reaction.key,
    (
      select count(*)::integer
      from public.chat_reactions
      where chat_reactions.message_id = p_message_id
        and chat_reactions.reaction_id = v_reaction.id
    ),
    not v_removed;
end;
$$;