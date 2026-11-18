# Master Implementation Prompt — Classroom Randomizer (Spec v2.0)

You are a senior product engineer and UI/UX-focused full-stack frontend engineer working **inside the existing Classroom Randomizer repository**. Your task is to upgrade the current application to the approved **Classroom Randomizer Spec v2.0** while preserving its working functionality, local data, privacy guarantees, and offline PWA behavior.

This is an **existing-app upgrade, not a greenfield rebuild**. Do not replace the project with a new scaffold, create a disconnected prototype, or stop after producing a plan. Inspect the actual code, implement the changes, run the available checks, and report honestly what is and is not complete.

## 1. Source documents and decision order

Use the supplied project documents as requirements:

- `README.md` — existing product overview and current capabilities.
- `ARCHITECTURE.md` — existing technical architecture, database, services, domain functions, routes, state machines, and invariants.
- `Classroom-Randomizer-Website-Spec.md` — original product and functional specification.
- `Classroom Randomizer Specification Audit, UI/UX Overhaul, and Spec v2.0` — the new approved direction and replacement requirements.

First verify these documents against the actual repository. **The code and live database schema are the truth about what is currently implemented**; documentation may be stale. Do not assume a documented feature works until you inspect it.

When requirements conflict, use this order:
1. Preserve real existing user data and security/privacy invariants.
2. Apply Spec v2.0 to the areas it explicitly changes.
3. Preserve original-spec and existing-app features that do not conflict with v2.0.
4. For unresolved details, choose the safest backward-compatible behavior and record the decision in your completion report. Do not silently delete functionality or data.

Specific product decisions for this upgrade:
- Use the four v2.0 navigation hubs: **Classes**, **Roster & 3D Studio**, **Decks & History**, and **Backup & Settings**.
- Use the v2.0 five primary activity cards: **Mystery Pick**, **Two-Student Toss**, **Team Builder**, **Student + Question**, and **Duty Picker**.
- **Keep Mystery Reward / Challenge** available as an optional secondary activity (for example under “More Activities”). Do not delete its existing data, activity type, or functionality merely because it is not one of the five primary cards.
- Map existing activity types and stored values to the new labels without invalidating old records. Keep existing Question, Duty, Reward, and Challenge content.
- The fixed warm-ivory design system in v2.0 replaces page-specific palettes. Keep the app visually consistent across all routes. Preserve card-back theme choices and non-visual settings; do not create per-page color schemes. Make warm ivory the canonical application theme.
- Replace the old universal-tone-only avatar policy with the v2.0 teacher-controlled skin-tone approach, but **never infer a student's skin tone or appearance from a name or photograph**. Preserve existing saved avatars as legacy avatars; do not silently map their old tone to an arbitrary Monk Skin Tone value. New human-avatar skin choices must be explicitly teacher-selected. A legacy/default avatar or non-human classroom mascot may be used until a teacher chooses a human skin-tone option.

## 2. Mandatory repository-first workflow

Before editing:
1. Inspect the complete repository structure, `package.json`, Vite/PWA configuration, `src/App.tsx`, routes, all pages/components, domain modules, services, CSS, current Dexie schema/version, migrations, tests, and existing asset/font pipeline.
2. Identify what is genuinely working, partially working, broken, duplicated, or only documented.
3. Trace the real user journeys and persistence paths. Pay special attention to session resume, attendance edits, reveal/confirm/undo, photo replacement, backup restore, and data migrations.
4. Write a short implementation plan with dependencies and risks, then proceed with the implementation. Do not wait for approval unless a genuinely destructive or impossible ambiguity blocks safe progress.
5. Work in small, coherent changes. Keep the app runnable throughout and avoid replacing large files wholesale when a targeted refactor is safer.

Do not assume the current README or ARCHITECTURE perfectly matches the code. Correct the documentation alongside code changes.

## 3. Non-negotiable protections

