/* Cascade layout. Pipes are straight segments with rounded corners (no big
   curves, no sharp angles) routed around the containers so nothing clips.

   Top row: Protein | Carbohydrate | Fat  (fixed-thickness intake bars).
   Middle:  Muscle tissue | Blood glucose | Fat tissue.
   Below:   Glycogen (under blood glucose).
   Bottom:  Energy demand (BMR + Activity) with a carb/fat burn split. */

const SVGNS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

const macroColours = {
  carb:    { light: '#d8e6ee', dark: '#5b8ba8' },
  protein: { light: '#dde6d4', dark: '#6b8b5a' },
  fat:     { light: '#f0d8d2', dark: '#b8665a' },
  neutral: { light: '#e8e0d4', dark: '#7a6f5e' },
  muscle:  { light: '#dfd2c4', dark: '#8e6f55' }
};

const flowMacro = {
  'carbs-to-bg':         'carb',
  'bg-to-glycogen':      'carb',
  'glycogen-to-bg':      'neutral',
  'bg-to-fat':           'carb',
  'bg-to-demand':        'carb',
  'fat-in-to-fattissue': 'fat',
  'fat-in-to-demand':    'fat',
  'fattissue-to-demand': 'fat',
  'protein-to-demand':   'protein',
  'protein-to-bg':       'protein',
  'protein-to-muscle':   'protein',
  'muscle-to-bg':        'muscle',
  'muscle-to-demand':    'muscle'
};

// kcal/g for the substance each pipe carries — used to show g/day in tooltips.
const pipeSubstance = {
  'carbs-to-bg':         { name: 'glucose',        kcalPerG: 4 },
  'bg-to-glycogen':      { name: 'glucose',        kcalPerG: 4 },
  'glycogen-to-bg':      { name: 'glucose',        kcalPerG: 4 },
  'bg-to-fat':           { name: 'glucose',        kcalPerG: 4 },
  'bg-to-demand':        { name: 'glucose',        kcalPerG: 4 },
  'fat-in-to-fattissue': { name: 'fat',            kcalPerG: 9 },
  'fat-in-to-demand':    { name: 'fat',            kcalPerG: 9 },
  'fattissue-to-demand': { name: 'fat',            kcalPerG: 9 },
  'protein-to-demand':   { name: 'protein',        kcalPerG: 4 },
  'protein-to-bg':       { name: 'protein',        kcalPerG: 4 },
  'protein-to-muscle':   { name: 'protein',        kcalPerG: 4 },
  'muscle-to-bg':        { name: 'muscle protein', kcalPerG: 4 },
  'muscle-to-demand':    { name: 'muscle protein', kcalPerG: 4 }
};

// =============================================================================
// LAYOUT
// =============================================================================

const layout = {
  sources: {
    protein: { cx: 180,  cy: 85, label: 'Protein',      macro: 'protein', max: 400, minG: () => Math.floor((state.weight * 2) / 10) * 10 },
    carbs:   { cx: 600,  cy: 85, label: 'Carbohydrate', macro: 'carb',    max: 800, minG: () => Math.floor((state.weight * 2) / 10) * 10 },
    fat:     { cx: 1000, cy: 85, label: 'Fat',          macro: 'fat',     max: 300, minG: () => 50 }
  },
  containers: {
    muscle:   { x:  80, y: 270, w: 200, h: 130, macro: 'muscle',  label: 'Muscle tissue' },
    bg:       { x: 540, y: 270, w: 120, h:  70, macro: 'neutral', label: 'Blood glucose' },
    fat:      { x: 900, y: 270, w: 200, h: 160, macro: 'fat',     label: 'Fat tissue',  editable: true },
    glycogen: { x: 440, y: 490, w: 300, h: 120, macro: 'carb',    label: 'Glycogen',    editable: true }
  },
  sink: { cx: 600, cy: 775, r: 70, label: 'BMR + Activity' },
  // Pipes are polylines (waypoints); rounded at the corners.
  pipes: [
    { id: 'carbs-to-bg',         pts: [[600,97],[600,270]] },
    { id: 'fat-in-to-fattissue', pts: [[985,97],[985,270]] },
    { id: 'protein-to-muscle',   pts: [[160,97],[160,270]] },
    { id: 'protein-to-bg',       pts: [[210,97],[210,225],[560,225],[560,270]] },
    { id: 'protein-to-demand',   pts: [[150,97],[60,150],[60,712],[548,728]] },
    { id: 'muscle-to-bg',        pts: [[280,305],[540,305]] },
    { id: 'muscle-to-demand',    pts: [[185,400],[185,735],[545,752]] },
    { id: 'bg-to-glycogen',      pts: [[578,340],[578,490]] },
    { id: 'glycogen-to-bg',      pts: [[622,490],[622,340]] },
    { id: 'bg-to-fat',           pts: [[660,300],[900,300]] },
    { id: 'bg-to-demand',        pts: [[645,340],[800,420],[800,690],[600,705]] },
    { id: 'fat-in-to-demand',    pts: [[1015,97],[1160,160],[1160,690],[662,716]] },
    { id: 'fattissue-to-demand', pts: [[1000,430],[1000,685],[665,726]] }
  ]
};

