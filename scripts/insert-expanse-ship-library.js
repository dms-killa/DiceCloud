/**
 * The Expanse RPG — Ship Combat Library
 *
 * Ships are their own creatures in DiceCloud (type: 'npc', gameSystem: 'expanse-ship').
 * This library provides ship stats, crew station rolls, weapon systems, and
 * Loss conditions as toggles with effects.
 *
 * Usage:
 *   cd app
 *   meteor shell
 *   > .load ../scripts/insert-expanse-ship-library.js
 *
 * Prerequisites:
 *   - Meteor app must be running (meteor run --settings exampleMeteorSettings.json)
 *   - An admin/owner user must exist. Set OWNER_ID below or it defaults to the
 *     first user in the database.
 *
 * What this creates:
 *   1. A Library document: "The Expanse - Ship Systems"
 *   2. A root library node (folder) tagged 'ship'
 *   3. Core ship stats (Hull, Sensors, Maneuverability, Range Band)
 *   4. Ship HP as a health bar derived from Hull
 *   5. Crew station stats (Gunner Accuracy, Pilot Dexterity, etc.)
 *   6. Derived TNs (Attack TN, Evasion TN)
 *   7. Combat actions (Torpedo, Rail Gun, PDC, Evasion, Command, EW, Damage Control)
 *   8. Loss conditions as toggles with mechanical effects
 *   9. Status tracking (Loss Counter, Command SP, Ship Taken Out)
 *  10. Combat reference notes
 *
 * Design philosophy:
 *   Ship combat in The Expanse RPG is crew-driven: every player has a meaningful
 *   role every round. A ship is a shared mechanical entity the whole crew interacts
 *   with simultaneously. Crew characters keep their existing sheets — the ship sheet
 *   tracks the shared resource that those rolls interact with.
 */

// ============================================================================
// Configuration
// ============================================================================

const OWNER_ID = null;

// ============================================================================
// Imports (available in Meteor shell context)
// ============================================================================

const { Meteor } = require('meteor/meteor');
const { Random } = require('meteor/random');

const Libraries = require('/imports/api/library/Libraries').default
  || require('/imports/api/library/Libraries').Libraries;
const LibraryNodes = require('/imports/api/library/LibraryNodes').default
  || require('/imports/api/library/LibraryNodes').LibraryNodes;

// ============================================================================
// Helpers
// ============================================================================

function getOwnerId() {
  if (OWNER_ID) return OWNER_ID;
  const user = Meteor.users.findOne({}, { fields: { _id: 1 } });
  if (!user) throw new Error('No users found. Create an account first.');
  console.log(`Using owner: ${user._id}`);
  return user._id;
}

function id() {
  return Random.id();
}

// ============================================================================
// Main insertion logic
// ============================================================================

