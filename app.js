/* App: state, calculations, input wiring, tooltip + popup handling.
   Steady-state daily model. Accounting is reconciled so that
     Net balance == Sum of stores
   regardless of substrate-side flows. */

// ---------- State ----------
const state = {
  weight: 75,
  bodyfat: 18,
  protein: 150,
  carbs: 250,
  fat: 70,
  activities: [],                  // [{ type, kcal }]
  glycogenCapacityOverride: null,
  glycogenFillFraction: 0.5,
  fatMassOverride: null,
  bgFillFraction: 0.5
};

const activityRates = {
  walk: { kcalPerMinPerKg: 0.06, fatPct: 0.80, label: 'Walking',        resistance: false },
  run:  { kcalPerMinPerKg: 0.14, fatPct: 0.57, label: 'Running',        resistance: false },
  gym:  { kcalPerMinPerKg: 0.07, fatPct: 0.30, label: 'Gym (strength)', resistance: true }
};

// --- Physiological constants (sourced from the literature) ---
const FAT_MAX_KCAL_PER_KG   = 48;    // max fat mobilization ≈ 48 kcal/kg fat/day — Alpert's unpublished
                                     // downward correction (~22 kcal/lb). Orig. published value was
                                     // 290 kJ/kg ≈ 69 kcal/kg; the lower figure is anecdotal, not peer-reviewed.
const DNL_MAX_FAT_G         = 150;   // max de-novo-lipogenesis fat synthesis g/day
const DNL_EFFICIENCY        = 0.75;  // ~25% energy lost converting carb → fat
const MUSCLE_PROTEIN_FRAC   = 0.22;  // protein fraction of wet muscle mass
const MUSCLE_GAIN_MAX_WET_G = 33;    // ceiling ≈ 1 kg muscle/month (novice, ideal conditions)
const GLYCOGEN_WATER_RATIO  = 3;     // g water bound per g glycogen → wet ≈ 4× the dry mass
const FAT_TISSUE_LIPID_FRAC = 0.87;  // lipid fraction of adipose tissue → wet ≈ dry / 0.87
const GLYCOGEN_G_PER_KG     = 15;    // max glycogen store ≈ 15 g per kg body weight

function activityMinutes(a) {
  const r = activityRates[a.type];
  if (!r) return 0;
  return a.kcal / (r.kcalPerMinPerKg * state.weight);
}

