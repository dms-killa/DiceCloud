/**
 * The Expanse RPG — Sample Ship: Rocinante
 *
 * Creates a sample ship creature using the Expanse Ship Systems library.
 * The Rocinante is a Canterbury-class ice hauler converted into a Martian
 * light frigate — the crew's ship from The Expanse series.
 *
 * How to use this in play:
 *   1. Open the Rocinante sheet in one browser tab
 *   2. Open character sheets for each crew member in other tabs
 *   3. Before combat: set Crew Stats on ship sheet to match crew ability scores
 *   4. During combat: use the ship's Combat tab for ship-scale rolls
 *   5. Toggle Loss conditions on the ship sheet when damage is taken
 *
 * Usage:
 *   cd app
 *   meteor shell
 *   > .load ../scripts/create-expanse-sample-ship.js
 *
 * Prerequisites:
 *   - Meteor app must be running (meteor run --settings exampleMeteorSettings.json)
 *   - The Expanse Ship Systems library should exist (run insert-expanse-ship-library.js first)
 *   - An admin/owner user must exist
 */

// ============================================================================
// Configuration
// ============================================================================

const OWNER_ID = null;

// ============================================================================
// Imports
// ============================================================================

const { Meteor } = require('meteor/meteor');
const { Random } = require('meteor/random');

const Creatures = require('/imports/api/creature/creatures/Creatures').default
  || require('/imports/api/creature/creatures/Creatures').Creatures;
const CreatureProperties = require('/imports/api/creature/creatureProperties/CreatureProperties').default
  || require('/imports/api/creature/creatureProperties/CreatureProperties').CreatureProperties;

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
// Main
// ============================================================================

