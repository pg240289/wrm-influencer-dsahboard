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
