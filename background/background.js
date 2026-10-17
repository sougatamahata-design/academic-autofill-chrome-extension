/**
 * AcadFill - background.js (Service Worker)
 * Handles extension lifecycle, context menus, and cross-tab messaging
 */

// ============================
// INSTALLATION
// ============================
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open onboarding popup on first install
    chrome.action.openPopup().catch(() => {
      // Fallback: open options page if popup fails
    });
  }

  // Set up context menu
  chrome.contextMenus.create({
    id: 'acadfill-trigger',
    title: 'AcadFill: Autofill this page',
    contexts: ['page', 'frame']
  });
});

// ============================
// CONTEXT MENU HANDLER
// ============================
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'acadfill-trigger') {
    triggerAutofillOnTab(tab.id);
  }
});

// ============================
// TRIGGER AUTOFILL FROM BACKGROUND
// ============================
async function triggerAutofillOnTab(tabId) {
  const result = await chrome.storage.local.get(['acadfill_active', 'acadfill_candidates', 'acadfill_settings']);
  const activeId = result.acadfill_active;
  const candidates = result.acadfill_candidates || {};
  const settings = result.acadfill_settings || {};

  if (!activeId || !candidates[activeId]) {
    // Notify user via badge
    chrome.action.setBadgeText({ text: '!', tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626', tabId });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '', tabId });
    }, 3000);
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'AUTOFILL',
      candidate: candidates[activeId],
      settings
    });

    if (response && response.filled > 0) {
      chrome.action.setBadgeText({ text: String(response.filled), tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#16a34a', tabId });
      setTimeout(() => {
        chrome.action.setBadgeText({ text: '', tabId });
      }, 4000);
    }
  } catch (e) {
    console.error('AcadFill: Could not connect to content script.', e);
  }
}

// ============================
// ACTION CLICK (toolbar icon)
// ============================
chrome.action.onClicked.addListener((tab) => {
  // Opening popup is handled automatically by manifest
  // This fires when default_popup is NOT set (fallback)
});

// ============================
// TAB UPDATES: Notify content scripts of active candidate
// ============================
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

  const result = await chrome.storage.local.get(['acadfill_active', 'acadfill_candidates', 'acadfill_settings']);
  const activeId = result.acadfill_active;
  const candidates = result.acadfill_candidates || {};
  const settings = result.acadfill_settings || {};

  if (!activeId || !candidates[activeId]) return;

  // Small delay to ensure content script is ready
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, {
      type: 'CANDIDATE_CHANGED',
      candidate: candidates[activeId],
      settings
    }).catch(() => { /* tab may not have content script */ });
  }, 800);
});

// ============================
// STORAGE CHANGE: Update badge across tabs
// ============================
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;

  if (changes.acadfill_active || changes.acadfill_candidates) {
    const result = await chrome.storage.local.get(['acadfill_active', 'acadfill_candidates']);
    const activeId = result.acadfill_active;
    const candidates = result.acadfill_candidates || {};

    if (activeId && candidates[activeId]) {
      const name = candidates[activeId].name;
      const short = name.slice(0, 4).toUpperCase();
      const tabs = await chrome.tabs.query({});
      tabs.forEach(tab => {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          chrome.action.setBadgeText({ text: '', tabId: tab.id });
        }
      });
    }
  }
});

console.log('AcadFill: Background service worker started.');
