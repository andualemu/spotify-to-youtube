# Design Doc: Spotify-to-YouTube Playlist Sync API

---

## Overview

A backend REST API that accepts a Spotify playlist and recreates it on YouTube by searching for matching videos for each track.

---

## Goals

- Authenticate users with both Spotify and YouTube (Google) OAuth
- Fetch tracks from a given Spotify playlist
- Search YouTube for each track and select the best match
- Create a new YouTube playlist and populate it with matched videos
- Return a report of matched, partial, and unmatched tracks

## Non-Goals

- Real-time sync (changes in Spotify do not auto-propagate)
- Music playback or downloading
- Reverse direction (YouTube → Spotify)
- Matching music videos vs. lyric videos (best-effort only)

---

## API Design

### Endpoints

```
POST   /auth/spotify/callback       # OAuth callback for Spotify
POST   /auth/google/callback        # OAuth callback for Google/YouTube
GET    /playlists                   # List user's Spotify playlists
POST   /sync                        # Trigger a playlist copy job
GET    /jobs/:id                    # Poll job status and results
```

### `POST /sync` Request

```json
{
  "spotify_playlist_id": "37i9dQZF1DXcBWIGoYBM5M",
  "youtube_playlist_name": "My Copied Playlist",   // optional, defaults to Spotify name
  "visibility": "private" | "public" | "unlisted"
}
```

### `GET /jobs/:id` Response

```json
{
  "job_id": "abc123",
  "status": "completed",
  "youtube_playlist_id": "PLxxxxxx",
  "summary": {
    "total": 42,
    "matched": 38,
    "unmatched": 4
  },
  "tracks": [
    {
      "spotify_track": "Bohemian Rhapsody - Queen",
      "status": "matched",
      "youtube_video_id": "fJ9rUzIMcZQ"
    },
    {
      "spotify_track": "Some Obscure Track",
      "status": "unmatched",
      "youtube_video_id": null
    }
  ]
}
```

---

## Architecture

```
Client
  │
  ▼
API Server (Node/Python/Go)
  ├── Auth Service       → manages OAuth tokens for Spotify + Google
  ├── Playlist Service   → fetches Spotify playlist tracks
  ├── Search Service     → queries YouTube Data API v3
  ├── Job Queue          → async processing (e.g. BullMQ / Celery)
  └── YouTube Service    → creates playlist and adds videos
```

### Why async (job queue)?

A playlist can have 100+ tracks. Each requires a YouTube search API call. Processing synchronously would time out HTTP connections. Jobs run in the background; the client polls `/jobs/:id`.

---

## Track Matching Strategy

For each Spotify track:

1. Build a search query: `"{track name} {artist}" official audio`
2. Call YouTube Data API `search.list`
3. Score candidates by:
   - Title similarity to `{track} - {artist}` (fuzzy match)
   - Channel is verified artist or VEVO (boost)
   - Video duration within ±20% of Spotify track duration
4. Pick highest-scoring result above a confidence threshold
5. If no result clears the threshold → mark as `unmatched`

---

## Authentication Flow

```
1. User initiates → redirect to Spotify OAuth (scopes: playlist-read-private)
2. User initiates → redirect to Google OAuth (scopes: youtube.force-ssl)
3. Tokens stored server-side, keyed by user session
4. Tokens refreshed automatically before expiry
```

Never return raw OAuth tokens to the client.

---

## Data Storage

| Entity | Storage |
|---|---|
| User sessions & tokens | Redis (TTL-based) |
| Job state & results | PostgreSQL |
| Caches (YT search results) | Redis (24h TTL) |

Caching YouTube search results avoids redundant API calls when multiple users sync the same popular track.

---

## Rate Limits & Quotas

| API | Limit | Mitigation |
|---|---|---|
| YouTube Data API | 10,000 units/day (search = 100 units) | Cache results; batch jobs; alert at 80% usage |
| Spotify API | No hard limit, soft rate limiting | Exponential backoff on 429s |

**A single 100-track sync costs ~100 YouTube quota units.** At the free tier, this allows ~100 syncs/day before hitting the quota ceiling.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Spotify token expired | Auto-refresh; retry once |
| YouTube quota exhausted | Fail job with `quota_exceeded`; notify user |
| Track not found on YouTube | Mark `unmatched`; continue with rest |
| YouTube playlist creation fails | Fail job; no partial playlist left behind |

---

## Tech Stack (Recommended)

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js (TypeScript) | Strong SDK support for both APIs |
| Framework | Fastify | Fast, schema-first |
| Queue | BullMQ + Redis | Simple, battle-tested |
| Database | PostgreSQL | Reliable job persistence |
| Auth | Passport.js | OAuth2 strategies for Spotify + Google |

---

## Open Questions

1. **Duplicate handling** — if a user syncs the same Spotify playlist twice, should we update the existing YouTube playlist or create a new one?
2. **Quota sharing** — if this is multi-tenant, do users share a single YouTube API quota or bring their own API keys?
3. **Music video preference** — should users be able to specify "official audio only" vs. "music video preferred"?
4. **Unmatched track UX** — should users get a way to manually pick a YouTube video for unmatched tracks?
