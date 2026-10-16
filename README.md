# Holy Quran Web Player and Reader

A simple, fast, responsive, and modest single-page web application for listening to Quran recitations.

## Features

*   **Reciter Selection:** Choose from multiple available reciters (Qaris).
*   **Surah Selection:** Select any of the 114 Surahs.
*   **Audio Playback:** Listen to the selected Surah with standard audio controls (play/pause, progress, volume). When the selected Surah finishes, the next Surah autoplays with the same reciter and speed and becomes the saved selection; playback stops after Surah 114, and Loop repeats the current Surah instead.
*   **Playback Speed:** Adjust playback speed (0.75x, 1x, 1.25x, 1.5x).
*   **Lock-screen Controls:** Media Session metadata (surah, reciter, artwork) and transport controls on the phone lock screen / notification shade, including next and previous surah and a live scrub position.
*   **Sleep Timer:** Stop playback after 10, 20, 30 or 60 minutes, or at the end of the current surah. Not persisted across reloads.
*   **Verse-by-verse Recitation:** Play a surah one ayah at a time (per-ayah audio from everyayah.com) with the verse highlighted as it is recited, a per-verse repeat count, and a one-button A-B loop for memorisation. Offered for the editions that share the Hafs verse numbering those files follow (Hafs, Shouba and the English translation).
*   **Loop Toggle:** Repeat the current Surah.
*   **Download Surah Audio:** Download the currently selected Surah as an MP3.
*   **Readable Holy Quran:** View the text of the selected Surah in 8 different Rewayat (Arabic) or in English. The English translation is ClearQuran (Allah Edition) by Talal Itani, shipped as text, so it gets the same reading view as the Arabic: font size, verse deep links, bookmarks, copy and offline caching. The older English PDF (Hilali & Khan, on R2) is still reachable from the English selection screen.
*   **Juz (Ajzaa) Reading:** Access the Quran divided into 30 Juz (parts) for convenient reading and study, with each Juz displayed as a continuous text.
*   **PDF Viewer:** Includes a built-in PDF viewer (using PDF.js) for the English translation, featuring page navigation, zooming, and a table of contents.
*   **Language Toggle:** Switch the interface between English and Arabic.
*   **Dark / Light Theme:** Follows the system preference by default, with a manual toggle (persisted separately from other preferences).
*   **Keyboard Shortcuts:** Space (play/pause), Arrow Left/Right (seek 10 seconds), `[` and `]` (previous/next Surah while reading), Escape (close the mobile table-of-contents drawer). Listed in an expandable panel under the player.
*   **Surah Search:** Filter the 114-Surah grid live by number or Arabic/English name.
*   **Full-Text Search:** A dedicated Search section searches inside the Quran verses themselves (all 8 rewayahs, diacritic-insensitive, with per-result verse jumps - `?q=` deep link works). English queries search the shipped ClearQuran index, so both languages work offline after the first use (indexes + texts are service-worker cached) and no third-party search API is called.
*   **Reading Font Size:** A- / A / A+ controls adjust the reading text size (1.15rem-2.2rem) without changing the Rewayah font.
*   **Resume Reading:** Reopen the last Surah or Juz you were reading from the selection screen.
*   **Verse Bookmarks & Copy:** Tap any verse while reading to bookmark it or copy it with its reference and a deep link. Bookmarks are listed on the selection screen and open the verse directly.
*   **Khatma Progress:** Mark each of the 30 ajzaa as read from the reading toolbar; the Juz grid shows what is done and offers the next unread one.
*   **Deep Links & Share:** `?surah=<n>&rewayah=<id>`, `?juz=<n>`, and `?lang=<en|ar>` open the app directly in a specific view; the Share button copies an equivalent link to the clipboard.
*   **Preferences Persistence:** Reciter, Surah, Rewayah, font size, speed, loop, language, and last reading position are saved in `localStorage` and restored on the next visit.
*   **Session Continuity:** Refreshing the page restores the exact view (surah/Juz reading, PDF viewer with page number, scroll position, top-level section), the audio resumes from the last listening position (a "Last listened" hint appears next to the player, no autoplay), and the current view is mirrored into the URL so browser Back/Forward navigates between views. Preferences also sync across tabs.
*   **Offline App Shell:** A service worker (network-first for HTML/data, cache-first for versioned assets, runtime cache for the Written/ text) keeps the app shell and previously viewed texts available offline.
*   **Hosting:** Cloudflare Pages, auto-deploys on push to `main`. The English Quran PDF exceeds the Pages 25MB file limit and is served from Cloudflare R2 instead.
*   **PWA Manifest:** `manifest.json` allows "Add to Home Screen" installation with a full icon set (192/512/maskable) under `icons/`.
*   **Accessibility:** Skip link, ARIA state semantics (`aria-current`, `aria-pressed`, `aria-expanded`), live regions, focus management for the mobile drawer, keyboard-operable controls, `prefers-reduced-motion` support, and WCAG-contrast-compliant tokens in both themes.
*   **Responsive Design:** Adapts to different screen sizes (desktop, tablet, mobile).
*   **Modest & Minimal:** Clean interface focused on the core functionality.

