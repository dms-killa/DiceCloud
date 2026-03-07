// ============================================================
// Manual Nested-Set Rebuild for DiceCloud Libraries
//
// Use this when libraryNodes are missing left/right values,
// which causes the tree to not render in the UI.
//
// This reimplements DiceCloud's calculateNestedSetOperations
// logic in plain mongosh JS.
//
// Usage:
//   docker exec -i dicecloud-db mongosh \
//     "mongodb://localhost:27017/test?replicaSet=rs0" \
//     --file fix-nested-sets.mongosh.js
// ============================================================

'use strict';

function rebuildNestedSets(collection, rootId) {
  // Fetch all nodes for this root
  const nodes = collection.find(
    { 'root.id': rootId },
    { _id: 1, parentId: 1, name: 1, type: 1 }
  ).toArray();

  if (nodes.length === 0) {
    print(`  (no nodes for root ${rootId})`);
    return;
  }

  // Build a parent→children map
  const childrenOf = {};
  const nodeById = {};
  nodes.forEach(n => {
    nodeById[n._id] = n;
    const pid = n.parentId || '__ROOT__';
    if (!childrenOf[pid]) childrenOf[pid] = [];
    childrenOf[pid].push(n._id);
  });

  // DFS to assign left/right
  let counter = 0;
  const updates = [];

  function visit(nodeId) {
    counter++;
    const left = counter;
    const children = childrenOf[nodeId] || [];
    children.forEach(childId => visit(childId));
    counter++;
    const right = counter;
    updates.push({ id: nodeId, left, right });
  }

  // Find true roots (parentId is null/undefined or parentId not in this set)
  const nodeIds = new Set(nodes.map(n => String(n._id)));
  const roots = nodes.filter(n => {
    if (!n.parentId) return true;
    return !nodeIds.has(String(n.parentId));
  });

  if (roots.length === 0) {
    print(`  ⚠️  No root nodes found for ${rootId} — possible circular reference`);
    return;
  }

  roots.forEach(r => visit(String(r._id)));

  // Apply updates
  let updated = 0;
  updates.forEach(u => {
    const result = collection.updateOne(
      { _id: u.id },
      { $set: { left: u.left, right: u.right } }
    );
    if (result.modifiedCount > 0) updated++;
  });

  print(`  Rebuilt nested sets: ${updated}/${nodes.length} nodes updated`);

  // Verify
  const stillMissing = collection.countDocuments({
    'root.id': rootId,
    left: { $exists: false }
  });
  if (stillMissing > 0) {
    print(`  ⚠️  ${stillMissing} nodes still missing left/right after rebuild`);
  } else {
    print(`  ✅ All nodes now have valid nested-set values`);
  }
}

// ── Run rebuild on all libraries ─────────────────────────────

print('\n' + '='.repeat(60));
print('  Nested-Set Rebuild Utility');
print('='.repeat(60));

print('\n[1] Rebuilding libraryNodes nested sets...');
const libraries = db.libraries.find({}, { _id: 1, name: 1 }).toArray();

if (libraries.length === 0) {
  print('  No libraries found.');
} else {
  libraries.forEach(lib => {
    print(`\n  Library: "${lib.name}" (${lib._id})`);
    rebuildNestedSets(db.libraryNodes, lib._id);
  });
}

print('\n[2] Rebuilding creatureProperties nested sets...');
const creatures = db.creatures.find({}, { _id: 1, name: 1 }).toArray();

if (creatures.length === 0) {
  print('  No creatures found.');
} else {
  creatures.forEach(c => {
    const missingCount = db.creatureProperties.countDocuments({
      'root.id': c._id,
      left: { $exists: false }
    });
    if (missingCount > 0) {
      print(`\n  Creature: "${c.name}" (${c._id}) — ${missingCount} nodes missing NS values`);
      rebuildNestedSets(db.creatureProperties, c._id);
    }
  });
  print('  ✅ Creature property check complete');
}

print('\n[3] Marking all creatures dirty for recompute...');
const dirtyResult = db.creatures.updateMany({}, { $set: { dirty: true } });
print(`  Marked ${dirtyResult.modifiedCount} creatures dirty`);

print('\n' + '='.repeat(60));
print('  Rebuild complete. Restart DiceCloud to trigger recompute.');
print('='.repeat(60) + '\n');
