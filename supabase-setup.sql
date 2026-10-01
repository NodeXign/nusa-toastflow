-- Run this once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  reservation_type text not null,
  member_name text not null check (char_length(member_name) between 1 and 80),
  contact text not null default '' check (char_length(contact) <= 160),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  confirmed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (meeting_date, reservation_type)
);

alter table public.reservations enable row level security;
revoke all on table public.reservations from anon, authenticated;
grant select (meeting_date, reservation_type, member_name, note, status, confirmed)
  on public.reservations to anon, authenticated;
drop policy if exists "Public can read confirmed reservation details" on public.reservations;
create policy "Public can read confirmed reservation details"
on public.reservations for select to anon, authenticated
using (status = 'confirmed');

-- Public-safe view: contact details and internal IDs are never exposed.
create or replace view public.public_reservations
with (security_invoker = true, security_barrier = true)
as
select meeting_date, reservation_type, member_name, note, status, confirmed
from public.reservations
where status = 'confirmed';

revoke all on public.public_reservations from public;
grant select on public.public_reservations to anon, authenticated;

create or replace function public.reserve_slot(
  p_meeting_date date,
  p_reservation_type text,
  p_member_name text,
  p_contact text,
  p_note text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_meeting_date not in (
    date '2026-08-14',date '2026-09-11',date '2026-10-09',date '2026-11-13',date '2026-12-11',
    date '2027-01-08',date '2027-02-12',date '2027-03-12',date '2027-04-09',date '2027-05-14',date '2027-06-11'
  ) then
    raise exception 'Invalid meeting date' using errcode='22023';
  end if;
  if p_reservation_type not in (
    'Prepared Speech 1','Prepared Speech 2','Prepared Speech 3','Prepared Speech 4',
    'Toastmaster of the Evening','Table Topics Master','General Evaluator',
    'Speech Evaluator 1','Speech Evaluator 2','Speech Evaluator 3','Speech Evaluator 4',
    'Timer','Ah-Counter','Language Evaluator','Sergeant at Arms'
  ) then
    raise exception 'Invalid reservation type' using errcode='22023';
  end if;
  insert into public.reservations(meeting_date,reservation_type,member_name,contact,note)
  values (p_meeting_date,p_reservation_type,trim(p_member_name),trim(p_contact),coalesce(trim(p_note),''));
  return jsonb_build_object('ok',true);
exception
  when unique_violation then
    raise exception 'Slot already reserved' using errcode='23505';
end;
$$;

revoke all on function public.reserve_slot(date,text,text,text,text) from public;
grant execute on function public.reserve_slot(date,text,text,text,text) to anon, authenticated;