## Project Goals

*   Provide easy and quick access to the Holy Quran audio and text.
*   Offer a clear selection mechanism for reciters and Surahs.
*   Support English and Arabic interfaces.
*   Prioritize performance and responsiveness.
*   Maintain a minimal and respectful user experience.

## Technology Stack

*   HTML5
*   CSS3
*   Vanilla JavaScript (ES Modules)
*   [PDF.js](https://mozilla.github.io/pdf.js/) library for PDF viewing.

## Structure

*   `index.html`: Main HTML file.
*   `style.<hash>.css`: CSS styles. The filename carries a content hash, so a changed file is always a new URL.
*   `script.<hash>.js`: Core application logic (including PDF.js integration), hashed the same way.
*   `quran_data.json`: Contains Surah names, Rewayat information, and paths.
*   `manifest.json`: PWA manifest referencing the `icons/` set.
*   `icons/`: Favicon-derived PWA/social assets (192/512/maskable app icons, apple-touch-icon, 1200x630 og-image), all the "Mihrab Arch" mark on the forest-green brand color.
*   `Media/`: Optional local audio files, organized by reciter (`Media/[ReciterName]/[SurahNumber].mp3`). Not in the repository; audio currently streams from the mp3quran.net CDN.
*   `Written/`: Contains text files for Arabic Rewayat (`Written/[RewayahName]/[SurahNumber].txt`), the English translation (`Written/English/[SurahNumber].txt`, one verse per line, plus its own `LICENSE.md`), Juz files (`Written/Ajzaa/[JuzNumber].txt`), and the search indexes (`Written/search-index.json` and `Written/search-index-en.json`). Large PDFs are served from object storage rather than from this repository, because they exceed the Pages 25MB file limit.
*   `fonts/`: Scheherazade New (SIL OFL) as WOFF2, used for all rewayat, plus its licence.
*   `404.html`: Real 404 page, so unknown paths do not fall back to `index.html`.
*   `sw.js`: Service worker (offline caching).
*   `_headers`, `_redirects`: Cloudflare Pages cache headers and redirects.
*   `robots.txt`, `sitemap.xml`: Crawler directives and sitemap.
*   `LICENSE`: MIT licence.


## Setup & Usage

1.  Clone the repository.
2.  Open `index.html` via a local static server (e.g. `python3 -m http.server`) - avoids CORS issues on fetches that a bare `file://` open can hit.

## Releases

Tagged with [semantic versioning](https://semver.org); see
[CHANGELOG.md](CHANGELOG.md). The current release is **3.1.0**.

## About this repository

This repository is a published snapshot of the application that runs at
hasana.ca, not a running development history. It is updated deliberately, when
a feature or a real fix lands, so it carries the state of a release rather than
every intermediate step.

It is not byte-for-byte what the live site serves, and there is one known
difference: the scanned glossary PDF is not ours to relicense, so neither it
nor the feature that opened it is included here. The script in this repository
therefore differs from the deployed one and carries a different content hash.
Everything else is the application as it runs.

Issues and pull requests are welcome. A change is applied to the maintained
source and returns in a later snapshot, so an accepted contribution will appear
here under a different commit.

## License

The **code** is MIT licensed - see [LICENSE](LICENSE).

The **content is not all MIT**, and that distinction matters if you fork this.
The English translation is under CC BY-ND 4.0 with a required credit that must
stay rendered, the mushaf font is under the SIL OFL. Material that is not ours to
relicense is not redistributed here. [NOTICE](NOTICE) lists every path and its terms;
read it before redistributing or deploying.
