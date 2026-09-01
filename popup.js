const input = document.getElementById("apiKey");
const status = document.getElementById("status");
const saveBtn = document.getElementById("save");

async function loadStatus() {
  const { hasKey } = await chrome.runtime.sendMessage({ type: "GET_API_KEY_STATUS" });
  status.textContent = hasKey ? "Key saved." : "No key set — using unauthenticated rate limit.";
}

saveBtn.addEventListener("click", async () => {
  const apiKey = input.value.trim();
  if (!apiKey) {
    status.textContent = "Enter a key first.";
    return;
  }
  await chrome.runtime.sendMessage({ type: "SET_API_KEY", apiKey });
  input.value = "";
  status.textContent = "Saved.";
});

loadStatus();
