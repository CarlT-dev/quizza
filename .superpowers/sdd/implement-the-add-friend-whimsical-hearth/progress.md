# SDD ledger — plan: /home/carl/.claude/plans/implement-the-add-friend-whimsical-hearth.md

Pre-flight: Task 2 (api) produces types/functions consumed by Task 3 (hook), Task 5 (page), Task 8 (panel); Task 4 (barrel) consumed by Tasks 6/7/8. Signatures cross-checked against the approved plan text — consistent, no conflicts. Task 1 (rules) shapes all writes in Task 2 — the plan's rules block and api payloads were written together and verified against convos precedents.

Rulings:
- Setup: Ruling: no separate worktree — work happens directly on `feature/1.0-implement-add-friend` (clean, dedicated branch created by Carl for this feature; not master). Cost if wrong: none expected; branch isolation already exists.
- Setup: Ruling: TDD sub-skill inapplicable — repo has no test runner and the approved plan explicitly excludes new dependencies; per-task verification gate = `npm run build` (tsc -b + vite) with output read, plus `npm run lint` at final verification, per the approved plan's Verification section. Cost if wrong: type-level regressions caught only by build; manual E2E script (plan Step 9) is the behavioral gate.
- Setup: Ruling: no commits during implementation — the approved plan contains no commit steps and Carl commits his own work (recent history shows user-authored commits). Cost if wrong: none; working tree left for review.

Task 1 (rules block): complete — `firestore.rules` block 8 appended after convos; console/Rules-Playground verification deferred to Carl (manual step, flagged in final report).

Task 2 (api/friends.ts): complete — types, buildFriendshipId, getOtherParticipantUid, getFriendships (array-contains, cap 200, client-side partition), sendFriendRequest (transaction collision table), accept/decline/cancel/remove via deleteFriendshipIf.

Task 3 (hooks/useFriendships.ts): complete — useUserProfile shape with authLoading gate, reloadToken refetch, deferred effect.

Task 4 (index.ts barrel): complete — api fns/types, hook, FriendsPage.

Task 5 (pages/FriendsPage.tsx): complete — back header, skeleton/error/empty ladder, add-friends search (self filtered, relation-aware action cells: Add/Friends/Requested/Accept), Pending requests (Accept+Decline), Sent requests (Cancel), Friends (Remove, alphabetical by resolved name), busyUids/failedUids mutation UX, inline failure notes.

Task 6 (routes.tsx): complete — `/friends` registered inside ProtectedRoute, no showFooterNav (footer stays 5 tabs).

Task 7 (MessagesPage header): complete — justify-between + Link to /friends with Users icon; imports added.

Task 8 (ShareQuizPanel): complete — PersonRow extracted (shared by friends quick-pick + search results), friends section above search (skeleton while loading, hidden when zero friends), friend names resolved fresh per open, friendUids de-dup filter extended (pending contacts still searchable), handleShare reused unchanged.

Gate (lint): `npm run lint` → exit 0; zero findings in features/friends, ShareQuizPanel, MessagesPage, routes.tsx; 22 pre-existing warnings in unrelated files. Full output: /tmp/quizza-lint.txt.

Gate (build): passed earlier in session (tsc -b + vite clean) before scope change.

SCOPE CHANGE (Carl, approved 2026-11-05): Friends page removed; Add Friend moves to ProfilePage; friends auto-appear on MessagesPage; Home bell/panel gets real data (friend requests with Accept/Decline, quiz shares, red dot). Revised plan presented in chat; Carl approved with "yes".

