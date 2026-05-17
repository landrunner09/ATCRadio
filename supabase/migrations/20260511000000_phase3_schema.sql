-- Runs: one row per flight session
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  final_score integer,
  scenario_context jsonb not null
);

-- Attempts: one row per beat per flight
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.runs(id) on delete cascade not null,
  beat_id text not null,
  skill_tag text not null,
  result text not null check (result in ('pass','partial','fail','scaffold','say_again')),
  transcript text,
  asr_confidence real,
  missing_slots jsonb,
  created_at timestamptz not null default now()
);

-- Mastery: one row per (user, skill_tag), upserted by trigger
create table public.mastery (
  user_id uuid references auth.users(id) on delete cascade not null,
  skill_tag text not null,
  score real not null default 0,
  attempts_count integer not null default 0,
  last_updated timestamptz not null default now(),
  primary key (user_id, skill_tag)
);

-- Badges earned (schema only; unlock logic in Phase 4)
create table public.badges_earned (
  user_id uuid references auth.users(id) on delete cascade not null,
  badge_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- RLS
alter table public.runs enable row level security;
create policy "own runs" on public.runs
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.attempts enable row level security;
create policy "own attempts" on public.attempts
  using (run_id in (select id from public.runs where user_id = auth.uid()))
  with check (run_id in (select id from public.runs where user_id = auth.uid()));

alter table public.mastery enable row level security;
create policy "own mastery" on public.mastery
  using (user_id = auth.uid());

alter table public.badges_earned enable row level security;
create policy "own badges" on public.badges_earned
  using (user_id = auth.uid());

-- Mastery recalculation trigger
create or replace function recalculate_mastery()
returns trigger language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_score real;
  v_count integer;
begin
  select r.user_id into v_user_id
  from public.runs r where r.id = NEW.run_id;

  select
    sum(
      case when a.result = 'pass' then 1.0
           when a.result = 'partial' then 0.5
           else 0.0 end
      * exp(-0.1 * extract(epoch from (now() - a.created_at)) / 86400.0)
    ) /
    nullif(sum(
      exp(-0.1 * extract(epoch from (now() - a.created_at)) / 86400.0)
    ), 0),
    count(*)
  into v_score, v_count
  from (
    select a.result, a.created_at
    from public.attempts a
    join public.runs r on r.id = a.run_id
    where r.user_id = v_user_id and a.skill_tag = NEW.skill_tag
    order by a.created_at desc
    limit 20
  ) a;

  insert into public.mastery (user_id, skill_tag, score, attempts_count, last_updated)
  values (v_user_id, NEW.skill_tag, coalesce(v_score, 0), v_count, now())
  on conflict (user_id, skill_tag)
  do update set
    score = excluded.score,
    attempts_count = excluded.attempts_count,
    last_updated = excluded.last_updated;

  return NEW;
end;
$$;

create trigger after_attempt_insert
  after insert on public.attempts
  for each row execute function recalculate_mastery();
