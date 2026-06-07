/* Tooltip content for pipes, containers, sources, and sinks.
   Square-bracketed terms become dotted-underlined glossary links. */

const pipeTooltips = {
  'carbs-to-bg': {
    title: 'Digestion and absorption',
    body: 'Dietary carbohydrates are hydrolysed to monosaccharides — primarily glucose, with some fructose and galactose — by salivary and pancreatic amylase and brush-border enzymes. They are absorbed across the small intestinal epithelium via [SGLT1] and [GLUT2] transporters into the portal circulation, where they appear as blood glucose.'
  },
  'bg-to-glycogen': {
    title: 'Glycogenesis',
    body: 'When blood glucose rises postprandially, [insulin] signals via [GLUT4] translocation and activates glycogen synthase, which polymerises glucose units into branched glycogen chains. Stored primarily in skeletal muscle (~600 g in a trained adult) and the liver (~100 g).'
  },
  'glycogen-to-bg': {
    title: 'Glycogenolysis',
    body: 'When blood glucose falls or energy demand rises, [glucagon] and [catecholamines] activate glycogen phosphorylase, cleaving glucose-1-phosphate from the glycogen polymer. Liver glycogen feeds systemic blood glucose; muscle glycogen is used locally and cannot leave the myocyte.'
  },
  'bg-to-fat': {
    title: 'De novo lipogenesis',
    body: 'When glycogen stores are saturated and excess carbohydrate continues to arrive, glucose is converted to pyruvate, then to [acetyl-CoA], to malonyl-CoA, and ultimately to palmitate via fatty acid synthase. The pathway is energetically expensive — about 25% of the carbohydrate calories are lost as heat.'
  },
  'bg-to-demand': {
    title: 'Glucose oxidation',
    body: 'Blood glucose is taken up by working tissues — by the brain and red blood cells obligately, by muscle via [GLUT4] when [insulin] is present. Glycolysis converts glucose to pyruvate; pyruvate enters mitochondria, is decarboxylated to [acetyl-CoA], and is oxidised in the [TCA cycle].'
  },
  'fat-in-to-fattissue': {
    title: 'Dietary fat storage',
    body: 'Dietary triglycerides are packaged into chylomicrons in the small intestine and delivered via the lymphatic system to the bloodstream. Lipoprotein lipase at the adipocyte capillary surface hydrolyses them; the released fatty acids are taken up by adipocytes and re-esterified into stored triglycerides.'
  },
  'fat-in-to-demand': {
    title: 'Dietary fat oxidation',
    body: 'Fatty acids — delivered from chylomicrons or as albumin-bound free fatty acids — can be taken up directly by oxidative tissues such as heart and skeletal muscle, enter mitochondria via the [carnitine shuttle], and undergo [β-oxidation] to [acetyl-CoA].'
  },
  'fattissue-to-demand': {
    title: 'Lipolysis and β-oxidation',
    body: '[Hormone-sensitive lipase], activated by low [insulin] and elevated [catecholamines], hydrolyses stored triglycerides into glycerol and free fatty acids. The fatty acids travel albumin-bound through plasma, enter mitochondria via the [carnitine shuttle], and undergo [β-oxidation], generating [acetyl-CoA] for the [TCA cycle].'
  },
  'protein-to-demand': {
    title: 'Amino acid oxidation',
    body: 'Once [muscle protein synthesis] demand is met, surplus amino acids are deaminated. Their carbon skeletons enter the [TCA cycle] as α-ketoacids — α-ketoglutarate, oxaloacetate, pyruvate, and others. Nitrogen is detoxified through the urea cycle and excreted as urea.'
  },
  'protein-to-bg': {
    title: 'Gluconeogenesis (dietary protein)',
    body: 'Under low-carbohydrate conditions, glucogenic amino acids — alanine and glutamine, principally — are converted to glucose in the liver. This is essentially reverse glycolysis, using four bypass enzymes: pyruvate carboxylase, PEPCK, fructose-1,6-bisphosphatase, and glucose-6-phosphatase. The pathway is demand-driven, not supply-driven.'
  },
  'protein-to-muscle': {
    title: 'Muscle protein synthesis',
    body: 'Net muscle gain via [muscle protein synthesis]. mTORC1 — activated by leucine and resistance training — drives assembly of new contractile protein. Requires three things together: resistance training, dietary protein above the maintenance threshold (~1.6 g per kg lean mass), and an energy surplus. Even under ideal conditions the body can build at most ~0.5–1 kg of muscle per month — only a few grams of protein laid down per day, far less than the daily protein you eat.'
  },
  'muscle-to-demand': {
    title: 'Muscle protein breakdown → energy',
    body: 'When dietary protein can’t cover the amino acids oxidised during exercise — or when the energy deficit outruns the maximum rate fat can be mobilised (~69 kcal per kg of fat per day) — muscle protein is broken down for fuel. Amino acids are deaminated and their carbon skeletons feed the [TCA cycle]; nitrogen is excreted as urea. This is why very lean people, or anyone training hard while underfed, lose muscle.'
  },
  'muscle-to-bg': {
    title: 'Muscle catabolism → gluconeogenesis',
    body: 'When glycogen is depleted and dietary protein is insufficient to support [gluconeogenesis], the body breaks down muscle protein. Alanine and glutamine — the dominant glucogenic amino acids from muscle — are released to the liver and kidneys, deaminated, and converted to glucose. This is the body’s last-resort substrate for maintaining blood glucose during prolonged fasting or carbohydrate restriction.'
  }
};