- Website and installable PWA only. Do not add an APK, Capacitor/native shell, backend, cloud database, accounts, sync, analytics, ads, remote logging, or cloud AI/image API.
- Student names, roll numbers, photos, avatars, attendance, sessions, questions, selections, and reports remain on the user's device in IndexedDB. No student data or image may leave the device.
- No remote fonts, CDN scripts, image hosts, or runtime APIs. Bundle/self-host required fonts, icons, models, and assets for offline use.
- Never infer gender, character presentation, skin tone, identity, ability, or other sensitive traits from student names or photos. No face recognition.
- Never delete a student because they are absent, selected, transferred, or excluded from an activity.
- A normal Back, Undo, Reset Shuffle, or Reset Round action must never erase the roster or database.
- No placeholder buttons, fake metrics, mock production data, dead navigation, or false “saved/offline/complete” messages.
- Do not fabricate test results. If a feature cannot be completed reliably, explain the limitation and provide a safe working fallback.

## 4. Visual system and navigation

### Global visual tokens

Implement one shared `:root` token system and use it on **every route**, including Attendance, Activity Dock, Mystery Deck, Roster, Studio, History, Reports, and Settings. Use these v2.0 values:

- Canvas `#FAF6EE`; card surface `#FFFFFF`; subtle surface `#F3ECE1`.
- Warm border `#E6DCC9`; soft shadow `0 2px 8px rgba(35,28,22,0.06)`.
- Primary text `#231C16`; muted text `#6B5E52`.
- Primary CTA terracotta `#D65A31`, hover `#BD4A24`.
- Pending/reveal gold `#E6A23C`; present/confirmed sage `#2F7D5B`; validation/destructive crimson `#C0392B`.
- Radii: inputs 8px, buttons 12px, cards 16px, chips fully rounded.
- Prefer bundled offline display/body fonts from the v2.0 direction (Fredoka or Nunito for display; Plus Jakarta Sans or Inter for body). Reuse existing local font assets where suitable; never load fonts from a CDN.
- Use visible keyboard focus, sufficient contrast, 44px preferred touch targets, and at least the WCAG 2.2 AA 24×24 CSS px minimum. Pair status colors with text or icons.

Ban blue/purple gradients, gradient text, excessive pill badges, heavy black panels, fake charts/sparklines, bloated KPI headers, decorative emoji headings, and oversized shadows. The interface should feel like a polished, warm educational product—not generic AI-generated SaaS UI. Keep student characters and cards as the visual focus.

### Four navigation hubs

- **Classes (Home Launchpad):** Calm home screen with class cards, active student counts, session state, and one main action per class (`Start Session` or `Resume Session`). Include only subtle utility actions such as import and backup status. Avoid dashboard overload.
- **Roster & 3D Studio:** Student roster, add/edit/transfer/archive, CSV/Excel import, photo replacement, character studio, and card collection.
- **Decks & History:** Question decks, tasks/duties/rewards, activity history, attendance audits, fairness/participation reports, and exports.
- **Backup & Settings:** PWA/offline readiness, storage persistence and usage, sound/motion/fairness preferences, encrypted backup/restore, and isolated destructive database reset.

Use a slim desktop rail, four-tab mobile portrait navigation, and a compact header on short landscape/deck screens. Keep a visible logical Back action on relevant subpages. Back navigates one logical step, saves safe state, and never resets the activity. Preserve browser Back/popstate behavior and paused sessions when switching classes.

## 5. Fast class and attendance workflow

The target journey is: **Choose class → mark absentees → choose activity → shuffle/reveal/confirm.** A teacher should enter Mystery Pick in no more than three taps from the class launchpad when no extra configuration is required.

- Opening a class with an unfinished session offers Resume or Start New. Resume restores the exact safe session state and must not ask attendance again.
- Starting a new session always opens attendance. Each active student starts Present.
- Rebuild Attendance as a tap-first roll matrix sorted naturally (1, 2, 10), with roll number and name. One tap toggles a student to Absent and displays both an icon and text/strikethrough—not color alone.
- Provide one compact search/input that accepts names and comma/space-separated roll numbers and synchronizes with the matrix. Validate unknown and duplicate rolls inline; never silently ignore invalid input.
- Remove the mandatory separate attendance-summary page. Keep a live present/absent summary in a sticky launch bar and continue directly to activities.
- Block launch if no eligible students remain and explain how to edit attendance.
- Support attendance edits during a session. Record late arrivals and students leaving early in an attendance log without rewriting completed activity results. A late-arriving student may be eligible for subsequent activities/rounds according to the teacher's decision.
- Do not automatically carry absences into the next session. Preserve all student records and historical selections.

