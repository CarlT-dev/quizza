# SDD ledger — plan: /home/carl/.claude/plans/this-is-a-major-happy-puffin.md

Branch: `test` (no worktree, no commits — plan note: "I won't commit unless you ask"; CLAUDE.md: commit only when asked).

## Setup rulings

- Ruling: No TDD per task — project has no test runner (verified during planning); the approved plan's verification gates are `npm run lint` + `npm run build` + a manual dev pass. Cost if wrong: a regression could slip past lint/build — mitigated by final reviewer pass + manual verification list handed to the user.
- Ruling: No per-task commits, no feature branch — CLAUDE.md ("Commit or push only when the user asks") and the approved plan's branch note take precedence over the skill's commit-per-task flow. The whole diff stays in the working tree for user review. Cost if wrong: no rollback points — mitigated: all edits are deletions, restorable via `git checkout -- <file>`.
- Ruling: sdd-workspace script unavailable (Bash classifier outage) — workspace computed manually as `<repo-root>/.superpowers/sdd/this-is-a-major-happy-puffin/`; task-start/task-done scripts skipped, completion lines appended to this ledger manually with evidence. Cost if wrong: none — the ledger's purpose (compaction survival) is intact.

## Pre-flight scan

- Steps 1→3-8: Step 1 removes API functions/types that consumers (Steps 3-8) stop importing. Build only gates at Step 11 — mid-sequence tsc failures are expected until consumers are updated. Per-step check = targeted grep for removed symbols.
- Steps 5/6/8 → Step 9 (file deletions): Step 9 deletes `PublicQuizCard`, `useSavedQuizzes`, `useUsernames` only after Steps 5-8 remove their last imports. Ordered correctly.
- Step 9 → Step 2: `useUsernames`/`getUsersByIds` don't touch genai schema. No conflict.
- Pre-flight: no unresolved conflicts.

## Tasks

- [x] Step 1 — Data layer `src/features/quiz/api/quiz.ts`
- [x] Step 2 — GenAI schema `src/features/genai/schema/quiz-request.ts`
- [x] Step 3 — CreateQuizPage toggle removal
- [x] Step 4 — QuizCard + QuizCardItem badge/menu removal
- [x] Step 5 — QuizzesPage toggle + saved merge removal
- [x] Step 6 — HomePage For You feed removal + skeleton
- [x] Step 7 — SearchPage people-only
- [x] Step 8 — ProfilePage public-quizzes section removal
- [x] Step 9 — Delete orphaned files + trim users barrel
- [x] Step 10 — firestore.rules owner-only
- [x] Step 11 — Verify: npm run lint + npm run build
- [x] Final review — fresh reviewer subagent on full working-tree diff

## Completion log

- Task 1: complete — quiz.ts: visibility field, saveQuiz param, updateQuizVisibility, getPublicQuizzes(+ByUser), SavedQuiz + 3 saved fns, deleteQuiz savedQuizzes cleanup removed; unused `updateDoc` import removed (found during edit, plan-implicit). Evidence: grep sweep → 0 refs.
- Task 2: complete — quiz-request.ts: Visibility type, QuizRequest.visibility, isPublic param + mapping removed. Evidence: grep sweep → 0 refs.
- Task 3: complete — CreateQuizPage: isPublic state, saveQuiz 3rd arg, createQuizRequest isPublic, Visibility toggle Box removed. Evidence: grep sweep → 0 refs.
- Task 4: complete — QuizCard: Globe/Lock/BookmarkX imports, onToggleVisibility + onUnsave props, canManage, badge memos, visibilityText, Make public/private + Remove-from-saved menu items, visibility badge span removed. QuizCardItem: both props removed. Evidence: grep sweep → 0 refs.
- Task 5: complete — QuizzesPage: saved imports/state/fetch/merge/handlers/wirings removed; quizzes used directly; empty-state copy reworded. Evidence: grep sweep → 0 refs.
- Task 6: complete — HomePage: FEED_SIZE, feedQuizzes, useSavedQuizzes, useUsernames, PublicQuizCard, getPublicQuizzes, feed fetch/filter/section removed. Skeleton For You block removed. Evidence: grep sweep → 0 refs.
- Task 7: complete — SearchPage people-only (quiz results, ownerNames, cache fetch removed; copy reworded); search.ts cache fn removed; search barrel trimmed. Evidence: grep sweep → 0 refs.
- Task 8: complete — ProfilePage: Public quizzes section, saved hook, public fetch, unused user/useAuth/react imports removed. Evidence: grep sweep → 0 refs.
- Task 9: complete — deleted PublicQuizCard.tsx, useSavedQuizzes.ts, useUsernames.ts; users.ts getUsersByIds removed; users barrel trimmed. Evidence: grep sweep → 0 refs; build green.
- Task 10: complete — firestore.rules: quizzes read = owner-only; savedQuizzes block removed. (Console deploy pending — user action.)
- Task 11: complete — `npm run lint` → exit 0, 0 errors (25 pre-existing warnings, none in changed paths); `npm run build` → exit 0 (tsc -b + vite, 620ms).

