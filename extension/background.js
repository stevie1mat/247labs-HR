const PLATFORM_CONFIG = {
  linkedin: {
    label: "LinkedIn",
    url: "https://www.linkedin.com/job-posting/v2/",
  },
  indeed: {
    label: "Indeed",
    url: "https://employers.indeed.com/job-posting/from-scratch/getting-started",
  },
  wellfound: {
    label: "Wellfound",
    url: "https://wellfound.com/recruit/jobs/new",
  },
  ziprecruiter: {
    label: "ZipRecruiter",
    url: "https://www.ziprecruiter.com/post-a-job",
  },
  remotive: {
    label: "Remotive",
    url: "https://remotive.com/post-a-remote-job",
  },
};

let currentStatus = "Ready";
const managedTabs = new Map();

function saveLog(message) {
  const line = `[Background] ${new Date().toLocaleTimeString()} - ${message}`;
  console.log(line);

  chrome.storage.local.get({ logs: [] }, (result) => {
    const logs = [...result.logs, line].slice(-80);
    chrome.storage.local.set({ logs });
  });
}

function setStatus(status) {
  currentStatus = status;
  saveLog(status);
}

async function injectAndPrepareTab(tabId, platform, jobData) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content_agent.js"],
  });

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      {
        type: "PREPARE_PLATFORM_FILL",
        platform,
        jobData,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            reason: chrome.runtime.lastError.message,
          });
          return;
        }

        resolve(response || { ok: true });
      }
    );
  });
}

function shouldResumePlatformOnUrl(platform, url = "") {
  if (!url) return false;

  if (platform === "linkedin") {
    return /^https:\/\/www\.linkedin\.com\/(job-posting|hiring\/jobs)\//.test(url);
  }

  return Boolean(PLATFORM_CONFIG[platform]?.url && url.startsWith(new URL(PLATFORM_CONFIG[platform].url).origin));
}

function scheduleManagedTabResume(tabId, url) {
  const managed = managedTabs.get(tabId);
  if (!managed || !shouldResumePlatformOnUrl(managed.platform, url)) return;

  clearTimeout(managed.resumeTimer);
  managed.lastUrl = url;
  managed.resumeTimer = setTimeout(async () => {
    try {
      saveLog(`${PLATFORM_CONFIG[managed.platform]?.label || managed.platform}: resuming automation after navigation.`);
      const result = await injectAndPrepareTab(tabId, managed.platform, managed.jobData);
      if (result?.ok === false) {
        saveLog(`${PLATFORM_CONFIG[managed.platform]?.label || managed.platform}: ${result.reason || "Could not resume automation."}`);
      }
    } catch (error) {
      saveLog(`${PLATFORM_CONFIG[managed.platform]?.label || managed.platform}: ${error.message}`);
    }
  }, 1800);
}

function createPlatformTab(platform, jobData) {
  const config = PLATFORM_CONFIG[platform];

  if (!config) {
    saveLog(`Unsupported platform requested: ${platform}`);
    return;
  }

  chrome.tabs.create({ url: config.url }, (tab) => {
    if (!tab?.id) {
      saveLog(`Could not open tab for ${config.label}.`);
      return;
    }

    saveLog(`Opened ${config.label} in tab ${tab.id}. Waiting for the page to settle.`);
    managedTabs.set(tab.id, {
      platform,
      jobData,
      lastUrl: config.url,
      resumeTimer: null,
    });

    setTimeout(async () => {
      try {
        const result = await injectAndPrepareTab(tab.id, platform, jobData);

        if (result?.ok === false) {
          saveLog(`${config.label}: ${result.reason || "Could not prepare fill preview."}`);
          return;
        }

        saveLog(`${config.label}: preview is ready in the page. Waiting for user confirmation.`);
      } catch (error) {
        saveLog(`${config.label}: ${error.message}`);
      }
    }, 4500);
  });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!managedTabs.has(tabId)) return;

  const url = changeInfo.url || tab?.url || "";
  if (changeInfo.status === "complete" || changeInfo.url) {
    scheduleManagedTabResume(tabId, url);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const managed = managedTabs.get(tabId);
  if (managed?.resumeTimer) clearTimeout(managed.resumeTimer);
  managedTabs.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATUS") {
    sendResponse({ status: currentStatus });
    return;
  }

  if (message.type === "EXTENSION_LOG") {
    if (message.status) currentStatus = message.status;
    if (message.message) saveLog(message.message);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "EXECUTE_JOB") {
    const { platforms = [], jobData = {} } = message.payload || {};

    if (!Array.isArray(platforms) || platforms.length === 0) {
      setStatus("No platforms selected.");
      sendResponse({ ok: false, reason: "No platforms selected." });
      return;
    }

    setStatus(`Opening ${platforms.length} platform${platforms.length === 1 ? "" : "s"} for review...`);
    platforms.forEach((platform) => createPlatformTab(platform, jobData));
    sendResponse({ ok: true });
  }
});
