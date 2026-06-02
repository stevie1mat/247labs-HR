// Listen for messages from the React app dashboard
window.addEventListener("message", (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data && event.data.type === "POST_JOB_EXTENSION") {
    console.log("Extension intercepted job posting request:", event.data.payload);

    if (!globalThis.chrome?.runtime?.sendMessage) {
      console.warn("247Labs extension bridge is unavailable in this page context. Reload the extension and refresh the dashboard.");
      return;
    }
    
    // Forward to background worker
    chrome.runtime.sendMessage({
      type: "EXECUTE_JOB",
      payload: event.data.payload
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("247Labs extension bridge failed:", chrome.runtime.lastError.message);
        return;
      }

      if (response?.error) {
        console.warn("247Labs extension background returned an error:", response.error);
      }
    });
  }
});
