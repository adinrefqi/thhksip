// State Management
const STORAGE_KEY = 'sistem_nilai_data';
const SUPABASE_URL = 'https://syhogxzdcnakccypuedy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aG9neHpkY25ha2NjeXB1ZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Mjg1NjUsImV4cCI6MjA4MDQwNDU2NX0.tBmCXNCcsiSMmBA9MyHYSuKdXq67m5TzzhxcOEaB560';

let sb;
if (typeof supabase !== 'undefined') {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    alert('CRITICAL: Library Supabase tidak termuat. Periksa koneksi internet Anda.');
}

let appData = {
    kelas: [],
    siswa: [],
    mapel: [],
    kategori: [],
    jurnal: [],
    bobot: {},
    nilai: {},
    kehadiran: []
};

// Login Logic
// --- LOGIKA LOGIN BARU (SUPABASE AUTH) ---

async function checkLogin() {
    if (!sb) return; // Supabase belum siap

    // Cek apakah ada user yang sedang login di Supabase
    try {
        const { data: { session } } = await sb.auth.getSession();

        if (!session) {
            document.getElementById('login-overlay').classList.remove('hidden');
        } else {
            document.getElementById('login-overlay').classList.add('hidden');
            // Setelah login, cek dia Guru atau Admin
            checkUserRole(session.user.id);
        }
    } catch (err) {
        console.error("Error checking session:", err);
    }
}

async function handleLogin() {
    console.log("Tombol Masuk diklik");

    if (!sb) {
        alert('Sistem belum siap (Supabase tidak terhubung). Coba refresh halaman.');
        return;
    }

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        return alert('Mohon isi email dan password!');
    }

    // Login menggunakan Supabase (Aman & Terenkripsi)
    try {
        const { data, error } = await sb.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            alert('Login Gagal: ' + error.message);
        } else {
            // Jika sukses, overlay hilang otomatis karena checkLogin akan berjalan
            location.reload();
        }
    } catch (err) {
        alert('Terjadi kesalahan saat login: ' + err.message);
    }
}

async function handleLogout() {
    await sb.auth.signOut();
    location.reload();
}

// --- SISTEM ROLE (ADMIN vs GURU) ---

async function checkUserRole(userId) {
    // Ambil data role dari tabel 'profiles'
    const { data: profile, error } = await sb
        .from('profiles')
        .select('role, nama_lengkap')
        .eq('id', userId)
        .single();

    if (profile) {
        console.log("User Login:", profile.nama_lengkap, "Role:", profile.role);

        // Update nama di dashboard
        const welcomeText = document.querySelector('.header-text h2');
        if (welcomeText) welcomeText.textContent = `Selamat Datang, ${profile.nama_lengkap || 'Bapak/Ibu Guru'}`;

        // Update User Profile Name in Top Bar
        const userProfileName = document.querySelector('.user-profile span');
        if (userProfileName) {
            userProfileName.textContent = profile.role === 'admin' ? 'Admin' : 'Guru';
        }

        // JIKA BUKAN ADMIN (GURU BIASA), SEMBUNYIKAN MENU BERBAHAYA
        if (profile.role !== 'admin') {
            // Daftar menu yang harus disembunyikan dari guru
            const restrictedMenus = [
                'menu-master-data', // Kelas
                'menu-master-siswa', // Siswa
                'menu-master-mapel', // Mapel
                'menu-master-kategori', // Kategori
                'menu-bobot', // Atur Bobot
                // 'menu-rekap-nilai', // Rekap Nilai (Guru boleh lihat)
                'menu-input-kehadiran', // Input Kehadiran (sudah ada di jurnal)
                'menu-rekap-kehadiran', // Rekap Kehadiran
                'menu-system', // Reset Data
                'divider-master-data', // Divider Master Data
                'divider-system' // Divider System
            ];

            restrictedMenus.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }
    }
}


// Initialization
document.addEventListener('DOMContentLoaded', () => {
    console.log("App Initializing...");
    checkLogin();
    loadData();
    setupNavigation();
    updateDashboardStats();
    renderAllTables();
    console.log("App Initialized.");
});

// Data Persistence
// Data Persistence
async function loadData() {
    try {
        const [
            { data: kelas },
            { data: siswa },
            { data: mapel },
            { data: kategori },
            { data: jurnal },
            { data: bobot },
            { data: nilai },
            { data: kehadiran }
        ] = await Promise.all([
            sb.from('kelas').select('*'),
            sb.from('siswa').select('*'),
            sb.from('mapel').select('*'),
            sb.from('kategori').select('*'),
            sb.from('jurnal').select('*'),
            sb.from('bobot').select('*'),
            sb.from('nilai').select('*'),
            sb.from('kehadiran').select('*')
        ]);

        appData.kelas = kelas || [];
        appData.siswa = (siswa || []).map(s => ({ ...s, kelasId: s.kelas_id }));
        appData.mapel = mapel || [];
        appData.kategori = kategori || [];
        appData.jurnal = (jurnal || []).map(j => ({ ...j, kelasId: j.kelas_id, mapelId: j.mapel_id }));
        appData.kehadiran = (kehadiran || []).map(k => ({ ...k, kelasId: k.kelas_id, mapelId: k.mapel_id, siswaId: k.siswa_id }));

        // Transform Bobot
        appData.bobot = {};
        (bobot || []).forEach(b => {
            if (!appData.bobot[b.mapel_id]) appData.bobot[b.mapel_id] = {};
            appData.bobot[b.mapel_id][b.kategori_id] = b.nilai_bobot;
        });

        // Transform Nilai
        appData.nilai = {};
        (nilai || []).forEach(n => {
            if (!appData.nilai[n.siswa_id]) appData.nilai[n.siswa_id] = {};
            if (!appData.nilai[n.siswa_id][n.mapel_id]) appData.nilai[n.siswa_id][n.mapel_id] = {};
            // Try to parse as JSON, fall back to raw value for backwards compatibility\n            try {\n                appData.nilai[n.siswa_id][n.mapel_id][n.kategori_id] = typeof n.nilai === 'string' ? JSON.parse(n.nilai) : n.nilai;\n            } catch (e) {\n                appData.nilai[n.siswa_id][n.mapel_id][n.kategori_id] = n.nilai;\n            }
        });

        updateDashboardStats();
        renderAllTables();
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Gagal memuat data dari server. Pastikan koneksi internet lancar.');
    }
}

