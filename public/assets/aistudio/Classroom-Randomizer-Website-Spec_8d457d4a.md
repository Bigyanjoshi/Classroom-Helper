# Classroom Randomizer — Website Project Specification

**Document type:** Product requirements and implementation brief for an AI coding agent  
**Phase:** Website first (responsive web app / installable PWA)  
**Initial classes:** Class 5, Class 6, Class 7  
**Primary use:** A teacher's laptop and Android phone  
**Data model:** Local-first; separate data on each device; manual export/import only  
**Status:** Build the website only. Do not build an Android APK or native mobile application in this phase.

---

## 0. Instructions to the coding agent

Build the actual working website described in this document. Do not stop at mockups, static screens, or a visual prototype. Every visible control must work, and all core workflows must persist data correctly.

Before changing files:

1. Inspect the existing repository, README, package files, routes, components, and current dashboard.
2. If a project or dashboard already exists, preserve and extend it. Do not replace working code or redesign the entire project unnecessarily.
3. Identify the existing framework and conventions. Continue using them where practical.
4. If this is a new/empty project, use a maintainable React + TypeScript + Vite architecture unless the environment already requires another suitable stack.
5. Give a short implementation plan, then implement and test the working website.

Do not ask the user to repeat requirements already contained in this document. Where a small detail is unspecified, choose the simplest safe behavior consistent with the requirements and document the decision.

### Non-negotiable rules

- This phase is a **website/PWA only**. Do not build Capacitor integration, native Android screens, APK packaging, or a separate mobile application yet. Keep the architecture portable so a later mobile phase can reuse the business logic.
- The website may be hosted, but student names, roll numbers, photographs, generated avatars, attendance, selection history, and classroom data must remain on the device.
- Do not add a cloud database, backend student-data API, cloud image-generation API, analytics tracker, advertising SDK, remote logging, or automatic synchronization.
- Do not upload student photographs or student data to any server or third-party service.
- Do not silently download AI models or other large files after setup. Bundle or self-host required app assets and models with the website, and make their local/offline status clear.
- Do not infer a student's gender from their name or photograph. The teacher chooses a character-presentation option, or explicitly chooses random.
- Do not describe a preset/asset-composition avatar generator as a fully generative AI model. It is an offline, AI-assisted/procedural character generator unless a genuinely on-device generative model is separately implemented and tested.
- Do not delete student records when marking a student absent or selecting a card.
- Do not let a general Reset button erase the student database.
- Do not leave placeholder buttons, fake statistics, or nonfunctional navigation in the finished product.

---

# 1. Product vision

Create a friendly, polished classroom tool that turns student selection into an engaging mystery-card experience.

A teacher selects a class, records absent students for the new session, opens a deck of hidden student cards, shuffles, and taps a card to reveal a personalized cartoon character. Tapping the same revealed card again confirms the selection and animates it into a Selected Students collection. Its original position becomes an empty slot. The teacher can continue selecting students, run a two-student toss, create groups, select a student and a question, or use other classroom activities.

The website must be easy for a non-technical teacher to understand. The primary workflow should take only a few obvious actions: **Choose class → Mark absentees → Choose activity → Shuffle → Reveal → Confirm selection.** Advanced features must not make the main screen crowded.

## 1.1 Initial classes and extensibility

- Provide Class 5, Class 6, and Class 7 as initial class options or easy setup entries.
- Allow the teacher to add, rename, archive, and manage additional classes later.
- Do not hard-code the application so that it only supports three classes.
- Every student belongs to one class at a time. A student can be transferred to another class without losing historical selection records.

## 1.2 Main product principles

1. **Local-first privacy:** Student data stays in the browser/device.
2. **Offline-capable:** Once the hosted website and its assets have been loaded and cached, core features should work without internet access.
3. **Simple first, advanced second:** Make the common selection workflow obvious; place advanced settings in appropriate panels.
4. **Fair and transparent selection:** Clearly show the active random/fairness mode and who is eligible.
5. **Stable student identities:** A student's avatar and card identity remain stable unless the teacher deliberately changes them.
6. **Recoverable actions:** Back, Undo, and Reset must have predictable, separate meanings.
7. **Responsive presentation:** The same website works on a laptop/projector and an Android phone browser.

---

# 2. Website navigation and global layout

## 2.1 Main navigation

Provide a dashboard as the home page and a clear navigation menu with these sections:

1. Dashboard
2. Classes
3. Students
4. Character / Avatar Studio
5. Card Collection
6. Activity Center / Random Selection
7. Questions and Tasks
8. History and Reports
9. Settings, Backup, and Restore

Use a compact sidebar on wide screens and a suitable drawer/bottom navigation pattern on small screens. Keep the current class visible where relevant.

## 2.2 Global Back button

