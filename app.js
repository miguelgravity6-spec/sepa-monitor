// ===== SEPA MONITOR - Application Logic =====
// Integrated with Firebase Realtime Database

// ===== STATE =====
const state = {
    currentSection: 'dashboard',
    roundNumber: 1,
    roundActive: false,
    rounds: [],
    measurements: [],
    activityLog: [],
    equipmentStopped: false,
    nextRoundTime: null,
    roundTimerInterval: null,
    firebaseReady: false,
};

// ===== FIREBASE DATA SYNC =====

// Load state from Firebase (primary) or localStorage (fallback)
async function loadState() {
    // Try Firebase first
    if (isFirebaseReady()) {
        try {
            const fbState = await firebaseGet('sepa-monitor/state');
            const fbRounds = await firebaseGet('sepa-monitor/rounds');
            const fbMeasurements = await firebaseGet('sepa-monitor/measurements');
            const fbActivityLog = await firebaseGet('sepa-monitor/activityLog');

            if (fbState) {
                state.equipmentStopped = fbState.equipmentStopped || false;
            }

            if (fbRounds) {
                state.rounds = Object.values(fbRounds);
            }
            state.roundNumber = state.rounds.length + 1;

            if (fbMeasurements) {
                state.measurements = Object.values(fbMeasurements);
            }

            if (fbActivityLog) {
                state.activityLog = Object.values(fbActivityLog).sort((a, b) =>
                    new Date(b.timestamp) - new Date(a.timestamp)
                );
            }

            console.log('✅ Datos cargados desde Firebase.');
            state.firebaseReady = true;
            return;
        } catch (e) {
            console.warn('⚠️ Error al cargar desde Firebase, usando localStorage:', e);
        }
    }

    // Fallback to localStorage
    const saved = localStorage.getItem('sepa_state');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(state, parsed);
            state.roundNumber = state.rounds.length + 1;
        } catch (e) {
            console.warn('Could not load saved state:', e);
        }
    }
}

// Save state to both Firebase and localStorage
function saveState() {
    // Always save to localStorage as backup
    const toSave = {
        roundNumber: state.roundNumber,
        rounds: state.rounds,
        measurements: state.measurements,
        activityLog: state.activityLog,
        equipmentStopped: state.equipmentStopped,
    };
    localStorage.setItem('sepa_state', JSON.stringify(toSave));

    // Also save core state to Firebase
    if (isFirebaseReady()) {
        firebaseSet('sepa-monitor/state', {
            roundNumber: state.roundNumber,
            equipmentStopped: state.equipmentStopped,
            lastUpdate: new Date().toISOString(),
        });
    }
}

// Save all rounds to Firebase
function saveRoundsToFirebase() {
    if (!isFirebaseReady()) return;
    firebaseSet('sepa-monitor/rounds', state.rounds);
}

// Save a measurement to Firebase
function saveMeasurementToFirebase(measurement) {
    if (!isFirebaseReady()) return;
    firebasePush('sepa-monitor/measurements', measurement);
}

// Save an activity log entry to Firebase
function saveActivityToFirebase(entry) {
    if (!isFirebaseReady()) return;
    firebasePush('sepa-monitor/activityLog', entry);
}

// Delete a measurement from Firebase
function deleteMeasurementFromFirebase(measurementId) {
    if (!isFirebaseReady()) return;
    // Find the Firebase key for this measurement
    firebaseGet('sepa-monitor/measurements').then(data => {
        if (!data) return;
        for (const [key, val] of Object.entries(data)) {
            if (val.id === measurementId) {
                firebaseRemove(`sepa-monitor/measurements/${key}`);
                break;
            }
        }
    });
}

// Save emergency to Firebase
function saveEmergencyToFirebase(reason) {
    if (!isFirebaseReady()) return;
    firebasePush('sepa-monitor/emergencies', {
        reason,
        timestamp: new Date().toISOString(),
        date: new Date().toLocaleDateString('es-CL'),
        time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    });
}

// Clear activity log in Firebase
function clearActivityLogInFirebase() {
    if (!isFirebaseReady()) return;
    firebaseRemove('sepa-monitor/activityLog');
}

// ===== CLOCK =====
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

    document.querySelector('.clock-time').textContent = timeStr;
    document.querySelector('.clock-date').textContent = dateStr;

    // Update shift indicator
    const hour = now.getHours();
    const shiftIndicator = document.getElementById('shift-indicator');
    if (hour >= 7 && hour < 19) {
        shiftIndicator.innerHTML = '<span class="shift-icon">☀️</span><span class="shift-label">Turno Día</span>';
    } else {
        shiftIndicator.innerHTML = '<span class="shift-icon">🌙</span><span class="shift-label">Turno Noche</span>';
    }
}