## Final review

- Final review: dispatched fresh general-purpose reviewer subagent on full working-tree diff (18 files, +34/−768, branch feature/1.0-remove-public-feature). Reviewer re-ran both gates: lint exit 0 (0 errors), build exit 0. Verdict: Ready to merge — Yes. 0 Critical, 0 Important, 3 Minor.
- Final: minor (deferred): dead ownerName path in QuizCard/QuizCardItem (`!isOwner` branch unreachable now, no consumer passes ownerName) — trim, or keep as scaffolding for the future sharing feature.
- Final: minor (deferred): 3 stale comments — useQuizFavorites.ts:14 ("Distinct from saved quizzes"), StatusPage.tsx:68 ("or made private"), QuizzesPage.tsx:121 ("merged, sorted list").
- Final: minor (deferred): `.superpowers/sdd/this-is-a-major-happy-puffin/` is untracked — must NOT be staged with the feature commit.
- Final: Ruling: quizzes `allow create` lacks `request.resource.data.createdBy == request.auth.uid` (firestore.rules:19) — pre-existing rule the plan deliberately didn't touch; app UI always writes own uid, DB wipe clears legacy docs; recommend hardening in a future security pass before the sharing feature (sharing will need per-user access lists anyway). Cost if wrong: a malicious authenticated client could forge a quiz doc attributed to another user — invisible in normal app use.
- Final: Ruling: `usernames` write rule lets any authenticated user overwrite any username doc — pre-existing, unrelated to this feature; same future security pass. Cost if wrong: username takeover between users (pre-existing exposure, unchanged by this diff).
- Final: Ruling: `users` `allow get: if true` — pre-existing and still required by people search/profile pages; stands. Cost if wrong: profile fields (username, stats, email if present) readable by any signed-in user — unchanged by this diff.
- Final: Ruling: StatusPage/Home unfinished rows silently omit quiz docs the viewer can't read — moot post-wipe (attempts only reference own quizzes); stands. Cost if wrong: none.
- Final: Ruling: old bookmarked /quiz/:id URLs to formerly-public quizzes show the existing "Failed to load quiz" error state for non-owners — this IS the intended privacy outcome; stands.
- Final: Ruling: "Share with specific users" (spec core feature #6) out of scope — confirmed by plan Notes; future Messages-style feature.
- Final: Ruling: build chunk-size warning + 22 oxlint warnings — pre-existing, untouched by this diff; stands.

Workspace kept (not deleted) until the user commits — with no commits, this ledger is the only durable record of the run.

## Post-implementation incident (2026-11-04)

- Ruling: user's browser `ReferenceError: feedQuizzes is not defined` (HomePage) + `ReferenceError: onUnsave is not defined` (QuizCardItem.tsx:56) — root cause CONFIRMED as a stale dev server, not a code defect: the running dev server (PID 10877, started 18:57, before the removal edits landed 21:29–21:32) serves old transforms — curl of the live server returns `onUnsave:` at served QuizCardItem line 26 and `feedQuizzes.length > 0` at served HomePage line 222, neither of which exists on disk. Disk verified clean: grep sweep of all removed symbols → 0 matches; `tsc -b && vite build` exit 0 run after last file mtime. Vite's watcher missed the rapid burst of external edits; HMR left the browser on a broken intermediate state. Remedy: restart `npm run dev` + hard-refresh browser. No code change. Cost if wrong: none — operational only.

## Run 2 (2026-11-04): Favorites-only section on My Quizzes

- Plan: /home/carl/.claude/plans/this-is-a-major-happy-puffin.md (overwritten with the new plan; approved via ExitPlanMode). User picked "New star button" control via AskUserQuestion.
- Task 1: complete — QuizzesPage.tsx: isFavoritesView state + favoriteQuizzes/mainQuizzes memos added. Evidence: build exit 0.
- Task 2: complete — Star added to lucide import; header toggle button before sort button (aria-pressed, fill-yellow-400 active). Evidence: build exit 0.
- Task 3: complete — two-section rendering (Favorites section + main without starred; sections get space-y-4 to preserve card gaps — plan snippet omitted the className, disclosed in report). Evidence: build exit 0.
- Ruling: sections carry className="space-y-4" — today's card gaps come from the parent container's space-y-4, which no longer reaches cards nested in sections; without it cards stack with zero gap. Preserves existing spacing (plan intent). Cost if wrong: none.
- Verification: npm run lint → exit 0, 0 errors, 22 warnings (unchanged; QuizzesPage:49 set-state-in-effect is the pre-existing fetch-effect warning shifted +3 lines); npm run build → exit 0.
- Known edge (flagged to user, not fixed — beyond approved plan): with the view ON while searching, a user whose favorites exist but match nothing sees "No favorites yet — tap the star on a quiz card.", which is misleading in that context; proposed copy fix pending approval.

## Run 3 (2026-11-04 → 2026-11-05): Messages — quiz-sharing convos

- Plan: /home/carl/.claude/plans/this-is-a-major-happy-puffin.md (approved via ExitPlanMode). User decisions: full feature; share from quiz card ⋯ menu → person picker (username search); recipients open AND play (sharedWith rule branch); convo content chat-style newest-bottom.
- Step 1: complete — firestore.rules: quizzes read gains sharedWith branch; new section 7 convos + shares (read/create only; sharedBy forged-proof); quiz.ts: QuizDocument.sharedWith?: string[]. Evidence: gates green.
- Step 2: complete — src/features/messages/api/messages.ts (ConvoDocument/ShareDocument, buildConvoId, getOtherParticipantId, getUserConvos [array-contains + client-side sort], getConvoShares, shareQuizToUser) + messages/index.ts barrel. Evidence: gates green.
- Ruling: shareQuizToUser skips the convo-stats batch update when isNewConvo — plan's sequence (setDoc shareCount:1, then batch increment(1)) would double-count the first share (shareCount 2 with one share); the plan's own invariant "createdAt/shareCount are written exactly once, at creation" decides. Cost if wrong: shareCount off by one on every first share.
- Step 3: complete — QuizCard: onShare prop + canShare + gates widened (trigger/menu/pr-8) + Share item between Rename and Delete; QuizCardItem: onShare wired; QuizzesPage: shareQuiz state + handleShareQuiz + panel at root; new ShareQuizPanel.tsx (debounced searchUsernames, self excluded, per-row sharing/sent/error with Loader2 spinner + role="alert" retry); barrel exports ShareQuizPanel. Evidence: npm run lint exit 0 (22 pre-existing warnings, 0 errors, none new), npm run build exit 0.
- Ruling: SharePicker mounts only while quiz != null and SlidePanel returns null when closed — every open is a fresh remount, so the plan's "state resets per targeted quiz / reopen resets" holds with no reset effect. Cost if wrong: stale per-row states on reopen (cosmetic).
- Ruling: panel shows a one-line "Send {quiz.title}" caption — plan specified mechanics but no header context; identifies what is being shared. Cost if wrong: cosmetic.
- Note: new IDE tailwindcss diagnostics (max-w-[180px]/[500px] canonical-class suggestions) target pre-existing classes used across the codebase — left as-is.
- Step 4: complete — new MessagesPage.tsx (shimmer rows / error card + retry / empty / convo rows: avatar initial, fresh-per-visit usernames via getUserProfile batch with uid-slice fallback, lastQuizTitle · formatRelativeTime caption, ChevronRight) + new ConvoPage.tsx (back header with avatar + @username via useUserProfile, ascending chat order, ml/mr-auto literal-class bubbles, You/@them · time · Tap to play, self-guard, empty with @handle, error + retry); barrel exports both pages. Evidence: npm run lint exit 0 (22 warnings unchanged), npm run build exit 0.
- Step 5: complete — routes.tsx: /messages (Layout, showFooterNav) + /messages/:uid (Layout, no footer) in ProtectedRoute group, pages imported from '@/features/messages'; FooterNav: Messages tab (MessageCircle) between Quizzes and Status, px-3→px-2, Status untouched; usePageTransition: TAB_INDEX '/messages':3, '/status':4. Evidence: npm run lint exit 0 (22 pre-existing warnings, none new), npm run build exit 0.
- Git state: user committed the favorites work themselves; uncommitted diff = Messages feature only (5 tracked files modified + src/features/messages/ untracked). Note: .superpowers ledger is now TRACKED (earlier ruling outdated) — ledger updates ride along in future commits.

## Run 3 final review (2026-11-05)

- Final review: dispatched fresh general-purpose reviewer (opus) on the uncommitted Messages diff (8 modified tracked files + 5 new messages/ files). Reviewer re-ran both gates: lint exit 0 (22 warnings), build exit 0. Verdict: Ready to merge — yes. 0 Critical, 1 Important, 3 Minor.
- Final: fixed convo update rule — participants immutability added (firestore.rules: `request.resource.data.participants == resource.data.participants`) — a participant could otherwise rewrite `participants` to grant a third uid read access to the whole share history and forge convo metadata. Verified by rule-semantics reasoning + gates re-run (no rules test infra exists; user's console simulator deploy step still pending). Note: rules are NOT compiled by lint/build.
- Final: minor (deferred): messages.ts limit-before-sort truncation (getUserConvos:70, getConvoShares:85) — >50 convos or >50 shares in one convo drops arbitrary rows (no orderBy before limit; shares auto-ids make it random). Index-free fix for shares: orderBy('sharedAt','desc') + client reverse; convo list needs a composite index or a larger limit.
- Final: Ruling: deep-link to a pair with no convo doc shows the error card, not the plan's promised empty list — the shares read rule get()s a nonexistent parent so the query is denied; deny is correct (no data leak) and the path is manual-URL-only (MessagesPage rows always correspond to real convos). Plan's edge-case claim corrected. Cost if wrong: a misleading Try Again on a stale URL.
- Final: minor (deferred): ShareQuizPanel body empties at close-start while SlidePanel animates out (300ms) — children keyed to quiz != null; HomePage panels keep content mounted through closing. Cosmetic.