Rulings (revised scope):
- Notification id scheme: friend-request rows use deterministic id `fr_{recipient}_{from}` so settling the request deletes the exact row without a query; `friend-request-accepted` and `quiz-share` rows use auto ids (unique per event — no update rule needed, rows are only created/removed). Cost if wrong: a stale fr_ row would need a query-based cleanup; lifecycle analysis shows fr_ docs never outlive their pending request.
- Rules block 9 delete predicate: `userId == auth.uid || fromUid == auth.uid` — the actor may retract a row they planted (needed for cancel, where the pending row lives in the OTHER user's feed). Cost if wrong: a sender could delete their own planted rows only; recipient keeps full control of their feed.
- Decline is silent (no notification to the requester) — standard social pattern; only accept reflects ("@B accepted your friend request"), per Carl's reflection requirement.
- Red dot = live friend-request rows (exist exactly while pending) OR any non-request notification newer than a localStorage per-device seen marker written when the panel opens. No per-row read flags, no Firestore writes for "seen". Cost if wrong: dot is per-device (account on another device shows its own dot) — accepted, matches "this browser looked" semantics.
- Skipped the reviewer's Minor hardening (add `respondedAt == null` to friendships create rule) — deferred minor, not in approved plan.
- Friends-row degradation on MessagesPage: if the friendships query fails, the page still renders convos (hook logs the error); friend rows are silently absent. Cost if wrong: partial feature loss in a rare failure case, no data risk.
- IDE tailwind suggestCanonicalClasses warnings (max-w-[500px], flex-shrink-0) left as-is — repo consistently uses the old style everywhere.

Tasks (revised scope):
- Reverts: FriendsPage.tsx deleted (+ pages/ dir); /friends route + import removed from routes.tsx; friends barrel slimmed; MessagesPage header reverted to original; ShareQuizPanel restore via git checkout — PENDING (Bash classifier outage; retrying).
- firestore.rules block 9 (notifications): appended; CEL precedence bug in first draft (|| branch escaped the auth checks) caught and fixed with explicit parens.
- features/notifications: api/notifications.ts (types, buildRequestNotificationId, getNotifications), seen.ts (localStorage marker), hooks/useNotifications.ts, index.ts — created.
- friends.ts: sendFriendRequest tx now also writes the fr_ row; acceptFriendRequest rewritten as one transaction (accept flip + own fr_ row delete + requester's accepted row create); deleteFriendshipIf batch-deletes the friendship and the pair's fr_ row (no-op when already gone).
- messages.ts: shareQuizToUser batch writes the recipient's quiz-share row.
- NotificationContent.tsx: rewritten — real feed, Accept/Decline on request rows, accepted confirmations, quiz-share rows open the convo; always-refetch mutation UX (designs out both reviewer Important findings).
- HomePage.tsx: red dot on bell (hasUnseen from fr_ rows + createdAt vs lastSeenMs), seen-marker effect on panel open, refetch on panel close.
- MessagesPage.tsx: friends without a convo render as rows ("No shared quizzes yet"); names resolve for convos + friends; skeleton gate includes friendsLoading.
- ProfilePage.tsx: relation button (Add Friend / Cancel request / Accept+Decline / Remove Friend; hidden on self and while friendships unavailable); derived from live buckets, always refetch after mutations.
- Gates (lint + build): pending Bash availability.

Gates (final): `npm run lint` → exit 0; zero findings in all changed/new files (friends, notifications, home, messages, users, routes); only the pre-existing warnings in unrelated files remain. `npm run build` → tsc -b + vite build clean, ✓ built in 543ms. ShareQuizPanel.tsx verified byte-identical to HEAD (empty `git diff --stat`) after classifier outage forced a Write reconstruction + two corrective Edits taken from the git diff text. routes.tsx also back to HEAD exactly (dropped out of git status). Final fresh-context review dispatched (background) — results to be relayed.

LIVE TEST FINDING (Carl, 2026-11-05): Add Friend failed with 403 permission-denied on the tx.get of friendships/{pairId} — the batchGet in the sendFriendRequest transaction. Ruling: reads of NON-EXISTENT docs evaluate with a null resource, so `request.auth.uid in resource.data.participants` denies the fresh-pair existence check; the repo's own quizAttempts/quizPreferences rules already use the `resource == null ||` pattern for exactly this. Fixed (Carl approved): friendships read rule and notifications read/delete rule both gained `resource == null ||` — the notifications one also covers no-op batch-deletes of already-settled request rows. Known accepted trade-off: an authenticated user can distinguish "pair doc doesn't exist" from "exists but not a participant" (pair-existence oracle) — judged minor for this app (usernames already fully public). RULES PUBLISH to the Firebase console remains a required manual step before the flow works.

FINAL REVIEW (fresh-context, 2026-11-05): 1 Critical, 1 Important, 4 Minor. Both main findings re-verified against source before proposing fixes; fixes presented to Carl, pending approval (CLAUDE.md gate).

- Critical #1 (verified: ConvoPage.tsx:46, messages.ts:83-88, rules:107-110): tapping a friend-only MessagesPage row navigates to /messages/:uid with NO parent convo; getConvoShares queries convos/{id}/shares whose read rule get()s the parent — get() on a non-existent doc ERRORS and denies the whole rule → first contact lands on "Unable to Load Conversation" instead of "No Quizzes Shared Yet". Pre-existing rule, newly reachable via the friend rows. Proposed fix: widen the shares read rule with `(!exists(parent) || uid in get(parent).data.participants)` — exists() returns false (no error) on missing docs. Caveat checked: shares under a missing parent are impossible via the client (shares create still get()s the parent; convos have no delete path) — only console/admin action could orphan one, so the widening exposes nothing real. Alternative rejected: ConvoPage parent-check-first needs getDoc on a missing convo, which the convos read rule ALSO denies (same null-resource class) → second rules widening + more code.
- Important #2 (verified: rules:184-195, friends.ts:234-236): notifications create needs only fromUid==auth && userId!=auth, so any authed user knowing a uid can plant fr_{victim}_{attacker}. With no friendship doc, deleteFriendshipIf returns false BEFORE the batch → the victim's Decline never removes the row (stuck, "Failed — try again" forever); and a genuine request over the same fr_ id is a tx.set on an EXISTING doc = update → no update rule → denied → 'send-failed' every time (attacker poisons their own pair channel). Proposed fix: decline/cancel settle the pair's fr_ row UNCONDITIONALLY (doc deleted only when the predicate holds; row orientation when the doc is absent comes from the caller: decline→they sent fr_{me}_{other}, cancel→I sent fr_{other}_{me}). Every such delete is already rules-legal (userId==me / fromUid==me / resource==null). removeFriend stays doc-gated; accept stays strict — forged rows clear via Decline, which also unblocks the channel. Ruled out: requiring the friendship to exist at notification-create time — rules get()/exists() inside the send tx see pre-transaction state and would deny every legitimate request.
- Minors deferred (ledgered, not fixing without approval): #3 accept+decline race can orphan an inert "accepted" row (benign display artifact); #4 device clock behind server keeps the dot red after panel open (cheap mitigation: on open, treat newest server createdAt as now); #5 no dismissal for quiz-share/accepted rows (feed fills toward the 50 cap — product decision); #6 ProfilePage shows the failure note above the correctly-updated button after a settled-false action (cosmetic).
- Reviewer's declined-to-judge list: each maps to an already-ledgered ruling or pre-existing scope (usernames write rule, quizzes create rule, limit-before-sort, pair-existence oracle, per-device dot, silent decline, tailwind style, no test runner, no realtime, no field allowlists, shareQuizToUser race window untouched by this branch).
