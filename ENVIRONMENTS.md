# DiceCloud Environment & Database Conventions

This document defines the environment strategy for the DiceCloud multi-system
extensibility project. All contributors and tooling (including Claude Code) must
follow these conventions.

---

## Database Environments

| Database | Purpose | When to use |
|----------|---------|-------------|
| `test`   | **Active development / playtesting** | All day-to-day work. Live Docker instance. Real user accounts (bill, david). This is where the Expanse libraries and creatures live. |
| `meteor` | **Clean production baseline** | Reserved for a stable, verified snapshot. Nothing should be inserted here during active development. |

### Connection Strings

**Development (test) — no auth, replica set rs0:**
```
mongodb://localhost:27017/test?replicaSet=rs0
```

**From host machine (via docker exec):**
```
docker exec -i dicecloud-db mongosh "mongodb://localhost:27017/test?replicaSet=rs0" --eval '...'
```

### Why no authentication?

MongoDB auth was removed in Phase 3B (2026-03-07). MongoDB requires a keyfile
for auth + replica sets, which complicates local dev. Since the DB port is not
exposed to the host network (no `ports:` mapping on `dicecloud-db`), there is no
security risk on a LAN-only dev machine. The replica set (`--replSet=rs0`) is
required for Meteor's oplog tailing to work.

### Why `test` and not `meteor`?

`MONGO_URL` in `docker-compose.yml` specifies `/test` explicitly:
```
MONGO_URL=mongodb://dicecloud-db:27017/test?replicaSet=rs0
```
The `meteor` database in the same MongoDB instance is a stale artifact —
treat it as scratch and do not insert into it.

---

## All mongosh Scripts

Every script in `scripts/` must use the `test` database with `replicaSet=rs0`.
The correct header comment for all scripts is:

```js
// Usage:
//   docker exec -i dicecloud-db mongosh \
//     "mongodb://localhost:27017/test?replicaSet=rs0" \
//     < scripts/<script-name>.mongosh.js
```

No credentials are needed — MongoDB auth was removed in Phase 3B.
Scripts that connect to `meteor` instead of `test`, or that use auth credentials,
should be corrected before use.

---

## User Accounts

| Username | User ID | Role |
|----------|---------|------|
| bill | `7xLjqzjvPB7tMht7g` | Primary developer / DM |
| david | `b67ZdSyHj353maZu6` | Player / playtester |

These IDs are stable as long as the Docker volume is not wiped. If the volume
is wiped, user IDs will change and all library `owner` fields will need to be
updated via `scripts/fix-dicecloud-visibility.mongosh.js`.

---

## Current Library IDs (test database)

| Library | ID | Purpose |
|---------|----|---------|
| The Expanse RPG — AGE System | `dslPyPFcULEH4kKOE` | Character ruleset |
| The Expanse RPG — Ship | `wAb7GUFHJpzINOjvU` | Ship stat block template |

These IDs are set in `docker-compose.yml` as `DEFAULT_LIBRARIES` so both
libraries auto-subscribe for all users on login.

---

## docker-compose.yml Environment Variables

The following variables must be set for correct operation:

```yaml
environment:
  - ROOT_URL=http://mediaroom.lan:4000
  - MONGO_URL=mongodb://dicecloud-db:27017/test?replicaSet=rs0
  - MONGO_OPLOG_URL=mongodb://dicecloud-db:27017/local?replicaSet=rs0
  - PORT=3000
  - NODE_ENV=production
  - METEOR_SETTINGS={"public":{"environment":"production","disablePatreon":true}}
  - DEFAULT_LIBRARIES=dslPyPFcULEH4kKOE,wAb7GUFHJpzINOjvU
```

`MONGO_OPLOG_URL` enables Meteor's oplog tailing, which is required for the
computation engine to detect dirty creatures and recompute them reactively.
Without it, Meteor falls back to slow polling and stat changes may not update
the UI.

`DEFAULT_LIBRARIES` ensures the Expanse libraries are visible to all users
without requiring manual subscription. Update this list when new canonical
libraries are added.

---

## Adding New Canonical Libraries

When a new library (e.g., a ship class, a new game system) is ready to be
part of the default experience:

1. Insert via the appropriate `scripts/insert-*.mongosh.js` script against `test`
2. Note the new library `_id` from the insert output
3. Add the `_id` to `DEFAULT_LIBRARIES` in `docker-compose.yml`
4. Update the table above in this document
5. Commit both `docker-compose.yml` and `ENVIRONMENTS.md` together

---

## The `meteor` Database — Status

The `meteor` database was wiped as part of the Phase 3A cleanup (2026-03-07).
It should remain empty unless intentionally promoted as a production snapshot.
Do not insert data into it during active development.