// ===== NAVIGATION =====
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn[data-section]');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(sectionId) {
    // Update nav buttons
    document.querySelectorAll('.nav-btn[data-section]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });

    // Update sections
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `section-${sectionId}`);
    });

    state.currentSection = sectionId;
}

// ===== ACTIVITY LOG =====
function addActivity(type, message) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const entry = { type, message, time: timeStr, timestamp: now.toISOString() };
    state.activityLog.unshift(entry);

    // Keep only last 50 entries
    if (state.activityLog.length > 50) state.activityLog.pop();

    // Save to Firebase
    saveActivityToFirebase(entry);

    renderActivityLog();
    saveState();
}

function renderActivityLog() {
    const container = document.getElementById('activity-log');
    if (state.activityLog.length === 0) {
        container.innerHTML = '<div class="activity-empty"><p>Sin actividad registrada aún.</p></div>';
        return;
    }

    container.innerHTML = state.activityLog.map(entry => `
        <div class="activity-entry">
            <span class="activity-time">${entry.time}</span>
            <span class="activity-dot ${entry.type}"></span>
            <span class="activity-text">${entry.message}</span>
        </div>
    `).join('');
}

function clearActivityLog() {
    if (confirm('¿Desea limpiar el registro de actividad?')) {
        state.activityLog = [];
        clearActivityLogInFirebase();
        renderActivityLog();
        saveState();
        showToast('info', 'Registro de actividad limpiado.');
    }
}

// ===== ROUND TIMER =====
function setNextRoundTimer() {
    const now = new Date();
    state.nextRoundTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

    if (state.roundTimerInterval) clearInterval(state.roundTimerInterval);

    state.roundTimerInterval = setInterval(updateRoundTimer, 1000);
    updateRoundTimer();
}

function updateRoundTimer() {
    if (!state.nextRoundTime) {
        document.getElementById('kpi-next-round-value').textContent = '--:--';
        document.getElementById('kpi-progress-bar').style.width = '0%';
        return;
    }

    const now = new Date();
    const diff = state.nextRoundTime - now;

    if (diff <= 0) {
        document.getElementById('kpi-next-round-value').textContent = '¡AHORA!';
        const checklistTimer = document.getElementById('checklist-timer-display');
        if (checklistTimer) checklistTimer.textContent = '00:00';
        document.getElementById('kpi-progress-bar').style.width = '100%';
        showToast('warning', '⏰ Es hora de realizar la ronda de control.');
        clearInterval(state.roundTimerInterval);
        // Flash the checklist nav button
        const checklistBtn = document.getElementById('nav-checklist');
        checklistBtn.style.animation = 'emergencyPulse 1s ease-in-out infinite';
        setTimeout(() => { checklistBtn.style.animation = ''; }, 10000);
        return;
    }

    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    const timeString = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    
    document.getElementById('kpi-next-round-value').textContent = timeString;
    const checklistTimer = document.getElementById('checklist-timer-display');
    if (checklistTimer) checklistTimer.textContent = timeString;

    // Progress bar
    const totalMs = 60 * 60 * 1000;
    const elapsed = totalMs - diff;
    const progress = (elapsed / totalMs) * 100;
    document.getElementById('kpi-progress-bar').style.width = `${progress}%`;
}

// ===== KPI UPDATES =====
function updateKPIs() {
    // Rounds done
    document.getElementById('kpi-rounds-done-value').textContent = `${state.rounds.length} / ${state.roundNumber - 1 || state.rounds.length}`;

    // Anomalies
    const anomalies = state.rounds.reduce((acc, r) => acc + (r.hasWarnings ? 1 : 0), 0);
    document.getElementById('kpi-anomalies-value').textContent = anomalies;

    // Speed (from last round or measurement)
    const lastSpeedMeasurement = state.measurements.filter(m => m.type === 'speed').pop();
    const lastRoundSpeed = state.rounds.length > 0 ? state.rounds[state.rounds.length - 1].speed : null;
    const speed = lastSpeedMeasurement ? lastSpeedMeasurement.value : lastRoundSpeed;
    document.getElementById('kpi-speed-value').textContent = speed ? `${speed} RPM` : '-- RPM';

    // Round counter
    document.getElementById('round-counter').textContent = `Ronda #${state.roundNumber}`;
}

