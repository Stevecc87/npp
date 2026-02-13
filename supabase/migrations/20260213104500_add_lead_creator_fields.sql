alter table if exists leads
  add column if not exists created_by_user_id uuid,
  add column if not exists created_by_email text;
