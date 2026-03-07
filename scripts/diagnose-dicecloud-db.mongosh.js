// ============================================================
// DiceCloud DB Diagnostic Script
// Checks current state of libraries, library nodes, and creatures
// inserted via raw mongosh, and flags known visibility failure modes.
//
// Usage:
//   docker exec -i dicecloud-db mongosh \
//     "mongodb://localhost:27017/test?replicaSet=rs0" \
//     --file diagnose-dicecloud-db.mongosh.js
//
// If your db is named "test" not "meteor", change the URL above.
// ============================================================

'use strict';

const SEPARATOR = '='.repeat(60);
const SEP_MINOR = '-'.repeat(40);

function section(title) {
  print('\n' + SEPARATOR);
  print('  ' + title);
  print(SEPARATOR);
}

function minor(title) {
  print('\n' + SEP_MINOR);
  print('  ' + title);
  print(SEP_MINOR);
}

// ── 1. LIBRARIES ───────────────────────────────────────────────

section('1. ALL LIBRARIES IN DB');

const libraries = db.libraries.find({}, {
  name: 1, description: 1, owner: 1, public: 1,
  gameSystem: 1, readers: 1, writers: 1
}).toArray();

if (libraries.length === 0) {
  print('  ⚠️  NO LIBRARIES FOUND — inserts may have failed or used wrong db');
} else {
  libraries.forEach((lib, i) => {
    print(`\n  [${i + 1}] _id:        ${lib._id}`);
    print(`       name:       ${lib.name}`);
    print(`       owner:      ${lib.owner || '(none — PROBLEM: must have owner)'}`);
    print(`       public:     ${lib.public}`);
    print(`       gameSystem: ${lib.gameSystem || '(not set)'}`);
    print(`       readers:    ${JSON.stringify(lib.readers || [])}`);

    // Flag known issues
    if (!lib.owner) {
      print('       ❌ MISSING owner — DiceCloud methods set this automatically; raw insert skipped it');
      print('          FIX: db.libraries.updateOne({_id: "' + lib._id + '"}, {$set: {owner: "<your-user-id>"}})');
    }
    if (lib.public !== true) {
      print('       ⚠️  public is not true — library only visible to owner/readers');
      print('          FIX if needed: db.libraries.updateOne({_id: "' + lib._id + '"}, {$set: {public: true}})');
    }
  });
}

// ── 2. LIBRARY NODE COUNTS ─────────────────────────────────────

section('2. LIBRARY NODE COUNTS PER LIBRARY');

libraries.forEach(lib => {
  const count = db.libraryNodes.countDocuments({ 'root.id': lib._id });
  const rootNodes = db.libraryNodes.countDocuments({ 'root.id': lib._id, parentId: null });
  print(`  "${lib.name}" (${lib._id}): ${count} total nodes, ${rootNodes} root-level nodes`);
  if (count === 0) {
    print('    ❌ NO NODES — library exists but has no content');
  }
});

// ── 3. NESTED SET VALIDITY CHECK ───────────────────────────────

section('3. NESTED SET VALIDITY CHECK (per library)');

libraries.forEach(lib => {
  minor(`Library: "${lib.name}"`);

  const nodes = db.libraryNodes.find(
    { 'root.id': lib._id },
    { _id: 1, name: 1, type: 1, parentId: 1, left: 1, right: 1, 'root.id': 1 }
  ).toArray();

  if (nodes.length === 0) { print('  (no nodes)'); return; }

  let issues = 0;

  nodes.forEach(n => {
    if (n.left === undefined || n.right === undefined) {
      print(`  ❌ Node "${n.name}" (${n._id}) MISSING left/right — nested set not built`);
      issues++;
    } else if (n.left >= n.right) {
      print(`  ❌ Node "${n.name}" left(${n.left}) >= right(${n.right}) — invalid`);
      issues++;
    }
    if (!n['root'] || !n['root'].id) {
      print(`  ❌ Node "${n.name}" missing root.id`);
      issues++;
    }
  });

  // Check for missing left/right entirely
  const missingNS = nodes.filter(n => n.left === undefined || n.right === undefined);
  if (missingNS.length > 0) {
    print(`  ⚠️  ${missingNS.length}/${nodes.length} nodes missing nested-set values`);
    print('     This is the most common cause of nodes not appearing in the UI tree.');
    print('     FIX: The nested set needs to be rebuilt. See section 6 for the fix query.');
  }

  if (issues === 0) {
    print(`  ✅ All ${nodes.length} nodes have valid left/right values`);
  }

  // Sample a few nodes for inspection
  print('\n  First 5 nodes (sorted by left):');
  const sorted = nodes.filter(n => n.left !== undefined).sort((a, b) => a.left - b.left).slice(0, 5);
  sorted.forEach(n => {
    print(`    [${n.left}–${n.right}] ${n.type.padEnd(14)} "${n.name}" parent=${n.parentId || 'null'}`);
  });
});