// ===== CHECKLIST / ROUNDS =====
function startNewRound() {
    state.roundActive = true;
    document.getElementById('btn-start-round').disabled = true;
    document.getElementById('btn-complete-round').disabled = false;

    // Reset checkboxes
    document.querySelectorAll('.check-input').forEach(cb => cb.checked = false);
    document.querySelectorAll('.check-status-select').forEach(sel => sel.value = 'normal');
    document.getElementById('speed-input').value = '';
    document.getElementById('round-observations').value = '';

    const roundOp = document.getElementById('round-operator');
    if (roundOp) roundOp.value = '';
    const roundShift = document.getElementById('round-shift');
    if (roundShift) roundShift.value = '';

    addActivity('info', `Ronda #${state.roundNumber} iniciada.`);
    showToast('info', `Ronda #${state.roundNumber} iniciada. Complete todos los puntos de verificación.`);
}

function completeRound() {
    if (!state.roundActive) return;

    // Gather data
    const operator = document.getElementById('round-operator').value;
    const shift = document.getElementById('round-shift').value;

    if (!operator || !shift) {
        showToast('warning', '⚠️ Debe seleccionar Operador y Turno para completar la ronda.');
        return;
    }

    const checks = {};
    document.querySelectorAll('.check-input').forEach(cb => {
        checks[cb.dataset.check] = cb.checked;
    });

    const statuses = {};
    document.querySelectorAll('.check-status-select').forEach(sel => {
        statuses[sel.dataset.check] = sel.value;
    });

    const speed = document.getElementById('speed-input').value;
    const observations = document.getElementById('round-observations').value;

    // Check for warnings/criticals
    const hasWarnings = Object.values(statuses).some(s => s === 'warning');
    const hasCriticals = Object.values(statuses).some(s => s === 'critical');

    // Check if bearings are critical
    if (statuses['bearings-status'] === 'critical') {
        showEmergencyModal();
        return;
    }

    const now = new Date();
    const round = {
        id: Date.now(),
        number: state.roundNumber,
        time: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        date: now.toLocaleDateString('es-CL'),
        timestamp: now.toISOString(),
        operator,
        shift,
        checks,
        statuses,
        speed: speed || null,
        observations,
        hasWarnings: hasWarnings || hasCriticals,
        hasCriticals,
        completedItems: Object.values(checks).filter(Boolean).length,
        totalItems: Object.values(checks).length,
    };

    state.rounds.push(round);
    state.roundNumber = state.rounds.length + 1;
    state.roundActive = false;

    // Save rounds to Firebase
    saveRoundsToFirebase();

    // Update speed KPI
    if (speed) {
        document.getElementById('kpi-speed-value').textContent = `${speed} RPM`;
    }

    document.getElementById('btn-start-round').disabled = false;
    document.getElementById('btn-complete-round').disabled = true;

    // Set next round timer
    setNextRoundTimer();

    // Log
    let statusText = hasCriticals ? 'con hallazgos CRÍTICOS' : hasWarnings ? 'con observaciones' : 'sin novedad';
    addActivity(hasCriticals ? 'danger' : hasWarnings ? 'warning' : 'success',
        `Ronda #${round.number} completada por ${operator} (${shift}) ${statusText}. (${round.completedItems}/${round.totalItems} ítems)`);

    if (hasCriticals) {
        showToast('danger', `⚠️ Ronda #${round.number} tiene hallazgos CRÍTICOS. Revise inmediatamente.`);
    } else if (hasWarnings) {
        showToast('warning', `Ronda #${round.number} completada con observaciones.`);
    } else {
        showToast('success', `✅ Ronda #${round.number} completada sin novedad.`);
    }

    renderRoundHistory();
    updateKPIs();
    saveState();
}

