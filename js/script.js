// Starts the app only after the HTML is loaded, so every button/input exists before JavaScript uses it.
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const currentSection = document.getElementById('current-section');
  const bunkSection = document.getElementById('bunk-section');
  const historySection = document.getElementById('history-section');
  const feedbackSection = document.getElementById('feedback-section');
  const currentResult = document.getElementById('current-result');
  const bunkResult = document.getElementById('bunk-result');
  const habitat = document.querySelector('main');
  const authBtn = document.getElementById('auth-btn');
  const historyBtn = document.getElementById('history-btn');
  const feedbackBtn = document.getElementById('feedback-btn');
  const launchErpBtn = document.getElementById('launch-erp-btn');
  const auraGuideBtn = document.getElementById('aura-guide-btn');
  const sidebarSignoutBtn = document.getElementById('sidebar-signout-btn');

  const auraModal = document.getElementById('auraModal');
  const auraBody = document.getElementById('auraBody');
  const auraLaunch = document.getElementById('aura-launch');
  const auraNext = document.getElementById('aura-next');
  const auraClose = document.getElementById('aura-close');

  const authModal = document.getElementById('authModal');
  const authClose = document.getElementById('auth-close');
  const signInGoogleBtn = document.getElementById('signin-google');
  const sendEmailLinkBtn = document.getElementById('send-email-link');
  const emailLinkInput = document.getElementById('email-link-input');
  const authResult = document.getElementById('auth-result');

  const refreshHistoryBtn = document.getElementById('refresh-history');
  const clearHistoryBtn = document.getElementById('clear-history');
  const historyList = document.getElementById('history-list');

  const submitFeedbackBtn = document.getElementById('submit-feedback');
  const feedbackText = document.getElementById('feedback-text');
  const feedbackRating = document.getElementById('feedback-rating');
  const feedbackContact = document.getElementById('feedback-contact');
  const feedbackResult = document.getElementById('feedback-result');

  const calcNameCurrent = document.getElementById('calc-name-current');
  const calcNameBunk = document.getElementById('calc-name-bunk');

  const HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  let erpRef = null;
  let erpMonitorTimer = null;
  let auraStep = 0;
  const weights = { Lecture: 100, Tutorial: 25, Practical: 50, Skilling: 25 };
  const componentsList = {
    L: ['Lecture'],
    LT: ['Lecture', 'Tutorial'],
    LP: ['Lecture', 'Practical'],
    LS: ['Lecture', 'Skilling'],
    LTP: ['Lecture', 'Tutorial', 'Practical'],
    LPS: ['Lecture', 'Practical', 'Skilling'],
    LTPS: ['Lecture', 'Tutorial', 'Practical', 'Skilling']
  };
  const bunkTypeSelect = document.getElementById('subject-type-bunk');
  const bunkInputsDiv = document.getElementById('bunk-current-inputs');
  const remainingInputsDiv = document.getElementById('remaining-inputs');
  const calcCurrentBtn = document.getElementById('calc-current');
  const calcBunkBtn = document.getElementById('calc-bunk');
  let mode = 'bunk';
  let lastRenderedType = '';

  // Returns the currently signed-in Firebase user, or null when nobody is logged in.
  function getUser() {
    return window.firebaseAuth?.getCurrentUser?.() || null;
  }

  // Blocks protected features and opens the sign-in modal when login is required.
  function requireLogin(reason = 'Safe Zone') {
    const user = getUser();
    if (user) return true;
    openAuthModal(reason);
    return false;
  }

  // Shows one main section at a time and hides the other app panels.
  function showOnlySection(sectionEl) {
    [currentSection, bunkSection, historySection, feedbackSection].forEach(el => el?.classList.add('hidden'));
    sectionEl?.classList.remove('hidden');
    habitat.scrollIntoView({ behavior: 'smooth' });
  }

  // Opens the authentication popup and remembers which feature asked for login.
  function openAuthModal(reason = 'Safe Zone') {
    if (!authModal) return;
    authModal.dataset.reason = reason;
    authResult?.classList.add('hidden');
    authResult && (authResult.innerHTML = '');
    authModal.classList.remove('hidden');
  }

  // Closes the authentication popup after login, cancel, or outside-click.
  function closeAuthModal() {
    authModal?.classList.add('hidden');
  }

  // Shows the header sign-in button only before login and keeps sign-out inside the sidebar.
  function setAuthStatusUI(user) {
    if (user) {
      authBtn?.classList.add('hidden');
      sidebarSignoutBtn?.classList.remove('hidden');
    } else {
      authBtn?.classList.remove('hidden');
      sidebarSignoutBtn?.classList.add('hidden');
      if (authBtn) authBtn.textContent = 'Sign in';
    }
  }

  // Applies safe/caution/danger result styling and activates the traffic-light indicator.
  function withTrafficState(el, pct) {
    if (!el) return;
    ensureTrafficLights(el);
    setTrafficLights(el, pct);
    el.classList.remove('safe', 'caution', 'danger');
    if (pct >= 85) el.classList.add('safe');
    else if (pct >= 75) el.classList.add('caution');
    else el.classList.add('danger');
  }

  // Creates the red/yellow/green light widget inside a result card when it is missing.
  function ensureTrafficLights(el) {
    if (el.querySelector('.traffic-lights')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'traffic-lights';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.innerHTML = `
      <span class="light red"></span>
      <span class="light yellow"></span>
      <span class="light green"></span>
    `;
    el.appendChild(wrapper);
  }

  // Chooses which traffic light should blink based on the attendance percentage.
  function setTrafficLights(el, pct) {
    const lights = el.querySelector('.traffic-lights');
    if (!lights) return;
    lights.classList.remove('state-red', 'state-yellow', 'state-green');
    if (pct >= 85) lights.classList.add('state-green');
    else if (pct >= 75) lights.classList.add('state-yellow');
    else lights.classList.add('state-red');
  }

  // Builds the unique localStorage key used to store this user's calculation history.
  function historyKey(uid) {
    return `klu-history:${uid}`;
  }

  // Builds the unique localStorage key used to store this user's feedback entries.
  function feedbackKey(uid) {
    return `klu-feedback:${uid}`;
  }

  // Reads saved calculation history for the logged-in user from localStorage.
  function loadHistory(uid) {
    try {
      return JSON.parse(localStorage.getItem(historyKey(uid)) || '[]');
    } catch {
      return [];
    }
  }

  // Writes the cleaned history list back to localStorage for the current user.
  function saveHistory(uid, items) {
    localStorage.setItem(historyKey(uid), JSON.stringify(items));
  }

  // Keeps only recent history entries so old calculations expire after 30 days.
  function pruneHistory(items) {
    const now = Date.now();
    return items.filter(it => typeof it?.ts === 'number' && now - it.ts <= HISTORY_TTL_MS);
  }

  // Saves a new calculation result to the signed-in user's local history.
  function addHistoryEntry(entry) {
    const user = getUser();
    if (!user) return;
    const uid = user.uid;
    const items = pruneHistory(loadHistory(uid));
    items.unshift(entry);
    saveHistory(uid, items);
  }

  // Converts a saved timestamp into readable date/time text for the History screen.
  function formatDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  // Builds the History screen from saved calculation entries.
  function renderHistory() {
    if (!historyList) return;
    const user = getUser();
    if (!user) {
      historyList.innerHTML = `<div class="history-item"><strong>Sign in required.</strong><div class="meta">History is linked to your login.</div></div>`;
      return;
    }
    const uid = user.uid;
    const items = pruneHistory(loadHistory(uid));
    saveHistory(uid, items);
    if (!items.length) {
      historyList.innerHTML = `<div class="history-item"><strong>No history yet.</strong><div class="meta">Do a calculation and it will show here for 30 days.</div></div>`;
      return;
    }
    historyList.innerHTML = items.map(it => {
      const title = it.name ? `<strong>${escapeHtml(it.name)}</strong>` : `<strong>${escapeHtml(it.type || 'Calculation')}</strong>`;
      const meta = `${escapeHtml(it.type || '')} • ${escapeHtml(formatDateTime(it.ts))}`;
      const so = (typeof it.finalSO === 'number') ? `<div class="meta">Final SO: ${it.finalSO.toFixed(2)}%</div>` : '';
      const target = (typeof it.target === 'number') ? `<div class="meta">Target: ${it.target}%</div>` : '';
      return `<div class="history-item">${title}<div class="meta">${meta}</div>${so}${target}</div>`;
    }).join('');
  }

  // Escapes user-provided text before placing it into HTML strings.
  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Validates and stores feedback locally for the signed-in user.
  function submitFeedback() {
    const user = getUser();
    if (!user) {
      openAuthModal('Feedback');
      return;
    }
    const text = (feedbackText?.value || '').trim();
    const rating = parseInt(feedbackRating?.value || '3', 10);
    const contact = (feedbackContact?.value || '').trim();
    if (!text) {
      feedbackResult.innerHTML = `<p class="red">Type your feedback first — one line is enough.</p>`;
      feedbackResult.classList.remove('hidden');
      return;
    }
    const uid = user.uid;
    const payload = { ts: Date.now(), rating, contact, text };
    const key = feedbackKey(uid);
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.unshift(payload);
    localStorage.setItem(key, JSON.stringify(arr));
    feedbackResult.innerHTML = `<p class="green"><strong>Saved.</strong> Thanks Veera — I’ll use this to improve the next version.</p>`;
    feedbackResult.classList.remove('hidden');
    withTrafficState(feedbackResult, 85);
    feedbackText.value = '';
    feedbackContact.value = '';
    feedbackRating.value = '3';
  }

  // Opens the split-screen guide and starts it from the first step.
  function openAura() {
    if (!auraModal) return;
    auraStep = 0;
    auraModal.classList.remove('hidden');
    renderAuraStep();
  }

  // Hides the split-screen guide when the user finishes or cancels it.
  function closeAura() {
    auraModal?.classList.add('hidden');
  }

  // Renders the current step of the ERP split-screen setup guide.
  function renderAuraStep() {
    if (!auraBody) return;
    const isErpOpen = !!(erpRef && !erpRef.closed);
    const steps = [
      `
      <p><strong>Goal:</strong> Keep ERP and this planner side-by-side so you don’t lose accuracy while typing numbers.</p>
      <ol>
        <li>Press <strong>Launch KLU ERP</strong>. It opens in a split-ready window.</li>
        <li>Then I’ll show you the exact Split View steps.</li>
      </ol>
      `,
      `
      <p>${isErpOpen ? 'Good — ERP window is open.' : 'I can’t detect the ERP window yet.'}</p>
      <ol>
        <li>Friend you can see the ERP window (top-right usually) on your screen.</li>
        <li><strong>At the right corner of the ERP window you can see a cube shape icon.</strong>.</li>
        <li>Choose <strong>"Then move the cursor to the cube shape icon and split the screen side by side.</strong>.</li>
        <li>Now you can see the ERP window and the planner window side by side.</li>
      </ol>
      <p class="orange">If you don’t see Split View, update Chrome and try again.</p>
      `,
      `
      <p><strong>Now the “honest mirror” part:</strong> I can’t force Chrome UI changes (security).</p>
      <p>So I act like a <strong>UX proxy</strong>. You do the right‑click, I keep the steps simple.</p>
      <p><strong>Tip:</strong> Keep this planner on the left, ERP on the right. Type numbers once, no toggling.</p>
      `,
    ];
    auraBody.innerHTML = steps[Math.min(auraStep, steps.length - 1)];
    if (auraNext) auraNext.disabled = auraStep >= steps.length - 1;
  }

  // Opens KLU ERP in a separate side window so students can copy values easily.
  function launchERPWindow() {
    const erpUrl = 'https://erp.kluniversity.in/';
    const width = 520;
    const height = window.screen.height || 900;
    const left = (window.screen.width || 1200) - width;
    // IMPORTANT: do not tie ERP window lifecycle to the guide UI.
    // Also avoid `noopener=yes` so we can keep a stable window reference for monitoring.
    erpRef = window.open(erpUrl, 'KLU_ERP', `width=${width},height=${height},top=0,left=${left},resizable=yes,scrollbars=yes`);
    startErpMonitor();
    renderAuraStep();
  }

  // Watches the ERP popup so the guide can react when that window is closed.
  function startErpMonitor() {
    if (erpMonitorTimer) window.clearInterval(erpMonitorTimer);
    erpMonitorTimer = window.setInterval(() => {
      if (!erpRef) return;
      if (erpRef.closed) {
        window.clearInterval(erpMonitorTimer);
        erpMonitorTimer = null;
        renderAuraStep();
      }
    }, 800);
  }

  // Theme toggle: switches the whole app between dark and light modes.
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    themeToggle.textContent = isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    themeToggle.setAttribute('aria-pressed', isLight.toString());
  });

  // Opens the Current Attendance calculator and saves bunk-planner state first.
  document.getElementById('current-btn').addEventListener('click', () => {
    forceSaveAllInputs(); // Sync state before UI change
    showOnlySection(currentSection);
  });

  // Opens normal Bunk Planner mode where the goal is safe bunk calculation.
  document.getElementById('bunk-btn').addEventListener('click', () => {
    forceSaveAllInputs(); // Sync state before UI change
    showOnlySection(bunkSection);
    activateMode('bunk');
  });

  const safeZoneBtn = document.getElementById('safe-zone-btn');
  if (safeZoneBtn) {
    // Opens Safe Zone mode after login because it is a protected feature.
    safeZoneBtn.addEventListener('click', () => {
      if (!requireLogin('Safe Zone')) return;
      showOnlySection(bunkSection);
      activateMode('safe');
    });
  }

  // Back buttons return the user to the home action panel by hiding all tool panels.
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSection.classList.add('hidden');
      bunkSection.classList.add('hidden');
      historySection?.classList.add('hidden');
      feedbackSection?.classList.add('hidden');
      habitat.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Opens the History screen and refreshes saved calculations before showing it.
  historyBtn?.addEventListener('click', () => {
    if (!requireLogin('History')) return;
    renderHistory();
    showOnlySection(historySection);
  });

  // Opens Feedback after login and clears any previous feedback result message.
  feedbackBtn?.addEventListener('click', () => {
    if (!requireLogin('Feedback')) return;
    feedbackResult?.classList.add('hidden');
    showOnlySection(feedbackSection);
  });

  // Starts ERP side-by-side flow directly from the home action button.
  launchErpBtn?.addEventListener('click', () => {
    launchERPWindow();
    openAura();
  });

  // Opens only the guide when the user wants instructions without launching ERP first.
  auraGuideBtn?.addEventListener('click', () => openAura());
  // Launches ERP from inside the guide and moves the guide forward.
  auraLaunch?.addEventListener('click', () => { launchERPWindow(); auraStep = Math.max(auraStep, 1); renderAuraStep(); });
  // Moves the guide to the next instruction step.
  auraNext?.addEventListener('click', () => { auraStep += 1; renderAuraStep(); });
  // Closes the guide modal.
  auraClose?.addEventListener('click', () => closeAura());

  // Header auth button is only for sign-in; signed-in users sign out from the sidebar.
  authBtn?.addEventListener('click', async () => {
    openAuthModal('Safe Zone');
  });

  // Sidebar sign-out is the only sign-out action after the user logs in.
  sidebarSignoutBtn?.addEventListener('click', async () => {
    const user = getUser();
    if (!user) {
      openAuthModal('Sign Out');
      return;
    }
    await window.firebaseAuth?.signOut?.();
  });

  // Auth modal close button hides the sign-in popup.
  authClose?.addEventListener('click', () => closeAuthModal());
  // Clicking the dark overlay closes the auth modal without touching the form.
  authModal?.addEventListener('click', (e) => {
    if (e.target === authModal) closeAuthModal();
  });

  // Google sign-in button calls Firebase auth and reports any login error.
  signInGoogleBtn?.addEventListener('click', async () => {
    try {
      await window.firebaseAuth?.continueWithGoogle?.();
      closeAuthModal();
    } catch (e) {
      authResult.innerHTML = `<p class="red">Google sign-in failed. ${escapeHtml(e?.message || '')}</p>`;
      authResult.classList.remove('hidden');
    }
  });

  // Email-link button validates the email, sends the magic link, and shows status.
  sendEmailLinkBtn?.addEventListener('click', async () => {
    const email = (emailLinkInput?.value || '').trim();
    if (!email) {
      authResult.innerHTML = `<p class="red">Enter your email first.</p>`;
      authResult.classList.remove('hidden');
      return;
    }
    try {
      await window.firebaseAuth?.sendMagicLink?.(email);
      authResult.innerHTML = `<p class="green"><strong>Link sent.</strong> Open your email and come back to this tab to finish sign-in.</p>`;
      authResult.classList.remove('hidden');
      withTrafficState(authResult, 85);
    } catch (e) {
      authResult.innerHTML = `<p class="red">Couldn’t send link. ${escapeHtml(e?.message || '')}</p>`;
      authResult.classList.remove('hidden');
    }
  });

  // Refresh button rebuilds the History screen from localStorage.
  refreshHistoryBtn?.addEventListener('click', () => renderHistory());
  // Clear button removes only the signed-in user's saved calculation history.
  clearHistoryBtn?.addEventListener('click', () => {
    const user = getUser();
    if (!user) return;
    localStorage.removeItem(historyKey(user.uid));
    renderHistory();
  });

  // Submit button sends the feedback form through the feedback-saving method.
  submitFeedbackBtn?.addEventListener('click', () => submitFeedback());

  // Waits for Firebase helpers, completes email-link login, and listens for auth changes.
  async function initAuth(retriesLeft = 20) {
    if (!window.firebaseAuth) {
      if (retriesLeft <= 0) return;
      window.setTimeout(() => initAuth(retriesLeft - 1), 150);
      return;
    }
    try {
      await window.firebaseAuth.completeEmailLinkSignInIfPresent?.();
    } catch (e) {
      authResult.innerHTML = `<p class="red">Sign-in link failed. ${escapeHtml(e?.message || '')}</p>`;
      authResult.classList.remove('hidden');
    }
    window.firebaseAuth.onAuthStateChanged?.((user) => {
      setAuthStatusUI(user);
      if (!user && mode === 'safe') {
        activateMode('bunk');
      }
    });
    setAuthStatusUI(getUser());
  }

  initAuth();

  // Switches the bunk section between normal Bunk Planner and Safe Zone behavior.
  function activateMode(newMode) {
    mode = newMode;
    bunkSection.dataset.mode = newMode;
    const bunkerTitle = bunkSection.querySelector('h2');
    if (bunkerTitle) {
      bunkerTitle.textContent = newMode === 'safe' ? 'Safe Zone (Compulsory Attendance)' : 'Bunk Planner (Safe Bunks)';
    }
    calcBunkBtn.textContent = newMode === 'safe' ? 'Calculate Compulsory Attendance' : 'Calculate Safe Bunks';
  }

  // FIX 1: Disable scroll-wheel increment/decrement on number inputs (Laptop issue)
  document.addEventListener('wheel', (event) => {
    if (document.activeElement && document.activeElement.type === 'number') {
      event.preventDefault();
      document.activeElement.blur();
    }
  }, { passive: false });

