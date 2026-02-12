-- Replace rental management fields with rent fields
alter table if exists rental_assumptions
  add column if not exists current_rent numeric;

alter table if exists rental_assumptions
  add column if not exists market_rent numeric;

alter table if exists rental_assumptions
  drop constraint if exists rental_assumptions_mgmt_mode_check;

alter table if exists rental_assumptions
  drop column if exists mgmt_mode;

alter table if exists rental_assumptions
  drop column if exists mgmt_pct;
