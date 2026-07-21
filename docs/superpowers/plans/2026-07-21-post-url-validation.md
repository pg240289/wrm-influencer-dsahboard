# Post URL Validation, Normalization & Apify Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate every pasted social-post URL against its platform, store only the canonical cleaned URL, show per-platform hints/inline errors, and fix the broken production Apify Instagram call.

**Architecture:** A pure Python module `backend/url_utils.py` is the single source of truth for detecting a platform, validating a post URL, and producing its canonical form. All backend URL write-paths route through one `_clean_post_url` helper. The frontend gets `frontend/src/lib/platforms.js` (hints + a loose regex) for instant UX, but the backend is the enforcing gate. The Apify actor/input is corrected in both places that call it.

**Tech Stack:** Python 3 / Flask / SQLAlchemy (backend), pytest (new, backend unit tests), React + Vite + Tailwind/shadcn (frontend), Apify (`apify/instagram-scraper`).

> **Commit policy (user override):** Per the user's instruction ("commit once done"), do NOT commit after each task. Implement and verify everything, then make the commits in the final task only. Earlier tasks end at "tests pass".

> **Spec:** `docs/superpowers/specs/2026-07-21-post-url-validation-design.md`

---

## File Structure

- **Create** `backend/url_utils.py` — platform detection + URL validation/canonicalization (pure, no Flask/DB).
- **Create** `backend/test_url_utils.py` — pytest unit tests (first backend tests in repo).
- **Create** `backend/requirements-dev.txt` — `pytest`.
- **Modify** `backend/app.py` — import + `_clean_post_url` helper; wire into 7 URL write-paths; fix Apify call in `fetch_instagram_post_metrics`.
- **Modify** `backend/social_metrics_service.py` — fix Apify call in `InstagramFetcher.fetch_metrics`.
- **Create** `frontend/src/lib/platforms.js` — single source of platform specs + helpers for the 3 post-URL forms.
- **Modify** `frontend/src/pages/NewCampaign.jsx`, `frontend/src/pages/CampaignDetail.jsx`, `frontend/src/pages/portal/InfluencerCampaign.jsx` — import platforms.js, add hint text + inline validation.

---

## Task 1: `url_utils.py` scaffold — platform name + detection + Instagram

**Files:**
- Create: `backend/url_utils.py`
- Create: `backend/test_url_utils.py`
- Create: `backend/requirements-dev.txt`

- [ ] **Step 1: Add pytest dev dependency and install**

Create `backend/requirements-dev.txt`:

```
pytest==8.3.3
```

Run: `pip install -r backend/requirements-dev.txt`
Expected: pytest installs successfully.

- [ ] **Step 2: Write the failing test**

Create `backend/test_url_utils.py`:

```python
from url_utils import normalize_platform_name, detect_platform, normalize_post_url


# ---- platform name normalization ----
def test_normalize_platform_aliases():
    assert normalize_platform_name('Instagram') == 'Instagram'
    assert normalize_platform_name('instagram') == 'Instagram'
    assert normalize_platform_name('X (Twitter)') == 'Twitter'
    assert normalize_platform_name('Twitter / X') == 'Twitter'
    assert normalize_platform_name('X') == 'Twitter'
    assert normalize_platform_name('LinkedIn') == 'LinkedIn'
    assert normalize_platform_name('nonsense') is None
    assert normalize_platform_name('') is None
    assert normalize_platform_name(None) is None


# ---- host-based platform detection (no false positives) ----
def test_detect_platform_by_host():
    assert detect_platform('https://www.instagram.com/reel/ABC/') == 'Instagram'
    assert detect_platform('https://youtu.be/dQw4w9WgXcQ') == 'YouTube'
    assert detect_platform('https://x.com/jack/status/20') == 'Twitter'
    assert detect_platform('https://www.linkedin.com/feed/update/urn:li:activity:1/') == 'LinkedIn'
    assert detect_platform('https://www.facebook.com/x/posts/123') == 'Facebook'
    # "netflix.com" contains the substring "x.com" but must NOT match Twitter
    assert detect_platform('https://www.netflix.com/title/123') is None


# ---- Instagram end-to-end ----
def test_instagram_canonicalizes_and_strips_junk():
    res = normalize_post_url(
        'https://www.instagram.com/reel/DUh4219jFCf/?igsh=MXBoODQ2OHN4ZTJ5eg==',
        'Instagram')
    assert res['ok'] is True
    assert res['canonical_url'] == 'https://www.instagram.com/reel/DUh4219jFCf/'
    assert res['platform'] == 'Instagram'
    assert res['post_id'] == 'DUh4219jFCf'
    assert res['suggested_content_type'] == 'Reel'
    assert res['error'] is None


def test_instagram_post_and_tv_types():
    assert normalize_post_url('https://instagram.com/p/ABC123/', 'Instagram')['suggested_content_type'] == 'Post'
    assert normalize_post_url('https://instagram.com/tv/XYZ789/', 'Instagram')['suggested_content_type'] == 'Video'


def test_empty_url_is_required_error():
    res = normalize_post_url('', 'Instagram')
    assert res['ok'] is False
    assert res['error'] == 'URL is required'


def test_wrong_platform_is_rejected():
    res = normalize_post_url('https://youtube.com/watch?v=dQw4w9WgXcQ', 'Instagram')
    assert res['ok'] is False
    assert 'Instagram' in res['error']
    assert 'YouTube' in res['error']


def test_unrecognized_url_rejected():
    res = normalize_post_url('not a url', 'Instagram')
    assert res['ok'] is False
    assert res['error']
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && python -m pytest test_url_utils.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'url_utils'`.

- [ ] **Step 4: Write minimal implementation**

Create `backend/url_utils.py`:

