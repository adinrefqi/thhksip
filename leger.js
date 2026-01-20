
// ===================================================
// LEGER NILAI FUNCTIONS (EXTENDED)
// ===================================================

function renderLegerOptions() {
    const kelasSelect = document.getElementById('leger-kelas');
    const mapelSelect = document.getElementById('leger-mapel');

    if (kelasSelect) {
        const currentVal = kelasSelect.value;
        kelasSelect.innerHTML = '<option value="">-- Pilih Kelas --</option>';
        if (appData.kelas) {
            appData.kelas.forEach(k => {
                const option = document.createElement('option');
                option.value = k.id;
                option.textContent = k.nama_kelas;
                kelasSelect.appendChild(option);
            });
        }
        if (currentVal) kelasSelect.value = currentVal;
    }

    if (mapelSelect) {
        const currentVal = mapelSelect.value;
        // Always re-render mapel options to ensure it's up to date
        mapelSelect.innerHTML = '<option value="">-- Semua Mapel (Leger Umum) --</option>';
        if (appData.mapel) {
            appData.mapel.forEach(m => {
                const option = document.createElement('option');
                option.value = m.id;
                option.textContent = m.nama_mapel;
                mapelSelect.appendChild(option);
            });
        }
        if (currentVal) mapelSelect.value = currentVal;
    }
}

function calculateFinalScore(siswaId, mapelId, semesterId) {
    if (!appData.nilai[siswaId] || !appData.nilai[siswaId][mapelId]) return 0;

    const nilaiMapel = appData.nilai[siswaId][mapelId];
    const categories = appData.kategori;
    const bobotMapel = (appData.bobot && appData.bobot[mapelId]) ? appData.bobot[mapelId] : {};

    let totalScore = 0;

    const hasBobot = Object.keys(bobotMapel).length > 0;
    let countCatUsed = 0;

    categories.forEach(cat => {
        const catScores = nilaiMapel[cat.id];
        if (!catScores) return;

        let catSum = 0;
        let catCount = 0;

        if (typeof catScores === 'number') {
            catSum += catScores;
            catCount++;
        } else if (typeof catScores === 'object') {
            Object.keys(catScores).forEach(key => {
                const val = catScores[key];
                // Handle 'k1' style and simple '1', '2' integer keys
                if (typeof val === 'number') {
                    // Filter out non-score keys just in case, though usually only scores here
                    // If key is 'k1', 'k2' OR '1', '2'
                    if (key.startsWith('k') || !isNaN(key)) {
                        catSum += val;
                        catCount++;
                    }
                }
            });
        }

        if (catCount > 0) {
            const catAvg = catSum / catCount;
            countCatUsed++;

            if (hasBobot) {
                // Handle new object structure for weights
                const weightInfo = bobotMapel[cat.id];
                const weight = (typeof weightInfo === 'object' && weightInfo !== null) ? (weightInfo.weight || 0) : (weightInfo || 0);

                totalScore += (catAvg * weight / 100);
            } else {
                totalScore += catAvg;
            }
        }
    });

    if (totalScore === 0 && countCatUsed === 0) return 0;

    if (hasBobot) {
        return parseFloat(totalScore.toFixed(2));
    } else {
        return parseFloat((totalScore / (countCatUsed || 1)).toFixed(2));
    }
}

function getCategoryAverage(siswaId, mapelId, categoryId) {
    if (!appData.nilai[siswaId] || !appData.nilai[siswaId][mapelId] || !appData.nilai[siswaId][mapelId][categoryId]) return 0;

    const catScores = appData.nilai[siswaId][mapelId][categoryId];
    let catSum = 0;
    let catCount = 0;

    if (typeof catScores === 'number') return catScores;

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

    return catCount > 0 ? parseFloat((catSum / catCount).toFixed(2)) : 0;
}

function getPredicate(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score > 0) return 'D';
    return '-';
}

