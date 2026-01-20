
// ===================================================
// BOBOT UI FUNCTIONS (New Dynamic UI)
// ===================================================

function renderBobotForm() {
    const mapelId = document.getElementById('select-bobot-mapel').value;
    const container = document.getElementById('bobot-container');
    container.innerHTML = '';

    if (!mapelId) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
                <p>Silakan pilih mata pelajaran di atas untuk mulai mengatur bobot.</p>
            </div>`;
        document.getElementById('total-bobot-value').textContent = '0';
        return;
    }

    const currentWeights = appData.bobot[mapelId] || {};

    appData.kategori.forEach((k, idx) => {
        // Handle new object structure or fallback
        const savedData = currentWeights[k.id];
        const weightVal = (savedData && typeof savedData === 'object') ? savedData.weight : (savedData || 0);
        const countVal = (savedData && typeof savedData === 'object') ? (savedData.count || 1) : (k.jumlah_komponen || 1);

        const div = document.createElement('div');
        div.className = 'bobot-item glass-item';
        // Staggered animation
        div.style.animation = `fadeInUp 0.3s ease forwards ${idx * 0.1}s`;
        div.style.opacity = '0';

        // Determine icon based on category type
        let icon = 'fa-list-check';
        let iconColor = 'var(--primary-color)';
        if (k.nama_kategori.toLowerCase().includes('sumatif')) {
            icon = 'fa-file-signature';
            iconColor = 'var(--accent-color)';
        }

        div.innerHTML = `
            <div class="bobot-header">
                <div class="icon-box" style="color: ${iconColor}; background: rgba(255,255,255,0.05);">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="bobot-info">
                    <label>${k.nama_kategori}</label>
                    <small>Atur detail penilaian</small>
                </div>
            </div>
            
            <div class="bobot-controls">
                <div class="control-group">
                    <label>Jml Komponen</label>
                    <div class="input-wrapper">
                        <input type="number" class="form-control bobot-count" 
                            data-kategori="${k.id}" 
                            value="${countVal}" 
                            min="1" max="25"
                            title="Jumlah komponen (misal: TP)">
                    </div>
                </div>
                
                <div class="control-group">
                    <label>Bobot (%)</label>
                    <div class="input-with-suffix">
                        <input type="number" class="form-control bobot-input" 
                               data-kategori="${k.id}" 
                               value="${weightVal}" 
                               min="0" max="100" oninput="calculateTotalBobot()">
                        <span>%</span>
                    </div>
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
    if (totalDisplay) {
        totalDisplay.textContent = total;
        totalDisplay.style.color = total === 100 ? '#10b981' : '#ef4444'; // Success green or Danger red

        // Add visual cue for error
        const totalContainer = totalDisplay.parentElement;
        if (total !== 100) {
            totalContainer.classList.add('error-pulse');
        } else {
            totalContainer.classList.remove('error-pulse');
        }
    }
}

async function saveWeights() {
    const mapelId = document.getElementById('select-bobot-mapel').value;
    if (!mapelId) return Swal.fire('Peringatan', 'Pilih mata pelajaran terlebih dahulu!', 'warning');

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

    if (fetchError) return Swal.fire('Error', 'Gagal mengambil data bobot lama: ' + fetchError.message, 'error');

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

    if (total !== 100) return Swal.fire('Total Belum 100%', `Total bobot saat ini: ${total}%. Harap sesuaikan hingga pas 100%.`, 'warning');

    // Upsert to Supabase
    const { error } = await sb.from('bobot').upsert(weightsToSave);
    if (error) return Swal.fire('Error', 'Gagal menyimpan bobot: ' + error.message, 'error');

    // Update local state
    if (!appData.bobot[mapelId]) appData.bobot[mapelId] = {};
    weightsToSave.forEach(w => {
        appData.bobot[mapelId][w.kategori_id] = { weight: w.nilai_bobot, count: w.jumlah_komponen };
    });

    Swal.fire({
        title: 'Berhasil!',
        text: 'Pengaturan bobot dan komponen berhasil disimpan.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
    });
}