```python
"""
Pure helpers for detecting a social platform from a URL, validating a post URL
against an expected platform, and producing the canonical (cleaned) URL to store.
No Flask/DB imports — unit-testable in isolation.
"""
import re
from urllib.parse import urlparse, parse_qs

CANONICAL_PLATFORMS = ["Instagram", "YouTube", "Facebook", "Twitter", "LinkedIn"]

_PLATFORM_ALIASES = {
    "instagram": "Instagram",
    "youtube": "YouTube",
    "facebook": "Facebook",
    "twitter": "Twitter",
    "x": "Twitter",
    "x (twitter)": "Twitter",
    "twitter / x": "Twitter",
    "twitter/x": "Twitter",
    "linkedin": "LinkedIn",
}

PLATFORM_HINTS = {
    "Instagram": "Enter an Instagram post or reel link (e.g. https://www.instagram.com/reel/XXXX/).",
    "YouTube": "Enter a YouTube video or short link (e.g. https://www.youtube.com/watch?v=XXXX).",
    "Twitter": "Enter an X/Twitter post link (e.g. https://x.com/user/status/123).",
    "Facebook": "Enter a Facebook post or video link (e.g. https://www.facebook.com/page/posts/123).",
    "LinkedIn": "Enter a LinkedIn post link (e.g. https://www.linkedin.com/feed/update/urn:li:activity:123/).",
}


def normalize_platform_name(name):
    if not name:
        return None
    return _PLATFORM_ALIASES.get(str(name).strip().lower())


def _host(url):
    parsed = urlparse(url if "://" in url else "https://" + url)
    return (parsed.netloc or "").lower().split(":")[0]


def detect_platform(url):
    if not url:
        return None
    host = _host(url)
    if host == "instagram.com" or host.endswith(".instagram.com"):
        return "Instagram"
    if host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com"):
        return "YouTube"
    if host == "x.com" or host.endswith(".x.com") or host == "twitter.com" or host.endswith(".twitter.com"):
        return "Twitter"
    if host == "fb.watch" or host == "facebook.com" or host.endswith(".facebook.com"):
        return "Facebook"
    if host == "linkedin.com" or host.endswith(".linkedin.com"):
        return "LinkedIn"
    return None


def _instagram(url):
    m = re.search(r"instagram\.com/(p|reel|tv)/([A-Za-z0-9_-]+)", url, re.I)
    if not m:
        return None
    kind = m.group(1).lower()
    shortcode = m.group(2)
    ctype = {"p": "Post", "reel": "Reel", "tv": "Video"}[kind]
    return f"https://www.instagram.com/{kind}/{shortcode}/", shortcode, ctype


# platform -> extractor. Returns (canonical_url, post_id, suggested_content_type) or None.
_EXTRACTORS = {
    "Instagram": _instagram,
}


def normalize_post_url(raw_url, expected_platform=None):
    result = {
        "ok": False, "canonical_url": None, "platform": None,
        "post_id": None, "suggested_content_type": None, "error": None,
    }
    expected = normalize_platform_name(expected_platform) if expected_platform else None

    if not raw_url or not str(raw_url).strip():
        result["error"] = "URL is required"
        return result
    url = str(raw_url).strip()

    detected = detect_platform(url)
    if not detected:
        target = expected or "social media"
        result["error"] = f"Enter a valid {target} post URL"
        return result

    if expected and detected != expected:
        result["error"] = (
            f"This looks like a {detected} URL, but this post is on "
            f"{expected}. Paste a {expected} link."
        )
        return result

    extractor = _EXTRACTORS.get(detected)
    extracted = extractor(url) if extractor else None
    if not extracted:
        result["error"] = PLATFORM_HINTS.get(detected, f"Enter a valid {detected} post URL")
        return result

    canonical, post_id, ctype = extracted
    result.update({
        "ok": True, "canonical_url": canonical, "platform": detected,
        "post_id": post_id, "suggested_content_type": ctype, "error": None,
    })
    return result
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest test_url_utils.py -v`
Expected: PASS (all tests in this file green).

---

## Task 2: YouTube extractor

**Files:**
- Modify: `backend/url_utils.py`
- Test: `backend/test_url_utils.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/test_url_utils.py`:

```python
def test_youtube_watch_and_youtu_be():
    for u in ('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
              'https://youtu.be/dQw4w9WgXcQ?si=abc',
              'https://www.youtube.com/embed/dQw4w9WgXcQ'):
        res = normalize_post_url(u, 'YouTube')
        assert res['ok'] is True, u
        assert res['canonical_url'] == 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', u
        assert res['post_id'] == 'dQw4w9WgXcQ'
        assert res['suggested_content_type'] == 'Video'


def test_youtube_shorts():
    res = normalize_post_url('https://www.youtube.com/shorts/abc12345678?feature=x', 'YouTube')
    assert res['ok'] is True
    assert res['canonical_url'] == 'https://www.youtube.com/shorts/abc12345678'
    assert res['suggested_content_type'] == 'Short'


def test_youtube_invalid():
    res = normalize_post_url('https://www.youtube.com/@somechannel', 'YouTube')
    assert res['ok'] is False
    assert res['error']
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python -m pytest test_url_utils.py -k youtube -v`
Expected: FAIL — canonical is None / error set (no YouTube extractor yet).

- [ ] **Step 3: Implement**

In `backend/url_utils.py`, add the function above `_EXTRACTORS`:

```python
def _youtube(url):
    m = re.search(r"/shorts/([A-Za-z0-9_-]{11})", url)
    if m:
        vid = m.group(1)
        return f"https://www.youtube.com/shorts/{vid}", vid, "Short"
    m = re.search(r"/embed/([A-Za-z0-9_-]{11})", url)
    if m:
        vid = m.group(1)
        return f"https://www.youtube.com/watch?v={vid}", vid, "Video"
    if _host(url) == "youtu.be":
        m = re.search(r"youtu\.be/([A-Za-z0-9_-]{11})", url)
        if m:
            vid = m.group(1)
            return f"https://www.youtube.com/watch?v={vid}", vid, "Video"
    parsed = urlparse(url if "://" in url else "https://" + url)
    v = parse_qs(parsed.query).get("v", [None])[0]
    if v and re.fullmatch(r"[A-Za-z0-9_-]{11}", v):
        return f"https://www.youtube.com/watch?v={v}", v, "Video"
    return None
```

Then update the `_EXTRACTORS` dict:

