chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "RESUME_PANEL_OPEN" });
    if (response?.ok) return;
  } catch {}

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["src/content.css"]
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["vendor/jszip.min.js", "vendor/mammoth.browser.min.js", "src/content.js"]
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    for (let i = 0; i < 3; i += 1) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: "RESUME_PANEL_OPEN" });
        if (response?.ok) return;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  } catch {}
});
