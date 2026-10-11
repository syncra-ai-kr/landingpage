// All landing-page copy lives here so sections stay presentational.

export const site = {
  name: 'Syncra',
  legalName: 'Syncra AI',
  url: 'https://syncra.ai.kr',
  title: 'Syncra AI — Design changes, proven resolved',
  description:
    'Syncra tracks every object across IFC revisions, catches MEP clashes that only look resolved, and hands engineers fixes that already pass the rules.',
  // Form delivery is not wired yet. Set this to a Formspree / Vercel function URL to go live.
  formEndpoint: '',
};

export const nav = [
  { label: 'Problem', href: '#problem' },
  { label: 'Vision', href: '#vision' },
  { label: 'Features', href: '#features' },
];

export const hero = {
  badge: 'Verify plan launches January 2027',
  title: 'Design changes, proven resolved.',
  body: 'Syncra tracks every object across IFC revisions, catches clashes that only look resolved, and hands your engineers fixes that already pass the rules.',
  primary: { label: 'Book a demo', href: '#demo' },
  secondary: { label: 'See features', href: '#features' },
};

export type Verdict = 'ok' | 'bad' | 'warn';

export const problem = {
  label: 'The problem',
  title: 'When “resolved” isn’t resolved.',
  body: 'Clash detectors only check whether a clash shows up again in the current model. If it doesn’t, it’s marked resolved. A clash fixed by a real design change and one that vanished because an object was deleted, re-IDed or reclassified look exactly the same.',
  causes: [
    { cause: 'Design fix', verdict: 'ok' as Verdict, tag: 'Real fix', note: 'Geometry or route changed and the clearance rule passes.' },
    { cause: 'Object deleted', verdict: 'bad' as Verdict, tag: 'False resolved', note: 'The element is gone, so there is nothing left to check.' },
    { cause: 'GlobalId reissued', verdict: 'warn' as Verdict, tag: 'Re-identified', note: 'Syncra re-matches the same object and keeps tracking it.' },
    { cause: 'Reclassified', verdict: 'bad' as Verdict, tag: 'False resolved', note: 'The element drops out of the search set and is silently skipped.' },
  ],
  report: {
    title: 'Clash report',
    scope: 'Rev B → Rev C · L3 mechanical room',
    views: ['Clash detector', 'Syncra re-check'],
    rows: [
      { id: 'CL-0412', pair: 'Duct D-201 ↔ Beam B-12', cause: 'Rerouted +450 mm', verdict: 'ok' as Verdict, tag: 'Real fix' },
      { id: 'CL-0415', pair: 'Pipe P-101 ↔ AHU-1', cause: 'P-101 deleted', verdict: 'bad' as Verdict, tag: 'False resolved' },
      { id: 'CL-0419', pair: 'Tray T-301 ↔ Duct D-204', cause: 'GlobalId reissued → re-identified', verdict: 'warn' as Verdict, tag: 'Still clashing' },
      { id: 'CL-0423', pair: 'Sprinkler SP-88 ↔ Ceiling C-3', cause: 'Reclassified · left search set', verdict: 'bad' as Verdict, tag: 'False resolved' },
      { id: 'CL-0431', pair: 'CHW return ↔ Wall W-3', cause: 'Sleeve added · penetration approved', verdict: 'ok' as Verdict, tag: 'Real fix' },
    ],
  },
  stats: [
    { value: '12.4', unit: '%', text: 'of total cost on industrial projects goes to rework and other quality deviations', source: 'CII' },
    { value: '79', unit: '%', text: 'of those deviation costs start with design changes, errors and omissions', source: 'CII' },
    { value: '68', unit: '%', text: 'of respondents named MEP as the trade where design changes happen most', source: 'Syncra survey' },
    { value: '70–80', unit: '%', text: 'of data center construction cost is electrical and mechanical systems', source: 'Industry estimates' },
  ],
};