```python
_EXTRACTORS = {
    "Instagram": _instagram,
    "YouTube": _youtube,
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && python -m pytest test_url_utils.py -v`
Expected: PASS (all).

---

## Task 3: Twitter/X extractor

**Files:**
- Modify: `backend/url_utils.py`
- Test: `backend/test_url_utils.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/test_url_utils.py`:

```python
def test_twitter_normalizes_host_and_keeps_id():
    res = normalize_post_url('https://twitter.com/jack/status/20?s=20', 'X (Twitter)')
    assert res['ok'] is True
    assert res['canonical_url'] == 'https://x.com/jack/status/20'
    assert res['post_id'] == '20'
    assert res['suggested_content_type'] == 'Tweet'


def test_twitter_i_web_status():
    res = normalize_post_url('https://x.com/i/web/status/12345', 'Twitter')
    assert res['ok'] is True
    assert res['canonical_url'] == 'https://x.com/i/status/12345'
    assert res['post_id'] == '12345'


def test_twitter_invalid():
    res = normalize_post_url('https://x.com/jack', 'Twitter')
    assert res['ok'] is False
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python -m pytest test_url_utils.py -k twitter -v`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `backend/url_utils.py` above `_EXTRACTORS`:

```python
def _twitter(url):
    m = re.search(
        r"(?:twitter\.com|x\.com)/(?:i/(?:web/)?)?(?:([A-Za-z0-9_]{1,15})/)?status(?:es)?/(\d+)",
        url, re.I)
    if not m:
        return None
    user = m.group(1)
    if not user or user.lower() in ("i", "web", "status", "statuses"):
        user = "i"
    tweet_id = m.group(2)
    return f"https://x.com/{user}/status/{tweet_id}", tweet_id, "Tweet"
```

Update `_EXTRACTORS`:

```python
_EXTRACTORS = {
    "Instagram": _instagram,
    "YouTube": _youtube,
    "Twitter": _twitter,
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && python -m pytest test_url_utils.py -v`
Expected: PASS (all).

---

## Task 4: LinkedIn extractor

**Files:**
- Modify: `backend/url_utils.py`
- Test: `backend/test_url_utils.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/test_url_utils.py`:

```python
def test_linkedin_activity_urn():
    res = normalize_post_url(
        'https://www.linkedin.com/feed/update/urn:li:activity:7212345678901234567/', 'LinkedIn')
    assert res['ok'] is True
    assert res['canonical_url'] == 'https://www.linkedin.com/feed/update/urn:li:activity:7212345678901234567/'
    assert res['post_id'] == '7212345678901234567'
    assert res['suggested_content_type'] == 'Post'


def test_linkedin_posts_slug():
    res = normalize_post_url(
        'https://www.linkedin.com/posts/some-user_slug-7212345678901234567-abcd/', 'LinkedIn')
    assert res['ok'] is True
    assert res['post_id'] == '7212345678901234567'


def test_linkedin_invalid():
    res = normalize_post_url('https://www.linkedin.com/in/some-person/', 'LinkedIn')
    assert res['ok'] is False
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python -m pytest test_url_utils.py -k linkedin -v`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `backend/url_utils.py` above `_EXTRACTORS`:

```python
def _linkedin(url):
    m = re.search(r"urn:li:activity:(\d+)", url, re.I)
    if not m:
        m = re.search(r"urn:li:share:(\d+)", url, re.I)
    if not m:
        m = re.search(r"linkedin\.com/posts/[^?#]*?-(\d{10,})", url, re.I)
    if not m:
        return None
    activity_id = m.group(1)
    canonical = f"https://www.linkedin.com/feed/update/urn:li:activity:{activity_id}/"
    return canonical, activity_id, "Post"
```

Update `_EXTRACTORS`:

```python
_EXTRACTORS = {
    "Instagram": _instagram,
    "YouTube": _youtube,
    "Twitter": _twitter,
    "LinkedIn": _linkedin,
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && python -m pytest test_url_utils.py -v`
Expected: PASS (all).

---

## Task 5: Facebook (lenient) extractor

**Files:**
- Modify: `backend/url_utils.py`
- Test: `backend/test_url_utils.py`

- [ ] **Step 1: Add failing tests**

Append to `backend/test_url_utils.py`:

```python
def test_facebook_strips_query_keeps_v():
    res = normalize_post_url(
        'https://www.facebook.com/watch/?v=1234567890&mibextid=abc', 'Facebook')
    assert res['ok'] is True
    assert res['canonical_url'] == 'https://www.facebook.com/watch/?v=1234567890'
    assert res['suggested_content_type'] == 'Video'


def test_facebook_posts_strips_fragment_and_query():
    res = normalize_post_url(
        'https://www.facebook.com/SomePage/posts/999#comment', 'Facebook')
    assert res['ok'] is True
    assert res['canonical_url'] == 'https://www.facebook.com/SomePage/posts/999'
    assert res['suggested_content_type'] == 'Post'


def test_facebook_fb_watch_accepted():
    res = normalize_post_url('https://fb.watch/abcDEF123/', 'Facebook')
    assert res['ok'] is True


def test_facebook_non_facebook_rejected():
    res = normalize_post_url('https://example.com/foo', 'Facebook')
    assert res['ok'] is False
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && python -m pytest test_url_utils.py -k facebook -v`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `backend/url_utils.py` above `_EXTRACTORS`:

```python
def _facebook(url):
    host = _host(url)
    if host != "fb.watch" and not (host == "facebook.com" or host.endswith(".facebook.com")):
        return None

    ctype = "Post"
    if re.search(r"/reel/", url, re.I):
        ctype = "Reel"
    elif re.search(r"/videos?/|/watch", url, re.I) or host == "fb.watch":
        ctype = "Video"

    parsed = urlparse(url if "://" in url else "https://" + url)
    netloc = parsed.netloc.lower()
    path = parsed.path
    v = parse_qs(parsed.query).get("v", [None])[0]
    canonical = f"https://{netloc}{path}"
    if v:
        canonical += f"?v={v}"
    return canonical, v, ctype
```

