-- 0026: broaden the reactions catalog to a Discord-style emoji set.
-- The catalog ("reactions" table) is admin-manageable and every reaction is a
-- foreign key into it. The five creed reactions stay; this adds a common emoji
-- set so a reaction "+" popover can offer real variety. All reactions toggle
-- through the existing RPCs untouched — the contract is unchanged.

insert into public.reactions (key, label, emoji, affects_reputation, sort_order)
values
  ('thumbs-up', 'Thumbs up', '👍', true, 60),
  ('thumbs-down', 'Thumbs down', '👎', false, 70),
  ('heart', 'Heart', '❤️', true, 80),
  ('laugh', 'Laugh', '😂', false, 90),
  ('wow', 'Wow', '😮', false, 100),
  ('sad', 'Sad', '😢', false, 110),
  ('angry', 'Angry', '😡', false, 120),
  ('rocket', 'Rocket', '🚀', false, 130),
  ('fire', 'Fire', '🔥', true, 140),
  ('celebration', 'Celebration', '🎉', false, 150),
  ('eyes', 'Eyes', '👀', false, 160),
  ('brain', 'Brain', '🧠', true, 170),
  ('star', 'Star', '⭐', true, 180),
  ('clap', 'Clap', '👏', true, 190),
  ('pray', 'Pray', '🙏', false, 200),
  ('muscle', 'Muscle', '💪', false, 210),
  ('shield', 'Shield', '🛡️', false, 220),
  ('swords', 'Swords crossed', '⚔️', false, 230),
  ('thoughtful', 'Thoughtful', '🤔', false, 240),
  ('crying-laugh', 'Crying with laughter', '🤣', false, 250),
  ('partying', 'Partying', '🥳', false, 260),
  ('sunglasses', 'Cool', '😎', false, 270),
  ('love-heart', 'Beating heart', '💖', true, 280),
  ('zap', 'Lightning', '⚡', false, 290)
on conflict (key) do nothing;
