function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0] || null));
  });
}

export async function runInActiveTab(payload) {
  const tab = await getActiveTab();
  if (!tab?.id) return { ok: false, message: "No active tab found." };

  await new Promise((resolve) => {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }, () =>
      resolve()
    );
  });

  return await new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { type: "SV_AUTOFILL_RUN", payload }, (resp) => {
      const err = chrome.runtime.lastError;
      if (err) return resolve({ ok: false, message: err.message || "sendMessage failed" });
      resolve(resp || { ok: false, message: "No response from content script." });
    });
  });
}
