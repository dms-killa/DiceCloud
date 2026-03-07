// ============================================================
// The Expanse RPG — Character Library Insert Script
// For mongosh (raw MongoDB — no Meteor required)
//
// Usage (from HOST machine, not inside container):
//   docker exec -i dicecloud-db mongosh \
//     "mongodb://localhost:27017/test?replicaSet=rs0" \
//     --file /path/to/this/file.js
//
// Or paste into an interactive mongosh session.
// ============================================================

// --- Helpers -------------------------------------------------

function rid() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let r = '';
  for (let i = 0; i < 17; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

function assignNestedSet(nodes) {
  const byId = {};
  const byParent = {};
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

// --- Owner ---------------------------------------------------

var user = db.users.findOne({}, { _id: 1 });
var ownerId = (user && user._id) ? user._id : 'system';
var now = new Date();

// --- Library document ----------------------------------------

var libId = rid();

db.libraries.insertOne({
  _id: libId,
  name: 'The Expanse RPG — AGE System',
  description: 'Core ruleset for The Expanse RPG (Adventure Game Engine). Abilities, derived stats, Fortune, focuses, and conditions.',
  gameSystem: 'expanse',
  owner: ownerId,
  writers: [],
  readers: [],
  public: true,
  createdAt: now,
  updatedAt: now,
});

// --- Build node tree -----------------------------------------

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

// Root — fills the character's "Ruleset" base slot
var rootId = rid();
addNode(rootId, null, {
  type: 'folder',
  name: 'The Expanse Ruleset',
  libraryTags: ['base'],
  fillSlots: true,
  description: 'Base ruleset for The Expanse RPG. Fill a character\'s Ruleset slot with this.',
});

// Level
addNode(rid(), rootId, {
  type: 'attribute',
  attributeType: 'stat',
  variableName: 'level',
  name: 'Level',
  baseValue: { calculation: '1' },
  decimal: false,
  description: 'Character level (1–20).',
});

// ── 9 Abilities ──────────────────────────────────────────────
var abilityDefs = [
  { v: 'accuracy',      n: 'Accuracy',      d: 'Ranged attacks, fine motor control, throwing' },
  { v: 'communication', n: 'Communication', d: 'Persuasion, leadership, deception, performance' },
  { v: 'constitution',  n: 'Constitution',  d: 'Stamina, toughness, resistance to harm and disease' },
  { v: 'dexterity',     n: 'Dexterity',     d: 'Agility, speed, coordination, stealth' },
  { v: 'fighting',      n: 'Fighting',      d: 'Melee combat, brawling' },
  { v: 'intelligence',  n: 'Intelligence',  d: 'Knowledge, reasoning, memory, tech' },
  { v: 'perception',    n: 'Perception',    d: 'Awareness, noticing details, empathy' },
  { v: 'strength',      n: 'Strength',      d: 'Physical power, lifting, climbing' },
  { v: 'willpower',     n: 'Willpower',     d: 'Mental fortitude, focus, morale' },
];

abilityDefs.forEach(function(a) {
  addNode(rid(), rootId, {
    type: 'attribute',
    attributeType: 'stat',
    variableName: a.v,
    name: a.n,
    baseValue: { calculation: '1' },
    decimal: false,
    description: a.d,
  });
});

// ── Derived stats ─────────────────────────────────────────────
[
  { v: 'toughness', n: 'Toughness', c: '10 + constitution', d: 'Subtract from incoming damage before spending Fortune.' },
  { v: 'defense',   n: 'Defense',   c: '10 + dexterity',    d: 'Attackers must meet or beat this TN to hit you.' },
  { v: 'speed',     n: 'Speed',     c: '10 + dexterity + perception', d: 'Yards per move action. Hindered/Wounded effects reduce this.' },
].forEach(function(s) {
  addNode(rid(), rootId, {
    type: 'attribute',
    attributeType: 'stat',
    variableName: s.v,
    name: s.n,
    baseValue: { calculation: s.c },
    decimal: false,
    description: s.d,
  });
});

// ── Fortune (health bar) ──────────────────────────────────────
addNode(rid(), rootId, {
  type: 'attribute',
  attributeType: 'healthBar',
  variableName: 'fortune',
  name: 'Fortune',
  baseValue: { calculation: '10 + level + constitution * 2' },
  description: '1) Absorbs damage: reduce Fortune by damage after Toughness subtracted.\n2) Modify a roll: spend up to 6 Fortune to set one die to any face (double cost for Drama Die).',
});

// ── Income ────────────────────────────────────────────────────
addNode(rid(), rootId, {
  type: 'attribute',
  attributeType: 'stat',
  variableName: 'income',
  name: 'Income',
  baseValue: { calculation: '2' },
  decimal: false,
  description: 'Income score (1=poverty, 3=middle class, 5=wealthy, 7+=rich). Used for economic tests instead of tracking currency.',
});

// ── Sample Focuses (6) ────────────────────────────────────────
// Modeled as skills with baseValue 2 (the flat +2 a focus provides).
// The "value" shown = ability score + 2, which is the total you add to 3d6.
[
  { n: 'Stealth',       v: 'stealth_focus',     ability: 'dexterity',     d: 'Moving quietly and staying hidden.' },
  { n: 'Technology',    v: 'technology_focus',  ability: 'intelligence',   d: 'Using and repairing tech systems.' },
  { n: 'Bargaining',    v: 'bargaining_focus',  ability: 'communication',  d: 'Negotiating and making deals.' },
  { n: 'Piloting',      v: 'piloting_focus',    ability: 'dexterity',     d: 'Operating spacecraft and vehicles.' },
  { n: 'Free-Fall',     v: 'freefall_focus',    ability: 'dexterity',     d: 'Moving and fighting in zero-g.' },
  { n: 'Gambling',      v: 'gambling_focus',    ability: 'communication',  d: 'Games of chance, reading opponents.' },
].forEach(function(f) {
  addNode(rid(), rootId, {
    type: 'skill',
    skillType: 'skill',
    name: f.n + ' (Focus)',
    variableName: f.v,
    ability: f.ability,
    baseValue: { calculation: '2' },
    description: f.d + '\nWhen used: roll 3d6 + ' + f.ability + ' + 2. (This skill\'s value = ' + f.ability + ' + 2 total.)',
  });
});

// ── Ability Roll Actions (9) ───────────────────────────────────
abilityDefs.forEach(function(a) {
  var actionId = rid();
  addNode(actionId, rootId, {
    type: 'action',
    name: a.n + ' Roll',
    description: 'Roll 3d6 + ' + a.n + ' vs. Target Number.\nAverage TN 11, Challenging 13, Hard 15, Daunting 17.\nAdd +2 if you have a relevant Focus.',
  });
  addNode(rid(), actionId, {
    type: 'roll',
    name: 'Roll',
    roll: { calculation: '3d6 + ' + a.v },
  });
});

// ── Fortune Spend Action ──────────────────────────────────────
addNode(rid(), rootId, {
  type: 'action',
  name: 'Spend Fortune',
  description: 'Spend up to 6 Fortune Points to set one die to any face after rolling.\nDouble the cost (up to 12) to change the Drama Die (highest die).\nReduce Fortune current value manually.',
});

// ── Stunt Reminder ────────────────────────────────────────────
addNode(rid(), rootId, {
  type: 'note',
  name: 'Stunt Points',
  description: 'When two or more dice show the same number, generate Stunt Points equal to the remaining die (the Drama Die).\nStunt Points must be spent immediately on the Stunt list.\nTrack SP on paper — they cannot be saved.',
});

// ── Conditions (Toggles) ──────────────────────────────────────
var conditionDefs = [
  {
    n: 'Hindered',
    d: 'Speed halved. Cannot take the Charge or Run actions.',
    effects: [
      { op: 'mul', amount: '0.5', stats: ['speed'], name: 'Hindered: speed halved' },
    ]
  },
  {
    n: 'Restrained',
    d: 'Speed reduced to 0. Cannot take movement actions.',
    effects: [
      { op: 'set', amount: '0', stats: ['speed'], name: 'Restrained: speed 0' },
    ]
  },
  {
    n: 'Injured',
    d: '-1 to all ability tests. Can spend a Minor action to remove 1d6 damage to avoid being Taken Out.',
    effects: [
      {
        op: 'add', amount: '-1',
        stats: ['accuracy','communication','constitution','dexterity','fighting','intelligence','perception','strength','willpower'],
        name: 'Injured: -1 all abilities'
      },
    ]
  },
  {
    n: 'Wounded',
    d: '-2 to all ability tests. Speed halved. If also Injured → Dying.',
    effects: [
      {
        op: 'add', amount: '-2',
        stats: ['accuracy','communication','constitution','dexterity','fighting','intelligence','perception','strength','willpower'],
        name: 'Wounded: -2 all abilities'
      },
      { op: 'mul', amount: '0.5', stats: ['speed'], name: 'Wounded: speed halved' },
    ]
  },
  {
    n: 'Dying',
    d: 'Lose 1 Constitution per round until stabilized (TN 13 Constitution test by ally) or dead (Constitution reaches -3).\nTrack Constitution loss manually.',
    effects: []
  },
];

conditionDefs.forEach(function(c) {
  var toggleId = rid();
  addNode(toggleId, rootId, {
    type: 'toggle',
    name: c.n,
    enabled: false,
    description: c.d,
  });
  c.effects.forEach(function(e) {
    addNode(rid(), toggleId, {
      type: 'effect',
      name: e.name,
      operation: e.op,
      amount: { calculation: e.amount },
      stats: e.stats,
    });
  });
});

// ── Calculate nested set + insert ────────────────────────────
assignNestedSet(nodes);

var result = db.libraryNodes.insertMany(nodes);

print('');
print('✓ Expanse character library created');
print('  Library ID : ' + libId);
print('  Nodes inserted: ' + nodes.length);
print('');
print('Next steps:');
print('  1. Create a new character, set Game System = "The Expanse RPG"');
print('  2. Go to the Build tab → Ruleset slot → fill from library');
print('  3. Select "The Expanse Ruleset"');
print('');
