/**
 * AcadFill - content.js
 * Content script: floating button + intelligent autofill engine
 */

(function () {
  'use strict';

  // ============================
  // STATE
  // ============================
  let currentCandidate = null;
  let currentSettings = { floatingBtn: true, highlight: true, showReport: true };
  let fabEl = null;
  let reportEl = null;

  // ============================
  // MESSAGE LISTENER
  // ============================
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AUTOFILL') {
      currentCandidate = message.candidate;
      currentSettings = message.settings || currentSettings;
      const result = runAutofill(currentCandidate);
      sendResponse(result);
      if (currentSettings.showReport && result.filled > 0) {
        showReport(result);
      }
      return true;
    }

    if (message.type === 'CANDIDATE_CHANGED') {
      currentCandidate = message.candidate;
      currentSettings = message.settings || currentSettings;
      updateFab();
      return true;
    }

    if (message.type === 'SETTINGS_UPDATED') {
      currentSettings = message.settings;
      if (currentSettings.floatingBtn) {
        injectFab();
      } else {
        removeFab();
      }
      return true;
    }
  });

  // ============================
  // INIT: Load from storage
  // ============================
  chrome.storage.local.get(['acadfill_active', 'acadfill_candidates', 'acadfill_settings'], result => {
    currentSettings = { ...currentSettings, ...(result.acadfill_settings || {}) };
    const activeId = result.acadfill_active;
    if (activeId && result.acadfill_candidates && result.acadfill_candidates[activeId]) {
      currentCandidate = result.acadfill_candidates[activeId];
    }
    if (currentSettings.floatingBtn !== false) {
      injectFab();
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.acadfill_active || changes.acadfill_candidates) {
      chrome.storage.local.get(['acadfill_active', 'acadfill_candidates'], result => {
        const activeId = result.acadfill_active;
        if (activeId && result.acadfill_candidates?.[activeId]) {
          currentCandidate = result.acadfill_candidates[activeId];
          updateFab();
        }
      });
    }
    if (changes.acadfill_settings) {
      currentSettings = { ...currentSettings, ...(changes.acadfill_settings.newValue || {}) };
      if (currentSettings.floatingBtn !== false) {
        injectFab();
      } else {
        removeFab();
      }
    }
  });

  // ============================
  // FAB (Floating Action Button)
  // ============================
  function injectFab() {
    if (fabEl) return; // already injected

    fabEl = document.createElement('button');
    fabEl.id = 'acadfill-fab';
    fabEl.innerHTML = `
      <span class="fab-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3L1 9L12 15L21 10.09V17H23V9L12 3Z" fill="currentColor"/>
          <path d="M5 13.18V17.18L12 21L19 17.18V13.18" fill="currentColor" opacity="0.7"/>
        </svg>
      </span>
      <span class="fab-label">AcadFill</span>
    `;
    fabEl.title = 'Click to autofill this form with your academic profile';

    fabEl.addEventListener('click', () => {
      if (!currentCandidate) {
        alert('AcadFill: No candidate profile selected. Please open the extension and select or create a profile.');
        return;
      }
      removeReport();
      const result = runAutofill(currentCandidate);
      if (currentSettings.showReport !== false) {
        showReport(result);
      }
    });

    document.body.appendChild(fabEl);
    updateFab();
  }

  function removeFab() {
    if (fabEl) {
      fabEl.remove();
      fabEl = null;
    }
  }

  function updateFab() {
    if (!fabEl) return;
    if (currentCandidate) {
      const name = getFullName(currentCandidate);
      fabEl.title = `Autofill as ${name}`;
    }
  }

  // ============================
  // AUTOFILL ENGINE
  // ============================
  function runAutofill(candidate) {
    const p = candidate.personal || {};
    const quals = candidate.qualifications || [];
    const pubs = candidate.publications || [];

    // Flat data map: key patterns -> value
    const dataMap = buildDataMap(p, quals, pubs);

    let filled = 0;
    let skipped = 0;
    const filledFields = [];
    const skippedFields = [];

    // Collect all fillable elements
    const inputs = Array.from(document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
    )).filter(el => isVisible(el) && !el.disabled && !el.readOnly);

    inputs.forEach(el => {
      const label = getFieldLabel(el);
      const match = findBestMatch(label, el, dataMap, quals);

      if (match !== null && match !== undefined && match !== '') {
        const prev = el.value;
        fillElement(el, match);
        if (el.value !== prev || match !== '') {
          filled++;
          filledFields.push(label || el.name || el.id || 'field');
          if (currentSettings.highlight !== false) {
            highlightField(el);
          }
        }
      } else {
        skipped++;
        skippedFields.push(label || el.name || el.id || 'unknown');
      }
    });

    return { success: true, filled, skipped, filledFields, skippedFields };
  }

  function buildDataMap(p, quals, pubs) {
    const map = [];

    // Personal data patterns
    addMapping(map, ['first.?name', 'fname', 'given.?name', 'firstname'], p.firstName);
    addMapping(map, ['middle.?name', 'mname', 'middlename'], p.middleName);
    addMapping(map, ['last.?name', 'surname', 'family.?name', 'lname'], p.lastName);
    // IMPORTANT: 'name of' removed — it was too broad and matched "Name of the college/university"
    addMapping(map, ['full.?name', 'candidate.?name', 'applicant.?name', 'name of (the )?applicant', 'name of (the )?candidate', 'your name', '^name$', '^name '], getFullName({ personal: p }));
    addMapping(map, ['dob', 'date.?of.?birth', 'birth.?date', 'birthdate'], p.dob);
    addMapping(map, ['gender', 'sex'], p.gender);
    addMapping(map, ['category', 'caste', 'community', 'social.?category'], p.category);
    addMapping(map, ['nationality', 'citizen'], p.nationality);
    addMapping(map, ['religion'], p.religion);
    addMapping(map, ['email', 'e-mail', 'mail.?id'], p.email);
    addMapping(map, ['mobile', 'phone', 'cell', 'contact.?no', 'telephone', 'whatsapp'], p.mobile);
    addMapping(map, ['alternate.?mobile', 'alt.?phone', 'alt.?mobile', 'other.?phone'], p.mobileAlt);
    addMapping(map, ['aadhaar', 'aadhar', 'uid.?no', 'aadhar.?no'], p.aadhaar);
    addMapping(map, ['pan.?no', 'pan.?number', 'pan.?card'], p.pan);
    addMapping(map, ['passport', 'passport.?no'], p.passport);
    addMapping(map, ['father', 'guardian.?name', 'fathers.?name'], p.fatherName);
    addMapping(map, ['mother', 'mothers.?name'], p.motherName);
    addMapping(map, ['pincode', 'pin.?code', 'postal.?code', 'zip'], p.pincode);
    addMapping(map, ['city', 'town', 'municipality'], p.city);
    addMapping(map, ['district', 'taluk', 'tehsil'], p.district);
    addMapping(map, ['state', 'province'], p.state);
    addMapping(map, ['country'], p.country);
    addMapping(map, ['address', 'street', 'addr'], buildAddress(p));
    addMapping(map, ['disabled', 'pwd', 'differently.?abled', 'handicap'], p.disabled);

    // Qualification data - map by level (prefix-based: "UG College", "10th Year" etc.)
    quals.forEach(q => {
      const level = (q.level || '').toLowerCase();
      const prefix = getQualPrefix(level);
      if (!prefix) return;

      addMapping(map, [`${prefix}.?percent`, `${prefix}.?marks`, `${prefix}.?aggregate`, `${prefix}.?cgpa`], q.percentage);
      addMapping(map, [`${prefix}.?year`, `${prefix}.?passing`, `${prefix}.?passout`], q.year);
      addMapping(map, [`${prefix}.?board`, `${prefix}.?universit`], q.board);
      addMapping(map, [`${prefix}.?institute`, `${prefix}.?college`, `${prefix}.?school`], q.institution);
      addMapping(map, [`${prefix}.?subject`, `${prefix}.?speciali`, `${prefix}.?stream`, `${prefix}.?branch`, `${prefix}.?discipline`], q.specialization);
      addMapping(map, [`${prefix}.?degree`, `${prefix}.?course`], q.degree);
      addMapping(map, [`${prefix}.?roll`, `${prefix}.?enrollment`, `${prefix}.?reg.?no`], q.rollNo);
      addMapping(map, [`${prefix}.?duration`, `${prefix}.?period`], q.duration);
      addMapping(map, [`${prefix}.?obtain`, `${prefix}.?secured`, `${prefix}.?scored`], q.marksObtained);
      addMapping(map, [`${prefix}.?max.?marks`, `${prefix}.?total.?marks`, `${prefix}.?full.?marks`], q.maxMarks);
    });

    // Publication count
    addMapping(map, ['publications?', 'papers?', 'research.?papers?', 'no.?.?publications?', 'number.?publications?'], pubs.length > 0 ? String(pubs.length) : null);

    return map;
  }

  /**
   * Context-aware label resolution.
   * Many portals use generic labels like "Name of the College" / "Name of the University"
   * inside section blocks labeled "UG Details", "PG Details", etc.
   * We detect the nearest section header and pick the right qualification.
   */
  function findContextualQual(el, quals, field) {
    if (!quals || quals.length === 0) return null;

    // Walk up the DOM to find a heading or legend that names the section
    let node = el.parentElement;
    const maxDepth = 12;
    let depth = 0;
    while (node && depth < maxDepth) {
      const headings = node.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,caption,th,.section-title,.section-header');
      for (const h of headings) {
        const text = h.textContent.toLowerCase();
        for (const q of quals) {
          const lvl = (q.level || '').toLowerCase();
          const prefix = getQualPrefix(lvl);
          if (!prefix) continue;
          const prefixRe = new RegExp(prefix, 'i');
          if (prefixRe.test(text)) {
            return q[field] || null;
          }
        }
      }
      node = node.parentElement;
      depth++;
    }

    // Fallback: return highest applicable qualification's field
    const order = ['phd','pg','ug','diploma','12th','10th'];
    for (const lvl of order) {
      const q = quals.find(q => {
        const l = (q.level || '').toLowerCase();
        return getQualPrefix(l) && new RegExp(lvl, 'i').test(getQualPrefix(l));
      });
      if (q && q[field]) return q[field];
    }
    return quals[quals.length - 1]?.[field] || null;
  }

  function addMapping(map, patterns, value) {
    if (value === null || value === undefined || value === '') return;
    map.push({ patterns: patterns.map(p => new RegExp(p, 'i')), value: String(value) });
  }

  function getQualPrefix(level) {
    if (/10th|ssc|secondary|matriculat|class.?10|hslc|secondary.?school/i.test(level)) return '(10th|ssc|secondary|matric|class.?10|hslc)';
    if (/12th|hsc|higher.?secondary|intermediate|class.?12|puc|plus.?two/i.test(level)) return '(12th|hsc|higher.?secondary|intermediate|class.?12|puc|plus.?two|hs|10\+2)';
    if (/diploma/i.test(level)) return '(diploma|poly)';
    if (/ug|bachelor|b\.?tech|b\.?e|b\.?sc|b\.?com|b\.?a|b\.?pharm|graduation/i.test(level)) return '(ug|bachelor|grad(uation)?|b\.?tech|b\.?e|b\.?sc|b\.?com|b\.?a|under.?grad)';
    if (/pg|master|m\.?tech|m\.?e|m\.?sc|m\.?com|m\.?a|post.?grad/i.test(level)) return '(pg|master|m\.?tech|m\.?e|m\.?sc|m\.?com|m\.?a|post.?grad)';
    if (/m\.?phil/i.test(level)) return '(m\.?phil)';
    if (/phd|ph\.?d|doctorate|d\.?phil/i.test(level)) return '(ph\.?d|phd|doctor|d\.?phil)';
    if (/post.?doc/i.test(level)) return '(post.?doc)';
    return null;
  }

  function buildAddress(p) {
    return [p.addr1, p.addr2, p.city, p.district, p.state, p.pincode, p.country]
      .filter(Boolean).join(', ');
  }

  function getFullName(candidate) {
    const p = candidate?.personal || {};
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || candidate?.name || '';
  }

  // ============================
  // LABEL EXTRACTION
  // ============================
  function getFieldLabel(el) {
    const parts = [];

    // Explicit label via for= or aria-label
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) parts.push(lbl.textContent);
    }
    if (el.getAttribute('aria-label')) parts.push(el.getAttribute('aria-label'));
    if (el.getAttribute('aria-labelledby')) {
      const lblEl = document.getElementById(el.getAttribute('aria-labelledby'));
      if (lblEl) parts.push(lblEl.textContent);
    }

    // Placeholder and name/id
    if (el.placeholder) parts.push(el.placeholder);
    if (el.name) parts.push(el.name.replace(/[_\-]/g, ' '));
    if (el.id) parts.push(el.id.replace(/[_\-]/g, ' '));

    // Nearest wrapping label text
    const parentLabel = el.closest('label');
    if (parentLabel) parts.push(parentLabel.textContent);

    // Preceding sibling text or nearby div/span with label-like text
    const parent = el.closest('div, td, li, p, section, fieldset');
    if (parent) {
      const texts = Array.from(parent.querySelectorAll('label, span, p, th, td, legend, h1, h2, h3, h4, h5, h6'))
        .map(n => n.textContent.trim())
        .filter(t => t.length > 1 && t.length < 100);
      parts.push(...texts);
    }

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  // ============================
  // MATCHING LOGIC
  // ============================

  // Generic label patterns that should use context-aware qual resolution instead of the data map
  const GENERIC_QUAL_PATTERNS = [
    { re: /name\s+of\s+(the\s+)?college|college\s+name|institution\s+name|school\s+name|institute\s+name/i,  field: 'institution' },
    { re: /name\s+of\s+(the\s+)?university|university\s+name|board\s+name/i,                               field: 'board' },
    { re: /^(degree|degree\/course|course\s+name|programme\s+name|qualification)$/i,                        field: 'degree' },
    { re: /^(year\s+of\s+passing|passing\s+year|year\s+of\s+completion|year)$/i,                           field: 'year' },
    { re: /^(percentage|percent|marks|aggregate|cgpa|gpa)$/i,                                               field: 'percentage' },
    { re: /^(specialization|stream|branch|discipline|subject)$/i,                                           field: 'specialization' },
    { re: /^(roll\s+no|enrollment\s+no|reg\s+no|registration\s+no)$/i,                                    field: 'rollNo' },
  ];

  function findBestMatch(label, el, dataMap, quals) {
    if (!label) return null;

    // 1. Try context-aware generic label matching FIRST
    //    (catches "Name of the College", "Name of the University", standalone "Degree" etc.)
    if (quals && quals.length > 0) {
      for (const { re, field } of GENERIC_QUAL_PATTERNS) {
        if (re.test(label.trim())) {
          const val = findContextualQual(el, quals, field);
          if (val) return val;
        }
      }
    }

    // 2. Try the full data map (personal info + prefixed qual patterns)
    for (const entry of dataMap) {
      for (const pattern of entry.patterns) {
        if (pattern.test(label)) {
          return entry.value;
        }
      }
    }

    // 3. Also check el.name and el.id directly against the data map
    const directText = [(el.name || ''), (el.id || '')].join(' ').replace(/[_\-]/g, ' ');
    for (const entry of dataMap) {
      for (const pattern of entry.patterns) {
        if (pattern.test(directText)) {
          return entry.value;
        }
      }
    }

    return null;
  }

  // ============================
  // FILL ELEMENT
  // ============================
  function fillElement(el, value) {
    if (el.tagName === 'SELECT') {
      fillSelect(el, value);
    } else if (el.type === 'date') {
      fillDate(el, value);
    } else {
      el.value = value;
      triggerEvents(el);
    }
  }

  function fillSelect(select, value) {
    const lv = value.toLowerCase();
    let bestOption = null;
    let bestScore = 0;

    Array.from(select.options).forEach(opt => {
      const ov = opt.text.toLowerCase();
      const score = matchScore(lv, ov);
      if (score > bestScore) {
        bestScore = score;
        bestOption = opt;
      }
    });

    if (bestOption && bestScore > 0.3) {
      select.value = bestOption.value;
      triggerEvents(select);
    }
  }

  function fillDate(el, value) {
    // Try various formats: dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, dd-mm-yyyy
    let date = null;

    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // yyyy-mm-dd
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // dd/mm/yyyy
      /^(\d{2})-(\d{2})-(\d{4})$/, // dd-mm-yyyy
      /^(\d{2})\.(\d{2})\.(\d{4})$/, // dd.mm.yyyy
    ];

    if (formats[0].test(value)) {
      date = value; // already ISO
    } else if (formats[1].test(value)) {
      const [, d, m, y] = value.match(formats[1]);
      date = `${y}-${m}-${d}`;
    } else if (formats[2].test(value)) {
      const [, d, m, y] = value.match(formats[2]);
      date = `${y}-${m}-${d}`;
    } else if (formats[3].test(value)) {
      const [, d, m, y] = value.match(formats[3]);
      date = `${y}-${m}-${d}`;
    }

    if (date) {
      el.value = date;
      triggerEvents(el);
    }
  }

  function matchScore(a, b) {
    if (a === b) return 1;
    if (b.includes(a) || a.includes(b)) return 0.8;
    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);
    const common = aWords.filter(w => bWords.some(bw => bw.includes(w) || w.includes(bw)));
    return common.length / Math.max(aWords.length, bWords.length);
  }

  function triggerEvents(el) {
    ['input', 'change', 'blur', 'keyup'].forEach(evtName => {
      el.dispatchEvent(new Event(evtName, { bubbles: true }));
    });
    // React synthetic events
    try {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter && el.tagName === 'INPUT') {
        nativeInputValueSetter.call(el, el.value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } catch (e) { /* ignore */ }
  }

  // ============================
  // HELPERS
  // ============================
  function isVisible(el) {
    if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function highlightField(el) {
    el.classList.remove('acadfill-highlighted');
    void el.offsetWidth; // reflow
    el.classList.add('acadfill-highlighted');
    setTimeout(() => el.classList.remove('acadfill-highlighted'), 1500);
  }

  // ============================
  // FILL REPORT PANEL
  // ============================
  function showReport(result) {
    removeReport();

    reportEl = document.createElement('div');
    reportEl.id = 'acadfill-report';

    const filledHtml = result.filledFields.slice(0, 10).map(f =>
      `<div class="field-item ok"><span class="dot"></span>${escHtml(truncate(f, 30))}</div>`
    ).join('');

    const skippedHtml = result.skippedFields.slice(0, 5).map(f =>
      `<div class="field-item skip"><span class="dot"></span>${escHtml(truncate(f, 30))}</div>`
    ).join('');

    reportEl.innerHTML = `
      <div class="report-header">
        <span class="report-title">✅ Autofill Complete</span>
        <button class="report-close" id="acadfill-close-report">✕</button>
      </div>
      <div class="report-body">
        <div class="report-stat">
          <span class="label">Fields Filled</span>
          <span class="value filled">${result.filled}</span>
        </div>
        <div class="report-stat">
          <span class="label">Fields Skipped</span>
          <span class="value skipped">${result.skipped}</span>
        </div>
        <div class="report-divider"></div>
        <div class="report-fields">
          ${filledHtml}
          ${result.filled === 0 ? '<div class="field-item skip"><span class="dot"></span>No matching fields found</div>' : ''}
          ${skippedHtml}
        </div>
      </div>
    `;

    document.body.appendChild(reportEl);

    document.getElementById('acadfill-close-report').addEventListener('click', removeReport);

    // Auto-hide after 8 seconds
    setTimeout(removeReport, 8000);
  }

  function removeReport() {
    if (reportEl) {
      reportEl.remove();
      reportEl = null;
    }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

})();
