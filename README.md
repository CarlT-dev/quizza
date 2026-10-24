# Quizza - Quiz Application

A mobile-first quiz application built with React, TypeScript, and Tailwind CSS.

---

## Project Structure

```
src/
├── app/                    # App-level configuration & routing
├── features/               # Feature-based modules (domain-driven)
├── shared/                 # Truly shared code (used by 2+ features)
├── styles/                 # Global styles & Tailwind
├── App.tsx                 # Root component
├── main.tsx                # Entry point
└── assets/                 # Static assets (images, icons)
```

---

## Directory Guide

### `/app` — Application Shell
**Purpose:** App-wide configuration, routing, and providers.

| Folder | Purpose |
|--------|---------|
| `layouts/` | Page-level layout components (e.g., `MainLayout`, `AuthLayout`) |
| `providers/` | React Context providers (AuthProvider, ThemeProvider, etc.) |
| `routes/` | Route definitions and route guards |
| `index.ts` | Barrel export for app module |

**Rule:** Only one per app. Features should NOT import from each other — they communicate via shared services or app-level providers.

---

### `/features` — Business Logic Domains
**Purpose:** Each feature is a self-contained domain (auth, quiz, results).

```
features/
├── auth/
│   ├── components/   # Auth-specific UI (LoginForm, RegisterForm)
│   ├── hooks/        # Auth-specific hooks (useLogin, useRegister)
│   ├── services/     # API calls (authApi.ts)
│   ├── types/        # TypeScript types (User, AuthState)
│   └── index.ts      # Public API — only export what consumers need
├── quiz/
│   ├── components/   # Quiz UI (QuestionCard, AnswerOption, Timer)
│   ├── hooks/        # Quiz logic (useQuiz, useQuizProgress)
│   ├── services/     # Quiz API (quizApi.ts)
│   ├── types/        # Types (Question, Answer, QuizSession)
│   └── index.ts
└── results/
    ├── components/   # Results UI (ScoreDisplay, AnswerReview)
    ├── hooks/        # Results logic (useResults)
    ├── types/        # Types (QuizResult, UserStats)
    └── index.ts
```

**Rules:**
- **Colocation:** Keep component + its types + hooks + tests together
- **Barrel exports:** Use `index.ts` to control public API
- **No cross-feature imports:** `auth` cannot import from `quiz` directly
- **Feature = deployable unit:** Each feature could theoretically be extracted

---

### `/shared` — Truly Shared Code
**Purpose:** Code used by **2 or more features**. If only one feature uses it, keep it in that feature.

```
shared/
├── components/
│   ├── ui/           # Design system primitives (Button, Input, Card, Modal)
│   └── layout/       # Shared layout components (Header, Footer, Layout)
├── hooks/            # Generic hooks (useLocalStorage, useDebounce, useMediaQuery)
├── utils/            # Pure functions (formatDate, validateEmail, classNames)
├── types/            # Cross-cutting types (ApiResponse, PaginatedResponse)
├── constants/        # App-wide constants (API_URL, STORAGE_KEYS, REGEX_PATTERNS)
└── index.ts          # Barrel export
```

**Rules:**
- **UI components** must be generic — no business logic
- **Hooks** must be reusable across unrelated features
- **Utils** must be pure functions with no side effects
- **Ask before adding:** "Will another feature use this?" If no → keep in feature

---

### `/styles` — Global Styles
| File | Purpose |
|------|---------|
| `globals.css` | Tailwind imports, CSS variables, global resets, base styles |

---

## Import Conventions

### Path Aliases (configured in `tsconfig.app.json` & `vite.config.ts`)

```ts
// ✅ Good — uses alias
import { Button } from '@/shared/components/ui';
import { useAuth } from '@/features/auth/hooks';

// ❌ Avoid — relative paths break on move
import { Button } from '../../../shared/components/ui/Button';
```

---

## Adding New Code — Decision Tree

```
Is this UI used by multiple features?
  │
  ├─ YES → /shared/components/ui/
  │
  └─ NO → Is it layout structure (header, footer, page wrapper)?
          │
          ├─ YES → /shared/components/layout/
          │
          └─ NO → Is it business logic for a specific domain?
                  │
                  ├─ YES → /features/<domain>/(components|hooks|services|types)/
                  │
                  └─ NO → Is it a pure utility function?
                          │
                          ├─ YES → /shared/utils/
                          │
                          └─ NO → Is it a reusable hook?
                                  │
                                  ├─ YES → /shared/hooks/
                                  │
                                  └─ NO → Is it a TypeScript type used across features?
                                          │
                                          ├─ YES → /shared/types/
                                          │
                                          └─ NO → Keep it in the feature where it's used
```

---

## Quick Reference — Where Things Go

| Code Type | Location |
|-----------|----------|
| Login form | `features/auth/components/LoginForm.tsx` |
| `useLogin()` hook | `features/auth/hooks/useLogin.ts` |
| `login()` API call | `features/auth/services/authApi.ts` |
| `User` interface | `features/auth/types/user.ts` |
| Reusable Button | `shared/components/ui/Button.tsx` |
| App Layout wrapper | `shared/components/layout/Layout.tsx` |
| `useLocalStorage()` | `shared/hooks/useLocalStorage.ts` |
| `formatCurrency()` | `shared/utils/format.ts` |
| `ApiError` type | `shared/types/api.ts` |
| `API_BASE_URL` | `shared/constants/api.ts` |
| Route definitions | `app/routes/routes.tsx` |
| Auth Provider | `app/providers/AuthProvider.tsx` |

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `QuestionCard.tsx` |
| Hooks | camelCase + `use` prefix | `useQuizProgress.ts` |
| Services | camelCase + `Api` suffix | `quizApi.ts` |
| Types | PascalCase | `QuizSession.ts` |
| Utils | camelCase | `formatDate.ts` |
| Constants | SCREAMING_SNAKE_CASE | `API_ENDPOINTS.ts` |
| Barrel exports | `index.ts` | Always at folder root |

---

## Git Workflow

1. **Branch:** `feature/<issue-number>-<short-description>`
2. **Commits:** Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`)
3. **PR:** Target `main` branch
4. **Review:** At least one approval required

---

## Commands

```bash
# Development
npm run dev

# Build (type-check + production build)
npm run build

# Preview production build
npm run preview

# Lint
npm run lint

# Type check only
npx tsc --noEmit
```

---

## Tech Stack

- **React 19** + **TypeScript**
- **Vite** for bundling
- **Tailwind CSS v4** for styling
- **React Router** for routing (to be added)
- **Path aliases:** `@/*` → `src/*`

---

## For Junior Developers — Common Pitfalls to Avoid

| ❌ Don't | ✅ Do |
|----------|------|
| Put everything in `components/` | Use feature folders |
| Import across features (`auth` → `quiz`) | Use shared services or app providers |
| Create deep nesting (`ui/forms/inputs/`) | Keep flat (`ui/Input.tsx`) |
| Skip barrel exports | Always add `index.ts` |
| Put business logic in UI components | Extract to hooks/services |
| Hardcode API URLs | Use `shared/constants/api.ts` |
| Use relative imports `../../../` | Use `@/` alias |
| Commit directly to `main` | Use feature branches + PRs |

---

## Questions?

Check this guide first. If still unclear, ask a senior dev — it's better to ask than to create technical debt.