// ── 4. CREATURES ───────────────────────────────────────────────

section('4. CREATURES IN DB');

const creatures = db.creatures.find({}, {
  name: 1, type: 1, gameSystem: 1, owner: 1, settings: 1
}).toArray();

if (creatures.length === 0) {
  print('  (no creatures found)');
} else {
  creatures.forEach((c, i) => {
    print(`\n  [${i + 1}] _id:        ${c._id}`);
    print(`       name:       ${c.name}`);
    print(`       type:       ${c.type}`);
    print(`       gameSystem: ${c.gameSystem || '(not set)'}`);
    print(`       owner:      ${c.owner || '(none)'}`);
    if (!c.owner) {
      print('       ❌ MISSING owner — creature won\'t be visible to any user');
    }
  });
}

// ── 5. USER ACCOUNTS ───────────────────────────────────────────

section('5. USER ACCOUNTS (for owner ID reference)');

const users = db.users.find({}, {
  username: 1, 'emails.address': 1, createdAt: 1
}).toArray();

if (users.length === 0) {
  print('  ⚠️  No users found — have you created an account in DiceCloud?');
} else {
  users.forEach((u, i) => {
    const email = u.emails?.[0]?.address || '(no email)';
    print(`  [${i + 1}] _id: ${u._id}  username: ${u.username || '(none)'}  email: ${email}`);
  });
}

// ── 6. SUBSCRIPTION VISIBILITY CHECK ──────────────────────────

section('6. SUBSCRIPTION / VISIBILITY ANALYSIS');

print('\n  DiceCloud shows libraries to a user if ANY of these are true:');
print('  a) library.owner === userId');
print('  b) library.readers includes userId');
print('  c) library.public === true');
print('  d) library._id is in DEFAULT_LIBRARIES env var\n');

if (users.length > 0 && libraries.length > 0) {
  users.forEach(u => {
    print(`  User: ${u._id} (${u.emails?.[0]?.address || u.username || 'unknown'})`);
    libraries.forEach(lib => {
      const isOwner = lib.owner === u._id;
      const isReader = (lib.readers || []).includes(u._id);
      const isPublic = lib.public === true;
      const visible = isOwner || isReader || isPublic;
      const reasons = [
        isOwner ? 'owner' : null,
        isReader ? 'reader' : null,
        isPublic ? 'public' : null,
      ].filter(Boolean).join(', ') || 'NONE';
      print(`    Library "${lib.name}": ${visible ? '✅ visible' : '❌ NOT VISIBLE'} (${reasons})`);
    });
  });
}

// ── 7. QUICK FIX COMMANDS ──────────────────────────────────────

section('7. QUICK FIX COMMANDS (copy-paste as needed)');

print('\n  A) Make all libraries public (visible to everyone):');
print('     db.libraries.updateMany({}, {$set: {public: true}})');

print('\n  B) Set owner on all libraries to a specific user ID:');
print('     // Replace USER_ID_HERE with the _id from section 5');
print('     db.libraries.updateMany({owner: {$exists: false}}, {$set: {owner: "USER_ID_HERE"}})');

print('\n  C) Set owner on all ownerless creatures:');
print('     db.creatures.updateMany({owner: {$exists: false}}, {$set: {owner: "USER_ID_HERE"}})');

print('\n  D) Make all creatures public:');
print('     db.creatures.updateMany({}, {$set: {public: true}})');

print('\n  E) Check if nested sets need rebuilding (count nodes with missing left/right):');
print('     db.libraryNodes.countDocuments({left: {$exists: false}})');
print('     db.creatureProperties.countDocuments({left: {$exists: false}})');

print('\n  F) Add DEFAULT_LIBRARIES to docker-compose.yml environment:');
print('     Copy the library _id values from section 1 and add:');
print('     - DEFAULT_LIBRARIES=libId1,libId2');
print('     Then docker-compose down && docker-compose up -d');

print('\n' + SEPARATOR);
print('  Diagnostic complete.');
print(SEPARATOR + '\n');