Update `_EXTRACTORS`:

```python
_EXTRACTORS = {
    "Instagram": _instagram,
    "YouTube": _youtube,
    "Twitter": _twitter,
    "LinkedIn": _linkedin,
    "Facebook": _facebook,
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && python -m pytest test_url_utils.py -v`
Expected: PASS (entire file green).

---

## Task 6: Fix the production Apify Instagram call

**Files:**
- Modify: `backend/app.py` (`fetch_instagram_post_metrics`, ~lines 2779-2789)
- Modify: `backend/social_metrics_service.py` (`InstagramFetcher.fetch_metrics`, ~lines 291-298)

- [ ] **Step 1: Fix `app.py`**

In `backend/app.py`, find inside `fetch_instagram_post_metrics`:

```python
        client = ApifyClient(apify_token)

        # Run Apify's Instagram Post Scraper actor
        run_input = {
            "posts": [url],
            "detailLevel": "detailedData",
        }

        run = client.actor("apify/instagram-post-scraper").call(run_input=run_input)
```

Replace with:

```python
        client = ApifyClient(apify_token)

        # Fetch ONE post by URL. apify/instagram-post-scraper needs a profile `username`;
        # apify/instagram-scraper accepts direct post URLs.
        run_input = {
            "directUrls": [url],
            "resultsType": "posts",
            "resultsLimit": 1,
            "addParentData": False,
        }

        run = client.actor("apify/instagram-scraper").call(run_input=run_input)
```

- [ ] **Step 2: Fix `social_metrics_service.py`**

In `backend/social_metrics_service.py`, inside `InstagramFetcher.fetch_metrics`, find:

```python
            run_input = {
                "posts": [url],
                "detailLevel": "detailedData",
            }

            logger.info(f"Running Apify Instagram scraper for: {url}")
            run = client.actor("apify/instagram-post-scraper").call(run_input=run_input)
```

Replace with:

```python
            run_input = {
                "directUrls": [url],
                "resultsType": "posts",
                "resultsLimit": 1,
                "addParentData": False,
            }

            logger.info(f"Running Apify Instagram scraper for: {url}")
            run = client.actor("apify/instagram-scraper").call(run_input=run_input)
```

- [ ] **Step 3: Verify with the standalone tester (uses Apify credits — 1 run)**

Run: `cd backend && python test_apify_instagram.py "https://www.instagram.com/reel/DUh4219jFCf/"`
Expected: `[SUCCESS]` block with non-zero `likes`/`views`. (The tester already uses the corrected actor; this confirms parity with the production code path.)

> If the user prefers not to spend credits here, skip Step 3 — the tester already proved the actor/input on 2026-07-21; this is only a parity re-check.

---

## Task 7: Backend — `_clean_post_url` helper + wire into all URL write-paths

**Files:**
- Modify: `backend/app.py`

- [ ] **Step 1: Add the import and helper**

Near the top of `backend/app.py`, after the existing imports (e.g. after `from dotenv import load_dotenv`), add:

```python
from url_utils import normalize_post_url
```

Then, in the `# ==================== HELPER FUNCTIONS ====================` section (near `generate_random_password`), add:

```python
def _clean_post_url(raw_url, expected_platform, field='url', required=True):
    """Validate a pasted post URL against the expected platform.
    Returns (canonical_url, suggested_content_type, error_response).
    error_response is a (jsonify(...), 400) tuple when invalid, else None.
    When the field is optional and blank, returns (None, None, None)."""
    if raw_url is None or not str(raw_url).strip():
        if required:
            return None, None, (jsonify({'error': 'URL is required', 'field': field}), 400)
        return None, None, None
    res = normalize_post_url(raw_url, expected_platform)
    if not res['ok']:
        return None, None, (jsonify({'error': res['error'], 'field': field}), 400)
    return res['canonical_url'], res['suggested_content_type'], None
```

- [ ] **Step 2: Wire `POST /api/campaigns/<id>/influencers/<aid>/content`** (`add_assignment_content`, ~line 1610)

Find:

```python
    data = request.get_json()
    if not data.get('url'):
        return jsonify({'error': 'URL is required'}), 400

    try:
        content = Content(
            campaign_id=campaign_id,
            influencer_id=ci.influencer_id,
            campaign_influencer_id=ci.id,
            platform=ci.platform,
            content_type=data.get('content_type', 'Post'),
            url=data['url'].strip(),
```

Replace with:

```python
    data = request.get_json()
    canonical, suggested_type, err = _clean_post_url(data.get('url'), ci.platform, field='url', required=True)
    if err:
        return err

    try:
        content = Content(
            campaign_id=campaign_id,
            influencer_id=ci.influencer_id,
            campaign_influencer_id=ci.id,
            platform=ci.platform,
            content_type=data.get('content_type') or suggested_type or 'Post',
            url=canonical,
```

- [ ] **Step 3: Wire `PUT /api/campaigns/<id>/content/<cid>`** (`update_content`, ~line 1648)

Find:

```python
    data = request.get_json()
    try:
        if 'url' in data:
            content.url = data['url'].strip()
        if 'content_type' in data:
            content.content_type = data['content_type']
```

Replace with:

```python
    data = request.get_json()
    try:
        if 'url' in data:
            canonical, suggested_type, err = _clean_post_url(data.get('url'), content.platform, field='url', required=True)
            if err:
                return err
            content.url = canonical
            if 'content_type' not in data and suggested_type:
                content.content_type = suggested_type
        if 'content_type' in data:
            content.content_type = data['content_type']
```

- [ ] **Step 4: Wire `POST /api/campaigns/<id>/influencers` link** (`add_campaign_influencer`, ~line 1528)

Find:

```python
    try:
        ci = CampaignInfluencer(
            campaign_id=campaign_id,
            influencer_id=data['influencer_id'],
            platform=data['platform'],
            link=data.get('link'),
```

Replace with:

```python
    canonical_link, _st, link_err = _clean_post_url(data.get('link'), data['platform'], field='link', required=False)
    if link_err:
        return link_err

    try:
        ci = CampaignInfluencer(
            campaign_id=campaign_id,
            influencer_id=data['influencer_id'],
            platform=data['platform'],
            link=canonical_link,
```