(function insertExpanseShipLibrary() {
  const ownerId = getOwnerId();

  // --------------------------------------------------------------------------
  // 1. Create the Library document
  // --------------------------------------------------------------------------
  const libraryId = id();

  Libraries.insert({
    _id: libraryId,
    name: 'The Expanse - Ship Systems',
    description: 'The Expanse RPG ship combat library. ' +
      'Provides core ship stats (Hull, Sensors, Maneuverability), weapon systems ' +
      '(Torpedoes, Rail Guns, PDCs), crew station actions (Command, Piloting, ' +
      'Gunnery, EW, Damage Control), and Loss conditions with mechanical effects. ' +
      'Ships are separate creatures (gameSystem: expanse-ship). ' +
      'VH-003b vibe hack test library.',
    owner: ownerId,
    readers: [],
    writers: [],
    public: true,
    readersCanCopy: true,
  });

  console.log(`Created library: ${libraryId} — "The Expanse - Ship Systems"`);

  const libraryRef = { id: libraryId, collection: 'libraries' };

  // --------------------------------------------------------------------------
  // Helper: insert a library node
  // --------------------------------------------------------------------------
  let nodeCounter = 0;
  const allNodes = [];

  function makeNode(overrides) {
    const nodeId = overrides._id || id();
    nodeCounter++;
    const left = nodeCounter * 2 - 1;
    const right = nodeCounter * 2;
    const node = {
      _id: nodeId,
      root: libraryRef,
      tags: [],
      left,
      right,
      ...overrides,
    };
    allNodes.push(node);
    return nodeId;
  }

  // --------------------------------------------------------------------------
  // 2. Root Node: Ship systems folder
  // --------------------------------------------------------------------------
  const rootNodeId = makeNode({
    type: 'folder',
    name: 'Expanse Ship Systems',
    fillSlots: true,
    libraryTags: ['ship'],
  });

  // --------------------------------------------------------------------------
  // 3. Core Ship Stats
  // --------------------------------------------------------------------------

  // Hull Rating — damage resistance
  makeNode({
    type: 'attribute',
    name: 'Hull Rating',
    variableName: 'hull',
    attributeType: 'stat',
    baseValue: { calculation: '12' },
    decimal: false,
    description: { text: 'Damage resistance. Subtracted from incoming damage before Losses apply. Set to average of hull dice (e.g., 10 for 3d6, 14 for 4d6).' },
    parentId: rootNodeId,
  });

  // Sensors
  makeNode({
    type: 'attribute',
    name: 'Sensors',
    variableName: 'sensors',
    attributeType: 'stat',
    baseValue: { calculation: '2' },
    decimal: false,
    description: { text: 'Sensor score. Adds to TN for attacks against this ship. Also used for Point Defense rolls and EW.' },
    parentId: rootNodeId,
  });

  // Maneuverability
  makeNode({
    type: 'attribute',
    name: 'Maneuverability',
    variableName: 'maneuverability',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Bonus/penalty to Piloting tests for range band shifts. Typical range: -2 to +2.' },
    parentId: rootNodeId,
  });

  // Range Band (0=Long, 1=Medium, 2=Close)
  makeNode({
    type: 'attribute',
    name: 'Range Band',
    variableName: 'rangeBand',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Current range to enemy. 0 = Long (torpedoes only), 1 = Medium (rail guns + torpedoes), 2 = Close (all weapons including PDCs). Adjust manually when Pilot shifts range.' },
    parentId: rootNodeId,
  });

  console.log('Created 4 core ship stats (Hull, Sensors, Maneuverability, Range Band)');

  // --------------------------------------------------------------------------
  // 4. Ship Hull Points (health bar)
  // --------------------------------------------------------------------------
  makeNode({
    type: 'attribute',
    name: 'Ship Hull Points',
    variableName: 'shipHP',
    attributeType: 'healthBar',
    baseValue: { calculation: 'hull' },
    decimal: false,
    description: { text: 'Structural integrity. Damage after hull reduction and Loss absorption drains this. At 0: ship is Taken Out (attacker chooses Crippled, Helpless, or Destroyed).' },
    parentId: rootNodeId,
  });

  console.log('Created Ship Hull Points health bar');

  // --------------------------------------------------------------------------
  // 5. Crew Station Stats
  //    Set to the relevant crew member's ability score before combat.
  // --------------------------------------------------------------------------

  makeNode({
    type: 'attribute',
    name: 'Gunner Accuracy',
    variableName: 'crewAccuracy',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Set to the Gunner crew member\'s Accuracy score before combat. Used for all weapon attack rolls.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'attribute',
    name: 'Pilot Dexterity',
    variableName: 'crewDexterity',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Set to the Pilot crew member\'s Dexterity score before combat. Used for range shifts and evasion.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'attribute',
    name: 'Engineer Intelligence',
    variableName: 'crewIntelligence',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Set to the Engineer crew member\'s Intelligence score before combat. Used for Damage Control and Electronic Warfare.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'attribute',
    name: 'Commander Communication',
    variableName: 'crewCommunication',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Set to the Commander crew member\'s Communication score before combat. Used for Leadership rolls.' },
    parentId: rootNodeId,
  });

  console.log('Created 4 crew station stats');

  // --------------------------------------------------------------------------
  // 6. Derived Attack/Defense TNs
  // --------------------------------------------------------------------------

  makeNode({
    type: 'attribute',
    name: 'Attack TN (vs this ship)',
    variableName: 'attackTN',
    attributeType: 'stat',
    baseValue: { calculation: '11 + sensors' },
    decimal: false,
    description: { text: 'Target Number enemy Gunner must beat to hit this ship. 11 + this ship\'s Sensors. Updates automatically when Sensors change (e.g., from Sensors Damaged Loss).' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'attribute',
    name: 'Evasion TN',
    variableName: 'evasionTN',
    attributeType: 'stat',
    baseValue: { calculation: '10 + sensors' },
    decimal: false,
    description: { text: 'TN for Pilot evasion rolls. Should be 10 + ATTACKING ship\'s Sensors. Default uses this ship\'s sensors as placeholder — set manually to 10 + enemy Sensors each encounter.' },
    parentId: rootNodeId,
  });

  console.log('Created 2 derived TNs');

  // --------------------------------------------------------------------------
  // 7. Command SP Pool
  // --------------------------------------------------------------------------

  makeNode({
    type: 'attribute',
    name: 'Command SP (this round)',
    variableName: 'commandSP',
    attributeType: 'resource',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Stunt Points from Commander\'s Leadership roll (Drama Die value on success). Any crew member can spend these this round. Reset to 0 each new round.' },
    parentId: rootNodeId,
  });

  // --------------------------------------------------------------------------
  // 8. Active Loss Counter
  // --------------------------------------------------------------------------

  makeNode({
    type: 'attribute',
    name: 'Active Losses',
    variableName: 'lossCount',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Number of active Loss conditions. Damage Control threshold = this x 5. At 2 active Losses: ship is Taken Out if further damage remains after hull reduction.' },
    parentId: rootNodeId,
  });

  console.log('Created Command SP and Loss Counter');

  // --------------------------------------------------------------------------
  // 9. Weapon Systems (Actions)
  // --------------------------------------------------------------------------

  // Torpedo Attack (Long range)
  const torpedoActionId = makeNode({
    type: 'action',
    name: 'Torpedo Attack',
    actionType: 'action',
    summary: { text: 'Long range. 3d6 + Accuracy vs TN 11 + enemy Sensors.' },
    description: { text: 'Long range only (Range Band 0+). Gunner rolls Accuracy (Gunnery) vs TN 11 + enemy ship\'s Sensors. Torpedoes can be shot down by enemy PDCs (Point Defense). Damage: 3d6 + 3.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'Gunnery Roll',
    variableName: 'torpedoGunneryRoll',
    roll: { calculation: '3d6 + crewAccuracy' },
    parentId: torpedoActionId,
  });

  makeNode({
    type: 'damage',
    name: 'Torpedo Damage',
    amount: { calculation: '3d6 + 3' },
    damageType: 'piercing',
    parentId: torpedoActionId,
  });

  // Rail Gun Attack (Medium range)
  const railgunActionId = makeNode({
    type: 'action',
    name: 'Rail Gun Attack',
    actionType: 'action',
    summary: { text: 'Medium range. 3d6 + Accuracy vs TN 11 + enemy Sensors.' },
    description: { text: 'Medium range or closer (Range Band 1+). Gunner rolls Accuracy (Gunnery) vs TN 11 + enemy ship\'s Sensors. Cannot be shot down by PDCs. Damage: 4d6.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'Gunnery Roll',
    variableName: 'railgunGunneryRoll',
    roll: { calculation: '3d6 + crewAccuracy' },
    parentId: railgunActionId,
  });

  makeNode({
    type: 'damage',
    name: 'Rail Gun Damage',
    amount: { calculation: '4d6' },
    damageType: 'piercing',
    parentId: railgunActionId,
  });

  // PDC Burst (Close range)
  const pdcActionId = makeNode({
    type: 'action',
    name: 'PDC Burst',
    actionType: 'action',
    summary: { text: 'Close range attack or torpedo point defense.' },
    description: { text: 'Close range only (Range Band 2). Also used for torpedo point defense at medium/close range: roll Sensors vs TN 12 + enemy Sensors to shoot down incoming torpedo. Damage: 2d6.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'Gunnery Roll',
    variableName: 'pdcGunneryRoll',
    roll: { calculation: '3d6 + crewAccuracy' },
    parentId: pdcActionId,
  });

  makeNode({
    type: 'damage',
    name: 'PDC Damage',
    amount: { calculation: '2d6' },
    damageType: 'piercing',
    parentId: pdcActionId,
  });

  console.log('Created 3 weapon systems (Torpedo, Rail Gun, PDC)');

  // --------------------------------------------------------------------------
  // 10. Crew Station Actions
  // --------------------------------------------------------------------------

  // Command
  const commandActionId = makeNode({
    type: 'action',
    name: 'Command',
    actionType: 'action',
    summary: { text: 'Communication (Leadership) vs TN 11.' },
    description: { text: 'Phase 1: Commander rolls Communication (Leadership) vs TN 11. On success, generates Stunt Points equal to Drama Die value. These SP can be spent by ANY crew member this round.\n\nCommand Stunts:\n- 1+ Guidance: +1 to a chosen test per SP\n- 2 Fire for Effect: +1d6 damage on next attack\n- 3 Sensor Lock: Target cannot evade this round\n- 4+ Set-Up: Force enemy into hazard (damage = SP/2)' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'Leadership Roll',
    variableName: 'leadershipRoll',
    roll: { calculation: '3d6 + crewCommunication' },
    parentId: commandActionId,
  });

  // Evasion
  const evasionActionId = makeNode({
    type: 'action',
    name: 'Evasion',
    actionType: 'action',
    summary: { text: 'Dexterity (Piloting) vs Evasion TN.' },
    description: { text: 'Phase 5: Pilot rolls Dexterity (Piloting) vs Evasion TN. Set evasionTN to 10 + attacking ship\'s Sensors before rolling.\n\nHigh-G Burn option: +2 to this roll, but each crew member must pass Constitution (Stamina) TN 13 or take 1d6 damage.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'Evasion Roll',
    variableName: 'evasionRoll',
    roll: { calculation: '3d6 + crewDexterity' },
    parentId: evasionActionId,
  });

  // Range Shift (Piloting)
  const rangeShiftActionId = makeNode({
    type: 'action',
    name: 'Range Shift',
    actionType: 'action',
    summary: { text: 'Dexterity (Piloting) vs TN 11 +/- Maneuverability.' },
    description: { text: 'Phase 2: Pilot rolls Dexterity (Piloting) to shift range band by one step. TN 11. Maneuverability adds to the roll. On success, move one band (Long ↔ Medium ↔ Close). Adjust rangeBand stat manually after success.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'Piloting Roll',
    variableName: 'pilotingRoll',
    roll: { calculation: '3d6 + crewDexterity + maneuverability' },
    parentId: rangeShiftActionId,
  });

  // Electronic Warfare
  const ewActionId = makeNode({
    type: 'action',
    name: 'Electronic Warfare',
    actionType: 'action',
    summary: { text: 'Intelligence (Technology) vs TN 11.' },
    description: { text: 'Phase 3: EW Officer rolls Intelligence (Technology) vs TN 11. On success, generates EW Points equal to Drama Die value. Spend EW Points to boost defensive rolls or degrade enemy targeting this round. Track EW Points on paper.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'EW Roll',
    variableName: 'ewRoll',
    roll: { calculation: '3d6 + crewIntelligence' },
    parentId: ewActionId,
  });

  // Damage Control
  const dcActionId = makeNode({
    type: 'action',
    name: 'Damage Control',
    actionType: 'action',
    summary: { text: 'Intelligence (Engineering) Advanced Test TN 11.' },
    description: { text: 'Phase 7: Engineer rolls Intelligence (Engineering) vs TN 11. This is an Advanced Test — accumulate successes across rounds until threshold is met (Active Losses x 5). On completion, remove one Loss condition (toggle it off). Track accumulated successes on paper.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'Engineering Roll',
    variableName: 'engineeringRoll',
    roll: { calculation: '3d6 + crewIntelligence' },
    parentId: dcActionId,
  });

  // Point Defense (torpedo interception)
  const pointDefActionId = makeNode({
    type: 'action',
    name: 'Point Defense (Torpedo Intercept)',
    actionType: 'action',
    summary: { text: 'Sensors vs TN 12 + enemy Sensors.' },
    description: { text: 'Phase 5: Use PDCs to shoot down incoming torpedoes. Roll Sensors-based test vs TN 12 + attacking ship\'s Sensors. Available at Medium or Close range only. On success, torpedo is destroyed before impact.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'roll',
    name: 'Point Defense Roll',
    variableName: 'pointDefRoll',
    roll: { calculation: '3d6 + sensors' },
    parentId: pointDefActionId,
  });

  console.log('Created 6 crew station actions (Command, Evasion, Range Shift, EW, Damage Control, Point Defense)');

  // --------------------------------------------------------------------------
  // 11. Ship Loss Conditions (Toggles with Effects)
  // --------------------------------------------------------------------------

  // Engines Damaged
  const enginesDamagedId = makeNode({
    type: 'toggle',
    name: 'LOSS: Engines Damaged',
    showUI: true,
    enabled: false,
    description: { text: 'Cannot shift range bands this round. -2 to all Piloting tests.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'effect',
    name: 'Engines: -2 Piloting',
    operation: 'add',
    amount: { calculation: '-2' },
    stats: ['crewDexterity'],
    parentId: enginesDamagedId,
  });

  // Sensors Damaged
  const sensorsDamagedId = makeNode({
    type: 'toggle',
    name: 'LOSS: Sensors Damaged',
    showUI: true,
    enabled: false,
    description: { text: '-2 to Sensor score. Affects attack TNs, EW tests, and Point Defense.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'effect',
    name: 'Sensors: -2 Sensor Score',
    operation: 'add',
    amount: { calculation: '-2' },
    stats: ['sensors'],
    parentId: sensorsDamagedId,
  });

  // Weapons Disabled
  makeNode({
    type: 'toggle',
    name: 'LOSS: Weapons Disabled',
    showUI: true,
    enabled: false,
    description: { text: 'One weapon system offline (GM specifies which: Torpedoes, Rail Guns, or PDCs). Remove this toggle when repaired via Damage Control.' },
    parentId: rootNodeId,
  });

  // Hull Breach
  makeNode({
    type: 'toggle',
    name: 'LOSS: Hull Breach',
    showUI: true,
    enabled: false,
    description: { text: 'Each round, crew not in vacuum suits takes 1d6 damage. Ongoing hazard until repaired via Damage Control. Crew should don suits immediately.' },
    parentId: rootNodeId,
  });

  // Collateral Damage
  makeNode({
    type: 'toggle',
    name: 'LOSS: Collateral Damage (Pending)',
    showUI: true,
    enabled: false,
    description: { text: 'One crew member designated by attacker takes weapon damage directly. Enable to mark pending, disable after applying damage to the crew member\'s character sheet.' },
    parentId: rootNodeId,
  });

  // Comms Offline
  const commsOfflineId = makeNode({
    type: 'toggle',
    name: 'LOSS: Comms Offline',
    showUI: true,
    enabled: false,
    description: { text: 'Commander cannot use Leadership stunts. Crew coordination severely degraded. -3 to Commander Communication.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'effect',
    name: 'Comms: Commander -3 Communication',
    operation: 'add',
    amount: { calculation: '-3' },
    stats: ['crewCommunication'],
    parentId: commsOfflineId,
  });

  // Life Support Damaged
  makeNode({
    type: 'toggle',
    name: 'LOSS: Life Support Damaged',
    showUI: true,
    enabled: false,
    description: { text: 'Time pressure: crew has limited rounds before atmosphere becomes critical. Track remaining rounds on paper. Priority repair target.' },
    parentId: rootNodeId,
  });

  console.log('Created 7 Loss condition toggles');

  // --------------------------------------------------------------------------
  // 12. Ship Taken Out condition
  // --------------------------------------------------------------------------

  makeNode({
    type: 'toggle',
    name: 'SHIP TAKEN OUT',
    showUI: true,
    enabled: false,
    description: { text: 'Ship is out of combat. Attacker chooses outcome:\n- Crippled: Ship adrift, no thrust, must be towed\n- Helpless: Ship can be boarded, crew at mercy of attacker\n- Destroyed: Ship explodes — crew has moments to evacuate' },
    parentId: rootNodeId,
  });

  // --------------------------------------------------------------------------
  // 13. Combat Reference Notes
  // --------------------------------------------------------------------------

  makeNode({
    type: 'note',
    name: 'Combat Range Reference',
    description: { text: 'LONG (Range Band 0): Torpedoes only. Cannot evade — must use PDCs to shoot down incoming.\nMEDIUM (Range Band 1): Rail guns + Torpedoes. Evasion allowed.\nCLOSE (Range Band 2): All weapons including PDCs. Boarding range.\n\nShift range: Piloting test TN 11 (+ Maneuverability). One band per success.\nHigh-G burn: +2 to evasion, but crew Constitution (Stamina) TN 13 or take 1d6 damage.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'note',
    name: 'Round Structure (7 Phases)',
    description: { text: '1. COMMAND — Commander rolls Communication (Leadership) TN 11. SP = Drama Die on success.\n2. MANEUVERS — Pilot rolls Dexterity (Piloting) to shift range band.\n3. ELECTRONIC WARFARE — EW Officer rolls Intelligence (Technology) TN 11.\n4. WEAPON ATTACKS — Gunner rolls Accuracy (Gunnery) vs TN 11 + enemy Sensors.\n5. DEFENSIVE ACTIONS — Evasion (Piloting vs 10 + attacker Sensors) or Point Defense.\n6. ATTACK DAMAGE — Roll weapon dice, subtract Hull, apply Losses (1d6 each, max 2).\n7. DAMAGE CONTROL — Engineer rolls Intelligence (Engineering) Advanced Test TN 11.' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'note',
    name: 'Damage Resolution Steps',
    description: { text: '1. Roll weapon damage dice\n2. Subtract target ship\'s Hull Rating from damage\n3. If damage remains: ship may take up to 2 Loss conditions (each absorbs 1d6 damage)\n4. Toggle the chosen Loss condition on the ship sheet — effects apply automatically\n5. If damage STILL remains after 2 Losses: ship is Taken Out\n6. Increment the Active Losses counter for Damage Control threshold tracking' },
    parentId: rootNodeId,
  });

  makeNode({
    type: 'note',
    name: 'Expanse Ship Setup Notes',
    description: { text: 'Before combat:\n1. Set crew stats on this sheet to match crew members\' ability scores\n2. Set evasionTN to 10 + enemy ship\'s Sensors\n3. Set rangeBand to starting range (0=Long, 1=Medium, 2=Close)\n\nDuring combat:\n- Open this ship sheet alongside each crew member\'s character sheet\n- Use the Combat actions on this sheet for ship-scale rolls\n- Toggle Loss conditions when ship takes damage\n- Track Command SP, EW Points, and Damage Control progress on paper\n\nKnown limitations:\n- Crew stats must be copied manually (no live link to character sheets)\n- EW Points tracked on paper\n- Damage Control Advanced Test accumulation tracked on paper\n- Range band is a number — no automatic weapon availability enforcement' },
    parentId: rootNodeId,
  });

  console.log('Created 4 reference notes');

  // --------------------------------------------------------------------------
  // Batch insert all nodes
  // --------------------------------------------------------------------------
  console.log(`\nInserting ${allNodes.length} library nodes...`);

  for (const node of allNodes) {
    try {
      LibraryNodes.insert(node);
    } catch (e) {
      console.error(`Failed to insert node "${node.name}" (${node.type}):`, e.message);
    }
  }

  // Rebuild nested sets
  try {
    const { rebuildNestedSets } = require('/imports/api/parenting/parentingFunctions');
    if (rebuildNestedSets) {
      rebuildNestedSets(LibraryNodes, libraryId);
      console.log('Rebuilt nested sets');
    }
  } catch (e) {
    console.warn('Could not auto-rebuild nested sets:', e.message);
    console.log('Nested sets may need manual rebuild. The library should still work.');
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n========================================');
  console.log('Expanse Ship Library Insertion Complete!');
  console.log('========================================');
  console.log(`Library ID: ${libraryId}`);
  console.log(`Total nodes: ${allNodes.length}`);
  console.log('');
  console.log('Node breakdown:');
  const typeCounts = {};
  for (const n of allNodes) {
    typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCounts).sort()) {
    console.log(`  ${type}: ${count}`);
  }
  console.log('');
  console.log('Next steps:');
  console.log('1. Create a new creature in the DiceCloud UI');
  console.log('2. Set Game System to "The Expanse — Ship" in creature settings');
  console.log('3. Import ship properties from "The Expanse - Ship Systems" library');
  console.log('4. Set Hull Rating, Sensors, and Maneuverability for your ship');
  console.log('5. Set crew stats to match crew member ability scores');
  console.log('6. Use Combat actions for ship-scale rolls during play');
  console.log('');
  console.log('See docs/expanse-playtest-guide.md for ship combat workflow.');

  return libraryId;
})();
