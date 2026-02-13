alter table if exists intake_answers
  add column if not exists square_feet int,
  add column if not exists kitchen_condition text,
  add column if not exists bathrooms_condition text,
  add column if not exists roof_condition text,
  add column if not exists mechanicals_condition text,
  add column if not exists full_baths int,
  add column if not exists half_baths int;