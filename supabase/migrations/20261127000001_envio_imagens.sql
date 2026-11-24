-- =====================================================================
-- FPET - Envio de imagens e anexos direto pelo sistema (Supabase Storage)
--   Pasta pública "imagens", com subpastas:
--     publicacoes/  -> só a federação
--     eventos/ atletas/ clubes/ -> federação e academias
--     atletas/      -> também o próprio atleta (foto do perfil)
--   Limite: 10 MB por arquivo; imagens e PDF.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists fpet_envia_arquivos on storage.objects;
create policy fpet_envia_arquivos on storage.objects for insert to authenticated
  with check (
    bucket_id = 'imagens' and (
      public.is_admin()
      or (public.e_gestor() and (storage.foldername(name))[1] in ('eventos', 'atletas', 'clubes'))
      or (public.meu_atleta_id() is not null and (storage.foldername(name))[1] = 'atletas')
    )
  );

drop policy if exists fpet_apaga_arquivos on storage.objects;
create policy fpet_apaga_arquivos on storage.objects for delete to authenticated
  using (bucket_id = 'imagens' and (public.is_admin() or owner = auth.uid()));
