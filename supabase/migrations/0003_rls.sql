-- R2M CONNECT — 0003: Row Level Security (non-destructive)
-- Server code (Next.js Server Actions / Route Handlers) uses the service role and bypasses RLS,
-- but it also enforces the same rules in code. These policies protect direct client access.

-- 1. Enable RLS on every table ------------------------------------------------
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- 2. Reference data: readable by signed-in users, written by authorized staff ---
do $$ declare r record; begin
  for r in select * from (values
    ('districts','geography'),('mandals','geography'),('membership_plans','plans'),
    ('product_categories','shop'),('product_brands','shop'),('welfare_schemes','welfare'),
    ('emergency_contacts','emergency'),('association_settings','settings')) as v(tbl, module)
  loop
    execute format('drop policy if exists r2m_read on public.%I', r.tbl);
    execute format('create policy r2m_read on public.%I for select to authenticated using (true)', r.tbl);
    execute format('drop policy if exists r2m_write on public.%I', r.tbl);
    execute format($f$create policy r2m_write on public.%I for all to authenticated using (public.r2m_can(%L,'edit')) with check (public.r2m_can(%L,'edit'))$f$, r.tbl, r.module, r.module);
  end loop;
end $$;

-- 3. Users, roles, assignments -------------------------------------------------
drop policy if exists users_select on users;
create policy users_select on users for select to authenticated
  using (id = auth.uid() or public.r2m_can('staff','view') or public.r2m_can('members','view'));
drop policy if exists users_update_self on users;
create policy users_update_self on users for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and status = (select status from users where id = auth.uid()));
drop policy if exists users_staff_write on users;
create policy users_staff_write on users for all to authenticated using (public.r2m_can('staff','edit')) with check (public.r2m_can('staff','edit'));

drop policy if exists roles_read on roles;
create policy roles_read on roles for select to authenticated using (true);
drop policy if exists roles_write on roles;
create policy roles_write on roles for all to authenticated using (public.r2m_can('roles','manage')) with check (public.r2m_can('roles','manage'));

-- Staff cannot create or elevate their own roles
drop policy if exists user_roles_select on user_roles;
create policy user_roles_select on user_roles for select to authenticated using (user_id = auth.uid() or public.r2m_can('staff','view'));
drop policy if exists user_roles_write on user_roles;
create policy user_roles_write on user_roles for all to authenticated
  using (public.r2m_can('staff','edit') and user_id <> auth.uid())
  with check (public.r2m_can('staff','create') and user_id <> auth.uid() and (role_key <> 'main_admin' or public.r2m_is_admin()));

-- 4. Members ------------------------------------------------------------------
drop policy if exists members_select on members;
create policy members_select on members for select to authenticated
  using (user_id = auth.uid() or (public.r2m_can('members','view') and public.r2m_in_scope(district_id, mandal_id, agent_id))
         or (directory_opt_in and directory_verified and status = 'active'));
drop policy if exists members_insert on members;
create policy members_insert on members for insert to authenticated
  with check ((user_id = auth.uid() and status = 'pending') or (public.r2m_can('members','create') and agent_id = auth.uid() and public.r2m_in_scope(district_id, mandal_id, agent_id)));
drop policy if exists members_update on members;
create policy members_update on members for update to authenticated
  using (user_id = auth.uid() or (public.r2m_can('members','edit') or public.r2m_can('members','approve')) and public.r2m_in_scope(district_id, mandal_id, agent_id));

drop policy if exists member_docs_all on member_documents;
create policy member_docs_all on member_documents for all to authenticated
  using (member_id = public.r2m_my_member_id() or (public.r2m_can('members','view') and public.r2m_member_in_scope(member_id)))
  with check (member_id = public.r2m_my_member_id() or (public.r2m_can('members','edit') and public.r2m_member_in_scope(member_id)));

-- Cards, renewals, history (read-only for members; server/staff writes)
do $$ declare t text; begin
  foreach t in array array['membership_cards','membership_renewals','membership_card_history'] loop
    execute format('drop policy if exists r2m_select on public.%I', t);
    execute format('create policy r2m_select on public.%I for select to authenticated using (member_id = public.r2m_my_member_id() or (public.r2m_can(%L,''view'') and public.r2m_member_in_scope(member_id)))', t, 'members');
  end loop;
end $$;
drop policy if exists cards_write on membership_cards;
create policy cards_write on membership_cards for all to authenticated using (public.r2m_can('cards','manage')) with check (public.r2m_can('cards','manage'));

-- 5. Finance (immutable transactions: no client insert/update/delete policies) -------
drop policy if exists pay_select on payment_transactions;
create policy pay_select on payment_transactions for select to authenticated
  using (user_id = auth.uid() or member_id = public.r2m_my_member_id() or public.r2m_can('payments','view'));
drop policy if exists collections_select on manual_collections;
create policy collections_select on manual_collections for select to authenticated
  using (member_id = public.r2m_my_member_id() or collected_by = auth.uid() or public.r2m_can('collections','view') or public.r2m_can('payments','view'));
drop policy if exists collections_insert on manual_collections;
create policy collections_insert on manual_collections for insert to authenticated
  with check (public.r2m_can('collections','create') and collected_by = auth.uid() and public.r2m_member_in_scope(member_id) and status = 'pending');
drop policy if exists collections_verify on manual_collections;
create policy collections_verify on manual_collections for update to authenticated
  using (public.r2m_can('collections','approve') and collected_by <> auth.uid());
drop policy if exists refunds_select on refunds;
create policy refunds_select on refunds for select to authenticated using (public.r2m_can('payments','view'));
drop policy if exists expenses_all on expenses;
create policy expenses_all on expenses for all to authenticated using (public.r2m_can('payments','view')) with check (public.r2m_can('payments','manage'));