// ---------- Calculations ----------
function calculate() {
  const lbm         = state.weight * (1 - state.bodyfat / 100);
  const fatMassKg   = state.fatMassOverride ?? state.weight * (state.bodyfat / 100);
  const muscleKg    = lbm * 0.45;
  const muscleMassG = muscleKg * 1000;

  // Glycogen capacity ≈ 15 g per kg body weight (whole-body max, muscle + liver).
  const glycogenCapacity = state.glycogenCapacityOverride ?? (state.weight * GLYCOGEN_G_PER_KG);
  const currentGlycogenG = Math.min(glycogenCapacity, glycogenCapacity * state.glycogenFillFraction);
  const glycogenHeadroomKcal = Math.max(0, (glycogenCapacity - currentGlycogenG) * 4);
  const glycogenAvailKcal    = currentGlycogenG * 4;

  const bmr = 370 + 21.6 * lbm;

  // --- Activity: split into fat / carb / protein (amino-acid) components ---
  let actKcal = 0, rawActFat = 0, rawActCarb = 0, gymPresent = false;
  for (const a of state.activities) {
    const r = activityRates[a.type];
    if (!r || !a.kcal) continue;
    actKcal    += a.kcal;
    rawActFat  += a.kcal * r.fatPct;
    rawActCarb += a.kcal * (1 - r.fatPct);
    if (r.resistance) gymPresent = true;
  }
  // Protein's share of exercise energy rises as dietary carbs run low (~5%→10%).
  const carbRefG = state.weight * 2;
  const carbAdequacy = Math.max(0, Math.min(1, state.carbs / Math.max(carbRefG, 1)));
  const exerciseProteinFrac = 0.05 + 0.05 * (1 - carbAdequacy);
  const actProteinKcal = actKcal * exerciseProteinFrac;
  const actFatKcal     = rawActFat  * (1 - exerciseProteinFrac);
  const actCarbKcal    = rawActCarb * (1 - exerciseProteinFrac);

  const bmrCarbKcal = 0.4 * bmr;
  const bmrFatKcal  = 0.6 * bmr;
  const carbDemandKcal = bmrCarbKcal + actCarbKcal;
  const fatDemandKcal  = bmrFatKcal  + actFatKcal;
  const totalDemand    = bmr + actKcal;

  const carbInKcal    = state.carbs   * 4;
  const fatInKcal     = state.fat     * 9;
  const proteinInKcal = state.protein * 4;
  const intakeKcal    = carbInKcal + fatInKcal + proteinInKcal;

  // =========================================================================
  // CARB SIDE — glycogen storage (capped) → DNL (capped) → drain in deficit.
  // Stores are only BUILT out of an overall energy surplus: while in a deficit
  // a local carb surplus is oxidised (sparing other fuels), never stored — the
  // body does not lay down glycogen at the same time it is short of energy.
  // =========================================================================
  const energyBalanceKcal = intakeKcal - totalDemand;
  let toGlycogenKcal = 0, glycogenDrainKcal = 0;
  let dnlGlucoseKcal = 0, dnlStoredKcal = 0, dnlHeatLossKcal = 0;
  let carbExcessOxidizedKcal = 0;

  if (carbInKcal >= carbDemandKcal) {
    const carbSurplus  = carbInKcal - carbDemandKcal;
    const storableKcal = Math.max(0, Math.min(carbSurplus, energyBalanceKcal));
    toGlycogenKcal = Math.min(storableKcal, glycogenHeadroomKcal);
    const carbAfterGly = storableKcal - toGlycogenKcal;
    // DNL: cap fat synthesised at DNL_MAX_FAT_G/day
    dnlStoredKcal   = Math.min(carbAfterGly * DNL_EFFICIENCY, DNL_MAX_FAT_G * 9);
    dnlGlucoseKcal  = dnlStoredKcal / DNL_EFFICIENCY;
    dnlHeatLossKcal = dnlGlucoseKcal - dnlStoredKcal;
    // carbs not stored (energy deficit, or beyond DNL capacity) are oxidised
    carbExcessOxidizedKcal = carbSurplus - toGlycogenKcal - dnlGlucoseKcal;
  } else {
    const carbDeficit = carbDemandKcal - carbInKcal;
    glycogenDrainKcal = Math.min(carbDeficit, glycogenAvailKcal);
  }
  const gngNeedKcal = Math.max(0, (carbDemandKcal - carbInKcal) - glycogenDrainKcal);

  // =========================================================================
  // ENERGY DEFICIT ALLOCATION — fat (capped) then muscle backstop
  // =========================================================================
  const storesNeededKcal = Math.max(0, totalDemand - intakeKcal);

  // Amino-acid demands that the diet must cover, else muscle is catabolised:
  const proteinForExerciseKcal = Math.min(proteinInKcal, actProteinKcal);
  let   proteinRemKcal         = proteinInKcal - proteinForExerciseKcal;
  const muscleForExerciseKcal  = actProteinKcal - proteinForExerciseKcal;

  const proteinToGngKcal   = Math.min(proteinRemKcal, gngNeedKcal);
  proteinRemKcal          -= proteinToGngKcal;
  const muscleForGngKcal   = gngNeedKcal - proteinToGngKcal;

  const muscleSubstrateKcal = muscleForExerciseKcal + muscleForGngKcal;

  // Fat supplies up to its daily (Alpert) cap. That ceiling is a SUSTAINED-rate
  // limit, so on a single deficit day the gap beyond it is first bridged by
  // drawing down whatever glycogen remains — glycogen is the body's short-term
  // energy buffer and its loss is readily reversible. Muscle protein is only
  // catabolised once glycogen is exhausted.
  const fatMaxKcal = fatMassKg * FAT_MAX_KCAL_PER_KG;
  const afterGlyAndMuscleSub = storesNeededKcal - glycogenDrainKcal - muscleSubstrateKcal;
  const fatDrainKcal   = Math.max(0, Math.min(fatMaxKcal, afterGlyAndMuscleSub));
  const energyGapAfterFat     = Math.max(0, afterGlyAndMuscleSub - fatDrainKcal);
  const glycogenForEnergyKcal = Math.min(energyGapAfterFat,
                                         Math.max(0, glycogenAvailKcal - glycogenDrainKcal));
  const extraMuscleKcal        = Math.max(0, energyGapAfterFat - glycogenForEnergyKcal);
  let   glycogenDrainTotalKcal = glycogenDrainKcal + glycogenForEnergyKcal;

  const muscleCatabolismKcal = muscleSubstrateKcal + extraMuscleKcal;
  const muscleToBgKcal       = muscleForGngKcal;
  const muscleToDemandKcal   = muscleForExerciseKcal + extraMuscleKcal;

  // =========================================================================
  // MUSCLE GAIN — only with training + adequate protein + energy surplus
  // =========================================================================
  const netBalanceKcal = intakeKcal - totalDemand - dnlHeatLossKcal;
  const maintenanceProteinG = 1.6 * state.weight;   // Morton 2018 breakpoint is per kg body weight
  let muscleGainKcal = 0;
  if (muscleCatabolismKcal === 0 && gymPresent &&
      state.protein >= maintenanceProteinG && netBalanceKcal > 0) {
    const gainScale = Math.max(0, Math.min(1, netBalanceKcal / 400));
    const gainWetG  = MUSCLE_GAIN_MAX_WET_G * gainScale;
    muscleGainKcal  = Math.min(gainWetG * MUSCLE_PROTEIN_FRAC * 4, proteinRemKcal);
  }
  const proteinToMuscleKcal = muscleGainKcal;
  proteinRemKcal -= proteinToMuscleKcal;

  // =========================================================================
  // OXIDATION PIPES — must sum to totalDemand (energy conserving)
  // =========================================================================
  const glucoseInKcal      = carbInKcal + glycogenDrainTotalKcal + proteinToGngKcal + muscleToBgKcal;
  const glucoseStoredKcal  = toGlycogenKcal + dnlGlucoseKcal;
  let   bgToDemandKcal     = glucoseInKcal - glucoseStoredKcal;   // glucose oxidised

  let demandRemaining = totalDemand - bgToDemandKcal - muscleToDemandKcal;

  // dietary protein not used for GNG / muscle gain is oxidised (incl. exercise AA)
  const proteinAvailOxKcal = proteinInKcal - proteinToGngKcal - proteinToMuscleKcal;
  let   proteinToDemandKcal = Math.min(proteinAvailOxKcal, Math.max(0, demandRemaining));
  demandRemaining -= proteinToDemandKcal;

  let   fatInToDemandKcal = Math.min(fatInKcal, Math.max(0, demandRemaining));
  demandRemaining -= fatInToDemandKcal;

  let   fatTissueToDemandKcal = Math.max(0, demandRemaining);   // == fatDrainKcal

  // =========================================================================
  // STORAGE PIPES
  // =========================================================================
  const proteinToFatKcal   = proteinAvailOxKcal - proteinToDemandKcal;   // surplus protein → fat
  const fatInSurplusKcal   = fatInKcal - fatInToDemandKcal;              // dietary fat stored
  let   fatInToFatTissueKcal = fatInSurplusKcal + proteinToFatKcal;
  const bgToFatKcal        = dnlGlucoseKcal;                            // DNL pipe

  // In an overall energy deficit nothing is laid down on net. The substrate
  // bookkeeping above can still leave dietary fat / surplus protein "unburned"
  // when a store (usually glycogen) was drained to cover a demand component —
  // which would otherwise render as fat being STORED mid-deficit. Redirect that
  // food to oxidation and shrink the store drain by the same amount, so no
  // storage pipe shows while in deficit. Energy- and mass-conserving: the net
  // glycogen / fat / muscle deltas are unchanged.
  if (netBalanceKcal < 0 && fatInToFatTissueKcal > 0) {
    const redirect = fatInToFatTissueKcal;
    proteinToDemandKcal += proteinToFatKcal;   // surplus protein is oxidised, not stored
    fatInToDemandKcal   += fatInSurplusKcal;   // dietary-fat surplus is oxidised, not stored
    fatInToFatTissueKcal = 0;
    const fromFat = Math.min(redirect, fatTissueToDemandKcal);
    fatTissueToDemandKcal -= fromFat;
    const fromGly = Math.min(redirect - fromFat, glycogenDrainTotalKcal);
    glycogenDrainTotalKcal -= fromGly;
    bgToDemandKcal         -= fromGly;
  }

  // =========================================================================
  // DELTAS + reconciliation (storage sum must equal net balance)
  // =========================================================================
  const glycogenDeltaG     = (toGlycogenKcal - glycogenDrainTotalKcal) / 4;
  const muscleProteinDeltaG = (muscleGainKcal - muscleCatabolismKcal) / 4;
  let   fatTissueKcalDelta = fatInToFatTissueKcal + dnlStoredKcal - fatTissueToDemandKcal;

  const storageSumProvisional =
    glycogenDeltaG * 4 + fatTissueKcalDelta + muscleProteinDeltaG * 4;
  const discrepancy = netBalanceKcal - storageSumProvisional;
  if (Math.abs(discrepancy) > 0.5) {
    fatTissueKcalDelta += discrepancy;
    if (discrepancy > 0) fatInToFatTissueKcal += discrepancy;
  }

  const fatTissueDeltaG = fatTissueKcalDelta / 9;
  const muscleDeltaG    = muscleProteinDeltaG;   // protein-substrate grams (kcal / 4), consistent with the fat row
  const storageSumKcal  = glycogenDeltaG * 4 + fatTissueKcalDelta + muscleProteinDeltaG * 4;

  // Wet-tissue (scale-weight) equivalents: the substrate mass plus its bound water.
  const glycogenWetDeltaG = glycogenDeltaG * (1 + GLYCOGEN_WATER_RATIO);
  const fatWetDeltaG      = fatTissueDeltaG / FAT_TISSUE_LIPID_FRAC;
  const muscleWetDeltaG   = muscleProteinDeltaG / MUSCLE_PROTEIN_FRAC;

  return {
    lbm, fatMassKg, muscleMassG, bmr, actKcal,
    bmrCarbKcal, bmrFatKcal, actCarbKcal, actFatKcal, actProteinKcal,
    intakeKcal, totalDemand, netBalanceKcal, storageSumKcal,
    dnlHeatLossKcal,
    glycogenCapacity, currentGlycogenG, glycogenDeltaG, glycogenWetDeltaG,
    fatMassG: fatMassKg * 1000, fatTissueDeltaG, fatWetDeltaG,
    muscleDeltaG, muscleProteinDeltaG, muscleWetDeltaG,
    sources: {
      protein: { g: state.protein, kcal: proteinInKcal },
      carbs:   { g: state.carbs,   kcal: carbInKcal },
      fat:     { g: state.fat,     kcal: fatInKcal }
    },
    flows: {
      'carbs-to-bg':         carbInKcal,
      'bg-to-glycogen':      toGlycogenKcal,
      'glycogen-to-bg':      glycogenDrainTotalKcal,
      'bg-to-fat':           bgToFatKcal,
      'bg-to-demand':        bgToDemandKcal,
      'fat-in-to-fattissue': fatInToFatTissueKcal,
      'fat-in-to-demand':    fatInToDemandKcal,
      'fattissue-to-demand': fatTissueToDemandKcal,
      'protein-to-demand':   proteinToDemandKcal,
      'protein-to-bg':       proteinToGngKcal,
      'protein-to-muscle':   proteinToMuscleKcal,
      'muscle-to-bg':        muscleToBgKcal,
      'muscle-to-demand':    muscleToDemandKcal
    }
  };
}

