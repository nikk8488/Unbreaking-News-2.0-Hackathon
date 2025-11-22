// ==============================================================================
// 1. ADVANCED KNOWLEDGE MATRIX
// ==============================================================================
const DOMAIN_DB = {
  // Satire
  "theonion.com": { score: 0, type: "Satire", label: "Known Satire" },
  "babylonbee.com": { score: 0, type: "Satire", label: "Known Satire" },
  "duffelblog.com": { score: 10, type: "Satire", label: "Military Satire" },
  "waterfordwhispersnews.com": { score: 10, type: "Satire", label: "Satire" },

  // High Trust
  "reuters.com": { score: 100, type: "Gold Standard", label: "Wire Service" },
  "apnews.com": { score: 100, type: "Gold Standard", label: "Wire Service" },
  "bbc.com": { score: 95, type: "Trusted", label: "Public Broadcaster" },
  "nature.com": { score: 100, type: "Science", label: "Peer Reviewed" },

  // Mixed / Biased
  "foxnews.com": { score: 55, type: "Cable News", label: "Right-Leaning Bias" },
  "msnbc.com": { score: 55, type: "Cable News", label: "Left-Leaning Bias" },
  "dailymail.co.uk": { score: 35, type: "Tabloid", label: "Sensationalist" },
  "nypost.com": { score: 45, type: "Tabloid", label: "Mixed Reliability" }
};

const VOCABULARY = {
  sensational: [
    "shocking", "exposed", "miracle", "secret", "banned", "they don't want you to know",
    "100%", "guaranteed", "mind-blowing", "destroy", "obliterate", "humiliate",
    "bombshell", "breaking", "urgent", "crisis", "disaster", "collapse", "woke", "maga"
  ],
  hedging: [
    "some people say", "sources believe", "rumored", "allegedly", "reportedly",
    "might be", "could be", "suggests that", "experts say"
  ],
  absolutes: [
    "always", "never", "everyone", "nobody", "undeniable", "total", "complete", "proven"
  ]
};

// ==============================================================================
// 2. CORE EVENT LISTENERS
// ==============================================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "verify-claim", title: "🛡️ Verify Selection", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "analyze-image", title: "🕵️ Forensics Lab", contexts: ["image"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "verify-claim") performAnalysis(info.selectionText, tab.url, tab.id);
  else if (info.menuItemId === "analyze-image") chrome.tabs.create({ url: `forensics.html?src=${encodeURIComponent(info.srcUrl)}` });
});

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "verifyText") {
    performAnalysis(req.text, sender.tab.url, sender.tab.id);
  }
  if (req.action === "fetchImage") {
    fetch(req.url).then(r => r.arrayBuffer()).then(buf => {
      const b64 = btoa(new Uint8Array(buf).reduce((d, b) => d + String.fromCharCode(b), ''));
      sendResponse({ success: true, data: `data:image/jpeg;base64,${b64}`, raw: Array.from(new Uint8Array(buf)) });
    }).catch(e => sendResponse({ success: false, error: e.toString() }));
    return true;
  }
  if (req.action === "manualCheck") {
    // Manual popup check
    getReport(req.text, "manual").then(sendResponse);
    return true;
  }
});

// ==============================================================================
// 3. THE ANALYSIS ORCHESTRATOR
// ==============================================================================

async function performAnalysis(text, url, tabId) {
  // 1. Send "Thinking" Signal
  chrome.tabs.sendMessage(tabId, { action: "processing" });

  // 2. Run Analysis
  const report = await getReport(text, url);

  // 3. Send Results
  chrome.tabs.sendMessage(tabId, { action: "showResults", data: report });
}

async function getReport(text, url) {
  const config = await chrome.storage.local.get(['googleKey', 'hfKey']);

  // A. INSTANT LOCAL ANALYSIS
  const local = analyzeLocally(text, url);
  let finalReport = { ...local, method: "Linguistic Analysis" };

  // B. GOOGLE CHECK (Primary Source)
  if (config.googleKey) {
    try {
      const gRes = await checkGoogle(text, config.googleKey);
      if (gRes.found) {
        return mergeGoogle(local, gRes);
      }
    } catch (e) { console.warn("Google API failed", e); }
  }

  // C. AI CHECK (Secondary Source) - Only if Google didn't find a direct match
  if (config.hfKey) {
    try {
      const aiRes = await checkAI(text, config.hfKey);
      return mergeAI(local, aiRes);
    } catch (e) { console.warn("AI API failed", e); }
  }

  // Fallback: Return the local analysis
  return finalReport;
}

