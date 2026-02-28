# The Expanse RPG — DiceCloud Playtest Guide

## Overview

The Expanse RPG in DiceCloud uses two creature types:
- **Character sheets** (`expanse` game system, future) for individual crew members
- **Ship sheets** (`expanse-ship` game system) for shared ship combat tracking

This guide covers the ship combat system implemented in VH-003b.

## Ship Setup

### Creating a Ship

1. Create a new creature in DiceCloud
2. Open creature settings (pencil icon)
3. Set **Game System** to "The Expanse — Ship"
4. Import properties from the "The Expanse - Ship Systems" library, OR run
   `scripts/create-expanse-sample-ship.js` for the pre-built Rocinante

### Setting Ship Stats

Edit these stats to match your ship:
- **Hull Rating** — Damage resistance (average of hull dice, e.g., 10 for 3d6, 14 for 4d6)
- **Sensors** — Adds to attack TN and Point Defense
- **Maneuverability** — Bonus to Piloting tests (-2 to +2 typical)

### Pre-Combat Crew Setup

Before combat, set these stats on the **ship sheet** to match crew members' ability scores:
- **Commander Communication** → ship's "Commander Communication" stat
- **Pilot Dexterity** → ship's "Pilot Dexterity" stat
- **Engineer Intelligence** → ship's "Engineer Intelligence" stat
- **Gunner Accuracy** → ship's "Gunner Accuracy" stat

Also set:
- **Evasion TN** → 10 + enemy ship's Sensors score
- **Range Band** → starting range (0=Long, 1=Medium, 2=Close)

## Ship Combat

### Round Structure (7 Phases)

**1. Command**
Commander rolls Communication (Leadership) from the ship's Combat tab.
TN 11. On success, note the Drama Die value — that many SP can be spent by ANY
crew member this round.

Command Stunts (spend SP):
- 1+ Guidance: +1 to a chosen ship combat test per SP spent
- 2 Fire for Effect: +1d6 damage on the next successful weapon attack
- 3 Sensor Lock: Target cannot evade this round
- 4+ Set-Up: Force enemy ship into a hazard (damage dice = SP/2)

**2. Maneuvers**
Pilot declares current range and intended shift.
Roll Dexterity (Piloting) from ship's Combat tab. TN 11, plus Maneuverability bonus.
On success: shift one range band. Adjust `rangeBand` stat manually.

High-G burn option: add +2 to evasion rolls, but each crew member rolls
Constitution (Stamina) TN 13 on their own character sheet or takes 1d6 damage.

**3. Electronic Warfare**
EW Officer rolls Intelligence (Technology) from ship's Combat tab.
TN 11. Success generates EW Points = Drama Die value.
Spend EW Points to add to defensive TN rolls this round.
Track EW Points on paper.

**4. Weapon Attacks**
Gunner selects weapon system from ship's Combat tab and rolls:
- **Long range (0):** Torpedoes only (3d6+3 damage, can be intercepted by PDCs)
- **Medium range (1):** Rail guns (4d6 damage) + Torpedoes
- **Close range (2):** All weapons including PDCs (2d6 damage)

All attacks: 3d6 + Gunner Accuracy vs TN 11 + enemy ship's Sensors.

**5. Defensive Actions**
Two options:
- **Evasion:** Pilot rolls Dexterity (Piloting) vs Evasion TN.
  First set `evasionTN` on ship sheet to: 10 + attacking ship's Sensors.
- **Point Defense:** Roll 3d6 + Sensors vs TN 12 + enemy Sensors to shoot down
  incoming torpedoes. Available at medium/close range only.

**6. Attack Damage**
When a hit lands:
1. Roll weapon damage dice
2. Subtract target ship's Hull Rating
3. If damage remains: ship may take up to 2 Loss conditions (each reduces damage by 1d6)
4. Toggle the Loss condition on the ship sheet — effects apply automatically
5. If damage STILL remains after 2 Losses: ship is Taken Out
6. Increment the "Active Losses" counter for Damage Control threshold tracking

**7. Damage Control**
Engineer rolls Intelligence (Engineering) from ship's Combat tab.
TN 11, Advanced Test: accumulate successes across rounds until threshold
(Active Losses × 5) is met. On completion, remove one Loss condition
(toggle it off on the ship sheet, decrement Active Losses counter).
Track accumulated successes on paper.

### Loss Conditions

When a ship takes a Loss, choose one and toggle it on the ship sheet:

| Loss | Mechanical Effect | Auto-applied? |
|------|-------------------|---------------|
| Engines Damaged | Cannot shift range, -2 Piloting | Yes (-2 to crewDexterity) |
| Sensors Damaged | -2 to attack rolls, EW, Point Defense | Yes (-2 to sensors) |
| Weapons Disabled | One weapon system offline | Manual (GM specifies which) |
| Hull Breach | Crew takes 1d6/round without suits | Manual |
| Collateral Damage | One crew member takes weapon damage | Manual |
| Comms Offline | Commander can't use Leadership stunts | Yes (-3 to crewCommunication) |
| Life Support | Time pressure, limited rounds | Manual |

Two active Losses = heavily damaged. Further unabsorbed damage = Taken Out.

### Taken Out

When a ship is Taken Out, toggle "SHIP TAKEN OUT" on the ship sheet.
Attacker chooses:
- **Crippled** — Ship adrift, no thrust, must be towed
- **Helpless** — Ship can be boarded, crew at attacker's mercy
- **Destroyed** — Ship explodes, crew has moments to evacuate

## Sample Ship: The Rocinante

```
Hull: 15 | Sensors: 3 | Maneuverability: +1 | Attack TN: 14
Weapons: Rail Guns (4d6, medium+), PDCs (2d6, close)
Crew: Holden (Comm 3), Alex (Dex 3), Naomi (Int 3), Amos (Acc 2)
```

Run `scripts/create-expanse-sample-ship.js` to create this ship in your instance.

## Multi-Tab Workflow

Ship combat works best with multiple browser tabs:
1. **Ship tab** — The Rocinante (or your ship) for ship-scale rolls and Loss tracking
2. **Character tabs** — One per crew member for personal ability checks
3. *(Optional)* **Enemy ship tab** — If running ship-vs-ship, open a second ship creature

During combat:
- Ship-scale rolls (gunnery, piloting, command) use the **ship's** Combat tab
- Personal rolls (Constitution checks for high-G burns) use **character** sheets
- Loss conditions are toggled on the **ship** sheet

## Known Limitations (VH-003b)

- Crew stats must be copied manually to the ship sheet before combat (no live link)
- EW Points are tracked on paper (no dedicated resource for per-round tracking)
- Damage Control Advanced Test accumulation is tracked on paper
- Range band is a number (0/1/2) — no automatic weapon availability enforcement
- Ship-to-ship combat requires two browser tabs (one per ship)
- High-G Constitution checks are triggered manually on character sheets
- Command SP are tracked as a resource but must be reset manually each round
