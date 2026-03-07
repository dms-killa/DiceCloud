// ============================================================
// The Expanse RPG — Ship Library + Rocinante Sample
// For mongosh (raw MongoDB — no Meteor required)
//
// Usage (from HOST machine):
//   docker exec -i dicecloud-db mongosh \
//     "mongodb://localhost:27017/test?replicaSet=rs0" \
//     --file /path/to/this/file.js
//
// Or paste into an interactive mongosh session.
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
// PART 1: Ship Library
// ============================================================

var shipLibId = rid();

db.libraries.insertOne({
  _id: shipLibId,
  name: 'The Expanse RPG — Ship',
  description: 'Ship combat stat block for The Expanse RPG. Create a ship as a separate creature and fill its Ruleset slot with this library.',
  gameSystem: 'expanse-ship',
  owner: ownerId,
  writers: [],
  readers: [],
  public: true,
  createdAt: now,
  updatedAt: now,
});

var shipNodes = [];

function shipNode(id, parentId, data) {
  var n = Object.assign({ _id: id, parentId: parentId || null }, data);
  n.root = { id: shipLibId, collection: 'libraries' };
  n.libraryId = shipLibId;
  n.createdAt = now;
  n.updatedAt = now;
  shipNodes.push(n);
  return id;
}

// Root
var shipRootId = rid();
shipNode(shipRootId, null, {
  type: 'folder',
  name: 'Ship Stat Block',
  libraryTags: ['base'],
  fillSlots: true,
  description: 'Expanse RPG ship stats. Add this to an "expanse-ship" creature.',
});

// ── Core Ship Stats ───────────────────────────────────────────
[
  { v: 'hull',          n: 'Hull Rating',     c: '10', d: 'Set to midpoint of your hull dice (e.g. 10 for 3d6+7). Absorbed from incoming damage before Damage Track.' },
  { v: 'sensors',       n: 'Sensors',         c: '3',  d: 'Used in sensor ops, targeting lock, countermeasures. Reduced when Sensors Loss condition is active.' },
  { v: 'communications',n: 'Communications',  c: '3',  d: 'Used for comms operations and electronic warfare.' },
  { v: 'handling',      n: 'Handling',        c: '0',  d: 'Bonus/penalty to crew Dexterity rolls while piloting. Range: -3 (freighter) to +3 (corvette).' },
  { v: 'crew_quality',  n: 'Crew Quality',    c: '1',  d: 'Average crew skill rating. Used when a generic crew action is needed.' },
].forEach(function(s) {
  shipNode(rid(), shipRootId, {
    type: 'attribute',
    attributeType: 'stat',
    variableName: s.v,
    name: s.n,
    baseValue: { calculation: s.c },
    decimal: false,
    description: s.d,
  });
});

// ── Damage Track (health bar) ─────────────────────────────────
shipNode(rid(), shipRootId, {
  type: 'attribute',
  attributeType: 'healthBar',
  variableName: 'damage_track',
  name: 'Damage Track',
  baseValue: { calculation: '5' },
  description: 'Hull damage track (default 5 sections). When all sections lost, ship is destroyed or adrift.\nEach section = roughly one damaging hit that exceeds Hull Rating.',
});

// ── Weapon Systems ────────────────────────────────────────────
var weaponsFolderId = rid();
shipNode(weaponsFolderId, shipRootId, {
  type: 'folder',
  name: 'Weapon Systems',
  description: 'Ship-mounted weapons. Attack TN = 11 + target\'s Sensors.',
});

[
  {
    v: 'pdc_attack', n: 'PDC (Point Defense)',
    roll: '3d6 + accuracy',
    dmg: '1d6',
    d: 'Short range. TN = 11 + target Sensors. Used to intercept torpedoes or attack close vessels.\nDamage: 1d6 vs. Hull Rating.'
  },
  {
    v: 'torpedo_attack', n: 'Torpedo',
    roll: '3d6 + accuracy',
    dmg: '3d6 + 5',
    d: 'Long range. TN = 11 + target Sensors. Can be intercepted by PDC.\nDamage: 3d6+5 vs. Hull Rating.'
  },
  {
    v: 'railgun_attack', n: 'Rail Gun',
    roll: '3d6 + accuracy',
    dmg: '4d6',
    d: 'Extreme range kinetic weapon. TN = 11 + target Sensors.\nDamage: 4d6 — ignores first 3 points of Hull Rating.',
  },
].forEach(function(w) {
  var wActionId = rid();
  shipNode(wActionId, weaponsFolderId, {
    type: 'action',
    name: w.n + ' Attack',
    description: w.d,
  });
  shipNode(rid(), wActionId, {
    type: 'roll',
    name: 'Attack Roll',
    roll: { calculation: w.roll },
    description: 'Meet or beat TN (11 + target Sensors) to hit.',
  });
  shipNode(rid(), wActionId, {
    type: 'damage',
    name: 'Damage',
    amount: { calculation: w.dmg },
    description: 'Subtract Hull Rating first. Remainder reduces Damage Track.',
  });
});

