alter table if exists intake_answers
  add column if not exists rehab_price_model_tier text;

update intake_answers
set rehab_price_model_tier = 'full_rehab_interior_cosmetics'
where rehab_price_model_tier is null;
