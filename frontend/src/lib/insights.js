// Offline, zero-token "AI" insights engine.
// Pure functions that derive genuine, data-driven insights from real records.
// Structured so the output can later be handed to a local LLM (e.g. Ollama)
// for natural-language narration without changing callers.

const fmt = (n) => {
  if (!n) return '0'
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const end = new Date(dateStr).getTime()
  const now = new Date().setHours(0, 0, 0, 0)
  return Math.round((end - now) / 86400000)
}

/**
 * Derive up to `limit` insights from the campaign portfolio.
 * Each insight: { id, tone: 'positive'|'warning'|'opportunity'|'neutral', title, detail }.
 */
export function generateDashboardInsights(campaigns = [], limit = 4) {
  const insights = []
  if (!campaigns.length) {
    return [{ id: 'empty', tone: 'neutral', title: 'No data yet', detail: 'Create campaigns to start seeing performance insights here.' }]
  }

  const totals = campaigns.reduce(
    (a, c) => ({
      views: a.views + (c.total_views || 0),
      likes: a.likes + (c.total_likes || 0),
      comments: a.comments + (c.total_comments || 0),
      content: a.content + (c.total_content || 0),
    }),
    { views: 0, likes: 0, comments: 0, content: 0 }
  )
  const er = totals.views > 0 ? ((totals.likes + totals.comments) / totals.views) * 100 : 0

  // 1) Top campaign by reach
  const top = [...campaigns].sort((a, b) => (b.total_views || 0) - (a.total_views || 0))[0]
  if (top && top.total_views > 0) {
    const topEr = top.total_views > 0 ? (((top.total_likes || 0) + (top.total_comments || 0)) / top.total_views) * 100 : 0
    insights.push({
      id: 'top-campaign',
      tone: 'positive',
      title: `${top.campaign_name} is your top campaign`,
      detail: `${fmt(top.total_views)} views at ${topEr.toFixed(1)}% engagement — your best-performing campaign by reach.`,
    })
  }

  // 2) Portfolio engagement benchmark (industry norm ~1–3%)
  if (totals.views > 0) {
    if (er >= 3) {
      insights.push({ id: 'er-high', tone: 'positive', title: 'Engagement is above benchmark', detail: `Portfolio engagement is ${er.toFixed(1)}% — above the typical 1–3% range. Keep doubling down on what works.` })
    } else if (er > 0) {
      insights.push({ id: 'er-low', tone: 'opportunity', title: 'Engagement has room to grow', detail: `Portfolio engagement is ${er.toFixed(1)}%. Short-form formats (Reels/Shorts) tend to lift this — consider weighting toward them.` })
    }
  }

  // 3) Campaigns with influencers but no published content
  const awaiting = campaigns.filter((c) => (c.num_influencers || 0) > 0 && (c.total_content || 0) === 0)
  if (awaiting.length) {
    insights.push({
      id: 'awaiting',
      tone: 'warning',
      title: `${awaiting.length} campaign${awaiting.length > 1 ? 's' : ''} awaiting content`,
      detail: `Influencers are assigned but nothing has been published yet${awaiting.length === 1 ? ` on "${awaiting[0].campaign_name}"` : ''}. Nudge creators to start delivering.`,
    })
  }

  // 4) Active campaigns ending soon
  const endingSoon = campaigns.filter((c) => {
    const d = daysUntil(c.end_date)
    return c.status === 'active' && d !== null && d >= 0 && d <= 7
  })
  if (endingSoon.length) {
    insights.push({
      id: 'ending-soon',
      tone: 'warning',
      title: `${endingSoon.length} campaign${endingSoon.length > 1 ? 's' : ''} ending within a week`,
      detail: `Review remaining deliverables and final metrics before ${endingSoon.length === 1 ? `"${endingSoon[0].campaign_name}" closes` : 'they close'}.`,
    })
  }

  // 5) Fallback / momentum note
  if (insights.length < limit) {
    const active = campaigns.filter((c) => c.status === 'active').length
    insights.push({
      id: 'momentum',
      tone: 'neutral',
      title: `${active} active campaign${active !== 1 ? 's' : ''} in flight`,
      detail: `${fmt(totals.content)} content pieces published across your portfolio, reaching ${fmt(totals.views)} views to date.`,
    })
  }

  return insights.slice(0, limit)
}