// ── Crew Stations ─────────────────────────────────────────────
var stationsFolderId = rid();
shipNode(stationsFolderId, shipRootId, {
  type: 'folder',
  name: 'Crew Stations',
  description: 'Each station uses the assigned crew member\'s ability + handling bonus.\nThese roll helpers use crew_quality as a placeholder — replace with the actual crew character\'s ability score.',
});

[
  { n: 'Pilot',         roll: '3d6 + dexterity_crew + handling', d: 'Used for maneuver, evasion, docking. Dexterity (Piloting focus ideal).' },
  { n: 'Gunner',        roll: '3d6 + accuracy_crew',             d: 'Used to attack. Accuracy (Gunnery focus ideal).' },
  { n: 'Sensor Ops',    roll: '3d6 + intelligence_crew + sensors',d: 'Electronic warfare, targeting assist, counter-EW. Intelligence.' },
  { n: 'Engineer',      roll: '3d6 + intelligence_crew',          d: 'Damage control, thrust adjustments. Intelligence (Engineering focus ideal).' },
  { n: 'Commander',     roll: '3d6 + communication_crew',         d: 'Inspire crew (+1 to all rolls for 1 round). Communication.' },
].forEach(function(s) {
  var stId = rid();
  shipNode(stId, stationsFolderId, {
    type: 'action',
    name: s.n,
    description: s.d,
  });
  shipNode(rid(), stId, {
    type: 'roll',
    name: 'Station Roll',
    roll: { calculation: s.roll },
    description: 'Replace *_crew variables with actual crew member stats.',
  });
});

// ── LOSS Conditions ───────────────────────────────────────────
var lossFolderId = rid();
shipNode(lossFolderId, shipRootId, {
  type: 'folder',
  name: 'LOSS Conditions',
  description: 'Activate when the ship takes critical damage. Each condition reduces ship capability.\nToggle on when the ship takes the relevant hit; toggle off when repaired.',
});

var lossDefs = [
  {
    n: 'LOSS: Sensors Damaged',
    d: 'Sensors reduced by 2. Affects all sensor ops and attack TNs.',
    effects: [{ op: 'add', amount: '-2', stats: ['sensors'], name: 'Sensors: -2' }],
  },
  {
    n: 'LOSS: Comms Damaged',
    d: 'Communications reduced by 2. May lose contact with crew or fleet.',
    effects: [{ op: 'add', amount: '-2', stats: ['communications'], name: 'Comms: -2' }],
  },
  {
    n: 'LOSS: Drive Damaged',
    d: 'Handling reduced by 2. Reduced thrust and maneuverability.',
    effects: [{ op: 'add', amount: '-2', stats: ['handling'], name: 'Handling: -2' }],
  },
  {
    n: 'LOSS: Drive Destroyed',
    d: 'Handling reduced by 4. Ship nearly unable to maneuver.',
    effects: [{ op: 'add', amount: '-4', stats: ['handling'], name: 'Handling: -4' }],
  },
  {
    n: 'LOSS: Hull Breached',
    d: 'Crew must wear vac suits or take damage. Automatic depressurization risk. Track manually.',
    effects: [],
  },
  {
    n: 'LOSS: Power Fluctuation',
    d: 'All electronic systems impaired. Sensors -1, Comms -1.',
    effects: [
      { op: 'add', amount: '-1', stats: ['sensors'],        name: 'Power: Sensors -1' },
      { op: 'add', amount: '-1', stats: ['communications'], name: 'Power: Comms -1' },
    ],
  },
];

