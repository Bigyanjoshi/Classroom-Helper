# Classroom Randomizer (`ClassCards`)

A **100% local-first, offline-capable classroom mystery card randomizer, quick attendance tracker, team builder, and 3D avatar studio** built with React 19, TypeScript, Tailwind CSS v4, and IndexedDB (Dexie).

> **Research & Full Technical Blueprint:** See **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** for the complete system blue map—including architecture diagrams, Dexie v2 schemas, every domain/service function, state machine transitions, fairness math, responsive layout & pagination equations, CIELAB photo processing, and V2 chunked `.classpack` encryption.

---

## Key Capabilities

- **4-Hub Warm Ivory Workspace (`src/App.tsx`)**
  - **Classes**, **Roster & 3D Studio**, **Decks & History**, and **Backup & Settings** organized into a slim `md:w-56` desktop left rail, 4-tab mobile portrait bottom navigation, and a compact top bar with logical Back navigation.
  - Canonical **Warm Ivory** daylight theme (`#FAF6EE` canvas, `#FFFFFF` cards, `#231C16` espresso ink, `#D65A31` terracotta, `#2F7D5B` sage) with offline-bundled `@fontsource` fonts (`Fredoka`, `Plus Jakarta Sans`, `JetBrains Mono`).
- **3-Tap Launchpad -> Attendance -> Mystery Deck Flow**
  - **Classes Launchpad (`DashboardPage`):** Clean class cards with `Start Session` / `Resume Session`.
  - **Quick Attendance (`AttendancePage`):** Natural roll-sorted (`1, 2, 10`) roster where everyone starts Present; tap or type comma/space-separated roll numbers (`parseRollNumberInput`) with inline unknown/duplicate roll validation and a sticky footer.
  - **Activity Dock (`ActivityCenterPage`):** 5 primary activity cards with `Mystery Pick` auto-focused plus an expandable `More Activities` drawer (`Mystery Reward / Challenge`), paired with fairness & repeat toggles.
- **Single-Screen Mystery Card Deck (`MysteryDeckPage` & `CinematicRevealOverlay`)**
  - **Cinematic Mystery Reveal (~3.5s Spotlight -> Auto-Selected):** Tapping a hidden card lifts that exact card from its deck slot into a full-screen spotlight with a realistic 3D flip (`rotateY`), reveals the student's avatar, name, roll number, and class for ~3.5 seconds with a celebration pulse and optional sound/haptics, then automatically animates the card into the Selected Students panel (or mobile drawer).
  - **Dynamic Mystery Card Grid Resizing (`deckLayout.ts`):** Whenever a selected card leaves the deck, empty grid spaces are removed immediately—recalculating optimal columns, rows, proportional card dimensions (`0.68–0.92` aspect), and centered last-row spacing via `ResizeObserver`, while smoothly animating remaining cards via GPU-composited FLIP transitions until the final card is selected.
  - **Safe Cancel & Rapid-Tap Protection:** A visible `Cancel Reveal (Esc)` button returns the card face down (`hidden`) without recording a selection; synchronous transition locks + `pending_reveal` persistence prevent double-picks and recover mid-reveal across page reloads.
  - **DOM Privacy Guard:** Student names, roll numbers, and avatars are never mounted into the DOM while cards are `hidden`.
  - **Single-Screen Auto-Fit, Landscape Support & Smart Pagination (`deckLayout.ts`):** Uses `ResizeObserver` + `computeDeckPagination()` so cards fit inside one viewport (`h-dvh overflow-hidden`) across desktop, portrait mobile, and rotated mobile landscape (`844×390`+), automatically adding quick page tabs (`1–N`) only if cards would fall below the `28px` touch floor.
  - **Classroom Ergonomics:** Projector fullscreen mode (`F`), Web Audio cues + optional `navigator.vibrate()` haptics, `Switch Activity`, `Undo` (`Z`), `Reset Shuffle`, `Space` to shuffle.