- [ ] **Step 5: Wire `PUT /api/campaigns/<id>/influencers/<aid>/link`** (`update_campaign_influencer_link`, ~line 1562)

Find:

```python
    data = request.get_json()
    try:
        if 'link' in data:
            ci.link = (data.get('link') or '').strip()
        if 'agreed_amount' in data:
```

Replace with:

```python
    data = request.get_json()
    try:
        if 'link' in data:
            canonical_link, _st, link_err = _clean_post_url(data.get('link'), ci.platform, field='link', required=False)
            if link_err:
                return link_err
            ci.link = canonical_link or ''
        if 'agreed_amount' in data:
```

- [ ] **Step 6: Wire portal `POST /api/influencer/me/assignments/<aid>/content`** (`~line 2490`)

Read the endpoint body first: `Read backend/app.py offset=2490 limit=40`. It builds a `Content(...)` from `data['url']` and `data.get('content_type')`, with the platform on the assignment record (variable holding the `CampaignInfluencer`, e.g. `assignment.platform` or `ci.platform`). Apply the same pattern as Step 2, using that endpoint's assignment-platform variable:

```python
    canonical, suggested_type, err = _clean_post_url(data.get('url'), <assignment>.platform, field='url', required=True)
    if err:
        return err
    # ... Content(..., content_type=data.get('content_type') or suggested_type or 'Post', url=canonical, ...)
```

(Replace `<assignment>` with the actual variable name used in that function for the `CampaignInfluencer`.)

- [ ] **Step 7: Wire portal `PUT /api/influencer/me/content/<cid>`** (`~line 2528`)

Read: `Read backend/app.py offset=2528 limit=30`. Apply the same pattern as Step 3, using `content.platform` as the expected platform:

```python
    if 'url' in data:
        canonical, suggested_type, err = _clean_post_url(data.get('url'), content.platform, field='url', required=True)
        if err:
            return err
        content.url = canonical
```

- [ ] **Step 8: Wire `POST /api/campaigns` (create with assignments)** (`create_campaign`, ~lines 1369-1404)

Find the assignment loop and its content-links inner loop:

```python
        if 'influencer_assignments' in data and isinstance(data['influencer_assignments'], list):
            for assignment in data['influencer_assignments']:
                if 'influencer_id' not in assignment or 'platform' not in assignment:
                    continue  # Skip invalid assignments

                # Verify influencer exists and is active
                influencer = Influencer.query.get(assignment['influencer_id'])
                if not influencer or influencer.status != 'active':
                    continue  # Skip inactive or non-existent influencers

                # Create CampaignInfluencer record with minimal data
                campaign_influencer = CampaignInfluencer(
                    campaign_id=campaign.id,
                    influencer_id=assignment['influencer_id'],
                    platform=assignment['platform'],
                    link=assignment.get('link'),
                    agreed_amount=assignment.get('agreed_amount'),
                    status='pending',
                    assigned_by_user_id=user.id,
                    assigned_at=datetime.utcnow()
                )
                db.session.add(campaign_influencer)
                db.session.flush()

                # Create content links if provided
                content_links = assignment.get('content_links', [])
                for cl in content_links:
                    if cl.get('url', '').strip():
                        content = Content(
                            campaign_id=campaign.id,
                            influencer_id=assignment['influencer_id'],
                            campaign_influencer_id=campaign_influencer.id,
                            platform=assignment['platform'],
                            content_type=cl.get('content_type', 'Post'),
                            url=cl['url'].strip(),
                            status='published',
```

Replace the `link=assignment.get('link'),` line and the content-link block so URLs are validated + canonicalized; on any invalid URL, roll back and return 400:

```python
                platform = assignment['platform']

                canonical_link, _st, link_err = _clean_post_url(assignment.get('link'), platform, field='link', required=False)
                if link_err:
                    db.session.rollback()
                    return link_err

                # Create CampaignInfluencer record with minimal data
                campaign_influencer = CampaignInfluencer(
                    campaign_id=campaign.id,
                    influencer_id=assignment['influencer_id'],
                    platform=platform,
                    link=canonical_link,
                    agreed_amount=assignment.get('agreed_amount'),
                    status='pending',
                    assigned_by_user_id=user.id,
                    assigned_at=datetime.utcnow()
                )
                db.session.add(campaign_influencer)
                db.session.flush()

                # Create content links if provided
                content_links = assignment.get('content_links', [])
                for cl in content_links:
                    if cl.get('url', '').strip():
                        canonical_url, suggested_type, cl_err = _clean_post_url(cl.get('url'), platform, field='url', required=True)
                        if cl_err:
                            db.session.rollback()
                            return cl_err
                        content = Content(
                            campaign_id=campaign.id,
                            influencer_id=assignment['influencer_id'],
                            campaign_influencer_id=campaign_influencer.id,
                            platform=platform,
                            content_type=cl.get('content_type') or suggested_type or 'Post',
                            url=canonical_url,
                            status='published',
```

- [ ] **Step 9: Manual verification against a running server**

Start the backend (`cd backend && python app.py`). In a second PowerShell:

```powershell
$body = @{ username = 'admin'; password = 'admin123' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri http://localhost:5000/api/auth/login -Method Post -Body $body -ContentType 'application/json'
$h = @{ Authorization = "Bearer $($login.token)" }

# Pick a campaign + assignment you own (or create one). Then:
# BAD url -> expect HTTP 400 with a helpful message
try {
  Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns/1/influencers/1/content" -Method Post -Headers $h `
    -Body (@{ url = 'https://example.com/foo'; content_type = 'Reel' } | ConvertTo-Json) -ContentType 'application/json'
} catch { $_.ErrorDetails.Message }   # -> {"error":"...","field":"url"}

