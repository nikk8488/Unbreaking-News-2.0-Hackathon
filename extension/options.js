document.addEventListener('DOMContentLoaded', () => {
  // Restore Settings
  chrome.storage.local.get(['googleKey', 'hfKey'], (items) => {
    if (items.googleKey) document.getElementById('gKey').value = items.googleKey;
    if (items.hfKey) document.getElementById('hKey').value = items.hfKey;
  });

    // Save Settings
    document.getElementById('save').addEventListener('click', () => {
      const gKey = document.getElementById('gKey').value.trim();
      const hKey = document.getElementById('hKey').value.trim();

      chrome.storage.local.set({
        googleKey: gKey,
        hfKey: hKey
      }, () => {
        const status = document.getElementById('status');
        status.textContent = "✨ Settings Saved Successfully!";
        status.className = "success";
        setTimeout(() => {
          status.textContent = "";
          status.className = "";
        }, 2000);
      });
    });
});