lossDefs.forEach(function(l) {
  var toggleId = rid();
  shipNode(toggleId, lossFolderId, {
    type: 'toggle',
    name: l.n,
    enabled: false,
    description: l.d,
  });
  l.effects.forEach(function(e) {
    shipNode(rid(), toggleId, {
      type: 'effect',
      name: e.name,
      operation: e.op,
      amount: { calculation: e.amount },
      stats: e.stats,
    });
  });
});

// ── Ship Combat Round Reference ───────────────────────────────
shipNode(rid(), shipRootId, {
  type: 'note',
  name: '7-Phase Combat Round',
  description: [
    'Phase 1 — SENSORS: Sensor ops crew rolls Intelligence + Sensors vs. TN 11.',
    '  Success: +1 die advantage on one attack this round (pick highest 2 of 3d6).',
    '',
    'Phase 2 — ELECTRONIC WARFARE: Opposed sensor rolls. Winner gains initiative modifier.',
    '',
    'Phase 3 — INITIATIVE: Commander rolls Communication. All ships order by result.',
    '',
    'Phase 4 — MOVEMENT: Pilot rolls Dexterity + Handling.',
    '  Sets range band and evasion posture for the round.',
    '',
    'Phase 5 — COMBAT ACTIONS: Each station takes one action in initiative order.',
    '  Attack: roll 3d6 + Accuracy vs. TN (11 + target Sensors).',
    '  Damage: roll weapon damage, subtract target Hull Rating, reduce Damage Track.',
    '  Torpedo: can be intercepted by target PDC roll (TN = attacker\'s roll result).',
    '',
    'Phase 6 — DAMAGE CONTROL: Engineer rolls Intelligence (Engineering) TN 13.',
    '  Success: clear one LOSS condition or recover 1 Damage Track section.',
    '',
    'Phase 7 — MORALE/COMMAND: Commander can inspire crew (+1 to all station rolls next round).',
  ].join('\n'),
});

assignNestedSet(shipNodes);
db.libraryNodes.insertMany(shipNodes);

print('');
print('✓ Ship library created');
print('  Library ID : ' + shipLibId);
print('  Nodes inserted: ' + shipNodes.length);

// ============================================================
// PART 2: Rocinante Sample Ship (as a Creature)
// ============================================================

var rocId = rid();

// Create the creature
db.creatures.insertOne({
  _id: rocId,
  name: 'Rocinante',
  gameSystem: 'expanse-ship',
  type: 'pc',
  owner: ownerId,
  writers: [],
  readers: [],
  public: true,
  settings: {
    hideSpellcasting: true,
    hideRestButtons: true,
    hideSpellsTab: true,
  },
  denormalizedStats: {
    characterCount: 0,
    xp: 0,
  },
  createdAt: now,
  updatedAt: now,
});

// Build Rocinante properties directly
var rocProps = [];
var propCounter = 0;

function rocProp(id, parentId, data) {
  var n = Object.assign({ _id: id, parentId: parentId || null }, data);
  n.root = { id: rocId, collection: 'creatures' };
  n.creatureId = rocId;
  n.createdAt = now;
  n.updatedAt = now;
  n.inactive = false;
  n.removed = false;
  rocProps.push(n);
  return id;
}

// Stats folder (no slot — direct properties)
var statsFolderId = rid();
rocProp(statsFolderId, null, { type: 'folder', name: 'Ship Stats' });

[
  { v: 'hull',          n: 'Hull Rating',     c: '10', d: 'MCRN Corvette class. Midpoint of 3d6+7.' },
  { v: 'sensors',       n: 'Sensors',         c: '4',  d: 'Military-grade sensor suite.' },
  { v: 'communications',n: 'Communications',  c: '3',  d: 'Standard military comms.' },
  { v: 'handling',      n: 'Handling',        c: '2',  d: 'Fast and maneuverable for her class.' },
  { v: 'crew_quality',  n: 'Crew Quality',    c: '2',  d: 'Experienced but unconventional crew.' },
].forEach(function(s) {
  rocProp(rid(), statsFolderId, {
    type: 'attribute',
    attributeType: 'stat',
    variableName: s.v,
    name: s.n,
    baseValue: { calculation: s.c },
    decimal: false,
    description: s.d,
  });
});

// Damage Track
rocProp(rid(), statsFolderId, {
  type: 'attribute',
  attributeType: 'healthBar',
  variableName: 'damage_track',
  name: 'Damage Track',
  baseValue: { calculation: '5' },
  description: '5-section damage track. When all sections are lost, the Roci is destroyed.',
});