# GOOD messy url -> expect stored canonical (no ?igsh=...)
Invoke-RestMethod -Uri "http://localhost:5000/api/campaigns/1/influencers/1/content" -Method Post -Headers $h `
  -Body (@{ url = 'https://www.instagram.com/reel/DUh4219jFCf/?igsh=abc'; content_type = 'Reel' } | ConvertTo-Json) -ContentType 'application/json'
# -> response .url == https://www.instagram.com/reel/DUh4219jFCf/
```

Expected: bad URL → 400 with `field:"url"`; good URL → 201 and `.url` is the canonical form.

---

## Task 8: Frontend — `lib/platforms.js` single source

**Files:**
- Create: `frontend/src/lib/platforms.js`

- [ ] **Step 1: Create the module**

Create `frontend/src/lib/platforms.js`:

```js
// Single source of platform metadata for the post-URL forms.
// `value` intentionally matches the strings already stored/filtered server-side
// (campaign side uses 'X (Twitter)'), so we do NOT break the influencer platform filter.

export const PLATFORMS = [
  {
    value: 'Instagram', label: 'Instagram',
    contentTypes: ['Post', 'Reel', 'Story', 'Video'],
    hint: 'Paste the link to the specific post or reel (…/p/… or …/reel/…).',
    example: 'https://www.instagram.com/reel/DUh4219jFCf/',
    urlRegex: /^https?:\/\/(www\.|m\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i,
  },
  {
    value: 'YouTube', label: 'YouTube',
    contentTypes: ['Video', 'Short'],
    hint: 'Paste a video or Short link (watch?v=…, youtu.be/…, or /shorts/…).',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    urlRegex: /^https?:\/\/((www\.)?youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{11}/i,
  },
  {
    value: 'Facebook', label: 'Facebook',
    contentTypes: ['Post', 'Reel', 'Video'],
    hint: 'Paste a Facebook post, video, or watch link.',
    example: 'https://www.facebook.com/page/posts/1234567890',
    urlRegex: /^https?:\/\/((www\.|m\.|web\.)?facebook\.com\/|fb\.watch\/)/i,
  },
  {
    value: 'X (Twitter)', label: 'X (Twitter)',
    contentTypes: ['Tweet'],
    hint: 'Paste a post link (…/status/… on x.com or twitter.com).',
    example: 'https://x.com/user/status/1234567890',
    urlRegex: /^https?:\/\/(www\.)?(twitter|x)\.com\/([A-Za-z0-9_]+\/)?(i\/(web\/)?)?status(es)?\/\d+/i,
  },
  {
    value: 'LinkedIn', label: 'LinkedIn',
    contentTypes: ['Post'],
    hint: 'Paste a LinkedIn post link (feed/update/… or /posts/…).',
    example: 'https://www.linkedin.com/feed/update/urn:li:activity:1234567890/',
    urlRegex: /^https?:\/\/(www\.)?linkedin\.com\/(feed\/update\/urn:li:(activity|share):\d+|posts\/)/i,
  },
]

export const CONTENT_TYPES = ['Post', 'Reel', 'Story', 'Video', 'Short', 'Tweet']

export function getPlatform(value) {
  return PLATFORMS.find((p) => p.value === value)
}

// Loose format sanity check for instant UX. Backend is the authoritative gate.
// Returns true when empty (emptiness handled separately by required-ness).
export function looksLikeValidPostUrl(platformValue, url) {
  if (!url || !url.trim()) return true
  const spec = getPlatform(platformValue)
  if (!spec) return true
  return spec.urlRegex.test(url.trim())
}
```

- [ ] **Step 2: Sanity check the module compiles**

Run: `cd frontend && node --input-type=module -e "import('./src/lib/platforms.js').then(m => console.log(m.looksLikeValidPostUrl('Instagram','https://www.instagram.com/reel/ABC/'), m.looksLikeValidPostUrl('Instagram','https://example.com')))"`
Expected: prints `true false`.

> If the `node` import path fails under Vite aliasing, skip this step and rely on the in-app verification in Tasks 9–11.

---

## Task 9: Frontend — NewCampaign.jsx hints + inline validation

**Files:**
- Modify: `frontend/src/pages/NewCampaign.jsx`

- [ ] **Step 1: Replace local constants with the shared module**

At the top of `frontend/src/pages/NewCampaign.jsx`, remove:

```js
const PLATFORMS = ['Instagram', 'YouTube', 'Facebook', 'X (Twitter)', 'LinkedIn']
```
and
```js
const CONTENT_TYPES = ['Post', 'Reel', 'Story', 'Video', 'Short']
```

Add an import (after the existing `import { Select, ... }` line):

```js
import { PLATFORMS as PLATFORM_SPECS, CONTENT_TYPES, getPlatform, looksLikeValidPostUrl } from '@/lib/platforms'
```

The chips render `PLATFORMS.map(...)` (line ~348). Change those two `PLATFORMS` references (chips list + `platformsForInfluencer`) to `PLATFORM_SPECS.map((p) => p.value)`:

At line ~159, change:

```js
  const platformsForInfluencer = (inf) => {
    const all = PLATFORMS.filter((p) => (followersFor(inf, p) || 0) > 0)
```

to:

```js
  const platformsForInfluencer = (inf) => {
    const all = PLATFORM_SPECS.map((p) => p.value).filter((p) => (followersFor(inf, p) || 0) > 0)
```

At line ~348, change:

```jsx
                  {PLATFORMS.map((p) => (
                    <Chip key={p} active={selectedPlatforms.includes(p)} onClick={() => togglePlatform(p)}>{p}</Chip>
                  ))}
```

to:

```jsx
                  {PLATFORM_SPECS.map((p) => (
                    <Chip key={p.value} active={selectedPlatforms.includes(p.value)} onClick={() => togglePlatform(p.value)}>{p.label}</Chip>
                  ))}
```

- [ ] **Step 2: Add hint + inline error to each content-link row**

Find the content-link row (lines ~397-412):

```jsx
                                  {links.map((cl, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                      <Select value={cl.content_type} onValueChange={(v) => updateLink(inf.id, platform, idx, 'content_type', v)}>
                                        <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                      <Input type="url" value={cl.url} placeholder="https://…" className="h-8 flex-1"
                                        onChange={(e) => updateLink(inf.id, platform, idx, 'url', e.target.value)} />
                                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => removeLink(inf.id, platform, idx)}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
```

