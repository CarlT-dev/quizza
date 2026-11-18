# Fix ResultPage Flash "Not Found" Error Screen

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the flash of "Results not found" error screen when navigating to ResultPage from the QuizPage start page (without score in location.state) by showing a loading state while fetching the attempt from Firestore.

**Architecture:** The issue is a race condition where ResultPage immediately shows the "Results not found" error when `score` is null, before the Firestore fetch completes. The fix adds an `isFetchingAttempt` state that tracks whether the attempt fetch is in progress, and only shows the error after the fetch completes and no score is available.

**Tech Stack:** React, TypeScript, React Router, Firestore

**Spec:** N/A (bug fix)

## Global Constraints

- Preserve existing functionality for both navigation paths (with and without state)
- Do not change the ScorePage → ResultPage flow (already works correctly)
- Only modify ResultPage.tsx
- Maintain existing loading/error UI patterns

## Review Focus

1. **Direct navigation to ResultPage without prior attempt** - Should show "Results not found" after fetch completes
2. **Navigation from QuizPage start page with completed attempt** - Should show loading then results (no flash)
3. **Navigation from ScorePage with state** - Should work as before (no loading flash)
4. **Page refresh on ResultPage with completed attempt** - Should show loading then results
5. **Network failure during attempt fetch** - Should show error state appropriately

---

### Task 1: Add `isFetchingAttempt` state and update fetch logic in ResultPage.tsx

**Files:**
- Modify: `/home/carl/Desktop/quizza/src/features/[quiz]/pages/ResultPage.tsx`

**Interfaces:**
- Consumes: Existing `useState`, `useEffect`, `useParams`, `useNavigate`, `useLocation`, `useAuth` hooks
- Produces: Updated `isFetchingAttempt` state that controls when to show the "Results not found" error

- [ ] **Step 1: Analyze the current render logic and identify the exact fix needed**

The current flow:
1. Component mounts with `attempt = null`, `state?.score = undefined`
2. `score = state?.score ?? attempt?.score ?? null` → `score = null`
3. Guard at line 180: `if (!score)` → renders "Results not found" immediately
4. useEffect at line 52 fetches attempt from Firestore
5. Once fetch completes, `attempt` is set, `score` becomes available, re-render shows content

The fix: Add `isFetchingAttempt` state that is `true` while the fetch is in progress. Only show the "Results not found" error when `!score && !isFetchingAttempt`.

- [ ] **Step 2: Add `isFetchingAttempt` state variable**

Add a new state variable:
```tsx
const [isFetchingAttempt, setIsFetchingAttempt] = useState(false);
```

- [ ] **Step 3: Update the attempt fetch useEffect to manage `isFetchingAttempt`**

Modify the useEffect at lines 52-71:
- Set `isFetchingAttempt(true)` at the start of fetch
- Set `isFetchingAttempt(false)` in the finally block (after fetch completes, success or error)

- [ ] **Step 4: Update the "Results not found" guard condition**

Change line 180 from:
```tsx
if (!score) {
```
to:
```tsx
if (!score && !isFetchingAttempt) {
```

This ensures the error screen only shows after the fetch attempt has completed and no score was found.

- [ ] **Step 5: Handle edge case - when state?.score exists, don't fetch attempt**

The existing useEffect already has `if (!quizId || !user || state?.score) return;` guard.
We should also skip setting `isFetchingAttempt` to true when `state?.score` exists.

- [ ] **Step 6: Verify the fix works for all navigation paths**

Test scenarios:
1. QuizPage → "View results" button (completed attempt, no state) → Should show loading, then results
2. QuizPage → ScorePage → ResultPage (with state.score) → Should show results immediately (no loading)
3. Direct URL / refresh on ResultPage with completed attempt → Should show loading, then results
4. Direct URL / refresh on ResultPage without attempt → Should show loading, then "Results not found"
5. Network error during fetch → Should show loading, then error state (existing error handling)

- [ ] **Step 7: Run the application and manually verify the fix**

Start the dev server and test the navigation flows.

---

### Task 2: Verify no regression in existing functionality

**Files:**
- Test: Manual verification of all navigation paths

- [ ] **Step 1: Test ScorePage → ResultPage flow (with state)**
- [ ] **Step 2: Test QuizPage start page → ResultPage flow (without state, completed attempt)**
- [ ] **Step 3: Test direct URL access / refresh on ResultPage with completed attempt**
- [ ] **Step 4: Test direct URL access / refresh on ResultPage without attempt**
- [ ] **Step 5: Test retake flow (QuizPage → retake → ScorePage → ResultPage)**
- [ ] **Step 6: Check browser console for any errors or warnings**

---

### Task 3: Commit the changes

- [ ] **Step 1: Stage and commit the fix**
```bash
git add src/features/[quiz]/pages/ResultPage.tsx
git commit -m "fix: prevent flash of 'Results not found' error on ResultPage

- Add isFetchingAttempt state to track Firestore fetch status
- Only show 'Results not found' error after fetch completes
- Preserves existing behavior for ScorePage → ResultPage navigation (with state)"
```