/**
 * AcadFill - popup.js
 * Main popup controller: candidate management, form handling, navigation
 */

// ============================
// STATE
// ============================
let candidates = {};         // { [id]: CandidateProfile }
let activeCandidateId = null;
let settings = {
  floatingBtn: true,
  highlight: true,
  showReport: true
};

// ============================
// DATA STRUCTURES
// ============================
const defaultCandidate = () => ({
  id: generateId(),
  name: 'New Candidate',
  personal: {},
  qualifications: [],
  publications: []
});

function generateId() {
  return 'cand_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ============================
// STORAGE
// ============================
async function loadData() {
  return new Promise(resolve => {
    chrome.storage.local.get(['acadfill_candidates', 'acadfill_active', 'acadfill_settings'], result => {
      candidates = result.acadfill_candidates || {};
      activeCandidateId = result.acadfill_active || null;
      settings = { ...settings, ...(result.acadfill_settings || {}) };
      resolve();
    });
  });
}

async function saveData() {
  return new Promise(resolve => {
    chrome.storage.local.set({
      acadfill_candidates: candidates,
      acadfill_active: activeCandidateId,
      acadfill_settings: settings
    }, resolve);
  });
}

async function saveSettings() {
  return new Promise(resolve => {
    chrome.storage.local.set({ acadfill_settings: settings }, resolve);
  });
}

// ============================
// UI UTILITIES
// ============================
function showToast(message, duration = 2500) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
}