// Build a path string of straight segments with rounded corners.
function roundedPath(pts, r = 18) {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;
  const dist = (a, b) => Math.hypot(b[0]-a[0], b[1]-a[1]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i-1], p1 = pts[i], p2 = pts[i+1];
    const d1 = Math.min(r, dist(p0, p1) / 2);
    const d2 = Math.min(r, dist(p1, p2) / 2);
    const u1 = [(p0[0]-p1[0])/dist(p0,p1), (p0[1]-p1[1])/dist(p0,p1)];
    const u2 = [(p2[0]-p1[0])/dist(p1,p2), (p2[1]-p1[1])/dist(p1,p2)];
    const a = [p1[0] + u1[0]*d1, p1[1] + u1[1]*d1];
    const b = [p1[0] + u2[0]*d2, p1[1] + u2[1]*d2];
    d += ` L ${a[0].toFixed(1)} ${a[1].toFixed(1)} Q ${p1[0]} ${p1[1]} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  const last = pts[pts.length-1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

// =============================================================================
// BUILDER
// =============================================================================

let sourceElements    = {};
let containerElements = {};
let sinkElements      = {};

const SOURCE_BAR_W = 150;
const SOURCE_BAR_H = 24;

function buildDiagram(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const defs = el('defs');
  for (const [key, c] of Object.entries(layout.containers)) {
    const clip = el('clipPath', { id: `clip-${key}` });
    clip.append(el('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 5, ry: 5 }));
    defs.append(clip);
  }
  for (const key of Object.keys(layout.sources)) {
    const s = layout.sources[key];
    const clip = el('clipPath', { id: `clip-src-${key}` });
    clip.append(el('rect', {
      x: s.cx - SOURCE_BAR_W/2, y: s.cy - SOURCE_BAR_H/2,
      width: SOURCE_BAR_W, height: SOURCE_BAR_H, rx: 5, ry: 5
    }));
    defs.append(clip);
  }
  svg.append(defs);

  // Pipes
  const pipesGroup = el('g', { class: 'pipes' });
  svg.append(pipesGroup);
  for (const p of layout.pipes) {
    const d = roundedPath(p.pts);
    const colour = macroColours[flowMacro[p.id]].dark;
    pipesGroup.append(
      el('path', { d, class: 'pipe-hit', 'data-pipe-id': p.id }),
      el('path', { d, class: 'pipe', stroke: colour, 'stroke-width': 3, opacity: 0.85 })
    );
  }

  // Sources
  sourceElements = {};
  const sourcesGroup = el('g', { class: 'sources' });
  svg.append(sourcesGroup);
  for (const [key, s] of Object.entries(layout.sources)) {
    const colour = macroColours[s.macro];
    const g = el('g', { class: 'source-group', 'data-source-id': key });
    const barX = s.cx - SOURCE_BAR_W / 2;
    const barY = s.cy - SOURCE_BAR_H / 2;
    const bgRect = el('rect', {
      x: barX, y: barY, width: SOURCE_BAR_W, height: SOURCE_BAR_H, rx: 5, ry: 5,
      fill: colour.light, stroke: colour.dark, class: 'source-bar-bg'
    });
    const fillRect = el('rect', {
      x: barX, y: barY, width: 0, height: SOURCE_BAR_H,
      fill: colour.dark, 'clip-path': `url(#clip-src-${key})`, class: 'bar-fill'
    });
    const minLine = el('line', {
      x1: barX, y1: barY - 4, x2: barX, y2: barY + SOURCE_BAR_H + 4,
      class: 'source-min-line'
    });
    const label  = el('text', { x: s.cx, y: barY - 12, class: 'source-macro' });
    label.textContent = s.label;
    const amount = el('text', { x: s.cx, y: barY + SOURCE_BAR_H + 18, class: 'source-amount' });
    amount.textContent = '—';
    g.append(bgRect, fillRect, minLine, label, amount);
    sourcesGroup.append(g);
    sourceElements[key] = { bgRect, fillRect, minLine, amount };
  }

  // Containers
  containerElements = {};
  const containersGroup = el('g', { class: 'containers' });
  svg.append(containersGroup);
  for (const [key, c] of Object.entries(layout.containers)) {
    const colour = macroColours[c.macro];
    const g = el('g', { class: 'container-group' + (c.editable ? ' editable' : '') });
    const bgRect = el('rect', {
      x: c.x, y: c.y, width: c.w, height: c.h, rx: 5, ry: 5,
      fill: colour.light, stroke: colour.dark, class: 'container-rect-bg'
    });
    const fillRect = el('rect', {
      x: c.x, y: c.y + c.h, width: c.w, height: 0,
      fill: colour.dark, 'clip-path': `url(#clip-${key})`, class: 'container-fill'
    });
    const label = el('text', { x: c.x + c.w / 2, y: c.y - 10, class: 'container-label' });
    label.textContent = c.label;
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    const inside1 = el('text', { x: cx, y: cy - 8, class: 'container-inside' });
    inside1.textContent = '—';
    const inside2 = el('text', { x: cx, y: cy + 10, class: 'container-inside2' });   // monthly impact / kcal
    const inside3 = el('text', { x: cx, y: cy + 26, class: 'container-cap' });        // cap note
    const hit = el('rect', {
      x: c.x, y: c.y, width: c.w, height: c.h, fill: 'transparent',
      class: 'container-hit', 'data-container-id': key
    });
    g.append(bgRect, fillRect, label, inside1, inside2, inside3, hit);
    if (c.editable) {
      const ex = c.x + c.w - 15, ey = c.y + 6;
      const editGlyph = el('text', { x: ex + 7, y: ey + 13, class: 'container-edit' });
      editGlyph.textContent = '✎';   // ✎ pencil — click to edit (see app.js delegation)
      const editHit = el('rect', {
        x: ex - 3, y: ey - 2, width: 24, height: 24, fill: 'transparent',
        class: 'container-edit-hit', 'data-edit-id': key
      });
      g.append(editGlyph, editHit);
    }
    containersGroup.append(g);
    containerElements[key] = { bgRect, fillRect, inside1, inside2, inside3 };
  }

  // Sink
  sinkElements = {};
  const sinksGroup = el('g', { class: 'sinks' });
  svg.append(sinksGroup);
  const s = layout.sink;
  const g = el('g', { class: 'sink-group', 'data-sink-id': 'demand' });
  g.append(el('circle', {
    cx: s.cx, cy: s.cy, r: s.r,
    fill: macroColours.neutral.light, stroke: macroColours.neutral.dark, 'stroke-width': 2
  }));
  g.append(el('circle', { cx: s.cx, cy: s.cy, r: s.r - 8, fill: macroColours.neutral.dark, opacity: 0.92 }));
  const kcalText = el('text', { x: s.cx, y: s.cy + 4, class: 'sink-kcal' });
  kcalText.textContent = '—';
  const kcalUnit = el('text', { x: s.cx, y: s.cy + 22, class: 'sink-kcal-unit' });
  kcalUnit.textContent = 'kcal / day';
  const sub = el('text', { x: s.cx, y: s.cy + s.r + 20, class: 'node-label' });
  sub.textContent = s.label;
  const splitText = el('text', { x: s.cx, y: s.cy + s.r + 40, class: 'sink-split' });
  splitText.textContent = '—';
  g.append(kcalText, kcalUnit, sub, splitText);
  sinksGroup.append(g);
  sinkElements.demand = { kcalText, splitText };
}

