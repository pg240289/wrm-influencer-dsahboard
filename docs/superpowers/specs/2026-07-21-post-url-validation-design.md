# Post URL Validation, Normalization & Apify Fix — Design

**Date:** 2026-07-21
**Status:** Approved (design), pending implementation plan
**Branch:** dev-apify

## 1. Problem

When a Campaign Executor (or an influencer via the portal) records the posts published for a
campaign, they paste a social media URL per platform. Today those URLs are stored verbatim,
including tracking junk (e.g. `?igsh=…`), with no validation. Two consequences:

1. **Dirty / wrong URLs reach the daily metrics job**, which then silently fails per post.
2. **The Instagram fetch never worked at all** — both `app.py` and `social_metrics_service.py`
   call the wrong Apify actor (`apify/instagram-post-scraper`, which requires a profile
   `username`) with the wrong input (`{"posts":[url]}`). The correct actor for fetching one
   post by URL is `apify/instagram-scraper` with `{"directUrls":[url], "resultsType":"posts"}`
   (verified live against the Apify token on 2026-07-21).

## 2. Goals

- Give users **per-platform notes/hints + an example** at each URL input.
- **Validate** each pasted URL against the assignment's platform; **hard-block** invalid or
  wrong-platform URLs with a clear inline error.
- Store only the **canonical, cleaned URL** (strip tracking params + fragments, normalize host).
- **Fix the production Apify Instagram calls** so fetching works end-to-end.
- Make validation **robust to the existing `X (Twitter)` vs `Twitter / X` name drift** via
  backend alias-normalization. We do NOT rewrite stored platform strings or existing UI labels
  (that would risk the influencer platform-filter, which keys on `'X (Twitter)'`); full name
  unification is deferred to the Platforms-master work.

## 3. Decisions (ratified)

| Decision | Choice |
|---|---|
| What to store | **Canonical clean URL** (full, clickable, fetch-ready) |
| Strictness | **Hard block** on invalid / wrong-platform, inline error |
| Where validation lives | **Backend authoritative** (the gate) + lightweight frontend mirror (UX) |
| Apify prod fix | **Bundled** into this work |
| Facebook | **Lenient** (accept-and-clean; cannot always canonicalize) |

## 4. Out of scope (explicitly)

- Duplicate-URL detection within a campaign.
- A `/api/platforms` config endpoint.
- A full "Platforms" / "Content Types" master screen (separate backlog item).
- Backfilling/normalizing existing stored URLs (not required — the corrected Apify call and the
  other fetchers tolerate messy URLs). Optional future script.
- Changing the Content storage model (still store the URL string; no new columns).

## 5. Per-platform specification

Detected platform must match the assignment's platform (after name normalization). `content_type`
is *suggested* from the URL; the user's explicit selector remains authoritative.

### Platform name normalization (canonical set)
`Instagram`, `YouTube`, `Facebook`, `Twitter`, `LinkedIn`. Input aliases mapped:
- `Twitter`, `X`, `X (Twitter)`, `Twitter / X` → **Twitter**
- everything else matched case-insensitively to its canonical name.

### Instagram
- **Accepts:** `instagram.com/(p|reel|tv)/{shortcode}` (+ optional `www.`, `m.`, query, fragment)
- **Regex:** `(?:https?://)?(?:www\.|m\.)?instagram\.com/(p|reel|tv)/([A-Za-z0-9_-]+)`
- **Canonical:** `https://www.instagram.com/{type}/{shortcode}/`
- **content_type:** `p`→Post, `reel`→Reel, `tv`→Video

### YouTube
- **Accepts:** `watch?v={id}`, `youtu.be/{id}`, `youtube.com/shorts/{id}`, `youtube.com/embed/{id}`
- **Video id:** 11 chars `[A-Za-z0-9_-]{11}`
- **Canonical:** shorts → `https://www.youtube.com/shorts/{id}`; otherwise `https://www.youtube.com/watch?v={id}`
- **content_type:** shorts→Short, else Video

### Twitter / X
- **Accepts:** `(twitter.com|x.com)/{user}/status/{id}`, `/i/web/status/{id}`, `/i/status/{id}`
- **Regex:** `(?:twitter\.com|x\.com)/(?:i/(?:web/)?)?(?:([A-Za-z0-9_]{1,15})/)?status/(\d+)`
- **Canonical:** `https://x.com/{user or i}/status/{id}` (host normalized to `x.com`)
- **content_type:** Tweet

### Facebook (lenient)
- **Accepts (best-effort id):** `/posts/{id}`, `/videos/{id}`, `watch/?v={id}`, `fb.watch/{code}`, `pfbid…`
- **Behavior:** if a Facebook host / `fb.watch` is present → accept. Strip fragments and all
  query params **except** `v` on `watch` URLs. Store the host-normalized, cleaned URL. If the
  URL is not recognizably Facebook at all → reject.
- **content_type:** `/videos/` or `watch`→Video, `/reel/`→Reel, else Post

### LinkedIn
- **Accepts:** `urn:li:activity:{id}`, `urn:li:share:{id}`, `linkedin.com/posts/{slug}-{id}-`
- **Canonical:** `https://www.linkedin.com/feed/update/urn:li:activity:{id}/`
- **content_type:** Post

## 6. Backend design

### 6.1 New module: `backend/url_utils.py`
Single source of truth for platform URL handling. No Flask/DB imports (pure, testable).