function saveData() {
    // Deprecated in favor of direct DB calls
    console.log('Data saved to local state');
    updateDashboardStats();
}

// Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update active nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Show target view
            const targetId = item.getAttribute('data-target');
            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === `view-${targetId}`) {
                    view.classList.add('active');
                }
            });

            // Update Header Title
            if (pageTitle) {
                pageTitle.textContent = item.textContent.trim();
            }

            // Refresh data for specific views
            if (targetId === 'siswa') renderKelasOptions('filter-siswa-kelas', true);
            if (targetId === 'bobot') renderMapelOptions('select-bobot-mapel');
            if (targetId === 'input-nilai') {
                renderKelasOptions('input-kelas');
                renderMapelOptions('input-mapel');
                renderKategoriOptions('input-kategori');
            }
            if (targetId === 'rekap') {
                renderKelasOptions('rekap-kelas');
                renderMapelOptions('rekap-mapel');
            }
            if (targetId === 'jurnal') {
                renderJurnalTable();
            }
            if (targetId === 'input-kehadiran') {
                renderKelasOptions('absensi-kelas');
                renderMapelOptions('absensi-mapel');
                document.getElementById('absensi-tanggal').valueAsDate = new Date();
            }
            if (targetId === 'rekap-kehadiran') {
                renderKelasOptions('rekap-absensi-kelas');
                renderMapelOptions('rekap-absensi-mapel');
            }
        });
    });
}

// Dashboard Stats
function updateDashboardStats() {
    document.getElementById('stat-siswa').textContent = appData.siswa.length;
    document.getElementById('stat-kelas').textContent = appData.kelas.length;
    document.getElementById('stat-mapel').textContent = appData.mapel.length;

    // New stats
    if (document.getElementById('stat-kategori')) {
        document.getElementById('stat-kategori').textContent = appData.kategori.length;
    }

    // Calculate Average
    let totalScore = 0;
    let totalCount = 0;

    if (appData.nilai) {
        Object.values(appData.nilai).forEach(siswaMapels => {
            Object.values(siswaMapels).forEach(kategoriScores => {
                Object.values(kategoriScores).forEach(score => {
                    totalScore += parseFloat(score);
                    totalCount++;
                });
            });
        });
    }

    const average = totalCount > 0 ? (totalScore / totalCount).toFixed(1) : '0';
    if (document.getElementById('stat-rata')) {
        document.getElementById('stat-rata').textContent = average;
    }
}