function renderRoundHistory() {
    const container = document.getElementById('round-history');
    if (state.rounds.length === 0) {
        container.innerHTML = '<p class="empty-state">No hay rondas completadas aún.</p>';
        return;
    }

    container.innerHTML = [...state.rounds].reverse().map(r => {
        let badgeClass = r.hasCriticals ? 'critical' : r.hasWarnings ? 'warning' : 'ok';
        let badgeText = r.hasCriticals ? 'Crítico' : r.hasWarnings ? 'Atención' : 'OK';
        let summary = [];
        if (r.operator && r.shift) {
            summary.push(`Op: ${r.operator} (${r.shift})`);
        }
        if (r.speed) summary.push(`Vel: ${r.speed} RPM`);
        summary.push(`${r.completedItems}/${r.totalItems} ítems`);

        return `
            <div class="round-entry">
                <span class="round-number">#${r.number}</span>
                <span class="round-time">${r.time}</span>
                <span class="round-summary">${summary.join(' · ')}</span>
                <span class="round-badge ${badgeClass}">${badgeText}</span>
                <button class="btn-icon btn-delete-round" onclick="deleteRound(${r.id})" style="color: #ff4757; margin-left: 10px;" title="Borrar ronda">✕</button>
            </div>
        `;
    }).join('');
}

function deleteRound(id) {
    if (confirm('¿Está seguro de que desea eliminar esta ronda?')) {
        state.rounds = state.rounds.filter(r => r.id !== id);
        // Re-index remaining rounds sequentially
        state.rounds.forEach((r, idx) => {
            r.number = idx + 1;
        });
        state.roundNumber = state.rounds.length + 1;

        // Save rounds to Firebase
        saveRoundsToFirebase();

        renderRoundHistory();
        updateKPIs();
        saveState();
        showToast('info', 'Ronda eliminada.');
    }
}

// ===== MEASUREMENTS =====
function toggleMeasurementFields() {
    const type = document.getElementById('meas-type').value;
    document.getElementById('fields-vibration').style.display = type === 'vibration' ? 'grid' : 'none';
    document.getElementById('fields-temperature').style.display = type === 'temperature' ? 'grid' : 'none';
    
    // Required fields based on type
    document.getElementById('vib-1a').required = type === 'vibration';
    document.getElementById('temp-rodamiento').required = type === 'temperature';
}

function openMeasurementForm() {
    document.getElementById('measurement-form').style.display = 'block';
    document.getElementById('measurement-form').scrollIntoView({ behavior: 'smooth' });
}

function closeMeasurementForm() {
    document.getElementById('measurement-form').style.display = 'none';
    document.getElementById('measurement-form-inner').reset();
    toggleMeasurementFields();
}

function saveMeasurement(e) {
    e.preventDefault();

    const typeEl = document.getElementById('meas-type');
    const type = typeEl.value;
    const typeName = typeEl.options[typeEl.selectedIndex].text;
    const notes = document.getElementById('meas-notes').value;

    let value = '';
    let unit = '';
    let location = 'Múltiples';

    if (type === 'vibration') {
        const v1a = document.getElementById('vib-1a').value;
        const v1v = document.getElementById('vib-1v').value;
        const v1h = document.getElementById('vib-1h').value;
        value = `1A: ${v1a || '-'} | 1V: ${v1v || '-'} | 1H: ${v1h || '-'}`;
        unit = 'mm/s';
    } else if (type === 'temperature') {
        const tRod = document.getElementById('temp-rodamiento').value;
        const tRed = document.getElementById('temp-reductor').value;
        const tMot = document.getElementById('temp-motor').value;
        value = `Rod: ${tRod || '-'} | Reduct: ${tRed || '-'} | Motor: ${tMot || '-'}`;
        unit = '°C';
    }

    const now = new Date();
    const measurement = {
        id: Date.now(),
        time: now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        timestamp: now.toISOString(),
        type,
        typeName,
        value,
        unit,
        location,
        notes,
    };

    state.measurements.push(measurement);

    // Save to Firebase
    saveMeasurementToFirebase(measurement);

    renderMeasurements();
    closeMeasurementForm();
    saveState();

    addActivity('info', `Medición registrada: ${typeName}`);
    showToast('success', `Medición de ${typeName} registrada correctamente.`);
    updateKPIs();
}

