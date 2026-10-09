-- Review Velocity / Local Authority data layer.
-- Service-role only: RLS is enabled and no browser-role policies are created.
begin;

create table if not exists public.tracked_places (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('self', 'competitor')),
  display_name text not null unique check (char_length(btrim(display_name)) between 1 and 120),
  google_place_id text unique check (
    google_place_id is null or (
      google_place_id = btrim(google_place_id)
      and char_length(google_place_id) between 1 and 255
    )
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracked_places_canonical_business_check check (
    (display_name = 'Hourglass Diamonds' and role = 'self')
    or (display_name in (
      'Donald Haack Diamonds',
      'Malak Jewelers',
      'Ballantyne Jewelers',
      'Diamonds Direct Charlotte'
    ) and role = 'competitor')
  )
);

create unique index if not exists tracked_places_single_self_idx
  on public.tracked_places(role) where role = 'self';

create table if not exists public.review_count_snapshots (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.tracked_places(id) on delete cascade,
  captured_on date not null,
  source text not null check (source in (
    'places-details',
    'local-falcon-competitor-report',
    'manual-bootstrap'
  )),
  source_ref text check (source_ref is null or char_length(source_ref) between 1 and 2048),
  rating numeric(2,1) check (rating is null or rating between 0 and 5),
  review_count integer not null check (review_count >= 0),
  created_at timestamptz not null default now(),
  unique (place_id, captured_on, source)
);

create index if not exists review_count_snapshots_place_date_idx
  on public.review_count_snapshots(place_id, captured_on desc);

create table if not exists public.own_google_reviews (
  review_name text primary key check (char_length(btrim(review_name)) between 1 and 512),
  place_id uuid not null references public.tracked_places(id) on delete cascade,
  published_at timestamptz not null,
  star_rating integer not null check (star_rating between 1 and 5),
  has_owner_reply boolean not null default false,
  reply_published_at timestamptz,
  ingested_at timestamptz not null default now(),
  constraint own_google_reviews_reply_shape_check check (
    (has_owner_reply and reply_published_at is not null)
    or (not has_owner_reply and reply_published_at is null)
  )
);

create index if not exists own_google_reviews_place_published_idx
  on public.own_google_reviews(place_id, published_at desc);

create or replace function public.enforce_own_google_reviews_self_place()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tracked_places
    where id = new.place_id
      and role = 'self'
      and display_name = 'Hourglass Diamonds'
  ) then
    raise exception 'own_google_reviews accepts only the tracked self place';
  end if;
  return new;
end;
$$;

drop trigger if exists own_google_reviews_self_place_guard on public.own_google_reviews;
create trigger own_google_reviews_self_place_guard
before insert or update of place_id on public.own_google_reviews
for each row execute function public.enforce_own_google_reviews_self_place();

revoke all on function public.enforce_own_google_reviews_self_place() from public, anon, authenticated;
grant execute on function public.enforce_own_google_reviews_self_place() to service_role;

alter table public.tracked_places enable row level security;
alter table public.review_count_snapshots enable row level security;
alter table public.own_google_reviews enable row level security;

revoke all on table public.tracked_places from public, anon, authenticated;
revoke all on table public.review_count_snapshots from public, anon, authenticated;
revoke all on table public.own_google_reviews from public, anon, authenticated;

grant select, insert, update, delete on table public.tracked_places to service_role;
grant select, insert, update, delete on table public.review_count_snapshots to service_role;
grant select, insert, update, delete on table public.own_google_reviews to service_role;

insert into public.tracked_places (role, display_name)
values
  ('self', 'Hourglass Diamonds'),
  ('competitor', 'Donald Haack Diamonds'),
  ('competitor', 'Malak Jewelers'),
  ('competitor', 'Ballantyne Jewelers'),
  ('competitor', 'Diamonds Direct Charlotte')
on conflict (display_name) do nothing;

commit;
