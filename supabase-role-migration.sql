-- ToastFlow role update migration — preserves all existing reservation data.
begin;

update public.reservations
set reservation_type = case reservation_type
  when 'Toastmaster of the Day' then 'Toastmaster of the Evening'
  when 'Grammarian' then 'Language Evaluator'
  when 'Speech Evaluator' then 'Speech Evaluator 1'
  else reservation_type
end
where reservation_type in ('Toastmaster of the Day','Grammarian','Speech Evaluator');

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
    'Timer','Ah-Counter','Language Evaluator'
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

commit;
