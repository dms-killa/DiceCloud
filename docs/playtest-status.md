# DiceCloud Playtest Status

Tracks UI verification results after each major DB or code change. Each section
covers one verification pass with date and tester.

---

## Phase 3B — Computation Engine Fix

**Date:** 2026-03-07
**Status:** Infrastructure changes applied — browser verification pending

### Root Cause Identified

The Meteor computation engine was not triggering. Without `MONGO_OPLOG_URL`,
Meteor falls back to polling (slow, unreliable in production). The `dirty` flag
on creatures was being set correctly by write methods but the server-side
`observeChanges` on the `Creatures` collection was not firing promptly enough
to trigger `computeCreature()`.

**Key architectural note:** `loadCreature()` is only called from the
`singleCharacter` and `tabletops` publications. Computation only runs while a
client has a character sheet subscribed. The dirty flag test (mark dirty via
mongosh, check if it clears) is only valid when a client is actively viewing
that creature.

### Changes Applied

| Action | Result |
|--------|--------|
| Added `--replSet=rs0` to MongoDB command in `docker-compose.yml` | ✅ |
| Removed MongoDB auth (`MONGO_INITDB_ROOT_*` env vars removed) | ✅ |
| Added `MONGO_OPLOG_URL` to dicecloud service environment | ✅ |
| Updated `MONGO_URL` to include `?replicaSet=rs0` (no credentials) | ✅ |
| Initialized replica set: `rs.initiate({_id:"rs0",...})` | ✅ |
| RS status PRIMARY, oplog collection exists | ✅ |
| All data intact after restart (2 libs, 94 nodes, 10 creatures, 2 users) | ✅ |
| Updated all `scripts/*.mongosh.js` header connection strings | ✅ |
| Updated `ENVIRONMENTS.md` with new no-auth connection strings | ✅ |

### Verification Needed (browser)

Open `http://mediaroom.lan:4000` as bill or david:

| Check | Status | Notes |
|-------|--------|-------|
| Log in as bill or david | ⬜ pending | |
| Open an existing character sheet (e.g. holden) | ⬜ pending | |
| Edit a stat value (e.g. set Dexterity to 5) | ⬜ pending | |
| Displayed value updates without page reload | ⬜ pending | Key test |
| Open a ship creature (Rocinante) | ⬜ pending | |
| Edit crew_quality — weapon rolls update | ⬜ pending | |

---

## Phase 3A — DB Cleanup & Initial Verification

**Date:** 2026-03-07
**DB state:** Post-cleanup (see Phase 3A notes below)
**Tester:** Pending manual verification

### DB Cleanup Completed

| Action | Result |
|--------|--------|
| Deleted "expanse test" empty library (`NTj8bgtPtxs43T6be`) from `test` | ✅ |
| Wiped stale data from `meteor` DB (6 libs, 292 nodes, 2 creatures) | ✅ |
| `docker-compose.yml` already had correct `DEFAULT_LIBRARIES` | ✅ (no change needed) |
| `ENVIRONMENTS.md` created at repo root | ✅ |

**test DB state after cleanup:**
- Library: "The Expanse RPG — AGE System" (`dslPyPFcULEH4kKOE`) — 52 nodes, public ✅
- Library: "The Expanse RPG — Ship" (`wAb7GUFHJpzINOjvU`) — 42 nodes, public ✅
- Creatures: 10 (Rocinante, holden, amos, bobbi, naomi, miller, fred, roci, bob, tom)
- Total library nodes: 94

**meteor DB state:** Empty (0 libraries, 0 nodes, 0 creatures) ✅

---

### 3a. Library Visibility

| Check | Status | Notes |
|-------|--------|-------|
| Both libraries appear in Library Market / Build tab | ⬜ pending | |
| AGE System library shows nodes when browsed | ⬜ pending | |
| Ship library shows nodes when browsed | ⬜ pending | |

### 3b. Expanse Character — Create and Fill

| Check | Status | Notes |
|-------|--------|-------|
| Create new PC character | ⬜ pending | |
| Build tab — Ruleset slot is present | ⬜ pending | |
| Fill Ruleset slot from AGE System library | ⬜ pending | |
| Stats tab shows Expanse ability scores (Accuracy, Communication, Constitution, Dexterity, Fighting, Intelligence, Perception, Willpower) | ⬜ pending | |
| Derived stats computed (no errors in Tree tab) | ⬜ pending | |
| Fortune health bar visible | ⬜ pending | |
| Ability rolls present in Actions tab | ⬜ pending | |
| Existing character "holden" (david) shows correct stats | ⬜ pending | |

### 3c. Expanse Ship — Create and Fill

| Check | Status | Notes |
|-------|--------|-------|
| Create new NPC/creature | ⬜ pending | |
| Fill Ruleset slot from Ship library | ⬜ pending | |
| Stats tab shows ship stats (Hull Rating, Sensors, Communications, Handling) | ⬜ pending | |
| Damage Track health bar visible | ⬜ pending | |
| Weapon actions appear in Actions tab | ⬜ pending | |
| Existing creature "Rocinante" (bill) shows correct stats | ⬜ pending | |

### 3d. Computed Values

| Check | Status | Notes |
|-------|--------|-------|
| Set Accuracy to 3 on an Expanse character — derived stats update | ⬜ pending | |
| Ship weapon attack roll references crew stats correctly | ⬜ pending | |
| Tree tab — no red error nodes | ⬜ pending | |

### 3e. LOSS Conditions (Ship)

| Check | Status | Notes |
|-------|--------|-------|
| LOSS condition toggles visible | ⬜ pending | |
| Toggling "Weapons Damaged" applies -2 to accuracy_crew | ⬜ pending | |
| Toggling off removes the effect | ⬜ pending | |

---

## Known Issues / Blockers

*None recorded yet — update after manual verification pass.*

---

## Previous Verification Passes

### VH-004 (2026-03-06) — Docker Migration

Verified that Expanse character and ship libraries insert correctly via the
slot-fill mechanism. Five bugs found and fixed (see CLAUDE.md "Fixed Bugs"
section). Confirmed working state:

- Expanse character sheet: Skills, Attributes, Fortune visible on Character tab ✅
- Actions tab: dice roll actions present ✅
- Short/Long rest buttons hidden automatically ✅
- Roll actions show "Deactivated by ancestor" on child roll node — EXPECTED ✅
- Root bug fix confirmed: `root.collection: 'creatures'` on all inserted properties ✅