// =============================================================================
// UPDATE
// =============================================================================

function updateDiagram(calc) {
  setSource('protein', calc.sources.protein.g, calc.sources.protein.kcal);
  setSource('carbs',   calc.sources.carbs.g,   calc.sources.carbs.kcal);
  setSource('fat',     calc.sources.fat.g,     calc.sources.fat.kcal);

  for (const p of layout.pipes) {
    updatePipeFlowEl(p.id, calc.flows[p.id] ?? 0);
  }

  setContainerFill('bg', 0.5, '~5 g', '', '');

  // Glycogen — show the level it's HEADING toward (dry), plus the wet weight
  // (glycogen + its bound water ≈ "water weight" on the scale).
  const projGlyG = Math.max(0, Math.min(calc.glycogenCapacity, calc.currentGlycogenG + calc.glycogenDeltaG));
  setContainerFill('glycogen',
    projGlyG / calc.glycogenCapacity,
    `${Math.round(projGlyG).toLocaleString('en-US')} / ${Math.round(calc.glycogenCapacity).toLocaleString('en-US')} g dry`,
    `${Math.round(projGlyG * 4).toLocaleString('en-US')} g incl. water`,
    'supercompensated max ≈15 g/kg');

  // Fat tissue — fill height shows adiposity (fraction of body mass that is fat);
  // the text reports absolute mass and the projected monthly change.
  const fatKg = calc.fatMassG / 1000;
  setContainerFill('fat', Math.min(1, fatKg / state.weight),
    `${fatKg.toFixed(1)} kg  ·  ${fmtKcal(fatKg * 7700)}`,
    monthBoth(calc.fatTissueDeltaG, calc.fatWetDeltaG), '');

  // Muscle — fill height shows muscularity (skeletal-muscle fraction of body mass).
  const muscleKg = calc.muscleMassG / 1000;
  setContainerFill('muscle', Math.min(1, muscleKg / state.weight),
    `${muscleKg.toFixed(1)} kg  ·  ${fmtKcal(muscleKg * 1000 * 0.22 * 4)}`,
    monthBoth(calc.muscleDeltaG, calc.muscleWetDeltaG), '');

  if (sinkElements.demand) {
    sinkElements.demand.kcalText.textContent = fmtKcalShort(calc.totalDemand);
    const fatBurn  = Math.round(calc.bmrFatKcal  + calc.actFatKcal);
    const carbBurn = Math.round(calc.bmrCarbKcal + calc.actCarbKcal);
    const protBurn = Math.round(calc.actProteinKcal || 0);   // amino-acid share of activity
    let split = `${fatBurn.toLocaleString('en-US')} fat · ${carbBurn.toLocaleString('en-US')} carb`;
    if (protBurn > 0) split += ` · ${protBurn.toLocaleString('en-US')} protein`;
    sinkElements.demand.splitText.textContent = split + ' kcal';
  }
}