// Weapons folder
var rocWeaponsFolderId = rid();
rocProp(rocWeaponsFolderId, null, { type: 'folder', name: 'Weapon Systems' });

[
  { n: 'PDC Turrets',    roll: '3d6 + 4',      dmg: '1d6',   d: 'Point defense and close-in attacks. Accuracy 4 (Holden\'s crew average).' },
  { n: 'Torpedo (Morrigan)', roll: '3d6 + 4',  dmg: '3d6 + 5', d: 'Long-range torpedo tubes. Morrigan class torps. Can be intercepted.' },
  { n: 'Rail Gun',       roll: '3d6 + 4',      dmg: '4d6',   d: 'Magnetic railgun. Ignores first 3 points of Hull Rating.' },
].forEach(function(w) {
  var wId = rid();
  rocProp(wId, rocWeaponsFolderId, { type: 'action', name: w.n, description: w.d });
  rocProp(rid(), wId, { type: 'roll',   name: 'Attack Roll', roll:   { calculation: w.roll }, description: 'TN = 11 + target Sensors' });
  rocProp(rid(), wId, { type: 'damage', name: 'Damage',      amount: { calculation: w.dmg  }, description: 'Subtract target Hull Rating first' });
});

// LOSS conditions folder
var rocLossFolderId = rid();
rocProp(rocLossFolderId, null, { type: 'folder', name: 'LOSS Conditions' });

var rocLossDefs = [
  {
    n: 'LOSS: Sensors Damaged',
    d: 'Sensors -2',
    effects: [{ op: 'add', amount: '-2', stats: ['sensors'] }],
  },
  {
    n: 'LOSS: Comms Damaged',
    d: 'Communications -2',
    effects: [{ op: 'add', amount: '-2', stats: ['communications'] }],
  },
  {
    n: 'LOSS: Drive Damaged',
    d: 'Handling -2',
    effects: [{ op: 'add', amount: '-2', stats: ['handling'] }],
  },
  {
    n: 'LOSS: Hull Breached',
    d: 'Crew must be in vac suits. Track manually.',
    effects: [],
  },
];

rocLossDefs.forEach(function(l) {
  var tId = rid();
  rocProp(tId, rocLossFolderId, { type: 'toggle', name: l.n, enabled: false, description: l.d });
  l.effects.forEach(function(e) {
    rocProp(rid(), tId, {
      type: 'effect',
      name: l.n + ' effect',
      operation: e.op,
      amount: { calculation: e.amount },
      stats: e.stats,
    });
  });
});

// Crew stations folder
var rocStationsFolderId = rid();
rocProp(rocStationsFolderId, null, { type: 'folder', name: 'Crew Stations (Holden\'s Crew)' });

[
  { n: 'Holden — Command',   roll: '3d6 + 3', d: 'Communication 3. Leadership and morale.' },
  { n: 'Naomi — Engineering',roll: '3d6 + 4', d: 'Intelligence 4. Damage control, thrust calculations.' },
  { n: 'Alex — Pilot',       roll: '3d6 + 4 + handling', d: 'Dexterity 4. Piloting + ship Handling (2) = 3d6+6 effective.' },
  { n: 'Amos — Gunnery',     roll: '3d6 + 4', d: 'Accuracy 4. PDC and rail gun targeting.' },
  { n: 'Bobbie — Marines/EVA',roll: '3d6 + 4', d: 'Fighting 4. Boarding actions, EVA ops.' },
].forEach(function(s) {
  var sId = rid();
  rocProp(sId, rocStationsFolderId, { type: 'action', name: s.n, description: s.d });
  rocProp(rid(), sId, { type: 'roll', name: 'Roll', roll: { calculation: s.roll } });
});

assignNestedSet(rocProps);

// Mark creature as needing recomputation
db.creatures.updateOne({ _id: rocId }, { $set: { dirty: true } });

db.creatureProperties.insertMany(rocProps);

print('');
print('✓ Rocinante sample ship created');
print('  Creature ID: ' + rocId);
print('  Properties:  ' + rocProps.length);
print('');
print('All done! Summary:');
print('  Ship library ID : ' + shipLibId);
print('  Rocinante ID    : ' + rocId);
print('');
print('To find the Rocinante in the UI, look under "Characters" or search by name.');
print('The ship is set public=true so any logged-in user can view it.');