// ---------- Render ----------
let lastCalc = null;

function render() {
  const c = calculate();
  lastCalc = c;
  updateDiagram(c);

  const fmt = n => {
    const r = Math.round(n) + 0;
    return (r >= 0 ? '+' : '−') + Math.abs(r).toLocaleString('en-US');
  };
  const fmtG = n => fmt(n) + ' g';

  document.getElementById('r-intake').textContent  = Math.round(c.intakeKcal).toLocaleString('en-US');
  document.getElementById('r-demand').textContent  = '−' + Math.round(c.totalDemand).toLocaleString('en-US');
  document.getElementById('r-dnl').textContent     = c.dnlHeatLossKcal > 0
    ? '−' + Math.round(c.dnlHeatLossKcal).toLocaleString('en-US')
    : '0';

  const balEl = document.getElementById('r-balance');
  balEl.textContent = fmt(c.netBalanceKcal);
  balEl.style.color = c.netBalanceKcal >= 0 ? 'var(--protein-dark)' : 'var(--fat-dark)';

  document.getElementById('r-glycogen-g').textContent    = fmtG(c.glycogenDeltaG);
  document.getElementById('r-glycogen-wet').textContent  = fmtG(c.glycogenWetDeltaG);
  document.getElementById('r-glycogen-kcal').textContent = fmt(c.glycogenDeltaG * 4);
  document.getElementById('r-fat-g').textContent    = fmtG(c.fatTissueDeltaG);
  document.getElementById('r-fat-wet').textContent  = fmtG(c.fatWetDeltaG);
  document.getElementById('r-fat-kcal').textContent = fmt(c.fatTissueDeltaG * 9);
  document.getElementById('r-muscle-g').textContent    = fmtG(c.muscleDeltaG);
  document.getElementById('r-muscle-wet').textContent  = fmtG(c.muscleWetDeltaG);
  document.getElementById('r-muscle-kcal').textContent = fmt(c.muscleProteinDeltaG * 4);
  document.getElementById('r-storage-sum').textContent = fmt(c.storageSumKcal);

  document.getElementById('protein-kcal').textContent = `${state.protein * 4} kcal`;
  document.getElementById('carbs-kcal').textContent   = `${state.carbs * 4} kcal`;
  document.getElementById('fat-kcal').textContent     = `${state.fat * 9} kcal`;

  document.querySelectorAll('.activity-row .mins').forEach(span => {
    const i = +span.dataset.i;
    if (state.activities[i]) {
      span.textContent = `≈${Math.round(activityMinutes(state.activities[i]))} min`;
    }
  });
}

