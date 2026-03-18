const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const openPanelBtn = document.getElementById("openPanel");
const clearBtn = document.getElementById("clearData");
const docxInput = document.getElementById("docxInput");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#dc2626" : "#16a34a";
}

async function openPanel() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("未找到当前标签页", true);
    return;
  }

  try {
    let response = null;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "RESUME_PANEL_OPEN" });
    } catch {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ["src/content.css"]
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["vendor/jszip.min.js", "vendor/mammoth.browser.min.js", "src/content.js"]
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      response = await chrome.tabs.sendMessage(tab.id, { type: "RESUME_PANEL_OPEN" });
    }

    if (response?.ok) {
      setStatus("悬浮窗已打开");
    } else {
      setStatus("悬浮窗打开失败，请刷新页面后重试", true);
    }
  } catch (error) {
    console.error(error);
    setStatus("当前页面暂不支持打开悬浮窗", true);
  }
}

openPanelBtn?.addEventListener("click", openPanel);

clearBtn?.addEventListener("click", async () => {
  await chrome.storage.local.remove(["resumeParsed", "resumeFlattened", "resumeEditable", "resumeUpdatedAt"]);
  previewEl.innerHTML = "<div class='item'>已清空，后续请直接使用网页浮窗导入与编辑。</div>";
  setStatus("已清空本地数据");
});

docxInput?.addEventListener("change", async () => {
  setStatus("该页面已停用，请直接在网页浮窗里导入 .docx", true);
});

(async function init() {
  previewEl.innerHTML = "<div class='item'>当前弹窗已停用。请直接点击“打开网页悬浮窗”，后续所有导入、编辑、预览都在网页浮窗内完成。</div>";
  setStatus("兼容页已加载");
})();
