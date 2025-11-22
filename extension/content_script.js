// ==========================================
// UNBREAKING NEWS - UI LAYER
// ==========================================

let floatBtn = null;

// 1. MESSAGE HANDLER
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'processing') showGlassOverlay('Analyzing...', 'loading');
  if (msg.action === 'showResults') showGlassCard(msg.data);
});

// 2. SELECTION HANDLER
document.addEventListener('mouseup', (e) => {
  const text = window.getSelection().toString().trim();
  if (text.length > 5 && text.length < 4000) {
    if (!floatBtn) createBtn();

    const range = window.getSelection().getRangeAt(0);
    const rect = range.getBoundingClientRect();

    floatBtn.style.top = `${window.scrollY + rect.bottom + 12}px`;
    floatBtn.style.left = `${window.scrollX + rect.left}px`;
    floatBtn.style.opacity = '1';
    floatBtn.style.pointerEvents = 'auto';

    floatBtn.onclick = (evt) => {
      evt.stopPropagation();
      floatBtn.style.opacity = '0';
      floatBtn.style.pointerEvents = 'none';

      // UI Feedback
      showGlassOverlay("Verifying...", "loading");

      // Safety Timeout (6 seconds max)
      const safety = setTimeout(() => {
        showGlassOverlay("Connection weak. Retrying...", "error");
      }, 6000);

      // Send
      chrome.runtime.sendMessage({ action: "verifyText", text: text }, () => {
        clearTimeout(safety);
      });
    };
  } else {
    if (floatBtn) {
      floatBtn.style.opacity = '0';
      floatBtn.style.pointerEvents = 'none';
    }
  }
});

// 3. UI BUILDER (Glassmorphism)

function createBtn() {
  floatBtn = document.createElement('div');
  floatBtn.id = 'ubn-glass-btn';
  floatBtn.innerHTML = '✨ Verify';
  document.body.appendChild(floatBtn);
}

function showGlassOverlay(text, type) {
  removeUI();
  const div = document.createElement('div');
  div.id = 'ubn-glass-overlay';
  div.className = type;

  if (type === 'loading') {
    div.innerHTML = `<div class="ubn-loader"></div><span>${text}</span>`;
  } else {
    div.innerHTML = `<span>⚠️ ${text}</span>`;
  }
  document.body.appendChild(div);
}

function showGlassCard(data) {
  removeUI();
  const div = document.createElement('div');
  div.id = 'ubn-glass-card';

  // Dynamic Color Gradient
  let gradient = 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)'; // Neutral
  if (data.score >= 80) gradient = 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)'; // Good
  if (data.score <= 45) gradient = 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)'; // Bad

  const flagsHtml = data.flags && data.flags.length
  ? `<div class="ubn-chips">${data.flags.map(f => `<span>${f}</span>`).join('')}</div>` : '';

  div.innerHTML = `
  <div class="ubn-card-header" style="background: ${gradient};">
  <div class="ubn-card-title">
  <span style="font-size:10px; text-transform:uppercase; opacity:0.8;">${data.method}</span>
  <strong>${data.verdict}</strong>
  </div>
  <div class="ubn-score-circle">${data.score}</div>
  <button class="ubn-close" onclick="document.getElementById('ubn-glass-card').remove()">×</button>
  </div>
  <div class="ubn-card-body">
  ${data.domainLabel ? `<div class="ubn-domain-badge">🏛️ ${data.domainLabel}</div>` : ''}
  <p>${data.details}</p>
  ${flagsHtml}
  <a href="${data.url || 'https://google.com/search?q='+encodeURIComponent('fact check')}" target="_blank" class="ubn-action-btn">
  Search Evidence ↗
  </a>
  </div>
  `;
  document.body.appendChild(div);
}

function removeUI() {
  const o = document.getElementById('ubn-glass-overlay'); if(o) o.remove();
  const c = document.getElementById('ubn-glass-card'); if(c) c.remove();
}
