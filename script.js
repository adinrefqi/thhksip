// State Management
const STORAGE_KEY = 'sistem_nilai_data';
const SUPABASE_URL = 'https://syhogxzdcnakccypuedy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aG9neHpkY25ha2NjeXB1ZWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4Mjg1NjUsImV4cCI6MjA4MDQwNDU2NX0.tBmCXNCcsiSMmBA9MyHYSuKdXq67m5TzzhxcOEaB560';

let sb;
if (typeof supabase !== 'undefined') {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
    alert('CRITICAL: Library Supabase tidak termuat. Periksa koneksi internet Anda.');
};

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

// ===================================================
// HELPER FUNCTIONS V2 - For Database Schema V2
// ===================================================

// 1. Get Active Tahun Ajaran
async function getActiveTahunAjaran() {
    try {
        const { data, error } = await sb
            .from('tahun_ajaran')
            .select('*')
            .eq('is_active', true)
            .order('nama_tahun_ajaran', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting tahun ajaran:', error);
        return null;
    }
}

// 2. Get Active Semester
async function getActiveSemester() {
    try {
        const { data, error } = await sb
            .from('semester')
            .select('*, tahun_ajaran(*)')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting semester:', error);
        return null;
    }
}

// 3. Save Nilai dengan Multiple Komponen
async function saveNilaiMultiKomponen(siswaId, mapelId, kategoriId, semesterId, nilaiArray) {
    try {
        // Delete existing nilai untuk kategori ini
        await sb.from('nilai').delete()
            .eq('siswa_id', siswaId)
            .eq('mapel_id', mapelId)
            .eq('kategori_id', kategoriId)
            .eq('semester_id', semesterId);

        // Insert new nilai per komponen
        const records = nilaiArray
            .filter(n => n.nilai !== null && n.nilai !== undefined && n.nilai !== '')
            .map(n => ({
                siswa_id: siswaId,
                mapel_id: mapelId,
                kategori_id: kategoriId,
                semester_id: semesterId,
                komponen_ke: n.komponen_ke,
                nilai: parseFloat(n.nilai)
            }));

        if (records.length === 0) return { success: true };

        const { data, error } = await sb.from('nilai').insert(records);

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Error saving nilai:', error);
        return { success: false, error: error.message };
    }
}

// 4. Get Nilai by Kategori (All Komponen)
async function getNilaiByKategori(siswaId, mapelId, kategoriId, semesterId) {
    try {
        const { data, error } = await sb
            .from('nilai')
            .select('komponen_ke, nilai')
            .eq('siswa_id', siswaId)
            .eq('mapel_id', mapelId)
            .eq('kategori_id', kategoriId)
            .eq('semester_id', semesterId)
            .order('komponen_ke', { ascending: true });

        if (error) throw error;

        // Convert to object: {1: 85, 2: 90, 3: 88, ...}
        const nilaiObj = {};
        (data || []).forEach(n => {
            nilaiObj[n.komponen_ke] = n.nilai;
        });

        return nilaiObj;
    } catch (error) {
        console.error('Error getting nilai:', error);
        return {};
    }
}

// 5. Set Active Tahun Ajaran
async function setActiveTahunAjaran(tahunAjaranId) {
    try {
        // Set all to inactive
        await sb.from('tahun_ajaran').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');

        // Set selected to active
        const { error } = await sb
            .from('tahun_ajaran')
            .update({ is_active: true })
            .eq('id', tahunAjaranId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error setting active tahun ajaran:', error);
        return { success: false, error: error.message };
    }
}

// 6. Set Active Semester
async function setActiveSemester(semesterId) {
    try {
        // Get semester info
        const { data: semester } = await sb
            .from('semester')
            .select('tahun_ajaran_id')
            .eq('id', semesterId)
            .single();

        if (!semester) throw new Error('Semester not found');

        // Set all semester in this tahun ajaran to inactive
        await sb.from('semester')
            .update({ is_active: false })
            .eq('tahun_ajaran_id', semester.tahun_ajaran_id);

        // Set selected to active
        const { error } = await sb
            .from('semester')
            .update({ is_active: true })
            .eq('id', semesterId);

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error setting active semester:', error);
        return { success: false, error: error.message };
    }
}

// 7. Populate Login Dropdowns
async function populateLoginDropdowns() {
    try {
        // Get all tahun ajaran
        const { data: tahunAjaranList, error: taError } = await sb
            .from('tahun_ajaran')
            .select('*')
            .order('nama_tahun_ajaran', { ascending: false });

        if (taError) throw taError;

        const taDropdown = document.getElementById('login-tahun-ajaran');
        if (!taDropdown) return;

        taDropdown.innerHTML = '<option value="">-- Pilih Tahun Ajaran --</option>';

        (tahunAjaranList || []).forEach(ta => {
            const option = document.createElement('option');
            option.value = ta.id;
            option.textContent = ta.nama_tahun_ajaran;
            if (ta.is_active) option.selected = true;
            taDropdown.appendChild(option);
        });

        // Auto load semesters for active tahun ajaran
        const activeTa = tahunAjaranList?.find(ta => ta.is_active);
        if (activeTa) {
            await loadSemestersForLogin(activeTa.id);
        }

        // Add event listener untuk load semester saat tahun ajaran berubah
        taDropdown.addEventListener('change', async (e) => {
            await loadSemestersForLogin(e.target.value);
        });

    } catch (error) {
        console.error('Error populating login dropdowns:', error);
    }
}

// 8. Load Semesters for Login
async function loadSemestersForLogin(tahunAjaranId) {
    const semesterDropdown = document.getElementById('login-semester');
    if (!semesterDropdown) return;

    if (!tahunAjaranId) {
        semesterDropdown.innerHTML = '<option value="">Pilih tahun ajaran dulu</option>';
        return;
    }

    try {
        const { data: semesterList, error } = await sb
            .from('semester')
            .select('*')
            .eq('tahun_ajaran_id', tahunAjaranId)
            .order('nama_semester', { ascending: true });

        if (error) throw error;

        semesterDropdown.innerHTML = '<option value="">-- Pilih Semester --</option>';

        (semesterList || []).forEach(sem => {
            const option = document.createElement('option');
            option.value = sem.id;
            option.textContent = sem.nama_semester;
            if (sem.is_active) option.selected = true;
            semesterDropdown.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading semesters:', error);
        semesterDropdown.innerHTML = '<option value="">Error loading semesters</option>';
    }
}

console.log('✅ Helper functions V2 loaded (inline)');


// Login Logic
// --- LOGIKA LOGIN BARU (SUPABASE AUTH) ---

async function checkLogin() {
    if (!sb) return; // Supabase belum siap

    // Cek apakah ada user yang sedang login di Supabase
    try {
        const { data: { session } } = await sb.auth.getSession();

        if (!session) {
            document.getElementById('login-overlay').classList.remove('hidden');
            // V2: Populate tahun ajaran & semester dropdowns
            await populateLoginDropdowns();
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
    const tahunAjaranId = document.getElementById('login-tahun-ajaran').value;
    const semesterId = document.getElementById('login-semester').value;

    if (!email || !password) {
        return alert('Mohon isi email dan password!');
    }

    // V2: Validasi tahun ajaran dan semester
    if (!tahunAjaranId || !semesterId) {
        return alert('Mohon pilih Tahun Ajaran dan Semester!');
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
            // V2: Set tahun ajaran dan semester yang dipilih sebagai aktif
            await setActiveTahunAjaran(tahunAjaranId);
            await setActiveSemester(semesterId);

            // Reload untuk load data sesuai tahun & semester yang dipilih
            location.reload();
        }
    } catch (err) {
        alert('Terjadi kesalahan saat login: ' + err.message);
    }
}

async function handleLogout() {
    console.log("Logging out (Aggressive)...");

    try {
        // 1. Attempt standard sign out
        if (sb && sb.auth) {
            await sb.auth.signOut();
        }
    } catch (err) {
        console.error("Standard signOut error:", err);
    }

    // 2. FORCE CLEAR LocalStorage Token
    // Supabase default key format: sb-<project_id>-auth-token
    const projectRef = 'syhogxzdcnakccypuedy';
    const key = `sb-${projectRef}-auth-token`;

    // Log for debugging
    console.log("Removing LS Key:", key);
    localStorage.removeItem(key);

    // Also clear any legacy keys just in case
    localStorage.removeItem('supabase.auth.token');

    // 3. UI Reset & Reload
    currentUser = null;
    document.getElementById('login-overlay').classList.remove('hidden');

    setTimeout(() => {
        window.location.reload();
    }, 100);
}

// --- SISTEM ROLE (ADMIN vs GURU) ---

// Global User State
let currentUser = null;

async function checkUserRole(userId) {
    // Ambil data role dari tabel 'profiles'
    // Gunakan select('*') agar mapel_id juga terambil (jika ada kolomnya)
    const { data: profile, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profile) {
        currentUser = profile; // Store global
        console.log("User Login:", profile.nama_lengkap, "Role:", profile.role, "Mapel ID:", profile.mapel_id || '-');

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
                // 'menu-master-data', // Kelas
                // 'menu-master-siswa', // Siswa
                // 'menu-master-mapel', // Mapel - Guru mungkin butuh lihat? Tapi biasanya master data di admin.
                // 'menu-master-kategori', // Kategori
                // 'menu-bobot', // Atur Bobot -> SUDAH DIBUKA UTK GURU
                // 'menu-rekap-nilai', // Rekap Nilai (Guru boleh lihat)
                // 'menu-input-kehadiran', // Input Kehadiran (sudah ada di jurnal)
                // 'menu-rekap-kehadiran', // Rekap Kehadiran
                // 'menu-system', // Reset Data
                'divider-system' // Divider System
            ];

            // Master Mapel & Kategori tetap admin, tapi Bobot dibuka.
            // Kita sembunyikan menu master lainnya
            // UPDATE: User request to show all Master Data
            /* 
            ['menu-master-data', 'menu-master-siswa', 'menu-master-mapel', 'menu-master-kategori', 'menu-system', 'divider-system'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            */
            /*
              // Only hide system divider for now if needed, or nothing. 
              // Commenting out the entire hiding block to prevent "flicker" and layout changes.
            */
        }
    }
}


// --- MIGRATION: Auto Update Year to 2025/2026 ---
async function ensureAcademicYear2025() {
    if (!sb) return;
    try {
        const TA_TARGET = '2025/2026';
        const TA_OLD = '2024/2025';

        // 1. Cek apakah 2025/2026 sudah ada?
        const { data: existingTarget } = await sb
            .from('tahun_ajaran')
            .select('id')
            .eq('nama_tahun_ajaran', TA_TARGET)
            .maybeSingle();

        if (existingTarget) {
            console.log(`Tahun ajaran ${TA_TARGET} sudah ada.`);
            return;
        }

        // 2. Jika belum ada, cek apakah 2024/2025 ada? (Kita rename saja agar ID tetap sama)
        const { data: existingOld } = await sb
            .from('tahun_ajaran')
            .select('id')
            .eq('nama_tahun_ajaran', TA_OLD)
            .maybeSingle();

        if (existingOld) {
            console.log(`Mengupdate ${TA_OLD} menjadi ${TA_TARGET}...`);
            const { error } = await sb
                .from('tahun_ajaran')
                .update({ nama_tahun_ajaran: TA_TARGET })
                .eq('id', existingOld.id);

            if (error) console.error('Gagal update tahun ajaran:', error);
            else console.log('Berhasil update tahun ajaran.');
        } else {
            // Jika 2024/2025 juga tidak ada, buat baru 2025/2026
            console.log(`Membuat tahun ajaran baru ${TA_TARGET}...`);
            // Kita butuh ID kalau insert? generateId() ada di bawah, tapi kita bisa pakai crypto.randomUUID() langsung atau biarkan DB generate (kalau auto gen).
            // Tapi data strukturnya kita lihat di generateId()
            const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'new-uuid-' + Date.now();

            const { error } = await sb
                .from('tahun_ajaran')
                .insert([{
                    nama_tahun_ajaran: TA_TARGET,
                    is_active: true
                }]);

            if (error) console.error('Gagal membuat tahun ajaran:', error);
        }

    } catch (err) {
        console.error('Error ensureAcademicYear2025:', err);
    }
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log("App Initializing...");

    // Run migration
    await ensureAcademicYear2025();

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
        // V2: Get active tahun ajaran & semester first
        const activeTahunAjaran = await getActiveTahunAjaran();
        const activeSemester = await getActiveSemester();

        if (!activeTahunAjaran || !activeSemester) {
            console.warn('Tahun ajaran atau semester aktif tidak ditemukan');
            // Set default empty data
            appData.kelas = [];
            appData.siswa = [];
            appData.mapel = [];
            appData.kategori = [];
            appData.jurnal = [];
            appData.kehadiran = [];
            appData.bobot = {};
            appData.nilai = {};
            updateDashboardStats();
            return;
        }

        // Store active state
        appData.activeTahunAjaran = activeTahunAjaran;
        appData.activeSemester = activeSemester;

        console.log('Loading data for:', activeTahunAjaran.nama_tahun_ajaran, '-', activeSemester.nama_semester);

        // Load data filtered by active tahun ajaran & semester
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
            sb.from('kelas').select('*').eq('tahun_ajaran_id', activeTahunAjaran.id),
            sb.from('siswa').select('*').eq('tahun_ajaran_id', activeTahunAjaran.id),
            sb.from('mapel').select('*'),
            sb.from('kategori').select('*').order('urutan', { ascending: true }),
            sb.from('jurnal').select('*').eq('semester_id', activeSemester.id),
            sb.from('bobot').select('*'),
            sb.from('nilai').select('*').eq('semester_id', activeSemester.id),
            sb.from('kehadiran').select('*').eq('semester_id', activeSemester.id)
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
            // V3: Store as object to include component count
            appData.bobot[b.mapel_id][b.kategori_id] = {
                weight: b.nilai_bobot,
                count: b.jumlah_komponen || 1
            };
        });

        // Transform Nilai - V2: Handle komponen_ke
        appData.nilai = {};
        const gradeCount = (nilai || []).length;
        console.log(`[DEBUG] Loaded ${gradeCount} grades from DB for Semester: ${activeSemester.nama_semester}`);

        (nilai || []).forEach(n => {
            if (!appData.nilai[n.siswa_id]) appData.nilai[n.siswa_id] = {};
            if (!appData.nilai[n.siswa_id][n.mapel_id]) appData.nilai[n.siswa_id][n.mapel_id] = {};
            if (!appData.nilai[n.siswa_id][n.mapel_id][n.kategori_id]) {
                appData.nilai[n.siswa_id][n.mapel_id][n.kategori_id] = {};
            }

            let val = n.nilai;
            // CHECK FOR LEGACY JSON STRING (e.g. {"k1":90})
            if (typeof val === 'string' && (val.trim().startsWith('{') || val.trim().startsWith('['))) {
                try {
                    const parsed = JSON.parse(val);
                    // Merge parsed legacy data
                    Object.keys(parsed).forEach(k => {
                        let compNum = 1;
                        if (k.startsWith('k')) compNum = parseInt(k.substring(1)) || 1;
                        else if (!isNaN(k)) compNum = parseInt(k);

                        appData.nilai[n.siswa_id][n.mapel_id][n.kategori_id][compNum] = parsed[k];
                    });
                    return; // Skip standard assignment
                } catch (e) {
                    console.warn("Failed to parse legacy nilai JSON", e);
                }
            }

            // Standard assignment (New Format)
            appData.nilai[n.siswa_id][n.mapel_id][n.kategori_id][n.komponen_ke] = n.nilai;
        });

        if (gradeCount > 0) {
            console.log('[DEBUG] Sample Transformed Data (Siswa ID: ' + nilai[0].siswa_id + '):', appData.nilai[nilai[0].siswa_id]);
        }

        updateDashboardStats();
        renderAllTables();

        // Ensure UI is refreshed if we are already on the Input Nilai view
        const currentView = document.querySelector('.view-section.active');
        if (currentView && currentView.id === 'view-input-nilai') {
            prepareInputNilai();
        }

        // V2: Update display tahun ajaran & semester
        try {
            await updateDashboardUI();
            console.log('✅ Dashboard UI updated');
        } catch (uiError) {
            console.error('Error updating dashboard UI:', uiError);
        }

        console.log('✅ Data loaded successfully');
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
            if (targetId === 'pengguna') {
                renderUserTable();
            }
            if (targetId === 'input-hafalan') {
                renderKelasOptions('hafalan-kelas');
                // No mapel options needed
            }
            if (targetId === 'data-hafalan') {
                renderMasterHafalanTable();
            }
        });
    });
}