// ---------- Input wiring ----------
function bindNumber(id, key, opts = {}) {
  const inp = document.getElementById(id);
  const clamp = v => {
    if (opts.min !== undefined) v = Math.max(opts.min, v);
    if (opts.max !== undefined) v = Math.min(opts.max, v);
    return v;
  };
  // Live updates keep the model in sync while typing, without fighting the field.
  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value);
    if (isNaN(v)) return;
    state[key] = clamp(v);
    render();
  });
  // On commit (blur / Enter) snap the displayed value to the clamped result.
  inp.addEventListener('change', () => {
    let v = parseFloat(inp.value);
    if (isNaN(v)) { inp.value = state[key]; return; }
    v = clamp(v);
    state[key] = v;
    inp.value = v;
    render();
  });
}

function bindMacroPair(rangeId, numId, key, max) {
  const range = document.getElementById(rangeId);
  const num   = document.getElementById(numId);
  const update = src => {
    let v = parseFloat(src.value);
    if (isNaN(v)) return;
    v = Math.max(0, Math.min(max, v));
    state[key] = v;
    range.value = v;
    num.value = v;
    render();
  };
  range.addEventListener('input', () => update(range));
  num.addEventListener('input', () => update(num));
}

// ---------- Activities ----------
function renderActivities() {
  const root = document.getElementById('activities');
  root.innerHTML = '';
  state.activities.forEach((a, i) => {
    const minutes = Math.round(activityMinutes(a));
    const row = document.createElement('div');
    row.className = 'activity-row';
    row.innerHTML = `
      <select data-i="${i}" data-field="type">
        <option value="walk" ${a.type==='walk'?'selected':''}>Walk</option>
        <option value="run"  ${a.type==='run' ?'selected':''}>Run</option>
        <option value="gym"  ${a.type==='gym' ?'selected':''}>Gym</option>
      </select>
      <button type="button" class="remove" data-i="${i}" title="Remove">×</button>
      <div class="row-bot">
        <input type="range" data-i="${i}" data-field="kcal-range"
          min="0" max="2000" step="10" value="${a.kcal}">
        <input type="number" data-i="${i}" data-field="kcal-num"
          min="0" max="2000" step="10" value="${a.kcal}">
        <span class="unit">kcal</span>
        <span class="mins" data-i="${i}">≈${minutes} min</span>
      </div>
    `;
    root.appendChild(row);
  });
  root.querySelectorAll('select, input').forEach(elx => {
    elx.addEventListener('input', () => {
      const i = +elx.dataset.i;
      const f = elx.dataset.field;
      if (!state.activities[i]) return;
      if (f === 'type') state.activities[i].type = elx.value;
      if (f === 'kcal-range' || f === 'kcal-num') {
        const v = Math.max(0, Math.min(2000, +elx.value || 0));
        state.activities[i].kcal = v;
        const partnerField = f === 'kcal-range' ? 'kcal-num' : 'kcal-range';
        const partner = root.querySelector(`.activity-row [data-i="${i}"][data-field="${partnerField}"]`);
        if (partner) partner.value = v;
      }
      render();
    });
  });
  root.querySelectorAll('.remove').forEach(b => {
    b.addEventListener('click', () => {
      state.activities.splice(+b.dataset.i, 1);
      renderActivities();
      render();
    });
  });

  const addBtn = document.getElementById('add-activity');
  if (addBtn) {
    const atMax = state.activities.length >= 4;
    addBtn.disabled = atMax;
    addBtn.textContent = atMax ? 'Maximum of 4 activities' : '+ Add activity';
  }
}