async function renderLegerTable() {
    const kelasId = document.getElementById('leger-kelas').value;
    const mapelId = document.getElementById('leger-mapel') ? document.getElementById('leger-mapel').value : '';
    const table = document.getElementById('leger-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (!thead || !tbody) return;

    thead.innerHTML = '';
    tbody.innerHTML = '';

    const activeTA = await getActiveTahunAjaran();
    const activeSem = await getActiveSemester();

    const taName = activeTA ? activeTA.nama_tahun_ajaran : '-';
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

    // Update Title if custom mapel selected
    if (mapelId && document.getElementById('leger-kelas-display')) {
        const selectedMapel = appData.mapel.find(m => m.id === mapelId);
        const mapelName = selectedMapel ? selectedMapel.nama_mapel : 'Mapel';
        document.getElementById('leger-kelas-display').innerText = `${kelas.nama_kelas} - ${mapelName}`;
    }


    const siswaList = appData.siswa.filter(s => (s.kelasId === kelasId || s.kelas_id === kelasId))
        .sort((a, b) => a.nama.localeCompare(b.nama));

    if (siswaList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="100" class="text-center">Tidak ada siswa di kelas ini.</td></tr>';
        return;
    }

    // MODE 1: GENERAL LEGER
    if (!mapelId) {
        const mapelList = appData.mapel;
        let headerRow = '<tr>';
        headerRow += '<th style="width: 40px;">No</th>';
        headerRow += '<th style="width: 100px;">NIS</th>';
        headerRow += '<th style="width: 200px;">Nama Siswa</th>';

        mapelList.forEach((m) => {
            headerRow += `<th title="${m.nama_mapel}" style="writing-mode: vertical-rl; text-orientation: mixed; padding: 10px 4px; min-height: 100px; font-size: 10px;">${m.nama_mapel}</th>`;
        });

        headerRow += '<th style="writing-mode: vertical-rl; text-orientation: mixed;">Total</th>';
        headerRow += '<th style="writing-mode: vertical-rl; text-orientation: mixed;">Rata</th>';
        headerRow += '<th style="writing-mode: vertical-rl; text-orientation: mixed;">Rank</th>';
        headerRow += '</tr>';
        thead.innerHTML = headerRow;

        const rowsData = siswaList.map(s => {
            let totalVal = 0;
            let mapelCount = 0;
            const scores = {};
            mapelList.forEach(m => {
                const val = calculateFinalScore(s.id, m.id, null);
                scores[m.id] = val;
                if (val > 0) { totalVal += val; mapelCount++; }
            });
            const avg = mapelCount > 0 ? (totalVal / mapelCount) : 0;
            return { siswa: s, scores: scores, total: totalVal, average: avg };
        });

        // Determine Ranks
        const sortedForRank = [...rowsData].sort((a, b) => b.average - a.average);
        rowsData.forEach(row => { row.rank = sortedForRank.findIndex(r => r.siswa.id === row.siswa.id) + 1; });

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
    // MODE 2: MAPEL SPECIFIC LEGER
    else {
        const categories = appData.kategori;

        // --- HEADER ---
        let headerRow1 = '<tr>';
        let headerRow2 = '<tr>';

        // Fixed Columns
        headerRow1 += '<th rowspan="2" style="width: 40px; vertical-align: middle; text-align: center;">No</th>';
        headerRow1 += '<th rowspan="2" style="width: 100px; vertical-align: middle; text-align: center;">NIS</th>';
        headerRow1 += '<th rowspan="2" style="min-width: 200px; vertical-align: middle;">Nama Siswa</th>';

        // Dynamic Category Columns
        categories.forEach(cat => {
            // Determine component count from Bobot Config (per mapel), fallback to Category Default
            const bobotConfig = (appData.bobot[mapelId] && appData.bobot[mapelId][cat.id]) ? appData.bobot[mapelId][cat.id] : null;
            const count = (bobotConfig && bobotConfig.count) ? parseInt(bobotConfig.count) : (cat.jumlah_komponen || 1);

            const prefix = cat.prefix || 'N';

            // Top Header: Category Name (Spans all components)
            headerRow1 += `<th colspan="${count}" style="text-align: center;">${cat.nama_kategori}</th>`;

            // Bottom Header: Sub-columns (TP1, TP2, etc.)
            for (let i = 1; i <= count; i++) {
                headerRow2 += `<th style="font-size: 10px; text-align: center; background: #fafafa; padding: 4px;">${prefix}${i}</th>`;
            }
        });

        // Fixed Final Columns
        headerRow1 += '<th rowspan="2" style="width: 60px; vertical-align: middle; text-align: center;">Nilai<br>Akhir</th>';
        headerRow1 += '<th rowspan="2" style="width: 60px; vertical-align: middle; text-align: center;">Predikat</th>';
        headerRow1 += '</tr>';

        headerRow2 += '</tr>';

        thead.innerHTML = headerRow1 + headerRow2;

        // --- BODY ---
        siswaList.forEach((s, i) => {
            const finalScore = calculateFinalScore(s.id, mapelId, null);
            const predicate = getPredicate(finalScore);

            let tr = `<tr>`;
            tr += `<td class="text-center">${i + 1}</td>`;
            tr += `<td>${s.nis}</td>`;
            tr += `<td>${s.nama}</td>`;

            categories.forEach(cat => {
                const bobotConfig = (appData.bobot[mapelId] && appData.bobot[mapelId][cat.id]) ? appData.bobot[mapelId][cat.id] : null;
                const count = (bobotConfig && bobotConfig.count) ? parseInt(bobotConfig.count) : (cat.jumlah_komponen || 1);

                const catData = (appData.nilai[s.id] && appData.nilai[s.id][mapelId] && appData.nilai[s.id][mapelId][cat.id]) ? appData.nilai[s.id][mapelId][cat.id] : {};

                for (let k = 1; k <= count; k++) {
                    let score = '-';
                    // Check various storage formats
                    if (typeof catData === 'object') {
                        // 1. Check integer key (new standard)
                        if (catData[k] !== undefined) score = catData[k];
                        // 2. Check string key "1", "2"
                        else if (catData[String(k)] !== undefined) score = catData[String(k)];
                        // 3. Check legacy "k1", "k2"
                        else if (catData[`k${k}`] !== undefined) score = catData[`k${k}`];
                    } else if (typeof catData === 'number' && k === 1) {
                        score = catData; // Old format single value
                    }

                    tr += `<td class="text-center" style="font-size: 11px;">${score !== '-' ? score : ''}</td>`;
                }
            });

            tr += `<td class="text-center" style="font-weight: bold;">${finalScore > 0 ? Math.round(finalScore) : '-'}</td>`;
            tr += `<td class="text-center font-weight-bold" style="${finalScore > 0 ? '' : 'color:transparent;'}">${predicate}</td>`;
            tr += `</tr>`;
            tbody.innerHTML += tr;
        });
    }
}