// Loads unfinished bunk-planner form data from localStorage on startup.
const globalState = JSON.parse(localStorage.getItem('attendance-planner-state')) || {};

// Saves edited bunk-planner input values immediately so navigation does not lose data.
bunkSection.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.id) {
    const key = getInputKey(e.target);
    globalState[key] = e.target.value; // Save immediately, no debounce
  }
});

// Creates a stable storage key for every dynamic input in the bunk planner.
function getInputKey(input) {
  const comp = input.dataset.comp || 'none';
  const type = input.classList.contains('conducted') ? 'cond' :
               input.classList.contains('attended') ? 'attn' :
               input.classList.contains('future') ? 'fut' :
               input.classList.contains('per-unit') ? 'unit' : 'misc';
  return `${comp}-${type}-${input.id || ''}`;
}

// Returns a previously saved value for a dynamic input, if one exists.
function getSavedInputValue(comp, type, id = '') {
  const key = `${comp}-${type}-${id}`;
  return globalState[key] || '';
}

// Restores radio-button choices after dynamic input sections are rebuilt.
function restoreValues() {
  if (globalState['remaining-type']) {
    const radio = document.querySelector(`input[name="remaining-type"][value="${globalState['remaining-type']}"]`);
    if (radio) radio.checked = true;
  }
}

