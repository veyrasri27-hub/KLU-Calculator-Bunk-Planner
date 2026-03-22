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
  const zoneButtons = document.querySelectorAll('.zone-btn');
  let activeZone = 'bunk';

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light');
    const isLight = document.body.classList.contains('light');
    themeToggle.textContent = isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme';
    themeToggle.setAttribute('aria-pressed', isLight.toString());
  });

  document.getElementById('current-btn').addEventListener('click', () => {
    habitat.scrollIntoView({ behavior: 'smooth' });
    currentSection.classList.remove('hidden');
    bunkSection.classList.add('hidden');
  });
  document.getElementById('bunk-btn').addEventListener('click', () => {
    habitat.scrollIntoView({ behavior: 'smooth' });
    bunkSection.classList.remove('hidden');
    currentSection.classList.add('hidden');
  });
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSection.classList.add('hidden');
      bunkSection.classList.add('hidden');
      habitat.scrollIntoView({ behavior: 'smooth' });
    });
  });

  zoneButtons.forEach(button => {
    button.addEventListener('click', () => {
      zoneButtons.forEach(btn => {
        btn.classList.toggle('active', btn === button);
        btn.setAttribute('aria-selected', (btn === button).toString());
      });
      activeZone = button.dataset.zone;
    });
  });

  function renderCurrentInputs() {
    const type = bunkTypeSelect.value;
    bunkInputsDiv.innerHTML = '<h3>Current Status</h3>';
    componentsList[type].forEach(comp => {
      const className = comp.toLowerCase();
      bunkInputsDiv.innerHTML += `
        <div class="component-header ${className}">${comp}</div>
        <label>
          ${comp} Conducted:
          <input type="number" class="conducted" data-comp="${comp}" min="0">
        </label>
        <label>
          ${comp} Attended:
          <input type="number" class="attended" data-comp="${comp}" min="0">
        </label>
      `;
    });
  }

  function renderRemainingInputs() {
    const method = document.querySelector('input[name="remaining-type"]:checked').value;
    const type = bunkTypeSelect.value;
    remainingInputsDiv.innerHTML = '<h3>Remaining Classes</h3>';
    if (method === 'direct') {
      componentsList[type].forEach(comp => {
        remainingInputsDiv.innerHTML += `
          <label>
            ${comp} future classes:
            <input type="number" class="future" data-comp="${comp}" min="0">
          </label>
        `;
      });
      return;
    }
    const unitLabel = method === 'weeks' ? 'Weeks remaining' : 'Months remaining';
    remainingInputsDiv.innerHTML += `
      <label>
        ${unitLabel}:
        <input type="number" id="remain-duration" min="0">
      </label>
    `;
    componentsList[type].forEach(comp => {
      remainingInputsDiv.innerHTML += `
        <label>
          ${comp} per ${method === 'weeks' ? 'week' : 'month'}:
          <input type="number" class="per-unit" data-comp="${comp}" min="0">
        </label>
      `;
    });
  }

  bunkTypeSelect.addEventListener('change', () => {
    renderCurrentInputs();
    renderRemainingInputs();
  });
  document.querySelectorAll('input[name="remaining-type"]').forEach(radio => {
    radio.addEventListener('change', renderRemainingInputs);
  });
  bunkTypeSelect.dispatchEvent(new Event('change'));