- Every relevant subpage and activity screen must have a visible **Back** control at the top-left.
- It must navigate one logical step backward, not always jump to the dashboard.
- It must preserve the current session, attendance, revealed card, selected cards, form data, and activity state whenever possible.
- Support the browser's Back action consistently with the website's navigation history.
- If leaving a form would discard unsaved edits, show a clear confirmation. Do not ask for confirmation when no work would be lost.
- Back must never act as Reset.

## 2.3 Global class selector

- Put the class selector in the top-left area of the main application shell, near the Back/navigation area without making the header crowded.
- Selecting a class opens that class's overview/session entry flow.
- Display the selected class name prominently on class-specific pages.
- Switching classes must save/preserve an unfinished session so the teacher can return to it.

## 2.4 Visual design

Use a warm, pleasant, polished educational-game aesthetic:

- Warm cream, ivory, soft orange, peach, terracotta, gentle gold, and complementary soft neutral colors.
- Avoid relying on large blue panels or harsh black boxes.
- Use rounded but not excessively bubbly cards, restrained shadows, clean typography, clear spacing, and readable contrast.
- The interface should look professionally designed, not like a generic AI-generated dashboard.
- Keep decorations and gradients restrained. Make student cards and characters the visual focus.
- Provide light/dark or theme customization only if it does not complicate the core experience; user-selectable themes are welcome.
- Ensure accessible contrast, visible focus states, keyboard navigation, and reduced-motion support.

## 2.5 Responsive layout

**Laptop / desktop:**
- Main card deck in the center/left area.
- Selected Students panel on the right.
- Attendance and management controls remain easy to access.
- Provide a full-screen projector/presentation mode.

**Mobile browser:**
- One-column card deck or responsive grid.
- Selected Students panel becomes a collapsible drawer or bottom sheet.
- Buttons remain large enough to tap.
- Do not require horizontal scrolling for the primary workflow.

---

# 3. Dashboard

The dashboard is the first page after opening the website.

Include:

- Welcome / application title.
- Class 5, Class 6, and Class 7 cards.
- Student count for each class.
- Quick action to open a class.
- Quick action to add/import students.
- Recent sessions and activities.
- Small summary of recent selections or participation (only from real local data; do not show fabricated sample statistics in production).
- Clear indication when there is an unfinished session that can be resumed.

Do not overload the dashboard with every advanced feature. The main action should be selecting a class.

---

# 4. Class opening, sessions, and attendance

This is a core workflow and must be implemented precisely.

## 4.1 Session behavior

A **class session** is a teaching/attendance session. An **activity** is one particular task performed during that session (single selection, toss, team generation, question selection, etc.). A **round** is a repeatable cycle within an activity.

Keep these entities distinct in the data model.

When the teacher opens a class:

- If there is an unfinished active session for that class, offer **Resume Current Session** and **Start New Session**. Resuming must not ask for attendance again.
- If there is no active session, start the new-session flow and ask for attendance.
- Starting a new session always opens the attendance/absent-student step.
- Attendance is not asked again when the teacher moves between activities in the same session.

## 4.2 Absent-student screen

Before the new session's card deck opens, show an attendance screen with a clear question such as:

**“Which students are absent today?”**

Provide two ways to mark absentees:

1. Search/select students from the class roster.
2. Type one or more roll numbers (support comma, space, or separate-chip entry where practical).

Requirements:

- Display each student's roll number and name in the selection list.
- Support multiple absentees.
- Validate every entered roll number against the selected class.
- Show a clear error for unknown roll numbers; do not silently ignore them.
- Detect duplicate roll numbers in the entry and count a student only once.
- Provide **No Absent Students — Continue**.
- Provide **Continue** after the teacher has marked absentees.
- Show a final attendance summary before entering the activity.
- If every student is absent or the class has no eligible students, do not start a selection deck. Explain why and offer to edit attendance.

## 4.3 Attendance rules

- Absent students are excluded only from the current session's eligible pool.
- Their student records and saved character cards remain unchanged in the class roster and Card Collection.
- Starting a new session asks for attendance again. A student marked absent in a previous session is not automatically absent in the next session.
- Allow the teacher to edit attendance during an active session.
- If an absent student arrives late, allow the teacher to mark them present and include them in the next round/activity. Ask what to do if they were already excluded from an in-progress activity; do not silently change a completed result.
- If a student becomes absent after being selected, preserve the historical selection and let the teacher decide whether to remove them from future activities.
- Attendance changes must be recorded in the current session.

---

# 5. Student management

Provide a student roster for each class.

## 5.1 Student fields

Required:

- Student name
- Roll number
- Class
- Character presentation preference (used for default fictional avatar generation; optional and editable)

Optional:

- Original photo
- Generated cartoon avatar
- Notes or teacher-only details
- Active/inactive status

Use a unique internal student ID that does not depend on a student's name or roll number. Roll numbers should be unique within a class, not necessarily across all classes.

## 5.2 Add students manually

