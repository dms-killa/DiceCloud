'use strict';

// Turns LLM-produced JSON into a ready-to-run mongosh insert script.
//
// Dispatch by content type (matches --prompt flag names):
//   expanse-ship → generateExpanseShipScript(json)
//
// To add a new content type:
//   1. Add a prompt template to prompts/<name>.md
//   2. Add a case here and implement the generator function below

module.exports = { generateScript };

function generateScript(promptName, json) {
  switch (promptName) {
    case 'expanse-ship':
      return generateExpanseShipScript(json);
    default:
      throw new Error(`No script generator for prompt "${promptName}". Add a case to lib/script-generator.js`);
  }
}

// ── Expanse Ship generator ────────────────────────────────────────────────────
//
// Expected JSON shape (all fields optional — sensible defaults used):
// {
//   "library":        { "name": "...", "description": "...", "gameSystem": "expanse-ship" },
//   "stats":          { "hull": 4, "sensors": 3, "communications": 3, "handling": 0, "crew_quality": 2, "damage_track": 5 },
//   "weapons":        [ { "name": "...", "roll": "3d6 + accuracy_crew", "damage": "3d6", "description": "..." } ],
//   "lossConditions": [ { "name": "...", "severity": "normal|serious", "effects": [ { "stat": "...", "op": "add|set", "amount": "-2" } ] } ],
//   "qualities":      [ { "name": "...", "enabled": true, "effect": { "stat": "...", "op": "add", "amount": "1" } } ],
//   "description":    "..."
// }

