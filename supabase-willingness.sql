-- ToastFlow — Member willingness registration (run once in Supabase SQL Editor).
-- No login, no contact details: members submit their name + the roles they're
-- willing to take for a meeting. Feeds the VPE's planning + role suggestions.
-- (Already applied to the club's project; kept here for the record / re-deploys.)

create table if not exists public.member_willingness (
  id uuid primary key default gen_random_uuid(),
  member_name text not null check (char_length(member_name) between 1 and 80),
  meeting_date date not null,
  willing_roles text[] not null default '{}',
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_name, meeting_date)
);

alter table public.member_willingness enable row level security;
revoke all on table public.member_willingness from anon, authenticated;
grant select (member_name, meeting_date, willing_roles, note, updated_at)
  on public.member_willingness to anon, authenticated;
drop policy if exists "Public can read member willingness" on public.member_willingness;
create policy "Public can read member willingness"
on public.member_willingness for select to anon, authenticated using (true);

-- Public-safe read: names + roles only (no contact info exists by design).
create or replace view public.public_willingness
with (security_invoker = true, security_barrier = true) as
select member_name, meeting_date, willing_roles, note, updated_at
from public.member_willingness;
revoke all on public.public_willingness from public;
grant select on public.public_willingness to anon, authenticated;

-- Register / update willingness (upsert by name + meeting).
create or replace function public.register_willingness(
  p_member_name text, p_meeting_date date, p_roles text[], p_note text default ''
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_meeting_date not in (
    date '2026-08-14',date '2026-09-11',date '2026-10-09',date '2026-11-13',date '2026-12-11',
    date '2027-01-08',date '2027-02-12',date '2027-03-12',date '2027-04-09',date '2027-05-14',date '2027-06-11'
  ) then
    raise exception 'Invalid meeting date' using errcode='22023';
  end if;
  insert into public.member_willingness(member_name, meeting_date, willing_roles, note, updated_at)
  values (trim(p_member_name), p_meeting_date, coalesce(p_roles,'{}'), coalesce(trim(p_note),''), now())
  on conflict (member_name, meeting_date)
  do update set willing_roles = excluded.willing_roles, note = excluded.note, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.register_willingness(text,date,text[],text) from public;
grant execute on function public.register_willingness(text,date,text[],text) to anon, authenticated;