// Update Dashboard UI - V2: Display Tahun Ajaran & Semester
async function updateDashboardUI() {
    // Populate tahun ajaran dropdown
    try {
        const { data: tahunAjaranList, error } = await sb
            .from('tahun_ajaran')
            .select('*')
            .order('nama_tahun_ajaran', { ascending: false });

        const taDropdown = document.getElementById('switch-tahun-ajaran');

        if (error || !tahunAjaranList || tahunAjaranList.length === 0) {
            console.error('Error loading tahun ajaran:', error);
            if (taDropdown) {
                taDropdown.innerHTML = '<option value="">📅 No data</option>';
            }
        } else {
            if (taDropdown) {
                taDropdown.innerHTML = '';
                tahunAjaranList.forEach(ta => {
                    const option = document.createElement('option');
                    option.value = ta.id;
                    option.textContent = `📅 ${ta.nama_tahun_ajaran}`;
                    if (ta.is_active || (appData.activeTahunAjaran && ta.id === appData.activeTahunAjaran.id)) {
                        option.selected = true;
                    }
                    taDropdown.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading tahun ajaran dropdown:', error);
        const taDropdown = document.getElementById('switch-tahun-ajaran');
        if (taDropdown) {
            taDropdown.innerHTML = '<option value="">📅 Error</option>';
        }
    }

    // Populate semester dropdown
    if (appData.activeTahunAjaran) {
        try {
            const { data: semesterList, error } = await sb
                .from('semester')
                .select('*')
                .eq('tahun_ajaran_id', appData.activeTahunAjaran.id)
                .order('nama_semester', { ascending: true });

            const semDropdown = document.getElementById('switch-semester');

            if (error || !semesterList || semesterList.length === 0) {
                console.error('Error loading semester:', error);
                if (semDropdown) {
                    semDropdown.innerHTML = '<option value="">📖 No data</option>';
                }
            } else {
                if (semDropdown) {
                    semDropdown.innerHTML = '';
                    semesterList.forEach(sem => {
                        const option = document.createElement('option');
                        option.value = sem.id;
                        option.textContent = `📖 Semester ${sem.nama_semester}`;
                        if (sem.is_active || (appData.activeSemester && sem.id === appData.activeSemester.id)) {
                            option.selected = true;
                        }
                        semDropdown.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading semester dropdown:', error);
            const semDropdown = document.getElementById('switch-semester');
            if (semDropdown) {
                semDropdown.innerHTML = '<option value="">📖 Error</option>';
            }
        }
    } else {
        // No active tahun ajaran
        const semDropdown = document.getElementById('switch-semester');
        if (semDropdown) {
            semDropdown.innerHTML = '<option value="">📖 No tahun ajaran</option>';
        }
    }
}

// Handle Switch Tahun Ajaran
async function handleSwitchTahunAjaran(tahunAjaranId) {
    if (!tahunAjaranId) return;

    if (confirm('Ganti tahun ajaran? Data akan dimuat ulang.')) {
        // Set as active
        await setActiveTahunAjaran(tahunAjaranId);

        // Reload page to load new data
        location.reload();
    } else {
        // Revert selection
        updateDashboardUI();
    }
}

// Handle Switch Semester
async function handleSwitchSemester(semesterId) {
    if (!semesterId) return;

    if (confirm('Ganti semester? Data akan dimuat ulang.')) {
        // Set as active
        await setActiveSemester(semesterId);

        // Reload page to load new data
        location.reload();
    } else {
        // Revert selection
        updateDashboardUI();
    }
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
        document.getElementById('kategori-jumlah').value = '1';
        document.getElementById('kategori-prefix').value = '';
    }

    if (modalId === 'modal-user-edit') {
        renderMapelOptions('edit-user-mapel');
        // Add default 'None' option
        const select = document.getElementById('edit-user-mapel');
        if (select) {
            const defaultOpt = document.createElement('option');
            defaultOpt.value = "";
            defaultOpt.textContent = "-- Tidak Ada / Bukan Guru Mapel --";
            select.insertBefore(defaultOpt, select.firstChild);
            // Re-select if needed later
        }
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

    // V2: Get active tahun ajaran
    const activeTahunAjaran = await getActiveTahunAjaran();
    if (!activeTahunAjaran) {
        return alert('Tahun ajaran aktif tidak ditemukan! Hubungi administrator.');
    }

    // V2: Auto-detect tingkat from nama_kelas
    let tingkat = 7; // default
    if (nama.match(/^VII/i) || nama.match(/^7/)) tingkat = 7;
    else if (nama.match(/^VIII/i) || nama.match(/^8/)) tingkat = 8;
    else if (nama.match(/^IX/i) || nama.match(/^9/)) tingkat = 9;

    const kelasData = {
        id: id || generateId(),
        nama_kelas: nama,
        tahun_ajaran_id: activeTahunAjaran.id,
        tingkat: tingkat
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

    // V2: Get active tahun ajaran
    const activeTahunAjaran = await getActiveTahunAjaran();
    if (!activeTahunAjaran) {
        return alert('Tahun ajaran aktif tidak ditemukan! Hubungi administrator.');
    }

    const siswaData = {
        id: id || generateId(),
        nama,
        nis,
        kelas_id: kelasId,
        tahun_ajaran_id: activeTahunAjaran.id
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

    // Calculate urutan for new kategori (highest + 1)
    let urutan = 0;
    if (!id) {
        // New kategori - get max urutan and add 1
        const maxUrutan = appData.kategori.reduce((max, k) => Math.max(max, k.urutan || 0), 0);
        urutan = maxUrutan + 1;
    } else {
        // Editing existing - keep the current urutan
        const existingKategori = appData.kategori.find(k => k.id === id);
        urutan = existingKategori ? existingKategori.urutan : 0;
    }

    const kategoriData = {
        id: id || generateId(),
        nama_kategori: nama,
        tipe_kategori: tipe,
        jumlah_komponen: jumlah,
        prefix_komponen: prefix,
        urutan: urutan
    };

    const { error } = await sb.from('kategori').upsert([kategoriData]);

    if (error) return alert('Gagal menyimpan: ' + error.message);

    if (id) {
        const index = appData.kategori.findIndex(k => k.id === id);
        if (index !== -1) appData.kategori[index] = kategoriData;
    } else {
        appData.kategori.push(kategoriData);
    }

    // Re-sort after adding/editing
    appData.kategori.sort((a, b) => (a.urutan || 0) - (b.urutan || 0));

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

        const isFirst = index === 0;
        const isLast = index === appData.kategori.length - 1;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${k.nama_kategori}</td>
            <td><span class="badge ${badgeClass}">${tipe.toUpperCase()}</span></td>
            <td>${jumlah} komponen</td>
            <td>${prefix}</td>
            <td class="action-buttons">
                <div class="reorder-buttons">
                    <button class="btn-reorder btn-up ${isFirst ? 'disabled' : ''}" onclick="moveKategori('${k.id}', 'up')" ${isFirst ? 'disabled' : ''} title="Pindah Ke Atas">
                        <i class="fa-solid fa-chevron-up"></i>
                    </button>
                    <button class="btn-reorder btn-down ${isLast ? 'disabled' : ''}" onclick="moveKategori('${k.id}', 'down')" ${isLast ? 'disabled' : ''} title="Pindah Ke Bawah">
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>
                <button class="btn-secondary" onclick="editKategori('${k.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" onclick="deleteKategori('${k.id}')" title="Hapus"><i class="fa-solid fa-trash"></i></button>
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

// Move kategori up or down - Persistent ordering in database
async function moveKategori(id, direction) {
    const currentIndex = appData.kategori.findIndex(k => k.id === id);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Boundary check
    if (newIndex < 0 || newIndex >= appData.kategori.length) return;

    // Get the two items that will be swapped
    const currentKategori = appData.kategori[currentIndex];
    const swapKategori = appData.kategori[newIndex];

    // Swap urutan values
    const tempUrutan = currentKategori.urutan || currentIndex;
    currentKategori.urutan = swapKategori.urutan || newIndex;
    swapKategori.urutan = tempUrutan;

    // Swap positions in local array
    appData.kategori[currentIndex] = swapKategori;
    appData.kategori[newIndex] = currentKategori;

    // Update order in database - save both categories
    try {
        const updates = [
            sb.from('kategori').update({ urutan: currentKategori.urutan }).eq('id', currentKategori.id),
            sb.from('kategori').update({ urutan: swapKategori.urutan }).eq('id', swapKategori.id)
        ];

        const results = await Promise.all(updates);
        const hasError = results.some(r => r.error);

        if (hasError) {
            console.error('Error updating urutan:', results.map(r => r.error).filter(Boolean));
            // Optionally show alert but don't block UI
        } else {
            console.log(`✅ Kategori ${currentKategori.nama_kategori} moved ${direction} - urutan persisted`);
        }
    } catch (err) {
        console.error('Failed to update urutan in database:', err);
    }

    // Re-render table with animation effect
    renderKategoriTable();
}

// --- JURNAL MANAGEMENT ---
// Helper to load students for journal (Promise-based)
function loadSiswaForJurnal(kelasId) {
    return new Promise((resolve) => {
        const container = document.getElementById('jurnal-siswa-list');
        if (!container) return resolve();

        if (!kelasId) {
            container.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">Pilih Kelas untuk memuat daftar siswa.</p>';
            return resolve();
        }

        const siswaInKelas = appData.siswa.filter(s => s.kelasId === kelasId);

        if (siswaInKelas.length === 0) {
            container.innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">Tidak ada siswa di kelas ini.</p>';
            return resolve();
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
        resolve();
    });
}

function renderJurnalSiswaList() {
    const kelasId = document.getElementById('jurnal-kelas').value;
    loadSiswaForJurnal(kelasId);
}

async function addJurnal() {
    const tanggal = document.getElementById('jurnal-tanggal').value;
    const kelasId = document.getElementById('jurnal-kelas').value;
    const mapelId = document.getElementById('jurnal-mapel').value;
    const materi = document.getElementById('jurnal-materi').value;
    const metode = document.getElementById('jurnal-metode').value;
    const catatan = document.getElementById('jurnal-catatan').value;

    // Check for hidden edit ID
    const hiddenIdInput = document.getElementById('jurnal-id-hidden');
    const editId = hiddenIdInput ? hiddenIdInput.value : null;

    if (!tanggal || !kelasId || !mapelId || !materi) return alert('Tanggal, Kelas, Mapel, dan Materi wajib diisi!');

    const activeSemesterId = appData.activeSemester ? appData.activeSemester.id : null;
    if (!activeSemesterId) return alert('Semester aktif tidak ditemukan! Harap refresh halaman.');

    const newJurnal = {
        id: editId || generateId(), // Use existing ID if editing
        tanggal,
        kelas_id: kelasId,
        mapel_id: mapelId,
        semester_id: activeSemesterId,
        materi,
        metode,
        catatan
    };

    let error = null;

    if (editId) {
        // UPDATE MODE
        const { error: updateError } = await sb.from('jurnal').update(newJurnal).eq('id', editId);
        error = updateError;

        // Remove old local data to be replaced
        appData.jurnal = appData.jurnal.filter(j => j.id !== editId);
    } else {
        // INSERT MODE
        const { error: insertError } = await sb.from('jurnal').insert([newJurnal]);
        error = insertError;
    }

    if (error) return alert('Gagal menyimpan jurnal: ' + error.message);

    // Save Attendance (Upsert logic works for both)
    const siswaItems = document.querySelectorAll('input[name^="jurnal-status-"]:checked');
    if (siswaItems.length > 0) {
        const kehadiranToSave = [];
        siswaItems.forEach(item => {
            const siswaId = item.name.replace('jurnal-status-', '');
            // We need persistent IDs for attendance to avoid churn, but simple wipe/rewrite for scope is easier for sync
            kehadiranToSave.push({
                // Generate new ID is fine for log, but maybe we want to keep stable IDs? 
                // For simplicity: generate new and rely on unique constraint or delete-insert scope.
                // We'll use the delete-insert scope below.
                tanggal,
                kelas_id: kelasId,
                mapel_id: mapelId,
                siswa_id: siswaId,
                semester_id: activeSemesterId,
                status: item.value,
                keterangan: ''
            });
        });

        // Delete existing for this scope (safer for full sync)
        await sb.from('kehadiran').delete().match({
            tanggal,
            kelas_id: kelasId,
            mapel_id: mapelId,
            semester_id: activeSemesterId
        });

        // Insert fresh
        const { error: absensiError } = await sb.from('kehadiran').insert(kehadiranToSave);
        if (absensiError) console.error('Gagal menyimpan absensi:', absensiError);

        // Update local state
        // Remove ANY old attendance for this scope first
        appData.kehadiran = appData.kehadiran.filter(k =>
            !(k.kelasId === kelasId && k.mapelId === mapelId && k.tanggal === tanggal)
        );
        // Add new
        kehadiranToSave.forEach(k => {
            // Need ID for local? Ideally yes. Assume DB autogen or needed. 
            // Local-only ID:
            appData.kehadiran.push({ ...k, id: generateId(), kelasId: k.kelas_id, mapelId: k.mapel_id, siswaId: k.siswa_id });
        });
    }

    appData.jurnal.push({ ...newJurnal, kelasId, mapelId });

    // Clear Edit ID
    if (hiddenIdInput) hiddenIdInput.value = '';

    renderJurnalTable();
    closeModal('modal-jurnal');

    document.getElementById('jurnal-materi').value = '';
    document.getElementById('jurnal-metode').value = '';
    document.getElementById('jurnal-catatan').value = '';
    document.getElementById('jurnal-siswa-list').innerHTML = '<p class="text-muted" style="text-align: center; font-size: 0.9rem;">Pilih Kelas untuk memuat daftar siswa.</p>';
}

function renderJurnalTable() {
    const tbody = document.getElementById('table-jurnal-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Sort by date descending
    const sortedJurnal = [...appData.jurnal].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

    sortedJurnal.forEach((j, index) => {
        const kelas = appData.kelas.find(k => k.id === j.kelasId);
        const mapel = appData.mapel.find(m => m.id === j.mapelId);

        // Calculate Attendance for this specific journal entry (based on implicit context: date, class, mapel)
        // Note: Attendance is stored in appData.kehadiran with fields: tanggal, kelasId, mapelId, siswaId, status
        const relatedAttendance = appData.kehadiran.filter(k =>
            k.kelasId === j.kelasId &&
            k.mapelId === j.mapelId &&
            k.tanggal === j.tanggal
        );

        const getNames = (status) => {
            return relatedAttendance
                .filter(a => a.status === status)
                .map(a => {
                    const s = appData.siswa.find(siswa => siswa.id === a.siswaId);
                    return s ? s.nama : '?';
                })
                .join(', ');
        };

        const countS = relatedAttendance.filter(a => a.status === 'S').length;
        const countI = relatedAttendance.filter(a => a.status === 'I').length;
        const countA = relatedAttendance.filter(a => a.status === 'A').length;

        const namesS = getNames('S') || 'Tidak ada';
        const namesI = getNames('I') || 'Tidak ada';
        const namesA = getNames('A') || 'Tidak ada';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${j.tanggal}</td>
            <td>${kelas ? kelas.nama_kelas : '-'}</td>
            <td>${mapel ? mapel.nama_mapel : '-'}</td>
            <td>${j.materi}</td>
            <td>${j.metode || '-'}</td>
            <td class="text-center" style="cursor: help; color: #d97706; font-weight: bold;" title="Sakit: ${namesS}">${countS > 0 ? countS : '-'}</td>
            <td class="text-center" style="cursor: help; color: #2563eb; font-weight: bold;" title="Izin: ${namesI}">${countI > 0 ? countI : '-'}</td>
            <td class="text-center" style="cursor: help; color: #dc2626; font-weight: bold;" title="Alpha: ${namesA}">${countA > 0 ? countA : '-'}</td>
            <td>
                <div style="display: flex; gap: 5px; justify-content: center;">
                    <button class="btn-secondary btn-icon" onclick="editJurnal('${j.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-danger btn-icon" onclick="deleteJurnal('${j.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editJurnal(id) {
    const j = appData.jurnal.find(j => j.id === id);
    if (!j) return;

    openModal('modal-jurnal');

    // Set basic fields
    document.getElementById('jurnal-tanggal').value = j.tanggal;
    document.getElementById('jurnal-kelas').value = j.kelasId;
    document.getElementById('jurnal-mapel').value = j.mapelId;
    document.getElementById('jurnal-materi').value = j.materi;
    document.getElementById('jurnal-metode').value = j.metode || '';
    document.getElementById('jurnal-catatan').value = j.catatan || '';

    // Trigger load siswa for this class, then populate attendance
    loadSiswaForJurnal(j.kelasId).then(() => {
        // Find attendance for this journal entry context
        const relatedAttendance = appData.kehadiran.filter(k =>
            k.kelasId === j.kelasId &&
            k.mapelId === j.mapelId &&
            k.tanggal === j.tanggal
        );

        relatedAttendance.forEach(att => {
            const radio = document.querySelector(`input[name="jurnal-status-${att.siswaId}"][value="${att.status}"]`);
            if (radio) radio.checked = true;
        });
    });

    // Note: Saving will create a new entry currently if not handled carefully.
    // Ideally we should have an 'id' hidden field or 'mode' edit.
    // For simplicity, we can delete the old one on save OR update logic. 
    // Given the current saveJurnal logic pushes new, we need to adapt it. 
    // BUT the user just asked for the button. Let's make "edit" actually just delete old and create new for now or add a hidden ID field.
    // Better: Add hidden ID field.
    let hiddenId = document.getElementById('jurnal-id-hidden');
    if (!hiddenId) {
        hiddenId = document.createElement('input');
        hiddenId.type = 'hidden';
        hiddenId.id = 'jurnal-id-hidden';
        document.querySelector('#modal-jurnal .modal-body').appendChild(hiddenId);
    }
    hiddenId.value = j.id;
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
        // Handle new object structure or fallback
        const savedData = currentWeights[k.id];
        const weightVal = (savedData && typeof savedData === 'object') ? savedData.weight : (savedData || 0);
        // Default count is 1 if not set in bobot. Use Category default if available? No, default 1 is safer.
        const countVal = (savedData && typeof savedData === 'object') ? (savedData.count || 1) : (k.jumlah_komponen || 1);

        const div = document.createElement('div');
        div.className = 'bobot-item';
        // Add minimal styling for layout
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'space-between';
        div.style.marginBottom = '12px';
        div.style.padding = '12px';
        div.style.border = '1px solid #e2e8f0';
        div.style.borderRadius = '8px';
        div.style.backgroundColor = '#fff';

        div.innerHTML = `
            <div style="flex: 2; padding-right: 15px;">
                <label style="font-weight:600; font-size: 14px; margin-bottom: 2px; display: block;">${k.nama_kategori}</label>
                <small class="text-muted" style="display:block; font-size: 12px; line-height: 1.2;">Atur jumlah komponen penilaian (misal: TP) dan bobot %</small>
            </div>
            <div style="flex: 1; margin-right: 15px;">
                <label style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px; display: block;">Jml Komponen</label>
                <input type="number" class="form-control bobot-count" 
                       data-kategori="${k.id}" 
                       value="${countVal}" 
                       min="1" max="20"
                       style="font-size: 14px;">
            </div>
            <div style="flex: 1;">
                <label style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px; display: block;">Bobot (%)</label>
                <div style="display: flex; align-items: center;">
                    <input type="number" class="form-control bobot-input" 
                           data-kategori="${k.id}" 
                           value="${weightVal}" 
                           min="0" max="100" oninput="calculateTotalBobot()"
                           style="border-top-right-radius: 0; border-bottom-right-radius: 0; font-size: 14px;">
                    <span style="background: #e2e8f0; padding: 6px 10px; border: 1px solid #cbd5e1; border-left: 0; border-radius: 0 4px 4px 0; font-size: 13px;">%</span>
                </div>
            </div>
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
    const countInputs = document.querySelectorAll('.bobot-count');

    let total = 0;
    const weightsToSave = [];

    // Helper to find count input by category ID
    const getCount = (catId) => {
        const el = Array.from(countInputs).find(i => i.dataset.kategori === catId);
        return el ? parseInt(el.value || 1) : 1;
    };

    // Fetch existing weights to ensure we update correctly (get IDs)
    const { data: existingWeights, error: fetchError } = await sb
        .from('bobot')
        .select('id, kategori_id')
        .eq('mapel_id', mapelId);

    if (fetchError) return alert('Gagal mengambil data bobot lama: ' + fetchError.message);

    const weightMap = {};
    (existingWeights || []).forEach(w => weightMap[w.kategori_id] = w.id);

    inputs.forEach(input => {
        const val = parseInt(input.value || 0);
        const catId = input.dataset.kategori;
        const countVal = getCount(catId);

        total += val;
        weightsToSave.push({
            id: weightMap[catId] || generateId(),
            mapel_id: mapelId,
            kategori_id: catId,
            nilai_bobot: val,
            jumlah_komponen: countVal // Save the dynamic component count
        });
    });

    if (total !== 100) return alert(`Total bobot harus 100%! Saat ini: ${total}%`);

    // Upsert to Supabase
    // Note: ensure 'jumlah_komponen' column exists in 'bobot' table
    const { error } = await sb.from('bobot').upsert(weightsToSave);
    if (error) return alert('Gagal menyimpan bobot: ' + error.message);

    // Update local state
    if (!appData.bobot[mapelId]) appData.bobot[mapelId] = {};
    weightsToSave.forEach(w => {
        appData.bobot[mapelId][w.kategori_id] = { weight: w.nilai_bobot, count: w.jumlah_komponen };
    });

    alert('Pengaturan bobot dan komponen berhasil disimpan!');
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

    // Determine component count: Check bobot config first, then fall back to category default
    const bobotConfig = (appData.bobot[mapelId] && appData.bobot[mapelId][kategoriId]) ? appData.bobot[mapelId][kategoriId] : null;
    const jumlahKomponen = (bobotConfig && bobotConfig.count) ? parseInt(bobotConfig.count) : (selectedKategori.jumlah_komponen || 1);
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
                if (typeof komponenData === 'object') {
                    // 1. Check direct key (integer or string match)
                    if (komponenData[i] !== undefined) {
                        currentScore = komponenData[i];
                    }
                    // 2. Check string key "1", "2" explicit
                    else if (komponenData[String(i)] !== undefined) {
                        currentScore = komponenData[String(i)];
                    }
                    // 3. Check "k1" format (legacy JSON)
                    else if (komponenData[`k${i}`] !== undefined) {
                        currentScore = komponenData[`k${i}`];
                    }
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
                           value="${currentScore !== '' ? currentScore : ''}" 
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
    const kelasId = document.getElementById('input-kelas').value;

    if (!mapelId || !kategoriId) return alert('Data belum lengkap! Pilih Mapel dan Kategori.');

    const selectedKategori = appData.kategori.find(k => k.id === kategoriId);
    if (!selectedKategori) return alert('Kategori tidak ditemukan!');

    const activeSemesterId = appData.activeSemester ? appData.activeSemester.id : null;
    if (!activeSemesterId) return alert('Semester aktif tidak ditemukan! Harap refresh halaman.');

    const inputs = document.querySelectorAll('.input-score');
    let count = 0;

    // Group inputs by siswa
    const siswaScores = {};
    inputs.forEach(input => {
        const siswaId = input.dataset.siswa;
        const komponenIndex = parseInt(input.dataset.komponen);
        const score = input.value;

        if (!siswaScores[siswaId]) {
            siswaScores[siswaId] = []; // Array of objects
        }

        // Always push, even if empty, or just push valid ones?
        // saveNilaiMultiKomponen filters valid ones.
        // We push what we have.
        siswaScores[siswaId].push({
            komponen_ke: komponenIndex,
            nilai: score
        });
    });

    // Process each student
    const promises = [];
    for (const [siswaId, nilaiArray] of Object.entries(siswaScores)) {
        // Only save if there's at least one value filled? Or logic in helper handles deletion if all empty?
        // Helper deletes then inserts. If nilaiArray has non-empty values, they get inserted.
        // If all empty, it just deletes old values (which is correct - clearing grades).
        promises.push(saveNilaiMultiKomponen(siswaId, mapelId, kategoriId, activeSemesterId, nilaiArray));
        count++;
    }

    if (count === 0) return alert('Tidak ada siswa untuk disimpan.');

    // Show loading indicator
    const btn = document.querySelector('button[onclick="saveGrades()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
    btn.disabled = true;

    try {
        const results = await Promise.all(promises);
        const failures = results.filter(r => !r.success);

        if (failures.length > 0) {
            console.error('Errors saving grades:', failures);
            alert(`Gagal menyimpan nilai untuk ${failures.length} siswa. Cek koneksi dan coba lagi.`);
        } else {
            // Update local state ONLY on success (reload from DB or update manually)
            // Simple way: reload page or fetch data again.
            // Better: Update local appData.nilai manually to reflect changes without reload
            for (const [siswaId, nilaiArray] of Object.entries(siswaScores)) {
                if (!appData.nilai[siswaId]) appData.nilai[siswaId] = {};
                if (!appData.nilai[siswaId][mapelId]) appData.nilai[siswaId][mapelId] = {};
                if (!appData.nilai[siswaId][mapelId][kategoriId]) appData.nilai[siswaId][mapelId][kategoriId] = {};

                // Clear old cache for this category
                appData.nilai[siswaId][mapelId][kategoriId] = {};

                // Update new
                nilaiArray.forEach(n => {
                    if (n.nilai !== '' && n.nilai !== null) {
                        appData.nilai[siswaId][mapelId][kategoriId][n.komponen_ke] = parseFloat(n.nilai);
                    }
                });
            }

            alert('Data nilai berhasil disimpan!');
            // Refresh table to ensure UI sync
            prepareInputNilai();
        }
    } catch (err) {
        alert('Terjadi kesalahan sistem: ' + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
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
                        if (typeof nilaiData === 'object') {
                            if (nilaiData[i] !== undefined) komponenScore = parseFloat(nilaiData[i]) || 0;
                            else if (nilaiData[String(i)] !== undefined) komponenScore = parseFloat(nilaiData[String(i)]) || 0;
                            else if (nilaiData[`k${i}`] !== undefined) komponenScore = parseFloat(nilaiData[`k${i}`]) || 0;
                        }
                    }
                    kategoriScores.push(komponenScore);
                    rowHTML += `<td>${komponenScore !== 0 ? komponenScore : (komponenScore === 0 ? '0' : '-')}</td>`;
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
                    if (typeof nilaiData === 'object') {
                        // Check integer key first (new standard)
                        if (nilaiData[1] !== undefined) kategoriAverage = parseFloat(nilaiData[1]) || 0;
                        // Check string key
                        else if (nilaiData['1'] !== undefined) kategoriAverage = parseFloat(nilaiData['1']) || 0;
                        // Check legacy k1
                        else if (nilaiData.k1 !== undefined) kategoriAverage = parseFloat(nilaiData.k1) || 0;
                    } else if (typeof nilaiData === 'number') {
                        kategoriAverage = nilaiData;
                    }
                }
                rowHTML += `<td>${kategoriAverage !== 0 ? kategoriAverage : (kategoriAverage === 0 ? '0' : '-')}</td>`;
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
    // Filter jika Guru (New Logic for Class Assignment)
    let kelasToShow = appData.kelas;

    if (currentUser && currentUser.role !== 'admin') {
        let allowedKelas = [];
        // Check array-based class permission
        if (currentUser.kelas_ids) {
            try {
                const ids = JSON.parse(currentUser.kelas_ids);
                if (Array.isArray(ids) && ids.length > 0) {
                    allowedKelas = appData.kelas.filter(k => ids.includes(k.id));
                }
            } catch (e) { console.error('Parse kelas_ids error', e); }
        }

        // If no classes assigned explicitly, maybe allow all OR restrict?
        // User request "tambahkan kelas juga" implies restriction.
        // If allowedKelas is found, use it. If not, default to all (for backward comp) OR none.
        // Let's implement strict: if key exists but empty, none. If key null, all (legacy behavior).
        if (currentUser.kelas_ids) {
            kelasToShow = allowedKelas;
        }
    }

    kelasToShow.forEach(k => {
        const option = document.createElement('option');
        option.value = k.id;
        option.textContent = k.nama_kelas;
        select.appendChild(option);
    });
}

// Helper: Render Mapel Options (Smart Filter 2.0)
function renderMapelOptions(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">-- Pilih Mapel --</option>';

    let mapelsToShow = appData.mapel;

    // Filter jika Guru
    if (currentUser && currentUser.role !== 'admin') {
        let allowedMapels = [];

        // Check new array-based permission
        if (currentUser.mapel_ids) {
            try {
                const ids = JSON.parse(currentUser.mapel_ids);
                if (Array.isArray(ids)) {
                    allowedMapels = appData.mapel.filter(m => ids.includes(m.id));
                }
            } catch (e) { console.error('Parse mapel_ids error', e); }
        }

        // Fallback or Merge with legacy mapel_id
        if (currentUser.mapel_id) {
            const legacyMapel = appData.mapel.find(m => m.id === currentUser.mapel_id);
            if (legacyMapel && !allowedMapels.some(m => m.id === legacyMapel.id)) {
                allowedMapels.push(legacyMapel);
            }
        }

        if (allowedMapels.length > 0) {
            mapelsToShow = allowedMapels;
        } else {
            // Jika guru belum diplot mapel
            mapelsToShow = [];
            const opt = document.createElement('option');
            opt.textContent = "(Hubungi Admin untuk setting Mapel)";
            opt.disabled = true;
            select.appendChild(opt);
        }
    }

    mapelsToShow.forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = m.nama_mapel;
        select.appendChild(option);
    });

    // Auto select if only 1 (UX Improvement)
    if (mapelsToShow.length === 1) {
        select.value = mapelsToShow[0].id;
        // Trigger event manual agar UI terupdate (misal tabel nilai atau bobot muncul)
        select.dispatchEvent(new Event('change'));
    }
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

async function resetData() {
    const keyword = prompt('PERINGATAN: Semua data (Siswa, Kelas, Nilai, dll) akan dihapus permanen! Masukkan "smpthhkok" untuk konfirmasi:');
    if (keyword === 'smpthhkok') {
        const btn = event?.target;
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;
        }

        try {
            // Delete all data from tables (except tahun_ajaran, semester, profiles)
            const tables = ['nilai', 'kehadiran', 'jurnal', 'bobot', 'siswa', 'kelas', 'mapel', 'kategori', 'hafalan'];

            for (const table of tables) {
                const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                if (error) console.error(`Error deleting ${table}:`, error);
            }

            localStorage.removeItem(STORAGE_KEY); // Clear any legacy local storage
            alert('Semua data berhasil dihapus!');
            location.reload();
        } catch (error) {
            console.error('Reset Data Error:', error);
            alert('Gagal reset data: ' + error.message);
            if (btn) {
                btn.innerHTML = 'Reset Semua';
                btn.disabled = false;
            }
        }
    } else if (keyword !== null) {
        alert('Kode konfirmasi salah. Batal.');
    }
}

async function resetDataNilaiOnly() {
    const keyword = prompt('PERINGATAN: Semua DATA NILAI akan dihapus permanen! Masukkan "smpthhkok" untuk konfirmasi:');
    if (keyword === 'smpthhkok') {
        const btn = document.querySelector('button[onclick="resetDataNilaiOnly()"]');
        const originalText = btn ? btn.innerHTML : 'Hapus Nilai';
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;
        }

        try {
            // Delete from NILAI table only
            const { error: errNilai } = await sb.from('nilai').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Safe delete all
            if (errNilai) throw errNilai;

            alert('Data nilai berhasil dihapus. Sistem bersih.');
            location.reload();
        } catch (error) {
            console.error('Reset Nilai Error:', error);
            alert('Gagal reset nilai: ' + error.message);
        } finally {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    } else if (keyword !== null) {
        alert('Kode konfirmasi salah. Batal.');
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
    // Create sample data with correct headers
    const templateData = [
        { NIS: '001', Nama: 'Contoh Siswa 1', Kelas: 'VII-A' },
        { NIS: '002', Nama: 'Contoh Siswa 2', Kelas: 'VII-B' },
        { NIS: '003', Nama: 'Contoh Siswa 3', Kelas: 'VIII-A' }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Adjust column widths
    ws['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 10 }];

    XLSX.utils.book_append_sheet(wb, ws, "Template Siswa");
    XLSX.writeFile(wb, "template_siswa.xlsx");
}

async function handleStudentImport(input) {
    const file = input.files[0];
    if (!file) return;

    try {
        console.log('[IMPORT V2] Starting import...');

        // 1. Get Active Tahun Ajaran FIRST
        const activeTahunAjaran = await getActiveTahunAjaran();
        if (!activeTahunAjaran) {
            alert('❌ Gagal: Tahun ajaran aktif tidak ditemukan!');
            input.value = '';
            return;
        }
        console.log('[IMPORT V2] Active Tahun Ajaran:', activeTahunAjaran);

        // 2. Read File
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Read as JSON Objects (auto headers)
                const rows = XLSX.utils.sheet_to_json(worksheet);
                console.log('[IMPORT V2] Rows read:', rows.length);

                if (rows.length === 0) {
                    alert('❌ File Excel kosong!');
                    input.value = '';
                    return;
                }

                // 3. Process Data
                const siswaData = [];
                const errors = [];
                const successRows = [];

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];

                    // Normalize keys (case insensitive)
                    const normalizedRow = {};
                    Object.keys(row).forEach(key => {
                        normalizedRow[key.toLowerCase()] = row[key];
                    });

                    // Get values (handle variations)
                    const nis = normalizedRow['nis'];
                    const nama = normalizedRow['nama'] || normalizedRow['nama siswa'];
                    const kelasRaw = normalizedRow['kelas'] || normalizedRow['nama kelas'];

                    if (!nis || !nama || !kelasRaw) {
                        errors.push(`Baris ${i + 2}: Data tidak lengkap (NIS/Nama/Kelas)`);
                        continue;
                    }

                    // Find Class
                    const kelas = appData.kelas.find(k =>
                        k.nama_kelas.toLowerCase() === kelasRaw.toString().trim().toLowerCase()
                    );

                    if (!kelas) {
                        errors.push(`Baris ${i + 2}: Kelas "${kelasRaw}" tidak ditemukan`);
                        continue;
                    }

                    // Prepare Object
                    const siswaObj = {
                        id: generateId(),
                        nis: nis.toString().trim(),
                        nama: nama.toString().trim(),
                        kelas_id: kelas.id,
                        tahun_ajaran_id: activeTahunAjaran.id // CRITICAL FIX
                    };

                    siswaData.push(siswaObj);
                    successRows.push(siswaObj);
                }

                // 4. Confirm & Insert
                if (siswaData.length === 0) {
                    alert(`❌ Tidak ada data valid yang bisa diimport.\n\nError:\n${errors.slice(0, 5).join('\n')}`);
                    input.value = '';
                    return;
                }

                const confirmMsg = `Siap import ${siswaData.length} siswa?${errors.length > 0 ? `\n(${errors.length} baris skip karena error)` : ''}`;
                if (!confirm(confirmMsg)) {
                    input.value = '';
                    return;
                }

                console.log('[IMPORT V2] Sending to Supabase:', siswaData);
                const { error } = await sb.from('siswa').insert(siswaData);

                if (error) {
                    throw error;
                }

                // 5. Success
                // Update local data
                successRows.forEach(s => {
                    appData.siswa.push({ ...s, kelasId: s.kelas_id });
                });

                renderAllTables();
                updateDashboardStats();

                alert(`✅ Berhasil import ${siswaData.length} siswa!`);

            } catch (err) {
                console.error('[IMPORT V2] Error:', err);
                alert('❌ Error saat memproses file: ' + err.message);
            } finally {
                input.value = ''; // Reset input
            }
        };

        reader.readAsArrayBuffer(file);

    } catch (err) {
        console.error('[IMPORT V2] Init Error:', err);
        alert('❌ Error inisialisasi import: ' + err.message);
        input.value = '';
    }
}

// Legacy function stub removed/replaced
// function processStudentImport(data) { ... }

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

    // V2: Include Semester ID
    const activeSemesterId = appData.activeSemester ? appData.activeSemester.id : null;
    if (!activeSemesterId) return alert('Semester aktif tidak ditemukan! Harap refresh halaman.');

    const siswaInKelas = appData.siswa.filter(s => s.kelasId === kelasId);
    const kehadiranToSave = [];
    let count = 0;

    // Fetch existing attendance to get IDs (scoped to semester)
    const { data: existingAttendance, error: fetchError } = await sb
        .from('kehadiran')
        .select('id, siswa_id')
        .eq('kelas_id', kelasId)
        .eq('mapel_id', mapelId)
        .eq('tanggal', tanggal)
        .eq('semester_id', activeSemesterId);

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
                semester_id: activeSemesterId, // Added missing field
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


// --- REKAP KEHADIRAN PRINT ---
async function printRekapKehadiran() {
    const table = document.querySelector('#view-rekap-kehadiran table');
    const tbody = document.getElementById('table-rekap-kehadiran-body');

    if (!tbody || tbody.innerHTML.trim() === '') {
        return alert('Tidak ada data untuk dicetak.');
    }

    const printArea = document.getElementById('rekap-absensi-print-area');
    const printTableBody = document.querySelector('#rekap-absensi-print-table tbody');

    // Update Header Info
    const activeTA = await getActiveTahunAjaran();
    const activeSem = await getActiveSemester();

    if (document.getElementById('rekap-ta-display')) document.getElementById('rekap-ta-display').innerText = activeTA ? activeTA.nama_tahun_ajaran : '-';
    if (document.getElementById('rekap-sem-display')) document.getElementById('rekap-sem-display').innerText = activeSem ? activeSem.nama_semester : '-';

    const kelasSelect = document.getElementById('rekap-absensi-kelas');
    const mapelSelect = document.getElementById('rekap-absensi-mapel');
    const startDate = document.getElementById('rekap-absensi-start').value;
    const endDate = document.getElementById('rekap-absensi-end').value;

    const kelasName = kelasSelect.options[kelasSelect.selectedIndex]?.text || '-';
    const mapelName = mapelSelect.options[mapelSelect.selectedIndex]?.text || '-';

    if (document.getElementById('rekap-kelas-display')) document.getElementById('rekap-kelas-display').innerText = kelasName;
    if (document.getElementById('rekap-mapel-display')) document.getElementById('rekap-mapel-display').innerText = mapelName;

    // Clone rows to print table
    printTableBody.innerHTML = tbody.innerHTML;

    // Populate signature names from settings
    if (typeof populateLegerSignatures === 'function') {
        populateLegerSignatures();
    }

    // Trigger Print
    window.print();
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
        // Detect Platform
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);

        let msg = '';
        let title = '';

        if (isIOS) {
            title = 'Install di iOS';
            msg = `<p style="text-align: left;">Untuk menginstal aplikasi ini di iOS (iPhone/iPad):</p>
                   <ol style="text-align: left; margin-top: 10px;">
                     <li>Ketuk tombol <strong>Share</strong> (ikon kotak dengan panah ke atas) di menu bawah Safari.</li>
                     <li>Gulir ke bawah dan pilih <strong>"Add to Home Screen"</strong> (Tambah ke Layar Utama).</li>
                     <li>Ketuk <strong>Add</strong> (Tambah) di pojok kanan atas.</li>
                   </ol>`;
        } else if (isAndroid) {
            title = 'Install di Android';
            msg = `<p>Jika tombol otomatis tidak bekerja, silakan:</p>
                   <ol style="text-align: left; margin-top: 10px;">
                     <li>Ketuk menu titik tiga (⋮) di pojok kanan atas browser Chrome.</li>
                     <li>Pilih <strong>"Install App"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</li>
                   </ol>`;
        } else {
            title = 'Install di PC/Laptop';
            msg = `<p>Aplikasi mungkin sudah terinstal atau browser Anda tidak mendukung instalasi otomatis.</p>
                    <p style="margin-top:10px;">Coba cek:</p>
                    <ul style="text-align: left;">
                        <li>Lihat ikon (+) atau (Install) di ujung kanan kolom alamat browser (Omnibox).</li>
                        <li>Klik menu titik tiga browser > <strong>Simpan dan Bagikan</strong> > <strong>Instal Aplikasi</strong>.</li>
                    </ul>`;
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: title,
                html: msg,
                icon: 'info',
                confirmButtonText: 'Oke, Paham'
            });
        } else {
            alert('Silakan gunakan menu browser "Add to Home Screen" atau "Install App" untuk menginstal aplikasi ini.');
        }
        return;
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

// ===================================================
// LEGER NILAI FUNCTIONS
// ===================================================

function renderLegerOptions() {
    const kelasSelect = document.getElementById('leger-kelas');
    if (!kelasSelect) return;

    kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    appData.kelas.forEach(k => {
        const option = document.createElement('option');
        option.value = k.id;
        option.textContent = k.nama_kelas;
        kelasSelect.appendChild(option);
    });
}

function calculateFinalScore(siswaId, mapelId, semesterId) {
    if (!appData.nilai[siswaId] || !appData.nilai[siswaId][mapelId]) return 0;

    const nilaiMapel = appData.nilai[siswaId][mapelId];
    const categories = appData.kategori; // All categories
    const bobotMapel = appData.bobot[mapelId] || {};

    let totalScore = 0;
    let totalBobotProcessed = 0;

    const hasBobot = Object.keys(bobotMapel).length > 0;
    let countCatUsed = 0;

    categories.forEach(cat => {
        const catScores = nilaiMapel[cat.id];
        if (!catScores) return;

        // Calculate Average for this Category
        let catSum = 0;
        let catCount = 0;

        // catScores is like { 1: 80, 2: 90 } or legacy { k1: 80, k2: 90 }
        Object.keys(catScores).forEach(key => {
            const val = catScores[key];
            if (typeof val === 'number') {
                // Handle both 'k1' style and integer keys '1', '2'
                if (key.startsWith('k') || !isNaN(key)) {
                    catSum += val;
                    catCount++;
                }
            }
        });

        if (catCount > 0) {
            const catAvg = catSum / catCount;
            countCatUsed++;

            if (hasBobot) {
                // Handle new object structure for weights
                const weightInfo = bobotMapel[cat.id];
                const weight = (weightInfo && typeof weightInfo === 'object') ? (weightInfo.weight || 0) : (weightInfo || 0);
                totalScore += (catAvg * weight / 100);
                totalBobotProcessed += weight;
            } else {
                totalScore += catAvg;
            }
        }
    });

    if (countCatUsed === 0) return 0;

    if (hasBobot) {
        return parseFloat(totalScore.toFixed(2));
    } else {
        // Simple Average if no weights
        return parseFloat((totalScore / countCatUsed).toFixed(2));
    }
}

async function renderLegerTable() {
    const kelasId = document.getElementById('leger-kelas').value;
    const table = document.getElementById('leger-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    // Clear
    thead.innerHTML = '';
    tbody.innerHTML = '';

    // Update Print Header Infos
    const activeTA = await getActiveTahunAjaran();
    const activeSem = await getActiveSemester();

    const taName = activeTA ? activeTA.nama_tahun_ajaran : '-';
    // const semName = activeSem ? activeSem.nama_semester : '-'; // Fix variable scope if needed
    const semName = typeof activeSem !== 'undefined' && activeSem ? activeSem.nama_semester : (appData.activeSemester ? appData.activeSemester.nama_semester : '-');


    if (document.getElementById('leger-ta-display')) document.getElementById('leger-ta-display').innerText = taName;
    if (document.getElementById('leger-sem-display')) document.getElementById('leger-sem-display').innerText = semName;

    if (!kelasId) {
        tbody.innerHTML = '<tr><td colspan="100" class="text-center">Pilih Kelas untuk menampilkan Leger.</td></tr>';
        if (document.getElementById('leger-kelas-display')) document.getElementById('leger-kelas-display').innerText = '-';
        return;
    }

    const kelas = appData.kelas.find(k => k.id === kelasId);
    if (document.getElementById('leger-kelas-display')) document.getElementById('leger-kelas-display').innerText = kelas ? kelas.nama_kelas : '-';

    const siswaList = appData.siswa.filter(s => s.kelasId === kelasId || s.kelas_id === kelasId)
        .sort((a, b) => a.nama.localeCompare(b.nama)); // Sort by name

    const mapelList = appData.mapel;

    if (siswaList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100" class="text-center">Tidak ada siswa di kelas ini.</td></tr>';
        return;
    }

    // --- BUILD HEADER ---
    let headerRow = '<tr>';
    headerRow += '<th style="width: 40px;">No</th>';
    headerRow += '<th style="width: 100px;">NIS</th>';
    headerRow += '<th style="width: 200px;">Nama Siswa</th>';

    mapelList.forEach((m, idx) => {
        headerRow += `<th title="${m.nama_mapel}" style="writing-mode: vertical-rl; text-orientation: mixed; padding: 10px 4px; min-height: 100px; font-size: 10px;">${m.nama_mapel}</th>`;
    });

    headerRow += '<th style="writing-mode: vertical-rl; text-orientation: mixed;">Total</th>';
    headerRow += '<th style="writing-mode: vertical-rl; text-orientation: mixed;">Rata</th>';
    headerRow += '<th style="writing-mode: vertical-rl; text-orientation: mixed;">Rank</th>';
    headerRow += '</tr>';
    thead.innerHTML = headerRow;

    // --- CALCULATE SCORES ---
    const rowsData = siswaList.map(s => {
        let totalVal = 0;
        let mapelCount = 0;
        const scores = {};

        mapelList.forEach(m => {
            const val = calculateFinalScore(s.id, m.id, null);
            scores[m.id] = val;
            if (val > 0) {
                totalVal += val;
                mapelCount++;
            }
        });

        const avg = mapelCount > 0 ? (totalVal / mapelCount) : 0;

        return {
            siswa: s,
            scores: scores,
            total: totalVal,
            average: avg
        };
    });

    // Determine Ranks
    const sortedForRank = [...rowsData].sort((a, b) => b.average - a.average);

    rowsData.forEach(row => {
        const rank = sortedForRank.findIndex(r => r.siswa.id === row.siswa.id) + 1;
        row.rank = rank;
    });

    // --- BUILD BODY ---
    rowsData.forEach((row, i) => {
        let tr = `<tr>`;
        tr += `<td class="text-center">${i + 1}</td>`;
        tr += `<td>${row.siswa.nis}</td>`;
        tr += `<td style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;">${row.siswa.nama}</td>`;

        mapelList.forEach(m => {
            const val = row.scores[m.id];
            const color = val > 0 && val < 75 ? 'color: red;' : '';
            tr += `<td class="text-center" style="${color}">${val > 0 ? Math.round(val) : '-'}</td>`;
        });

        tr += `<td class="text-center" style="font-weight: bold;">${Math.round(row.total)}</td>`;
        tr += `<td class="text-center" style="font-weight: bold;">${row.average.toFixed(1)}</td>`;
        tr += `<td class="text-center text-primary" style="font-weight: bold;">${row.rank}</td>`;
        tr += `</tr>`;
        tbody.innerHTML += tr;
    });
}

function printLeger() {
    // Populate signature names from settings
    if (typeof populateLegerSignatures === 'function') {
        populateLegerSignatures();
    }
    window.print();
}

// INJECT PRINT STYLES
const printStyle = document.createElement('style');
printStyle.innerHTML = `
@media print {
    @page { size: landscape; margin: 5mm; }
    body { background: white !important; color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sidebar, .top-bar, .card-header .actions, .filter-bar, .btn-primary, .btn-secondary, .btn-danger, .modal, .action-card, .data-actions, .app-footer, #sidebar-toggle, #page-title, .user-profile, .filters-grid, .dashboard-header-custom { display: none !important; }
    .view-section { display: none !important; }
    #view-leger { display: block !important; }
    .app-container { display: block; }
    .main-content { margin: 0; padding: 0; }
    .card { border: none; background: none; box-shadow: none; padding: 0; margin: 0; }
    .card-header h3 { display: none; }
    .table-responsive { overflow: visible !important; }
    #leger-table { width: 100%; border-collapse: collapse; font-size: 11px; color: black; margin-top: 10px; }
    #leger-table th, #leger-table td { border: 1px solid #000; padding: 4px; color: black; background: transparent !important; }
    #leger-table th { background-color: #f0f0f0 !important; font-weight: bold; text-align: center; }
    .leger-header-info { display: block !important; }
    .leger-signatures { display: flex !important; }
}
`;
document.head.appendChild(printStyle);

// ===================================================
// LEGER PRINT SETTINGS - Kepala Sekolah & Guru Mapel
// ===================================================
const LEGER_SETTINGS_KEY = 'sistem_nilai_leger_settings';

// Load leger settings from localStorage
function loadSettingLeger() {
    try {
        const saved = localStorage.getItem(LEGER_SETTINGS_KEY);
        if (saved) {
            const settings = JSON.parse(saved);

            // Populate form fields
            const kepsekNama = document.getElementById('setting-kepala-sekolah-nama');
            const kepsekNip = document.getElementById('setting-kepala-sekolah-nip');
            const guruNama = document.getElementById('setting-guru-mapel-nama');
            const guruNip = document.getElementById('setting-guru-mapel-nip');

            if (kepsekNama) kepsekNama.value = settings.kepalaSekolahNama || '';
            if (kepsekNip) kepsekNip.value = settings.kepalaSekolahNip || '';
            if (guruNama) guruNama.value = settings.guruMapelNama || '';
            if (guruNip) guruNip.value = settings.guruMapelNip || '';

            console.log('✅ Leger settings loaded');
        }
    } catch (err) {
        console.error('Error loading leger settings:', err);
    }
}

// Save leger settings to localStorage
function saveSettingLeger() {
    try {
        const settings = {
            kepalaSekolahNama: document.getElementById('setting-kepala-sekolah-nama')?.value || '',
            kepalaSekolahNip: document.getElementById('setting-kepala-sekolah-nip')?.value || '',
            guruMapelNama: document.getElementById('setting-guru-mapel-nama')?.value || '',
            guruMapelNip: document.getElementById('setting-guru-mapel-nip')?.value || ''
        };

        localStorage.setItem(LEGER_SETTINGS_KEY, JSON.stringify(settings));

        // Show save feedback
        const statusEl = document.getElementById('setting-save-status');
        if (statusEl) {
            statusEl.textContent = '✅ Tersimpan!';
            statusEl.style.color = '#10b981';
            setTimeout(() => {
                statusEl.textContent = '';
            }, 2000);
        }

        console.log('✅ Leger settings saved');
        return true;
    } catch (err) {
        console.error('Error saving leger settings:', err);
        return false;
    }
}

// Get leger settings
function getLegerSettings() {
    try {
        const saved = localStorage.getItem(LEGER_SETTINGS_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (err) {
        console.error('Error getting leger settings:', err);
    }
    return {
        kepalaSekolahNama: '',
        kepalaSekolahNip: '',
        guruMapelNama: '',
        guruMapelNip: ''
    };
}

// Populate signature areas for leger print
function populateLegerSignatures() {
    const settings = getLegerSettings();
    const today = new Date();
    const tanggalFormatted = today.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Leger Nilai
    const legerKepsekNama = document.getElementById('leger-kepala-sekolah-nama');
    const legerKepsekNip = document.getElementById('leger-kepala-sekolah-nip');
    const legerGuruNama = document.getElementById('leger-guru-mapel-nama');
    const legerGuruNip = document.getElementById('leger-guru-mapel-nip');
    const legerTanggal = document.getElementById('leger-tanggal-cetak');

    if (legerKepsekNama) legerKepsekNama.textContent = settings.kepalaSekolahNama || '.........................';
    if (legerKepsekNip) legerKepsekNip.textContent = settings.kepalaSekolahNip ? `NIY. ${settings.kepalaSekolahNip}` : 'NIY. .........................';
    if (legerGuruNama) legerGuruNama.textContent = settings.guruMapelNama || '.........................';
    if (legerGuruNip) legerGuruNip.textContent = settings.guruMapelNip ? `NIY. ${settings.guruMapelNip}` : 'NIY. .........................';
    if (legerTanggal) legerTanggal.textContent = tanggalFormatted;

    // Rekap Kehadiran
    const rekapKepsekNama = document.getElementById('rekap-kepala-sekolah-nama');
    const rekapKepsekNip = document.getElementById('rekap-kepala-sekolah-nip');
    const rekapGuruNama = document.getElementById('rekap-guru-mapel-nama');
    const rekapGuruNip = document.getElementById('rekap-guru-mapel-nip');
    const rekapTanggal = document.getElementById('rekap-tanggal-cetak');

    if (rekapKepsekNama) rekapKepsekNama.textContent = settings.kepalaSekolahNama || '.........................';
    if (rekapKepsekNip) rekapKepsekNip.textContent = settings.kepalaSekolahNip ? `NIY. ${settings.kepalaSekolahNip}` : 'NIY. .........................';
    if (rekapGuruNama) rekapGuruNama.textContent = settings.guruMapelNama || '.........................';
    if (rekapGuruNip) rekapGuruNip.textContent = settings.guruMapelNip ? `NIY. ${settings.guruMapelNip}` : 'NIY. .........................';
    if (rekapTanggal) rekapTanggal.textContent = tanggalFormatted;
}

// Override printLeger to populate signatures first
const _originalPrintLeger = window.printLeger || function () { window.print(); };
window.printLeger = function () {
    populateLegerSignatures();
    setTimeout(() => {
        _originalPrintLeger();
    }, 100);
};

// Also add for rekap kehadiran print
const _originalPrintRekapKehadiran = window.printRekapKehadiran || function () { window.print(); };
window.printRekapKehadiran = function () {
    populateLegerSignatures();
    setTimeout(() => {
        _originalPrintRekapKehadiran();
    }, 100);
};

// Init Helper
const _origLoad = window.onload;
window.onload = function () {
    if (_origLoad) _origLoad();
    // Delay slightly to ensure data loaded if it's async
    setTimeout(() => {
        if (typeof renderLegerOptions === 'function') renderLegerOptions();
        loadSettingLeger(); // Load leger settings on page load
    }, 2000);
};

// Hook renderAllTables
const _origRenderAll = window.renderAllTables || function () { };
window.renderAllTables = function () {
    _origRenderAll();
    if (typeof renderLegerOptions === 'function') renderLegerOptions();
};