## 6. Activity Dock and activity preservation

Make the Activity Center a visual, fast-launch dock rather than a text-heavy settings page. Show the five primary activity cards listed above, with Mystery Pick pre-focused for instant launch. Put compact controls for selection mode and repeat policy at the top, initialized from saved defaults. Do not force a long configuration form before launch.

- Selection modes: Pure Random, Balanced Participation, and optional Least Recently Selected.
- Repeat policy: No Repeat or Allow Repeat. A student must never appear twice within one Two-Student Toss pair.
- Add an in-session **Switch Activity** control so teachers can move between activities without leaving the session or entering attendance again.
- Preserve Team Builder group-count/group-size options and quick pre-save member swaps.
- Preserve Student + Question using local question decks.
- Preserve Duty Picker and assignment-count history.
- Keep Mystery Reward / Challenge available as an optional secondary activity. Do not remove its existing content or history.
- All activities must use the same eligibility, attendance, fairness, persistence, and history services rather than separate randomization implementations.

## 7. Mystery Deck: layout, privacy, and interaction

### Viewport and responsive layout

- Treat the deck as a viewport-locked stage using `height: 100dvh`, `overflow: hidden`, `viewport-fit=cover`, and `env(safe-area-inset-*)` padding.
- Give the deck wrapper an explicitly bounded flex height (`flex: 1; min-height: 0`) and appropriate `container-type: size`/container queries. Do not allow the size container to collapse because its height depends on children.
- Use `ResizeObserver` to recalculate the layout on resize and orientation change.
- Implement/upgrade a deterministic grid solver that evaluates possible column counts and maximizes useful card area while preventing overflow. Use the v2.0 flexible card aspect range (approximately 0.68–0.92) and its balanced size score (`min(w,h) × 0.4 + sqrt(w×h) × 0.6`) where appropriate. Replace the old solver only after tests prove the new one works.
- Fit 15–60 students on one screen without scrolling across the specified phone portrait, phone landscape, tablet, laptop, and desktop test sizes. Prefer 44px or larger touch targets for typical class sizes. Never shrink below 24×24 CSS px; when computed cards would become too small (v2.0 backstop: below 28px), split the deck into quick tabs/pages rather than creating unusable targets. Keep every student reachable and clearly show the current tab/count.
- Selected Students HUD: compact bottom pill/sheet in mobile portrait; approximately 140–160px side strip in mobile landscape; approximately 260–320px right panel on larger screens. Support projector fullscreen.

### Cryptographic selection and DOM privacy

- Use cryptographically secure randomness (`crypto.getRandomValues`) and unbiased rejection-sampled integers with Fisher–Yates. Do not silently fall back to `Math.random` for production fairness-sensitive selection. If secure randomness is unavailable, explain the problem and prevent a false “secure random” claim. Keep injectable deterministic RNG only for tests.
- Randomize student-to-slot assignment and card-back variants independently. Never let animation determine selection.
- In hidden state, no student name, roll number, avatar, class, presentation/skin-tone cue, or identifying data may be rendered in visible DOM text, ARIA labels, filenames, element IDs, or data attributes. A hidden card must render only identity-neutral artwork and generic accessibility text. Mount the student front only after the card enters pending reveal.
- Keep card backs visually equivalent and independent of student identity, roll parity, presentation, and selection weight.
- Preserve the current fairness-weighted swap behavior: in Balanced/Least Recent mode, apply the weighted draw at reveal time by swapping the sampled eligible student into the tapped slot. Do not bias selection merely by card position.

### Two-tap reveal state machine

1. First tap reveals one student in the same deck position; it is pending, not yet selected.
2. Show a clear “Tap again to confirm” instruction and Cancel control.
3. Apply a 350ms minimum settle lock after first tap so a rapid accidental double-tap cannot confirm immediately.
4. Second tap on the same revealed card confirms it, animates it into Selected Students, and leaves an empty placeholder in the original slot.
5. Only one pending reveal may exist. Tapping a different hidden card must not accidentally confirm the pending card.
6. Support Cancel, Undo Last Selection, Reset Shuffle, Reset Round, and activity switching with clearly distinct behavior and safe persistence.
7. Add optional Web Audio synthesized feedback and optional haptics; respect mute and reduced-motion settings.
8. Desktop shortcuts: Space shuffle, Enter reveal/confirm, Esc cancel, Z undo, F fullscreen. Do not intercept typing in inputs or interfere with normal focus/assistive technology.