function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function setStatus(message, type = 'info') {
  const el = document.getElementById('autofill-status');
  el.textContent = message;
  el.className = `autofill-status ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ============================
// CANDIDATE MANAGEMENT
// ============================
function refreshCandidateSelect() {
  const select = document.getElementById('candidate-select');
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Select Candidate --</option>';

  Object.values(candidates).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });

  if (activeCandidateId && candidates[activeCandidateId]) {
    select.value = activeCandidateId;
  }

  refreshStats();
}

function refreshStats() {
  const statsEl = document.getElementById('candidate-stats');
  if (!activeCandidateId || !candidates[activeCandidateId]) {
    statsEl.classList.add('hidden');
    return;
  }
  const c = candidates[activeCandidateId];
  statsEl.classList.remove('hidden');

  const firstName = c.personal?.firstName || '';
  const lastName = c.personal?.lastName || '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || c.name;
  document.getElementById('stat-name-val').textContent = fullName || '—';
  document.getElementById('stat-quals-val').textContent = (c.qualifications || []).length;
  document.getElementById('stat-papers-val').textContent = (c.publications || []).length;
}

// ============================
// PERSONAL INFO VIEW
// ============================
const personalFieldMap = [
  ['p-first-name', 'firstName'],
  ['p-middle-name', 'middleName'],
  ['p-last-name', 'lastName'],
  ['p-dob', 'dob'],
  ['p-gender', 'gender'],
  ['p-category', 'category'],
  ['p-nationality', 'nationality'],
  ['p-religion', 'religion'],
  ['p-disabled', 'disabled'],
  ['p-email', 'email'],
  ['p-mobile', 'mobile'],
  ['p-mobile-alt', 'mobileAlt'],
  ['p-aadhaar', 'aadhaar'],
  ['p-pan', 'pan'],
  ['p-passport', 'passport'],
  ['p-father-name', 'fatherName'],
  ['p-mother-name', 'motherName'],
  ['p-addr1', 'addr1'],
  ['p-addr2', 'addr2'],
  ['p-city', 'city'],
  ['p-district', 'district'],
  ['p-state', 'state'],
  ['p-pincode', 'pincode'],
  ['p-country', 'country'],
  ['p-caddr1', 'cAddr1'],
  ['p-caddr2', 'cAddr2'],
  ['p-ccity', 'cCity'],
  ['p-cstate', 'cState'],
  ['p-cpincode', 'cPincode'],
  ['p-ccountry', 'cCountry']
];

function loadPersonalForm() {
  if (!activeCandidateId || !candidates[activeCandidateId]) return;
  const p = candidates[activeCandidateId].personal || {};
  personalFieldMap.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.value = p[key] || '';
  });
}

function savePersonalForm() {
  if (!activeCandidateId) return;
  const p = {};
  personalFieldMap.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) p[key] = el.value.trim();
  });
  candidates[activeCandidateId].personal = p;

  // Update candidate name if first/last name filled
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ');
  if (name) candidates[activeCandidateId].name = name;

  saveData();
  refreshCandidateSelect();
  showToast('✅ Personal info saved!');
}

// Same address checkbox
document.getElementById('p-same-address').addEventListener('change', function () {
  const corresp = document.getElementById('correspondence-fields');
  if (this.checked) {
    corresp.classList.add('hidden');
    // Copy values
    const map = [
      ['p-addr1', 'p-caddr1'], ['p-addr2', 'p-caddr2'],
      ['p-city', 'p-ccity'], ['p-state', 'p-cstate'],
      ['p-pincode', 'p-cpincode'], ['p-country', 'p-ccountry']
    ];
    map.forEach(([src, dst]) => {
      const srcEl = document.getElementById(src);
      const dstEl = document.getElementById(dst);
      if (srcEl && dstEl) dstEl.value = srcEl.value;
    });
  } else {
    corresp.classList.remove('hidden');
  }
});

// ============================
// ACADEMIC QUALIFICATIONS VIEW
// ============================
let qualifications = []; // local copy while editing

function loadAcademicView() {
  if (!activeCandidateId) return;
  qualifications = JSON.parse(JSON.stringify(candidates[activeCandidateId].qualifications || []));
  renderQualifications();
}

function renderQualifications() {
  const list = document.getElementById('qualifications-list');
  const empty = document.getElementById('qual-empty');
  list.innerHTML = '';

  if (qualifications.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  qualifications.forEach((qual, idx) => {
    const card = buildQualCard(qual, idx);
    list.appendChild(card);
  });
}

function buildQualCard(qual, idx) {
  const card = document.createElement('div');
  card.className = 'qual-card';
  card.dataset.idx = idx;

  const isExpanded = qual._expanded !== false;

  card.innerHTML = `
    <div class="qual-card-header" data-expand="${idx}">
      <div class="qual-card-title">
        <span class="qual-badge">${qual.level}</span>
        <span>${qual.degree || ''}</span>
      </div>
      <div class="qual-card-actions">
        <button class="btn-icon btn-remove-qual" data-idx="${idx}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
        <svg class="chevron ${isExpanded ? 'open' : ''}" viewBox="0 0 24 24" fill="none" width="16" height="16">
          <polyline points="6 9 12 15 18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
    <div class="qual-card-body ${isExpanded ? 'expanded' : ''}">
      ${buildQualForm(qual, idx)}
    </div>
  `;

  // Toggle expand
  card.querySelector('.qual-card-header').addEventListener('click', (e) => {
    if (e.target.closest('.btn-remove-qual')) return;
    const body = card.querySelector('.qual-card-body');
    const chevron = card.querySelector('.chevron');
    body.classList.toggle('expanded');
    chevron.classList.toggle('open');
    qual._expanded = body.classList.contains('expanded');
  });

  // Remove qualification
  card.querySelector('.btn-remove-qual').addEventListener('click', (e) => {
    e.stopPropagation();
    qualifications.splice(idx, 1);
    renderQualifications();
  });

  // Bind subject add button
  const addSubjectBtn = card.querySelector('.btn-add-subject');
  if (addSubjectBtn) {
    addSubjectBtn.addEventListener('click', () => {
      qual.subjects = qual.subjects || [];
      qual.subjects.push({ name: '', marks: '', maxMarks: '', grade: '' });
      renderQualifications();
    });
  }

  // Bind remove subject buttons
  card.querySelectorAll('.btn-remove-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const rowIdx = parseInt(btn.dataset.row);
      qual.subjects.splice(rowIdx, 1);
      renderQualifications();
    });
  });

  // Bind live input updates
  card.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      const field = input.dataset.field;
      if (field.startsWith('subject_')) {
        const parts = field.split('_');
        const rowIdx = parseInt(parts[1]);
        const subField = parts[2];
        qual.subjects = qual.subjects || [];
        qual.subjects[rowIdx] = qual.subjects[rowIdx] || {};
        qual.subjects[rowIdx][subField] = input.value;
      } else {
        qual[field] = input.value;
      }
      // Update badge
      const badge = card.querySelector('.qual-badge');
      if (badge && field === 'level') badge.textContent = input.value;
      const titleSpan = card.querySelector('.qual-card-title span:last-child');
      if (titleSpan && field === 'degree') titleSpan.textContent = input.value;
    });
  });

  return card;
}

function buildQualForm(qual, idx) {
  const subjects = qual.subjects || [];
  const subjectRows = subjects.map((sub, si) => `
    <tr>
      <td><input type="text" data-field="subject_${si}_name" value="${escHtml(sub.name || '')}" placeholder="Subject name" /></td>
      <td><input type="number" data-field="subject_${si}_marks" value="${escHtml(sub.marks || '')}" placeholder="0" /></td>
      <td><input type="number" data-field="subject_${si}_maxMarks" value="${escHtml(sub.maxMarks || '')}" placeholder="100" /></td>
      <td><input type="text" data-field="subject_${si}_grade" value="${escHtml(sub.grade || '')}" placeholder="A" /></td>
      <td><button class="btn-remove-row" data-row="${si}" title="Remove">✕</button></td>
    </tr>
  `).join('');

  return `
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">Level / Type</label>
        <input type="text" data-field="level" class="field-input" value="${escHtml(qual.level || '')}" placeholder="e.g. UG, PG" />
      </div>
      <div class="form-group">
        <label class="field-label">Degree / Exam Name</label>
        <input type="text" data-field="degree" class="field-input" value="${escHtml(qual.degree || '')}" placeholder="e.g. B.Tech, CBSE" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">Subject / Specialization</label>
        <input type="text" data-field="specialization" class="field-input" value="${escHtml(qual.specialization || '')}" placeholder="e.g. Computer Science" />
      </div>
      <div class="form-group">
        <label class="field-label">Institution</label>
        <input type="text" data-field="institution" class="field-input" value="${escHtml(qual.institution || '')}" placeholder="College / School name" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">University / Board</label>
        <input type="text" data-field="board" class="field-input" value="${escHtml(qual.board || '')}" placeholder="e.g. CBSE, Mumbai University" />
      </div>
      <div class="form-group">
        <label class="field-label">Year of Passing</label>
        <input type="number" data-field="year" class="field-input" value="${escHtml(qual.year || '')}" placeholder="${new Date().getFullYear()}" min="1900" max="2100" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">Percentage / CGPA</label>
        <input type="text" data-field="percentage" class="field-input" value="${escHtml(qual.percentage || '')}" placeholder="e.g. 85.5 or 8.5" />
      </div>
      <div class="form-group">
        <label class="field-label">Grading Scale</label>
        <select data-field="gradingScale" class="field-input">
          <option value="Percentage" ${qual.gradingScale === 'Percentage' ? 'selected' : ''}>Percentage (%)</option>
          <option value="CGPA-10" ${qual.gradingScale === 'CGPA-10' ? 'selected' : ''}>CGPA (out of 10)</option>
          <option value="CGPA-4" ${qual.gradingScale === 'CGPA-4' ? 'selected' : ''}>GPA (out of 4)</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">Total Marks Obtained</label>
        <input type="number" data-field="marksObtained" class="field-input" value="${escHtml(qual.marksObtained || '')}" placeholder="e.g. 850" />
      </div>
      <div class="form-group">
        <label class="field-label">Total Maximum Marks</label>
        <input type="number" data-field="maxMarks" class="field-input" value="${escHtml(qual.maxMarks || '')}" placeholder="e.g. 1000" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">Enrollment / Roll No.</label>
        <input type="text" data-field="rollNo" class="field-input" value="${escHtml(qual.rollNo || '')}" placeholder="Roll / Enrollment number" />
      </div>
      <div class="form-group">
        <label class="field-label">Certificate No.</label>
        <input type="text" data-field="certNo" class="field-input" value="${escHtml(qual.certNo || '')}" placeholder="Certificate number" />
      </div>
    </div>
    <div class="form-group">
      <label class="field-label">Duration (e.g. 2020 – 2024)</label>
      <input type="text" data-field="duration" class="field-input" value="${escHtml(qual.duration || '')}" placeholder="Start year – End year" />
    </div>
    
    <div>
      <div class="subjects-label">
        Subject-wise Marks
      </div>
      <table class="subjects-table">
        <thead>
          <tr>
            <th>Subject</th>
            <th>Marks</th>
            <th>Max</th>
            <th>Grade</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="subjects-body-${idx}">
          ${subjectRows}
        </tbody>
      </table>
      <button class="btn-add-subject" style="margin-top:6px;">+ Add Subject</button>
    </div>
  `;
}

function saveAcademicForm() {
  if (!activeCandidateId) return;
  candidates[activeCandidateId].qualifications = JSON.parse(JSON.stringify(qualifications));
  saveData();
  refreshStats();
  showToast('✅ Qualifications saved!');
}

// ============================
// PUBLICATIONS VIEW
// ============================
let publications = [];

function loadPublicationsView() {
  if (!activeCandidateId) return;
  publications = JSON.parse(JSON.stringify(candidates[activeCandidateId].publications || []));
  renderPublications();
}

function renderPublications() {
  const list = document.getElementById('publications-list');
  const empty = document.getElementById('pub-empty');
  list.innerHTML = '';

  if (publications.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  publications.forEach((pub, idx) => {
    const card = buildPubCard(pub, idx);
    list.appendChild(card);
  });
}

function buildPubCard(pub, idx) {
  const card = document.createElement('div');
  card.className = 'pub-card';

  card.innerHTML = `
    <div class="pub-card-header">
      <span class="pub-number">Publication #${idx + 1}</span>
      <button class="btn-remove-pub" data-idx="${idx}" title="Remove">
        <svg viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="form-group">
      <label class="field-label">Paper Title *</label>
      <input type="text" data-field="title" class="field-input" value="${escHtml(pub.title || '')}" placeholder="Full title of the paper" />
    </div>
    <div class="form-group">
      <label class="field-label">Authors</label>
      <input type="text" data-field="authors" class="field-input" value="${escHtml(pub.authors || '')}" placeholder="e.g. John Doe, Jane Smith" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">Journal / Conference</label>
        <input type="text" data-field="journal" class="field-input" value="${escHtml(pub.journal || '')}" placeholder="Journal or conference name" />
      </div>
      <div class="form-group">
        <label class="field-label">Year</label>
        <input type="number" data-field="year" class="field-input" value="${escHtml(pub.year || '')}" placeholder="${new Date().getFullYear()}" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">Volume / Issue</label>
        <input type="text" data-field="volume" class="field-input" value="${escHtml(pub.volume || '')}" placeholder="Vol. X, Issue Y" />
      </div>
      <div class="form-group">
        <label class="field-label">Page Numbers</label>
        <input type="text" data-field="pages" class="field-input" value="${escHtml(pub.pages || '')}" placeholder="e.g. 123-130" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">DOI / URL</label>
        <input type="text" data-field="doi" class="field-input" value="${escHtml(pub.doi || '')}" placeholder="10.xxxx/... or https://..." />
      </div>
      <div class="form-group">
        <label class="field-label">Publisher</label>
        <input type="text" data-field="publisher" class="field-input" value="${escHtml(pub.publisher || '')}" placeholder="e.g. Springer, IEEE" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="field-label">Type</label>
        <select data-field="type" class="field-input">
          <option value="Journal" ${pub.type === 'Journal' ? 'selected' : ''}>Journal Article</option>
          <option value="Conference" ${pub.type === 'Conference' ? 'selected' : ''}>Conference Paper</option>
          <option value="Book Chapter" ${pub.type === 'Book Chapter' ? 'selected' : ''}>Book Chapter</option>
          <option value="Book" ${pub.type === 'Book' ? 'selected' : ''}>Book</option>
          <option value="Patent" ${pub.type === 'Patent' ? 'selected' : ''}>Patent</option>
          <option value="Thesis" ${pub.type === 'Thesis' ? 'selected' : ''}>Thesis</option>
          <option value="Other" ${pub.type === 'Other' ? 'selected' : ''}>Other</option>
        </select>
      </div>
      <div class="form-group">
        <label class="field-label">ISSN / ISBN</label>
        <input type="text" data-field="issn" class="field-input" value="${escHtml(pub.issn || '')}" placeholder="ISSN or ISBN" />
      </div>
    </div>
    <div class="form-group">
      <label class="field-label">Impact Factor / Indexing</label>
      <input type="text" data-field="impact" class="field-input" value="${escHtml(pub.impact || '')}" placeholder="e.g. SCI, Scopus, Impact Factor: 3.5" />
    </div>
  `;

  card.querySelector('.btn-remove-pub').addEventListener('click', () => {
    publications.splice(idx, 1);
    renderPublications();
  });

  card.querySelectorAll('[data-field]').forEach(input => {
    input.addEventListener('input', () => {
      pub[input.dataset.field] = input.value;
    });
  });

  return card;
}

function savePublicationsForm() {
  if (!activeCandidateId) return;
  candidates[activeCandidateId].publications = JSON.parse(JSON.stringify(publications));
  saveData();
  refreshStats();
  showToast('✅ Publications saved!');
}

// ============================
// SETTINGS VIEW
// ============================
function loadSettings() {
  document.getElementById('setting-floating-btn').checked = settings.floatingBtn !== false;
  document.getElementById('setting-highlight').checked = settings.highlight !== false;
  document.getElementById('setting-report').checked = settings.showReport !== false;
}

function bindSettings() {
  ['setting-floating-btn', 'setting-highlight', 'setting-report'].forEach(id => {
    document.getElementById(id).addEventListener('change', function () {
      const key = {
        'setting-floating-btn': 'floatingBtn',
        'setting-highlight': 'highlight',
        'setting-report': 'showReport'
      }[id];
      settings[key] = this.checked;
      saveSettings();
      // Notify content script
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED', settings });
        }
      });
    });
  });
}

// Export data
document.getElementById('btn-export-data').addEventListener('click', () => {
  const data = { candidates, settings, exportedAt: new Date().toISOString(), version: '1.0' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `acadfill-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📦 Data exported!');
});

