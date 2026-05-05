-- Mengaktifkan RLS pada tabel target
ALTER TABLE public.jurnal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nilai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kehadiran ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bobot ENABLE ROW LEVEL SECURITY;

-- 1. Membuat Fungsi Bantuan untuk Mengecek Role dan Hak Akses Mapel
-- Fungsi ini ditandai SECURITY DEFINER agar dapat membaca tabel profiles tanpa dibatasi RLS tabel profiles itu sendiri
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_guru_mapel(p_mapel_id text)
RETURNS boolean AS $$
DECLARE
  v_mapel_ids jsonb;
BEGIN
  -- Ambil array mapel_ids sebagai jsonb dari tabel profiles
  SELECT mapel_ids::jsonb INTO v_mapel_ids FROM public.profiles WHERE id = auth.uid() LIMIT 1;
  
  -- Jika null atau kosong
  IF v_mapel_ids IS NULL OR jsonb_array_length(v_mapel_ids) = 0 THEN
    RETURN false;
  END IF;

  -- Mengecek apakah p_mapel_id (diubah ke format json array) ada di dalam array v_mapel_ids
  -- Contoh: v_mapel_ids='["uuid1", "uuid2"]' @> '["uuid1"]' -> bernilai true
  RETURN v_mapel_ids @> jsonb_build_array(p_mapel_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Menghapus Policy Lama (jika ada) untuk menghindari konflik duplikasi nama
DROP POLICY IF EXISTS "Admin Full Access Jurnal" ON public.jurnal;
DROP POLICY IF EXISTS "Guru Access Jurnal" ON public.jurnal;
DROP POLICY IF EXISTS "Admin Full Access Nilai" ON public.nilai;
DROP POLICY IF EXISTS "Guru Access Nilai" ON public.nilai;
DROP POLICY IF EXISTS "Admin Full Access Kehadiran" ON public.kehadiran;
DROP POLICY IF EXISTS "Guru Access Kehadiran" ON public.kehadiran;
DROP POLICY IF EXISTS "Admin Full Access Bobot" ON public.bobot;
DROP POLICY IF EXISTS "Guru Access Bobot" ON public.bobot;

-- 3. Membuat Policy Baru untuk JURNAL
CREATE POLICY "Admin Full Access Jurnal" ON public.jurnal
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Guru Access Jurnal" ON public.jurnal
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'guru' AND public.is_guru_mapel(mapel_id::text))
  WITH CHECK (public.get_user_role() = 'guru' AND public.is_guru_mapel(mapel_id::text));

-- 4. Membuat Policy Baru untuk NILAI
CREATE POLICY "Admin Full Access Nilai" ON public.nilai
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Guru Access Nilai" ON public.nilai
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'guru' AND public.is_guru_mapel(mapel_id::text))
  WITH CHECK (public.get_user_role() = 'guru' AND public.is_guru_mapel(mapel_id::text));

-- 5. Membuat Policy Baru untuk KEHADIRAN
CREATE POLICY "Admin Full Access Kehadiran" ON public.kehadiran
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Guru Access Kehadiran" ON public.kehadiran
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'guru' AND public.is_guru_mapel(mapel_id::text))
  WITH CHECK (public.get_user_role() = 'guru' AND public.is_guru_mapel(mapel_id::text));

-- 6. Membuat Policy Baru untuk BOBOT
CREATE POLICY "Admin Full Access Bobot" ON public.bobot
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Guru Access Bobot" ON public.bobot
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'guru' AND public.is_guru_mapel(mapel_id::text))
  WITH CHECK (public.get_user_role() = 'guru' AND public.is_guru_mapel(mapel_id::text));
