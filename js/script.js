document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const currentSection = document.getElementById('current-section');
  const bunkSection = document.getElementById('bunk-section');
  const currentResult = document.getElementById('current-result');
  const bunkResult = document.getElementById('bunk-result');
  const habitat = document.querySelector('main');
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

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    themeToggle.textContent = isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    themeToggle.setAttribute('aria-pressed', isLight.toString());
  });

  document.getElementById('current-btn').addEventListener('click', () => {
    forceSaveAllInputs(); // Sync state before UI change
    habitat.scrollIntoView({ behavior: 'smooth' });
    currentSection.classList.remove('hidden');
    bunkSection.classList.add('hidden');
  });

  document.getElementById('bunk-btn').addEventListener('click', () => {
    forceSaveAllInputs(); // Sync state before UI change
    habitat.scrollIntoView({ behavior: 'smooth' });
    bunkSection.classList.remove('hidden');
    currentSection.classList.add('hidden');
    activateMode('bunk');
  });

  const safeZoneBtn = document.getElementById('safe-zone-btn');
  if (safeZoneBtn) {
    safeZoneBtn.addEventListener('click', () => {
      habitat.scrollIntoView({ behavior: 'smooth' });
      bunkSection.classList.remove('hidden');
      currentSection.classList.add('hidden');
      activateMode('safe');
    });
  }

  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSection.classList.add('hidden');
      bunkSection.classList.add('hidden');
      habitat.scrollIntoView({ behavior: 'smooth' });
    });
  });

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

// 1. Load from localStorage on startup
const globalState = JSON.parse(localStorage.getItem('attendance-planner-state')) || {};

// 2. Immediate synchronous state save to prevent corruption
bunkSection.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.id) {
    const key = getInputKey(e.target);
    globalState[key] = e.target.value; // Save immediately, no debounce
  }
});

// 3. Stable Key Generator (Ignores classes)
function getInputKey(input) {
  const comp = input.dataset.comp || 'none';
  const type = input.classList.contains('conducted') ? 'cond' :
               input.classList.contains('attended') ? 'attn' :
               input.classList.contains('future') ? 'fut' :
               input.classList.contains('per-unit') ? 'unit' : 'misc';
  return `${comp}-${type}-${input.id || ''}`;
}

function getSavedInputValue(comp, type, id = '') {
  const key = `${comp}-${type}-${id}`;
  return globalState[key] || '';
}

function restoreValues() {
  if (globalState['remaining-type']) {
    const radio = document.querySelector(`input[name="remaining-type"][value="${globalState['remaining-type']}"]`);
    if (radio) radio.checked = true;
  }
}

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

function renderFunctions() {
  forceSaveAllInputs();
  renderCurrentInputs();
  renderRemainingInputs();
}

// ✅ FIXED: Now preserves values and prevents DOM mutation cascades
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

// Add listeners once
bunkTypeSelect.addEventListener('change', renderFunctions);

document.querySelectorAll('input[name="remaining-type"]').forEach(radio => {
  radio.addEventListener('change', renderFunctions);
});

bunkTypeSelect.dispatchEvent(new Event('change'));

// Setup MutationObserver for autofill detection after initial render
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

  function findOptimalPlan(componentStats, target) {
    let best = null;
    const plan = new Array(componentStats.length).fill(0);
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

  function findSafeZonePlan(componentStats, target) {
    let best = null;
    const plan = new Array(componentStats.length).fill(0);
    const totalFuture = componentStats.reduce((sum, e) => sum + e.future, 0);
    if (totalFuture === 0) return null;

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
    let status = 'Detention risk ❌';
    let cls = 'red';
    if (pct >= 85) { status = 'Good ✅ Eligible'; cls = 'green'; }
    else if (pct >= 75) { status = 'Condonation ⚠️'; cls = 'orange'; }
    currentResult.innerHTML = `<p><strong>Overall: ${pct.toFixed(2)}%</strong></p><p class="${cls}">Status: ${status}</p>`;
    currentResult.classList.remove('hidden');
  });

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

    if (!plan) {
      let advice = 'Consider medical/documentation or adjust your RP (try 85%).';
      if (target === 75) {
        advice = 'Consider condonation fee, medical certificate, or adjusting RP to 85%.';
      } else if (target === 85) {
        advice = 'Consider condonation fee or medical certificate.';
      } else if (target === 90) {
        advice = 'Very high target; consider medical certificate or adjusting RP to 85%.';
      }
      const perfectSO = calculateOverall(componentStats.map(e => ({
        comp: e.comp,
        pct: (e.conducted + e.future > 0) ? ((e.attended + e.future) / (e.conducted + e.future)) * 100 : 0
      })));
      bunkResult.innerHTML = `<p class="red">Even 100% attendance cannot reach ${target}%. Max possible SO ≈ ${perfectSO.toFixed(2)}%. ${advice}</p>`;
      bunkResult.classList.remove('hidden');
      return;
    }

    let html = `<p><strong>Current SO:</strong> ${currentOverall.toFixed(2)}%</p>`;
    html += `<p><strong>Target:</strong> ${target}%</p>`;

    if (mode === 'bunk') {
      html += `<p class="green">✅ Safe Bunks Calculated (maximum skips while staying above target)</p>`;
      const cards = plan.perComponent.map(d => `
        <div class="component-percent-card">
          <strong>${d.comp}</strong><br>
          Future: ${d.future} | Attend: ${d.attend} | Bunk: <strong>${d.bunk}</strong><br>
          New ${d.comp}% = ${d.pct.toFixed(2)}%
        </div>`).join('');
      html += `<div class="component-percent-grid">${cards}</div>`;
      html += `<p>Projected Final SO = <strong>${plan.finalSO.toFixed(2)}%</strong></p>`;
    } else {
      html += `<p class="green">✅ Safe Zone – Minimum compulsory attendance</p>`;
      const lines = plan.perComponent.map(d => `
        <p><strong>${d.comp}:</strong> Attend <strong>${d.compulsory}</strong> of ${d.future} future classes → ${d.pct.toFixed(2)}%</p>`).join('');
      html += lines;
      html += `<p><strong>Warning:</strong> If you want to bunk, you must attend these compulsory classes first. Projected Final SO = <strong>${plan.finalSO.toFixed(2)}%</strong></p>`;
    }

    bunkResult.innerHTML = html;
    bunkResult.classList.remove('hidden');
  });
});
