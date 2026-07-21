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


# ---- YouTube ----
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


# ---- Twitter / X ----
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


# ---- LinkedIn ----
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


# ---- Facebook (lenient) ----
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