export const features = {
  label: 'Features',
  title: 'One change, one closed loop.',
  body: 'Upload a Navisworks clash report and your IFC revisions. The same engine carries every change from detection to a verified resolution.',
  steps: [
    {
      key: 'track',
      title: 'Track every object across revisions',
      body: 'Syncra pairs objects between revisions by IFC GlobalId and re-identification, then classifies why each clash disappeared: a design fix, a deletion, a reissued ID or a reclassification.',
      cmd: ['diff rev-A → rev-B · GlobalId + geometry + ports', 'changed 2 · added 0 · deleted 0'],
      window: 'Change summary · Rev A → Rev B',
    },
    {
      key: 'trace',
      title: 'Trace the ripple across trades',
      body: 'Starting from the change, Syncra follows port connections and spatial proximity to find knock-on issues in mechanical, electrical and plumbing. Where connectivity breaks between trades, a graph neural network estimates how the impact spreads.',
      cmd: ['propagate seeds=AHU-1 hops=2 radius=3 m', 'new issues 2 · disconnected 1 · clash 1'],
      window: 'Impact trace · CR-014',
    },
    {
      key: 'generate',
      title: 'Generate fixes that pass the rules',
      body: 'A diffusion-based generator proposes several routes that respect connectivity and design conditions. Each one is re-checked against clearance, clash, connection and pressure-loss rules in a closed loop, and only passing options survive.',
      cmd: ['plan orthogonal · clearance 75 mm', 'generated 49 · rejected 32 · passing 17'],
      window: 'P-101 reconnection · rule check',
    },
    {
      key: 'prove',
      title: 'Patch the model and prove it',
      body: 'The chosen option is written back as an IFC patch and re-verified by the same engine. Options are compared by scope and quantities, and an engineer makes the final call.',
      cmd: ['what-if 9 variants · each written to IFC', 'tray +200 mm: clear · new issues 0'],
      window: 'AHU-1 ↔ T-301 · alternatives',
    },
  ],
};

export const vision = {
  label: 'Vision',
  title: 'Track every change. Prove every fix.',
  body: 'We start where MEP is densest and every change is expensive, then follow the sites where design changes cost the most.',
  items: [
    { when: 'Now', mode: 'Cloud', title: 'Industrial plants', body: 'New factory builds run by BIM-enabled general contractors. Dense MEP makes every change expensive, and model data is easier to reach than in fabs.', live: true },
    { when: '2027 H2', mode: 'On-prem', title: 'Semiconductor fabs', body: 'One fab holds 1,000+ tools and tens of thousands of connection points, and the design keeps moving until late in construction.', live: false },
    { when: '2028', mode: 'Enterprise', title: 'AI data centers', body: 'Korea plans 18.4 GW of AI data center capacity by 2035. Electrical and mechanical systems are 70–80% of the build cost.', live: false },
    { when: '2029', mode: 'With partners', title: 'Overseas sites', body: 'Design standards and approval history built on domestic projects travel with Korean contractors to their plants abroad.', live: false },
  ],
};

export const demo = {
  label: 'Book a demo',
  title: 'See it on your own revisions.',
  body: 'One recent revision is enough. Send a clash report with the before-and-after IFC models, and we’ll come back with a report that separates real fixes from false ones.',
  interests: [
    { value: 'diagnostic', label: 'Free False Resolved diagnostic' },
    { value: 'pilot', label: 'Site pilot' },
    { value: 'enterprise', label: 'Company-wide rollout' },
  ],
  siteTypes: ['Industrial plant', 'Semiconductor fab', 'Data center', 'Other'],
};

export const footer = {
  tagline: 'Track every change. Prove every fix.',
  events: [
    { name: 'BAU 2027', when: 'Jan' },
    { name: 'SEMICON Korea 2027', when: 'Feb' },
    { name: 'VivaTech 2027', when: 'Jun' },
  ],
  note: 'IFC4 · Navisworks clash report compatible',
};