function renderMeasurements() {
    const tbody = document.getElementById('measurements-tbody');
    if (state.measurements.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7">
                    <div class="empty-state">
                        <p>No hay mediciones registradas. Haga clic en "Nueva Medición" para comenzar.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = [...state.measurements].reverse().map(m => `
        <tr>
            <td><span style="font-family:'JetBrains Mono',monospace;">${m.time}</span></td>
            <td>${m.typeName}</td>
            <td><strong>${m.value}</strong></td>
            <td>${m.unit || '-'}</td>
            <td>${m.location || '-'}</td>
            <td>${m.notes || '-'}</td>
            <td><button class="btn-delete" onclick="deleteMeasurement(${m.id})">Eliminar</button></td>
        </tr>
    `).join('');
}

function deleteMeasurement(id) {
    // Delete from Firebase
    deleteMeasurementFromFirebase(id);

    state.measurements = state.measurements.filter(m => m.id !== id);
    renderMeasurements();
    saveState();
    showToast('info', 'Medición eliminada.');
}

// ===== REPORT GENERATION =====
function generateReport() {
    const operator = document.getElementById('report-operator').value;
    const shift = document.getElementById('report-shift').value;
    const statusEl = document.getElementById('report-status');
    const statusText = statusEl.options[statusEl.selectedIndex].text;
    const observations = document.getElementById('report-observations').value;

    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    let report = `═══════════════════════════════════════════
  REPORTE DE TURNO — SEPARADOR
═══════════════════════════════════════════

📅 Fecha: ${dateStr}
🕐 Hora del reporte: ${timeStr}
👷 Operador: ${operator}
⏱️ Turno: ${shift}
📊 Estado del equipo: ${statusText}

───────────────────────────────────────────
  RESUMEN DE RONDAS
───────────────────────────────────────────
`;

    if (state.rounds.length === 0) {
        report += '\n  Sin rondas completadas en este turno.\n';
    } else {
        state.rounds.forEach(r => {
            const status = r.hasCriticals ? '🔴 CRÍTICO' : r.hasWarnings ? '⚠️ ATENCIÓN' : '✅ OK';
            report += `\n  Ronda #${r.number} — ${r.time} — ${status}`;
            if (r.operator && r.shift) report += ` (Op: ${r.operator} - ${r.shift})`;
            if (r.speed) report += `\n    Velocidad: ${r.speed} RPM`;
            report += `\n    Ítems completados: ${r.completedItems}/${r.totalItems}`;
            if (r.observations) report += `\n    Observaciones: ${r.observations}`;
            report += '\n';
        });
    }

    report += `
───────────────────────────────────────────
  MEDICIONES EN TERRENO
───────────────────────────────────────────
`;

    if (state.measurements.length === 0) {
        report += '\n  Sin mediciones registradas.\n';
    } else {
        state.measurements.forEach(m => {
            report += `\n  ${m.time} | ${m.typeName}: ${m.value} ${m.unit || ''}`;
            if (m.location) report += ` (${m.location})`;
            if (m.notes) report += `\n    → ${m.notes}`;
        });
        report += '\n';
    }

    report += `
───────────────────────────────────────────
  OBSERVACIONES DEL TURNO
───────────────────────────────────────────

  ${observations || 'Sin observaciones adicionales.'}

───────────────────────────────────────────
  NOTA: Para despacho se utiliza SILO 1.
  Ante falla en rodamientos → DETENER EQUIPO.
  ═══════════════════════════════════════════
`;

    document.getElementById('report-preview').textContent = report;
    document.getElementById('report-preview-panel').style.display = 'block';
    document.getElementById('report-preview-panel').scrollIntoView({ behavior: 'smooth' });

    addActivity('info', `Reporte de turno generado por ${operator} (${shift}).`);
    showToast('success', 'Reporte generado exitosamente.');
}

function copyReportToClipboard() {
    const reportText = document.getElementById('report-preview').textContent;
    if (!reportText) {
        showToast('warning', 'Primero genere un reporte.');
        return;
    }

    navigator.clipboard.writeText(reportText).then(() => {
        showToast('success', '📋 Reporte copiado al portapapeles.');
    }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = reportText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('success', '📋 Reporte copiado al portapapeles.');
    });
}

// ===== EMERGENCY =====
function showEmergencyModal() {
    document.getElementById('emergency-modal').style.display = 'flex';
    document.getElementById('emergency-reason').focus();
}

function closeEmergencyModal() {
    document.getElementById('emergency-modal').style.display = 'none';
    document.getElementById('emergency-reason').value = '';
}

