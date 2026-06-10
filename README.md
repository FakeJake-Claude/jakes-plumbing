# Jake’s Plumbing

A single-page interactive visualisation of human macronutrient metabolism — adjust your weight, body fat, activity, and macros and watch energy flow through the body’s storage systems in real time.

## Run

Open `index.html` in any modern browser. No build step, no server required.

## File structure

```
index.html      Page structure: sidebar (inputs + readouts) and SVG canvas
styles.css      All styling — warm-cream editorial aesthetic
glossary.js     Wikipedia-linked term definitions (insulin, β-oxidation, …)
tooltips.js     Pipe / container / source / sink tooltip text + glossary linking
diagram.js      SVG construction. Builds nodes, containers, and pipes once.
                Exposes updatePipeFlow() and updateContainerFill() per render.
app.js          State, calculations, input wiring, tooltip + popup behaviour.
                The calculate() function is a pure single-day model
                and is the only place numbers come from.
```

## How it works

- **Inputs** in the sidebar mutate `state` in `app.js`. Every change triggers `render()`.
- `render()` calls `calculate()`, then pushes the resulting flow values and container fills into the SVG via `diagram.js`. No diffing — direct attribute updates.
- **Pipes** are SVG paths with `stroke-dasharray`; the `stroke-dashoffset` is animated via a CSS keyframe whose duration is set per-pipe through the `--flow-speed` custom property. Higher flow = thicker stroke + faster dashes.
- **Containers** use a clipped fill rectangle whose height tracks the current fill fraction.
- **Tooltips** are HTML elements, not SVG `<title>` — this lets bracketed `[terms]` become hoverable dotted-underline glossary links with Wikipedia URLs.

## Where to extend

- **Activities** → add entries to `activityRates` in `app.js`.
- **Tooltips** → add entries to `pipeTooltips` / `containerTooltips` in `tooltips.js`. Anything in `[brackets]` whose key exists in `glossary.js` becomes a nested-tooltip link.
- **Glossary** → add entries to `glossary.js`. Lookups are case-insensitive.
- **Calculations** → `calculate()` in `app.js` is the single source of truth. For v2 (time-stepped simulation), replace its body with a tick function that mutates container state over simulated hours; the renderer doesn’t need to know.
- **Diagram layout** → coordinates and pipe paths live in `diagramLayout` / `pipeDefs` in `diagram.js`. Adjusting a container’s `(x, y, w, h)` automatically resizes its fill and clip path.

## Model notes (v1 simplifications)

- Single-day (acute) totals — no diurnal cycle, no postprandial vs fasting distinction. A deficit beyond the fat (Alpert) cap is bridged by glycogen drawdown before any muscle is catabolised; net stores are only built in an overall energy surplus.
- BMR uses Katch-McArdle (needs body-fat %).
- BMR substrate mix fixed at 60% fat / 40% carb.
- Glycogen capacity ≈ 15 g per kg body weight (whole-body, muscle + liver) — a supercompensated ceiling; typical resting stores are lower. Default fill 50%.
- Muscle mass ≈ 45% of lean body mass.
- MPS demand ≈ 1.6 g protein/kg body weight (Morton 2018 breakpoint). Surplus protein is oxidised; gluconeogenesis from protein only activates when carb demand exceeds intake + glycogen and is capped at half of surplus protein.
- De novo lipogenesis runs only after glycogen saturates; ~25% energy cost.
- Blood glucose is rendered as homeostatic — not editable, default fill 50%.
- Storage Δ is shown both as dry substrate mass (the energy-carrying macronutrient) and wet tissue mass (substrate + bound water ≈ scale weight): glycogen ×4, adipose ÷0.87, muscle ÷0.22.

## v2 directions (not built)

Time-stepped 24-hour simulation, additional containers (amino-acid pool, IMTG, ketones), hormonal overlay (insulin/glucagon/cortisol), more activity types, mobile responsive layout.