// Import data
document.getElementById('btn-import-data').addEventListener('click', () => {
  document.getElementById('import-file-input').click();
});

document.getElementById('import-file-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.candidates) {
        candidates = { ...candidates, ...data.candidates };
        if (data.settings) settings = { ...settings, ...data.settings };
        await saveData();
        refreshCandidateSelect();
        showToast('✅ Data imported successfully!');
      } else {
        showToast('❌ Invalid file format');
      }
    } catch {
      showToast('❌ Failed to parse file');
    }
  };
  reader.readAsText(file);
  this.value = '';
});

// Clear all data
document.getElementById('btn-clear-all').addEventListener('click', () => {
  if (confirm('⚠️ This will delete ALL candidate profiles and data. Are you sure?')) {
    candidates = {};
    activeCandidateId = null;
    chrome.storage.local.clear(() => {
      refreshCandidateSelect();
      showToast('🗑️ All data cleared');
    });
  }
});

// ============================
// AUTOFILL (trigger content script)
// ============================
document.getElementById('btn-autofill-now').addEventListener('click', async () => {
  if (!activeCandidateId || !candidates[activeCandidateId]) {
    setStatus('⚠️ Please select or create a candidate profile first.', 'error');
    return;
  }

  const candidate = candidates[activeCandidateId];

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]) {
      setStatus('❌ No active tab found.', 'error');
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'AUTOFILL',
      candidate,
      settings
    }, response => {
      if (chrome.runtime.lastError) {
        setStatus('❌ Could not connect to page. Please refresh it.', 'error');
        return;
      }
      if (response && response.success) {
        setStatus(`✅ Filled ${response.filled} field(s). ${response.skipped} skipped.`, 'success');
      } else {
        setStatus('⚠️ No matching fields found on this page.', 'info');
      }
    });
  });
});