- Provide a simple student form.
- After saving a student without an uploaded photo, automatically assign a unique default cartoon character (see Section 6).
- Automatically place the student in the selected class.
- Generate the student's card automatically.
- Do not require the teacher to visit another page to finish registration.

## 5.3 Excel / CSV import

- Allow importing student lists from CSV and common Excel formats if practical in the chosen stack.
- Provide a sample/template file and clear column mapping.
- Preview records before import.
- Validate missing names, invalid roll numbers, and duplicate roll numbers within the same class.
- Let the teacher resolve duplicates rather than silently creating duplicates or overwriting records.
- Assign a default character and student card to every successfully imported student.
- Report imported, skipped, and invalid rows.

## 5.4 Edit, transfer, archive, and delete

- Allow editing name, roll number, class, character preference, and avatar.
- Allow transfer to another class while preserving the same internal student ID and historical records.
- Allow archiving a student so they no longer appear in new active class decks but their history remains.
- Deletion must require explicit confirmation and explain what associated photos, avatars, and history will be deleted or retained.

---

# 6. Character and Avatar Studio

Every student must have a character card even when the teacher has no photograph.

There are two supported character creation routes.

## 6.1 Route A — Automatically generated default character (no photo)

When a student is added manually or imported without a photo, automatically create a unique fictional cartoon character from locally available character assets.

Character appearance options:

- Masculine / boy-style character
- Feminine / girl-style character
- Neutral character
- Random appearance

Important:

- The teacher selects this preference or chooses Random. Never infer it from a student's name or photograph.
- If Random is chosen, randomly select a character presentation and visual variation.
- Generate different characters for different students by combining varied local assets such as face shapes, hairstyles, hair colors, eyes, eyebrows, expressions, clothing, accessories, and backgrounds.
- Avoid assigning the same character combination to multiple students in the same class where the available asset library permits.
- Save the generated avatar to the student's record. It must remain stable when the website is reopened; do not generate a different character every time a class is opened.
- Allow the teacher to regenerate, customize, or manually choose another character.
- Provide an appropriate range of age-neutral, school-friendly character designs. Avoid stereotypes and inappropriate clothing or accessories.

Implementation guidance:

- Prefer a local procedural/asset-composition generator using bundled SVG/PNG/WebP layers or a locally bundled model.
- It must work offline and must not call an external image-generation API.
- If using layered assets, render the result into a local image file/blob so the student card displays a consistent finished avatar.
- Make the implementation genuinely varied rather than changing only the background color.
- Do not claim a preset-composition engine is a full generative AI model. Label it honestly as a local character/avatar generator.

## 6.2 Route B — Upload a real student photograph and replace the default character

The teacher must be able to upload a photograph for a new student or replace the default character of an existing student.

### Required photo-upload workflow

When the teacher chooses **Upload Student Photo**:

1. Open a student detail form asking for:
   - Class
   - Roll number
   - Student name
2. If those details match an existing student, show the matching record and ask the teacher to confirm that this is the correct student.
3. If no matching student exists, allow the teacher to create a new student record using these details.
4. Allow the teacher to select/capture the photo, crop it, rotate it, and preview it.
5. Process the photo locally on the device.
6. Create a cartoon-style avatar from the photo and preview it beside the original.
7. On confirmation, replace the student's default avatar with the photo-derived avatar and update the existing student card. Do not create a duplicate student or an extra card.
8. Keep the original photo only if the teacher chooses to retain it. Provide a clear option to delete the original after processing.
9. If processing fails or the teacher cancels, preserve the student's previous avatar and record.

### Offline photo-processing requirements

- No photograph may be sent to a cloud service, external AI provider, analytics service, or remote server.
- Use on-device/local processing only.
- A suitable approach is locally bundled person/background segmentation (for example, an appropriate MediaPipe model) plus local image processing for a subtle cartoon effect (edge-preserving smoothing, controlled color reduction, soft outlines/shading, and background replacement).
- Facial landmarks may be used to preserve alignment and avoid distorting major facial features.
- Preserve recognizable facial structure as much as possible. Do not promise exact identity preservation; provide a preview and intensity control.
- Provide a **Cartoon Intensity** control from subtle to more illustrated.
- Provide a background choice: transparent, simple solid color, or a small set of local classroom/card backgrounds.
- If the local model is unavailable, fails, or the device cannot process the image reliably, show a clear fallback: use the original photo as the card portrait or choose a preset character. Never silently upload it.
- Optimize image dimensions and compression for local storage and card display.
- Keep models and processing libraries available offline after initial installation/cache setup.

### Child-photo privacy

Because student photographs may be children's photographs:

- Make it clear that the teacher/school must have appropriate permission before using student photos.
- Store photos only locally.
- Provide delete controls for original photos and generated avatars.
- Do not use photos to identify, classify, score, or infer sensitive characteristics about students.
- Do not use face recognition to automatically identify a student from a new photo. Matching a record must use the teacher-entered class, roll number, and name, with teacher confirmation.