-- 6. Content ------------------------------------------------------------------
drop policy if exists news_select on news;
create policy news_select on news for select to authenticated
  using ((status = 'published' and publish_at <= now()) or public.r2m_can('news','view'));
drop policy if exists news_write on news;
create policy news_write on news for all to authenticated using (public.r2m_can('news','edit')) with check (public.r2m_can('news','create'));
drop policy if exists events_select on events;
create policy events_select on events for select to authenticated using (status = 'published' or public.r2m_can('events','view'));
drop policy if exists events_write on events;
create policy events_write on events for all to authenticated using (public.r2m_can('events','edit')) with check (public.r2m_can('events','create'));
drop policy if exists event_reg_all on event_registrations;
create policy event_reg_all on event_registrations for all to authenticated
  using (member_id = public.r2m_my_member_id() or public.r2m_can('events','view'))
  with check (member_id = public.r2m_my_member_id() or public.r2m_can('events','edit'));

-- 7. Shop ---------------------------------------------------------------------
drop policy if exists products_select on products;
create policy products_select on products for select to authenticated using (status = 'active' or public.r2m_can('shop','view'));
drop policy if exists products_write on products;
create policy products_write on products for all to authenticated using (public.r2m_can('shop','edit')) with check (public.r2m_can('shop','create'));
drop policy if exists stock_select on stock_movements;
create policy stock_select on stock_movements for select to authenticated using (public.r2m_can('shop','view'));
drop policy if exists coupons_staff on coupons;
create policy coupons_staff on coupons for all to authenticated using (public.r2m_can('shop','manage')) with check (public.r2m_can('shop','manage'));
drop policy if exists cart_own on cart_items;
create policy cart_own on cart_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists orders_select on orders;
create policy orders_select on orders for select to authenticated using (user_id = auth.uid() or public.r2m_can('orders','view'));
drop policy if exists orders_staff_update on orders;
create policy orders_staff_update on orders for update to authenticated using (public.r2m_can('orders','edit'));
drop policy if exists order_items_select on order_items;
create policy order_items_select on order_items for select to authenticated
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or public.r2m_can('orders','view'))));
drop policy if exists returns_all on product_returns;
create policy returns_all on product_returns for all to authenticated
  using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or public.r2m_can('orders','view'))))
  with check (exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid()));

-- 8. Welfare & emergency -------------------------------------------------------
drop policy if exists welfare_select on welfare_applications;
create policy welfare_select on welfare_applications for select to authenticated
  using (member_id = public.r2m_my_member_id() or (public.r2m_can('welfare','view') and public.r2m_member_in_scope(member_id)));
drop policy if exists welfare_insert on welfare_applications;
create policy welfare_insert on welfare_applications for insert to authenticated with check (member_id = public.r2m_my_member_id() and status = 'submitted');
drop policy if exists welfare_review on welfare_applications;
create policy welfare_review on welfare_applications for update to authenticated
  using (public.r2m_can('welfare','edit') and public.r2m_member_in_scope(member_id));
drop policy if exists welfare_appr_select on welfare_approvals;
create policy welfare_appr_select on welfare_approvals for select to authenticated
  using (exists (select 1 from welfare_applications w where w.id = application_id and (w.member_id = public.r2m_my_member_id() or (public.r2m_can('welfare','view') and public.r2m_member_in_scope(w.member_id)))));
drop policy if exists welfare_disb_select on welfare_disbursements;
create policy welfare_disb_select on welfare_disbursements for select to authenticated using (public.r2m_can('disbursements','view'));
drop policy if exists emergency_select on emergency_requests;
create policy emergency_select on emergency_requests for select to authenticated
  using (member_id = public.r2m_my_member_id() or (public.r2m_can('emergency','view') and public.r2m_member_in_scope(member_id)));
drop policy if exists emergency_insert on emergency_requests;
create policy emergency_insert on emergency_requests for insert to authenticated with check (member_id = public.r2m_my_member_id() and status = 'submitted');
drop policy if exists emergency_update on emergency_requests;
create policy emergency_update on emergency_requests for update to authenticated using (public.r2m_can('emergency','edit'));

-- 9. Donors, notifications, support, audit, settings --------------------------------
-- Donor phone numbers are never exposed: blood_donors holds no phone; the join to members is staff-only.
drop policy if exists donors_select on blood_donors;
create policy donors_select on blood_donors for select to authenticated using ((available and consent) or member_id = public.r2m_my_member_id() or public.r2m_can('donors','view'));
drop policy if exists donors_own on blood_donors;
create policy donors_own on blood_donors for all to authenticated using (member_id = public.r2m_my_member_id()) with check (member_id = public.r2m_my_member_id());
drop policy if exists blood_req_select on blood_requests;
create policy blood_req_select on blood_requests for select to authenticated using (true);
drop policy if exists blood_req_insert on blood_requests;
create policy blood_req_insert on blood_requests for insert to authenticated with check (requester_id = auth.uid());

drop policy if exists notif_own on notifications;
create policy notif_own on notifications for select to authenticated using (user_id = auth.uid() or public.r2m_can('notifications','view'));
drop policy if exists notif_read on notifications;
create policy notif_read on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists tickets_all on support_tickets;
create policy tickets_all on support_tickets for select to authenticated using (user_id = auth.uid() or public.r2m_can('support','view'));
drop policy if exists tickets_insert on support_tickets;
create policy tickets_insert on support_tickets for insert to authenticated with check (user_id = auth.uid());
drop policy if exists tickets_reply on support_tickets;
create policy tickets_reply on support_tickets for update to authenticated using (public.r2m_can('support','edit'));
drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select to authenticated using (public.r2m_can('audit','view'));

-- Sessions, password resets and login attempts have NO client policies: service role only.