// Captures every bunk-planner input and persists the full form state to localStorage.
function forceSaveAllInputs() {
  document.querySelectorAll('#bunk-section input').forEach(input => {
    const key = getInputKey(input);
    globalState[key] = input.value;
  });
  const selectedMethod = document.querySelector('input[name="remaining-type"]:checked');
  if (selectedMethod) globalState['remaining-type'] = selectedMethod.value;
  
  // Persist to storage
  localStorage.setItem('attendance-planner-state', JSON.stringify(globalState));
}

// Rebuilds the dynamic current-status and remaining-classes input sections together.
function renderFunctions() {
  forceSaveAllInputs();
  renderCurrentInputs();
  renderRemainingInputs();
}

// ✅ FIXED: Now preserves values and prevents DOM mutation cascades
// Renders conducted/attended fields for the selected subject type without losing saved values.
function renderCurrentInputs() {
  const type = bunkTypeSelect.value;
  
  // If the type is the same, only update values, don't destroy DOM
  if (type === lastRenderedType) {
    document.querySelectorAll('#bunk-current-inputs input').forEach(input => {
      const key = getInputKey(input);
      if (globalState[key]) input.value = globalState[key];
    });
    return;
  }

  let html = '<h3>Current Status</h3>';
  componentsList[type].forEach(comp => {
    const safeCompName = comp.toLowerCase().replace(/\s+/g, '-');
    html += `
      <div class="component-card">
        <div class="component-header">${comp}</div>
        <label>Conducted: <input type="number" class="conducted" id="cond-${safeCompName}" name="cond-${safeCompName}" data-comp="${comp}" min="0" autocomplete="off" value="${getSavedInputValue(comp, 'cond')}"></label>
        <label>Attended: <input type="number" class="attended" id="attn-${safeCompName}" name="attn-${safeCompName}" data-comp="${comp}" min="0" autocomplete="off" value="${getSavedInputValue(comp, 'attn')}"></label>
      </div>`;
  });
  bunkInputsDiv.innerHTML = html;
  restoreValues();
  lastRenderedType = type;
}

