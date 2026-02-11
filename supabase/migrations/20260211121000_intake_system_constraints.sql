-- Normalize legacy system values before applying constraints
update intake_answers
set
  electrical = case
    when electrical = 'modern' then 'new'
    when electrical = 'ok' then 'serviceable'
    when electrical = 'needs_work' then 'outdated'
    else electrical
  end,
  plumbing = case
    when plumbing = 'modern' then 'new'
    when plumbing = 'ok' then 'serviceable'
    when plumbing = 'needs_work' then 'outdated'
    else plumbing
  end,
  foundation = case
    when foundation = 'ok' then 'solid'
    when foundation = 'needs_work' then 'minor'
    when foundation = 'serviceable' then 'solid'
    when foundation = 'outdated' then 'minor'
    else foundation
  end;

alter table intake_answers
  drop constraint if exists intake_answers_electrical_check,
  drop constraint if exists intake_answers_plumbing_check,
  drop constraint if exists intake_answers_foundation_check;

alter table intake_answers
  add constraint intake_answers_electrical_check
    check (electrical in ('new', 'serviceable', 'outdated', 'major')),
  add constraint intake_answers_plumbing_check
    check (plumbing in ('new', 'serviceable', 'outdated', 'major')),
  add constraint intake_answers_foundation_check
    check (foundation in ('solid', 'minor', 'structural', 'major'));
