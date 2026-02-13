alter table if exists intake_answers
  add column if not exists beds numeric,
  add column if not exists baths numeric;
