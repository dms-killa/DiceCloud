// ============================================================
// "A Friendly" — Ship Library for The Expanse RPG
// For mongosh (raw MongoDB — no Meteor required)
//
// Usage (from HOST machine):
//   docker exec -i dicecloud-db mongosh \
//     "mongodb://localhost:27017/test?replicaSet=rs0" \
//     --file /path/to/this/file.js
//
// Or paste into an interactive mongosh session.
//
// Ship profile:
//   Hull Rating    4  (Weak Hull flaw; small-medium courier)
//   Sensors        5  (Base 3 + Advanced Sensor Package II)
//   Communications 3  (Standard)
//   Handling       3  (Maneuverable + Agile + Improved Acceleration II)
//   Crew Quality   4  (Elite competence)
//   Damage Track   4  (Matches hull)
//
//   Weapons: Torpedo Tube (Aft, 4d6), Point Defense Cannons (Fore, 2d6)
//   LOSS Normal: 6 numbered conditions
//   LOSS Serious: Weapon System Offline, Reactor Offline
//   Quality: Advanced Targeting Systems (+1 accuracy_crew)
// ============================================================

function rid() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var r = '';
  for (var i = 0; i < 17; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

function assignNestedSet(nodes) {
  var byId = {};
  var byParent = {};
  nodes.forEach(function(n) {
    byId[n._id] = n;
    var p = n.parentId || '__ROOT__';
    if (!byParent[p]) byParent[p] = [];
    byParent[p].push(n._id);
  });
  var counter = 0;
  function visit(id) {
    var n = byId[id];
    n.left = ++counter;
    var children = byParent[id] || [];
    children.forEach(visit);
    n.right = ++counter;
  }
  var root = nodes.filter(function(n) { return !n.parentId; })[0];
  visit(root._id);
}

var user = db.users.findOne({}, { _id: 1 });
var ownerId = (user && user._id) ? user._id : 'system';
var now = new Date();

// ============================================================
// Library document
// ============================================================

var libId = rid();

db.libraries.insertOne({
  _id: libId,
  name: 'A Friendly',
  description: 'Ship combat stat block for "A Friendly" — a small, fast courier with an advanced sensor package, torpedo tube, and point defense cannons. Uses the Expanse RPG AGE system.',
  gameSystem: 'expanse-ship',
  owner: ownerId,
  writers: [],
  readers: [],
  public: true,
  createdAt: now,
  updatedAt: now,
});

var nodes = [];

function addNode(id, parentId, data) {
  var n = Object.assign({ _id: id, parentId: parentId || null }, data);
  n.root = { id: libId, collection: 'libraries' };
  n.libraryId = libId;
  n.createdAt = now;
  n.updatedAt = now;
  nodes.push(n);
  return id;
}

// ============================================================
// Root folder
// ============================================================

var rootId = rid();
addNode(rootId, null, {
  type: 'folder',
  name: 'A Friendly',
  libraryTags: ['ship'],
  fillSlots: true,
  description: 'A Friendly — fast courier/light combatant. Fill the ship Ruleset slot with this library.',
});

// ============================================================
// Core Ship Stats
// ============================================================

var statsFolderId = rid();
addNode(statsFolderId, rootId, {
  type: 'folder',
  name: 'Core Ship Stats',
  description: 'Base stats for A Friendly.',
});

[
  { v: 'hull',           n: 'Hull Rating',     c: '4',  d: 'Weak Hull flaw. Damage that exceeds Hull Rating reduces the Damage Track.' },
  { v: 'sensors',        n: 'Sensors',         c: '5',  d: 'Base 3 + Advanced Sensor Package II (+2). Used in targeting, EW, and sensor ops.' },
  { v: 'communications', n: 'Communications',  c: '3',  d: 'Standard communications suite.' },
  { v: 'handling',       n: 'Handling',        c: '3',  d: 'Maneuverable + Agile + Improved Acceleration II. Bonus to pilot Dexterity rolls.' },
  { v: 'crew_quality',   n: 'Crew Quality',    c: '4',  d: 'Elite crew competence. Used for generic crew actions.' },
].forEach(function(s) {
  addNode(rid(), statsFolderId, {
    type: 'attribute',
    attributeType: 'stat',
    variableName: s.v,
    name: s.n,
    baseValue: { calculation: s.c },
    decimal: false,
    description: s.d,
  });
});

// ============================================================
// Damage Track
// ============================================================

addNode(rid(), rootId, {
  type: 'attribute',
  attributeType: 'healthBar',
  variableName: 'damage_track',
  name: 'Damage Track',
  baseValue: { calculation: '4' },
  description: '4-section damage track matching hull size. When all sections are lost, A Friendly is destroyed or adrift.',
});

// ============================================================
// Weapon Systems
// ============================================================

var weaponsFolderId = rid();
addNode(weaponsFolderId, rootId, {
  type: 'folder',
  name: 'Weapon Systems',
  description: 'Ship-mounted weapons. Attack TN = 11 + target Sensors. Rolls use accuracy_crew (set in Crew Stations).',
});

[
  {
    n: 'Torpedo Tube — Aft',
    roll: '3d6 + accuracy_crew',
    dmg: '4d6',
    d: 'Long range. Rear arc. TN = 11 + target Sensors. Can be intercepted by target PDC.\nDamage: 4d6. Subtract target Hull Rating; remainder reduces Damage Track.',
  },
  {
    n: 'Point Defense Cannons — Fore',
    roll: '3d6 + accuracy_crew',
    dmg: '2d6',
    d: 'Close range. Forward arc. TN = 11 + target Sensors. Also used to intercept incoming torpedoes.\nDamage: 2d6. Subtract target Hull Rating; remainder reduces Damage Track.',
  },
].forEach(function(w) {
  var wId = rid();
  addNode(wId, weaponsFolderId, {
    type: 'action',
    name: w.n,
    description: w.d,
  });
  addNode(rid(), wId, {
    type: 'roll',
    name: 'Attack Roll',
    roll: { calculation: w.roll },
    description: 'Meet or beat TN (11 + target Sensors) to hit.',
  });
  addNode(rid(), wId, {
    type: 'damage',
    name: 'Damage',
    amount: { calculation: w.dmg },
    description: 'Subtract target Hull Rating first. Remainder reduces target Damage Track.',
  });
});

// ============================================================
// Crew Stations
// ============================================================

var stationsFolderId = rid();
addNode(stationsFolderId, rootId, {
  type: 'folder',
  name: 'Crew Stations',
  description: 'Set the *_crew bridge stats below to the assigned crew member\'s ability score before combat.\nAll station rolls and weapon attacks update automatically.',
});

// Bridge stats — set these to the crew member's actual ability scores
[
  { v: 'accuracy_crew',      n: 'Gunner: Accuracy',      d: 'Set to the assigned gunner\'s Accuracy score. Used by weapon attack rolls and effects.' },
  { v: 'dexterity_crew',     n: 'Pilot: Dexterity',      d: 'Set to the assigned pilot\'s Dexterity score. Used by the Pilot station roll.' },
  { v: 'intelligence_crew',  n: 'Sensor/Engineer: Int',  d: 'Set to the sensor ops / engineer crew member\'s Intelligence score.' },
  { v: 'communication_crew', n: 'Commander: Communication', d: 'Set to the commander\'s Communication score.' },
].forEach(function(b) {
  addNode(rid(), stationsFolderId, {
    type: 'attribute',
    attributeType: 'stat',
    variableName: b.v,
    name: b.n,
    baseValue: { calculation: '0' },
    decimal: false,
    description: b.d,
  });
});

// Station roll actions (same pattern as generic ship template)
[
  { n: 'Pilot',      roll: '3d6 + dexterity_crew + handling',     d: 'Maneuver, evasion, docking. Dexterity (Piloting focus ideal).' },
  { n: 'Gunner',     roll: '3d6 + accuracy_crew',                 d: 'Attack. Accuracy (Gunnery focus ideal).' },
  { n: 'Sensor Ops', roll: '3d6 + intelligence_crew + sensors',   d: 'Electronic warfare, targeting assist, counter-EW. Intelligence.' },
  { n: 'Engineer',   roll: '3d6 + intelligence_crew',             d: 'Damage control, thrust adjustments. Intelligence (Engineering focus ideal).' },
  { n: 'Commander',  roll: '3d6 + communication_crew',            d: 'Inspire crew (+1 to all rolls for 1 round). Communication.' },
].forEach(function(s) {
  var stId = rid();
  addNode(stId, stationsFolderId, {
    type: 'action',
    name: s.n,
    description: s.d,
  });
  addNode(rid(), stId, {
    type: 'roll',
    name: 'Station Roll',
    roll: { calculation: s.roll },
    description: 'Replace *_crew stats (above) with the crew member\'s actual ability scores before rolling.',
  });
});

// ============================================================
// NORMAL LOSS Conditions (d6 table — 6 numbered toggles)
// ============================================================

var normalLossFolderId = rid();
addNode(normalLossFolderId, rootId, {
  type: 'folder',
  name: 'NORMAL LOSS Conditions',
  description: 'Roll d6 when the ship takes a Normal Loss. Activate the matching condition.\nToggle off when repaired (Engineer TN 13 success or 1 hour docked).',
});

[
  {
    n: 'LOSS 1: Weapons Damaged',
    d: 'Weapons systems partially offline. Gunner accuracy reduced.',
    effects: [{ op: 'add', amount: '-2', stats: ['accuracy_crew'], name: 'Weapons Damaged: accuracy_crew -2' }],
  },
  {
    n: 'LOSS 2: Sensors Damaged',
    d: 'Sensor array hit. Targeting and EW capability reduced.',
    effects: [{ op: 'add', amount: '-2', stats: ['sensors'], name: 'Sensors Damaged: sensors -2' }],
  },
  {
    n: 'LOSS 3: Maneuverability Impaired',
    d: 'Thruster or control surface damage. Ship harder to pilot.',
    effects: [{ op: 'add', amount: '-2', stats: ['handling'], name: 'Maneuverability Impaired: handling -2' }],
  },
  {
    n: 'LOSS 4: Hull Breached',
    d: 'Structural breach. Crew must wear vac suits or take damage. Track atmospheric integrity manually.',
    effects: [],
  },
  {
    n: 'LOSS 5: Collateral Damage',
    d: 'Internal systems damaged — power conduits, cargo, life support auxiliary. GM determines specifics.',
    effects: [],
  },
  {
    n: 'LOSS 6: Crew Injury',
    d: 'A crew station takes the hit. GM assigns 1d6 penetrating damage to a crew member at a station.',
    effects: [],
  },
].forEach(function(l) {
  var tId = rid();
  addNode(tId, normalLossFolderId, {
    type: 'toggle',
    name: l.n,
    enabled: false,
    description: l.d,
  });
  l.effects.forEach(function(e) {
    addNode(rid(), tId, {
      type: 'effect',
      name: e.name,
      operation: e.op,
      amount: { calculation: e.amount },
      stats: e.stats,
    });
  });
});

// ============================================================
// SERIOUS LOSS Conditions (2 named toggles)
// ============================================================

var seriousLossFolderId = rid();
addNode(seriousLossFolderId, rootId, {
  type: 'folder',
  name: 'SERIOUS LOSS Conditions',
  description: 'Activate when the ship takes a Serious Loss result. These represent major system failures.\nRequire significant repair (Engineer TN 15, extended time, or port facilities).',
});

// Weapon System Offline: set accuracy_crew to 0
var weaponOfflineId = rid();
addNode(weaponOfflineId, seriousLossFolderId, {
  type: 'toggle',
  name: 'SERIOUS: Weapon System Offline',
  enabled: false,
  description: 'All weapon systems offline. No attacks possible until repaired.',
});
addNode(rid(), weaponOfflineId, {
  type: 'effect',
  name: 'Weapon System Offline: accuracy_crew = 0',
  operation: 'set',
  amount: { calculation: '0' },
  stats: ['accuracy_crew'],
});

// Reactor Offline: -2 to sensors, handling, communications
var reactorOfflineId = rid();
addNode(reactorOfflineId, seriousLossFolderId, {
  type: 'toggle',
  name: 'SERIOUS: Reactor Offline',
  enabled: false,
  description: 'Main reactor offline. All powered systems impaired. Ship on emergency battery power.',
});
[
  { stats: ['sensors'],        name: 'Reactor Offline: sensors -2' },
  { stats: ['handling'],       name: 'Reactor Offline: handling -2' },
  { stats: ['communications'], name: 'Reactor Offline: communications -2' },
].forEach(function(e) {
  addNode(rid(), reactorOfflineId, {
    type: 'effect',
    name: e.name,
    operation: 'add',
    amount: { calculation: '-2' },
    stats: e.stats,
  });
});

// ============================================================
// Ship Qualities
// ============================================================

var qualitiesFolderId = rid();
addNode(qualitiesFolderId, rootId, {
  type: 'folder',
  name: 'Ship Qualities',
  description: 'Permanent qualities and flaws. Advanced Targeting Systems is an active toggle.',
});

// Advanced Targeting Systems: +1 accuracy_crew
var atsId = rid();
addNode(atsId, qualitiesFolderId, {
  type: 'toggle',
  name: 'Advanced Targeting Systems',
  enabled: true,
  description: 'Integrated targeting computer assists the gunner. +1 to accuracy-based rolls (EW tests, attack rolls).',
});
addNode(rid(), atsId, {
  type: 'effect',
  name: 'Advanced Targeting: accuracy_crew +1',
  operation: 'add',
  amount: { calculation: '1' },
  stats: ['accuracy_crew'],
});

// Reference note for remaining qualities/flaws
addNode(rid(), qualitiesFolderId, {
  type: 'note',
  name: 'Qualities & Flaws Reference',
  description: [
    'QUALITIES (always active — encoded in base stats):',
    '  Advanced Sensor Package II: +2 Sensors (reflected in Sensors = 5)',
    '  Maneuverable: contributes to Handling 3',
    '  Agile: contributes to Handling 3',
    '  Improved Acceleration II: contributes to Handling 3',
    '  Atmosphere Capable: can operate in planetary atmosphere',
    '  Stealth: low radar/thermal signature (narrative; no stat modifier)',
    '',
    'FLAWS (narrative — no additional mechanic beyond encoded stats):',
    '  Weak Hull: reflected in Hull Rating 4 (below typical for ship size)',
    '  High Maintenance: requires frequent servicing; GM may impose repair costs',
    '',
    'For Advanced Targeting Systems toggle above: enabled by default (+1 accuracy_crew).',
    'Disable it if the targeting computer is damaged (treat as a LOSS result).',
  ].join('\n'),
});

// ============================================================
// Ship Description
// ============================================================

addNode(rid(), rootId, {
  type: 'note',
  name: 'A Friendly — Ship Description',
  description: [
    '"A Friendly" is a small, fast courier operating in the Belt and inner planets.',
    'She prioritizes speed and sensors over raw firepower, making her effective at',
    'intelligence gathering, quick strikes, and running from larger combatants.',
    '',
    'Hull class: Light courier / armed transport',
    'Crew complement: 3–6',
    '',
    'Stat summary:',
    '  Hull Rating    4   (absorbs 4 pts of damage per hit before Damage Track)',
    '  Sensors        5   (elite detection; Advanced Sensor Package II)',
    '  Communications 3   (standard)',
    '  Handling       3   (fast; maneuverable)',
    '  Crew Quality   4   (elite)',
    '  Damage Track   4   (4 hits before destruction)',
    '',
    'Combat notes:',
    '  Torpedo Tube (Aft): Long range, 4d6 damage',
    '  PDC (Fore):         Close range, 2d6 damage / torpedo intercept',
    '  Attack TN = 11 + target Sensors',
    '  Set accuracy_crew in Crew Stations to the gunner\'s Accuracy before combat.',
  ].join('\n'),
});

// ============================================================
// Finalize
// ============================================================

assignNestedSet(nodes);
db.libraryNodes.insertMany(nodes);

print('');
print('A Friendly ship library created');
print('  Library ID    : ' + libId);
print('  Nodes inserted: ' + nodes.length);
print('');
print('To use:');
print('  1. Add this library ID to DEFAULT_LIBRARIES (or subscribe in-app)');
print('  2. Create an NPC creature in DiceCloud');
print('  3. Go to the Build tab and fill the Ship slot from "A Friendly"');
print('  4. Set accuracy_crew / dexterity_crew etc. to the assigned crew scores');
print('');
