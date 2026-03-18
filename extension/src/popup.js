import { parseResumeText, flattenForFill } from "./parser.js";

const docxInput = document.getElementById("docxInput");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const openPanelBtn = document.getElementById("openPanel");
const clearBtn = document.getElementById("clearData");

function truncateText(text, max = 50) {
  const plain = String(text || "").replace(/\s+/g, " ").trim();
  return plain.length > max ? plain.slice(0, max) + "..." : plain;
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "#dc2626" : "#16a34a";
}

function renderPreview(flattened) {
  if (!flattened.length) {
    previewEl.innerHTML = "<div class='item'>暂无可用字段</div>";
    return;
  }
  previewEl.innerHTML = flattened.map((x) => {
    if (x.group) {
      const children = (x.children || []).map((c) => `<div class='k'>${c.label}</div><div class='v'>${truncateText(c.value)}</div>`).join("");
      return `<div class='item'><div class='k'>${x.label}</div>${children}</div>`;
    }
    return `<div class='item'><div class='k'>${x.label}</div><div class='v'>${truncateText(x.value)}</div></div>`;
  }).join("");
}

async function persistAndRefresh(flattened, parsed) {
  await chrome.storage.local.set({
    resumeParsed: parsed,
    resumeFlattened: flattened,
    resumeUpdatedAt: Date.now()
  });
  renderPreview(flattened);
  setStatus(`解析成功，共 ${flattened.length} 项字段`);
}

docxInput.addEventListener("change", async () => {
  const file = docxInput.files?.[0];
  if (!file) return;

  try {
    setStatus("正在解析 Word...", false);
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer });
    const parsed = parseResumeText(result.value || "");
    const flattened = flattenForFill(parsed);
    await persistAndRefresh(flattened, parsed);
  } catch (error) {
    console.error(error);
    setStatus("解析失败，请确认是 .docx 文件", true);
  }
});

openPanelBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    let response = null;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: "RESUME_PANEL_OPEN" });
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"]
      });
      response = await chrome.tabs.sendMessage(tab.id, { type: "RESUME_PANEL_OPEN" });
    }

    if (response?.ok) {
      setStatus("悬浮窗已打开", false);
    } else {
      setStatus("悬浮窗打开失败，请刷新当前页面后重试", true);
    }
  } catch (error) {
    console.error(error);
    setStatus("当前页面暂不支持打开悬浮窗", true);
  }
});

clearBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["resumeParsed", "resumeFlattened", "resumeUpdatedAt"]);
  renderPreview([]);
  setStatus("已清空本地简历数据", false);
});

(async function init() {
  const { resumeFlattened } = await chrome.storage.local.get(["resumeFlattened"]);
  renderPreview(resumeFlattened || []);
})();