## 6.3 Avatar management

- Provide a Character Studio grid showing all student avatars.
- Filter by class and search by student name/roll number.
- Allow preview, edit, regenerate, replace with photo, choose preset, and delete/restore avatar.
- Avatar changes must update the student's existing card, not create another student record.

---

# 7. Student Card Collection

Every active student has one student card per student record.

## 7.1 Card front

The revealed/front side includes:

- Student's cartoon avatar or chosen photo-derived avatar
- Student name
- Roll number
- Class name/number

Keep the front attractive and readable. Make the character the main visual focus.

## 7.2 Card back

The hidden/back side must not expose:

- Student name
- Roll number
- Class
- Avatar or photo
- Gender/character-presentation preference
- Any visual clue that could reveal the associated student

Use a collection of attractive mystery patterns and decorative backs. All backs should be similar enough in visual style and visual complexity that students cannot identify a person from the back design.

## 7.3 Card generation and uniqueness

- Generate cards automatically as students are added.
- Keep a stable student-to-card identity internally.
- Card-back artwork is independent of student identity.
- Provide a card preview and optional card theme customization.
- A card's front must always show the latest saved student name, roll number, class, and avatar.

---

# 8. Mystery Deck and randomization engine

This is the central feature of the website.

## 8.1 Entering the deck

After attendance is confirmed and an activity is chosen:

- Load only eligible students for that activity.
- Absent and temporarily excluded students must not appear in the available deck.
- Display all eligible cards face-down.
- Randomize the assignment of students to visible card positions.
- Randomize/interchange card-back designs independently of student identity.
- Never expose the student identity through DOM labels, accessible text visible to classroom viewers, filenames, predictable card order, or front/back rendering before reveal. Do not rely only on hiding text visually.

## 8.2 Shuffle button

- Provide a clear **Shuffle** button.
- Animate the cards moving/reordering in a polished, understandable way.
- The shuffle animation is visual only; it must not determine the random result.
- Use a proper unbiased random shuffle (for example, Fisher–Yates with a cryptographically secure random source where available).
- Ensure identity-to-position mapping is re-randomized independently from card-back pattern selection.
- The teacher can shuffle before starting and can reshuffle the remaining available cards during an activity.
- Do not reshuffle already confirmed students back into the active deck unless the teacher explicitly resets or undoes the selection.

## 8.3 Two-tap reveal and confirmation (required interaction)

This interaction must be implemented exactly:

**First tap — Reveal**

- Teacher taps one hidden card.
- That card flips with a smooth animation.
- Show the student's character, name, roll number, and class.
- The revealed card remains in its original position on the main deck screen.
- It is not yet a confirmed selection.
- Allow the teacher to cancel the reveal; if cancelled, turn it face-down again.

**Second tap — Confirm**

- Teacher taps the same revealed card again.
- Confirm the selection.
- Animate the face-up card from its deck position into the Selected Students panel on the right (or mobile drawer).
- Leave an empty placeholder/slot at the card's original position.
- Add the student to the selected list in selection order.
- Update progress counts.

Rules:

- Only one card can be in the pending-reveal state at a time.
- Tapping another hidden card while one is pending must not accidentally confirm the first card. Provide a clear cancel/replace choice or require cancelling the pending reveal first.
- A card moved to Selected Students must not be available again in no-repeat mode.
- The selected card remains face-up in the Selected Students panel until the activity/round is reset or the selection is undone.
- On mobile, the selected panel can be a drawer/bottom sheet, but the same behavior must remain clear.

## 8.4 Selected Students panel

Show:

- Selected character card thumbnails, face-up.
- Student name and roll number.
- Selection order number.
- Total selected and eligible count.
- Undo/remove action with confirmation where appropriate.
- Clear distinction between selected, pending reveal, and available cards.

## 8.5 Card completion

When no eligible cards remain, show a completion state with:

- All selected students in order.
- Activity result/summary.
- Start another round.
- Start another activity in the current class session.
- Export/share a local result report where supported.
- Return to class overview.

---

# 9. Random selection modes and fairness

Provide clear selection modes. Always display which mode is active.

## 9.1 Pure Random

- Every currently eligible student has an equal chance of being chosen.
- Use a reliable random algorithm independent of animation.
- In a two-student toss, the same student cannot occupy both positions in the same pair.

## 9.2 Balanced Participation

- Students with fewer recorded selections receive higher priority/chance than students selected more frequently.
- Use a transparent, documented weighting approach.
- Apply the eligibility rules first: absent, archived, or excluded students are never included.
- Show that balanced selection is active; do not present it as pure random.

## 9.3 Repeat policy per activity

Allow the teacher to choose:

- **No Repeat:** A confirmed student cannot be selected again in the same activity/round.
- **Allow Repeat:** A student can be selected again, subject to activity rules.

Do not allow a duplicate student within a two-student pair.

## 9.4 Least Recently Selected (optional enhancement)