```python
PLATFORM_URL_SPECS = { ... }              # per-platform patterns, templates, hints, examples
CANONICAL_PLATFORMS = ["Instagram", "YouTube", "Facebook", "Twitter", "LinkedIn"]

def normalize_platform_name(name: str) -> str | None
def normalize_post_url(raw_url: str, expected_platform: str | None) -> dict
```

`normalize_post_url` returns:
```python
{
  "ok": bool,
  "canonical_url": str | None,
  "platform": str | None,            # detected, canonical name
  "post_id": str | None,             # shortcode / video id / tweet id / activity id
  "suggested_content_type": str | None,
  "error": str | None,               # human-friendly message when ok is False
}
```

Rules:
- Empty/whitespace input → `ok=False, error="URL is required"`. Callers whose URL field is
  optional (e.g. `CampaignInfluencer.link`) skip the call when the value is blank.
- Platform detected but pattern doesn't match → `ok=False` with the platform's hint.
- `expected_platform` set and detected ≠ expected → `ok=False,
  error="This looks like a {detected} URL, but this post is on {expected}. Paste a {expected} link."`
- Cannot detect any platform → `ok=False, error="Enter a valid {expected} post URL"` (or generic
  if no expected platform).

### 6.2 Error contract
On rejection the endpoint returns HTTP **400** with `{"error": "<message>", "field": "url"}`
(or `"field": "link"` for the assignment-level link field).

### 6.3 Wiring points (all URL write paths)
Validate + store canonical in each:
- `POST /api/campaigns` — `influencer_assignments[].link` and `…content_links[].url` (app.py ~1369-1404)
- `POST /api/campaigns/<id>/influencers` — `link` (app.py:1499)
- `PUT  /api/campaigns/<id>/influencers/<aid>/link` — `link` (app.py:1546)
- `POST /api/campaigns/<id>/influencers/<aid>/content` — `url` (app.py:1596)
- `PUT  /api/campaigns/<id>/content/<cid>` — `url` (app.py:1634)
- `POST /api/influencer/me/assignments/<aid>/content` — `url` (app.py:2490)
- `PUT  /api/influencer/me/content/<cid>` — `url` (app.py:2528)

For content endpoints, the assignment/content already carries the platform → pass it as
`expected_platform`. If `suggested_content_type` is present and the caller didn't supply one, use it.

### 6.4 Apify production fix (bundled)
In both `app.py:2788` and `social_metrics_service.py:298`:
```python
# before
client.actor("apify/instagram-post-scraper").call(run_input={"posts":[url], "detailLevel":"detailedData"})
# after
client.actor("apify/instagram-scraper").call(run_input={
    "directUrls": [url], "resultsType": "posts", "resultsLimit": 1, "addParentData": False,
})
```
Output field parsing is unchanged (`likesCount`, `commentsCount`, `videoViewCount`/`videoPlayCount`,
`displayUrl`, `caption`, `timestamp`, `type` all still present).

## 7. Frontend design

### 7.1 New module: `frontend/src/lib/platforms.js`
Single source for the 3 post-URL forms (`NewCampaign.jsx`, `CampaignDetail.jsx`,
`portal/InfluencerCampaign.jsx`). `InfluencerForm.jsx` (profile handles, not post URLs) is left
as-is and can migrate later. Campaign-side platform `value` stays `'X (Twitter)'` to preserve the
existing influencer filter + follower maps.

```js
export const PLATFORMS = [
  { value:'Instagram', label:'Instagram',
    contentTypes:['Post','Reel','Story','Video'],
    hint:'Link to the specific post or reel (…/p/… or …/reel/…).',
    example:'https://www.instagram.com/reel/DUh4219jFCf/',
    urlRegex:/^https?:\/\/(www\.|m\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i },
  // YouTube, Twitter, Facebook, LinkedIn …
];
export const CONTENT_TYPES = ['Post','Reel','Story','Video','Short','Tweet'];
export function platformSpec(value) { ... }
```

### 7.2 URL inputs (NewCampaign.jsx, CampaignDetail.jsx, portal/InfluencerCampaign.jsx)
- Show `hint` + `example` as helper text under each URL field.
- On blur/change: test `urlRegex`; if the (non-empty) value fails → inline error + show example.
- Disable the add/save control while a required URL is empty or an entered URL is invalid.
- On submit, map a backend `400 {field:'url'}` to the field's error state.

Frontend regex is intentionally *loose* (format sanity only); the backend performs precise
extraction + canonicalization + platform cross-check.

## 8. Edge cases

- Query strings / fragments stripped; trailing slash normalized to the canonical template.
- Host normalization: `m.instagram.com`→`www.instagram.com`, `youtu.be`→`youtube.com/watch`,
  `twitter.com`→`x.com`.
- Optional link field left blank → skipped (not an error).
- Facebook `pfbid` / unusual formats → cleaned but possibly non-canonical (documented behavior).
- Existing stored URLs are left as-is (no backfill); corrected fetchers tolerate them.

## 9. Testing

- **New:** `backend/test_url_utils.py` (pytest) — first backend test in the repo. Per platform:
  valid variants, invalid, wrong-platform mismatch, messy query strings, host variants, empty.
  Assert both `canonical_url` and `error` messaging.
- Apify fix: covered by the existing standalone `backend/test_apify_instagram.py` (manual, uses credits).
- Frontend: manual verification of inline error + helper text on the three forms.

## 10. Risks

- Frontend/backend regex drift (mitigated: backend is authoritative; frontend regex is loose).
- Facebook leniency means some Facebook URLs stored may still not be fetchable — acceptable, and
  Facebook fetch reliability is a separate known issue.