// Renders future-class inputs using either direct classes, weeks, or months.
function renderRemainingInputs() {
  const methodInput = document.querySelector('input[name="remaining-type"]:checked');
  const method = methodInput ? methodInput.value : 'direct';
  const type = bunkTypeSelect.value;
  const html = ['<h3>Remaining Classes</h3>'];

  if (method === 'direct') {
    componentsList[type].forEach(comp => {
      const safeCompName = comp.toLowerCase().replace(/\s+/g, '-');
      html.push(`<label>${comp} future classes: <input type="number" class="future" id="fut-${safeCompName}" name="fut-${safeCompName}" data-comp="${comp}" min="0" autocomplete="off" value="${getSavedInputValue(comp, 'fut')}"></label>`);
    });
  } else {
    const unitLabel = method === 'weeks' ? 'Weeks remaining' : 'Months remaining';
    html.push(`<label>${unitLabel}: <input type="number" id="remain-duration" name="remain-duration" min="0" autocomplete="off" value="${getSavedInputValue('none', 'misc', 'remain-duration')}"></label>`);
    componentsList[type].forEach(comp => {
      const safeCompName = comp.toLowerCase().replace(/\s+/g, '-');
      html.push(`<label>${comp} per ${method === 'weeks' ? 'week' : 'month'}: <input type="number" class="per-unit" id="unit-${safeCompName}" name="unit-${safeCompName}" data-comp="${comp}" min="0" autocomplete="off" value="${getSavedInputValue(comp, 'unit')}"></label>`);
    });
  }

  remainingInputsDiv.innerHTML = html.join('');
  restoreValues();
}