This may be offered as an additional optional strategy if it can be implemented clearly. It must not replace the two agreed core modes (Pure Random and Balanced Participation).

## 9.5 History and fairness scope

- Track selection counts by student, class, session, and activity.
- Provide a clear setting for whether Balanced Participation uses the current session, recent sessions, or all available local history. Choose a sensible default and explain it in the UI.
- Never modify past selection history when starting a new activity or resetting a current round.

---

# 10. Two-student toss

Provide a dedicated two-student selection mode.

Required behavior:

1. Teacher chooses Two-Student Toss.
2. The system selects/reveals the first student through the same mystery-card workflow.
3. After the first student is confirmed, the teacher selects/reveals/confirms the second student.
4. Reveal order is sequential, not simultaneous.
5. The same student cannot be selected twice within the pair.
6. After the second confirmation, show both characters together in a final comparison/result layout.
7. Allow the teacher to start a new pair or return to the activity center.

---

# 11. Additional classroom activities

Build these on the same student eligibility, randomization, attendance, and history services. Avoid creating separate, inconsistent selection engines.

## 11.1 Group Generator

- Teacher chooses number of groups or students per group.
- Randomly distribute eligible students.
- Display groups clearly.
- Allow regeneration before confirming.
- Optional future enhancement: avoid repeating previous team combinations.
- Respect attendance and exclusion rules.

## 11.2 Student + Question

- Maintain local question decks by subject/topic.
- Teacher can add, edit, import, and remove questions.
- Select a student, then assign a question (or choose both according to the activity setting).
- Allow the teacher to reveal the question after the student is selected.

## 11.3 Lucky Student / Responsibility Picker

- Pick one student for a classroom duty or special role.
- Allow custom responsibility/task lists.
- Track assignments to help avoid repeatedly assigning the same student.

## 11.4 Mystery Reward / Challenge Cards (optional enhancement)

- After a student is selected, optionally reveal a second card containing a reward, challenge, or classroom task.
- Teacher can manage the local reward/challenge deck.
- Do not force rewards or public ranking of students.

## 11.5 Alternative randomizer styles (optional enhancement)

- Mystery card mode is the primary experience.
- Optional future modes can include a wheel/roulette or quick-pick view.
- These modes must use the same eligibility and fairness engine.

---

# 12. Character celebration and sound

When a card is revealed:

- Character performs a lightweight wave, smile, or bounce animation.
- Use preloaded local animation assets or lightweight CSS/SVG/Lottie-style animation where suitable.
- Do not generate a new animation through a cloud service.
- Sound effects are optional and can be muted globally or per session.
- Include a Reduce Motion setting; the selection must remain usable with animations disabled.
- Keep the reveal fast and avoid heavy effects that make lower-powered phones slow.

A speaking/singing feature is not required for the initial website version. It may be added later as optional local speech/sound, but do not imitate a student's voice.

---

# 13. Reset, Undo, Back, and recovery behavior

These actions must have different meanings.

## 13.1 Undo Last Selection

- Reverse the most recent confirmed selection.
- Return that student to the eligible deck if still eligible.
- Remove them from the current selected list.
- Preserve the attendance record and previous completed activities.
- Reinsert/reposition the card safely; do not accidentally expose other hidden identities.

## 13.2 Reset Selection / Round

- Ask for confirmation.
- Clear current activity selections and pending reveals.
- Restore eligible students to the current activity deck according to the activity's repeat rules.
- Keep attendance, student data, cards, and historical completed sessions.

## 13.3 Reset Shuffle

- Ask for confirmation if it discards a pending reveal or changes the current arrangement.
- Re-randomize remaining available cards.
- Do not change attendance or confirmed selected students.

## 13.4 New Session

- Ask for confirmation if the current session is unfinished.
- Start a new session and ask attendance again.
- Preserve the old session and its history.

## 13.5 Destructive data reset

- Place this only in Settings/Data Management.
- Require explicit confirmation and clearly state what will be deleted.
- It must never be triggered by the normal activity Reset button.

## 13.6 Auto-save and resume

- Persist session/selection changes as they happen.
- If the tab closes or browser reloads, restore the last safe state where possible.
- Resume must restore attendance, current activity, selected students, pending reveal state if safe, and card layout.
- If a pending animation cannot be resumed, restore the card to a clear safe state rather than duplicating a selection.

---

# 14. History, participation, and reports

Provide local history views with filters by class, date, session, and activity.

Track:

- Session date/time (local device time).
- Class.
- Attendance/absent list for that session.
- Activity type and selected mode.
- Repeat policy.
- Selected students and selection order.
- Group assignments or question assignments where relevant.

Provide:

- Student selection totals.
- Last selected date/session.
- Participation overview by class.
- Optional printable/exportable session summary.
- CSV export for relevant records.

Do not make public leaderboards or label students negatively. These are teacher-facing tools to support fair participation.

---

