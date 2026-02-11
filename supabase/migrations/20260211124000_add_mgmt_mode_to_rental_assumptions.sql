-- Add management mode to rental assumptions
alter table if exists rental_assumptions
  add column if not exists mgmt_mode text default 'self';

update rental_assumptions
set mgmt_mode = 'self'
where mgmt_mode is null;

alter table if exists rental_assumptions
  drop constraint if exists rental_assumptions_mgmt_mode_check;

alter table if exists rental_assumptions
  add constraint rental_assumptions_mgmt_mode_check
  check (mgmt_mode in ('self', 'third_party'));
