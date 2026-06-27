# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GradGuide — a WeChat Mini Program for Chinese students applying to overseas graduate programs. Provides school matching, gap diagnosis, what-if simulation, and AI-assisted essay drafting. Product/brand voice lives in `PRODUCT.md` (温暖·陪伴·鼓励; design must stay 专业可信 without becoming 冷冰冰).

**Tech Stack:**
- **Frontend:** Native WeChat Mini Program (原生小程序), ES5/ES6, WXML/WXSS. No Vue/React, no build step, no npm dependencies in the mini program itself. WeUI extended lib is enabled (`useExtendedLib.weui` in `app.json`).
- **Backend:** WeChat Cloud Development (云开发) — cloud functions (Node.js + `wx-server-sdk`, each has its own `package.json`/`node_modules`) + cloud database. Cloud env id: `cloud1-d7guh4c7wcad0635c`.

## How to Run

Open in **WeChat DevTools** (微信开发者工具) at project root `D:\Users\XieYC\claude-workspace\GradGuide\miniprogram`. No frontend `npm install` or build needed — import the folder and click Preview/Compile.

- Cloud functions live in `cloudfunctions/` (`cloudfunctionRoot` per `project.config.json`). Deploy via DevTools GUI (right-click → 上传并部署) or the DevTools CLI (`cli.bat cloud functions deploy --names <name> --remote-npm-install`). See `.claude/settings.local.json` for examples.
- Cloud env must be `cloud1-d7guh4c7wcad0635c` (also hardcoded in `app.js` `onLaunch`).

## Tests

Plain Node `assert` tests in `tests/` — **no test framework, no root `package.json`**. Run individually:
```
node tests/calc-diff.test.js
node tests/match-allocation-v2.test.js
```
They import shared logic directly (e.g. `cloudfunctions/matchPrograms/match-logic.js`) and assert. Covers: match allocation/diff, score consistency, login config & wxProfile separation, GPA input, profile step UI. Run the relevant test after touching `match-logic.js` or profile/login logic.

## Code Architecture

### Design System
- Token-based: `design-token.wxss` (raw tokens) + `app.wxss` (utility classes). Primary `--c-primary: #2e5d50`.
- Hard constraints: no gradients (无渐变), no emoji icons (无 emoji 图标 — use Remix Icon/小程序图标), no glassmorphism (无玻璃态). See `PRODUCT.md` for the full anti-references.
- Utility classes: `.btn-*`, `.card`, `.tag-*`, spacing (`mt-*`, `px-*`, `gap-*`). Shared profile-step styles in `styles/profile-step.wxss`.
- `reducedMotion`: small program can't read system `prefers-reduced-motion`, so users toggle it in 「我的」; pages bind `class="reduced-motion"` on root to trigger fallback styles.

### Global State (`app.js`)
- `app.globalData.userProfile` — pure profile fields (gpa/toefl/research...), **separate from** `wxProfile` (avatarUrl/nickName). Merged-not-overwritten on load to avoid clobbering locally-edited fields.
- `app.globalData.simState` — simulator baseline.
- `isLoggedIn`, `hasOnboarded`, `statusBarHeight`/`menuButton` (safe-area for future custom nav), `reducedMotion`.
- **Persistence:** `hasOnboarded` and `reducedMotion` go to `wx.setStorageSync`. The full profile/favorites/simHistory/matchResult persist via cloud `users` collection (not local storage). On cold start, if `hasOnboarded`, `onLaunch` calls `loginAndLoad()` → `login` + `getUser` cloud functions → merges profile → notifies pages via `page.onProfileReady()` hook (implement this on any page that needs to react to loaded profile).