// ---------- Tooltip (smooth fade; nested stays open when the cursor moves onto it) ----------
const tip = document.getElementById('tooltip');
const nestedTip = document.getElementById('nested-tooltip');
let hideTimer = null;

function placeNode(node, x, y) {
  const r = node.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width  > window.innerWidth  - 12) left = x - r.width  - 14;
  if (top  + r.height > window.innerHeight - 12) top  = y - r.height - 14;
  node.style.left = Math.max(8, left) + 'px';
  node.style.top  = Math.max(8, top)  + 'px';
}

function cancelHide() { clearTimeout(hideTimer); }

// Hides BOTH the main and nested tooltip. A single shared timer means hovering
// either one cancels the pending hide of both — so reaching the sub-popup no
// longer makes everything vanish.
function scheduleHideTooltip() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    tip.classList.remove('show');
    nestedTip.classList.remove('show');
  }, 260);
}

function showTooltip(html, x, y) {
  cancelHide();
  nestedTip.classList.remove('show');   // clear any stale nested from a previous element
  tip.innerHTML = html;
  tip.classList.add('show');
  placeNode(tip, x, y);
}

function showNested(entry, x, y) {
  cancelHide();
  nestedTip.innerHTML =
    `<div class="definition">${entry.definition}</div>` +
    `<a class="wiki-link" href="${entry.url}" target="_blank" rel="noopener">Read on Wikipedia →</a>`;
  nestedTip.classList.add('show');
  placeNode(nestedTip, x, y);
}