// Modal Management
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');

    // Clear forms for Master Data
    if (modalId === 'modal-kelas') {
        document.getElementById('kelas-id').value = '';
        document.getElementById('kelas-nama').value = '';
    }
    if (modalId === 'modal-siswa') {
        document.getElementById('siswa-id').value = '';
        document.getElementById('siswa-nama').value = '';
        document.getElementById('siswa-nis').value = '';
        renderKelasOptions('siswa-kelas');
    }
    if (modalId === 'modal-mapel') {
        document.getElementById('mapel-id').value = '';
        document.getElementById('mapel-nama').value = '';
        document.getElementById('mapel-deskripsi').value = '';
    }
    if (modalId === 'modal-kategori') {
        document.getElementById('kategori-id').value = '';
        document.getElementById('kategori-nama').value = '';
        document.getElementById('kategori-tipe').value = 'formatif';
        document.getElementById('kategori-jumlah').value = '1';
        document.getElementById('kategori-prefix').value = '';
    }

    if (modalId === 'modal-jurnal') {
        renderKelasOptions('jurnal-kelas');
        renderMapelOptions('jurnal-mapel');
        // Set default date to today
        document.getElementById('jurnal-tanggal').valueAsDate = new Date();
        document.getElementById('jurnal-siswa-list').innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">Pilih Kelas untuk memuat daftar siswa.</p>';
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

window.onclick = function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// Helper: Generate ID
function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- KELAS MANAGEMENT ---
async function addKelas() {
    const id = document.getElementById('kelas-id').value;
    const nama = document.getElementById('kelas-nama').value;
    if (!nama) return alert('Nama kelas harus diisi!');

    const kelasData = {
        id: id || generateId(),
        nama_kelas: nama
    };

    const { error } = await sb.from('kelas').upsert([kelasData]);

    if (error) return alert('Gagal menyimpan: ' + error.message);

    if (id) {
        const index = appData.kelas.findIndex(k => k.id === id);
        if (index !== -1) appData.kelas[index] = kelasData;
    } else {
        appData.kelas.push(kelasData);
    }

    renderKelasTable();
    closeModal('modal-kelas');
    updateDashboardStats();
}

function editKelas(id) {
    const k = appData.kelas.find(k => k.id === id);
    if (k) {
        openModal('modal-kelas');
        document.getElementById('kelas-id').value = k.id;
        document.getElementById('kelas-nama').value = k.nama_kelas;
    }
}

function renderKelasTable() {
    const tbody = document.getElementById('table-kelas-body');
    tbody.innerHTML = '';
    appData.kelas.forEach((k, index) => {
        const siswaCount = appData.siswa.filter(s => s.kelasId === k.id).length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${k.nama_kelas}</td>
            <td>${siswaCount} Siswa</td>
            <td>
                <button class="btn-secondary" onclick="editKelas('${k.id}')" style="margin-right: 0.5rem;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="deleteKelas('${k.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteKelas(id) {
    if (confirm('Hapus kelas ini? Data siswa di dalamnya mungkin akan terpengaruh.')) {
        const { error } = await sb.from('kelas').delete().eq('id', id);
        if (error) return alert('Gagal menghapus: ' + error.message);

        appData.kelas = appData.kelas.filter(k => k.id !== id);
        renderKelasTable();
        updateDashboardStats();
    }
}

// --- SISWA MANAGEMENT ---
async function addSiswa() {
    const id = document.getElementById('siswa-id').value;
    const nama = document.getElementById('siswa-nama').value;
    const nis = document.getElementById('siswa-nis').value;
    const kelasId = document.getElementById('siswa-kelas').value;

    if (!nama || !nis || !kelasId) return alert('Semua data harus diisi!');

    const siswaData = {
        id: id || generateId(),
        nama,
        nis,
        kelas_id: kelasId
    };

    const { error } = await sb.from('siswa').upsert([siswaData]);

    if (error) return alert('Gagal menyimpan: ' + error.message);

    const localSiswa = { ...siswaData, kelasId: kelasId };

    if (id) {
        const index = appData.siswa.findIndex(s => s.id === id);
        if (index !== -1) appData.siswa[index] = localSiswa;
    } else {
        appData.siswa.push(localSiswa);
    }

    renderSiswaTable();
    closeModal('modal-siswa');
    updateDashboardStats();
}

function editSiswa(id) {
    const s = appData.siswa.find(s => s.id === id);
    if (s) {
        openModal('modal-siswa');
        document.getElementById('siswa-id').value = s.id;
        document.getElementById('siswa-nama').value = s.nama;
        document.getElementById('siswa-nis').value = s.nis;
        document.getElementById('siswa-kelas').value = s.kelasId;
    }
}

function renderSiswaTable() {
    const tbody = document.getElementById('table-siswa-body');
    const filterKelas = document.getElementById('filter-siswa-kelas').value;
    tbody.innerHTML = '';

    let filteredSiswa = appData.siswa;
    if (filterKelas) {
        filteredSiswa = filteredSiswa.filter(s => s.kelasId === filterKelas);
    }

    filteredSiswa.forEach((s, index) => {
        const kelas = appData.kelas.find(k => k.id === s.kelasId);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${s.nis}</td>
            <td>${s.nama}</td>
            <td>${kelas ? kelas.nama_kelas : '-'}</td>
            <td>
                <button class="btn-secondary" onclick="editSiswa('${s.id}')" style="margin-right: 0.5rem;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="deleteSiswa('${s.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteSiswa(id) {
    if (confirm('Hapus siswa ini?')) {
        const { error } = await sb.from('siswa').delete().eq('id', id);
        if (error) return alert('Gagal menghapus: ' + error.message);

        appData.siswa = appData.siswa.filter(s => s.id !== id);
        delete appData.nilai[id];
        renderSiswaTable();
        updateDashboardStats();
    }
}

// --- MAPEL MANAGEMENT ---
async function addMapel() {
    const id = document.getElementById('mapel-id').value;
    const nama = document.getElementById('mapel-nama').value;
    const deskripsi = document.getElementById('mapel-deskripsi').value;

    if (!nama) return alert('Nama mata pelajaran harus diisi!');

    const mapelData = {
        id: id || generateId(),
        nama_mapel: nama,
        deskripsi
    };

    const { error } = await sb.from('mapel').upsert([mapelData]);

    if (error) return alert('Gagal menyimpan: ' + error.message);

    if (id) {
        const index = appData.mapel.findIndex(m => m.id === id);
        if (index !== -1) appData.mapel[index] = mapelData;
    } else {
        appData.mapel.push(mapelData);
    }

    renderMapelTable();
    closeModal('modal-mapel');
    updateDashboardStats();
}

function editMapel(id) {
    const m = appData.mapel.find(m => m.id === id);
    if (m) {
        openModal('modal-mapel');
        document.getElementById('mapel-id').value = m.id;
        document.getElementById('mapel-nama').value = m.nama_mapel;
        document.getElementById('mapel-deskripsi').value = m.deskripsi;
    }
}

function renderMapelTable() {
    const tbody = document.getElementById('table-mapel-body');
    tbody.innerHTML = '';
    appData.mapel.forEach((m, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${m.nama_mapel}</td>
            <td>${m.deskripsi}</td>
            <td>
                <button class="btn-secondary" onclick="editMapel('${m.id}')" style="margin-right: 0.5rem;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="deleteMapel('${m.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteMapel(id) {
    if (confirm('Hapus mata pelajaran ini?')) {
        const { error } = await sb.from('mapel').delete().eq('id', id);
        if (error) return alert('Gagal menghapus: ' + error.message);

        appData.mapel = appData.mapel.filter(m => m.id !== id);
        delete appData.bobot[id];
        renderMapelTable();
        updateDashboardStats();
    }
}

// --- KATEGORI MANAGEMENT ---
async function addKategori() {
    const id = document.getElementById('kategori-id').value;
    const nama = document.getElementById('kategori-nama').value;
    const tipe = document.getElementById('kategori-tipe').value;
    const jumlah = parseInt(document.getElementById('kategori-jumlah').value) || 1;
    const prefix = document.getElementById('kategori-prefix').value || '';

    if (!nama) return alert('Nama kategori harus diisi!');
    if (jumlah < 1 || jumlah > 20) return alert('Jumlah komponen harus antara 1-20!');

    const kategoriData = {
        id: id || generateId(),
        nama_kategori: nama,
        tipe_kategori: tipe,
        jumlah_komponen: jumlah,
        prefix_komponen: prefix
    };

    const { error } = await sb.from('kategori').upsert([kategoriData]);

    if (error) return alert('Gagal menyimpan: ' + error.message);

    if (id) {
        const index = appData.kategori.findIndex(k => k.id === id);
        if (index !== -1) appData.kategori[index] = kategoriData;
    } else {
        appData.kategori.push(kategoriData);
    }

    renderKategoriTable();
    closeModal('modal-kategori');
    updateDashboardStats();
}

function editKategori(id) {
    const k = appData.kategori.find(k => k.id === id);
    if (k) {
        openModal('modal-kategori');
        document.getElementById('kategori-id').value = k.id;
        document.getElementById('kategori-nama').value = k.nama_kategori;
        document.getElementById('kategori-tipe').value = k.tipe_kategori || 'formatif';
        document.getElementById('kategori-jumlah').value = k.jumlah_komponen || 1;
        document.getElementById('kategori-prefix').value = k.prefix_komponen || '';
    }
}

function renderKategoriTable() {
    const tbody = document.getElementById('table-kategori-body');
    tbody.innerHTML = '';
    appData.kategori.forEach((k, index) => {
        const tipe = k.tipe_kategori || 'formatif';
        const jumlah = k.jumlah_komponen || 1;
        const prefix = k.prefix_komponen || '-';
        const badgeClass = tipe === 'formatif' ? 'badge-success' : 'badge-primary';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${k.nama_kategori}</td>
            <td><span class="badge ${badgeClass}">${tipe.toUpperCase()}</span></td>
            <td>${jumlah} komponen</td>
            <td>${prefix}</td>
            <td>
                <button class="btn-secondary" onclick="editKategori('${k.id}')" style="margin-right: 0.5rem;"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="deleteKategori('${k.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteKategori(id) {
    if (confirm('Hapus kategori ini?')) {
        const { error } = await sb.from('kategori').delete().eq('id', id);
        if (error) return alert('Gagal menghapus: ' + error.message);

        appData.kategori = appData.kategori.filter(k => k.id !== id);
        renderKategoriTable();
    }
}

// --- JURNAL MANAGEMENT ---
function renderJurnalSiswaList() {
    const kelasId = document.getElementById('jurnal-kelas').value;
    const container = document.getElementById('jurnal-siswa-list');

    if (!kelasId) {
        container.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">Pilih Kelas untuk memuat daftar siswa.</p>';
        return;
    }

    const siswaInKelas = appData.siswa.filter(s => s.kelasId === kelasId);

    if (siswaInKelas.length === 0) {
        container.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">Tidak ada siswa di kelas ini.</p>';
        return;
    }

    container.innerHTML = '';
    siswaInKelas.forEach(s => {
        const div = document.createElement('div');
        div.className = 'jurnal-siswa-item';
        div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee;';
        div.innerHTML = `
            <span style="font-size: 0.9rem; font-weight: 500;">${s.nama}</span>
            <div class="attendance-options" style="display: flex; gap: 10px;">
                <label style="font-size: 0.85rem; cursor: pointer;"><input type="radio" name="jurnal-status-${s.id}" value="H" checked> H</label>
                <label style="font-size: 0.85rem; cursor: pointer;"><input type="radio" name="jurnal-status-${s.id}" value="I"> I</label>
                <label style="font-size: 0.85rem; cursor: pointer;"><input type="radio" name="jurnal-status-${s.id}" value="S"> S</label>
                <label style="font-size: 0.85rem; cursor: pointer;"><input type="radio" name="jurnal-status-${s.id}" value="A"> A</label>
            </div>
        `;
        container.appendChild(div);
    });
}

async function addJurnal() {
    const tanggal = document.getElementById('jurnal-tanggal').value;
    const kelasId = document.getElementById('jurnal-kelas').value;
    const mapelId = document.getElementById('jurnal-mapel').value;
    const materi = document.getElementById('jurnal-materi').value;
    const metode = document.getElementById('jurnal-metode').value;
    const catatan = document.getElementById('jurnal-catatan').value;

    if (!tanggal || !kelasId || !mapelId || !materi) return alert('Tanggal, Kelas, Mapel, dan Materi wajib diisi!');

    const newJurnal = {
        id: generateId(),
        tanggal,
        kelas_id: kelasId,
        mapel_id: mapelId,
        materi,
        metode,
        catatan
    };

    const { error } = await sb.from('jurnal').insert([newJurnal]);
    if (error) return alert('Gagal menyimpan jurnal: ' + error.message);

    // Save Attendance
    const siswaItems = document.querySelectorAll('input[name^="jurnal-status-"]:checked');
    if (siswaItems.length > 0) {
        const kehadiranToSave = [];
        siswaItems.forEach(item => {
            const siswaId = item.name.replace('jurnal-status-', '');
            kehadiranToSave.push({
                id: generateId(),
                tanggal,
                kelas_id: kelasId,
                mapel_id: mapelId,
                siswa_id: siswaId,
                status: item.value,
                keterangan: ''
            });
        });

        // Delete existing for this scope
        await sb.from('kehadiran').delete().match({ tanggal, kelas_id: kelasId, mapel_id: mapelId });

        const { error: absensiError } = await sb.from('kehadiran').insert(kehadiranToSave);
        if (absensiError) console.error('Gagal menyimpan absensi:', absensiError);

        // Update local state
        appData.kehadiran = appData.kehadiran.filter(k =>
            !(k.kelasId === kelasId && k.mapelId === mapelId && k.tanggal === tanggal)
        );
        kehadiranToSave.forEach(k => {
            appData.kehadiran.push({ ...k, kelasId: k.kelas_id, mapelId: k.mapel_id, siswaId: k.siswa_id });
        });
    }

    appData.jurnal.push({ ...newJurnal, kelasId, mapelId });
    renderJurnalTable();
    closeModal('modal-jurnal');

    document.getElementById('jurnal-materi').value = '';
    document.getElementById('jurnal-metode').value = '';
    document.getElementById('jurnal-catatan').value = '';
    document.getElementById('jurnal-siswa-list').innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">Pilih Kelas untuk memuat daftar siswa.</p>';
}

function renderJurnalTable() {
    const tbody = document.getElementById('table-jurnal-body');
    tbody.innerHTML = '';

    // Sort by date descending
    const sortedJurnal = [...appData.jurnal].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    sortedJurnal.forEach((j, index) => {
        const kelas = appData.kelas.find(k => k.id === j.kelasId);
        const mapel = appData.mapel.find(m => m.id === j.mapelId);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${j.tanggal}</td>
            <td>${kelas ? kelas.nama_kelas : '-'}</td>
            <td>${mapel ? mapel.nama_mapel : '-'}</td>
            <td>${j.materi}</td>
            <td>${j.metode || '-'}</td>
            <td>
                <button class="btn-danger" onclick="deleteJurnal('${j.id}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteJurnal(id) {
    if (confirm('Hapus jurnal ini?')) {
        const { error } = await sb.from('jurnal').delete().eq('id', id);
        if (error) return alert('Gagal menghapus: ' + error.message);

        appData.jurnal = appData.jurnal.filter(j => j.id !== id);
        renderJurnalTable();
    }
}

// --- BOBOT MANAGEMENT ---
function renderBobotForm() {
    const mapelId = document.getElementById('select-bobot-mapel').value;
    const container = document.getElementById('bobot-container');
    container.innerHTML = '';

    if (!mapelId) {
        container.innerHTML = '<p class="text-muted">Silakan pilih mata pelajaran terlebih dahulu.</p>';
        document.getElementById('total-bobot-value').textContent = '0';
        return;
    }

    const currentWeights = appData.bobot[mapelId] || {};

    appData.kategori.forEach(k => {
        const div = document.createElement('div');
        div.className = 'bobot-item';
        div.innerHTML = `
            <label>${k.nama_kategori} (${k.deskripsi})</label>
            <input type="number" class="form-control bobot-input" 
                   data-kategori="${k.id}" 
                   value="${currentWeights[k.id] || 0}" 
                   min="0" max="100" oninput="calculateTotalBobot()">
            <span>%</span>
        `;
        container.appendChild(div);
    });
    calculateTotalBobot();
}

function calculateTotalBobot() {
    const inputs = document.querySelectorAll('.bobot-input');
    let total = 0;
    inputs.forEach(input => total += parseInt(input.value || 0));
    const totalDisplay = document.getElementById('total-bobot-value');
    totalDisplay.textContent = total;
    totalDisplay.style.color = total === 100 ? 'var(--success-color)' : 'var(--danger-color)';
}

async function saveWeights() {
    const mapelId = document.getElementById('select-bobot-mapel').value;
    if (!mapelId) return alert('Pilih mata pelajaran!');

    const inputs = document.querySelectorAll('.bobot-input');
    let total = 0;
    const weightsToSave = [];

    // Fetch existing weights to get IDs
    const { data: existingWeights, error: fetchError } = await sb
        .from('bobot')
        .select('id, kategori_id')
        .eq('mapel_id', mapelId);

    if (fetchError) return alert('Gagal mengambil data bobot lama: ' + fetchError.message);

    const weightMap = {};
    (existingWeights || []).forEach(w => weightMap[w.kategori_id] = w.id);

    inputs.forEach(input => {
        const val = parseInt(input.value || 0);
        total += val;
        weightsToSave.push({
            id: weightMap[input.dataset.kategori] || generateId(),
            mapel_id: mapelId,
            kategori_id: input.dataset.kategori,
            nilai_bobot: val
        });
    });

    if (total !== 100) return alert(`Total bobot harus 100%! Saat ini: ${total}%`);

    // Upsert to Supabase
    const { error } = await sb.from('bobot').upsert(weightsToSave);
    if (error) return alert('Gagal menyimpan bobot: ' + error.message);

    // Update local state
    if (!appData.bobot[mapelId]) appData.bobot[mapelId] = {};
    weightsToSave.forEach(w => {
        appData.bobot[mapelId][w.kategori_id] = w.nilai_bobot;
    });

    alert('Bobot berhasil disimpan!');
}

// --- INPUT NILAI ---
function prepareInputNilai() {
    const kelasId = document.getElementById('input-kelas').value;
    const mapelId = document.getElementById('input-mapel').value;
    const kategoriId = document.getElementById('input-kategori').value;
    const tableHead = document.querySelector('#view-input-nilai table thead tr');
    const tbody = document.getElementById('table-input-nilai-body');

    if (!kelasId || !mapelId || !kategoriId) {
        tbody.innerHTML = '<tr><td colspan="100" class="text-center">Pilih Kelas, Mapel, dan Kategori untuk memulai.</td></tr>';
        tableHead.innerHTML = '<th>No</th><th>Nama Siswa</th><th>Nilai (0-100)</th>';
        return;
    }

    const siswaInKelas = appData.siswa.filter(s => s.kelasId === kelasId);
    const selectedKategori = appData.kategori.find(k => k.id === kategoriId);

    if (!selectedKategori) {
        tbody.innerHTML = '<tr><td colspan="100" class="text-center">Kategori tidak ditemukan.</td></tr>';
        return;
    }

    const jumlahKomponen = selectedKategori.jumlah_komponen || 1;
    const prefix = selectedKategori.prefix_komponen || '';

    // Build table header
    let headerHTML = '<th>No</th><th>Nama Siswa</th>';
    for (let i = 1; i <= jumlahKomponen; i++) {
        const label = prefix ? `${prefix}${i}` : `Komponen ${i}`;
        headerHTML += `<th>${label}</th>`;
    }
    tableHead.innerHTML = headerHTML;

    tbody.innerHTML = '';

    if (siswaInKelas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${jumlahKomponen + 2}" class="text-center">Tidak ada siswa di kelas ini.</td></tr>`;
        return;
    }

    siswaInKelas.forEach((s, index) => {
        let rowHTML = `<td>${index + 1}</td><td>${s.nama} (${s.nis})</td>`;

        // Create input for each component
        for (let i = 1; i <= jumlahKomponen; i++) {
            let currentScore = '';
            if (appData.nilai[s.id] && appData.nilai[s.id][mapelId] && appData.nilai[s.id][mapelId][kategoriId]) {
                const komponenData = appData.nilai[s.id][mapelId][kategoriId];
                // Check if komponenData is an object (new format)
                if (typeof komponenData === 'object' && komponenData[`k${i}`] !== undefined) {
                    currentScore = komponenData[`k${i}`];
                } else if (typeof komponenData === 'number' && i === 1) {
                    // For backwards compatibility with old single-value format
                    currentScore = komponenData;
                }
            }

            rowHTML += `
                <td>
                    <input type="number" class="form-control input-score" 
                           data-siswa="${s.id}" 
                           data-komponen="${i}"
                           value="${currentScore}" 
                           min="0" max="100" placeholder="0-100" style="min-width: 80px;">
                </td>
            `;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });
}

async function saveGrades() {
    const mapelId = document.getElementById('input-mapel').value;
    const kategoriId = document.getElementById('input-kategori').value;

    if (!mapelId || !kategoriId) return alert('Data belum lengkap!');

    const selectedKategori = appData.kategori.find(k => k.id === kategoriId);
    if (!selectedKategori) return alert('Kategori tidak ditemukan!');

    const jumlahKomponen = selectedKategori.jumlah_komponen || 1;
    const inputs = document.querySelectorAll('.input-score');
    const gradesToSave = [];
    let count = 0;

    // Group inputs by siswa
    const siswaScores = {};
    inputs.forEach(input => {
        const siswaId = input.dataset.siswa;
        const komponenIndex = parseInt(input.dataset.komponen);
        const score = input.value;

        if (score !== '') {
            if (!siswaScores[siswaId]) {
                siswaScores[siswaId] = {};
            }
            siswaScores[siswaId][`k${komponenIndex}`] = parseFloat(score);
        }
    });

    // Fetch existing grades to get IDs
    const { data: existingGrades, error: fetchError } = await sb
        .from('nilai')
        .select('id, siswa_id')
        .eq('mapel_id', mapelId)
        .eq('kategori_id', kategoriId);

    if (fetchError) return alert('Gagal mengambil data nilai lama: ' + fetchError.message);

    const gradeMap = {};
    (existingGrades || []).forEach(g => gradeMap[g.siswa_id] = g.id);

    // Save each student's scores as JSON
    for (const [siswaId, komponenScores] of Object.entries(siswaScores)) {
        gradesToSave.push({
            id: gradeMap[siswaId] || generateId(),
            siswa_id: siswaId,
            mapel_id: mapelId,
            kategori_id: kategoriId,
            nilai: JSON.stringify(komponenScores) // Store as JSON string
        });
        count++;
    }

    if (count === 0) return alert('Tidak ada nilai yang diinput.');

    const { error } = await sb.from('nilai').upsert(gradesToSave);
    if (error) return alert('Gagal menyimpan nilai: ' + error.message);

    // Update local state
    gradesToSave.forEach(g => {
        if (!appData.nilai[g.siswa_id]) appData.nilai[g.siswa_id] = {};
        if (!appData.nilai[g.siswa_id][g.mapel_id]) appData.nilai[g.siswa_id][g.mapel_id] = {};
        // Parse back the JSON when storing locally
        appData.nilai[g.siswa_id][g.mapel_id][g.kategori_id] = JSON.parse(g.nilai);
    });

    alert(`${count} Nilai berhasil disimpan!`);
    // Refresh the table
    prepareInputNilai();
}

// --- REKAP NILAI ---
function renderRekapTable() {
    const kelasId = document.getElementById('rekap-kelas').value;
    const mapelId = document.getElementById('rekap-mapel').value;
    const thead = document.getElementById('rekap-table-head');
    const tbody = document.getElementById('rekap-table-body');

    if (!kelasId || !mapelId) {
        tbody.innerHTML = '<tr><td colspan="100%" class="text-center">Pilih Kelas dan Mapel untuk melihat rekap.</td></tr>';
        thead.innerHTML = '';
        return;
    }

    // Build headers with sub-components
    let headerHTML = '<th>No</th><th>Nama Siswa</th>';
    appData.kategori.forEach(k => {
        const jumlahKomponen = k.jumlah_komponen || 1;
        const prefix = k.prefix_komponen || '';

        if (jumlahKomponen > 1) {
            // Show individual components
            for (let i = 1; i <= jumlahKomponen; i++) {
                const label = prefix ? `${prefix}${i}` : `${k.nama_kategori}-${i}`;
                headerHTML += `<th style="min-width: 70px;">${label}</th>`;
            }
            // Add average column for this category
            headerHTML += `<th style="background: rgba(79,70,229,0.1);">Rata-rata<br>${k.nama_kategori}</th>`;
        } else {
            // Single component category
            headerHTML += `<th>${k.nama_kategori}</th>`;
        }
    });
    headerHTML += '<th style="background: rgba(16,185,129,0.1);">Nilai Akhir</th><th>Predikat</th>';
    thead.innerHTML = headerHTML;

    // Body
    const siswaInKelas = appData.siswa.filter(s => s.kelasId === kelasId);
    const weights = appData.bobot[mapelId] || {};

    tbody.innerHTML = '';
    siswaInKelas.forEach((s, index) => {
        let rowHTML = `<td>${index + 1}</td><td>${s.nama}</td>`;
        let totalScore = 0;
        let totalWeight = 0;

        appData.kategori.forEach(k => {
            const jumlahKomponen = k.jumlah_komponen || 1;
            let kategoriScores = [];
            let kategoriAverage = 0;

            if (jumlahKomponen > 1) {
                // Display each component
                for (let i = 1; i <= jumlahKomponen; i++) {
                    let komponenScore = 0;
                    if (appData.nilai[s.id] && appData.nilai[s.id][mapelId] && appData.nilai[s.id][mapelId][k.id]) {
                        const nilaiData = appData.nilai[s.id][mapelId][k.id];
                        if (typeof nilaiData === 'object' && nilaiData[`k${i}`] !== undefined) {
                            komponenScore = parseFloat(nilaiData[`k${i}`]) || 0;
                        }
                    }
                    kategoriScores.push(komponenScore);
                    rowHTML += `<td>${komponenScore || '-'}</td>`;
                }

                // Calculate and display average
                const validScores = kategoriScores.filter(s => s > 0);
                if (validScores.length > 0) {
                    kategoriAverage = validScores.reduce((a, b) => a + b, 0) / validScores.length;
                }
                rowHTML += `<td style="background: rgba(79,70,229,0.05); font-weight: 600;">${kategoriAverage.toFixed(1)}</td>`;
            } else {
                // Single component
                if (appData.nilai[s.id] && appData.nilai[s.id][mapelId] && appData.nilai[s.id][mapelId][k.id]) {
                    const nilaiData = appData.nilai[s.id][mapelId][k.id];
                    if (typeof nilaiData === 'object' && nilaiData.k1 !== undefined) {
                        kategoriAverage = parseFloat(nilaiData.k1) || 0;
                    } else if (typeof nilaiData === 'number') {
                        kategoriAverage = nilaiData;
                    }
                }
                rowHTML += `<td>${kategoriAverage || '-'}</td>`;
            }

            // Add to weighted total
            const weight = weights[k.id] || 0;
            totalScore += (kategoriAverage * weight / 100);
            totalWeight += weight;
        });

        const finalScore = totalWeight > 0 ? totalScore.toFixed(2) : 0;
        const predikat = getPredikat(finalScore);

        rowHTML += `<td style="background: rgba(16,185,129,0.05); font-weight: 700; font-size: 1.1em;">${finalScore}</td><td><span class="badge ${predikat}">${predikat}</span></td>`;

        const tr = document.createElement('tr');
        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });
}

function getPredikat(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'E';
}

// --- DATA MANAGEMENT & UTILS ---
function renderKelasOptions(selectId, includeAll = false) {
    const select = document.getElementById(selectId);
    select.innerHTML = includeAll ? '<option value="">Semua Kelas</option>' : '<option value="">-- Pilih Kelas --</option>';
    appData.kelas.forEach(k => {
        const option = document.createElement('option');
        option.value = k.id;
        option.textContent = k.nama_kelas;
        select.appendChild(option);
    });
}

function renderMapelOptions(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Pilih Mapel --</option>';
    appData.mapel.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.nama_mapel;
        select.appendChild(option);
    });
}

function renderKategoriOptions(selectId) {
    const select = document.getElementById(selectId);
    select.innerHTML = '<option value="">-- Pilih Kategori --</option>';
    appData.kategori.forEach(k => {
        const option = document.createElement('option');
        option.value = k.id;
        option.textContent = k.nama_kategori;
        select.appendChild(option);
    });
}

function renderAllTables() {
    renderKelasTable();
    renderSiswaTable();
    renderMapelTable();
    renderKategoriTable();
}

function backupData() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_nilai_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function restoreData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm('Apakah Anda yakin ingin me-restore data? Data saat ini akan ditimpa.')) {
                appData = data;
                saveData();
                location.reload();
            }
        } catch (err) {
            alert('File backup tidak valid!');
        }
    };
    reader.readAsText(file);
}

function resetData() {
    const keyword = prompt('PERINGATAN: Semua data akan dihapus permanen! Masukkan kata kunci "smpthhkok" untuk konfirmasi:');
    if (keyword === 'smpthhkok') {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    } else if (keyword !== null) {
        alert('Kata kunci salah! Reset data dibatalkan.');
    }
}

function exportToExcel() {
    const table = document.getElementById('rekap-table');
    let html = table.outerHTML;

    // Simple Excel Export
    const url = 'data:application/vnd.ms-excel,' + encodeURIComponent(html);
    const downloadLink = document.createElement("a");
    document.body.appendChild(downloadLink);
    downloadLink.href = url;
    downloadLink.download = 'rekap_nilai.xls';
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// --- SISWA IMPORT/EXPORT ---
function downloadStudentTemplate() {
    const wb = XLSX.utils.book_new();
    const ws_data = [['Nama Siswa', 'NIS', 'Nama Kelas']];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "template_siswa.xlsx");
}

function handleStudentImport(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        processStudentImport(jsonData);
        input.value = ''; // Reset input
    };
    reader.readAsArrayBuffer(file);
}

async function processStudentImport(data) {
    // Skip header row
    if (data.length <= 1) return alert('File kosong atau format salah!');

    let successCount = 0;
    const newKelasList = [];
    const newSiswaList = [];

    // First pass: Identify new classes
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const namaKelas = row[2];
        if (namaKelas) {
            const existingKelas = appData.kelas.find(k => k.nama_kelas.toLowerCase() === namaKelas.toString().toLowerCase())
                || newKelasList.find(k => k.nama_kelas.toLowerCase() === namaKelas.toString().toLowerCase());

            if (!existingKelas) {
                newKelasList.push({ id: generateId(), nama_kelas: namaKelas.toString() });
            }
        }
    }

    // Insert new classes to Supabase
    if (newKelasList.length > 0) {
        const { error } = await sb.from('kelas').insert(newKelasList);
        if (error) return alert('Gagal import kelas: ' + error.message);
        appData.kelas.push(...newKelasList);
    }

    // Second pass: Prepare students
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const nama = row[0];
        const nis = row[1];
        const namaKelas = row[2];

        if (nama && nis) {
            let kelasId = '';
            if (namaKelas) {
                const k = appData.kelas.find(k => k.nama_kelas.toLowerCase() === namaKelas.toString().toLowerCase());
                if (k) kelasId = k.id;
            }

            newSiswaList.push({
                id: generateId(),
                nama: nama,
                nis: nis.toString(),
                kelas_id: kelasId
            });
            successCount++;
        }
    }

    // Insert students to Supabase
    if (newSiswaList.length > 0) {
        const { error } = await sb.from('siswa').insert(newSiswaList);
        if (error) return alert('Gagal import siswa: ' + error.message);

        const mappedSiswa = newSiswaList.map(s => ({ ...s, kelasId: s.kelas_id }));
        appData.siswa.push(...mappedSiswa);
    }

    renderAllTables();
    updateDashboardStats();
    alert(`Berhasil mengimport ${successCount} siswa!`);
}

// --- KEHADIRAN MANAGEMENT ---
function renderInputKehadiranTable() {
    const kelasId = document.getElementById('absensi-kelas').value;
    const mapelId = document.getElementById('absensi-mapel').value;
    const tanggal = document.getElementById('absensi-tanggal').value;
    const tbody = document.getElementById('table-input-kehadiran-body');

    if (!kelasId || !mapelId || !tanggal) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Pilih Kelas, Mapel, dan Tanggal untuk memulai.</td></tr>';
        return;
    }

    const siswaInKelas = appData.siswa.filter(s => s.kelasId === kelasId);
    tbody.innerHTML = '';

    if (siswaInKelas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tidak ada siswa di kelas ini.</td></tr>';
        return;
    }

    siswaInKelas.forEach((s, index) => {
        // Find existing attendance record
        const existingRecord = appData.kehadiran.find(k =>
            k.kelasId === kelasId &&
            k.mapelId === mapelId &&
            k.tanggal === tanggal &&
            k.siswaId === s.id
        );

        const status = existingRecord ? existingRecord.status : '';
        const keterangan = existingRecord ? existingRecord.keterangan || '' : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${s.nama}</td>
            <td class="text-center"><input type="radio" name="status-${s.id}" value="H" ${status === 'H' ? 'checked' : ''}></td>
            <td class="text-center"><input type="radio" name="status-${s.id}" value="I" ${status === 'I' ? 'checked' : ''}></td>
            <td class="text-center"><input type="radio" name="status-${s.id}" value="S" ${status === 'S' ? 'checked' : ''}></td>
            <td class="text-center"><input type="radio" name="status-${s.id}" value="A" ${status === 'A' ? 'checked' : ''}></td>
            <td><input type="text" class="form-control input-keterangan" data-siswa="${s.id}" value="${keterangan}" placeholder="Keterangan"></td>
        `;
        tbody.appendChild(tr);
    });
}

async function saveKehadiran() {
    const kelasId = document.getElementById('absensi-kelas').value;
    const mapelId = document.getElementById('absensi-mapel').value;
    const tanggal = document.getElementById('absensi-tanggal').value;

    if (!kelasId || !mapelId || !tanggal) return alert('Data belum lengkap!');

    const siswaInKelas = appData.siswa.filter(s => s.kelasId === kelasId);
    const kehadiranToSave = [];
    let count = 0;

    // Fetch existing attendance to get IDs
    const { data: existingAttendance, error: fetchError } = await sb
        .from('kehadiran')
        .select('id, siswa_id')
        .eq('kelas_id', kelasId)
        .eq('mapel_id', mapelId)
        .eq('tanggal', tanggal);

    if (fetchError) return alert('Gagal mengambil data kehadiran lama: ' + fetchError.message);

    const attendanceMap = {};
    (existingAttendance || []).forEach(a => attendanceMap[a.siswa_id] = a.id);

    siswaInKelas.forEach(s => {
        const statusRadio = document.querySelector(`input[name="status-${s.id}"]:checked`);
        const keteranganInput = document.querySelector(`.input-keterangan[data-siswa="${s.id}"]`);

        if (statusRadio) {
            kehadiranToSave.push({
                id: attendanceMap[s.id] || generateId(),
                tanggal,
                kelas_id: kelasId,
                mapel_id: mapelId,
                siswa_id: s.id,
                status: statusRadio.value,
                keterangan: keteranganInput ? keteranganInput.value : ''
            });
            count++;
        }
    });

    if (count > 0) {
        const { error } = await sb.from('kehadiran').upsert(kehadiranToSave);
        if (error) return alert('Gagal menyimpan kehadiran: ' + error.message);
    }

    // Update local state by reloading (easier than patching array manually)
    appData.kehadiran = appData.kehadiran.filter(k =>
        !(k.kelasId === kelasId && k.mapelId === mapelId && k.tanggal === tanggal)
    );
    kehadiranToSave.forEach(k => {
        appData.kehadiran.push({ ...k, kelasId: k.kelas_id, mapelId: k.mapel_id, siswaId: k.siswa_id });
    });

    alert('Kehadiran berhasil disimpan!');
    return;
}

function renderRekapKehadiranTable() {
    const kelasId = document.getElementById('rekap-absensi-kelas').value;
    const mapelId = document.getElementById('rekap-absensi-mapel').value;
    const startDate = document.getElementById('rekap-absensi-start').valueAsDate;
    const endDate = document.getElementById('rekap-absensi-end').valueAsDate;
    const tbody = document.querySelector('#view-rekap-kehadiran tbody');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!kelasId || !mapelId) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Pilih Kelas dan Mata Pelajaran terlebih dahulu</td></tr>';
        return;
    }

    const siswaInKelas = appData.siswa.filter(s => s.kelasId === kelasId);

    siswaInKelas.forEach((s, index) => {
        // Filter attendance records
        const records = appData.kehadiran.filter(k => {
            const isSiswa = k.siswaId === s.id;
            const isMapel = k.mapelId === mapelId;
            const kDate = new Date(k.tanggal);
            // Reset hours for comparison
            kDate.setHours(0, 0, 0, 0);

            let isDateInRange = true;
            if (startDate) {
                startDate.setHours(0, 0, 0, 0);
                if (kDate < startDate) isDateInRange = false;
            }
            if (endDate) {
                endDate.setHours(0, 0, 0, 0);
                if (kDate > endDate) isDateInRange = false;
            }

            return isSiswa && isMapel && isDateInRange;
        });

        const hadir = records.filter(r => r.status === 'H').length;
        const izin = records.filter(r => r.status === 'I').length;
        const sakit = records.filter(r => r.status === 'S').length;
        const alpha = records.filter(r => r.status === 'A').length;
        const totalPertemuan = records.length;

        const persentase = totalPertemuan > 0 ? Math.round((hadir / totalPertemuan) * 100) : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${s.nama}</td>
            <td>${hadir}</td>
            <td>${izin}</td>
            <td>${sakit}</td>
            <td>${alpha}</td>
            <td>${persentase}%</td>
        `;
        tbody.appendChild(tr);
    });
}


function exportAttendanceToExcel() {
    const table = document.querySelector('#view-rekap-kehadiran table');
    if (!table) return;

    // Use SheetJS if available, otherwise fallback to simple HTML export
    if (typeof XLSX !== 'undefined') {
        const wb = XLSX.utils.table_to_book(table, { sheet: "Rekap Kehadiran" });
        XLSX.writeFile(wb, "rekap_kehadiran.xlsx");
    } else {
        const html = table.outerHTML;
        const url = 'data:application/vnd.ms-excel,' + encodeURIComponent(html);
        const downloadLink = document.createElement("a");
        document.body.appendChild(downloadLink);
        downloadLink.href = url;
        downloadLink.download = 'rekap_kehadiran.xls';
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }
}

// --- MOBILE SIDEBAR ---
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// Close sidebar when clicking a nav item on mobile
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    });
});

// --- PWA INSTALLATION ---
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    const installBtn = document.querySelector('button[onclick="installPWA()"]');
    if (installBtn) installBtn.style.display = 'inline-flex';
    console.log('beforeinstallprompt fired');
});

async function installPWA() {
    if (!deferredPrompt) {
        return alert('Aplikasi sudah terinstal atau browser tidak mendukung instalasi otomatis. Silakan gunakan menu browser "Add to Home Screen".');
    }
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
}

window.addEventListener('appinstalled', () => {
    // Hide the app-provided install promotion
    const installBtn = document.querySelector('button[onclick="installPWA()"]');
    if (installBtn) installBtn.style.display = 'none';
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    console.log('PWA was installed');
});

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
