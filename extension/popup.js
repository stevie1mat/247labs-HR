chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
  if (response?.status) {
    document.getElementById("status").textContent = response.status;
  }
});

chrome.storage.local.get({ logs: [] }, (result) => {
  const logsDiv = document.getElementById("logs");
  if (!result.logs.length) {
    logsDiv.textContent = "No logs yet...";
    return;
  }

  logsDiv.innerHTML = result.logs.join("<br/>");
  logsDiv.scrollTop = logsDiv.scrollHeight;
});