tip.addEventListener('mouseenter', cancelHide);
tip.addEventListener('mouseleave', scheduleHideTooltip);
nestedTip.addEventListener('mouseenter', cancelHide);
nestedTip.addEventListener('mouseleave', scheduleHideTooltip);

// Hovering a dotted term opens the nested tooltip, placed to slightly overlap the
// term so there is no dead gap to cross on the way to it.
tip.addEventListener('mouseover', e => {
  const term = e.target.closest && e.target.closest('.term');
  if (term && term.dataset.term) {
    const g = glossary[term.dataset.term];
    if (g) {
      const r = term.getBoundingClientRect();
      showNested(g, r.left - 6, r.bottom - 2);
    }
  }
});

// ---------- Event delegation on the SVG ----------
function attachSvgDelegation(svg) {
  svg.addEventListener('mouseover', e => {
    const pipeHit = e.target.closest('[data-pipe-id]');
    if (pipeHit && pipeHit.dataset.pipeId) {
      const id = pipeHit.dataset.pipeId;
      const t = pipeTooltips[id];
      if (!t) return;
      const flow = lastCalc?.flows?.[id] ?? 0;
      let extra;
      if (flow >= 5) {
        const sub = pipeSubstance[id];
        const g = sub ? (flow / sub.kcalPerG) : null;
        const gStr = g != null
          ? ` · ${g >= 100 ? Math.round(g).toLocaleString('en-US') : g.toFixed(1)} g ${sub.name}/day`
          : '';
        extra = `Currently flowing: ${Math.round(flow).toLocaleString('en-US')} kcal/day${gStr}`;
      } else {
        extra = 'Currently inactive';
      }
      showTooltip(buildTooltipHtml(t, extra), e.clientX, e.clientY);
      return;
    }
    const containerHit = e.target.closest('[data-container-id]');
    if (containerHit) {
      const key = containerHit.dataset.containerId;
      const t = containerTooltips[key];
      if (!t) return;
      let extra = '';
      if (key === 'glycogen' && lastCalc) {
        extra = `Current: ${Math.round(lastCalc.currentGlycogenG)} g / ${Math.round(lastCalc.glycogenCapacity)} g capacity`;
      } else if (key === 'fat' && lastCalc) {
        extra = `Current: ${(lastCalc.fatMassG/1000).toFixed(1)} kg`;
      } else if (key === 'muscle' && lastCalc) {
        extra = `Current: ${(lastCalc.muscleMassG/1000).toFixed(1)} kg wet mass`;
      } else if (key === 'bg') {
        extra = `Pool: ~5 g circulating · homeostatic, not editable`;
      }
      showTooltip(buildTooltipHtml(t, extra), e.clientX, e.clientY);
      return;
    }
    const sourceHit = e.target.closest('[data-source-id]');
    if (sourceHit) {
      const key = sourceHit.dataset.sourceId;
      const t = sourceTooltips[key];
      if (!t) return;
      const g = { protein: state.protein, carbs: state.carbs, fat: state.fat }[key];
      const kcal = g * (key === 'fat' ? 9 : 4);
      showTooltip(buildTooltipHtml(t, `Currently: ${g} g (${kcal.toLocaleString('en-US')} kcal/day)`), e.clientX, e.clientY);
      return;
    }
    const sinkHit = e.target.closest('[data-sink-id]');
    if (sinkHit && lastCalc) {
      const t = sinkTooltips.bmr;
      const kcal = lastCalc.totalDemand;
      const fatBurn = Math.round(lastCalc.bmrFatKcal + lastCalc.actFatKcal);
      const carbBurn = Math.round(lastCalc.bmrCarbKcal + lastCalc.actCarbKcal);
      const extra = `Currently: ${Math.round(kcal).toLocaleString('en-US')} kcal/day total
        <br>BMR ${Math.round(lastCalc.bmr).toLocaleString('en-US')} kcal · activity ${Math.round(lastCalc.actKcal).toLocaleString('en-US')} kcal
        <br>Substrate: ${fatBurn.toLocaleString('en-US')} kcal fat · ${carbBurn.toLocaleString('en-US')} kcal carb`;
      showTooltip(buildTooltipHtml(t, extra), e.clientX, e.clientY);
    }
  });

  svg.addEventListener('mouseout', e => {
    if (e.target.closest('[data-pipe-id], [data-container-id], [data-source-id], [data-sink-id]')) {
      scheduleHideTooltip();
    }
  });

  svg.addEventListener('contextmenu', e => {
    const containerHit = e.target.closest('[data-container-id]');
    if (!containerHit) return;
    const key = containerHit.dataset.containerId;
    if (key === 'bg' || key === 'muscle') return;
    e.preventDefault();
    showPopup(key, e.clientX, e.clientY);
  });

  // The ✎ badge on editable containers opens the same editor with a normal click
  // (discoverable, and works where right-click isn't available).
  svg.addEventListener('click', e => {
    const editHit = e.target.closest('[data-edit-id]');
    if (editHit && editHit.dataset.editId) showPopup(editHit.dataset.editId, e.clientX, e.clientY);
  });
}