(function createRocinante() {
  const ownerId = getOwnerId();

  // --------------------------------------------------------------------------
  // 1. Create the Creature
  // --------------------------------------------------------------------------
  const creatureId = id();
  const creatureRef = { id: creatureId, collection: 'creatures' };

  Creatures.insert({
    _id: creatureId,
    name: 'Rocinante',
    type: 'npc',
    gameSystem: 'expanse-ship',
    owner: ownerId,
    readers: [ownerId],
    writers: [ownerId],
    public: false,
    alignment: 'MCRN Corvette-class (converted)',
    gender: '',
    picture: '',
    avatarPicture: '',
    settings: {
      hideUnusedStats: false,
      hideRestButtons: true,
      hideSpellsTab: true,
      showTreeTab: true,
      hitDiceResetMultiplier: 0.5,
    },
    allowedLibraries: null,
    allowedLibraryCollections: null,
    dirty: true,
    variables: {},
    denormalizedStats: {},
  });

  console.log(`Created creature: ${creatureId} — "Rocinante"`);

  // --------------------------------------------------------------------------
  // 2. Insert properties directly (rather than importing from library)
  //    This creates a standalone sample ship without requiring the library.
  // --------------------------------------------------------------------------
  let nodeCounter = 0;
  const allProps = [];

  function makeProp(overrides) {
    const propId = overrides._id || id();
    nodeCounter++;
    const left = nodeCounter * 2 - 1;
    const right = nodeCounter * 2;
    const prop = {
      _id: propId,
      root: creatureRef,
      tags: [],
      left,
      right,
      ...overrides,
    };
    allProps.push(prop);
    return propId;
  }

  // -- Core Stats --

  // Hull: 15 (MCRN corvette, better than a freighter)
  makeProp({
    type: 'attribute',
    name: 'Hull Rating',
    variableName: 'hull',
    attributeType: 'stat',
    baseValue: { calculation: '15' },
    decimal: false,
    description: { text: 'MCRN Corvette-class hull. Equivalent to ~4d6 hull dice (avg 14, boosted for military conversion).' },
  });

  // Sensors: 3 (military-grade)
  makeProp({
    type: 'attribute',
    name: 'Sensors',
    variableName: 'sensors',
    attributeType: 'stat',
    baseValue: { calculation: '3' },
    decimal: false,
    description: { text: 'Military-grade MCRN sensor suite.' },
  });

  // Maneuverability: +1 (Epstein drive, well-tuned)
  makeProp({
    type: 'attribute',
    name: 'Maneuverability',
    variableName: 'maneuverability',
    attributeType: 'stat',
    baseValue: { calculation: '1' },
    decimal: false,
    description: { text: 'Epstein drive, well-maintained by Naomi and Amos.' },
  });

  // Range Band
  makeProp({
    type: 'attribute',
    name: 'Range Band',
    variableName: 'rangeBand',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: '0=Long, 1=Medium, 2=Close. Adjust when Pilot shifts range.' },
  });

  // Ship HP
  makeProp({
    type: 'attribute',
    name: 'Ship Hull Points',
    variableName: 'shipHP',
    attributeType: 'healthBar',
    baseValue: { calculation: 'hull' },
    decimal: false,
    description: { text: 'Structural integrity. At 0: Taken Out.' },
  });

  // -- Crew Stats (pre-set for Holden's crew) --

  // Gunner Accuracy: 2 (Amos)
  makeProp({
    type: 'attribute',
    name: 'Gunner Accuracy',
    variableName: 'crewAccuracy',
    attributeType: 'stat',
    baseValue: { calculation: '2' },
    decimal: false,
    description: { text: 'Amos Burton — solid but not a specialist gunner.' },
  });

  // Pilot Dexterity: 3 (Alex Kamal)
  makeProp({
    type: 'attribute',
    name: 'Pilot Dexterity',
    variableName: 'crewDexterity',
    attributeType: 'stat',
    baseValue: { calculation: '3' },
    decimal: false,
    description: { text: 'Alex Kamal — former MCRN pilot, exceptional.' },
  });

  // Engineer Intelligence: 3 (Naomi Nagata)
  makeProp({
    type: 'attribute',
    name: 'Engineer Intelligence',
    variableName: 'crewIntelligence',
    attributeType: 'stat',
    baseValue: { calculation: '3' },
    decimal: false,
    description: { text: 'Naomi Nagata — brilliant engineer and XO.' },
  });

  // Commander Communication: 3 (James Holden)
  makeProp({
    type: 'attribute',
    name: 'Commander Communication',
    variableName: 'crewCommunication',
    attributeType: 'stat',
    baseValue: { calculation: '3' },
    decimal: false,
    description: { text: 'James Holden — charismatic leader, former XO of the Canterbury.' },
  });

  // -- Derived TNs --

  makeProp({
    type: 'attribute',
    name: 'Attack TN (vs this ship)',
    variableName: 'attackTN',
    attributeType: 'stat',
    baseValue: { calculation: '11 + sensors' },
    decimal: false,
    description: { text: 'TN = 14 (11 + 3 Sensors). Enemy must beat this to hit the Roci.' },
  });

  makeProp({
    type: 'attribute',
    name: 'Evasion TN',
    variableName: 'evasionTN',
    attributeType: 'stat',
    baseValue: { calculation: '10 + sensors' },
    decimal: false,
    description: { text: 'Set to 10 + enemy ship\'s Sensors each encounter. Default shows 13 (10 + own sensors).' },
  });

  // -- Resources --

  makeProp({
    type: 'attribute',
    name: 'Command SP (this round)',
    variableName: 'commandSP',
    attributeType: 'resource',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Stunt Points from Holden\'s Leadership roll.' },
  });

  makeProp({
    type: 'attribute',
    name: 'Active Losses',
    variableName: 'lossCount',
    attributeType: 'stat',
    baseValue: { calculation: '0' },
    decimal: false,
    description: { text: 'Damage Control threshold = this x 5.' },
  });

  // -- Weapons --

  // Rail Guns (Rocinante's primary weapon)
  const railgunId = makeProp({
    type: 'action',
    name: 'Rail Gun Attack',
    actionType: 'action',
    summary: { text: 'Medium range. 3d6 + Accuracy vs TN 11 + enemy Sensors.' },
    description: { text: 'Rocinante\'s primary armament. Medium range or closer. Damage: 4d6.' },
  });

  makeProp({
    type: 'roll',
    name: 'Gunnery Roll',
    variableName: 'railgunGunneryRoll',
    roll: { calculation: '3d6 + crewAccuracy' },
    parentId: railgunId,
  });

  makeProp({
    type: 'damage',
    name: 'Rail Gun Damage',
    amount: { calculation: '4d6' },
    damageType: 'piercing',
    parentId: railgunId,
  });

  // PDCs
  const pdcId = makeProp({
    type: 'action',
    name: 'PDC Burst',
    actionType: 'action',
    summary: { text: 'Close range attack or torpedo point defense.' },
    description: { text: 'Point Defense Cannons. Close range or torpedo intercept. Damage: 2d6.' },
  });

  makeProp({
    type: 'roll',
    name: 'Gunnery Roll',
    variableName: 'pdcGunneryRoll',
    roll: { calculation: '3d6 + crewAccuracy' },
    parentId: pdcId,
  });

  makeProp({
    type: 'damage',
    name: 'PDC Damage',
    amount: { calculation: '2d6' },
    damageType: 'piercing',
    parentId: pdcId,
  });

  // -- Crew Actions --

  const commandId = makeProp({
    type: 'action',
    name: 'Command',
    actionType: 'action',
    summary: { text: 'Holden: Communication (Leadership) vs TN 11.' },
    description: { text: 'Phase 1: Holden rallies the crew. On success, generates SP = Drama Die value.' },
  });

  makeProp({
    type: 'roll',
    name: 'Leadership Roll',
    variableName: 'leadershipRoll',
    roll: { calculation: '3d6 + crewCommunication' },
    parentId: commandId,
  });

  const evasionId = makeProp({
    type: 'action',
    name: 'Evasion',
    actionType: 'action',
    summary: { text: 'Alex: Dexterity (Piloting) vs Evasion TN.' },
    description: { text: 'Phase 5: Alex dodges incoming fire. Set evasionTN to 10 + attacker\'s Sensors first.' },
  });

  makeProp({
    type: 'roll',
    name: 'Evasion Roll',
    variableName: 'evasionRoll',
    roll: { calculation: '3d6 + crewDexterity' },
    parentId: evasionId,
  });

  const rangeShiftId = makeProp({
    type: 'action',
    name: 'Range Shift',
    actionType: 'action',
    summary: { text: 'Alex: Piloting vs TN 11.' },
    description: { text: 'Phase 2: Alex shifts range band. TN 11 + Maneuverability bonus.' },
  });

  makeProp({
    type: 'roll',
    name: 'Piloting Roll',
    variableName: 'pilotingRoll',
    roll: { calculation: '3d6 + crewDexterity + maneuverability' },
    parentId: rangeShiftId,
  });

  const ewId = makeProp({
    type: 'action',
    name: 'Electronic Warfare',
    actionType: 'action',
    summary: { text: 'Naomi: Intelligence (Technology) vs TN 11.' },
    description: { text: 'Phase 3: Naomi runs EW. Generates EW Points = Drama Die on success.' },
  });

  makeProp({
    type: 'roll',
    name: 'EW Roll',
    variableName: 'ewRoll',
    roll: { calculation: '3d6 + crewIntelligence' },
    parentId: ewId,
  });

  const dcId = makeProp({
    type: 'action',
    name: 'Damage Control',
    actionType: 'action',
    summary: { text: 'Naomi/Amos: Intelligence (Engineering) TN 11.' },
    description: { text: 'Phase 7: Advanced Test. Threshold = Active Losses x 5. On completion, remove one Loss.' },
  });

  makeProp({
    type: 'roll',
    name: 'Engineering Roll',
    variableName: 'engineeringRoll',
    roll: { calculation: '3d6 + crewIntelligence' },
    parentId: dcId,
  });

  const pdId = makeProp({
    type: 'action',
    name: 'Point Defense (Torpedo Intercept)',
    actionType: 'action',
    summary: { text: 'Sensors vs TN 12 + enemy Sensors.' },
    description: { text: 'Use PDCs to shoot down incoming torpedoes. Medium or Close range only.' },
  });

  makeProp({
    type: 'roll',
    name: 'Point Defense Roll',
    variableName: 'pointDefRoll',
    roll: { calculation: '3d6 + sensors' },
    parentId: pdId,
  });

  // -- Loss Conditions --

  const enginesDamagedId = makeProp({
    type: 'toggle',
    name: 'LOSS: Engines Damaged',
    showUI: true,
    enabled: false,
    description: { text: 'Cannot shift range bands. -2 to Piloting tests.' },
  });

  makeProp({
    type: 'effect',
    name: 'Engines: -2 Piloting',
    operation: 'add',
    amount: { calculation: '-2' },
    stats: ['crewDexterity'],
    parentId: enginesDamagedId,
  });

  const sensorsDamagedId = makeProp({
    type: 'toggle',
    name: 'LOSS: Sensors Damaged',
    showUI: true,
    enabled: false,
    description: { text: '-2 to Sensor score.' },
  });

  makeProp({
    type: 'effect',
    name: 'Sensors: -2 Sensor Score',
    operation: 'add',
    amount: { calculation: '-2' },
    stats: ['sensors'],
    parentId: sensorsDamagedId,
  });

  makeProp({
    type: 'toggle',
    name: 'LOSS: Weapons Disabled',
    showUI: true,
    enabled: false,
    description: { text: 'One weapon system offline. GM specifies which.' },
  });

  makeProp({
    type: 'toggle',
    name: 'LOSS: Hull Breach',
    showUI: true,
    enabled: false,
    description: { text: 'Crew takes 1d6 damage each round unless in vacuum suits.' },
  });

  makeProp({
    type: 'toggle',
    name: 'LOSS: Collateral Damage (Pending)',
    showUI: true,
    enabled: false,
    description: { text: 'One crew member takes weapon damage. Disable after applying.' },
  });

  const commsId = makeProp({
    type: 'toggle',
    name: 'LOSS: Comms Offline',
    showUI: true,
    enabled: false,
    description: { text: 'Commander cannot use Leadership stunts. -3 Communication.' },
  });

  makeProp({
    type: 'effect',
    name: 'Comms: Commander -3 Communication',
    operation: 'add',
    amount: { calculation: '-3' },
    stats: ['crewCommunication'],
    parentId: commsId,
  });

  makeProp({
    type: 'toggle',
    name: 'LOSS: Life Support Damaged',
    showUI: true,
    enabled: false,
    description: { text: 'Time pressure: limited rounds before atmosphere critical.' },
  });

  makeProp({
    type: 'toggle',
    name: 'SHIP TAKEN OUT',
    showUI: true,
    enabled: false,
    description: { text: 'Ship is out of combat. Attacker chooses: Crippled, Helpless, or Destroyed.' },
  });

  // -- Reference Notes --

  makeProp({
    type: 'note',
    name: 'Rocinante Crew Manifest',
    description: { text: 'Captain: James Holden (Communication 3) — Command station\nPilot: Alex Kamal (Dexterity 3) — Piloting station\nEngineer: Naomi Nagata (Intelligence 3) — EW / Damage Control\nMechanic/Gunner: Amos Burton (Accuracy 2) — Weapons station\n\nThe Rocinante is a stolen MCRN Corvette-class light frigate, originally the Tachi. Rechristened by Holden after Don Quixote\'s horse. Fast, well-armed for its size, and crewed by people who care more about the ship than most navies do about their flagships.' },
  });

  // --------------------------------------------------------------------------
  // Batch insert
  // --------------------------------------------------------------------------
  console.log(`\nInserting ${allProps.length} creature properties...`);

  for (const prop of allProps) {
    try {
      CreatureProperties.insert(prop);
    } catch (e) {
      console.error(`Failed to insert prop "${prop.name}" (${prop.type}):`, e.message);
    }
  }

  // Rebuild nested sets
  try {
    const { rebuildNestedSets } = require('/imports/api/parenting/parentingFunctions');
    if (rebuildNestedSets) {
      rebuildNestedSets(CreatureProperties, creatureId);
      console.log('Rebuilt nested sets');
    }
  } catch (e) {
    console.warn('Could not auto-rebuild nested sets:', e.message);
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n========================================');
  console.log('Rocinante Sample Ship Created!');
  console.log('========================================');
  console.log(`Creature ID: ${creatureId}`);
  console.log(`Total properties: ${allProps.length}`);
  console.log('');
  console.log('Ship Stats:');
  console.log('  Hull: 15 (MCRN Corvette-class)');
  console.log('  Sensors: 3 (military-grade)');
  console.log('  Maneuverability: +1 (Epstein drive)');
  console.log('  Weapons: Rail Guns (4d6, medium), PDCs (2d6, close)');
  console.log('');
  console.log('Crew:');
  console.log('  Commander: Holden (Communication 3)');
  console.log('  Pilot: Alex (Dexterity 3)');
  console.log('  Engineer: Naomi (Intelligence 3)');
  console.log('  Gunner: Amos (Accuracy 2)');
  console.log('');
  console.log('Node breakdown:');
  const typeCounts = {};
  for (const p of allProps) {
    typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
  }
  for (const [type, count] of Object.entries(typeCounts).sort()) {
    console.log(`  ${type}: ${count}`);
  }
  console.log('');
  console.log('To use: navigate to the creature in DiceCloud UI.');
  console.log('Game system should show as "The Expanse — Ship".');

  return creatureId;
})();
