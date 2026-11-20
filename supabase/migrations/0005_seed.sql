-- R2M CONNECT — 0005: configuration seed (idempotent; contains no members, payments or orders)

insert into roles (key, name, description, scope, level, permissions, is_system) values
 ('main_admin','Main Admin','Highest authority','global',0,'{}',true),
 ('zone_president','Zone President','Zone leadership','global',10,'{"members":["view","approve","reject","export"],"applications":["view","approve","reject"],"reports":["view","export"],"news":["view","create","edit"],"events":["view","create","edit"]}',true),
 ('zone_secretary','Zone Secretary','Zone administration','global',11,'{"members":["view"],"applications":["view"],"reports":["view"],"news":["view","create","edit"],"events":["view","create","edit"]}',true),
 ('district_president','District President','Assigned district','district',20,'{"members":["view","edit","export"],"applications":["view","approve","reject"],"staff":["view","create","edit"],"reports":["view","export"]}',true),
 ('district_secretary','District Secretary','Assigned district','district',21,'{"members":["view"],"applications":["view"],"reports":["view"]}',true),
 ('mandal_president','Mandal President','Assigned mandal','mandal',30,'{"members":["view","create"],"applications":["view","create","approve","reject"],"events":["view","create","edit"]}',true),
 ('mandal_secretary','Mandal Secretary','Assigned mandal','mandal',31,'{"members":["view","create"],"applications":["view","create"]}',true),
 ('agent','Agent','Own registrations / assigned area','agent',40,'{"members":["view","create","edit"],"applications":["view","create"],"collections":["view","create"]}',true),
 ('employee','Employee','Office functions','global',41,'{"members":["view"],"news":["view","create","edit"],"events":["view","create","edit"]}',true),
 ('finance_officer','Finance Officer','Payments and reconciliation','global',42,'{"payments":["view","export","manage"],"collections":["view","approve","reject"],"disbursements":["view","manage"],"reports":["view","export"]}',true),
 ('welfare_officer','Welfare Officer','Welfare review','global',43,'{"welfare":["view","edit"],"emergency":["view","edit"],"donors":["view"]}',true),
 ('member','Member','Association member','self',99,'{}',true)
on conflict (key) do nothing;
-- NOTE: the Next.js app seeds the full permission matrix on first start (src/constants/roles.ts);
-- main_admin permissions are implicit in r2m_can() / the application.

insert into membership_plans (name, joining_fee_paise, application_fee_paise, renewal_fee_paise, late_fee_paise, grace_days, validity_months)
select 'Standard Membership', 0, 0, 0, 0, 30, 12 where not exists (select 1 from membership_plans);
-- Fees are 0 on purpose: the Main Admin sets real prices in Admin → Plans & Cards.

insert into districts (name, sort_order) values
 ('Anantapur',0),('Sri Sathya Sai',1),('Kurnool',2),('Nandyal',3),('YSR Kadapa',4),('Annamayya',5),('Chittoor',6),('Tirupati',7)
on conflict (name) do nothing;

insert into welfare_schemes (name, category, approval_levels, description) values
 ('Accident Assistance','accident','["welfare_officer"]','Accident assistance for members'),
 ('Medical Assistance','medical','["welfare_officer"]','Medical assistance for members'),
 ('Death Benefit','death','["welfare_officer"]','Death benefit'),
 ('Emergency Financial Assistance','emergency','["welfare_officer"]','Emergency financial assistance'),
 ('Disability Assistance','disability','["welfare_officer"]','Disability assistance'),
 ('Children''s Education Assistance','education','["welfare_officer"]','Education assistance'),
 ('Family Support','family','["welfare_officer"]','Family support'),
 ('Retirement Assistance','retirement','["welfare_officer"]','Retirement assistance')
on conflict do nothing;

insert into association_settings (key, value) values ('membershipPrefix','"R2M"'), ('paymentPolicy','"after_approval"')
on conflict (key) do nothing;

-- Create the Main Admin through the protected /setup page (or scripts/create-admin.mjs). Never insert a default admin here.
