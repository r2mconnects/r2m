-- R2M CONNECT — 0004: storage buckets and policies (non-destructive)
-- Public images (photos, product/news images) and PRIVATE documents (IDs, welfare proofs).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('public-images', 'public-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('member-documents', 'member-documents', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('welfare-documents', 'welfare-documents', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Path convention for private buckets: <member_id>/<file>
drop policy if exists "public images readable" on storage.objects;
create policy "public images readable" on storage.objects for select using (bucket_id = 'public-images');
drop policy if exists "staff upload public images" on storage.objects;
create policy "staff upload public images" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-images' and (public.r2m_can('shop','create') or public.r2m_can('news','create') or public.r2m_can('events','create') or (storage.foldername(name))[1] = auth.uid()::text));

drop policy if exists "own private docs" on storage.objects;
create policy "own private docs" on storage.objects for all to authenticated
  using (bucket_id in ('member-documents','welfare-documents') and ((storage.foldername(name))[1] = public.r2m_my_member_id()::text
         or (public.r2m_can('members','view') and public.r2m_member_in_scope(((storage.foldername(name))[1])::uuid))))
  with check (bucket_id in ('member-documents','welfare-documents') and (storage.foldername(name))[1] = public.r2m_my_member_id()::text);
-- Authorized staff receive short-lived signed URLs from the server (createSignedUrl); never public URLs.
