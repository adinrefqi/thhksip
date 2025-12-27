-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 0. Table: profiles (Untuk Role User)
create table if not exists public.profiles (
    id uuid references auth.users on delete cascade primary key,
    email text,
    nama_lengkap text,
    role text default 'guru', -- 'admin' or 'guru'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 1. Table: kelas
create table if not exists public.kelas (
    id uuid default uuid_generate_v4() primary key,
    nama_kelas text not null,
    wali_kelas text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Table: siswa
create table if not exists public.siswa (
    id uuid default uuid_generate_v4() primary key,
    nis text,
    nama text not null,
    kelas_id uuid references public.kelas(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Table: mapel
create table if not exists public.mapel (
    id uuid default uuid_generate_v4() primary key,
    nama_mapel text not null,
    deskripsi text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Table: kategori (Kategori Nilai)
create table if not exists public.kategori (
    id uuid default uuid_generate_v4() primary key,
    nama_kategori text not null,
    bobot integer default 1,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Table: bobot (Pengaturan Bobot per Mapel/Kategori)
create table if not exists public.bobot (
    id uuid default uuid_generate_v4() primary key,
    mapel_id uuid references public.mapel(id) on delete cascade,
    kategori_id uuid references public.kategori(id) on delete cascade,
    nilai_bobot integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Table: nilai
create table if not exists public.nilai (
    id uuid default uuid_generate_v4() primary key,
    siswa_id uuid references public.siswa(id) on delete cascade,
    mapel_id uuid references public.mapel(id) on delete cascade,
    kategori_id uuid references public.kategori(id) on delete cascade,
    nilai numeric not null,
    semester text,
    tahun_ajaran text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Table: jurnal
create table if not exists public.jurnal (
    id uuid default uuid_generate_v4() primary key,
    tanggal date not null,
    kelas_id uuid references public.kelas(id) on delete set null,
    mapel_id uuid references public.mapel(id) on delete set null,
    materi text,
    metode text,
    catatan text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Table: kehadiran
create table if not exists public.kehadiran (
    id uuid default uuid_generate_v4() primary key,
    tanggal date not null,
    siswa_id uuid references public.siswa(id) on delete cascade,
    kelas_id uuid references public.kelas(id) on delete cascade,
    mapel_id uuid references public.mapel(id) on delete cascade,
    status text check (status in ('H', 'I', 'S', 'A')),
    keterangan text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.kelas enable row level security;
alter table public.siswa enable row level security;
alter table public.mapel enable row level security;
alter table public.kategori enable row level security;
alter table public.bobot enable row level security;
alter table public.nilai enable row level security;
alter table public.jurnal enable row level security;
alter table public.kehadiran enable row level security;

-- Create Policies
create policy "Public Access Profiles" on public.profiles for all using (true);
create policy "Public Access Kelas" on public.kelas for all using (true);
create policy "Public Access Siswa" on public.siswa for all using (true);
create policy "Public Access Mapel" on public.mapel for all using (true);
create policy "Public Access Kategori" on public.kategori for all using (true);
create policy "Public Access Bobot" on public.bobot for all using (true);
create policy "Public Access Nilai" on public.nilai for all using (true);
create policy "Public Access Jurnal" on public.jurnal for all using (true);
create policy "Public Access Kehadiran" on public.kehadiran for all using (true);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nama_lengkap, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'guru');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