### Data Layer
- **Static fallback:** `utils/data.js` — `PROGRAMS` (~21 school-program objects) and `TIER_CONFIG` (tier labels/desc/probability ranges). `TIER_CONFIG` is used by `match.js` for display; `PROGRAMS` is lazy-`require`d as a fallback. Program schema: `id, school, shortName, country, region, major, rank, minGpa/avgGpa, toefl, gre, tier (reach|match|safety), deadline, tuition, duration, highlight, selectivityBand (elite|high|mid|friendly)`.
- **Live source:** cloud `programs` collection (queried by `getPrograms`/`matchPrograms` with `enabled: true` filter). Add/edit programs there, not just the static array.
- **Matching algorithm:** `cloudfunctions/matchPrograms/match-logic.js` — exports `runMatch, calcFitScore, getSelectivityBand, BAND_MAP, TARGET_COUNTS, allocateBuckets, calcDiff, qualifiesForExtremeReach, filterBySchoolBand`. Shared by `matchPrograms`, `saveProfile` (triggerMatch on save), and `simulateMatcher`. This is the single source of truth for matching — keep the three callers consistent.

### Utility Functions (`utils/util.js`)
- `calcScore(state)` → 0-100 composite score from GPA, TOEFL, GRE, paper/research/intern/award counts.
- `calcTier(score, baseScore, baseTier)` → reach/match/safety counts from score delta.
- `classifyProgram`, `fmtDelta(d)` → formatted +/- display object.

### Cloud Backend
Cloud env `cloud1-d7guh4c7wcad0635c`. Collections: `users` (`_openid, profile, wxProfile, favorites[], simHistory[], matchResult, matchResultUpdatedAt, createdAt, updatedAt`), `programs`. Cloud functions in `cloudfunctions/`:

| Group | Functions |
|-------|-----------|
| Auth/user | `login` (auto-creates user record on first login), `getUser`, `saveProfile` (partial update + triggers re-match), `migrateData` (one-shot, run from console) |
| Programs | `getPrograms` (filter by region/major), `getProgramDetail`, `searchPrograms` |
| Match/sim | `matchPrograms`, `simulateMatcher`, `compareProfile`, `getBenchmarks`, `generateTodos` |
| Favorites | `addFavorite`, `removeFavorite`, `getFavorites` |
| Sim history | `saveSimResult`, `getSimHistory`, `deleteSimResult` |

All user-scoped functions get `OPENID` from `cloud.getWXContext()` and key off `_openid`. `saveProfile` merges incoming fields into existing `profile` (partial update) and recalculates `matchResult` on every save.

### Page Structure

TabBar = 4 tabs (home / match / diagnosis / mine). Full page list per `app.json`:

| Page | Tab | Purpose |
|------|-----|---------|
| `onboarding` | ❌ | First-run intro; gates the rest until `hasOnboarded` |
| `home` | ✅ | Landing: hero, quick predict, value props, flow intro |
| `match` | ✅ | School list filtered by region (US/HK/UK) & major (CS/MKT), tiered cards (live from `getPrograms`/`matchPrograms`) |
| `diagnosis` | ✅ | Canvas 7-dimension radar chart vs benchmark tier |
| `mine` | ✅ | 「我的」: profile summary, settings (reducedMotion toggle), entries |
| `profile/step1..5` | ❌ | 5-step wizard (school level → grad year → scores → experience → targets); `profile/init` is the entry |
| `simulator` | ❌ | What-if sliders (GPA/TOEFL/GRE) + boost toggles → live score/tier + TODO checklist |
| `sim-history-detail` | ❌ | Saved simulation result detail |
| `essay` | ❌ | AI essay generator: select type → fill form → free preview → paywall → full content |

- Tab pages use `wx.switchTab`; non-tab pages use `wx.navigateTo`.

### Page Pattern
Each page: `page.js` (`Page()` constructor + event handlers + canvas/cloud calls) → `page.wxml` (template) → `page.wxss` (scoped styles) → `page.json` (component config). Pages that need cloud-loaded data implement `onProfileReady()`.

### Key Constraints
- No `<script>` tags in WXML — all logic in `.js` files.
- No `<style>` in WXML — all styles in `.wxss` files.
- `wx:for` / `wx:if` for conditional rendering, no virtual DOM.
- Canvas API for radar chart (no ECharts dependency).
- Paywall uses CSS `filter: blur(6px)` + `pointer-events: none`.
- `appid: wx207f70f228ee3db5`, SDK version: `3.16.2`.
- Keep matching logic in one place (`match-logic.js`); don't re-implement scoring/tiering ad-hoc in pages.
