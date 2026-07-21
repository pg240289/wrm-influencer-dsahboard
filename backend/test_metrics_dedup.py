"""Regression test for the daily metrics job double-fetch bug.

Previously, Step 3 of run_fetch_job re-fetched every Content that Step 2 had
already handled (because `processed_content_ids` was created empty and never
populated), doubling Apify/API calls per run. This test drives run_fetch_job
with the DB layer and network fetch mocked, and asserts each URL is fetched once.
"""
import types
from unittest import mock

import social_metrics_service as svc


def _fake_ci():
    return types.SimpleNamespace(
        id=10, campaign_id=1, influencer_id=5,
        platform='Instagram', link='https://www.instagram.com/p/ABC123/')


def _fake_content():
    return types.SimpleNamespace(
        id=100, campaign_id=1, influencer_id=5,
        platform='Instagram', url='https://www.instagram.com/p/ABC123/',
        views=0, likes=0, comments=0, shares=0, saves=0,
        engagement_rate=0.0, last_metrics_update=None)


def test_content_is_not_fetched_twice(monkeypatch):
    service = svc.SocialMetricsService()
    ci = _fake_ci()
    content = _fake_content()
    calls = []

    def fake_fetch(url, platform):
        calls.append(url)
        return {'views': 500, 'likes': 50, 'comments': 5, 'shares': 0, 'saves': 0}

    # An app context is needed to read the SQLAlchemy `query` descriptor before
    # monkeypatch swaps it for a Mock.
    with svc.app.app_context():
        # One active campaign; Step 2 sees the CI record, Step 3 sees the same content.
        monkeypatch.setattr(service, '_get_active_campaign_ids', lambda: [1])
        monkeypatch.setattr(service, 'find_or_create_content', lambda rec: content)

        ci_query = mock.Mock()
        ci_query.filter.return_value.all.return_value = [ci]
        monkeypatch.setattr(svc.CampaignInfluencer, 'query', ci_query)

        content_query = mock.Mock()
        content_query.filter.return_value.all.return_value = [content]
        monkeypatch.setattr(svc.Content, 'query', content_query)

        # Count fetches per URL; always return valid metrics.
        monkeypatch.setattr(service, 'fetch_metrics_for_url', fake_fetch)

        # Neutralize DB writes and the log model so nothing touches a real database.
        monkeypatch.setattr(svc.db, 'session', mock.Mock())
        monkeypatch.setattr(svc, 'MetricsFetchLog', mock.Mock())

        service.run_fetch_job()

    assert calls == ['https://www.instagram.com/p/ABC123/'], \
        f'expected the URL to be fetched exactly once, got {calls}'