# 15. Data storage, privacy, and backup

## 15.1 Local-only storage

For the website phase:

- Use IndexedDB for structured data and image blobs (a library such as Dexie may be used if suitable).
- Keep original photos, processed avatars, character assets/metadata, cards, attendance, sessions, settings, and history locally.
- The hosting server serves static app files only. It must never receive student data.
- No automatic cloud sync between laptop and mobile.
- Laptop and Android browser/PWA each have separate local databases.
- Manual transfer is the only supported cross-device data movement in this phase.

## 15.2 Offline website/PWA

- Make the website installable as a PWA where supported.
- Use a service worker to cache the app shell, scripts, styles, fonts, icons, local character assets, and required local processing models.
- Core dashboard, student management, avatar asset generator, card deck, selection engine, history, and backup/restore must work offline after initial setup/cache.
- Display an understandable first-run/offline readiness state. Do not claim offline capability until required assets are cached.
- Do not depend on external fonts, CDNs, remote scripts, image hosts, or APIs at runtime.
- Provide a visible offline/online indicator when useful.

## 15.3 Browser storage limitations

- Request persistent browser storage where supported.
- Warn the teacher that clearing browser data, uninstalling/clearing the PWA, browser eviction, or device failure can remove local records.
- Encourage periodic manual backups.
- Do not claim that browser storage is guaranteed permanent or perfectly secure.

## 15.4 Manual encrypted backup and restore

Provide a backup package (suggested extension: `.classpack`) containing:

- Classes and student records.
- Student avatars and retained original photos.
- Character-generator settings/metadata.
- Card themes/settings.
- Questions and task decks.
- Attendance and session history.
- Selection history and reports.
- App settings.

Requirements:

- Encrypt the backup with a password chosen by the teacher using a well-supported browser cryptography implementation (for example, Web Crypto AES-GCM with an appropriately derived key).
- Never hard-code or store the backup password in the project.
- Validate file format, version, integrity, and contents before restoring.
- Show a preview before importing.
- Offer restore/merge options only when merge behavior is safe and clearly explained.
- Detect duplicates and conflicting records.
- Never silently overwrite current data.
- Include a clear backup reminder in Settings.
- Support exporting/importing between laptop and mobile manually.

## 15.5 Network/privacy audit

The application must not make requests containing student data, photo data, avatar data, attendance, or history.

No analytics, advertising, external AI APIs, cloud storage, or third-party tracking. If a future optional feature needs internet access, it must be separately approved, disabled by default, and clearly disclose what data would leave the device. Do not add such a feature in this phase.

---

# 16. Suggested technical architecture

Use the existing repository's stack where practical. If starting fresh, this is a suitable direction:

- **UI:** React + TypeScript + Vite.
- **Routing:** React Router or an equivalent small routing solution.
- **Styling:** Maintainable CSS/Tailwind/component system, with shared design tokens.
- **Local data:** IndexedDB (Dexie or an equivalent wrapper).
- **Images:** Store image blobs in IndexedDB or a carefully managed local asset store; store references/metadata in records.
- **Offline:** PWA plugin/service worker with explicit cache strategy and versioning.
- **Avatar assets:** Locally bundled SVG/PNG/WebP components and deterministic avatar composition.
- **Photo processing:** Locally bundled segmentation/landmark model and local image-processing pipeline, only if performance and bundle size are acceptable.
- **Randomness:** `crypto.getRandomValues` where supported; implement/test an unbiased Fisher–Yates shuffle. Do not use `Math.random` as the only source for fairness-sensitive selection if a cryptographic random source is available.
- **Backup:** ZIP/package creation plus Web Crypto encryption, with schema versioning.
- **Testing:** Unit tests for eligibility/randomization/session state, plus browser-level tests for core user journeys.

Keep business logic separate from React components:

- Student service/repository
- Class/session service
- Attendance/eligibility service
- Avatar generation/processing service
- Card-deck/randomization service
- Activity service
- History/report service
- Backup/restore service

Use a versioned database schema and migration strategy. Avoid placing all logic in one large component or one giant file.

---

# 17. Suggested data model

Design the schema to support future expansion. At minimum include:

### Class
- `id`
- `name` (e.g. Class 5)
- `createdAt`
- `updatedAt`
- `archivedAt` (optional)

### Student
- `id` (stable unique ID)
- `classId`
- `name`
- `rollNumber`
- `characterPresentation` (`masculine`, `feminine`, `neutral`, `random`)
- `avatarSource` (`generated`, `photo`, `preset`)
- `avatarBlob/reference`
- `originalPhotoBlob/reference` (optional)
- `avatarConfiguration` (optional; seed/layers/style metadata)
- `activeStatus`
- `createdAt`
- `updatedAt`

### ClassSession
- `id`
- `classId`
- `startedAt`
- `endedAt` (optional)
- `status` (`active`, `completed`, `cancelled`)
- `absentStudentIds[]`
- `attendanceNotes` (optional)