// ============================
// NAVIGATION & EVENT BINDING
// ============================
function initNavigation() {
  // Home → other views
  document.getElementById('btn-edit-profile').addEventListener('click', () => {
    if (!activeCandidateId) { showToast('⚠️ Select a candidate first'); return; }
    loadPersonalForm();
    showView('view-personal');
  });

  document.getElementById('btn-edit-academic').addEventListener('click', () => {
    if (!activeCandidateId) { showToast('⚠️ Select a candidate first'); return; }
    loadAcademicView();
    showView('view-academic');
  });

  document.getElementById('btn-edit-publications').addEventListener('click', () => {
    if (!activeCandidateId) { showToast('⚠️ Select a candidate first'); return; }
    loadPublicationsView();
    showView('view-publications');
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    loadSettings();
    showView('view-settings');
  });

  // Back buttons
  document.getElementById('back-from-personal').addEventListener('click', () => showView('view-home'));
  document.getElementById('back-from-academic').addEventListener('click', () => showView('view-home'));
  document.getElementById('back-from-publications').addEventListener('click', () => showView('view-home'));
  document.getElementById('back-from-settings').addEventListener('click', () => showView('view-home'));

  // Save buttons
  document.getElementById('save-personal').addEventListener('click', savePersonalForm);
  document.getElementById('save-academic').addEventListener('click', saveAcademicForm);
  document.getElementById('save-publications').addEventListener('click', savePublicationsForm);

  // Candidate selector
  document.getElementById('candidate-select').addEventListener('change', async function () {
    activeCandidateId = this.value || null;
    await saveData();
    refreshStats();
    // Notify content script of active change
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0] && activeCandidateId) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CANDIDATE_CHANGED',
          candidate: candidates[activeCandidateId],
          settings
        }).catch(() => {});
      }
    });
  });

  // Add candidate modal
  document.getElementById('btn-add-candidate').addEventListener('click', () => {
    document.getElementById('new-candidate-name').value = '';
    openModal('modal-add-candidate');
  });

  document.getElementById('confirm-add-candidate').addEventListener('click', async () => {
    const name = document.getElementById('new-candidate-name').value.trim();
    if (!name) { showToast('⚠️ Please enter a profile name'); return; }
    const c = defaultCandidate();
    c.name = name;
    candidates[c.id] = c;
    activeCandidateId = c.id;
    await saveData();
    refreshCandidateSelect();
    closeModal('modal-add-candidate');
    showToast(`✅ Profile "${name}" created!`);
  });

  // Delete candidate
  document.getElementById('btn-delete-candidate').addEventListener('click', async () => {
    if (!activeCandidateId) { showToast('⚠️ No candidate selected'); return; }
    const name = candidates[activeCandidateId]?.name || 'this candidate';
    if (confirm(`Delete profile for "${name}"? This cannot be undone.`)) {
      delete candidates[activeCandidateId];
      activeCandidateId = Object.keys(candidates)[0] || null;
      await saveData();
      refreshCandidateSelect();
      showToast(`🗑️ Profile deleted`);
    }
  });

  // Add qualification
  document.getElementById('btn-add-qualification').addEventListener('click', () => {
    openModal('modal-add-qualification');
  });

  document.getElementById('btn-add-qual-empty').addEventListener('click', () => {
    openModal('modal-add-qualification');
  });

  // Level select change (show custom input)
  document.getElementById('qual-level-select').addEventListener('change', function () {
    const customGroup = document.getElementById('custom-qual-group');
    customGroup.classList.toggle('hidden', this.value !== 'Custom');
  });

  document.getElementById('confirm-add-qualification').addEventListener('click', () => {
    const levelSelect = document.getElementById('qual-level-select');
    let level = levelSelect.value;
    if (level === 'Custom') {
      level = document.getElementById('custom-qual-name').value.trim() || 'Custom';
    }
    qualifications.push({ level, subjects: [], _expanded: true });
    renderQualifications();
    closeModal('modal-add-qualification');
  });

  // Add publication
  document.getElementById('btn-add-publication').addEventListener('click', addNewPublication);
  document.getElementById('btn-add-pub-empty').addEventListener('click', addNewPublication);

  // Modal close buttons
  document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.dataset.modal;
      if (modalId) closeModal(modalId);
    });
  });

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('hidden');
      }
    });
  });
}

function addNewPublication() {
  publications.push({ title: '', type: 'Journal' });
  renderPublications();
}

// ============================
// HELPERS
// ============================
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================
// INIT
// ============================
async function init() {
  await loadData();
  refreshCandidateSelect();
  loadSettings();
  bindSettings();
  initNavigation();

  // Auto-select active candidate if only one
  if (!activeCandidateId) {
    const ids = Object.keys(candidates);
    if (ids.length === 1) {
      activeCandidateId = ids[0];
      document.getElementById('candidate-select').value = ids[0];
      await saveData();
      refreshStats();
    }
  }

  // First run: auto-open add candidate modal
  if (Object.keys(candidates).length === 0) {
    setTimeout(() => {
      openModal('modal-add-candidate');
    }, 300);
  }
}

document.addEventListener('DOMContentLoaded', init);
