"""
Standalone Apify Instagram fetch test.
=====================================
Verifies ONLY that APIFY_API_TOKEN can scrape an Instagram post's metrics.
No database, no scheduler, no campaign records involved.

Usage (from the backend/ folder):
    python test_apify_instagram.py                        # uses a default public post
    python test_apify_instagram.py "https://www.instagram.com/p/XXXXXXXXXXX/"
"""

import os
import re
import sys
import json
from dotenv import load_dotenv

load_dotenv()  # reads backend/.env


def extract_shortcode(url):
    for pattern in (
        r'instagram\.com/p/([a-zA-Z0-9_-]+)',
        r'instagram\.com/reel/([a-zA-Z0-9_-]+)',
        r'instagram\.com/tv/([a-zA-Z0-9_-]+)',
    ):
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else "https://www.instagram.com/p/C5Qc8YtLZ1a/"

    token = os.getenv('APIFY_API_TOKEN')
    if not token:
        print("[FAIL] APIFY_API_TOKEN is not set in backend/.env")
        sys.exit(1)
    print(f"[OK]   Token loaded (starts with {token[:8]}..., length {len(token)})")

    shortcode = extract_shortcode(url)
    if not shortcode:
        print(f"[FAIL] URL doesn't look like an Instagram post/reel/tv link: {url}")
        sys.exit(1)
    print(f"[OK]   URL parsed. shortcode={shortcode}")
    print(f"[..]   Calling Apify actor 'apify/instagram-post-scraper' for: {url}")
    print("       (this can take 20-60s while the actor spins up)\n")

    try:
        from apify_client import ApifyClient
    except ImportError:
        print("[FAIL] apify-client not installed. Run: pip install apify-client")
        sys.exit(1)

    client = ApifyClient(token)
    # Correct actor + schema for fetching ONE post by its URL.
    # (apify/instagram-post-scraper requires a profile `username`, not post URLs.)
    run_input = {
        "directUrls": [url],
        "resultsType": "posts",
        "resultsLimit": 1,
        "addParentData": False,
    }

    try:
        run = client.actor("apify/instagram-scraper").call(run_input=run_input)
    except Exception as e:
        print(f"[FAIL] Apify call raised an exception: {e}")
        print("       Common causes: invalid/expired token, no Apify credits, or network block.")
        sys.exit(1)

    print(f"[OK]   Actor run finished. status={run.get('status')}, "
          f"datasetId={run.get('defaultDatasetId')}")

    items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
    if not items:
        print("[FAIL] Actor returned 0 items. The post may be private, deleted, or the URL is wrong.")
        sys.exit(1)

    post = items[0]
    metrics = {
        'likes': post.get('likesCount', 0) or 0,
        'comments': post.get('commentsCount', 0) or 0,
        'views': post.get('videoPlayCount', 0) or post.get('videoViewCount', 0) or 0,
        'type': post.get('type', ''),
        'ownerUsername': post.get('ownerUsername', ''),
        'caption': (post.get('caption', '') or '')[:80],
    }

    print("\n[SUCCESS] Apify returned data. Parsed metrics:")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))
    print("\n--- Raw keys available from Apify (for reference) ---")
    print(", ".join(sorted(post.keys())))


if __name__ == '__main__':
    main()