- **Fairness Engine & Balanced Team Builder (`src/domain/eligibility.ts`)**
  - **Pure Random** (Web Crypto rejection sampling `1/N`), **Balanced** (`1 / (1 + count)`), and **Least Recent** (oldest-first ranking, scoped to current session, recent 5 sessions, or all local history).
  - **Team Builder (`GroupGeneratorPage`):** Splits present students by team count or target size with live click-to-swap between teams, printable output, and saved selection history.
- **Fair 3D Avatars & Local CIELAB Photo Stylizer (`avatarGenerator.ts`, `photoProcessor.ts`)**
  - **Classroom Mascots** (default for new students: Owl, Fox, Panda, Spark Bot, Star Explorer, Sunny Sprout) so cards stay playful without skin-tone or gender inference.
  - **Human Characters with Explicit Monk Skin Tone (MST 1–10):** Teachers manually pick any MST swatch (`1–10`) in the **3D Avatar Studio**; `"Randomize Outfit (Keeps Skin Tone)"` updates hair/outfit/accessories without touching skin tone.
  - **Legacy Preservation:** Existing v1 avatars retain `avatarKind: 'legacy'` unless edited by the teacher.
  - **On-Device CIELAB (`L*a*b*`) Photo Cartoonizer:** Smooths luminance while preserving original `a*`/`b*` chrominance channels, writes `256×256` card thumbnails + `512×512` studio portraits (WebP with PNG fallback), checks average ΔE (`avgDeltaE`) as an honest local safeguard, and lets teachers delete retained originals individually.
- **Offline PWA & V2 Chunked Encrypted Backups (`db.ts`, `cryptoBackup.ts`)**
  - Non-destructive Dexie `version(2)` migration + Workbox precaching + storage quota telemetry.
  - Password-protected `.classpack` V2 backups using **PBKDF2-SHA512 (600,000 iterations) + chunked AES-GCM-256** (`512 KB` default chunks bound via per-chunk AAD) with live progress, `AbortController` cancellation, SHA-256 verification, and backward-compatible V1 `.classpack` restore.

---

## Project Structure Quick Index

| Directory / File | Role |
| :--- | :--- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Complete system blue map, function catalog, Dexie v2 schema, diagrams, and maintenance checklist |
| [`src/App.tsx`](./src/App.tsx) | Top-level state hydration, 4-hub navigation rail/bottom-nav shell, route stack, and shared modals |
| [`src/domain/`](./src/domain) | Pure, unit-tested TypeScript logic (CSPRNG, fairness, deck FSM, grid/pagination math, 3D SVGs, CSV, Dexie migration, V1/V2 crypto) |
| [`src/services/`](./src/services) | Dexie v2 IndexedDB schema, starter seeding, Canvas 2D CIELAB cartoonizer, Web Audio/haptics, exports, PWA hooks |
| [`src/components/`](./src/components) | 3D flip cards, clue-free card backs, avatar/blob renderer, and CSV/XLSX/Photo modals |
| [`src/pages/`](./src/pages) | Hub wrappers (`RosterStudioHubPage`, `DecksHistoryHubPage`) + 12 classroom workflow pages |

---

## Development & Verification Commands

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Type-check TypeScript
npm run lint

# Run all pure domain & service unit tests (21 passing tests via node:test + tsx)
npx --yes tsx --test src/domain/*.test.ts src/services/*.test.ts

# Build production bundle + Workbox PWA service worker into dist/
npm run build
```

---

## Privacy & Local Storage Guarantee

- Zero cloud accounts, analytics, tracking, or external API calls at runtime.
- All classroom rosters, attendance logs, photos, and selection histories stay strictly inside your browser's local **IndexedDB (`ClassroomRandomizerDB`)**.
- Use **Backup & Settings** to export password-encrypted V2 `.classpack` backups before clearing browser site data or migrating devices.
