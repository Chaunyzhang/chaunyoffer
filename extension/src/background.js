const BADGE_COLOR = '#0f3550';

function getUnsupportedReason(url = '') {
  if (!url) return 'Page URL unavailable';
  if (/^(chrome|edge|brave|vivaldi|opera):\/\//i.test(url)) return 'Browser internal pages block extension injection';
  if (/^chrome-extension:\/\//i.test(url)) return 'Extension pages cannot be injected again';
  if (/^devtools:\/\//i.test(url)) return 'DevTools pages do not allow injection';
  if (/^view-source:/i.test(url)) return 'View-source pages do not allow injection';
  if (/chrome\.google\.com\/webstore/i.test(url) || /microsoftedge\.microsoft\.com\/addons/i.test(url)) return 'Extension store pages block injection';
  if (/\.pdf([?#].*)?$/i.test(url)) return 'Built-in PDF viewers usually block content scripts';
  return '';
}

async function flashBadge(tabId, text, title, timeout = 2200) {
  if (!tabId) return;
  await chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setTitle({ tabId, title });
  setTimeout(async () => {
    try {
      await chrome.action.setBadgeText({ tabId, text: '' });
      await chrome.action.setTitle({ tabId, title: 'Chauny Resume Helper' });
    } catch {}
  }, timeout);
}

async function requestPanelOpen(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'RESUME_PANEL_OPEN' });
    return !!response?.ok;
  } catch {
    return false;
  }
}

async function injectContent(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId, allFrames: true },
    files: ['src/content.css']
  });

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['vendor/jszip.min.js', 'vendor/mammoth.browser.min.js', 'src/content.js']
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  const unsupportedReason = getUnsupportedReason(tab.url || '');
  if (unsupportedReason) {
    await flashBadge(tab.id, 'NO', unsupportedReason);
    return;
  }

  if (await requestPanelOpen(tab.id)) return;

  try {
    await injectContent(tab.id);
    await new Promise((resolve) => setTimeout(resolve, 180));

    for (let i = 0; i < 4; i += 1) {
      if (await requestPanelOpen(tab.id)) {
        await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 140));
    }

    await flashBadge(tab.id, 'ERR', 'Injected, but panel did not open');
  } catch (error) {
    const message = error?.message || 'Injection failed on this page';
    await flashBadge(tab.id, 'ERR', message);
  }
});