Test every state transition, including reload while a card is pending. On reload, restore a safe pending state or return the card to hidden; never duplicate a selection.

## 8. Avatar and photo pipeline

### Baked, GPU-safe avatar rendering

- Do not create a WebGL canvas per student/card. A roster or 60-card deck must not instantiate dozens of live WebGL contexts.
- Prefer the existing deterministic procedural SVG/avatar pipeline and improve its 3D clay-like quality with bundled local assets. Bake lightweight 256×256 WebP deck thumbnails and 512×512 studio portraits into local storage where practical; keep full-resolution originals separate and load lazily.
- If live WebGL is truly needed, allow at most one active shared canvas in the Avatar Studio or revealed-card spotlight, with baked-image fallback on context loss or low-performance devices.
- Keep avatars stable across reloads and avoid duplicate combinations within a class where the asset pool permits. Outfit/style randomization must never alter skin tone.

### Skin-tone fairness

- Provide the ten-shade Monk Skin Tone range for teacher-controlled human avatar customization. Do not infer, auto-detect, or randomize a student's shade from a name/photo.
- Preserve existing saved avatars as legacy values; do not silently assign an MST number to the old universal tone. Let teachers explicitly edit the avatar if they choose.
- Offer non-human classroom mascot/preset options. Do not associate hairstyles, clothes, accessories, gender presentation, or behavior with a particular skin shade.
- For photo-derived avatars, process locally only. Use the v2.0 CIELAB edge-preserving cartoonization direction and compare before/after skin-region color metrics only as a fidelity safeguard—not as identity or demographic classification. Do not whiten, brighten, recolor, or globally quantize skin pixels. Provide original-versus-cartoon preview, intensity control, and a safe original/preset fallback.
- Do not claim “Skin Tone Preserved” as a verified result unless the validation actually ran successfully. If robust skin-region segmentation or validation is unavailable, say so and offer the original-photo/preset fallback.
- Match an existing student only through teacher-entered Class + Roll + Name and teacher confirmation. Never use face recognition.
- Require appropriate permission before using children's photos; keep original photos only when the teacher chooses to retain them and provide explicit deletion controls.

## 9. IndexedDB, migrations, and crash recovery

The current architecture documents `ClassroomRandomizerDB` version 1 with nine stores: `classes`, `students`, `blobs`, `sessions`, `activities`, `selections`, `questions`, `rewards`, and `settings`. Verify the real code before changing anything.

- Use Dexie schema versioning and safe migrations. Never delete/recreate the database or replace existing stores as a shortcut.
- Preserve all classes, students, student IDs, roll numbers, existing avatar blobs, sessions, activities, selections (including undone audit rows), questions, rewards/duties, and settings.
- Prefer additive fields/stores and compatible adapters over disruptive table renames. If a structural change is essential, migrate transactionally and verify record counts/references before and after.
- Keep the existing `blobs` data readable during any staged conversion to Blob-based thumbnail/full-size storage. Do not remove old blobs until the new copies are verified and the database transaction has committed.
- Add the v2.0 recovery information as appropriate to the real schema: deck order, independent card-back seeds, pending reveal student/slot, attendance log, question deck references, responsibility task assignment counts, and separate thumbnail/full portrait references.
- Keep session, activity, and round as distinct concepts. Persist meaningful state changes immediately. Resume must restore attendance, current activity, selected students, deck order, and other safe state.
- Never seed fabricated session or selection history. Starter classes/questions/tasks, if retained, must be clearly identifiable starter content and must not create fake participation statistics.
- Request persistent storage where supported; display storage usage/availability and clear warnings that browser data can be evicted or deleted. Keep localStorage limited to small non-sensitive UI/route flags.

## 10. Encrypted backup and backward compatibility

The current architecture documents `.classpack` V1 using PBKDF2-SHA256 with 150,000 iterations and AES-GCM-256. Spec v2.0 requires a stronger chunked format.

