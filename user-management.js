
async function renderUserTable() {
    const tbody = document.getElementById('table-pengguna-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Memuat data...</td></tr>';
    console.log("Fetching users...");

    try {
        const { data: users, error } = await sb
            .from('profiles')
            .select('*')
            .order('nama_lengkap', { ascending: true });

        if (error) {
            console.error("Error fetching users:", error);
            throw error;
        }

        console.log("Users data:", users);
        const safeUsers = users || [];

        tbody.innerHTML = '';
        if (safeUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">Belum ada data pengguna (Hubungkan ke Database / Cek RLS).</td></tr>';
            return;
        }

        safeUsers.forEach((u, i) => {
            let mapelDisplay = '-';

            // Check for new logic (multi) first, fallback to old (single)
            if (u.mapel_ids) {
                try {
                    const ids = JSON.parse(u.mapel_ids);
                    if (Array.isArray(ids) && ids.length > 0) {
                        const names = ids.map(id => {
                            const m = appData.mapel.find(m => m.id === id);
                            return m ? m.nama_mapel : '?';
                        });
                        mapelDisplay = names.join(', ');
                    }
                } catch (e) {
                    console.error('Parse mapel_ids error', e);
                    // Fallback to single if parsing fails or data is weird
                    if (u.mapel_id) {
                        const m = appData.mapel.find(m => m.id === u.mapel_id);
                        mapelDisplay = m ? m.nama_mapel : '-';
                    }
                }
            } else if (u.mapel_id) {
                // Fallback for old data
                const m = appData.mapel.find(m => m.id === u.mapel_id);
                mapelDisplay = m ? m.nama_mapel : '(Mapel dihapus)';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center">${i + 1}</td>
                <td>${u.nama_lengkap || '(Tanpa Nama)'}</td>
                <td><span class="status-badge ${u.role === 'admin' ? 'blue' : 'green'}">${u.role}</span></td>
                <td><small>${mapelDisplay}</small></td>
                <td class="text-center">
                    <button class="btn-sm btn-icon" onclick="editUser('${u.id}')"><i class="fa-solid fa-pen-to-square"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error loading users:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${err.message}</td></tr>`;
    }
}

async function editUser(userId) {
    const { data: user, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (!user) return;

    openModal('modal-user-edit');
    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-nama').value = user.nama_lengkap;
    document.getElementById('edit-user-role').value = user.role;

    // --- RENDER MAPEL CHECKBOXES (CHIPS) ---
    const mapelContainer = document.getElementById('edit-user-mapel-container');
    if (mapelContainer) {
        mapelContainer.innerHTML = '';
        mapelContainer.className = 'checkbox-chip-group'; // Add chip group class

        let currentMapels = [];
        if (user.mapel_ids) {
            try { currentMapels = JSON.parse(user.mapel_ids); } catch (e) { }
        } else if (user.mapel_id) {
            currentMapels = [user.mapel_id];
        }

        appData.mapel.forEach(m => {
            const label = document.createElement('label');
            label.className = 'checkbox-chip';
            const isChecked = currentMapels.includes(m.id);
            label.innerHTML = `
                <input type="checkbox" class="user-mapel-check" value="${m.id}" ${isChecked ? 'checked' : ''}>
                <span class="chip-label">${m.nama_mapel}</span>
            `;
            mapelContainer.appendChild(label);
        });
    }

    // --- RENDER KELAS CHECKBOXES (CHIPS) ---
    const kelasContainer = document.getElementById('edit-user-kelas-container');
    if (kelasContainer) {
        kelasContainer.innerHTML = '';
        kelasContainer.className = 'checkbox-chip-group'; // Add chip group class

        let currentKelas = [];
        if (user.kelas_ids) {
            try { currentKelas = JSON.parse(user.kelas_ids); } catch (e) { }
        }

        appData.kelas.forEach(k => {
            const label = document.createElement('label');
            label.className = 'checkbox-chip';
            const isChecked = currentKelas.includes(k.id);
            label.innerHTML = `
                <input type="checkbox" class="user-kelas-check" value="${k.id}" ${isChecked ? 'checked' : ''}>
                <span class="chip-label">${k.nama_kelas}</span>
            `;
            kelasContainer.appendChild(label);
        });
    }
}

async function saveUserChanges() {
    const id = document.getElementById('edit-user-id').value;
    const role = document.getElementById('edit-user-role').value;

    // Gather Checkboxes
    const mapelChecks = document.querySelectorAll('.user-mapel-check:checked');
    const mapelIds = Array.from(mapelChecks).map(c => c.value);

    const kelasChecks = document.querySelectorAll('.user-kelas-check:checked');
    const kelasIds = Array.from(kelasChecks).map(c => c.value);

    if (!id) return;

    if (currentUser && currentUser.id === id && role !== 'admin') {
        if (!confirm("PERINGATAN: Anda sedang mengubah akun Anda sendiri menjadi non-admin. Anda mungkin akan kehilangan akses ke menu ini. Lanjutkan?")) return;
    }

    const payload = {
        role: role,
        mapel_ids: JSON.stringify(mapelIds), // Save as JSON String
        kelas_ids: JSON.stringify(kelasIds)  // Save as JSON String
    };

    // Also update legacy mapel_id for backward compatibility if 1 or more selected (take first)
    payload.mapel_id = mapelIds.length > 0 ? mapelIds[0] : null;

    try {
        const { data, error } = await sb
            .from('profiles')
            .update(payload)
            .eq('id', id)
            .select();

        if (error) throw error;

        const msg = 'Data pengguna diperbarui.';
        if (typeof Swal !== 'undefined') {
            await Swal.fire('Berhasil', msg, 'success');
        } else {
            alert(msg);
        }

        closeModal('modal-user-edit');
        renderUserTable();

        if (currentUser && currentUser.id === id) {
            location.reload();
        }

    } catch (err) {
        console.error("Update failed:", err);
        const errMsg = 'Gagal update user: ' + err.message;
        if (typeof Swal !== 'undefined') {
            Swal.fire('Error', errMsg, 'error');
        } else {
            alert(errMsg);
        }
    }
}
