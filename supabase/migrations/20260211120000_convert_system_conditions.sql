-- Convert legacy system condition values to new tiers
update intake_answers
set
  electrical = case
    when electrical = 'ok' then 'serviceable'
    when electrical = 'needs_work' then 'outdated'
    else electrical
  end,
  plumbing = case
    when plumbing = 'ok' then 'serviceable'
    when plumbing = 'needs_work' then 'outdated'
    else plumbing
  end,
  foundation = case
    when foundation = 'ok' then 'serviceable'
    when foundation = 'needs_work' then 'outdated'
    else foundation
  end;