function confirmEmergencyStop() {
    const reason = document.getElementById('emergency-reason').value;
    if (!reason.trim()) {
        showToast('warning', 'Debe describir los síntomas detectados.');
        return;
    }

    state.equipmentStopped = true;

    // Save emergency to Firebase
    saveEmergencyToFirebase(reason);

    // Update status badge
    const badge = document.getElementById('status-badge');
    badge.classList.add('stopped');
    badge.querySelector('.status-text').textContent = 'EQUIPO DETENIDO';

    // Log
    addActivity('danger', `⛔ PARADA DE EMERGENCIA: ${reason}`);
    showToast('danger', '⛔ EQUIPO DETENIDO — Parada de emergencia registrada.');

    closeEmergencyModal();
    saveState();

    // Update alert banner
    const alertBanner = document.getElementById('alert-banner');
    alertBanner.querySelector('.alert-content p').innerHTML =
        `<strong>⛔ EQUIPO DETENIDO:</strong> Parada de emergencia activada. Motivo: ${reason}. Acciones correctivas en curso.`;
    alertBanner.style.background = 'linear-gradient(90deg, rgba(255, 71, 87, 0.2) 0%, rgba(255, 71, 87, 0.15) 100%)';
    alertBanner.style.borderColor = 'rgba(255, 71, 87, 0.3)';
}

// ===== TOAST NOTIFICATIONS =====
function showToast(type, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-dot"></span>
        <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===== RESTORE UI FROM STATE =====
function restoreUI() {
    // Restore equipment status
    if (state.equipmentStopped) {
        const badge = document.getElementById('status-badge');
        badge.classList.add('stopped');
        badge.querySelector('.status-text').textContent = 'EQUIPO DETENIDO';
    }

    renderActivityLog();
    renderRoundHistory();
    renderMeasurements();
    updateKPIs();

    // Update round counter
    document.getElementById('round-counter').textContent = `Ronda #${state.roundNumber}`;
}

// ===== CHECKLIST CHECKBOX LISTENER =====
function initChecklistListeners() {
    document.querySelectorAll('.check-input').forEach(cb => {
        cb.addEventListener('change', () => {
            // Enable complete button if at least some checks are done
            const anyChecked = document.querySelectorAll('.check-input:checked').length > 0;
            document.getElementById('btn-complete-round').disabled = !state.roundActive;
        });
    });

    // Status select — auto check on critical detection
    document.querySelectorAll('.check-status-select').forEach(sel => {
        sel.addEventListener('change', () => {
            if (sel.value === 'critical' && sel.dataset.check === 'bearings-status') {
                showToast('danger', '⚠️ Rodamientos en estado CRÍTICO detectado. Considere parada de emergencia.');
            }
        });
    });
}

// ===== SILO ANIMATION =====
function animateSiloFill() {
    const fill = document.getElementById('silo-1-fill');
    if (!fill) return;

    let height = 72;
    let direction = -1;
    setInterval(() => {
        height += direction * 0.1;
        if (height <= 68 || height >= 72) direction *= -1;
        fill.style.height = `${height}%`;
    }, 500);
}

// ===== INITIALIZATION =====
async function init() {
    // Initialize Firebase
    const firebaseOk = initFirebase();

    // Load state (async - waits for Firebase if available)
    await loadState();

    updateClock();
    setInterval(updateClock, 1000);
    initNavigation();
    initChecklistListeners();
    restoreUI();
    animateSiloFill();

    // Set initial round timer
    if (!state.equipmentStopped) {
        setNextRoundTimer();
    }

    // Show Firebase status
    if (firebaseOk) {
        addActivity('success', '🔥 Sistema SEPA Monitor iniciado con Firebase.');
    } else {
        addActivity('info', 'Sistema SEPA Monitor iniciado (modo local).');
    }

    // Set up real-time listener for state changes (from other devices)
    if (isFirebaseReady()) {
        firebaseListen('sepa-monitor/state', (data) => {
            if (data && data.lastUpdate) {
                // Only update if the change came from another device
                const localUpdate = new Date(state.lastLocalUpdate || 0);
                const remoteUpdate = new Date(data.lastUpdate);
                if (remoteUpdate > localUpdate) {
                    state.equipmentStopped = data.equipmentStopped || false;
                    state.roundNumber = state.rounds.length + 1;
                    updateKPIs();
                    restoreUI();
                }
            }
        });
    }
}

// Make functions available globally
window.startNewRound = startNewRound;
window.completeRound = completeRound;
window.openMeasurementForm = openMeasurementForm;
window.closeMeasurementForm = closeMeasurementForm;
window.saveMeasurement = saveMeasurement;
window.deleteMeasurement = deleteMeasurement;
window.generateReport = generateReport;
window.copyReportToClipboard = copyReportToClipboard;
window.showEmergencyModal = showEmergencyModal;
window.closeEmergencyModal = closeEmergencyModal;
window.confirmEmergencyStop = confirmEmergencyStop;
window.clearActivityLog = clearActivityLog;
window.deleteRound = deleteRound;

document.addEventListener('DOMContentLoaded', init);