function generateExpanseShipScript(json) {
  const lib    = json.library        || {};
  const stats  = json.stats          || {};
  const weapons        = json.weapons        || [];
  const lossConditions = json.lossConditions || [];
  const qualities      = json.qualities      || [];

  const libName        = lib.name        || 'Generated Ship';
  const libDescription = lib.description || '';
  const gameSystem     = lib.gameSystem  || 'expanse-ship';

  const statDefs = [
    { v: 'hull',           n: 'Hull Rating',     c: stats.hull           ?? 5,  d: 'Absorbed from incoming damage before Damage Track.' },
    { v: 'sensors',        n: 'Sensors',         c: stats.sensors        ?? 3,  d: 'Used in targeting lock, EW, and sensor ops.' },
    { v: 'communications', n: 'Communications',  c: stats.communications ?? 3,  d: 'Used for comms operations and electronic warfare.' },
    { v: 'handling',       n: 'Handling',        c: stats.handling       ?? 0,  d: 'Bonus/penalty to pilot Dexterity rolls.' },
    { v: 'crew_quality',   n: 'Crew Quality',    c: stats.crew_quality   ?? 2,  d: 'Average crew skill. Used when generic crew action needed.' },
  ];
  const damageTrack = stats.damage_track ?? 5;

  // Build the script as a string using template literal blocks
  const lines = [];

  lines.push(scriptHeader(libName));

  lines.push(`
var user = db.users.findOne({}, { _id: 1 });
var ownerId = (user && user._id) ? user._id : 'system';
var now = new Date();

var libId = rid();

db.libraries.insertOne({
  _id: libId,
  name: ${q(libName)},
  description: ${q(libDescription)},
  gameSystem: ${q(gameSystem)},
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

// Root folder
var rootId = rid();
addNode(rootId, null, {
  type: 'folder',
  name: ${q(libName)},
  libraryTags: ['ship'],
  fillSlots: true,
  description: ${q(libDescription)},
});

// ── Core Ship Stats ───────────────────────────────────────────────────────────
var statsFolderId = rid();
addNode(statsFolderId, rootId, { type: 'folder', name: 'Core Ship Stats' });
`);

  // Stat attributes
  for (const s of statDefs) {
    lines.push(`addNode(rid(), statsFolderId, {
  type: 'attribute', attributeType: 'stat',
  variableName: ${q(s.v)}, name: ${q(s.n)},
  baseValue: { calculation: ${q(String(s.c))} },
  decimal: false, description: ${q(s.d)},
});`);
  }

  lines.push(`
// Damage Track
addNode(rid(), rootId, {
  type: 'attribute', attributeType: 'healthBar',
  variableName: 'damage_track', name: 'Damage Track',
  baseValue: { calculation: ${q(String(damageTrack))} },
  description: 'Ship damage track. When all sections are lost the ship is destroyed.',
});
`);

  // Weapons
  if (weapons.length > 0) {
    lines.push(`// ── Weapon Systems ───────────────────────────────────────────────────────────
var weaponsFolderId = rid();
addNode(weaponsFolderId, rootId, {
  type: 'folder', name: 'Weapon Systems',
  description: 'Attack TN = 11 + target Sensors.',
});
`);
    for (const w of weapons) {
      lines.push(`var wId_${safeVar(w.name)} = rid();
addNode(wId_${safeVar(w.name)}, weaponsFolderId, {
  type: 'action', name: ${q(w.name)},
  description: ${q(w.description || '')},
});
addNode(rid(), wId_${safeVar(w.name)}, {
  type: 'roll', name: 'Attack Roll',
  roll: { calculation: ${q(w.roll || '3d6 + accuracy_crew')} },
  description: 'Meet or beat TN (11 + target Sensors) to hit.',
});
addNode(rid(), wId_${safeVar(w.name)}, {
  type: 'damage', name: 'Damage',
  amount: { calculation: ${q(w.damage || '1d6')} },
  description: 'Subtract target Hull Rating first. Remainder reduces Damage Track.',
});
`);
    }
  }

  // Crew stations (standard bridge stats + 5 action rolls)
  lines.push(`// ── Crew Stations ────────────────────────────────────────────────────────────
var stationsFolderId = rid();
addNode(stationsFolderId, rootId, {
  type: 'folder', name: 'Crew Stations',
  description: 'Set the *_crew bridge stats to the assigned crew member ability scores.',
});

[
  { v: 'accuracy_crew',      n: 'Gunner: Accuracy',           d: 'Set to gunner Accuracy score.' },
  { v: 'dexterity_crew',     n: 'Pilot: Dexterity',           d: 'Set to pilot Dexterity score.' },
  { v: 'intelligence_crew',  n: 'Sensor/Engineer: Intelligence', d: 'Set to sensor ops / engineer Intelligence score.' },
  { v: 'communication_crew', n: 'Commander: Communication',   d: 'Set to commander Communication score.' },
].forEach(function(b) {
  addNode(rid(), stationsFolderId, {
    type: 'attribute', attributeType: 'stat',
    variableName: b.v, name: b.n,
    baseValue: { calculation: '0' }, decimal: false, description: b.d,
  });
});

[
  { n: 'Pilot',      roll: '3d6 + dexterity_crew + handling',  d: 'Maneuver, evasion, docking.' },
  { n: 'Gunner',     roll: '3d6 + accuracy_crew',              d: 'Attack.' },
  { n: 'Sensor Ops', roll: '3d6 + intelligence_crew + sensors',d: 'EW, targeting assist, counter-EW.' },
  { n: 'Engineer',   roll: '3d6 + intelligence_crew',          d: 'Damage control, thrust adjustments.' },
  { n: 'Commander',  roll: '3d6 + communication_crew',         d: 'Inspire crew (+1 to all rolls for 1 round).' },
].forEach(function(s) {
  var stId = rid();
  addNode(stId, stationsFolderId, { type: 'action', name: s.n, description: s.d });
  addNode(rid(), stId, { type: 'roll', name: 'Station Roll', roll: { calculation: s.roll } });
});
`);

  // LOSS conditions
  if (lossConditions.length > 0) {
    const normal  = lossConditions.filter(l => l.severity !== 'serious');
    const serious = lossConditions.filter(l => l.severity === 'serious');

    if (normal.length > 0) {
      lines.push(`// ── LOSS Conditions (Normal) ─────────────────────────────────────────────────
var normalLossFolderId = rid();
addNode(normalLossFolderId, rootId, {
  type: 'folder', name: 'LOSS Conditions',
  description: 'Activate when the ship takes a Normal Loss. Toggle off when repaired.',
});
`);
      for (const l of normal) {
        const varName = `tNormal_${safeVar(l.name)}`;
        lines.push(`var ${varName} = rid();
addNode(${varName}, normalLossFolderId, {
  type: 'toggle', name: ${q(l.name)},
  enabled: false, description: ${q(l.description || '')},
});`);
        for (const e of (l.effects || [])) {
          lines.push(`addNode(rid(), ${varName}, {
  type: 'effect', name: ${q(l.name + ': ' + e.stat + ' ' + e.op + ' ' + e.amount)},
  operation: ${q(e.op || 'add')},
  amount: { calculation: ${q(String(e.amount))} },
  stats: [${q(e.stat)}],
});`);
        }
        lines.push('');
      }
    }

    if (serious.length > 0) {
      lines.push(`// ── LOSS Conditions (Serious) ────────────────────────────────────────────────
var seriousLossFolderId = rid();
addNode(seriousLossFolderId, rootId, {
  type: 'folder', name: 'SERIOUS LOSS Conditions',
  description: 'Major system failures. Require significant repair.',
});
`);
      for (const l of serious) {
        const varName = `tSerious_${safeVar(l.name)}`;
        lines.push(`var ${varName} = rid();
addNode(${varName}, seriousLossFolderId, {
  type: 'toggle', name: ${q(l.name)},
  enabled: false, description: ${q(l.description || '')},
});`);
        for (const e of (l.effects || [])) {
          lines.push(`addNode(rid(), ${varName}, {
  type: 'effect', name: ${q(l.name + ': ' + e.stat + ' ' + e.op + ' ' + e.amount)},
  operation: ${q(e.op || 'add')},
  amount: { calculation: ${q(String(e.amount))} },
  stats: [${q(e.stat)}],
});`);
        }
        lines.push('');
      }
    }
  }

  // Qualities
  if (qualities.length > 0) {
    lines.push(`// ── Ship Qualities ───────────────────────────────────────────────────────────
var qualitiesFolderId = rid();
addNode(qualitiesFolderId, rootId, { type: 'folder', name: 'Ship Qualities' });
`);
    for (const q_ of qualities) {
      const varName = `tQual_${safeVar(q_.name)}`;
      lines.push(`var ${varName} = rid();
addNode(${varName}, qualitiesFolderId, {
  type: 'toggle', name: ${q(q_.name)},
  enabled: ${q_.enabled !== false ? 'true' : 'false'},
  description: ${q(q_.description || '')},
});`);
      if (q_.effect) {
        const e = q_.effect;
        lines.push(`addNode(rid(), ${varName}, {
  type: 'effect', name: ${q(q_.name + ' effect')},
  operation: ${q(e.op || 'add')},
  amount: { calculation: ${q(String(e.amount))} },
  stats: [${q(e.stat)}],
});`);
      }
      lines.push('');
    }
  }

  // Description note
  if (json.description) {
    lines.push(`addNode(rid(), rootId, {
  type: 'note', name: ${q(libName + ' — Description')},
  description: ${q(json.description)},
});
`);
  }

  // Finalize
  lines.push(`assignNestedSet(nodes);
db.libraryNodes.insertMany(nodes);

print('');
print('Library created: ' + ${q(libName)});
print('  Library ID    : ' + libId);
print('  Nodes inserted: ' + nodes.length);
`);

  return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scriptHeader(name) {
  return `// Generated by DiceCloud content-ingestion CLI
// Library: ${name}
// Run with: mongosh "mongodb://meteor:meteor@localhost:27017/test?authSource=admin" < this-file.js

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
`;
}

// Escape a string as a JS string literal (single-quoted)
function q(str) {
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
}

// Turn an arbitrary string into a safe JS variable name suffix
function safeVar(str) {
  return String(str).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20);
}