// Re-render dynamic bunk-planner fields when subject type or remaining-class method changes.
bunkTypeSelect.addEventListener('change', renderFunctions);

document.querySelectorAll('input[name="remaining-type"]').forEach(radio => {
  radio.addEventListener('change', renderFunctions);
});

bunkTypeSelect.dispatchEvent(new Event('change'));

// Detects browser autofill changes so saved state stays in sync with visible inputs.
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
      const input = mutation.target;
      if (input.matches(':-webkit-autofill') || input.matches(':-moz-autofill')) {
        const key = getInputKey(input);
        globalState[key] = input.value;
      }
    }
  });
});

// Observe all inputs in bunk-section
document.querySelectorAll('#bunk-section input').forEach(input => {
  observer.observe(input, { attributes: true, attributeFilter: ['value'] });
});

// Save inputs on change
bunkSection.addEventListener('input', (e) => {
  if (e.target.id) {
    forceSaveAllInputs();
  }
});

  // Calculates weighted overall attendance using KLU component weights.
  function calculateOverall(percentList) {
    let weightedSum = 0;
    let totalWeight = 0;
    percentList.forEach(({ comp, pct }) => {
      const weight = weights[comp] || 0;
      weightedSum += pct * weight;
      totalWeight += weight;
    });
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // Reads conducted, attended, and future class counts from the bunk planner form.
  function readStats() {
    const type = bunkTypeSelect.value;
    const method = document.querySelector('input[name="remaining-type"]:checked').value;
    const componentStats = [];

    componentsList[type].forEach(comp => {
      const safeCompName = comp.toLowerCase().replace(/\s+/g, '-');
      const conductedInput = document.getElementById(`cond-${safeCompName}`);
      const attendedInput = document.getElementById(`attn-${safeCompName}`);
      const conducted = parseFloat(conductedInput?.value) || 0;
      const attended = parseFloat(attendedInput?.value) || 0;

      let future = 0;
      if (method === 'direct') {
        const futureInput = document.getElementById(`fut-${safeCompName}`);
        future = parseFloat(futureInput?.value) || 0;
      } else {
        const duration = parseFloat(document.getElementById('remain-duration')?.value) || 0;
        const perUnitInput = document.getElementById(`unit-${safeCompName}`);
        const perUnit = parseFloat(perUnitInput?.value) || 0;
        future = duration * perUnit;
      }
      componentStats.push({ comp, conducted, attended, future });
    });
    return componentStats;
  }

  // Finds the safest bunk plan that stays above target while maximizing bunkable classes.
  function findOptimalPlan(componentStats, target) {
    let best = null;
    const plan = new Array(componentStats.length).fill(0);
    // Tries every possible attend/bunk combination and keeps the best valid bunk plan.
    const dfs = (index) => {
      if (index === componentStats.length) {
        const percentList = [];
        let totalAttend = 0;
        componentStats.forEach((entry, i) => {
          totalAttend += plan[i];
          const totalConducted = entry.conducted + entry.future;
          const totalAttended = entry.attended + plan[i];
          const pct = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 0;
          percentList.push({ comp: entry.comp, pct });
        });
        const finalSO = calculateOverall(percentList);
        if (finalSO < target) return;
        const delta = finalSO - target;
        const bunk = componentStats.reduce((sum, e, i) => sum + (e.future - plan[i]), 0);
        if (!best || delta < best.delta || (delta === best.delta && bunk > best.totalBunk)) {
          best = { delta, finalSO, totalBunk: bunk, perComponent: componentStats.map((e, i) => ({
            comp: e.comp, future: e.future, attend: plan[i], bunk: e.future - plan[i], pct: percentList[i].pct
          })) };
        }
        return;
      }
      const future = componentStats[index].future;
      for (let attend = 0; attend <= future; attend++) {
        plan[index] = attend;
        dfs(index + 1);
      }
      plan[index] = 0;
    };
    dfs(0);
    return best;
  }

  // Finds the minimum future classes the user must attend to reach the target.
  function findSafeZonePlan(componentStats, target) {
    let best = null;
    const plan = new Array(componentStats.length).fill(0);
    const totalFuture = componentStats.reduce((sum, e) => sum + e.future, 0);
    if (totalFuture === 0) return null;

    // Tries every possible future-attendance combination and keeps the lowest compulsory plan.
    const dfs = (index) => {
      if (index === componentStats.length) {
        const percentList = [];
        let totalAttend = 0;
        componentStats.forEach((entry, i) => {
          totalAttend += plan[i];
          const totalConducted = entry.conducted + entry.future;
          const totalAttended = entry.attended + plan[i];
          const pct = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 0;
          percentList.push({ comp: entry.comp, pct });
        });
        const finalSO = calculateOverall(percentList);
        if (finalSO < target) return;
        const delta = finalSO - target;
        if (!best || delta < best.delta || (delta === best.delta && totalAttend < best.totalAttend)) {
          best = { delta, finalSO, totalAttend, perComponent: componentStats.map((e, i) => ({
            comp: e.comp, future: e.future, compulsory: plan[i], pct: percentList[i].pct
          })) };
        }
        return;
      }
      const future = componentStats[index].future;
      for (let attend = 0; attend <= future; attend++) {
        plan[index] = attend;
        dfs(index + 1);
      }
      plan[index] = 0;
    };
    dfs(0);
    return best;
  }

  // Current Attendance button: calculates weighted percentage from entered component percentages.
  calcCurrentBtn.addEventListener('click', () => {
    const entries = [
      { id: 'lecture-pct', name: 'Lecture' },
      { id: 'tutorial-pct', name: 'Tutorial' },
      { id: 'practical-pct', name: 'Practical' },
      { id: 'skilling-pct', name: 'Skilling' }
    ];
    let num = 0, den = 0;
    entries.forEach(entry => {
      const value = document.getElementById(entry.id).value;
      if (value === '') return;
      const pct = parseFloat(value) || 0;
      num += pct * weights[entry.name];
      den += weights[entry.name];
    });
    if (den === 0) {
      currentResult.innerHTML = '<p class="red">Enter at least Lecture % before calculating.</p>';
      currentResult.classList.remove('hidden');
      return;
    }
    const pct = num / den;
    const name = (calcNameCurrent?.value || '').trim();
    let feel = 'Red Alert. Medical Certificate mode engaged.';
    let cls = 'red';
    if (pct >= 85) { feel = 'You’re a legend. Enjoy your sleep.'; cls = 'green'; }
    else if (pct >= 75) { feel = 'Watch out. You’re one fever away from a headache.'; cls = 'orange'; }
    currentResult.innerHTML = `
      ${name ? `<p><strong>${escapeHtml(name)}</strong></p>` : ''}
      <p><strong>Overall: ${pct.toFixed(2)}%</strong></p>
      <p class="${cls}">${feel}</p>
    `;
    currentResult.classList.remove('hidden');
    withTrafficState(currentResult, pct);
    addHistoryEntry({ ts: Date.now(), type: 'Current Attendance', name, finalSO: pct });
  });

  // Bunk/Safe Zone button: validates input, chooses the right planner, and renders the result.
  calcBunkBtn.addEventListener('click', () => {
    const targetRaw = document.getElementById('target-pct').value;
    const target = parseFloat(targetRaw);
    if (!isFinite(target) || target < 0 || target > 100) {
      bunkResult.innerHTML = '<p class="red">Enter a valid target percentage (0–100).</p>';
      bunkResult.classList.remove('hidden');
      return;
    }

    const componentStats = readStats();

    const errors = [];
    componentStats.forEach(entry => {
      if (entry.attended > entry.conducted) errors.push(`${entry.comp}: attended cannot exceed conducted`);
    });
    if (errors.length) {
      bunkResult.innerHTML = `<p class="red">${errors.join('<br>')}</p>`;
      bunkResult.classList.remove('hidden');
      return;
    }

    const currentPercents = componentStats.map(entry => ({
      comp: entry.comp,
      pct: entry.conducted > 0 ? (entry.attended / entry.conducted) * 100 : 0
    }));
    const currentOverall = calculateOverall(currentPercents);

    if (mode === 'bunk' && currentOverall < target) {
      bunkResult.innerHTML = `<p class="red">Current SO ${currentOverall.toFixed(2)}% is below ${target}%. Not safe — go to Safe Zone option.</p>`;
      bunkResult.classList.remove('hidden');
      return;
    }

    const totalFuture = componentStats.reduce((sum, e) => sum + e.future, 0);
    if (totalFuture === 0) {
      bunkResult.innerHTML = `<p>No future classes recorded → final attendance locked at <strong>${currentOverall.toFixed(2)}%</strong>.</p>`;
      bunkResult.classList.remove('hidden');
      return;
    }

    let plan;
    if (mode === 'bunk') {
      plan = findOptimalPlan(componentStats, target);
    } else {
      plan = findSafeZonePlan(componentStats, target);
    }

    const calcName = (calcNameBunk?.value || '').trim();

    if (!plan) {
      const perfectSO = calculateOverall(componentStats.map(e => ({
        comp: e.comp,
        pct: (e.conducted + e.future > 0) ? ((e.attended + e.future) / (e.conducted + e.future)) * 100 : 0
      })));
      bunkResult.innerHTML = `
        <p class="red"><strong>The “Atlas” reality check:</strong> Mathematically impossible to reach <strong>${target}%</strong>.</p>
        <p>Your maximum possible (even with <strong>100%</strong> attendance from now) is <strong>${perfectSO.toFixed(2)}%</strong>.</p>
        <p class="orange">What this means: the remaining classes in the semester are not enough to pull the average up.</p>
        <p><strong>Next steps (choose one):</strong></p>
        <ul>
          <li>Talk to your faculty / HOD ASAP (don’t wait for the last week).</li>
          <li>Use medical/condonation options if your campus allows.</li>
          <li>Lower the target and re-check the plan.</li>
        </ul>
      `;
      bunkResult.classList.remove('hidden');
      withTrafficState(bunkResult, 0);
      addHistoryEntry({ ts: Date.now(), type: mode === 'safe' ? 'Safe Zone' : 'Bunk Planner', name: calcName, target, finalSO: perfectSO });
      return;
    }

    let html = `${calcName ? `<p><strong>${escapeHtml(calcName)}</strong></p>` : ''}`;
    html += `<p><strong>Current SO:</strong> ${currentOverall.toFixed(2)}%</p>`;
    html += `<p><strong>Target:</strong> ${target}%</p>`;

    if (mode === 'bunk') {
      const feel = plan.finalSO >= 85
        ? `You’re a legend. Enjoy your sleep.`
        : (plan.finalSO >= 75 ? `Watch out. You’re one fever away from a headache.` : `Red Alert. Medical Certificate mode engaged.`);
      html += `<p class="green"><strong>Safe bunks calculated.</strong> ${escapeHtml(feel)}</p>`;
      const cards = plan.perComponent.map(d => `
        <div class="component-percent-card">
          <strong>${d.comp}</strong><br>
          Future: ${d.future} | Attend: ${d.attend} | Bunk: <strong>${d.bunk}</strong><br>
          New ${d.comp}% = ${d.pct.toFixed(2)}%
        </div>`).join('');
      html += `<div class="component-percent-grid">${cards}</div>`;
      html += `<p>Projected Final SO = <strong>${plan.finalSO.toFixed(2)}%</strong></p>`;
    } else {
      html += `<p class="green"><strong>Safe Zone:</strong> Minimum compulsory attendance to reach target.</p>`;
      const lines = plan.perComponent.map(d => `
        <p><strong>${d.comp}:</strong> Attend <strong>${d.compulsory}</strong> of ${d.future} future classes → ${d.pct.toFixed(2)}%</p>`).join('');
      html += lines;
      html += `
        <p class="orange"><strong>Warning:</strong> If you bunk before completing these compulsory classes, your target can collapse suddenly.</p>
        <p>Projected Final SO = <strong>${plan.finalSO.toFixed(2)}%</strong></p>
      `;
    }

    bunkResult.innerHTML = html;
    bunkResult.classList.remove('hidden');
    withTrafficState(bunkResult, plan.finalSO);
    addHistoryEntry({ ts: Date.now(), type: mode === 'safe' ? 'Safe Zone' : 'Bunk Planner', name: calcName, target, finalSO: plan.finalSO });
  });
});
