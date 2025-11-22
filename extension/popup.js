document.addEventListener('DOMContentLoaded', () => {
  // Analyze Button
  document.getElementById('btn').addEventListener('click', () => {
    const t = document.getElementById('inp').value.trim();
    if(!t) return;

    document.getElementById('res').innerHTML = '<span style="color:#888;">Running Analysis...</span>';

    // Use background script to run the engine
    chrome.runtime.sendMessage({action: "manualCheck", text: t}, (res) => {
      if(!res) {
        document.getElementById('res').innerHTML = '<span style="color:red;">Error connecting to engine.</span>';
        return;
      }

      // Render Result
      let color = '#d32f2f'; // Red
      if(res.score >= 80) color = '#2e7d32'; // Green
      else if(res.score >= 50) color = '#f57c00'; // Orange

      document.getElementById('res').innerHTML = `
      <div style="margin-bottom:5px; font-weight:bold; color:${color};">${res.verdict}</div>
      <div style="font-size:12px; margin-bottom:5px;">${res.source}</div>
      <div>${res.details}</div>
      `;
    });
  });

  // Links
  document.getElementById('openOptions').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
    else window.open(chrome.runtime.getURL('options.html'));
  });

    document.getElementById('openForensics').addEventListener('click', () => {
      chrome.tabs.create({ url: 'forensics.html' });
    });
});