function setSource(key, grams, kcal) {
  const se = sourceElements[key];
  const conf = layout.sources[key];
  if (!se || !conf) return;
  const fraction = Math.max(0, Math.min(1, grams / conf.max));
  se.fillRect.setAttribute('width', (SOURCE_BAR_W * fraction).toFixed(2));
  const min = conf.minG();
  const minFraction = Math.max(0, Math.min(1, min / conf.max));
  const minX = conf.cx - SOURCE_BAR_W/2 + SOURCE_BAR_W * minFraction;
  se.minLine.setAttribute('x1', minX.toFixed(2));
  se.minLine.setAttribute('x2', minX.toFixed(2));
  se.amount.textContent = `${Math.round(grams)} g  ·  ${fmtKcal(kcal)}`;
}

function updatePipeFlowEl(pipeId, flowKcal) {
  const visEl = document.querySelector(`[data-pipe-id="${pipeId}"] + .pipe`);
  if (!visEl) return;
  if (!flowKcal || flowKcal < 5) {
    visEl.style.opacity = 0.16;
    visEl.setAttribute('stroke-width', 2);
    visEl.classList.remove('flowing');
    return;
  }
  const sw = Math.max(4, Math.min(26, Math.sqrt(flowKcal) * 0.6));
  visEl.setAttribute('stroke-width', sw.toFixed(2));
  const op = Math.max(0.6, Math.min(1, 0.55 + flowKcal / 1800));
  visEl.style.opacity = op.toFixed(2);
  const dur = Math.max(0.25, Math.min(7, 130 / Math.sqrt(flowKcal + 1)));
  visEl.style.setProperty('--flow-speed', dur.toFixed(2) + 's');
  visEl.classList.add('flowing');
}

function setContainerFill(key, fraction, line1, line2, capLine) {
  const ce = containerElements[key];
  const conf = layout.containers[key];
  if (!ce || !conf) return;
  const frac = Math.max(0, Math.min(1, fraction));
  const h = conf.h * frac;
  ce.fillRect.setAttribute('height', h.toFixed(2));
  ce.fillRect.setAttribute('y', (conf.y + conf.h - h).toFixed(2));
  ce.inside1.textContent = line1 || '';
  ce.inside2.textContent = line2 || '';
  ce.inside3.textContent = capLine || '';
  // colour the second line by direction when it's a +/- monthly figure
  if (line2 && (line2.startsWith('+') || line2.startsWith('−'))) {
    ce.inside2.setAttribute('fill', line2.startsWith('−') ? '#b8665a' : '#6b8b5a');
  } else {
    ce.inside2.setAttribute('fill', '#6b5e4f');
  }
}

// Daily gram change → "±X.X kg / month" (≈30.4 days). Blank if negligible.
function monthLine(gramsPerDay) {
  const kgPerMonth = gramsPerDay * 30.4 / 1000;
  if (Math.abs(kgPerMonth) < 0.05) return '';
  const sign = kgPerMonth >= 0 ? '+' : '−';
  return `${sign}${Math.abs(kgPerMonth).toFixed(1)} kg / month`;
}

// Monthly projection showing dry (substrate) and wet (tissue) mass side by side.
function monthBoth(dryGramsPerDay, wetGramsPerDay) {
  const kgM = g => g * 30.4 / 1000;
  const wet = kgM(wetGramsPerDay);
  if (Math.abs(wet) < 0.05) return '';
  const f = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(1);
  return `${f(kgM(dryGramsPerDay))} dry · ${f(wet)} wet  kg/mo`;
}

function fmtKcal(k)      { return Math.round(k).toLocaleString('en-US') + ' kcal'; }
function fmtKcalShort(k) { return Math.round(k).toLocaleString('en-US'); }