### Activity
- `id`
- `sessionId`
- `classId`
- `type`
- `selectionMode` (`pureRandom`, `balanced`, optional `leastRecentlySelected`)
- `repeatPolicy` (`noRepeat`, `allowRepeat`)
- `status`
- `createdAt`
- `completedAt` (optional)

### ActivitySelection
- `id`
- `activityId`
- `studentId`
- `selectionOrder`
- `selectedAt`
- `selectionGroup/pairId` (optional)
- `undoneAt` (optional; preserve audit/history as appropriate)

### Question / Task
- `id`
- `category/subject`
- `text`
- `createdAt`
- `updatedAt`

### AppSettings
- theme, sound, animation, reduceMotion, selection defaults, backup reminders, and other preferences.

Use stable IDs, proper indexes, validation, and referential integrity. Do not use roll number as the permanent primary key because roll numbers can change.

---

# 18. Performance and device requirements

The website must work on a modern laptop and a mid-range Android phone. The target phone is expected to have approximately 6 GB RAM, but the exact model will be provided later.

Requirements:

- Do not load all full-resolution photographs into memory at once.
- Create optimized card-size avatar images/thumbnails.
- Lazy-load non-visible cards where appropriate.
- Keep the card animation smooth but lightweight.
- Provide a Reduce Motion setting and a low-performance mode.
- Do not require a large generative image model for default characters.
- Default character creation should be quick and local using bundled assets.
- Photo processing should be tested on the target Android phone when its model is known.
- If on-device photo segmentation is too slow or unsupported, provide the original-photo/preset-avatar fallback; never send the image online.
- Make the application usable if the optional photo-processing model is unavailable.

---

# 19. Accessibility and usability

- Use clear, plain labels.
- Make primary actions visually obvious.
- Use readable text and high-contrast controls.
- Support keyboard navigation and sensible shortcuts on laptop.
- Provide tooltips or brief helper text for less obvious controls.
- Do not communicate status by color alone; use text/icons as well.
- Respect reduced-motion preferences.
- Provide visible confirmation for actions such as reveal, selection, saved, backup completed, and import errors.
- Prevent accidental destructive actions.
- The teacher should not need technical knowledge to use the normal workflow.

---

# 20. Explicit screen list and key controls

Build these screens and connect them through working navigation:

1. **Dashboard** — class cards, recent/unfinished sessions, quick actions.
2. **Class Overview** — roster count, current session, start/resume session.
3. **Attendance** — absent-student list/search/roll-number entry, no-absent continue, validation.
4. **Student Roster** — search/filter, add/edit/import/archive.
5. **Add/Edit Student** — name, roll number, class, character preference, avatar option.
6. **Photo Upload / Replace Avatar** — class, roll number, name, photo preview, local processing, replace confirmation.
7. **Character Studio** — default avatar generation, presets, customization, preview, save.
8. **Card Collection** — front/back preview, class filters, card design.
9. **Activity Center** — single pick, two-student toss, group generator, question selection, lucky/responsibility picker.
10. **Mystery Deck** — shuffle, hidden cards, pending reveal, two-tap confirm, selected panel, progress.
11. **Activity Completion** — final selected students, result summary, next activity/new round.
12. **Questions and Tasks** — subject/category decks and CRUD.
13. **History and Reports** — sessions, activities, selection records, exports.
14. **Settings** — theme, sound, animation, fairness defaults, privacy, offline status.
15. **Backup and Restore** — encrypted export/import, preview, validation, conflict handling.

Every subpage should have the top-left Back button. Keep Reset controls within the relevant activity screen, with confirmation and precise descriptions.

---

# 21. Acceptance criteria / definition of done

The website is not complete until the following are tested successfully.

## Class and attendance
- [ ] Dashboard shows Classes 5, 6, and 7 and supports adding more classes.
- [ ] Opening a class with no active session starts the attendance flow.
- [ ] Resuming an unfinished session does not ask attendance again.
- [ ] Starting a new session asks attendance again.
- [ ] Teacher can mark multiple absentees by selecting names or entering roll numbers.
- [ ] Invalid and duplicate roll numbers are handled clearly.
- [ ] No-absent continuation works.
- [ ] Absent students are excluded from the current session without deleting their records/cards.
- [ ] Attendance can be corrected during a session.

## Students and avatars
- [ ] Student can be added manually and receives a default character/card automatically.
- [ ] Character presentation can be masculine, feminine, neutral, or random.
- [ ] Random characters are stable after saving and sufficiently varied across students.
- [ ] CSV/Excel import works with preview and duplicate checks.
- [ ] Uploading a photo asks for class, roll number, and student name.
- [ ] Existing student can be matched and confirmed; photo replacement updates the existing card instead of making a duplicate student.
- [ ] New student can be created using the photo upload flow.
- [ ] Photo/avatar processing runs locally, with a safe fallback if processing fails.
- [ ] No student photo or record is sent to a server or external API.

