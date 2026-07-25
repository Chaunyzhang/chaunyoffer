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

async function callDeepSeek({ apiKey, model, systemPrompt, userText }) {
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'deepseek-v4-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      // v4 默认开启思考模式，会把 token 额度耗在推理上导致正文为空/截断，结构化任务必须关掉
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 8192
    })
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.error?.message || `HTTP ${resp.status}`);
  return data?.choices?.[0]?.message?.content || '';
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // DEEPSEEK_PARSE = 简历文本解析；DEEPSEEK_MATCH = 自动填充的页面字段语义匹配
  if (message?.type !== 'DEEPSEEK_PARSE' && message?.type !== 'DEEPSEEK_MATCH') return undefined;
  (async () => {
    try {
      const userText = message.type === 'DEEPSEEK_MATCH' ? message.userText : message.resumeText;
      const content = await callDeepSeek({
        apiKey: message.apiKey,
        model: message.model,
        systemPrompt: message.systemPrompt,
        userText
      });
      sendResponse({ ok: true, content });
    } catch (error) {
      sendResponse({ ok: false, error: String(error?.message || error) });
    }
  })();
  return true;
});

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