const containerTooltips = {
  bg: {
    title: 'Blood glucose',
    body: 'A small (~5 g) circulating pool, tightly homeostatic between roughly 4 and 7 mmol/L. Continuously refilled by [glycogenolysis] and [gluconeogenesis] from the liver, and drained by tissue uptake — especially brain and red blood cells, which are obligate glucose users.'
  },
  glycogen: {
    title: 'Glycogen',
    body: 'Branched polymer of glucose, stored ~80% in muscle and ~20% in liver. Whole-body capacity is roughly 15 g per kg of body weight (about 1,100 g for a 75 kg person). [Glycogenesis] fills this store only up to that ceiling — once full, surplus carbohydrate is diverted to [de novo lipogenesis] and stored as fat instead. The bar shows the level your current carb intake drives toward: high carb fills it to the cap, low carb drains it. Muscle glycogen fuels local contraction; liver glycogen exports glucose to keep blood sugar steady between meals.'
  },
  fat: {
    title: 'Fat tissue (adipose)',
    body: 'Triglycerides stored in adipocytes. Effectively unlimited capacity. The principal source of [β-oxidation] substrate during fasting, prolonged exercise, or carbohydrate restriction. Energy density is roughly 7,700 kcal per kilogram of tissue.'
  },
  muscle: {
    title: 'Muscle tissue',
    body: 'Skeletal muscle protein, the body’s largest amino-acid reservoir. Continuously turned over by [muscle protein synthesis] (deposit) and breakdown (release). About 22% of wet mass is protein, giving ~880 kcal/kg of energy if fully catabolised. Under prolonged caloric or carbohydrate restriction, muscle protein is broken down to supply glucogenic amino acids for [gluconeogenesis].'
  }
};

const sourceTooltips = {
  protein: {
    title: 'Dietary protein',
    body: 'Amino acids absorbed from digested protein. Used preferentially for [muscle protein synthesis] and other anabolic and structural needs. Surplus is oxidised; the body has no dedicated amino-acid storage compartment.'
  },
  carbs: {
    title: 'Dietary carbohydrate',
    body: 'Starches and sugars from food. Digested to monosaccharides — mainly glucose. Becomes blood glucose, then either oxidised, stored as glycogen, or converted to fat via [de novo lipogenesis].'
  },
  fat: {
    title: 'Dietary fat',
    body: 'Triglycerides from food. Packaged into chylomicrons and delivered to tissues. Stored when in surplus, oxidised when energy is needed.'
  }
};

const sinkTooltips = {
  bmr: {
    title: 'Basal metabolic rate',
    body: 'Energy needed for cellular maintenance, organ function, ion gradients, and resting body temperature. The largest single component of daily energy expenditure for most sedentary people. Calculated here with the Katch-McArdle equation, which uses lean body mass.'
  },
  activity: {
    title: 'Activity energy',
    body: 'Calories burned by skeletal muscle contraction during physical activity. The substrate mix depends on intensity: low intensity favours fat oxidation, high intensity favours carbohydrate.'
  }
};

function termsToHtml(text) {
  return text.replace(/\[([^\]]+)\]/g, (m, term) => {
    const key = term.toLowerCase();
    if (glossary[key]) {
      return `<span class="term" data-term="${key}">${term}</span>`;
    }
    return term;
  });
}

function buildTooltipHtml(t, extra) {
  let html = `<h3>${t.title}</h3><div>${termsToHtml(t.body)}</div>`;
  if (extra) html += `<div style="margin-top:10px; padding-top:8px; border-top:1px solid #4a4338; font-family:'Inter',sans-serif; font-size:11px; color:#c8b89c;">${extra}</div>`;
  return html;
}