// ==============================================================================
// 4. THE ENGINES
// ==============================================================================

function analyzeLocally(text, urlString) {
  let score = 70; // Start Neutral
  let flags = [];
  let domainLabel = "Unknown Domain";
  const lower = text.toLowerCase().trim();

  // 1. Domain Reputation
  if (urlString && urlString !== "manual") {
    try {
      const host = new URL(urlString).hostname.replace('www.', '');
      const match = Object.keys(DOMAIN_DB).find(d => host.includes(d));
      if (match) {
        const entry = DOMAIN_DB[match];
        score = entry.score;
        domainLabel = entry.label;
        flags.push(`Source: ${entry.type}`);
      }
    } catch(e) {}
  }

  // 2. Linguistic Forensics
  let triggerCount = 0;

  VOCABULARY.sensational.forEach(w => {
    if (lower.includes(w)) { score -= 12; triggerCount++; if(triggerCount <= 3) flags.push(`Sensational: "${w}"`); }
  });

  VOCABULARY.hedging.forEach(w => {
    if (lower.includes(w)) { score -= 5; flags.push(`Hedging: "${w}"`); }
  });

  VOCABULARY.absolutes.forEach(w => {
    if (lower.includes(w)) { score -= 5; } // Silent penalty for absolutism
  });

  // Caps Lock & Punctuation abuse
  const caps = (text.match(/[A-Z]/g) || []).length / text.length;
  if (text.length > 20 && caps > 0.4) { score -= 15; flags.push("Excessive Capitalization"); }
  if ((text.match(/!/g) || []).length > 2) { score -= 10; flags.push("Excessive Exclamation"); }

  // Clamp Score
  score = Math.max(5, Math.min(99, score));

  // Construct Verdict
  let verdict = "Neutral Content";
  let details = "Language appears standard.";

  if (score > 80) { verdict = "Likely Reliable"; details = "Objective tone and trusted patterns detected."; }
  else if (score < 45) { verdict = "Suspicious / Biased"; details = "Contains sensationalist or manipulative language."; }
  else { verdict = "Mixed Reliability"; details = "Context unavailable. Evaluate sources carefully."; }

  return { score, verdict, details, flags, domainLabel, url: null };
}

async function checkGoogle(query, key) {
  // Truncate to avoid 414 URI Too Long
  const q = encodeURIComponent(query.substring(0, 300));
  const res = await fetch(`https://factchecktools.googleapis.com/v1alpha1/claims:search?key=${key}&query=${q}`);
  const data = await res.json();
  if (!data.claims || !data.claims.length) return { found: false };
  const r = data.claims[0].claimReview[0];
  return { found: true, verdict: r.textualRating, publisher: r.publisher.name, url: r.url };
}

async function checkAI(text, token) {
  // NEW ROUTER URL - Correct as of Late 2024/2025
  const API_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli";

  const res = await fetch(API_URL, {
    headers: { Authorization: `Bearer ${token}` },
    method: "POST",
    body: JSON.stringify({
      inputs: text.substring(0, 800),
                         parameters: { candidate_labels: ["objective_fact", "misinformation", "opinion", "satire"] }
    })
  });

  if (!res.ok) throw new Error("AI Error");
  const data = await res.json();
  return { label: data.labels[0], confidence: data.scores[0] };
}

// ==============================================================================
// 5. MERGERS
// ==============================================================================

function mergeGoogle(local, google) {
  let finalScore = local.score;
  // Trust Google verification heavily
  if (google.verdict.toLowerCase().includes("false")) finalScore = 10;
  else if (google.verdict.toLowerCase().includes("true")) finalScore = 95;

  return {
    ...local,
    verdict: google.verdict,
    source: `Fact Check: ${google.publisher}`,
    details: `Official verification found from ${google.publisher}.`,
    score: finalScore,
    url: google.url,
    method: "Google Database"
  };
}

function mergeAI(local, ai) {
  let finalScore = local.score;
  const label = ai.label.replace("_", " ").toUpperCase();

  if (ai.label === "misinformation") finalScore = Math.min(finalScore, 25);
  if (ai.label === "proven_fact") finalScore = Math.max(finalScore, 85);
  if (ai.label === "satire") finalScore = 50;

  return {
    ...local,
    verdict: `AI: ${label}`,
    details: `AI Confidence: ${Math.round(ai.confidence * 100)}%. ${local.details}`,
    score: Math.round(finalScore),
    method: "AI Analysis"
  };
}