Replace with (wrap each row so an error line can sit beneath it):

```jsx
                                  {links.map((cl, idx) => {
                                    const invalid = !looksLikeValidPostUrl(platform, cl.url)
                                    return (
                                    <div key={idx} className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <Select value={cl.content_type} onValueChange={(v) => updateLink(inf.id, platform, idx, 'content_type', v)}>
                                          <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                            {(getPlatform(platform)?.contentTypes || CONTENT_TYPES).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                        <Input type="url" value={cl.url} placeholder={getPlatform(platform)?.example || 'https://…'}
                                          className={cn('h-8 flex-1', invalid && 'border-destructive')}
                                          onChange={(e) => updateLink(inf.id, platform, idx, 'url', e.target.value)} />
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                          onClick={() => removeLink(inf.id, platform, idx)}>
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                      {invalid
                                        ? <p className="pl-1 text-xs text-destructive">{getPlatform(platform)?.hint}</p>
                                        : <p className="pl-1 text-xs text-muted-foreground">{getPlatform(platform)?.hint}</p>}
                                    </div>
                                    )
                                  })}
```

- [ ] **Step 3: Block submit while any content link is invalid**

In `validate()` (line ~164), before `return null`, add:

```js
    for (const inf of selectedInfluencers) {
      for (const cl of inf.content_links) {
        if (cl.url && cl.url.trim() && !looksLikeValidPostUrl(inf.platform, cl.url)) {
          return `One or more content links are not valid for their platform. Fix the highlighted URLs.`
        }
      }
    }
```

- [ ] **Step 4: Surface backend field errors on submit**

In `handleSubmit`'s catch (line ~196), the existing `setError(err.response?.data?.error || ...)` already shows the backend message (including our `{error, field}`), so no change needed. Confirm by reading lines 196-199.

- [ ] **Step 5: Verify in the running app**

Start both servers (`start.ps1`). Create-campaign → select an influencer+platform → Add content link. Paste a wrong-platform URL → the field turns red, hint shows, and Submit reports the error. Paste a valid messy Instagram URL → saves; open the new campaign and confirm the stored URL is canonical.

---

## Task 10: Frontend — CampaignDetail.jsx hints + inline validation

**Files:**
- Modify: `frontend/src/pages/CampaignDetail.jsx`

- [ ] **Step 1: Replace local constants with the shared module**

At the top (lines 31-32), remove:

```js
const PLATFORMS = ['Instagram', 'YouTube', 'Facebook', 'X (Twitter)', 'LinkedIn']
const CONTENT_TYPES = ['Post', 'Reel', 'Story', 'Video', 'Short']
```

Add (after the existing imports):

```js
import { PLATFORMS as PLATFORM_SPECS, CONTENT_TYPES, getPlatform, looksLikeValidPostUrl } from '@/lib/platforms'
```

At line ~713, change the add-influencer platform dropdown:

```jsx
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
```

to:

```jsx
                  {PLATFORM_SPECS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
```

- [ ] **Step 2: Pass the assignment platform into `handleAddContent`**

At line ~257 change the signature:

```js
  const handleAddContent = async (assignmentId) => {
```

to:

```js
  const handleAddContent = async (assignmentId, platform) => {
```

