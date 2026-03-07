// ============================================================
// DiceCloud Post-Insert Fix Script
// Run this AFTER the diagnostic to repair common issues.
//
// INSTRUCTIONS:
//   1. Run diagnose-dicecloud-db.mongosh.js first
//   2. Find your user _id from section 5 of the diagnostic output
//   3. Paste it into MY_USER_ID below
//   4. Comment out any fixes you DON'T need
//   5. Run this script
//
// Usage:
//   docker exec -i dicecloud-db mongosh \
//     "mongodb://localhost:27017/test?replicaSet=rs0" \
//     --file fix-dicecloud-visibility.mongosh.js
// ============================================================

'use strict';

// ──────────────────────────────────────────────────────────────
// ★ SET THIS TO YOUR USER _id FROM THE DIAGNOSTIC OUTPUT ★
// ──────────────────────────────────────────────────────────────
const MY_USER_ID = 'PASTE_YOUR_USER_ID_HERE';

if (MY_USER_ID === 'PASTE_YOUR_USER_ID_HERE') {
  print('❌ You must set MY_USER_ID before running this script.');
  print('   Run diagnose-dicecloud-db.mongosh.js first and find your user _id in section 5.');
  quit(1);
}

print('\n' + '='.repeat(60));
print('  DiceCloud Visibility Fix Script');
print('  Using user ID: ' + MY_USER_ID);
print('='.repeat(60));

// ── FIX 1: Own all libraries that have no owner ───────────────

print('\n[FIX 1] Setting owner on ownerless libraries...');
const libOwnerResult = db.libraries.updateMany(
  { owner: { $exists: false } },
  { $set: { owner: MY_USER_ID } }
);
print(`  Updated ${libOwnerResult.modifiedCount} libraries`);

// If you want to claim ALL libraries (including ones with a different owner),
// uncomment the below instead:
// db.libraries.updateMany({}, { $set: { owner: MY_USER_ID } });

// ── FIX 2: Make all libraries public ─────────────────────────

print('\n[FIX 2] Making all libraries public...');
const libPublicResult = db.libraries.updateMany(
  { public: { $ne: true } },
  { $set: { public: true } }
);
print(`  Updated ${libPublicResult.modifiedCount} libraries`);

// ── FIX 3: Own all creatures that have no owner ───────────────

print('\n[FIX 3] Setting owner on ownerless creatures...');
const creatureOwnerResult = db.creatures.updateMany(
  { owner: { $exists: false } },
  { $set: { owner: MY_USER_ID } }
);
print(`  Updated ${creatureOwnerResult.modifiedCount} creatures`);

// ── FIX 4: Make all creatures public ─────────────────────────

print('\n[FIX 4] Making all creatures public...');
const creaturePublicResult = db.creatures.updateMany(
  { public: { $ne: true } },
  { $set: { public: true } }
);
print(`  Updated ${creaturePublicResult.modifiedCount} creatures`);

// ── FIX 5: Ensure all creatureProperties have correct root ────

print('\n[FIX 5] Checking creature property roots...');
const creatures = db.creatures.find({}, { _id: 1, name: 1 }).toArray();
creatures.forEach(c => {
  const orphaned = db.creatureProperties.countDocuments({
    'root.id': c._id,
    'root.collection': { $ne: 'creatures' }
  });
  if (orphaned > 0) {
    print(`  ⚠️  Creature "${c.name}" has ${orphaned} properties with wrong root.collection`);
    db.creatureProperties.updateMany(
      { 'root.id': c._id },
      { $set: { 'root.collection': 'creatures' } }
    );
    print('     Fixed.');
  }
});

// ── FIX 6: Ensure all libraryNodes have correct root ──────────

print('\n[FIX 6] Checking library node roots...');
const libraries = db.libraries.find({}, { _id: 1, name: 1 }).toArray();
libraries.forEach(lib => {
  const wrongRoot = db.libraryNodes.countDocuments({
    'root.id': lib._id,
    'root.collection': { $ne: 'libraries' }
  });
  if (wrongRoot > 0) {
    print(`  ⚠️  Library "${lib.name}" has ${wrongRoot} nodes with wrong root.collection`);
    db.libraryNodes.updateMany(
      { 'root.id': lib._id },
      { $set: { 'root.collection': 'libraries' } }
    );
    print('     Fixed.');
  }

  // Also check for nodes with missing root entirely
  const missingRoot = db.libraryNodes.countDocuments({
    'root.id': lib._id,
    root: { $exists: false }
  });
  if (missingRoot > 0) {
    print(`  ⚠️  Library "${lib.name}" has ${missingRoot} nodes with missing root`);
    db.libraryNodes.updateMany(
      { 'root.id': lib._id, root: { $exists: false } },
      { $set: { root: { id: lib._id, collection: 'libraries' } } }
    );
    print('     Fixed.');
  }
});

// ── FIX 7: Report nested set status ──────────────────────────

print('\n[FIX 7] Nested set status check...');
const missingNS_lib = db.libraryNodes.countDocuments({ left: { $exists: false } });
const missingNS_creature = db.creatureProperties.countDocuments({ left: { $exists: false } });

if (missingNS_lib > 0) {
  print(`  ⚠️  ${missingNS_lib} libraryNodes are missing left/right nested-set values.`);
  print('     This is a known issue with raw mongosh inserts if assignNestedSet() is incomplete.');
  print('     ');
  print('     To rebuild: the easiest fix is to run the Meteor server which triggers');
  print('     rebuildNestedSets on startup for dirty trees, OR use the manual rebuild');
  print('     in fix-nested-sets.mongosh.js (a separate utility).');
} else {
  print('  ✅ All libraryNodes have nested-set values');
}

if (missingNS_creature > 0) {
  print(`  ⚠️  ${missingNS_creature} creatureProperties are missing left/right values.`);
} else {
  print('  ✅ All creatureProperties have nested-set values');
}

// ── FIX 8: Mark all creatures dirty (force recompute) ─────────

print('\n[FIX 8] Marking all creatures dirty for recompute...');
const dirtyResult = db.creatures.updateMany(
  {},
  { $set: { dirty: true } }
);
print(`  Marked ${dirtyResult.modifiedCount} creatures dirty`);
print('  (The Meteor server will recompute these on next run)');

// ── SUMMARY ───────────────────────────────────────────────────

print('\n' + '='.repeat(60));
print('  Fix script complete.');
print('  Next steps:');
print('  1. Restart DiceCloud if it is running:');
print('       docker-compose down && docker-compose up -d');
print('  2. Open DiceCloud and check:');
print('       - Libraries visible in the Library Market / Build tab');
print('       - Creatures visible in the character list');
print('  3. If libraries still not visible, add DEFAULT_LIBRARIES to docker-compose.yml:');

const libIds = db.libraries.find({}, { _id: 1, name: 1 }).toArray();
if (libIds.length > 0) {
  const idList = libIds.map(l => l._id).join(',');
  print('       - DEFAULT_LIBRARIES=' + idList);
  print('     Library names:');
  libIds.forEach(l => print('       ' + l._id + '  "' + l.name + '"'));
}

print('='.repeat(60) + '\n');