// ---------- Popup (right-click on container) ----------
const popup = document.getElementById('popup');
function showPopup(kind, x, y) {
  if (kind === 'glycogen') {
    const cap = Math.round(lastCalc?.glycogenCapacity ?? 700);
    popup.innerHTML = `
      <h3>Glycogen</h3>
      <label>Capacity (g)
        <input id="pp-cap" type="number" value="${cap}" min="100" max="2000">
      </label>
      <label>Current fill (%)
        <input id="pp-fill" type="number" value="${Math.round(state.glycogenFillFraction*100)}" min="0" max="100">
      </label>
      <div class="btns">
        <button type="button" id="pp-reset">Reset</button>
        <button type="button" class="primary" id="pp-apply">Apply</button>
      </div>`;
  } else if (kind === 'fat') {
    const kg = ((lastCalc?.fatMassG ?? state.weight * state.bodyfat * 10) / 1000).toFixed(1);
    popup.innerHTML = `
      <h3>Fat tissue</h3>
      <label>Current fat mass (kg)
        <input id="pp-fat" type="number" value="${kg}" min="1" max="80" step="0.5">
      </label>
      <div class="btns">
        <button type="button" id="pp-reset">Reset</button>
        <button type="button" class="primary" id="pp-apply">Apply</button>
      </div>`;
  } else return;

  popup.hidden = false;
  popup.style.left = '-9999px'; popup.style.top = '-9999px';
  requestAnimationFrame(() => {
    const r = popup.getBoundingClientRect();
    let left = x, top = y;
    if (left + r.width  > window.innerWidth  - 12) left = window.innerWidth  - r.width  - 12;
    if (top  + r.height > window.innerHeight - 12) top  = window.innerHeight - r.height - 12;
    popup.style.left = Math.max(8, left) + 'px';
    popup.style.top  = Math.max(8, top)  + 'px';
  });

  document.getElementById('pp-apply').onclick = () => {
    if (kind === 'glycogen') {
      const cap = parseFloat(document.getElementById('pp-cap').value);
      const fill = parseFloat(document.getElementById('pp-fill').value);
      if (!isNaN(cap)) state.glycogenCapacityOverride = cap;
      if (!isNaN(fill)) state.glycogenFillFraction = Math.max(0, Math.min(1, fill/100));
    } else if (kind === 'fat') {
      const kg = parseFloat(document.getElementById('pp-fat').value);
      if (!isNaN(kg)) state.fatMassOverride = kg;
    }
    popup.hidden = true;
    render();
  };
  document.getElementById('pp-reset').onclick = () => {
    if (kind === 'glycogen') {
      state.glycogenCapacityOverride = null;
      state.glycogenFillFraction = 0.5;
    } else if (kind === 'fat') {
      state.fatMassOverride = null;
    }
    popup.hidden = true;
    render();
  };
}
document.addEventListener('mousedown', e => {
  if (!popup.hidden && !popup.contains(e.target)) popup.hidden = true;
});

// ---------- Init ----------
function init() {
  const svg = document.getElementById('diagram');
  buildDiagram(svg);
  attachSvgDelegation(svg);

  bindNumber('weight',  'weight',  { min: 40, max: 200 });
  bindNumber('bodyfat', 'bodyfat', { min: 5,  max: 60 });
  bindMacroPair('protein-range', 'protein-num', 'protein', 400);
  bindMacroPair('carbs-range',   'carbs-num',   'carbs',   800);
  bindMacroPair('fat-range',     'fat-num',     'fat',     300);

  document.getElementById('add-activity').addEventListener('click', () => {
    if (state.activities.length >= 4) return;
    state.activities.push({ type: 'walk', kcal: 200 });
    renderActivities();
    render();
  });

  renderActivities();
  render();
}

document.addEventListener('DOMContentLoaded', init);