calcCurrentBtn.addEventListener('click', () => {
  const entries = [
    { id: 'lecture-pct', name: 'Lecture' },
    { id: 'tutorial-pct', name: 'Tutorial' },
    { id: 'practical-pct', name: 'Practical' },
    { id: 'skilling-pct', name: 'Skilling' }
  ];
  let num = 0;
  let den = 0;
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
  if (pct >= 85) {
    status = 'Good ✅ Eligible';
    cls = 'green';
  } else if (pct >= 75) {
    status = 'Condonation ⚠️';
    cls = 'orange';
  }
  currentResult.innerHTML = `
    <p><strong>Overall: ${pct.toFixed(2)}%</strong></p>
    <p class="${cls}">Status: ${status}</p>
  `;
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

  const method = document.querySelector('input[name="remaining-type"]:checked').value;
  const componentStats = [];
  const errors = [];

  componentsList[bunkTypeSelect.value].forEach(comp => {
    const conductedInput = bunkInputsDiv.querySelector(`.conducted[data-comp="${comp}"]`);
    const attendedInput = bunkInputsDiv.querySelector(`.attended[data-comp="${comp}"]`);
    const conducted = parseFloat(conductedInput.value) || 0;
    const attended = parseFloat(attendedInput.value) || 0;
    if (attended > conducted) {
      errors.push(`${comp}: attended cannot exceed conducted.`);
    }
    componentStats.push({ comp, conducted, attended, future: 0 });
  });

  if (errors.length) {
    bunkResult.innerHTML = `<p class="red">${errors.join(' ')}</p>`;
    bunkResult.classList.remove('hidden');
    return;
  }

  if (method === 'direct') {
    remainingInputsDiv.querySelectorAll('.future').forEach(input => {
      const comp = input.dataset.comp;
      const entry = componentStats.find(item => item.comp === comp);
      if (entry) {
        entry.future = Math.max(0, parseFloat(input.value) || 0);
      }
    });
  } else {
    const duration = parseFloat(document.getElementById('remain-duration').value) || 0;
    remainingInputsDiv.querySelectorAll('.per-unit').forEach(input => {
      const comp = input.dataset.comp;
      const entry = componentStats.find(item => item.comp === comp);
      if (entry) {
        entry.future = Math.max(0, duration * (parseFloat(input.value) || 0));
      }
    });
  }

  const currentPercents = componentStats.map(entry => ({
    comp: entry.comp,
    pct: entry.conducted > 0 ? (entry.attended / entry.conducted) * 100 : 0
  }));
  const currentOverall = calculateOverall(currentPercents);

  if (currentOverall < target) {
    bunkResult.innerHTML = `
      <p class="red">Current SO ${currentOverall.toFixed(2)}% is below ${target}%. Not safe — attend every future class.</p>
    `;
    bunkResult.classList.remove('hidden');
    return;
  }

  const totalFutureClasses = componentStats.reduce((sum, entry) => sum + (entry.future || 0), 0);
  if (totalFutureClasses === 0) {
    bunkResult.innerHTML = `
      <p>No future classes recorded → final attendance locked at <strong>${currentOverall.toFixed(2)}%</strong>.</p>
    `;
    bunkResult.classList.remove('hidden');
    return;
  }

  const plan = findOptimalPlan(componentStats, target);
  if (!plan) {
    const perfectSO = calculateOverall(
      componentStats.map(entry => ({
        comp: entry.comp,
        pct: entry.conducted + entry.future > 0
          ? ((entry.attended + entry.future) / (entry.conducted + entry.future)) * 100
          : 0
      }))
    );
    bunkResult.innerHTML = `
      <p class="red">Even 100% attendance cannot reach ${target}%. Maximum achievable SO ≈ ${perfectSO.toFixed(2)}%.</p>
    `;
    bunkResult.classList.remove('hidden');
    return;
  }

  const componentCards = plan.perComponent.map(detail => `
    <div class="component-percent-card">
      <strong>${detail.comp}</strong>
      <p>Future: ${detail.future} | Attend: ${detail.attend} | Bunk: ${detail.bunk}</p>
      <p>New ${detail.comp}% = ${detail.pct.toFixed(2)}%</p>
    </div>
  `).join('');

  bunkResult.innerHTML = `
    <p><strong>Current SO:</strong> ${currentOverall.toFixed(2)}%</p>
    <p><strong>Target:</strong> ${target}%</p>
    <p class="green">Status: Safe Zone ✅ (closest SO above target with maximum bunk)</p>
    <div class="component-percent-grid">${componentCards}</div>
    <p style="margin-top:0.75rem;">Projected Final SO = <strong>${plan.finalSO.toFixed(2)}%</strong></p>
  `;
  bunkResult.classList.remove('hidden');
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

function findOptimalPlan(componentStats, target) {
  let best = null;
  const plan = new Array(componentStats.length).fill(0);
  const totalFuture = componentStats.reduce((sum, entry) => sum + (entry.future || 0), 0);

  const evaluate = () => {
    const percentList = [];
    let totalAttend = 0;
    componentStats.forEach((entry, index) => {
      const attend = plan[index];
      totalAttend += attend;
      const totalConducted = entry.conducted + entry.future;
      const totalAttended = entry.attended + attend;
      const pct = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 0;
      percentList.push({ comp: entry.comp, pct });
    });
    const finalSO = calculateOverall(percentList);
    if (finalSO < target) return;
    const delta = finalSO - target;
    const bunk = totalFuture - totalAttend;
    if (
      !best ||
      delta < best.delta ||
      (delta === best.delta && bunk > best.totalBunk)
    ) {
      best = {
        delta,
        finalSO,
        totalBunk: bunk,
        perComponent: componentStats.map((entry, index) => ({
          comp: entry.comp,
          future: entry.future,
          attend: plan[index],
          bunk: entry.future - plan[index],
          pct: percentList[index].pct
        }))
      };
    }
  };

  const dfs = index => {
    if (index === componentStats.length) {
      evaluate();
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
});