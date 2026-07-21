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


# platform -> extractor. Returns (canonical_url, post_id, suggested_content_type) or None.
_EXTRACTORS = {
    "Instagram": _instagram,
    "YouTube": _youtube,
    "Twitter": _twitter,
    "LinkedIn": _linkedin,
    "Facebook": _facebook,
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