## Mystery cards and selection
- [ ] Every eligible student has one hidden card in the deck.
- [ ] Card backs do not expose identity or gender clues.
- [ ] Student-to-position assignment and card-back design are randomized independently.
- [ ] Shuffle animation does not determine or bias the random selection.
- [ ] First tap reveals the card and leaves it in place.
- [ ] Second tap on the same revealed card confirms it and animates it to the Selected Students panel.
- [ ] Original slot becomes an empty placeholder.
- [ ] Only one pending reveal is allowed at a time.
- [ ] Cancel reveal works.
- [ ] Undo restores a confirmed student appropriately.
- [ ] No-repeat and repeat-allowed modes work as configured.
- [ ] Pure Random gives eligible students equal selection probability in the algorithm.
- [ ] Balanced Participation uses its documented weighting approach.
- [ ] Two-student toss reveals students sequentially and never picks the same student twice in one pair.
- [ ] Completion state appears when no eligible students remain.

## Navigation, reset, and persistence
- [ ] Back button appears on relevant screens and goes back one logical step.
- [ ] Back does not erase attendance or activity progress.
- [ ] Reset actions are distinct and require confirmation.
- [ ] Normal Reset cannot erase the student database.
- [ ] Active sessions recover after a refresh/reopen where possible.
- [ ] Switching classes preserves unfinished sessions.

## Offline, privacy, and backup
- [ ] Website can be hosted as a static application without a student-data backend.
- [ ] After first setup/cache, core app screens work offline.
- [ ] Local student data remains available after closing and reopening the browser under normal storage conditions.
- [ ] The app requests persistent storage where supported and explains backup limitations.
- [ ] No analytics, external AI API, remote database, or student-data network request exists.
- [ ] Manual encrypted backup can be exported and restored on another device.
- [ ] Restore validates and previews data before changing the current database.
- [ ] Duplicate/conflicting records are not silently overwritten.

## Responsive and accessibility
- [ ] Main flows work on laptop and Android phone browser.
- [ ] Selected panel adapts to mobile.
- [ ] Projector mode is legible.
- [ ] Keyboard navigation and reduced-motion settings work.
- [ ] No primary action requires horizontal scrolling on a phone.

---

# 22. Recommended implementation order

Build in working, testable milestones. Do not attempt to build every complex feature at once without validating the foundations.

### Milestone 1 — Foundation
- Inspect and preserve existing project/dashboard.
- Establish design system and responsive navigation.
- Build dashboard, class records, IndexedDB, and versioned schema.

### Milestone 2 — Students and attendance
- Manual registration, CSV/Excel import, roster search/edit.
- Session lifecycle and absent-student flow.
- Verify absent exclusion and resume/new-session behavior.

### Milestone 3 — Default characters and cards
- Local procedural avatar assets/generator.
- Character presentation preferences.
- Stable student avatars and front/back card collection.

### Milestone 4 — Mystery deck and selection engine
- Eligibility service, unbiased shuffle, two-tap reveal/confirm.
- Selected panel, empty slots, undo, reset, repeat and fairness modes.
- Two-student sequential toss.

### Milestone 5 — Photo avatar processing
- Photo upload with class/roll/name form.
- Local segmentation/cartoon pipeline and preview.
- Existing-student avatar replacement and safe fallback.
- Test device performance and bundle size.

### Milestone 6 — Activities, history, and reports
- Group generator, questions, responsibility picker, completion screens.
- Participation statistics and exports.

### Milestone 7 — Offline PWA and backups
- Service worker/offline asset caching.
- Encrypted `.classpack` backup and restore.
- Network/privacy audit.
- Responsive, accessibility, and end-to-end tests.

Do not skip tests between milestones. Keep the project runnable throughout development.

---

# 23. Future phase — explicitly out of scope for this website build

The following are future work and must not delay or expand the current website scope:

- Native Android application / APK.
- Capacitor packaging and native SQLite integration.
- Native Android camera integration beyond what the browser supports.
- Automatic laptop/mobile synchronization.
- Cloud accounts or multi-user school administration.
- Cloud generative AI or remote photo processing.

Keep services and data structures modular so a future Android application can reuse the same product logic. For now, finish and verify the website/PWA first.

---

# 24. Final instruction to the coding agent

Deliver a complete, working, responsive, offline-capable website that follows this specification. Prioritize correct data handling, attendance/session logic, avatar/card creation, and the exact two-tap mystery-card interaction over decorative complexity.

Do not claim a feature is finished unless it works. Do not substitute mock data for real local persistence. Do not add cloud services or external AI APIs. Test the acceptance criteria, report any limitation honestly, and provide clear run/build/deployment instructions when the website is complete.

**The defining experience must remain simple:** choose a class, mark absent students, choose an activity, shuffle the hidden cards, tap once to reveal a character, and tap the same card again to move it into the selected collection.
