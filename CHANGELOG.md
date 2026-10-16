# Changelog

Versions follow [semantic versioning](https://semver.org): the major number
moves when the way you use the app changes, the minor number when something is
added. Dates are the dates of the work, not of the tag - versions up to 2.6.0
were applied retroactively on 2026-10-16, when the project was first tagged
properly.

## 3.1.0 - 2026-10-16

**Changed**
- Switching between Arabic and English keeps your place. A surah reopens in the
  other language's edition at the same verse instead of dropping back to the
  selection grid, and an open Juz stays open.

## 3.0.0 - 2026-10-16

The release that made English a first-class reading experience, and the first
one published as open source.

**Added**
- **English as text.** The translation (ClearQuran, Allah Edition, by Talal
  Itani) now reads through the same view as the Arabic: font size, verse deep
  links, bookmarks, copy and offline caching. It replaces the PDF as what
  "Readable" opens; the PDF edition is still one tap away.
- **Verse-by-verse recitation** with the verse highlighted as it is recited, a
  per-verse repeat count and a one-button A-B loop, for memorisation. Offered
  for the editions whose verse numbering matches the per-ayah audio: Hafs,
  Shouba and the English translation.
- **Verse bookmarks and copy.** Tap any verse while reading. Copying carries the
  verse, its reference and a link back to it.
- **Khatma progress** across the 30 ajzaa, with the next unread one a tap away.
- **Sleep timer** - 10, 20, 30 or 60 minutes, or at the end of the current surah.
- **Lock-screen controls** with surah, reciter and artwork, a live scrub
  position, and next and previous surah from the phone's own controls.
- **114 static, crawlable surah pages** plus an index, each self-contained and
  carrying both the Arabic and the English.

**Changed**
- English search runs against a shipped index instead of calling a third-party
  API, so both languages now work offline and nothing leaves the device.
- CSS and JS filenames carry a content hash instead of a `?v=` query, because a
  Cloudflare Pages deploy is not atomic and a query cannot be trusted to
  invalidate anything.
- The 404 page no longer depends on the app's stylesheet.
- Interface numbers render in Arabic-Indic digits when the interface is Arabic.

**Fixed**
- A recitation no longer outlives the text it belongs to when you move to
  another surah.
- Chained verse highlights no longer ate the whitespace around verse markers.
- Reading the English translation no longer left the Arabic rewayah picker
  pointing at it.

## 2.6.0 - 2026-10-03

Deploys copy an allow-list into `dist/`, so internal files never reach the site,
and unknown paths get a real 404 instead of the app answering 200 for everything.

## 2.5.0 - 2026-09-23

The next surah plays automatically when one finishes, keeping the reciter and
speed, and the selection follows along.

## 2.4.0 - 2026-08-30

Nine KFGQPC fonts (2.2MB) replaced by one Scheherazade New WOFF2 (123KB). Three
Quranic marks were tagged as base glyphs in those fonts, so shapers laid them
out inline instead of stacking them, visibly pushing words apart.

## 2.3.0 - 2026-08-25

Moved to hasana.ca on Cloudflare Pages, with the oversized PDFs served from R2
and cache policy set per path.

## 2.2.0 - 2026-08-25

Full-text search inside the verses themselves, across all eight rewayat,
diacritic-insensitive, with per-result verse jumps and shareable links.

## 2.1.0 - 2026-08-24

Offline support and session continuity: a service worker, and a full restore of
the view, PDF page, audio position and scroll offset, with back and forward
working and preferences syncing across tabs.

## 2.0.0 - 2026-08-23

A rebuild. New mushaf-inspired interface with light and dark themes, twelve
reciters, playback speed, loop, surah search, font scaling and resume reading,
plus the first SEO and accessibility passes, persisted preferences and a PWA
manifest.

## 1.1.0 - 2025-05-24

The 30-juz continuous reading view.

## 1.0.0 - 2025-04-30

First release: pick a reciter and a surah, listen, and read the text in eight
Arabic rewayat or in English.