- Introduce a versioned V2 format using PBKDF2-SHA512 with 600,000 iterations, AES-256-GCM, unique random 12-byte IV per chunk, 256KB–1MB bounded chunks, and SHA-256 integrity verification.
- Authenticate chunk metadata (format/version, chunk index/count, and relevant manifest fields) as AES-GCM additional authenticated data. Never reuse an IV with the same key.
- Process data sequentially with bounded memory. Include large photo/avatar blobs; do not build an unbounded monolithic plaintext/encrypted buffer on mobile.
- Keep the password only in memory for the operation; never persist it or log it.
- **Continue to import and decrypt valid existing V1 backups.** Do not silently invalidate old exports. Export new backups in V2.
- Validate format, version, authentication, integrity, and record relationships before modifying IndexedDB. Show a content preview and explicit merge/replace conflict decisions. Never silently overwrite.
- Apply restore atomically where possible; on failure, leave the existing database unchanged. Include progress, clear errors, and cancellation where practical.

## 11. Quality, accessibility, and performance

- Use plain labels and make the primary action obvious. Keep normal classroom use friendly for non-technical teachers.
- Support keyboard navigation, visible focus, accessible dialogs, reduced motion, and readable projector mode.
- Provide clear feedback for save, reveal, confirm, undo, backup, restore, import, and errors.
- Lazy-load non-visible portraits; never decode all full-resolution photos in a large class at once.
- Keep the deck responsive on mid-range Android devices around the documented 6GB RAM target. Low-performance mode must use baked images and reduce expensive animation.
- Keep all core workflows usable offline after the app shell and required assets/models have been cached. State offline readiness honestly.

## 12. Required testing and acceptance checks

Run and fix the existing checks:

```bash
npm run lint
npx --yes tsx --test src/domain/*.test.ts
npm run build
```

Add/update tests for at least:
- Database migration from the current installed schema, retaining all records and blob references.
- Old V1 backup import and new V2 chunked backup round-trip, wrong password, tampering, truncation, and restore conflict handling.
- Secure random integer rejection sampling and shuffle invariants.
- Eligibility, attendance, fairness weighting, no-repeat/repeat behavior, and two-student duplicate prevention.
- Every reveal/cancel/350ms settle/confirm/undo/reset state transition and reload recovery.
- Hidden-card DOM privacy (no identity in text, ARIA, attributes, or rendered images before reveal).
- Natural roll sorting and attendance input validation.
- Deck grid containment and minimum touch size at: 360×780, 390×844, 780×360, 844×390, 768×1024, 1280×720, and 1920×1080, for roster sizes 15, 25, 35, 45, 60, and 70. Verify zero overflow for supported single-screen layouts and tab fallback when cards become too small.
- Activity switching without re-entering attendance and without losing session/activity history.
- Avatar legacy preservation, teacher-controlled MST changes, and no appearance inference.
- Photo processing fallback when local processing or segmentation is unavailable.

If browser-level testing tools are already present, test the main journeys on mobile and desktop. Do not add a large testing dependency without a clear reason. Do not claim a physical Android-device test unless one was actually run.

## 13. Documentation and delivery requirements

Update `README.md` and `ARCHITECTURE.md` in the same change. Document the actual final routes, activity mapping, visual tokens, database version and migration, new fields/stores, avatar pipeline, backup V1/V2 compatibility, tests, and any known limitations. Do not leave documentation describing removed or untrue behavior.

When finished, provide:
1. A concise summary of what changed and why.
2. The important files/modules changed.
3. Database migration behavior and explicit confirmation of how existing data is preserved.
4. Backup compatibility details (including V1 restore support).
5. Commands run and their real results.
6. Any acceptance criteria that remain incomplete, with the reason and safe fallback.
7. Instructions to run, build, and verify the app.

**Definition of done:** The existing Classroom Randomizer runs as a polished, responsive, offline-capable local-first PWA; its existing data and non-conflicting features are preserved; the v2.0 warm design, simplified navigation, fast attendance, activity dock, rotation-ready mystery deck, teacher-controlled avatar fairness, and safer backup/recovery behavior are implemented; and the checks above pass or remaining limitations are explicitly reported.

Do not stop after describing what should be done. Inspect, implement, test, update documentation, and report the actual outcome.