Read lines 257-270 and, in the `catch`, ensure the backend message surfaces (set an error state that renders near the add row, or reuse the page's existing error toast/alert if present). If the function currently swallows errors, add:

```js
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add content link')
    }
```

(Use the file's existing error-display pattern if it has one instead of `alert`.)

- [ ] **Step 3: Add hint + inline validation to the add-content row**

Find (lines ~597-604):

```jsx
                                {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input type="url" value={newContentUrl} onChange={(e) => setNewContentUrl(e.target.value)}
                              placeholder="https://…" className="flex-1 min-w-[180px]" />
                            <Button size="sm" onClick={() => handleAddContent(inf.assignment_id)} disabled={!newContentUrl.trim()}>Add</Button>
```

Replace with:

```jsx
                                {(getPlatform(inf.platform)?.contentTypes || CONTENT_TYPES).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input type="url" value={newContentUrl} onChange={(e) => setNewContentUrl(e.target.value)}
                              placeholder={getPlatform(inf.platform)?.example || 'https://…'}
                              className={cn('flex-1 min-w-[180px]', !looksLikeValidPostUrl(inf.platform, newContentUrl) && 'border-destructive')} />
                            <Button size="sm" onClick={() => handleAddContent(inf.assignment_id, inf.platform)}
                              disabled={!newContentUrl.trim() || !looksLikeValidPostUrl(inf.platform, newContentUrl)}>Add</Button>
```

Immediately after the closing `</div>` that wraps this add row, add a hint line:

```jsx
                          <p className="pl-1 text-xs text-muted-foreground">{getPlatform(inf.platform)?.hint}</p>
```

(Confirm `cn` is imported at the top of the file — it is used elsewhere in this file; if not, add `import { cn } from '@/lib/utils'`.)

- [ ] **Step 4: Add inline validation to the edit-content input**

Find (line ~617):

```jsx
                                    <Input type="url" value={editContentUrl} onChange={(e) => setEditContentUrl(e.target.value)} className="flex-1" />
```

Replace with:

```jsx
                                    <Input type="url" value={editContentUrl} onChange={(e) => setEditContentUrl(e.target.value)}
                                      className={cn('flex-1', !looksLikeValidPostUrl(content.platform || inf.platform, editContentUrl) && 'border-destructive')} />
```

Find the Save button for the edit row (read lines ~617-640 to locate it) and add to its `disabled`:

```jsx
disabled={!editContentUrl.trim() || !looksLikeValidPostUrl(content.platform || inf.platform, editContentUrl)}
```

- [ ] **Step 5: Verify in the running app**

Open a campaign → Influencers tab → add a content link on an Instagram assignment. Wrong-platform URL → red border + Add disabled + backend 400 on force. Valid messy URL → saves canonical (reload; the shown URL has no `?igsh=`).

---

## Task 11: Frontend — portal/InfluencerCampaign.jsx hints + inline validation

**Files:**
- Modify: `frontend/src/pages/portal/InfluencerCampaign.jsx`

- [ ] **Step 1: Replace local constant with the shared module**

At line 18 remove:

```js
const CONTENT_TYPES = ['Post', 'Reel', 'Story', 'Video', 'Short']
```

Add (after existing imports):

```js
import { CONTENT_TYPES, getPlatform, looksLikeValidPostUrl } from '@/lib/platforms'
```

- [ ] **Step 2: Add hint + inline validation to the add row**

Read lines ~195-210 to see the row (it maps over `a` = assignment; platform is `a.platform`). Find:

```jsx
                        <SelectContent>{CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
```

Replace with:

```jsx
                        <SelectContent>{(getPlatform(a.platform)?.contentTypes || CONTENT_TYPES).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
```

Find (line ~206):

```jsx
                      <Input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://…" className="min-w-[180px] flex-1" />
```

Replace with:

```jsx
                      <Input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
                        placeholder={getPlatform(a.platform)?.example || 'https://…'}
                        className={cn('min-w-[180px] flex-1', !looksLikeValidPostUrl(a.platform, newUrl) && 'border-destructive')} />
```

Locate the add button for this row (same flex container) and add to its `disabled`:

```jsx
disabled={!newUrl.trim() || !looksLikeValidPostUrl(a.platform, newUrl)}
```

Add a hint line beneath the add row:

```jsx
                    <p className="pl-1 text-xs text-muted-foreground">{getPlatform(a.platform)?.hint}</p>
```

(Ensure `cn` is imported: `import { cn } from '@/lib/utils'` — add if missing.)

- [ ] **Step 3: Add inline validation to the edit input (line ~221)**

Find:

```jsx
                              <Input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} className="flex-1" />
```

Replace with:

```jsx
                              <Input type="url" value={editUrl} onChange={(e) => setEditUrl(e.target.value)}
                                className={cn('flex-1', !looksLikeValidPostUrl(a.platform, editUrl) && 'border-destructive')} />
```

And add `!looksLikeValidPostUrl(a.platform, editUrl)` to the edit-save button's `disabled` (locate it near line ~221-230).

- [ ] **Step 4: Ensure backend errors surface**

Read `addContent` (line ~72) and `updateContent` (line ~80). If their `catch` blocks are empty/silent, add `alert(err.response?.data?.error || 'Failed to save content link')` (or the file's existing error pattern).

- [ ] **Step 5: Verify as an influencer**

Log in as an invited influencer, open a campaign, add a content link. Wrong-platform → red + disabled; valid messy → stored canonical.

---

## Task 12: Full verification + commit

**Files:** none (verification + git)

- [ ] **Step 1: Backend unit tests all green**

Run: `cd backend && python -m pytest test_url_utils.py -v`
Expected: PASS, 0 failures.

- [ ] **Step 2: Frontend builds**

Run: `cd frontend && npm run build`
Expected: build completes with no errors.

- [ ] **Step 3: Smoke test the three flows** (per Tasks 9-11 Step 5) against `start.ps1`. Confirm: bad URLs blocked with a helpful message; good messy URLs stored canonical; hints visible.

- [ ] **Step 4: Commit everything (single commit per user preference)**

```bash
git add docs/superpowers/specs/2026-07-21-post-url-validation-design.md \
        docs/superpowers/plans/2026-07-21-post-url-validation.md \
        backend/url_utils.py backend/test_url_utils.py backend/requirements-dev.txt \
        backend/app.py backend/social_metrics_service.py backend/test_apify_instagram.py \
        frontend/src/lib/platforms.js \
        frontend/src/pages/NewCampaign.jsx \
        frontend/src/pages/CampaignDetail.jsx \
        frontend/src/pages/portal/InfluencerCampaign.jsx
git commit -m "feat: validate + canonicalize post URLs and fix Apify Instagram fetch

- add backend/url_utils.py (platform detect + validate + canonicalize) with pytest
- gate all post-URL write paths; store canonical URLs; 400 on invalid/wrong-platform
- fix production Apify call to apify/instagram-scraper + directUrls (app.py + service)
- frontend lib/platforms.js single source; per-platform hints + inline validation
  in NewCampaign, CampaignDetail, and the influencer portal"
```

Expected: one commit on `dev-apify`.

---

## Self-Review

**Spec coverage:**
- §5 Instagram/YouTube/Twitter/Facebook/LinkedIn rules → Tasks 1-5. ✓
- §5 platform name normalization → Task 1 (`normalize_platform_name`). ✓
- §6.1 `url_utils.py` API → Tasks 1-5. ✓
- §6.2 error contract `{error, field}` → Task 7 `_clean_post_url`. ✓
- §6.3 seven wiring points → Task 7 Steps 2-8. ✓
- §6.4 Apify prod fix → Task 6. ✓
- §7.1 `lib/platforms.js` (3 forms) → Task 8. ✓
- §7.2 hints + inline validation → Tasks 9-11. ✓
- §8 edge cases (strip query/fragment, host normalize, optional blank skip) → covered by extractors (Tasks 1-5) + `required=False` paths (Task 7 Steps 4,5,8). ✓
- §9 testing (`test_url_utils.py`) → Tasks 1-5; manual endpoint + UI checks → Tasks 7,9-11,12. ✓

**Placeholder scan:** Task 7 Steps 6-7 use `<assignment>` as an explicit instruction to substitute the real variable after reading those endpoints (the exact variable name isn't visible without reading; the pattern and expected result are fully specified). No other placeholders.

**Type consistency:** `normalize_post_url` returns the same dict keys used everywhere (`ok`, `canonical_url`, `platform`, `post_id`, `suggested_content_type`, `error`). `_clean_post_url` returns `(canonical, suggested_type, err)` consistently across all wiring steps. Frontend `getPlatform`, `looksLikeValidPostUrl`, `PLATFORMS`, `CONTENT_TYPES` names match across Tasks 8-11.
