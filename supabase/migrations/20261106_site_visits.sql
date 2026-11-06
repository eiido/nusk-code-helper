begin;

create table if not exists public.site_visits (
  id integer primary key check (id = 1),
  total bigint not null default 0 check (total >= 0)
);

alter table public.site_visits enable row level security;
revoke all on table public.site_visits from public, anon, authenticated;
grant select, insert, update on table public.site_visits to service_role;

insert into public.site_visits(id) values (1) on conflict (id) do nothing;

create or replace function public.record_site_visit()
returns bigint language sql set search_path = public, pg_temp as $$
  update public.site_visits set total = total + 1 where id = 1 returning total;
$$;

revoke all on function public.record_site_visit() from public, anon, authenticated;
grant execute on function public.record_site_visit() to service_role;

commit;
