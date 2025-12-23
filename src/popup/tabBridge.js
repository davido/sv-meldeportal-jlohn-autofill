function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
  });
}

function executeContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
      const err = chrome.runtime.lastError;
      if (err) return resolve({ ok: false, message: err.message || "executeScript failed" });
      resolve({ ok: true });
    });
  });
}

export async function runInActiveTab(payload) {
  const tab = await getActiveTab();
  if (!tab?.id) return { ok: false, message: "No active tab found." };

  const inj = await executeContentScript(tab.id);
  if (!inj.ok) return inj;

  return await new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: "SV_AUTOFILL_RUN", payload }, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return resolve({ ok: false, message: err.message || "sendMessage failed" });
      resolve(resp || { ok: false, message: "No response from content script." });
    });
  });
}
