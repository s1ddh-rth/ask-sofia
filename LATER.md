# If time permits

Nothing here is started until everything in CLAUDE.md's build priority is done and deployed. These also double as the "what's next" part of the pitch.

## Caching

Remember the follower's taps in their browser, so budget, wardrobe and wear frequency persist across items. Cache Groq parses by normalised text, which is safe because it only caches extraction, not the answer. Cache the merged data (sofia.json plus patches plus overrides) with a 30-second TTL, cleared whenever Sofia saves an answer or approves a patch. On Vercel this is per instance, so the TTL covers instances that didn't handle the write. Never cache verdicts, because decide() is pure and instant and caching it is the one way her overrides could look like they didn't work.

## Guardrails

Rate-limit the ask and escalate routes per IP so nobody burns the Groq free tier during judging.

## Adaptation

A third suggestion heuristic, frequently asked unknown items becoming a proposed new item. Undo for patches from the studio history. Groq drafting suggestion wording from Sofia's past replies.

## Data freshness (verified against Meta's Instagram Platform docs)

Sofia connects once through Instagram login from her studio. Her account must be a professional (Business or Creator) account. Our own test accounts work immediately with standard access. Connecting other creators needs business verification and Meta app review.

A one-off backfill pulls the last 12 months of posts when she connects, since Meta keeps post metrics for up to two years. A nightly job then pulls anything new and refreshes the last two days, because insights can lag by up to 48 hours.

Per post we take the caption, date, media type, permalink, thumbnail, and whether a Reel's audio is music or original sound. Per-post insights are views, reach, saves, shares, likes, comments, total interactions, Reel average watch time and skip rate, and profile activity including bio link clicks. Story insights expire after 24 hours unless captured by webhook, and posts inside carousels have no insights of their own. Purchases and clicks per link come from her affiliate platform, not Meta.

## Capturing Sofia's instinct automatically

Her judgement lives in words, not pictures. Sources are captions (always available), speech in Reels with original sound, on-screen text in video frames, her DM conversations, and voice notes she forwards to the studio. Instagram does not return the video file for posts using copyrighted or licensed music, including Instagram's own audio library, so speech-to-text only runs on original-sound Reels. Images and thumbnails are used only to identify which product is shown, never to infer her opinion.

After each ingest, speech-to-text transcribes eligible Reels, text is read from a few frames, and an extraction model proposes a draft with the item, her stance (love, like, meh, never again), conditions, caveats, and her exact words with a link or timestamp. Quotes must be verbatim with a source pointer. Every draft waits in the studio for Sofia to confirm. Rejected drafts become eval cases, and her confirm rate is the quality metric.

For now, her instinct is the quote from the case file shown under each product as "Sofia's take".

## Replying through Instagram DMs

Meta requires messaging apps to offer an escalation path to a real person, which Ask Sofia already is. Automated answers can only be sent as DMs within 24 hours of the follower's last message. Sofia's own answers from the studio can use Meta's human agent tag, which allows up to seven days. After that, the reply link remains the fallback.

## Not yet verified

Whether creator product tags are readable through the API, and TikTok's equivalent APIs. Check both before building on them.

## Beyond today

The full 36-item wardrobe. TikTok alongside Instagram.
