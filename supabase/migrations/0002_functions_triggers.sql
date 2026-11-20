-- R2M CONNECT — 0002: helper functions and triggers (non-destructive)

-- Authorization helpers used by RLS policies --------------------------------
create or replace function public.r2m_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role_key = 'main_admin' and active);
$$;

create or replace function public.r2m_can(p_module text, p_action text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.r2m_is_admin() or exists (
    select 1 from user_roles ur join roles r on r.key = ur.role_key
    where ur.user_id = auth.uid() and ur.active and r.key <> 'member'
      and ((r.permissions -> p_module) ? p_action or (r.permissions -> p_module) ? 'manage')
  );
$$;

-- Geographic / agent scope for member-related rows
create or replace function public.r2m_in_scope(p_district uuid, p_mandal uuid, p_agent uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.r2m_is_admin() or exists (
    select 1 from user_roles ur join roles r on r.key = ur.role_key
    where ur.user_id = auth.uid() and ur.active and r.key <> 'member'
      and (r.scope = 'global'
        or (r.scope = 'district' and ur.district_id = p_district)
        or (r.scope in ('mandal','agent') and ur.mandal_id = p_mandal)
        or (r.scope = 'agent' and p_agent = auth.uid()))
  );
$$;

create or replace function public.r2m_member_in_scope(p_member uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.id = p_member and public.r2m_in_scope(m.district_id, m.mandal_id, m.agent_id));
$$;

create or replace function public.r2m_my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid() limit 1;
$$;

-- Server-generated membership numbers --------------------------------------
create or replace function public.r2m_next_membership_no(p_prefix text default 'R2M') returns text
language sql security definer set search_path = public as $$
  select p_prefix || '-' || lpad(nextval('membership_seq')::text, 6, '0');
$$;

-- Members cannot change their own approval state or identity numbers ---------
create or replace function public.r2m_members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.r2m_can('members', 'approve') and not public.r2m_can('members', 'edit') then
    if new.status is distinct from old.status
       or new.membership_no is distinct from old.membership_no
       or new.approved_by is distinct from old.approved_by
       or new.valid_till is distinct from old.valid_till
       or new.valid_from is distinct from old.valid_from
       or new.agent_id is distinct from old.agent_id
       or new.directory_verified is distinct from old.directory_verified then
      raise exception 'Members cannot modify approval or membership fields';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists r2m_members_guard on members;
create trigger r2m_members_guard before update on members for each row execute function public.r2m_members_guard();

-- Payment transactions are immutable records: no deletes, no amount edits ----
create or replace function public.r2m_payments_immutable() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'payment_transactions rows cannot be deleted'; end if;
  if new.amount_paise is distinct from old.amount_paise or new.kind is distinct from old.kind
     or new.member_id is distinct from old.member_id then
    raise exception 'payment_transactions amount/kind/member are immutable';
  end if;
  if old.status = 'paid' and new.status not in ('paid','refunded') then
    raise exception 'A paid transaction can only move to refunded';
  end if;
  return new;
end $$;
drop trigger if exists r2m_payments_immutable on payment_transactions;
create trigger r2m_payments_immutable before update or delete on payment_transactions for each row execute function public.r2m_payments_immutable();

-- Stock movements are an append-only ledger ---------------------------------
create or replace function public.r2m_ledger_append_only() returns trigger
language plpgsql as $$ begin raise exception '% is append-only', tg_table_name; end $$;
drop trigger if exists r2m_stock_append_only on stock_movements;
create trigger r2m_stock_append_only before update or delete on stock_movements for each row execute function public.r2m_ledger_append_only();
drop trigger if exists r2m_audit_append_only on audit_logs;
create trigger r2m_audit_append_only before update or delete on audit_logs for each row execute function public.r2m_ledger_append_only();

-- Keep orders.updated_at fresh ------------------------------------------------
create or replace function public.r2m_touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists r2m_orders_touch on orders;
create trigger r2m_orders_touch before update on orders for each row execute function public.r2m_touch_updated_at();

-- Supabase Auth bridge: create a users row when an auth user is created -------
-- (Enable only if you move authentication from the built-in session auth to Supabase Auth.)
-- create or replace function public.r2m_handle_new_auth_user() returns trigger
-- language plpgsql security definer set search_path = public as $$
-- begin
--   insert into users (id, email, mobile, full_name, password_hash)
--   values (new.id, new.email, new.phone, coalesce(new.raw_user_meta_data->>'full_name', 'Member'), 'supabase-auth')
--   on conflict (id) do nothing;
--   insert into user_roles (user_id, role_key) values (new.id, 'member') on conflict do nothing;
--   return new;
-- end $$;
-- create trigger on_auth_user_created after insert on auth.users for each row execute function public.r2m_handle_new_auth_user();
