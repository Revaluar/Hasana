// PDF.js is loaded lazily (only when the English PDF viewer is first opened)
// to keep the initial page load light. See getPdfjsLib().
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

let pdfjsLibPromise = null;
function getPdfjsLib() {
    if (!pdfjsLibPromise) {
        pdfjsLibPromise = import(PDFJS_URL).then(module => {
            const lib = module.default || module;
            lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
            return lib;
        });
    }
    return pdfjsLibPromise;
}

const reciterSelect = document.getElementById('reciter-select');
const surahSelect = document.getElementById('surah-select');
const audioPlayer = document.getElementById('audio-player');
const langButtons = document.querySelectorAll('.lang-button');
const translatableElements = document.querySelectorAll('[data-lang-key]');
const sidebarNavButtons = document.querySelectorAll('.nav-button');
const contentSections = document.querySelectorAll('.content-section');
const skipBackwardButton = document.getElementById('skip-backward');
const skipForwardButton = document.getElementById('skip-forward');
const readableSection = document.getElementById('readable-section');
const readablePlaceholder = readableSection.querySelector('[data-lang-key="readablePlaceholder"]');
const surahButtonsContainer = document.getElementById('surah-buttons-container');
const rewayahSelectorContainer = document.getElementById('rewayah-selector-container');
const rewayahButtonsContainer = document.getElementById('rewayah-buttons-container');
const validationMessageElement = document.getElementById('rewayah-validation-message');
const surahTextDisplayContainer = document.getElementById('surah-text-display-container');
const surahTextDisplay = document.getElementById('surah-text-display');
const readingSkeleton = document.getElementById('reading-skeleton');
const backToSurahSelectButton = document.getElementById('back-to-surah-select');
const prevSurahButton = document.getElementById('prev-surah');
const nextSurahButton = document.getElementById('next-surah');
const surahNavigationHeader = document.querySelector('.surah-navigation-header');

// ADDED: PDF.js related elements
const pdfViewerContainer = document.getElementById('pdf-viewer-container');
const pdfCanvas = document.getElementById('pdf-canvas');
const pdfCtx = pdfCanvas ? pdfCanvas.getContext('2d') : null;
const pdfPrevButton = document.getElementById('pdf-prev');
const pdfNextButton = document.getElementById('pdf-next');
const pdfPrevSideButton = document.getElementById('pdf-prev-side');
const pdfNextSideButton = document.getElementById('pdf-next-side');
const pdfPageCountSpan = document.getElementById('pdf-page-count');
const pdfPageInput = document.getElementById('pdf-page-input');
const pdfGoToPageButton = document.getElementById('pdf-go-to-page');
const customTocList = document.getElementById('custom-toc-list');
const pdfDownloadButton = document.getElementById('pdf-download');
const tocHeader = document.getElementById('toc-header');         // ADDED: TOC Header

// ADDED: Mobile TOC Elements
const hamburgerTocButton = document.getElementById('hamburger-toc'); // <<< CHANGED: Select new button
const tocSidebar = document.getElementById('custom-toc-sidebar'); // Already defined, reusing
const tocOverlay = document.getElementById('toc-overlay');
// END ADDITION

// ADDED: accessibility / ease-of-use elements
const ariaLabelElements = document.querySelectorAll('[data-lang-aria-label]');
const speedSelect = document.getElementById('speed-select');
const loopToggleButton = document.getElementById('loop-toggle');
const sleepSelect = document.getElementById('sleep-select');
const verseActions = document.getElementById('verse-actions');
const verseActionsRef = document.getElementById('verse-actions-ref');
const verseBookmarkButton = document.getElementById('verse-bookmark');
const verseCopyButton = document.getElementById('verse-copy');
const versePlayButton = document.getElementById('verse-play');
const bookmarksPanel = document.getElementById('bookmarks-panel');
const bookmarksToggle = document.getElementById('bookmarks-toggle');
const bookmarksList = document.getElementById('bookmarks-list');
const khatmaProgress = document.getElementById('khatma-progress');
const khatmaContinueButton = document.getElementById('khatma-continue');
const khatmaResetButton = document.getElementById('khatma-reset');
const juzReadToggle = document.getElementById('juz-read-toggle');
const englishEditionBar = document.getElementById('english-edition-bar');
const englishCredit = document.getElementById('english-credit');
const openPdfEditionButton = document.getElementById('open-pdf-edition');
const verseAudioToggle = document.getElementById('verse-audio-toggle');
const verseAudioBar = document.getElementById('verse-audio-bar');
const verseAudioPrev = document.getElementById('verse-audio-prev');
const verseAudioPlay = document.getElementById('verse-audio-play');
const verseAudioNext = document.getElementById('verse-audio-next');
const verseAudioStop = document.getElementById('verse-audio-stop');
const verseAudioPosition = document.getElementById('verse-audio-position');
const verseAudioRepeat = document.getElementById('verse-audio-repeat');
const verseAudioAb = document.getElementById('verse-audio-ab');
const downloadAudioLink = document.getElementById('download-audio');
const audioErrorNotice = document.getElementById('audio-error');
const surahSearchInput = document.getElementById('surah-search');
const surahSearchWrap = document.getElementById('surah-search-wrap');
const resumeReadingButton = document.getElementById('resume-reading-button');
const readingStatus = document.getElementById('reading-status');
const shareButton = document.getElementById('share-button');
const shareStatus = document.getElementById('share-status');
const fontDecreaseButton = document.getElementById('font-size-decrease');
const fontResetButton = document.getElementById('font-size-reset');
const fontIncreaseButton = document.getElementById('font-size-increase');
// END ADDITION

// ADDED: PDF.js state variables
let pdfDoc = null;
let pdfPageNum = 1;
let pdfPageRendering = false;
let pdfPageNumPending = null;
// Generation counter for loadPdfDocument: a slower load must not win
// pdfDoc over a newer one and render the wrong document's outline.
let pdfLoadSeq = 0;
const pdfScale = 1.5; // Adjust scale as needed
// PDFs live on Cloudflare R2 (hasana-pdfs bucket behind the pdfs.hasana.ca
// subdomain) because they exceed the 25MB Cloudflare Pages per-file limit.
// NOTE: Keep the R2 CORS config in sync (Allow-Origin: https://hasana.ca,
// Accept-Ranges / Content-Range / Content-Length exposed for pdf.js ranges).
const mainPdfUrl = 'https://pdfs.hasana.ca/All-Surah-en.pdf';
let currentPdfUrl = mainPdfUrl; // Track current PDF

// ADDED: Rate limiting state
let isDownloadButtonDisabled = false;
const downloadCooldown = 10000; // 10 seconds cooldown

let quranData = {}; // <<< ADDED: Single object for all data
let selectedRewayahId = 'Qaloon'; // Default to Qaloon rewayah
let currentSurahOrder = null; // ADDED: Track displayed Surah order
let currentReadingKind = null; // ADDED: 'surah' | 'juz' | null - tracks what the reading view shows
// The scroll-position key for whatever the reading view currently shows. Single
// source of truth on purpose: the saver used to build its own key from the
// global selectedRewayahId while restoreReadingScroll was called with
// displaySurahText's rewayahId ARGUMENT. Those differ whenever a caller passes
// `selectedRewayahId || 'Qaloon'` with the global unset - the saver then wrote
// "surah-2-undefined" while the restore looked for "surah-2-Qaloon", so the
// position was silently never restored. The loaders set this; nothing else may.
let currentReadingScrollKey = null;
let currentJuzNumber = null; // ADDED: Track displayed Juz number
let displayRequestSeq = 0; // ADDED: guards against stale async text loads (rapid prev/next)

// ADDED: persisted user preferences (theme keeps its own 'hasana-theme' key)
const PREFS_KEY = 'hasana-prefs';
const AUDIO_POS_KEY = 'hasana-audio-pos';
const prefs = {
    reciter: '',
    surah: '',
    selectedRewayahId: 'Qaloon',
    fontScale: 1,
    speed: 1,
    loop: false,
    language: null,
    readingState: null,
    bookmarks: [],
    juzRead: [],
    ui: { section: 'audible-section', view: 'selection' },
    pdf: { page: 1 },
    scroll: null
};

function loadPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) Object.assign(prefs, JSON.parse(raw));
    } catch (e) {
        // storage unavailable or corrupt payload
    }
    // fill any missing nested defaults (migration safety)
    if (!prefs.ui || typeof prefs.ui !== 'object') prefs.ui = { section: 'audible-section', view: 'selection' };
    if (!prefs.pdf || typeof prefs.pdf !== 'object') prefs.pdf = { page: 1 };
    if (!Array.isArray(prefs.bookmarks)) prefs.bookmarks = [];
    if (!Array.isArray(prefs.juzRead)) prefs.juzRead = [];
}

// Set while mirroring another tab's prefs (see the 'storage' listener). savePrefs
// serializes the WHOLE prefs blob, so any helper the listener calls (applyFontScale,
// switchLanguage, ...) would otherwise write this tab's own ui.view / readingState /
// scroll back over the tab that just published - which fires that tab's listener,
// which writes its blob back, and so on. The two blobs differ in exactly the fields
// the listener does not copy, so it never converges. Suppressing the echo at the
// single write point covers every current and future caller.
let applyingRemotePrefs = false;

function savePrefs() {
    if (applyingRemotePrefs) return; // mirroring a remote update; never echo it back
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {
        // storage unavailable
    }
}
// END ADDITION

// --- session continuity: audio position, scroll, URL/history state ---
let appViewState = { view: 'selection' }; // live view state mirrored into the URL
let pendingPdfPage = null;                // page to jump to once the PDF loads
let pendingVerseScroll = null;            // verse to scroll to once the surah text loads
// The edition to return to when the reader flips back to Arabic. English is an
// edition like any other here, so without this a flip to English would lose
// which of the eight rewayat they were actually reading.
let lastArabicEdition = 'Hafs';
let resumeSeekPending = false;            // seek the restored audio position once metadata is ready
let lastAudioPosSaved = 0;                // throttle marker for audio position saves
let audioPos = null;                      // { reciterId, surahOrder, time }

function loadAudioPos() {
    try {
        const raw = localStorage.getItem(AUDIO_POS_KEY);
        audioPos = raw ? JSON.parse(raw) : null;
        if (!audioPos || typeof audioPos.time !== 'number') audioPos = null;
    } catch (e) {
        audioPos = null;
    }
}

function saveAudioPos() {
    const reciterId = reciterSelect.value;
    const surahOrder = surahSelect.value;
    if (!reciterId || !surahOrder || !isFinite(audioPlayer.currentTime)) return;
    const time = audioPlayer.currentTime;
    if (time < 1) return; // ignore the very start
    audioPos = { reciterId, surahOrder, time };
    try {
        localStorage.setItem(AUDIO_POS_KEY, JSON.stringify(audioPos));
    } catch (e) {
        // storage unavailable
    }
}

function clearAudioPos() {
    audioPos = null;
    try {
        localStorage.removeItem(AUDIO_POS_KEY);
    } catch (e) {
        // storage unavailable
    }
    updateAudioResumeHint();
}

function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60);
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function updateAudioResumeHint() {
    const hint = document.getElementById('audio-resume-hint');
    if (!hint) return;
    const active = audioPos && audioPos.reciterId === reciterSelect.value && String(audioPos.surahOrder) === String(surahSelect.value);
    if (active && audioPos.time >= 1) {
        const textEl = document.getElementById('audio-resume-text');
        if (textEl) textEl.textContent = translations[currentLanguage].audioResumeHint.replace('{time}', formatTime(audioPos.time));
        hint.classList.remove('hidden');
    } else {
        hint.classList.add('hidden');
    }
}

// --- full-text search: index + normalization -------------------------------
// NOTE: normalizeArabic() MUST match Scripts/build_search_index.py
const SEARCH_INDEX_URL = 'Written/search-index.json?v=1';
// quran.com public search: translation 203 = Al-Hilali & Khan,
// "Interpretation of the Meanings of the Noble Qur'an", King Fahd Complex, Madinah (official Saudi edition)
// English search reads the shipped ClearQuran index. It replaced a live
// quran.com API call: the API's terms do not contemplate unauthenticated
// browser use, its translation is not one whose redistribution we can verify,
// and a local index also works offline like the Arabic one.
const SEARCH_INDEX_EN_URL = 'Written/search-index-en.json?v=1';
// Read off this module's own content-hashed filename rather than being a second
// copy to hand-maintain. It used to read a ?v= query; that scheme is gone, so it
// silently reported 'dev' on every build until this was fixed.
const APP_VERSION = (() => {
    try {
        const m = new URL(import.meta.url).pathname.match(/script\.([0-9a-f]+)\.js$/);
        return m ? m[1] : 'dev';
    } catch (e) { return 'dev'; }
})();

let searchIndex = null;
let searchIndexPromise = null;
let searchIndexEn = null;
let searchIndexEnPromise = null;
const surahTextCache = new Map(); // "path/order" -> verses array (1-based)

function loadSearchIndex() {
    if (!searchIndexPromise) {
        searchIndexPromise = fetch(SEARCH_INDEX_URL)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json();
            })
            .then(index => {
                searchIndex = index;
                return searchIndex;
            })
            .catch(err => {
                searchIndexPromise = null;
                throw err;
            });
    }
    return searchIndexPromise;
}

// strip list must match the python builder: harakat + annotations + digits + tatweel + zero-width
function loadSearchIndexEn() {
    if (searchIndexEn) return Promise.resolve(searchIndexEn);
    if (!searchIndexEnPromise) {
        searchIndexEnPromise = fetch(SEARCH_INDEX_EN_URL)
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(data => {
                // fold once at load; a query then compares against ready strings
                data.folded = data.verses.map(([, , text]) => normalizeEnglish(text));
                searchIndexEn = data;
                return data;
            })
            .catch(err => {
                searchIndexEnPromise = null; // allow a retry on the next query
                throw err;
            });
    }
    return searchIndexEnPromise;
}

// Case and punctuation folding only - the query and the verse are compared on
// the same footing, and the stored text itself is never rewritten (CC BY-ND).
function normalizeEnglish(text) {
    return text
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
        .replace(/[^a-z0-9' ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeArabic(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if ((code >= 0x064B && code <= 0x065F) || code === 0x0670 ||
            (code >= 0x06D6 && code <= 0x06ED) ||
            code >= 0x0660 && code <= 0x0669 ||
            code >= 0x06F0 && code <= 0x06F9 ||
            code === 0x0640 || code === 0x200B || code === 0x200C || code === 0x200D ||
            code === 0x200F || code === 0xFEFF) {
            continue;
        }
        switch (text[i]) {
            case '\u0623': case '\u0625': case '\u0622': case '\u0671': out += '\u0627'; break; // أ إ آ ٱ -> ا
            case '\u0624': out += '\u0648'; break; // ؤ -> و
            case '\u0626': out += '\u064A'; break; // ئ -> ي
            case '\u0649': case '\u06D2': out += '\u064A'; break; // ى ے -> ي
            case '\u0629': out += '\u0647'; break; // ة -> ه
            default: out += text[i];
        }
    }
    return out.replace(/\s+/g, ' ').trim();
}

// fetch (and cache) the verse list of a surah in the current rewayah
function resolveSurahVerses(order, rewayahId) {
    const path = quranData.rewayaat[rewayahId].path;
    const key = `${path}/${order}`;
    if (surahTextCache.has(key)) return Promise.resolve(surahTextCache.get(key));
    return fetch(`${path}/${order}.txt`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
        })
        .then(text => {
            const verses = parseVerseText(text);
            surahTextCache.set(key, verses);
            return verses;
        });
}

// split a raw surah text into a 1-based verse array using Arabic-Indic digit markers
function parseVerseText(rawText) {
    const markerRe = /\u06DD?[\u0660-\u0669\u06F0-\u06F9]+/g;
    const slices = [];
    let cursor = 0;
    let m;
    while ((m = markerRe.exec(rawText)) !== null) {
        slices.push(rawText.slice(cursor, m.index).trim());
        cursor = m.index + m[0].length;
    }
    return { slices, markers: rawText.match(markerRe) || [] };
}

// Generation counter for searches. English queries hit the network, so an
// older slower run can resolve after a newer one; both the render call below
// and the async append loop in renderSearchResults check this so a superseded
// search can neither replace fresher results nor keep appending rows into a
// list that has since been re-rendered for a different query.
let searchSeq = 0;

async function runFullSearch(query) {
    const trimmed = query.trim();
    const statusEl = document.getElementById('search-status');
    if (!trimmed) return;
    const seq = ++searchSeq;
    if (statusEl) statusEl.textContent = translations[currentLanguage].searchLoading;
    try {
        // Each language loads only its own index; they are fetched lazily.
        let results;
        if (/[\u0600-\u06FF]/.test(trimmed)) {
            await loadSearchIndex();
            results = await searchArabic(trimmed);
        } else {
            results = await searchEnglish(trimmed);
        }
        if (seq !== searchSeq) return; // superseded by a newer search
        renderSearchResults(results, trimmed, seq);
    } catch (err) {
        if (seq !== searchSeq) return; // don't let a stale failure clobber a live result
        console.error('Search failed:', err);
        if (statusEl) statusEl.textContent = translations[currentLanguage].searchError;
    }
}

async function searchArabic(query) {
    const normalizedQuery = normalizeArabic(query);
    if (!normalizedQuery) return [];
    const rewayahId = selectedRewayahId && searchIndex.rows[selectedRewayahId] ? selectedRewayahId : 'Qaloon';
    const rows = searchIndex.rows[rewayahId];
    const matchedTids = new Set();
    searchIndex.texts.forEach((t, tid) => {
        if (t.includes(normalizedQuery)) matchedTids.add(tid);
    });
    const results = [];
    const seen = new Set();
    for (const [tid, surah, verse] of rows) {
        if (!matchedTids.has(tid)) continue;
        const key = `${surah}:${verse}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ surah, verse, tid });
    }
    results.sort((a, b) => a.surah - b.surah || a.verse - b.verse);
    return results;
}

async function searchEnglish(query) {
    const index = await loadSearchIndexEn();
    const needle = normalizeEnglish(query);
    if (!needle) return [];
    const out = [];
    index.verses.forEach(([surah, verse, text], i) => {
        if (index.folded[i].includes(needle)) {
            out.push({ surah, verse, tid: null, enText: text, english: true });
        }
    });
    return out; // the index is already in surah/verse order
}

function renderSearchResults(results, query, seq) {
    const statusEl = document.getElementById('search-status');
    const listEl = document.getElementById('search-results');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!results.length) {
        if (statusEl) statusEl.textContent = translations[currentLanguage].searchEmpty;
        return;
    }
    const shown = results.slice(0, 30);
    if (statusEl) {
        const total = results.length;
        statusEl.textContent = total > 30
            ? translations[currentLanguage].searchCountMore.replace('{n}', String(total))
            : translations[currentLanguage].searchCount.replace('{n}', String(total));
    }
    // Append sequentially so per-result surah fetches stay throttled. This loop
    // outlives the call, so it must stop once a newer search has re-rendered the
    // list - otherwise it keeps appending this query's remaining rows (and its
    // own <mark> highlighting) into the new query's results.
    (async () => {
        for (const item of shown) {
            if (seq !== searchSeq) return;
            await appendSearchResult(listEl, item, query);
        }
    })().catch(() => {});
}

async function appendSearchResult(listEl, item, query) {
    const isEnglishResult = !!item.english;
    // An English hit is keyed to the Hafs verse numbering, which six of the
    // eight rewayat do not share - so it never renders an Arabic snippet
    // alongside, and it opens the English edition.
    const rewayahId = isEnglishResult
        ? ENGLISH_REWAYAH
        : (isKnownEdition(selectedRewayahId) && selectedRewayahId !== ENGLISH_REWAYAH ? selectedRewayahId : 'Qaloon');
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    const info = document.createElement('span');
    info.className = 'search-result-info';
    const surahData = quranData.surahs.find(s => s.order === item.surah);
    const name = currentLanguage === 'ar'
        ? `${surahData ? surahData.name_ar : item.surah} (${item.surah})`
        : `${surahData ? surahData.name_en : item.surah} (${item.surah})`;
    info.textContent = (translations[currentLanguage].searchResultTitle || 'Surah {name} - Verse {n}')
        .replace('{name}', name).replace('{n}', item.verse);

    let arabicSnippet = '';
    if (isEnglishResult) {
        arabicSnippet = '';
    } else if (item.tid !== null && searchIndex && searchIndex.texts[item.tid]) {
        // prefer the original orthography for the snippet
        try {
            const verses = await resolveSurahVerses(item.surah, rewayahId);
            arabicSnippet = verses.slices[item.verse - 1] || searchIndex.texts[item.tid];
        } catch (e) {
            arabicSnippet = searchIndex.texts[item.tid];
        }
    } else {
        arabicSnippet = item.apiArabicText || '';
    }
    // the raw text files are pre-wrapped lines; display the snippet as one flow
    arabicSnippet = withAyahMarks(arabicSnippet.replace(/\s+/g, ' ').trim());

    const arDiv = document.createElement('div');
    arDiv.className = 'search-result-arabic ' + (rewayahFontMap[rewayahId] || 'font-qaloon');
    arDiv.lang = 'ar';
    arDiv.dir = 'rtl';
    if (!isEnglishResult) arDiv.appendChild(buildMarkedSnippet(arabicSnippet, query));

    li.appendChild(button);
    button.appendChild(info);
    if (!isEnglishResult) button.appendChild(arDiv);

    if (isEnglishResult) {
        const enDiv = document.createElement('div');
        enDiv.className = 'search-result-english';
        enDiv.lang = 'en';
        enDiv.appendChild(buildMarkedSnippet(item.enText, query));
        button.appendChild(enDiv);
    }

    button.addEventListener('click', () => {
        // the verse travels in the view state, which also puts it in the URL
        applyViewState({ view: 'surah', surah: item.surah, rewayah: rewayahId, verse: item.verse }, 'push');
    });

    listEl.appendChild(li);
    return;
}

function buildMarkedSnippet(source, query) {
    // Whole-word marking only: splitting an Arabic word mid-letters breaks
    // letter joining and detaches diacritics from their base letters.
    const frag = document.createDocumentFragment();
    // Arabic has no case, so folding it costs nothing and is what makes an
    // English query mark the words it matched.
    const fold = (text) => normalizeArabic(text).toLowerCase();
    const queryWords = fold(query).split(' ').filter(Boolean);

    const tokens = source.split(/(\s+)/); // keep whitespace as its own tokens
    tokens.forEach(token => {
        if (!token) return;
        if (!token.trim()) {
            frag.appendChild(document.createTextNode(token));
            return;
        }
        const norm = fold(token);
        const matches = queryWords.some(w => w && norm.includes(w));
        if (matches) {
            const mark = document.createElement('mark');
            mark.textContent = token;
            frag.appendChild(mark);
        } else {
            frag.appendChild(document.createTextNode(token));
        }
    });
    return frag;
}

// --- reading-view loading placeholder ---------------------------------------
// #surah-text-display renders in the mushaf font, which is font-display:block,
// so ANY text put there (including "جاري التحميل...") is invisible until the OTF
// arrives. The skeleton is a sibling element in the UI font, so it is always
// visible. Screen readers get the message via the #reading-status live region.
function showReadingSkeleton() {
    if (readingSkeleton) readingSkeleton.classList.remove('hidden');
    if (surahTextDisplay) surahTextDisplay.classList.add('hidden');
}

function hideReadingSkeleton() {
    if (readingSkeleton) readingSkeleton.classList.add('hidden');
    if (surahTextDisplay) surahTextDisplay.classList.remove('hidden');
}

// Ends a reading load that cannot produce text. Every early return in the
// loaders must go through this: previously they set an error string and
// returned with aria-busy still 'true' and the skeleton/loading state up,
// leaving the reading view permanently stuck.
function failReadingLoad(message, { clearReadingState = false } = {}) {
    hideReadingSkeleton();
    if (surahTextDisplay) {
        surahTextDisplay.textContent = message;
        surahTextDisplay.setAttribute('aria-busy', 'false');
    }
    if (readingStatus) readingStatus.textContent = message;
    if (clearReadingState) {
        // Otherwise the Resume button keeps pointing at data that cannot load,
        // re-triggering this same failure on every click, forever.
        prefs.readingState = null;
        savePrefs();
    }
    showSurahTextUI();
}

// --- verse highlight: wraps the target verse in a temporary <span> and scrolls to it ---
let verseHighlightTimer = null;
let highlightRawSnapshot = null; // text as it was before the current highlight

function clearVerseHighlight(rawText) {
    hideVerseActions(); // the popover points at a verse of the text being replaced
    if (verseHighlightTimer) {
        clearTimeout(verseHighlightTimer);
        verseHighlightTimer = null;
    }
    if (rawText !== undefined) {
        surahTextDisplay.textContent = rawText; // restore plain text
    }
}

// The mushaf text files carry verse numbers as bare Arabic-Indic digits. The
// nine KFGQPC fonts we used to ship drew those digits inside the ayah rosette;
// Scheherazade New draws them as plain digits, so since the font swap the
// numbers have read as part of the verse rather than as separators.
//
// U+06DD (ARABIC END OF AYAH) is the character that encloses the digits that
// follow it, and this font composes it properly - measured in-browser, the
// rosette is the same width for a one- or two-digit number, so both digits sit
// INSIDE the circle rather than beside it.
//
// Done at render time rather than written into Written/*.txt, so the files stay
// the plain text every other tool reads (the search index builder, the Python
// page generator, parseVerseText) and this stays one reversible function.
//
// Safe to apply blindly: every Arabic-Indic digit run in all 912 rewayah files
// was checked to be a verse number, in order, 1..verse_count. Four of them
// (Doori 12 and 79, Soosi 12, Warsh 16) have no space before the number, which
// is why this deliberately does not require one.
function withAyahMarks(text) {
    return text.replace(/\u06DD?([\u0660-\u0669\u06F0-\u06F9]+)/g, '\u06DD$1');
}

// Character range of one verse inside a surah's text, delimited by the
// Arabic-Indic verse markers. Single source of truth for "where does verse N
// start and end": the deep-link highlight and the verse action popover both
// read it, so they can never disagree about which verse a tap landed on.
const VERSE_MARKER_RE = /\u06DD?[\u0660-\u0669\u06F0-\u06F9]+/g;

function verseRange(text, verseNum) {
    const re = new RegExp(VERSE_MARKER_RE.source, 'g');
    let start = 0;
    let seen = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        seen++;
        if (seen === verseNum - 1) start = m.index + m[0].length;
        if (seen === verseNum) return { start, end: m.index + m[0].length };
    }
    return null; // fewer verses than asked for
}

// Which verse contains a character offset. Markers END a verse, so a marker
// that finishes at or before the offset belongs to an earlier verse.
function verseAtOffset(text, offset) {
    const re = new RegExp(VERSE_MARKER_RE.source, 'g');
    let seen = 0;
    let total = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
        total++;
        if (m.index + m[0].length <= offset) seen++;
    }
    if (!total) return null;
    return Math.min(seen + 1, total);
}

// The English translation ships one verse per line, so it renders as numbered
// blocks rather than the single text node the Arabic mushaf needs. Verse text
// is inserted verbatim - the CC BY-ND grant allows reformatting, never rewording.
function renderEnglishVerses(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const frag = document.createDocumentFragment();
    lines.forEach((line, i) => {
        const p = document.createElement('p');
        p.className = 'verse-en';
        p.dataset.verse = String(i + 1);
        const num = document.createElement('span');
        num.className = 'verse-num';
        num.textContent = String(i + 1);
        p.append(num, document.createTextNode(line));
        frag.appendChild(p);
    });
    // Required attribution, rendered with the text it belongs to
    const credit = document.createElement('p');
    credit.className = 'english-credit-line';
    credit.textContent = translations[currentLanguage].englishCredit;
    frag.appendChild(credit);
    surahTextDisplay.replaceChildren(frag);
}

function isEnglishReadingView() {
    return currentReadingKind === 'surah' && selectedRewayahId === ENGLISH_REWAYAH;
}

// English verses are real elements, so the highlight is a class, not a span
// surgery on a single text node.
function highlightEnglishVerse(verseNum, options = {}) {
    const target = surahTextDisplay.querySelector(`[data-verse="${verseNum}"]`);
    if (!target) return;
    surahTextDisplay.querySelectorAll('.verse-highlight').forEach(el => el.classList.remove('verse-highlight', 'fading'));
    target.classList.add('verse-highlight');
    const rect = target.getBoundingClientRect();
    window.scrollTo({ top: rect.top + window.scrollY - 32, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    if (options.persist) return; // the highlight follows the recitation; no fade
    const highlightSeq = displayRequestSeq;
    verseHighlightTimer = setTimeout(() => {
        if (highlightSeq !== displayRequestSeq) { verseHighlightTimer = null; return; }
        target.classList.add('fading');
        verseHighlightTimer = setTimeout(() => {
            if (highlightSeq !== displayRequestSeq) { verseHighlightTimer = null; return; }
            target.classList.remove('verse-highlight', 'fading');
            verseHighlightTimer = null;
        }, 1000);
    }, 4000);
}

function removeVerseHighlight() {
    clearVerseHighlight();
    if (isEnglishReadingView()) {
        surahTextDisplay.querySelectorAll('.verse-highlight').forEach(el => el.classList.remove('verse-highlight', 'fading'));
        return;
    }
    if (highlightRawSnapshot !== null) {
        surahTextDisplay.textContent = highlightRawSnapshot;
        highlightRawSnapshot = null;
    }
}

function highlightVerse(verseNum, options = {}) {
    if (isEnglishReadingView()) {
        clearVerseHighlight();
        highlightEnglishVerse(verseNum, options);
        return;
    }
    const textEl = surahTextDisplay;
    if (!textEl || !textEl.textContent) return;
    // A highlight already on the page has split the text node and trimmed the
    // highlighted slice, so reading textContent back would lose that whitespace
    // for good, one verse at a time, as the recitation advances.
    const raw = highlightRawSnapshot !== null ? highlightRawSnapshot : textEl.textContent;

    const range = verseRange(raw, verseNum);
    if (!range) return;
    const verseStart = range.start;
    const verseEnd = range.end;

    clearVerseHighlight(); // drop any previous highlight (keeps current text)
    highlightRawSnapshot = raw;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(raw.slice(0, verseStart)));
    const span = document.createElement('span');
    span.className = 'verse-highlight';
    span.lang = 'ar';
    // Deliberately NOT setting span.dir: a bidi isolation boundary MUST break
    // shaping (CSS Text 3 §7.3), severing Arabic cursive joining and mark
    // attachment at the highlight's edges. The parent #surah-text-display
    // already carries dir="rtl", which the span inherits, so this changes
    // nothing about direction - it only stops forcing the isolation boundary.
    span.textContent = raw.slice(verseStart, verseEnd).trim();
    fragment.appendChild(span);
    fragment.appendChild(document.createTextNode(raw.slice(verseEnd)));
    textEl.replaceChildren(fragment);

    // scroll the highlighted verse into view
    const rect = span.getBoundingClientRect();
    if (rect.top) {
        window.scrollTo({ top: rect.top + window.scrollY - 32, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }

    if (options.persist) return; // the highlight follows the recitation; no fade

    // Fade out after a few seconds, then restore plain text. `raw` is a snapshot
    // of THIS surah's text, so the restore must not run if the reader has since
    // loaded something else - otherwise it repaints the old surah's text over
    // the new one. displayRequestSeq is bumped by every load, so it identifies
    // "still the same document" here exactly as it does inside the loaders.
    const highlightSeq = displayRequestSeq;
    verseHighlightTimer = setTimeout(() => {
        if (highlightSeq !== displayRequestSeq) { verseHighlightTimer = null; return; }
        span.classList.add('fading');
        verseHighlightTimer = setTimeout(() => {
            if (highlightSeq !== displayRequestSeq) { verseHighlightTimer = null; return; }
            clearVerseHighlight(raw);
        }, 1000);
    }, 4000);
}

// <<< ADDED: Reciter Data. audioBaseUrl is the whole-surah mp3quran.net CDN
// stream; ayahBaseUrl is the per-ayah everyayah.com set used by the verse-by-verse
// reader (<base><SSS><VVV>.mp3). Every folder name below was checked with a HEAD
// on 001001.mp3 (2026-10-16) - they are not derivable from the reciter's name. --->
const reciters = [
    { id: 'Mishary-Alafasy', name: 'Mishary Rashid Alafasy', name_ar: 'مشاري راشد العفاسي', audioBaseUrl: 'https://server8.mp3quran.net/afs/', ayahBaseUrl: 'https://everyayah.com/data/Alafasy_128kbps/' },
    { id: 'Abdul-Basit', name: 'Abdul Basit Abdul Samad', name_ar: 'عبد الباسط عبد الصمد', audioBaseUrl: 'https://server7.mp3quran.net/basit/', ayahBaseUrl: 'https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/' },
    { id: 'Mahmoud-Al-Husary', name: 'Mahmoud Khalil Al-Husary', name_ar: 'محمود خليل الحصري', audioBaseUrl: 'https://server13.mp3quran.net/husr/', ayahBaseUrl: 'https://everyayah.com/data/Husary_128kbps/' },
    { id: 'Mohamed-Al-Minshawi', name: 'Mohamed Siddiq Al-Minshawi', name_ar: 'محمد صديق المنشاوي', audioBaseUrl: 'https://server10.mp3quran.net/minsh/', ayahBaseUrl: 'https://everyayah.com/data/Minshawy_Murattal_128kbps/' },
    { id: 'Abdurrahman-As-Sudais', name: 'Abdurrahman As-Sudais', name_ar: 'عبدالرحمن السديس', audioBaseUrl: 'https://server11.mp3quran.net/sds/', ayahBaseUrl: 'https://everyayah.com/data/Abdurrahmaan_As-Sudais_192kbps/' },
    { id: 'Muhammad-Ayyub', name: 'Muhammad Ayyub', name_ar: 'محمد أيوب', audioBaseUrl: 'https://server8.mp3quran.net/ayyub/', ayahBaseUrl: 'https://everyayah.com/data/Muhammad_Ayyoub_128kbps/' },
    { id: 'Maher-Almeaqaly', name: 'Maher Al-Muaiqly', name_ar: 'ماهر المعيقلي', audioBaseUrl: 'https://server12.mp3quran.net/maher/Almusshaf-Al-Mojawwad/', ayahBaseUrl: 'https://everyayah.com/data/MaherAlMuaiqly128kbps/' },
    { id: 'Ahmed-Alajami', name: 'Ahmed Al-Ajmi', name_ar: 'أحمد العجمي', audioBaseUrl: 'https://server10.mp3quran.net/ajm/', ayahBaseUrl: 'https://everyayah.com/data/ahmed_ibn_ali_al_ajamy_128kbps/' },
    { id: 'Saad-Al-Ghamdi', name: 'Saad Al-Ghamdi', name_ar: 'سعد الغامدي', audioBaseUrl: 'https://server7.mp3quran.net/s_gmd/', ayahBaseUrl: 'https://everyayah.com/data/Ghamadi_40kbps/' },
    { id: 'Yasir-Aldosary', name: 'Yasir Ad-Dussary', name_ar: 'ياسر الدوسري', audioBaseUrl: 'https://server11.mp3quran.net/yasser/', ayahBaseUrl: 'https://everyayah.com/data/Yasser_Ad-Dussary_128kbps/' },
    { id: 'Nasser-Al-Qatami', name: 'Nasser Al-Qatami', name_ar: 'ناصر القطامي', audioBaseUrl: 'https://server6.mp3quran.net/qtm/', ayahBaseUrl: 'https://everyayah.com/data/Nasser_Alqatami_128kbps/' },
    { id: 'Hani-Ar-Rifai', name: 'Hani Ar-Rifai', name_ar: 'هاني الرفاعي', audioBaseUrl: 'https://server8.mp3quran.net/hani/', ayahBaseUrl: 'https://everyayah.com/data/Hani_Rifai_192kbps/' }
];
// <<< END ADDITION --->

// Rewayah Data (Still needed for populating dropdown? Keep for now)
// You might want to get this list dynamically from quranData.rewayaat keys later
const rewayah = [
    { id: 'Qaloon', name_ar: 'رواية قالون عن نافع' },
    { id: 'Bazzi', name_ar: 'رواية البزي عن ابن كثير' },
    { id: 'Doori', name_ar: 'رواية الدوري عن ابي عمرو' },
    { id: 'Hafs', name_ar: 'رواية حفص عن عاصم' },
    { id: 'Qunbul', name_ar: 'رواية قنبل عن ابن كثير' },
    { id: 'Shouba', name_ar: 'رواية شعبة عن عاصم' },
    { id: 'Soosi', name_ar: 'رواية السوسي عن ابي عمرو' },
    { id: 'Warsh', name_ar: 'رواية ورش عن نافع' }
];

// Map Rewayah ID to CSS font class
const ENGLISH_REWAYAH = 'English'; // the translation reads through the same view as a rewayah

// Every "is this a real edition?" check goes through this. A plain
// rewayahFontMap[id] truthiness test let inherited Object properties pass, so
// ?rewayah=constructor reached the loader and threw.
function isKnownEdition(id) {
    return typeof id === 'string' && Object.hasOwn(rewayahFontMap, id);
}

const rewayahFontMap = {
    'English': 'font-english',
    'Bazzi': 'font-bazzi',
    'Doori': 'font-doori',
    'Hafs': 'font-hafs',
    'Qaloon': 'font-qaloon',
    'Qunbul': 'font-qunbul',
    'Shouba': 'font-shouba',
    'Soosi': 'font-soosi',
    'Warsh': 'font-warsh'
};

// The single @font-face family every rewayah renders in (see style.css).
// This MUST match that @font-face name. It previously held a per-rewayah map of
// the nine KFGQPC families; when those were replaced by one face the map was
// left naming fonts that no longer exist, so document.fonts.load() matched
// nothing and resolved immediately with an empty list. That silently broke two
// things: the download never started early, and `await fontReady` stopped
// holding the skeleton up - so the pane went blank for the whole
// font-display:block period instead of showing the placeholder.
const MUSHAF_FONT_FAMILY = 'MushafFont';

// Cap on how long the skeleton waits for the mushaf font before showing the
// text anyway. font-display:block's own block period is ~3s, after which the
// browser paints a fallback, so waiting longer than that gains nothing.
const MUSHAF_FONT_TIMEOUT_MS = 3000;

function primeMushafFont() {
    if (!document.fonts) return Promise.resolve();
    return Promise.race([
        document.fonts.load(`1em ${MUSHAF_FONT_FAMILY}`).catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, MUSHAF_FONT_TIMEOUT_MS))
    ]);
}

// <<< ADDED: Function to fetch the combined Quran data --->
async function fetchQuranData() {
    try {
        const response = await fetch('quran_data.json'); // Fetch the new merged file
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        quranData = await response.json();
        populateSurahs(currentLanguage); // Needs quranData.surahs
        // updateReadableSectionVisibility() indirectly calls populateReadableSurahButtons which needs quranData.surahs
        // displaySurahText needs quranData.rewayaat and quranData.surahs
        // Initial call to populate happens in DOMContentLoaded after fetch
    } catch (error) {
        console.error("Could not fetch Quran data:", error);
        alert(translations[currentLanguage].dataLoadError);
    }
}
// <<< END ADDITION --->

// --- Language Content ---
const translations = {
    en: {
        title: "Quran Player and Reader",
        pageTitle: "Hasana - Quran Player and Reader",
        metaDescription: "Hasana - a modest Quran player and reader with multiple recitations, rewayah readings, and an English translation.",
        selectReciter: "Select Reciter:",
        selectSurah: "Select Surah:",
        selectRewayah: "Select Rewayah:",
        sections: "Sections",
        audible: "Audible",
        readable: "Readable",
        fullQuran: "Full",
        dividedQuran: "Divided",
        readableContentTitle: "Readable Quran Content",
        readablePlaceholder: "This section will display the text of the selected Surah. (Functionality to be added)",
        reciterPlaceholder: " Select Reciter ",
        surahPlaceholder: " Select Surah ",
        rewayahPlaceholder: " Select Rewayah ",
        rewayahValidationMsg: "Please select a Rewayah first.",
        backButton: "Back",
        skipLink: "Skip to content",
        tocSidebarLabel: "Table of contents",
        pdfPageInputLabel: "PDF page number",
        audioPlayerLabel: "Audio player",
        audioErrorMsg: "Audio failed to load. Please try another reciter or check your connection.",
        audioResumeHint: "Last listened: {time}",
        audioResume: "Resume",
        searchSection: "Search",
        searchPlaceholder: "Search the Quran text...",
        searchInputLabel: "Search the Quran text",
        searchGo: "Search",
        searchLoading: "Searching...",
        searchEmpty: "No matches found",
        searchError: "Search failed. Check your connection and try again.",
        searchCount: "{n} results",
        searchCountMore: "Showing first 30 of {n}",
        searchResultTitle: "Surah {name} - Verse {n}",
        speedLabel: "Speed",
        loopToggle: "Loop",
        sleepLabel: "Sleep",
        sleepOff: "Off",
        sleep10: "10 min",
        sleep20: "20 min",
        sleep30: "30 min",
        sleep60: "60 min",
        sleepSurahEnd: "End of surah",
        sleepIn: "Stops in {n} min",
        sleepAtSurahEnd: "Stops at the end of this surah",
        sleepDone: "Sleep timer stopped playback",
        verseActionsLabel: "Verse actions",
        bookmarkAdd: "Bookmark",
        bookmarkRemove: "Remove",
        copyVerse: "Copy",
        verseCopied: "Verse copied",
        verseCopyFailed: "Copy failed",
        bookmarkAdded: "Bookmark added",
        bookmarkRemoved: "Bookmark removed",
        bookmarks: "Bookmarks",
        bookmarksEmpty: "No bookmarks yet. Tap a verse while reading to add one.",
        removeBookmark: "Remove bookmark",
        khatmaProgress: "{done} of 30 ajzaa read",
        khatmaDone: "Khatma complete - all 30 ajzaa read.",
        khatmaNone: "Mark a juz as read to start tracking a khatma.",
        khatmaContinue: "Continue: Juz {n}",
        khatmaReset: "Reset progress",
        openPdfEdition: "Open the PDF edition",
        verseByVerse: "Verse by verse",
        verseAudioBarLabel: "Verse by verse recitation",
        versePrev: "Previous verse",
        verseNext: "Next verse",
        versePlay: "Play",
        versePause: "Pause",
        verseStop: "Stop",
        versePosition: "Verse {n} of {total}",
        repeatLabel: "Repeat",
        repeatOff: "Off",
        repeat2: "2x",
        repeat3: "3x",
        repeat5: "5x",
        repeatForever: "Loop",
        abSetStart: "Loop from here",
        abSetEnd: "Loop to here",
        abClear: "Looping {a}-{b}",
        versePlayFromHere: "Play",
        verseAudioError: "This verse's recitation could not be loaded.",
        englishEditionName: "ClearQuran, Talal Itani",
        englishCredit: "Translation by Talal Itani, ClearQuran.com",
        markJuzRead: "Mark as read",
        markJuzUnread: "Mark as unread",
        juzMarkedRead: "Juz {n} marked as read",
        juzMarkedUnread: "Juz {n} marked as unread",
        downloadAudioLabel: "Download current surah audio",
        searchSurahLabel: "Search surahs",
        searchSurahPlaceholder: "Search by name or number...",
        fontSizeGroupLabel: "Text size",
        fontSizeDecrease: "Decrease text size",
        fontSizeReset: "Reset text size",
        fontSizeIncrease: "Increase text size",
        share: "Share",
        shareCopied: "Link copied",
        shareFailed: "Could not copy link",
        resumeReading: "Resume reading",
        surahLoaded: "Surah {name} loaded",
        juzLoaded: "Juz {n} loaded",
        loading: "Loading...",
        themeToggle: "Toggle color theme",
        skipBackward: "Skip backward 10 seconds",
        skipForward: "Skip forward 10 seconds",
        pdfPrevPage: "Previous page",
        pdfNextPage: "Next page",
        pdfCanvasLabel: "Rendered Quran page",
        verses: "verses",
        tocHeader: "Table of Contents",
        downloadMainPdf: "Download Entire Quran in English (PDF)",
        surahLoadError: "Could not load Surah {n}. Please try again.",
        juzLoadError: "Could not load Juz {n}. Please try again.",
        pdfLoadError: "Could not load the PDF. Check your connection and try again.",
        dataLoadError: "Could not load the Quran data. Check your connection and reload the page.",
        surahDataMissing: "This Surah is unavailable in the selected Rewayah.",
        prevSurahLabel: "Previous surah: {name}",
        nextSurahLabel: "Next surah: {name}",
        shortcutsTitle: "Keyboard shortcuts",
        shortcutSpace: "Space: play / pause",
        shortcutSeek: "Arrow Left / Arrow Right: back / forward 10 seconds",
        shortcutSurah: "[ and ]: previous / next surah while reading",
        shortcutEscape: "Escape: close the table of contents panel"
    },
    ar: {
        title: "مُشغل وقارئ القرآن الكريم",
        pageTitle: "حسنة - مشغل وقارئ القرآن الكريم",
        metaDescription: "حسنة - مشغل وقارئ للقرآن الكريم: تلاوات متعددة، قراءة المصحف بثماني روايات، الأجزاء الثلاثون، وترجمة إنجليزية للقرآن.",
        selectReciter: "اختر القارئ:",
        selectSurah: "اختر السورة:",
        selectRewayah: "اختر الرواية:",
        sections: "الأقسام",
        audible: "مسموع",
        readable: "مكتوب",
        fullQuran: "كامل",
        dividedQuran: "مجزء",
        readableContentTitle: "القرآن الكريم للقراءة",
        readablePlaceholder: "هذا القسم سيعرض نص السورة المختارة. (سيتم إضافة الوظائف لاحقًا)",
        reciterPlaceholder: " اختر القارئ ",
        surahPlaceholder: " اختر السورة ",
        rewayahPlaceholder: " اختر الرواية ",
        rewayahValidationMsg: "يرجى اختيار الرواية أولاً.",
        backButton: "رجوع",
        skipLink: "تخط إلى المحتوى",
        tocSidebarLabel: "جدول المحتويات",
        pdfPageInputLabel: "رقم صفحة ملف PDF",
        audioPlayerLabel: "مشغل الصوت",
        audioErrorMsg: "تعذّر تحميل الصوت. جرّب قارئًا آخر أو تحقق من اتصالك بالإنترنت.",
        audioResumeHint: "آخر استماع: {time}",
        audioResume: "استئناف",
        searchSection: "بحث",
        searchPlaceholder: "ابحث في نص القرآن...",
        searchInputLabel: "ابحث في نص القرآن",
        searchGo: "ابحث",
        searchLoading: "جارٍ البحث...",
        searchEmpty: "لا توجد نتائج",
        searchError: "تعذّر البحث. تحقق من اتصالك وحاول مجددًا.",
        searchCount: "{n} نتيجة",
        searchCountMore: "عرض أول 30 من {n}",
        searchResultTitle: "سورة {name} - آية {n}",
        speedLabel: "السرعة",
        loopToggle: "تكرار",
        sleepLabel: "مؤقت النوم",
        sleepOff: "إيقاف",
        sleep10: "١٠ دقائق",
        sleep20: "٢٠ دقيقة",
        sleep30: "٣٠ دقيقة",
        sleep60: "٦٠ دقيقة",
        sleepSurahEnd: "عند انتهاء السورة",
        sleepIn: "يتوقف بعد {n} دقيقة",
        sleepAtSurahEnd: "يتوقف عند انتهاء هذه السورة",
        sleepDone: "تم إيقاف التشغيل بمؤقت النوم",
        verseActionsLabel: "إجراءات الآية",
        bookmarkAdd: "علامة",
        bookmarkRemove: "إزالة",
        copyVerse: "نسخ",
        verseCopied: "تم نسخ الآية",
        verseCopyFailed: "تعذّر النسخ",
        bookmarkAdded: "تمت إضافة العلامة",
        bookmarkRemoved: "تم حذف العلامة",
        bookmarks: "العلامات المرجعية",
        bookmarksEmpty: "لا توجد علامات بعد. انقر على آية أثناء القراءة لإضافتها.",
        removeBookmark: "إزالة العلامة",
        khatmaProgress: "تمت قراءة {done} من ٣٠ جزءًا",
        khatmaDone: "تمت الختمة - قُرئت الأجزاء الثلاثون.",
        khatmaNone: "حدد جزءًا كمقروء لبدء تتبع الختمة.",
        khatmaContinue: "متابعة: الجزء {n}",
        khatmaReset: "إعادة تعيين التقدم",
        openPdfEdition: "فتح نسخة PDF",
        verseByVerse: "آية آية",
        verseAudioBarLabel: "تلاوة آية آية",
        versePrev: "الآية السابقة",
        verseNext: "الآية التالية",
        versePlay: "تشغيل",
        versePause: "إيقاف مؤقت",
        verseStop: "إيقاف",
        versePosition: "الآية {n} من {total}",
        repeatLabel: "التكرار",
        repeatOff: "بدون",
        repeat2: "مرتان",
        repeat3: "٣ مرات",
        repeat5: "٥ مرات",
        repeatForever: "تكرار مستمر",
        abSetStart: "بدء التكرار من هنا",
        abSetEnd: "إنهاء التكرار هنا",
        abClear: "تكرار {a}-{b}",
        versePlayFromHere: "تشغيل",
        verseAudioError: "تعذّر تحميل تلاوة هذه الآية.",
        englishEditionName: "ClearQuran، طلال عيتاني",
        // Deliberately NOT translated: the CC BY-ND grant quotes this credit
        // verbatim, so it renders identically in both interface languages.
        englishCredit: "Translation by Talal Itani, ClearQuran.com",
        markJuzRead: "تحديد كمقروء",
        markJuzUnread: "إلغاء التحديد كمقروء",
        juzMarkedRead: "تم تحديد الجزء {n} كمقروء",
        juzMarkedUnread: "تم إلغاء تحديد الجزء {n}",
        downloadAudioLabel: "تحميل صوت السورة الحالية",
        searchSurahLabel: "البحث عن سورة",
        searchSurahPlaceholder: "ابحث بالاسم أو الرقم...",
        fontSizeGroupLabel: "حجم النص",
        fontSizeDecrease: "تصغير حجم النص",
        fontSizeReset: "استعادة الحجم الافتراضي",
        fontSizeIncrease: "تكبير حجم النص",
        share: "مشاركة",
        shareCopied: "تم نسخ الرابط",
        shareFailed: "تعذّر نسخ الرابط",
        resumeReading: "استئناف القراءة",
        surahLoaded: "تم تحميل سورة {name}",
        juzLoaded: "تم تحميل الجزء {n}",
        loading: "جاري التحميل...",
        themeToggle: "تبديل المظهر الفاتح والداكن",
        skipBackward: "رجوع ١٠ ثوانٍ",
        skipForward: "تقدم ١٠ ثوانٍ",
        pdfPrevPage: "الصفحة السابقة",
        pdfNextPage: "الصفحة التالية",
        pdfCanvasLabel: "صفحة القرآن المعروضة",
        verses: "آيات",
        tocHeader: "الفهرس",
        downloadMainPdf: "تحميل القرآن كاملاً بالإنجليزية (PDF)",
        surahLoadError: "تعذّر تحميل سورة {n}. يرجى المحاولة مرة أخرى.",
        juzLoadError: "تعذّر تحميل الجزء {n}. يرجى المحاولة مرة أخرى.",
        pdfLoadError: "تعذّر تحميل الملف. تحقق من اتصالك وحاول مجددًا.",
        dataLoadError: "تعذّر تحميل بيانات القرآن. تحقق من اتصالك وأعد تحميل الصفحة.",
        surahDataMissing: "هذه السورة غير متوفرة في الرواية المختارة.",
        prevSurahLabel: "السورة السابقة: {name}",
        nextSurahLabel: "السورة التالية: {name}",
        shortcutsTitle: "اختصارات لوحة المفاتيح",
        shortcutSpace: "مسافة: تشغيل / إيقاف مؤقت",
        shortcutSeek: "السهم الأيسر / الأيمن: رجوع / تقدم 10 ثوانٍ",
        shortcutSurah: "[ و ]: السورة السابقة / التالية أثناء القراءة",
        shortcutEscape: "Escape: إغلاق لوحة المحتويات"
    }
};

// Determine initial language: ?lang= URL param first, then browser settings
function getInitialLanguage() {
    // Support language deep links (?lang=ar / ?lang=en)
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang === 'ar' || urlLang === 'en') return urlLang;

    const browserLang = (navigator.languages && navigator.languages[0]) || navigator.language;
    const primaryLang = browserLang.split('-')[0].toLowerCase(); // Get 'ar' from 'ar-SA' or 'ar'
    return primaryLang === 'ar' ? 'ar' : 'en'; // Default to English if not Arabic
}

let currentLanguage = getInitialLanguage();

// ADDED: restore stored prefs; ?lang= / browser detection always wins at boot,
// so keep the stored language in sync with the boot decision
loadPrefs();
prefs.language = currentLanguage;
savePrefs();
// END ADDITION

// --- Functions ---

function populateReciters(lang) {
    const currentReciterValue = reciterSelect.value; // Store current selection
    reciterSelect.innerHTML = ''; // Clear existing options

    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = ""; // No value for placeholder
    placeholderOption.textContent = translations[lang].reciterPlaceholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = true; // Make it the default selected
    reciterSelect.appendChild(placeholderOption);

    // Add actual reciters
    // <<< MODIFIED: Use the new reciters array --->
    reciters.forEach(reciter => {
        const option = document.createElement('option');
        option.value = reciter.id; // Use the ID (folder name) as the value
        option.textContent = lang === 'ar' ? reciter.name_ar : reciter.name; // Use appropriate name based on lang
        reciterSelect.appendChild(option);
    });
    // <<< END MODIFICATION --->

    // Restore previous selection if it wasn't the placeholder
    if (currentReciterValue && currentReciterValue !== "") {
        reciterSelect.value = currentReciterValue;
    } else {
         reciterSelect.value = ""; // Ensure placeholder is selected if no valid previous selection
    }
}

function populateSurahs(lang) {
    const currentSurahValue = surahSelect.value; // Store current selection
    surahSelect.innerHTML = ''; // Clear existing options

    // Add placeholder option
    const placeholderOption = document.createElement('option');
    placeholderOption.value = ""; // No value for placeholder
    placeholderOption.textContent = translations[lang].surahPlaceholder;
    placeholderOption.disabled = true;
    placeholderOption.selected = true; // Make it the default selected
    surahSelect.appendChild(placeholderOption);

    // Add actual Surahs from the new data structure
    // Use quranData.surahs instead of surahData
    if (!quranData.surahs) {
        console.error("quranData.surahs not available for populating Surah select.");
        return;
    }
    quranData.surahs.forEach(surah => {
        const option = document.createElement('option');
        option.value = surah.order;
        const name = lang === 'ar' ? surah.name_ar : surah.name_en;
        const displayName = lang === 'ar' && name.startsWith("سورة ") ? name.substring(5) : name;
        option.textContent = `${surah.order}. ${displayName}`;
        surahSelect.appendChild(option);
    });

    // Restore previous selection if it wasn't the placeholder
     if (currentSurahValue && currentSurahValue !== "") {
        surahSelect.value = currentSurahValue;
    } else {
        surahSelect.value = ""; // Ensure placeholder is selected
    }
}

// --- ADDED: Function to populate Rewayah Buttons ---
function populateRewayahButtons() {
    if (!rewayahButtonsContainer) return;
    rewayahButtonsContainer.innerHTML = ''; // Clear existing buttons

    rewayah.forEach(r => {
        const button = document.createElement('button');
        button.classList.add('rewayah-button');
        button.dataset.rewayahId = r.id;
        button.textContent = r.name_ar; // Use Arabic name as requested

        // Set initial active state if this button matches the currently selected Rewayah
        // or if it's Qaloon and no rewayah is selected
        // Reading the English translation leaves selectedRewayahId === 'English',
        // which is no selection as far as the Arabic rewayah picker is concerned -
        // otherwise no button lit up and the Arabic grid opened the translation.
        const arabicSelection = selectedRewayahId === ENGLISH_REWAYAH ? null : selectedRewayahId;
        if (r.id === arabicSelection || (!arabicSelection && r.id === 'Qaloon')) {
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
            selectedRewayahId = r.id; // Ensure selectedRewayahId is set
        } else {
            button.setAttribute('aria-pressed', 'false');
        }

        button.addEventListener('click', () => {
            // Update selected Rewayah
            selectedRewayahId = r.id;
            prefs.selectedRewayahId = r.id; // ADDED: persist selection
            savePrefs();

            // Update button active states
            rewayahButtonsContainer.querySelectorAll('.rewayah-button').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');

            // Hide validation message on selection
            if (validationMessageElement) {
                validationMessageElement.classList.add('hidden');
                validationMessageElement.textContent = '';
            }
        });

        rewayahButtonsContainer.appendChild(button);
    });
}
// --- END ADDITION ---

function updateAudioSource() {
    const selectedReciter = reciterSelect.value;
    const selectedSurah = surahSelect.value;

    clearAudioError(); // ADDED: reciter/surah change clears any error notice

    if (selectedReciter && selectedSurah) {
        const reciter = reciters.find(r => r.id === selectedReciter);
        if (!reciter || !reciter.audioBaseUrl) {
            console.warn('No audio base URL configured for reciter:', selectedReciter);
            audioPlayer.src = '';
            if (downloadAudioLink) {
                downloadAudioLink.classList.add('hidden');
                downloadAudioLink.removeAttribute('href');
                downloadAudioLink.removeAttribute('download');
            }
            return;
        }

        const paddedSurah = selectedSurah.toString().padStart(3, '0');
        const audioUrl = `${reciter.audioBaseUrl}${paddedSurah}.mp3`;
        audioPlayer.src = audioUrl;
        // Redundant per spec after src=, kept: fixed the native controls' play/pause
        // icon on autoplay-next in testing (4da9ac9).
        audioPlayer.load();

        // ADDED: keep the download anchor in sync with the current audio source
        if (downloadAudioLink) {
            downloadAudioLink.href = audioUrl;
            downloadAudioLink.setAttribute('download', `surah-${paddedSurah}-${reciter.id}.mp3`);
            downloadAudioLink.classList.remove('hidden');
        }

    } else {
        audioPlayer.src = ''; // Clear src if selection is incomplete or placeholder selected
        if (downloadAudioLink) {
            downloadAudioLink.classList.add('hidden');
            downloadAudioLink.removeAttribute('href');
            downloadAudioLink.removeAttribute('download');
        }
    }

    // Setting src resets playbackRate to 1; restore the user's chosen rate
    const preferredRate = speedSelect ? (parseFloat(speedSelect.value) || 1) : (parseFloat(prefs.speed) || 1);
    audioPlayer.playbackRate = preferredRate;

    updateMediaSessionMetadata(); // keep the lock-screen title/reciter in step
}

// Single point for "move the audio selection to surah N". The ended handler,
// the Media Session next/previous track actions and the sleep timer all route
// here, so the prefs write and the saved-position reset can never drift apart.
function playAudioSurah(order, { autoplay = true } = {}) {
    if (!(order >= 1 && order <= 114)) return false;
    clearAudioPos();
    surahSelect.value = String(order);
    prefs.surah = surahSelect.value;
    savePrefs();
    updateAudioSource();
    if (autoplay) audioPlayer.play().catch(() => {});
    return true;
}

// --- Media Session: OS lock-screen / notification controls and metadata ---
// Without this the lock screen shows "hasana.ca" with no title and only a
// play/pause button; mobile browsers also need the action handlers before they
// will keep the audio alive and controllable with the screen off.
function updateMediaSessionMetadata() {
    if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    const surah = (quranData.surahs || []).find(s => String(s.order) === String(surahSelect.value));
    const reciter = reciters.find(r => r.id === reciterSelect.value);
    if (!surah || !reciter) {
        navigator.mediaSession.metadata = null;
        return;
    }
    const isAr = currentLanguage === 'ar';
    const name = isAr ? surah.name_ar : surah.name_en;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: isAr && name.startsWith('سورة ') ? name : (isAr ? `سورة ${name}` : `Surah ${name}`),
            artist: isAr ? reciter.name_ar : reciter.name,
            album: isAr ? 'حسنة' : 'Hasana',
            artwork: [
                { src: new URL('icons/icon-192.png', document.baseURI).href, sizes: '192x192', type: 'image/png' },
                { src: new URL('icons/icon-512.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }
            ]
        });
    } catch (e) {
        // MediaMetadata unavailable; the audio element still works
    }
}

// Tells the OS where we are in the track so the lock-screen scrubber is live.
// Set on metadata/seek/rate changes only - the OS interpolates between them
// using playbackRate, so there is no need to push this on every timeupdate.
function updateMediaSessionPosition() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    if (!isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;
    try {
        navigator.mediaSession.setPositionState({
            duration: audioPlayer.duration,
            playbackRate: audioPlayer.playbackRate || 1,
            position: Math.min(audioPlayer.currentTime, audioPlayer.duration)
        });
    } catch (e) {
        // a position outside the OS's accepted range; ignore
    }
}

// Whichever of the two elements is sounding is the one the OS controls act on.
function activePlayer() {
    return verseAudio.verse && versePlayer ? versePlayer : audioPlayer;
}

function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
        play: () => activePlayer().play().catch(() => {}),
        pause: () => activePlayer().pause(),
        stop: () => {
            if (verseAudio.verse) { stopVerseAudio(); return; }
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
        },
        seekbackward: (details) => skipTime(-(details && details.seekOffset ? details.seekOffset : 10)),
        seekforward: (details) => skipTime(details && details.seekOffset ? details.seekOffset : 10),
        seekto: (details) => {
            if (!details || !isFinite(details.seekTime)) return;
            if (details.fastSeek && audioPlayer.fastSeek) {
                audioPlayer.fastSeek(details.seekTime);
            } else {
                audioPlayer.currentTime = details.seekTime;
            }
            updateMediaSessionPosition();
        },
        previoustrack: () => {
            if (verseAudio.verse) { if (verseAudio.verse > 1) playVerseAudio(verseAudio.verse - 1); return; }
            playAudioSurah(parseInt(surahSelect.value, 10) - 1, { autoplay: !audioPlayer.paused });
        },
        nexttrack: () => {
            if (verseAudio.verse) { if (verseAudio.verse < verseAudio.total) playVerseAudio(verseAudio.verse + 1); return; }
            playAudioSurah(parseInt(surahSelect.value, 10) + 1, { autoplay: !audioPlayer.paused });
        }
    };
    Object.entries(handlers).forEach(([action, handler]) => {
        try {
            navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {
            // this browser does not support this action; skip it
        }
    });
}

// --- sleep timer -----------------------------------------------------------
// Deliberately NOT persisted: a sleep timer that survives a reload would stop
// playback on a later visit for no visible reason.
let sleepTimerEndsAt = null;   // epoch ms when playback should stop, or null
let sleepAtSurahEnd = false;   // stop instead of auto-advancing at 'ended'
let sleepStatusMinutes = null; // last rendered countdown, to avoid redundant writes

function setSleepStatus(text) {
    const el = document.getElementById('sleep-status');
    if (el) el.textContent = text || '';
}

function clearSleepTimer({ message = '' } = {}) {
    sleepTimerEndsAt = null;
    sleepAtSurahEnd = false;
    sleepStatusMinutes = null;
    if (sleepSelect) sleepSelect.value = '';
    setSleepStatus(message);
}

function renderSleepStatus() {
    if (sleepAtSurahEnd) {
        setSleepStatus(translations[currentLanguage].sleepAtSurahEnd);
        return;
    }
    if (!sleepTimerEndsAt) {
        setSleepStatus('');
        return;
    }
    const minutes = Math.max(1, Math.ceil((sleepTimerEndsAt - Date.now()) / 60000));
    if (minutes === sleepStatusMinutes) return;
    sleepStatusMinutes = minutes;
    setSleepStatus(translations[currentLanguage].sleepIn.replace('{n}', localeNum(minutes)));
}

// Checked from the audio 'timeupdate' tick, which only fires while playing - so
// a timer that expires while the user has paused fires when they resume, which
// is the behaviour a sleep timer should have.
function checkSleepTimer() {
    if (!sleepTimerEndsAt) return;
    if (Date.now() >= sleepTimerEndsAt) {
        audioPlayer.pause();
        saveAudioPos();
        clearSleepTimer({ message: translations[currentLanguage].sleepDone });
        return;
    }
    renderSleepStatus();
}

// Function to display the Surah selection UI
function showSurahSelectionUI() {
    resetReadingPlayback(); // the reading view is closing
    const isEnglishUi = currentLanguage === 'en';
    if (readablePlaceholder) readablePlaceholder.classList.add('hidden');
    // The rewayah picker is Arabic-only: the translation is a single edition.
    if (rewayahSelectorContainer) rewayahSelectorContainer.classList.toggle('hidden', isEnglishUi);
    if (englishEditionBar) englishEditionBar.classList.toggle('hidden', !isEnglishUi);
    if (englishCredit) englishCredit.textContent = translations[currentLanguage].englishCredit;
    if (surahButtonsContainer) surahButtonsContainer.classList.remove('hidden');
    if (surahSearchWrap) surahSearchWrap.classList.remove('hidden'); // ADDED: surah search
    if (surahTextDisplayContainer) surahTextDisplayContainer.classList.add('hidden');
    populateReadableSurahButtons(); // Repopulate Surah buttons
    filterSurahButtons(); // ADDED: re-apply any active search query
    if (!isEnglishUi) populateRewayahButtons(); // Populate Rewayah buttons
    if (validationMessageElement) {
        validationMessageElement.classList.add('hidden');
        validationMessageElement.textContent = '';
    }
    if (surahNavigationHeader) surahNavigationHeader.classList.add('hidden');
    if (pdfViewerContainer) pdfViewerContainer.classList.add('hidden');
    if (backToSurahSelectButton) backToSurahSelectButton.classList.add('hidden');
    updateResumeButton(); // ADDED
    prefs.ui.view = 'selection'; // ADDED: session restore knows we left the reading view
    savePrefs(); // ADDED
}

function updateReadableToggleVisibility() {
    const readableToggle = document.querySelector('.readable-toggle');
    if (readableToggle) readableToggle.classList.toggle('hidden', currentLanguage === 'en');
}

// Function to display the Surah text UI
function showSurahTextUI() {
    if (readablePlaceholder) readablePlaceholder.classList.add('hidden');
    if (rewayahSelectorContainer) rewayahSelectorContainer.classList.add('hidden');
    if (surahButtonsContainer) surahButtonsContainer.classList.add('hidden');
    if (surahSearchWrap) surahSearchWrap.classList.add('hidden'); // ADDED
    if (englishEditionBar) englishEditionBar.classList.add('hidden');
    if (surahTextDisplayContainer) surahTextDisplayContainer.classList.remove('hidden');
    if (pdfViewerContainer) pdfViewerContainer.classList.add('hidden');
    updateResumeButton(); // ADDED: hide resume while reading
    updateJuzReadToggle(); // ADDED: the khatma read/unread button is juz-view only
    renderVerseAudioBar(); // ADDED: verse-by-verse is surah-view only

    // Show/hide nav header and individual buttons
    if (surahNavigationHeader) {
        surahNavigationHeader.classList.remove('hidden');
        if (prevSurahButton && nextSurahButton) {
            // Only a surah view has prev/next neighbours. displayJuzText sets
            // currentSurahOrder = null and hides both arrows, then calls this -
            // and `null < 114` coerces to `0 < 114`, so the Next arrow was
            // un-hidden again one line later. It then sat in every juz view
            // carrying a stale surah name and doing nothing when tapped, since
            // its handler guards on currentSurahOrder being truthy.
            const inSurahView = currentReadingKind === 'surah' && currentSurahOrder;
            if (inSurahView && currentSurahOrder > 1) { prevSurahButton.classList.remove('hidden'); } else { prevSurahButton.classList.add('hidden'); }
            if (inSurahView && currentSurahOrder < 114) { nextSurahButton.classList.remove('hidden'); } else { nextSurahButton.classList.add('hidden'); }
            backToSurahSelectButton.classList.remove('hidden');
        }
    }
}

// Add this function after the existing functions
function updateNavigationButtons(currentSurahOrder) {
    const prevSurahOrder = Math.max(1, parseInt(currentSurahOrder) - 1);
    const nextSurahOrder = Math.min(114, parseInt(currentSurahOrder) + 1);

    // Get surah names
    const prevSurah = quranData.surahs.find(s => s.order === prevSurahOrder);
    const nextSurah = quranData.surahs.find(s => s.order === nextSurahOrder);

    // Update previous button
    const prevNameSpan = prevSurahButton.querySelector('.surah-name');
    if (prevNameSpan) {
        if (prevSurah) {
            const name = currentLanguage === 'ar' ? prevSurah.name_ar : prevSurah.name_en;
            const prefix = currentLanguage === 'ar' ? 'سورة ' : '';
            prevNameSpan.textContent = `${prefix}${name}`;
        } else {
            prevNameSpan.textContent = '';
        }
    }
    prevSurahButton.disabled = currentSurahOrder <= 1;
    if (currentSurahOrder > 1) { prevSurahButton.classList.remove('hidden'); } else { prevSurahButton.classList.add('hidden'); }

    // Update next button
    const nextNameSpan = nextSurahButton.querySelector('.surah-name');
    if (nextNameSpan) {
        if (nextSurah) {
            const name = currentLanguage === 'ar' ? nextSurah.name_ar : nextSurah.name_en;
            const prefix = currentLanguage === 'ar' ? 'سورة ' : '';
            nextNameSpan.textContent = `${prefix}${name}`;
        } else {
            nextNameSpan.textContent = '';
        }
    }
    nextSurahButton.disabled = currentSurahOrder >= 114;
    if (currentSurahOrder < 114) { nextSurahButton.classList.remove('hidden'); } else { nextSurahButton.classList.add('hidden'); }

    // ADDED: dynamic aria-labels naming the target surah
    const prevName = prevSurah ? (currentLanguage === 'ar' ? prevSurah.name_ar : prevSurah.name_en) : '';
    const nextName = nextSurah ? (currentLanguage === 'ar' ? nextSurah.name_ar : nextSurah.name_en) : '';
    prevSurahButton.setAttribute('aria-label', translations[currentLanguage].prevSurahLabel.replace('{name}', prevName));
    nextSurahButton.setAttribute('aria-label', translations[currentLanguage].nextSurahLabel.replace('{name}', nextName));
}

// Modify the displaySurahText function to include the navigation update
async function displaySurahText(rewayahId, surahOrder) {
    resetReadingPlayback(); // a new text invalidates any running recitation
    // --- ADDED: Update current Surah tracker ---
    currentSurahOrder = parseInt(surahOrder, 10); // Ensure it's a number
    currentReadingKind = 'surah'; // ADDED
    currentJuzNumber = null; // ADDED
    const requestSeq = ++displayRequestSeq; // ADDED: invalidate any in-flight load
    // --- END ADDITION ---

    // Claim the deep-linked verse jump for THIS request only. It is set by the
    // caller just before invoking us, so consuming it up front (rather than in
    // the success path) means a request that later goes stale cannot leave it
    // set for whichever surah the reader opens next.
    const verseToScroll = pendingVerseScroll;
    pendingVerseScroll = null;
    clearVerseHighlight(); // cancel any pending fade-restore from the previous surah

    const loadingKey = translations[currentLanguage].loading;
    surahTextDisplay.setAttribute('aria-busy', 'true'); // ADDED
    if (readingStatus) readingStatus.textContent = loadingKey; // announce to screen readers

    // Reveal the reading view and its placeholder NOW rather than after the fetch.
    // showSurahTextUI() used to run only on the success path, so tapping a surah
    // left the selection grid on screen, unchanged, for the whole load - no
    // indication anything was happening, and a second tap queued another load.
    showSurahTextUI();
    showReadingSkeleton();

    const basmalaDisplayElement = document.getElementById('basmala-display');
    const surahTitleDisplayElement = document.getElementById('surah-display-title');

    basmalaDisplayElement.classList.add('hidden');
    surahTitleDisplayElement.classList.add('hidden');

    // Ensure combined data is loaded
    if (!quranData || !quranData.surahs || !quranData.rewayaat) {
        console.error("Quran data (quranData) not fully loaded yet.");
        failReadingLoad(translations[currentLanguage].dataLoadError);
        return;
    }

    // Find the general Surah data (for title)
    const generalSurahInfo = quranData.surahs.find(s => s.order == surahOrder); // Use == for potential type mismatch
    // Get Rewayah specific data
    const rewayahData = quranData.rewayaat[rewayahId];
    const rewayahSurahInfo = rewayahData ? rewayahData.surah_info[surahOrder] : null;

    if (!generalSurahInfo || !rewayahData || !rewayahSurahInfo) {
        console.error(`Data not found for Rewayah ${rewayahId} or Surah ${surahOrder} in quranData.`);
        // This surah/rewayah pair is not in quran_data.json, so a stored
        // readingState pointing at it can never succeed - drop it.
        failReadingLoad(translations[currentLanguage].surahDataMissing, { clearReadingState: true });
        return;
    }

    // Extract data from the new structure
    const surahTitle = generalSurahInfo.name_ar; // Title from general Surah data
    const hasBasmalaFlag = rewayahSurahInfo.has_basmala; // Flag from Rewayah-specific info
    const verseCount = rewayahSurahInfo.verse_count; // Verse count from Rewayah-specific info
    const specificBasmalaText = rewayahData.basmala_text; // Basmala text for this Rewayah
    const filePath = `${rewayahData.path}/${surahOrder}.txt`; // Path from Rewayah data
    const rewayahFontClass = rewayahFontMap[rewayahId] || '';
    const isEnglish = rewayahId === ENGLISH_REWAYAH;
    // Remember the rewayah to return to when the reader flips back to Arabic.
    if (!isEnglish) lastArabicEdition = rewayahId;
    // The translation renders in the UI font, so there is no mushaf face to wait for.
    const fontReady = isEnglish ? Promise.resolve() : primeMushafFont();

    // Swap the container's mushaf font class NOW, not after the fetch resolves.
    // The basmala's class is already applied pre-fetch (just below), so leaving
    // the container on the previously-read rewayah's font until the text
    // arrives renders the two in different mushaf fonts during every load.
    // Surgical add/remove rather than a className reset: the container also
    // carries 'hidden', which showSurahTextUI() owns.
    Object.values(rewayahFontMap).forEach((c) => surahTextDisplayContainer.classList.remove(c));
    if (rewayahFontClass) surahTextDisplayContainer.classList.add(rewayahFontClass);

    // --- Title and Basmala Display Logic ---
    // 1. Handle Basmala display
    if (hasBasmalaFlag) { 
        if (specificBasmalaText) {
            basmalaDisplayElement.textContent = specificBasmalaText;
            basmalaDisplayElement.className = 'basmala-display'; // Reset classes
            if (rewayahFontClass) {
                basmalaDisplayElement.classList.add(rewayahFontClass);
            }
            basmalaDisplayElement.classList.remove('hidden');
        } else {
            basmalaDisplayElement.classList.add('hidden');
        }
    } else {
        basmalaDisplayElement.classList.add('hidden');
    }

    // 2. Handle Title display
    const displayedTitle = isEnglish ? generalSurahInfo.name_en : surahTitle;
    surahTitleDisplayElement.textContent = `${displayedTitle} (${localeNum(verseCount)} ${translations[currentLanguage].verses})`;
    surahTitleDisplayElement.lang = isEnglish ? 'en' : 'ar';
    surahTitleDisplayElement.dir = isEnglish ? 'ltr' : 'rtl';
    surahTitleDisplayElement.classList.remove('hidden');
    // --- End Display Logic ---

    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${filePath}`);
        }
        const text = await response.text();
        if (requestSeq !== displayRequestSeq) return; // ADDED: stale load, ignore

        // Apply font class to the MAIN text container
        surahTextDisplayContainer.className = 'surah-text-display-container'; // Reset classes
        if (rewayahFontClass) {
            surahTextDisplayContainer.classList.add(rewayahFontClass);
        }

        // Display ONLY the Surah text
        if (isEnglish) {
            renderEnglishVerses(text);
        } else {
            surahTextDisplay.textContent = withAyahMarks(text.trim());
        }
        surahTextDisplay.lang = isEnglish ? 'en' : 'ar';
        surahTextDisplay.dir = isEnglish ? 'ltr' : 'rtl';
        surahTextDisplay.setAttribute('aria-busy', 'false'); // ADDED

        // ADDED: announce completion politely + persist resume state
        const announcedName = currentLanguage === 'ar' ? surahTitle : generalSurahInfo.name_en;
        if (readingStatus) readingStatus.textContent = translations[currentLanguage].surahLoaded.replace('{name}', announcedName);
        prefs.readingState = { kind: 'surah', id: currentSurahOrder, rewayahId: rewayahId };
        prefs.ui.view = 'surah';
        savePrefs();

        // Update navigation
        updateNavigationButtons(surahOrder);
        
        // Show the navigation header
        if (surahNavigationHeader) {
            surahNavigationHeader.classList.remove('hidden');
        }

        showSurahTextUI(); // Switch to the text view (will handle nav button visibility)

        // Hold the skeleton until the mushaf OTF is usable. The text is already in
        // the DOM, but font-display:block keeps it invisible until the font lands,
        // so swapping now would show a blank page instead of a placeholder.
        // Restoring the scroll offset afterwards also means it is applied against
        // the final post-font layout, rather than being invalidated by the reflow.
        await fontReady;
        if (requestSeq !== displayRequestSeq) return; // superseded while waiting on the font
        hideReadingSkeleton();

        currentReadingScrollKey = `surah-${currentSurahOrder}-${rewayahId}`;
        restoreReadingScroll(currentReadingScrollKey);
        if (verseToScroll) {
            highlightVerse(verseToScroll); // deep-linked verse jump (scroll + highlight)
        }

    } catch (error) {
        if (requestSeq !== displayRequestSeq) return; // ADDED: stale load, ignore
        console.error(`Could not fetch or display Surah text from ${filePath}:`, error);
        hideReadingSkeleton(); // otherwise the placeholder animates over a failed load forever
        surahTextDisplay.textContent = translations[currentLanguage].surahLoadError.replace('{n}', surahOrder);
        surahTextDisplay.setAttribute('aria-busy', 'false'); // ADDED
        if (readingStatus) readingStatus.textContent = translations[currentLanguage].surahLoadError.replace('{n}', surahOrder);
        surahTitleDisplayElement.classList.add('hidden');
        basmalaDisplayElement.classList.add('hidden');
        // Hide nav header on error
        if (surahNavigationHeader) {
            surahNavigationHeader.classList.add('hidden');
        }
        // No need to call showSurahTextUI here, as the container is already visible
        // and we just hid the header elements
    }
}
// --- END MODIFICATION ---

// Function to populate Surah buttons in the readable section
function populateReadableSurahButtons() {
    if (!surahButtonsContainer) return;
    surahButtonsContainer.innerHTML = '';

    // Use quranData.surahs
    if (!quranData.surahs) {
        console.error("quranData.surahs not available for populating Surah buttons.");
        return;
    }
    quranData.surahs.forEach(surah => {
        const button = document.createElement('button');
        button.classList.add('surah-button');
        button.dataset.surahOrder = surah.order;
        button.textContent = currentLanguage === 'en'
            ? `${surah.order}. ${surah.name_en}`
            : `${surah.order}. سورة ${surah.name_ar}`;
        button.lang = currentLanguage === 'en' ? 'en' : 'ar';
        // ADDED: searchable key (number + Arabic name + English name)
        button.dataset.searchKey = `${surah.order} ${surah.name_ar} ${surah.name_en}`.toLowerCase();
        
        button.addEventListener('click', () => {
            const surahOrder = button.dataset.surahOrder;
            if (validationMessageElement) validationMessageElement.classList.add('hidden');
            validationMessageElement.textContent = '';

            // English has one edition and no rewayah selector, so nothing to validate
            const edition = currentLanguage === 'en' ? ENGLISH_REWAYAH : selectedRewayahId;
            if (!edition) {
                validationMessageElement.textContent = translations[currentLanguage].rewayahValidationMsg;
                if (validationMessageElement) validationMessageElement.classList.remove('hidden');
                return;
            }
            applyViewState({ view: 'surah', surah: parseInt(surahOrder, 10), rewayah: edition }, 'push');
        });
        
        surahButtonsContainer.appendChild(button);
    });
}

// Function to update the readable section visibility
function updateReadableSectionVisibility() {
    if (!readableSection) return;

    const isReadableActive = !readableSection.classList.contains('hidden');
    const isTextDisplayed = surahTextDisplayContainer && !surahTextDisplayContainer.classList.contains('hidden');
    const isPdfDisplayed = pdfViewerContainer && !pdfViewerContainer.classList.contains('hidden');

    if (isReadableActive) {
        if (isPdfDisplayed && currentLanguage === 'en') {
            setupEnglishReadableView(); // the reader explicitly opened the PDF edition
        } else if (isTextDisplayed) {
            showSurahTextUI(); // If text was shown, keep showing it
        } else {
            showSurahSelectionUI(); // Otherwise show selection UI
        }
    } else { // Readable section is not active
        // Hide everything related to the readable section
        if (readablePlaceholder) readablePlaceholder.classList.remove('hidden');
        if (rewayahSelectorContainer) rewayahSelectorContainer.classList.add('hidden');
        if (surahButtonsContainer) surahButtonsContainer.classList.add('hidden');
        if (surahSearchWrap) surahSearchWrap.classList.add('hidden'); // ADDED
        if (englishEditionBar) englishEditionBar.classList.add('hidden');
        if (surahTextDisplayContainer) surahTextDisplayContainer.classList.add('hidden');
        if (pdfViewerContainer) pdfViewerContainer.classList.add('hidden');
        updateResumeButton(); // ADDED
        // Optionally clear dynamic content if needed
        if (surahButtonsContainer) surahButtonsContainer.innerHTML = '';
        if (rewayahButtonsContainer) rewayahButtonsContainer.innerHTML = '';
    }
}

// Function to set up English readable view (PDF.js)
function setupEnglishReadableView() {
    if (!readableSection || !pdfViewerContainer) return;
    // Invalidate any in-flight Arabic text load. Without this its success path
    // still passes the seq check and calls showSurahTextUI(), which re-hides the
    // PDF viewer we are about to show - leaving Arabic mushaf text on screen in
    // English mode, on top of a PDF load that is still running.
    displayRequestSeq++;

    // The Arabic mushaf toggle (Full/Divided) only applies to the Arabic view
    const readableToggle = document.querySelector('.readable-toggle');
    if (readableToggle) readableToggle.classList.add('hidden');

    // Hide Arabic specific elements
    if (rewayahSelectorContainer) rewayahSelectorContainer.classList.add('hidden');
    if (surahButtonsContainer) surahButtonsContainer.classList.add('hidden');
    if (surahSearchWrap) surahSearchWrap.classList.add('hidden'); // ADDED
    if (englishEditionBar) englishEditionBar.classList.add('hidden');
    if (surahTextDisplayContainer) surahTextDisplayContainer.classList.add('hidden');
    if (readablePlaceholder) readablePlaceholder.classList.add('hidden');

    // Show PDF viewer container
    pdfViewerContainer.classList.remove('hidden');

    // Load the currently selected PDF document (or default)
    loadPdfDocument(currentPdfUrl); 
}

// --- ADDED: PDF.js Rendering Functions ---
async function renderPdfPage(num) {
    if (!pdfDoc || pdfPageRendering || !pdfCtx) {
        return; // Exit if no doc, already rendering, or no canvas context
    }
    // Pin the document this render belongs to. loadPdfDocument nulls and
    // replaces the global mid-render, so every deref below uses this local, and
    // shared state (the rendering flag, the nav buttons, prefs.pdf.page) is only
    // touched while this render still owns the viewer. Without this, a render
    // left over from the previous document throws on pdfDoc.numPages and
    // persists its page number over the new document's.
    const doc = pdfDoc;
    pdfPageRendering = true;

    // Update UI page input field
    if(pdfPageInput) pdfPageInput.value = num;

    try {
        // Fetch the page
        const page = await doc.getPage(num);
        if (doc !== pdfDoc) return; // document swapped while fetching the page

        const viewport = page.getViewport({ scale: pdfScale });
        pdfCanvas.height = viewport.height;
        pdfCanvas.width = viewport.width;

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: pdfCtx,
            viewport: viewport
        };
        const renderTask = page.render(renderContext);

        await renderTask.promise;
        if (doc !== pdfDoc) return; // superseded: the flag now belongs to the new document's render
        pdfPageRendering = false;

        // Handle pending page render request
        if (pdfPageNumPending !== null) {
            renderPdfPage(pdfPageNumPending);
            pdfPageNumPending = null;
        }

        // Update button states (toolbar + side navigation)
        pdfPrevButton.disabled = num <= 1;
        pdfNextButton.disabled = num >= doc.numPages;
        if (pdfPrevSideButton) pdfPrevSideButton.disabled = num <= 1;
        if (pdfNextSideButton) pdfNextSideButton.disabled = num >= doc.numPages;

        // ADDED: persist the current PDF page for session restore.
        // Only while the viewer is actually the current view - a render that
        // resolves after the user left would otherwise persist this page over
        // whatever they navigated to.
        if (prefs.ui.view === 'pdf') {
            prefs.pdf.page = num;
            savePrefs();
        }

    } catch (err) {
        console.error('Error rendering page:', err);
        if (doc === pdfDoc) pdfPageRendering = false; // only if we still own the flag
    }
}

function queueRenderPage(num) {
    if (pdfPageRendering) {
        pdfPageNumPending = num;
    } else {
        renderPdfPage(num);
    }
}

function onPrevPage() {
    if (pdfPageNum <= 1) {
        return;
    }
    pdfPageNum--;
    queueRenderPage(pdfPageNum);
}

function onNextPage() {
    if (pdfPageNum >= pdfDoc.numPages) {
        return;
    }
    pdfPageNum++;
    queueRenderPage(pdfPageNum);
}

async function loadPdfDocument(url) {
    const loadSeq = ++pdfLoadSeq; // invalidate any in-flight load of another document

    currentPdfUrl = url; // Update the tracker
    pdfDoc = null; // Reset doc object
    // Abandon any render still in flight for the outgoing document: it will bail
    // on its own doc-identity check, but the flag and pending page must be
    // cleared here or the incoming document's first render is swallowed.
    pdfPageRendering = false;
    pdfPageNumPending = null;

    // Update UI before loading
    if (pdfPageInput) pdfPageInput.value = translations[currentLanguage].loading;
    if (pdfPageCountSpan) pdfPageCountSpan.textContent = '-';
    if (customTocList) {
        // <ul> must not hold bare text; build a real <li>. textContent (not
        // innerHTML) so a translated string can never inject markup.
        customTocList.replaceChildren(
            Object.assign(document.createElement('li'), { textContent: translations[currentLanguage].loading })
        );
    }
    if (pdfPrevButton) pdfPrevButton.disabled = true;
    if (pdfNextButton) pdfNextButton.disabled = true;
    if (pdfPrevSideButton) pdfPrevSideButton.disabled = true;
    if (pdfNextSideButton) pdfNextSideButton.disabled = true;
    if (pdfGoToPageButton) pdfGoToPageButton.disabled = true;
    if (pdfPageInput) pdfPageInput.disabled = true;

    // Update sidebar active states and Download button
    if (url === mainPdfUrl) {
        if (tocHeader) {
            tocHeader.classList.add('active');
            tocHeader.setAttribute('aria-current', 'true'); // ADDED
        }
        if (pdfDownloadButton) {
            pdfDownloadButton.classList.remove('hidden');
            pdfDownloadButton.textContent = translations[currentLanguage].downloadMainPdf;
            pdfDownloadButton.onclick = () => handlePdfDownload(mainPdfUrl); // Set specific handler
        }
    } else {
        // Hide download button if it's some other PDF?
        if (pdfDownloadButton) pdfDownloadButton.classList.add('hidden'); 
    }

    try {
        // Lazy-load PDF.js the first time the viewer is used
        const pdfjsLib = await getPdfjsLib();

        if (loadSeq !== pdfLoadSeq) return; // another document was requested while PDF.js loaded

        // Asynchronously load the PDF
        const loadingTask = pdfjsLib.getDocument({ url: url });
        const doc = await loadingTask.promise;
        if (loadSeq !== pdfLoadSeq) return; // superseded; do not claim the global
        pdfDoc = doc;

        pdfPageCountSpan.textContent = doc.numPages;
        if (pdfPageInput) pdfPageInput.max = doc.numPages; // Set max for input
        if (pdfGoToPageButton) pdfGoToPageButton.disabled = false;
        if (pdfPageInput) pdfPageInput.disabled = false;

        // Initial page rendering
        if (pendingPdfPage && pendingPdfPage >= 1 && pendingPdfPage <= doc.numPages) {
            pdfPageNum = pendingPdfPage; // restore the saved page after a reload
        } else {
            pdfPageNum = 1; // Reset to first page on load
        }
        pendingPdfPage = null;
        renderPdfPage(pdfPageNum); // Render will enable prev/next buttons

        // ADDED: persist PDF viewer state for session restore.
        // Guarded on the readable section still being current: this runs after an
        // await, and switchSection resets ui.view when the user leaves. Without
        // the guard, a PDF that finished loading after the user clicked away
        // re-marked the view as 'pdf', and the next reload reopened the viewer
        // they had explicitly navigated out of.
        if (prefs.ui.section === 'readable-section') {
            prefs.ui.view = 'pdf';
            prefs.pdf.url = url;
            savePrefs();
        }

        // Load and Populate TOC ONLY for the main PDF
        if (url === mainPdfUrl) {
            const outline = await doc.getOutline(); // this document's outline, not whatever is global now
            if (loadSeq !== pdfLoadSeq) return; // superseded while reading the outline
            populateCustomToc(outline);
        } else {
            if (customTocList) customTocList.innerHTML = '';
        }

    } catch (err) {
        if (loadSeq !== pdfLoadSeq) return; // stale failure must not clobber a newer successful load
        console.error('Error during PDF loading:', err);
        alert(translations[currentLanguage].pdfLoadError);
        if (customTocList) {
            customTocList.replaceChildren(
                Object.assign(document.createElement('li'), { textContent: translations[currentLanguage].pdfLoadError })
            );
        }
        if (pdfPageInput) pdfPageInput.value = '-';
        if (pdfPageCountSpan) pdfPageCountSpan.textContent = '-';
        // A failed PDF load must not leave a stale 'pdf' view for the next session restore
        if (prefs.ui.view === 'pdf') {
            prefs.ui.view = 'selection';
            savePrefs();
        }
    }
}

// --- ADDED: Function to populate Custom TOC sidebar ---
function populateCustomToc(outline, parentElement = customTocList) {
    if (!parentElement) return;
    // Clear existing list items only at the top level
    if (parentElement === customTocList) {
        parentElement.innerHTML = ''; // Clear before populating
    }

    if (!outline || outline.length === 0) {
         if (parentElement === customTocList) { // Only show if top level is empty
             parentElement.innerHTML = '<li>No Table of Contents found.</li>';
         }
        return;
    }

    outline.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.textContent = item.title;
        a.href = '#'; // Prevent default link behavior

        // Get destination page index (0-based)
        const destRef = Array.isArray(item.dest) ? item.dest[0] : item.dest;
        
        // Make sure destRef is valid before proceeding
        if (destRef) { 
            // Pass the potentially corrected destRef here
            pdfDoc.getPageIndex(destRef).then(pageIndex => { 
                // getPageIndex returns a 0-based index; +1 gives the 1-based page number
                const targetPageNum = pageIndex + 1; 
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Ensure main PDF is loaded before navigating
                    if (currentPdfUrl !== mainPdfUrl) {
                        loadPdfDocument(mainPdfUrl).then(() => {
                            // Need to wait for PDF to load before setting page
                            pdfPageNum = targetPageNum;
                            queueRenderPage(pdfPageNum);
                            // ADDED: Close mobile TOC after navigating
                            closeMobileToc(); 
                        });
                    } else {
                        pdfPageNum = targetPageNum;
                        queueRenderPage(pdfPageNum);
                        // ADDED: Close mobile TOC after navigating
                        closeMobileToc(); 
                    }
                });
            }).catch(err => {
                console.error('Error getting page index for bookmark:', item.title, err);
                // Make the link non-functional if destination fails
                a.classList.add('toc-link-disabled');
                a.title = 'Could not link this item';
            });
        } else {
            // Handle cases where destination might be invalid/null
             console.warn('Invalid destination for bookmark:', item.title);
             a.classList.add('toc-link-disabled');
             a.title = 'Invalid bookmark destination';
        }

        li.appendChild(a);
        parentElement.appendChild(li);

        // Recursively handle nested items
        if (item.items && item.items.length > 0) {
            const sublist = document.createElement('ul');
            li.appendChild(sublist);
            populateCustomToc(item.items, sublist);
        }
    });
}
// --- END Custom TOC Function ---

// --- ADDED: Mobile TOC Helper Functions ---
function openMobileToc() {
    if (tocSidebar && tocOverlay) {
        tocSidebar.classList.add('toc-mobile-visible');
        tocOverlay.classList.add('visible');
        // Only NOW is this a modal dialog. These used to sit in the static
        // markup, which told assistive tech the rest of the page was inert even
        // on desktop, where the sidebar is an ordinary inline column.
        tocSidebar.setAttribute('role', 'dialog');
        tocSidebar.setAttribute('aria-modal', 'true');
        if (hamburgerTocButton) hamburgerTocButton.setAttribute('aria-expanded', 'true');
        // Move focus into the drawer: first TOC link, else the sidebar itself
        requestAnimationFrame(() => {
            const firstLink = customTocList ? customTocList.querySelector('a[href]:not(.toc-link-disabled)') : null;
            if (firstLink && firstLink.offsetParent !== null) {
                firstLink.focus();
            } else if (tocSidebar) {
                tocSidebar.focus();
            }
        });
    }
}

function closeMobileToc() {
    if (tocSidebar && tocOverlay) {
        const wasOpen = tocSidebar.classList.contains('toc-mobile-visible');
        tocSidebar.classList.remove('toc-mobile-visible');
        tocOverlay.classList.remove('visible');
        tocSidebar.removeAttribute('role');       // no longer a modal; see openMobileToc
        tocSidebar.removeAttribute('aria-modal');
        if (hamburgerTocButton) hamburgerTocButton.setAttribute('aria-expanded', 'false');
        // Return focus to the hamburger that opened the drawer
        if (wasOpen && hamburgerTocButton && hamburgerTocButton.offsetParent !== null &&
            tocSidebar.contains(document.activeElement)) {
            hamburgerTocButton.focus();
        }
    }
}
// --- END ADDITION ---

// --- END PDF.js Rendering Functions ---

function switchLanguage(lang) {
    if (currentLanguage === lang) return; // No change needed

    currentLanguage = lang;
    prefs.language = lang; // ADDED: persist language choice
    savePrefs();

    // Update HTML lang and dir
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';

    // Update text content for all translatable elements
    translatableElements.forEach(el => {
        const key = el.getAttribute('data-lang-key');
        if (translations[lang] && translations[lang][key]) {
            // Meta tags need their content attribute, not textContent
            if (el.tagName === 'META') {
                el.setAttribute('content', translations[lang][key]);
            // Special handling for readable placeholder
            } else if (el === readablePlaceholder && lang === 'ar' && !readableSection.classList.contains('hidden')) {
                 // Don't update placeholder text if Arabic and readable section is active (buttons will show)
            } else {
                el.textContent = translations[lang][key];
                if (el.tagName !== 'TITLE') el.setAttribute('lang', lang);
            }
        }
    });

    // Update Reciter dropdown language
    populateReciters(lang);
    // Update Surah dropdown language
    populateSurahs(lang); // Uses quranData internally now

    // Update button active state
    langButtons.forEach(button => {
        if (button.getAttribute('data-lang') === lang) {
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true'); // ADDED
        } else {
            button.classList.remove('active');
            button.setAttribute('aria-pressed', 'false'); // ADDED
        }
    });

    // Update readable section display (buttons vs placeholder vs text vs PDF)
    const isReadableActive = !readableSection.classList.contains('hidden');
    if (isReadableActive) {
        // Flipping the language while something is open used to drop the reader
        // back on the surah grid. Now the page survives the flip: a surah
        // reopens in the other language's edition at the same verse, and a Juz
        // stays put (the Juz text is Arabic-only, so there is nothing to swap).
        if (!surahTextDisplayContainer.classList.contains('hidden')) {
            if (currentReadingKind === 'surah' && currentSurahOrder) {
                const target = lang === 'en' ? ENGLISH_REWAYAH : lastArabicEdition;
                const verse = clampVerseToEdition(currentReadingVerse(), target, currentSurahOrder);
                selectedRewayahId = target;
                prefs.selectedRewayahId = target;
                if (verse) pendingVerseScroll = verse;
                appViewState = { view: 'surah', surah: currentSurahOrder, rewayah: target, verse: verse || undefined };
                displaySurahText(target, currentSurahOrder);
            } else if (currentReadingKind !== 'juz') {
                showSurahSelectionUI();
            }
        } else {
            updateReadableSectionVisibility();
        }
    } else {
         // If readable section isn't active, just update the placeholder text if visible
        if (!readablePlaceholder.classList.contains('hidden') && translations[lang].readablePlaceholder) {
            readablePlaceholder.textContent = translations[lang].readablePlaceholder;
        }
         if (pdfViewerContainer) pdfViewerContainer.classList.add('hidden'); // Ensure PDF viewer is hidden if section inactive
    }
    updateReadableToggleVisibility();
    // Aria-labels and placeholders live here, not in the data-lang-key loop, and
    // this was previously called ONLY once at boot. So every [data-lang-aria-label]
    // control kept whatever language the page happened to start in - switching to
    // English left the theme toggle, the skip buttons and the PDF page arrows
    // announcing themselves in Arabic to screen readers, and vice versa.
    updateDynamicLanguage(lang);
    syncUrl(true); // ADDED: keep the ?lang= param in sync with the chosen language
}

function switchSection(sectionId, options = {}) {
    // Leaving the current section invalidates any in-flight text load. Otherwise
    // that load completes with a still-current seq and writes prefs.ui.view =
    // 'surah' after this call already set the view to the section the user moved
    // to - so the next reload reopens the reading view they navigated away from.
    displayRequestSeq++;

    // Hide all sections
    contentSections.forEach(section => {
        section.classList.add('hidden');
    });

    // Show the target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    // ADDED: persist the top-level section for session restore
    prefs.ui.section = sectionId;
    savePrefs();

    // Update active button state in sidebar
    sidebarNavButtons.forEach(button => {
        if (button.getAttribute('data-section') === sectionId) {
            button.classList.add('active');
            button.setAttribute('aria-current', 'page'); // ADDED
        } else {
            button.classList.remove('active');
            button.removeAttribute('aria-current'); // ADDED
        }
    });


    // ADDED: Conditional update based on language for readable section
    if (sectionId === 'readable-section') {
        if (options.pdfEdition && currentLanguage === 'en') {
            setupEnglishReadableView(); // the reader asked for the PDF edition
        } else {
            showSurahSelectionUI();
        }
    } else {
        // If switching AWAY from readable section, ensure PDF viewer is hidden
        resetReadingPlayback();
        if (pdfViewerContainer) pdfViewerContainer.classList.add('hidden');
         // Hide other readable elements if needed (handled by existing logic)
    updateReadableSectionVisibility();
    }
    updateReadableToggleVisibility();
    // END ADDITION
    scrollToTopSmooth(); // ADDED: section switch scrolls to top of main

    // ADDED: focus the search input when opening the search section
    if (sectionId === 'search-section') {
        const searchInput = document.getElementById('full-search-input');
        if (searchInput) searchInput.focus();
    }

    // Leaving the readable section: reset the persisted view flag so a refresh
    // restores the last top-level section rather than the reading view.
    if (sectionId !== 'readable-section') {
        prefs.ui.view = 'selection';
        savePrefs();
        // Clear the reading trackers too. backToSurahSelect and
        // switchReadableSection already do this; switchSection did not, so after
        // reading a surah and clicking "Audible" the scroll listener still saw
        // currentReadingKind === 'surah' and filed the audio page's scroll offset
        // under that surah's key - which then yanked it to a meaningless position
        // the next time it was opened.
        currentReadingKind = null;
        currentReadingScrollKey = null;
        currentSurahOrder = null;
        currentJuzNumber = null;
    }
    // NOTE: no history write here on purpose. This used to replaceState over the
    // entry the user was sitting on, so navigating away from a surah destroyed
    // that entry and Back could never return to it. Callers own history now:
    // applyViewState writes via syncUrlOr, and the sidebar handler pushes.
}

// --- URL state + history: view navigation is mirrored in the URL ---
function urlForState(state) {
    const p = new URLSearchParams();
    p.set('lang', currentLanguage);
    if (state && state.view === 'surah' && state.surah) {
        p.set('surah', String(state.surah));
        p.set('rewayah', state.rewayah || 'Qaloon');
        if (state.verse) p.set('verse', String(state.verse));
    } else if (state && state.view === 'juz' && state.juz) {
        p.set('juz', String(state.juz));
    } else if (state && state.view === 'search' && state.q) {
        p.set('q', state.q);
    }
    const qs = p.toString();
    return window.location.pathname + (qs ? '?' + qs : '');
}

function syncUrlOr(mode, state) {
    if (mode === 'push') history.pushState(state, '', urlForState(state));
    else if (mode === 'replace') history.replaceState(state, '', urlForState(state));
    // mode 'none': no URL writes (popstate-driven restore)
}

function syncUrl(replace) {
    // Mirror the current live view into the URL without adding history entries
    const url = urlForState(appViewState);
    if (replace === false) history.pushState(appViewState, '', url);
    else history.replaceState(appViewState, '', url);
}

function applyViewState(state, mode) {
    // mode: 'push' (user navigation), 'replace' (init), 'none' (popstate - no URL writes)
    if (!state || !state.view) state = { view: 'selection' };

    if (state.view === 'pdf') {
        if (currentLanguage !== 'en') {
            // The PDF viewer is English-only; fall back to the selection UI
            state = { view: 'selection' };
        } else {
            if (state.pdfPage) pendingPdfPage = parseInt(state.pdfPage, 10);
            switchSection('readable-section', { pdfEdition: true });
            appViewState = state;
            syncUrlOr(mode, state);
            return;
        }
    }

    if (state.view === 'search') {
        switchSection('search-section');
        appViewState = state;
        syncUrlOr(mode, state);
        const inputEl = document.getElementById('full-search-input');
        if (state.q && inputEl) {
            inputEl.value = state.q;
            runFullSearch(state.q);
        } else if (inputEl) {
            inputEl.focus();
        }
        return;
    }

    switchSection('readable-section');

    if (state.view === 'surah') {
        if (state.rewayah && isKnownEdition(state.rewayah)) selectedRewayahId = state.rewayah;
        const order = parseInt(state.surah, 10);
        if (!isNaN(order) && order >= 1 && order <= 114) {
            // displaySurahText consumes pendingVerseScroll, so it must be set first
            if (state.verse) pendingVerseScroll = parseInt(state.verse, 10);
            displaySurahText(selectedRewayahId || 'Qaloon', order);
        } else {
            showSurahSelectionUI();
        }
    } else if (state.view === 'juz') {
        const juz = parseInt(state.juz, 10);
        if (!isNaN(juz) && juz >= 1 && juz <= 30) {
            displayJuzText(juz);
        } else {
            showSurahSelectionUI();
        }
    } else {
        // selection (or unknown): show the readable selection UI
        if (currentLanguage === 'en') {
            setupEnglishReadableView();
        } else if (state.sub === 'divided-quran' || state.sub === 'full-quran') {
            // Both toggle tabs must go through switchReadableSection: it is the
            // only thing that hides the OTHER container and moves .active /
            // aria-current between the two buttons. 'full-quran' used to fall
            // through to showSurahSelectionUI(), which shows the surah grid but
            // never hides the juz grid - so tapping مجزء then كامل left both
            // grids stacked on screen with the toggle still highlighting مجزء.
            switchReadableSection(state.sub);
        } else {
            showSurahSelectionUI();
        }
    }

    // switchSection may have rewritten appViewState; mirror the applied state
    appViewState = state;
    syncUrlOr(mode, state);
}

window.addEventListener('popstate', (event) => {
    if (!quranData || !quranData.surahs) return; // data not ready yet
    const state = event.state && event.state.view ? event.state : { view: 'selection' };
    applyViewState(state, 'none');
});

// --- scroll position capture/restore for the reading views ---
function restoreReadingScroll(key) {
    if (prefs.scroll && prefs.scroll.key === key && isFinite(prefs.scroll.y) && prefs.scroll.y > 0) {
        const target = prefs.scroll.y;
        // Applied across three frames, defensively, against two known races:
        // (1) the verse text is un-hidden immediately before this runs, so
        // layout - and therefore the maximum scroll offset - may not be final,
        // and an early scrollTo would be clamped; (2) switchSection fires
        // scrollToTopSmooth(), an async animation that can still be running.
        // behavior:'auto' cancels a smooth animation, and re-applying after
        // layout settles beats the clamp. NOTE: not verified at runtime -
        // programmatic scrolling is blocked in the dev browser pane, so this is
        // reasoned from the call order, not measured. Re-test on a real device
        // before assuming scroll restore works end to end.
        const apply = () => window.scrollTo({ top: target, behavior: 'auto' });
        apply();
        requestAnimationFrame(() => { apply(); requestAnimationFrame(apply); });
    } else {
        scrollToTopSmooth();
    }
}

let scrollSaveTimer = null;
window.addEventListener('scroll', () => {
    if (!currentReadingKind) return; // only track while a surah/juz is open
    if (scrollSaveTimer) return;
    // Snapshot which document is being scrolled NOW. This is a 400ms trailing
    // debounce, and the loaders repoint currentReadingScrollKey when a new surah
    // or juz loads - so tapping next/prev mid-debounce would otherwise file this
    // scroll offset under the NEXT document's key, making it jump to a stale
    // position the moment it loads.
    const keyAtScroll = currentReadingScrollKey;
    if (!keyAtScroll) return; // nothing loaded yet; nothing to attribute a scroll to
    scrollSaveTimer = window.setTimeout(() => {
        scrollSaveTimer = null;
        if (currentReadingScrollKey !== keyAtScroll) return; // navigated away mid-debounce
        prefs.scroll = { key: keyAtScroll, y: window.scrollY };
        savePrefs();
    }, 400);
}, { passive: true });

function skipTime(seconds) {
    if (verseAudio.verse && versePlayer && isFinite(versePlayer.duration)) {
        versePlayer.currentTime = Math.min(Math.max(0, versePlayer.currentTime + seconds), versePlayer.duration);
        return;
    }
    if (!audioPlayer.readyState) return; // Don't skip if player not ready

    const newTime = audioPlayer.currentTime + seconds;
    // Clamp the new time between 0 and the duration
    audioPlayer.currentTime = Math.max(0, Math.min(newTime, audioPlayer.duration));
}

// --- ADDED: ease-of-use / a11y helpers ---

function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollToTopSmooth() {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

// Language-dependent attributes that data-lang-key (textContent) cannot cover
function updateDynamicLanguage(lang) {
    updateMediaSessionMetadata(); // title/reciter are language-dependent
    renderSleepStatus();
    renderBookmarks(); // bookmark labels carry translated surah names
    renderKhatma();
    updateJuzReadToggle();
    renderVerseAudioBar();
    hideVerseActions();
    ariaLabelElements.forEach(el => {
        const key = el.getAttribute('data-lang-aria-label');
        if (translations[lang] && translations[lang][key]) {
            el.setAttribute('aria-label', translations[lang][key]);
        }
    });

    if (surahSearchInput) surahSearchInput.placeholder = translations[lang].searchSurahPlaceholder;
    const fullSearchInput = document.getElementById('full-search-input');
    if (fullSearchInput) fullSearchInput.placeholder = translations[lang].searchPlaceholder;

    // Keep the visible error notice in the current language
    if (audioErrorNotice && !audioErrorNotice.classList.contains('hidden')) {
        audioErrorNotice.textContent = translations[lang].audioErrorMsg;
    }

    // Rebuild prev/next surah labels if the reading view is open
    if (currentSurahOrder && surahTextDisplayContainer && !surahTextDisplayContainer.classList.contains('hidden')) {
        updateNavigationButtons(currentSurahOrder);
    }

    updateAudioResumeHint(); // refresh the resume hint in the new language
}

function updateLoopButtonState() {
    if (!loopToggleButton) return;
    loopToggleButton.setAttribute('aria-pressed', String(audioPlayer.loop));
    loopToggleButton.classList.toggle('active', audioPlayer.loop);
}

function showAudioError() {
    if (!audioErrorNotice) return;
    audioErrorNotice.textContent = translations[currentLanguage].audioErrorMsg;
    audioErrorNotice.classList.remove('hidden');
}

function clearAudioError() {
    if (audioErrorNotice) audioErrorNotice.classList.add('hidden');
}

// Reading font size: 1.6rem default, clamped to 1.15rem-2.2rem (font-family untouched)
const FONT_SIZE_BASE = 1.6;
const FONT_SIZE_MIN = 1.15;
const FONT_SIZE_MAX = 2.2;
const FONT_SIZE_STEP = 0.1;

function applyFontScale(scale) {
    const clamped = Math.min(1.35, Math.max(0.75, scale));
    prefs.fontScale = Math.round(clamped * 100) / 100;
    const size = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, FONT_SIZE_BASE * prefs.fontScale));
    if (surahTextDisplayContainer) {
        surahTextDisplayContainer.style.setProperty('--reading-font-size', `${Math.round(size * 100) / 100}rem`);
    }
    savePrefs();
}

function updateResumeButton() {
    if (!resumeReadingButton) return;
    const selectionVisible = surahButtonsContainer && !surahButtonsContainer.classList.contains('hidden');
    const dividedVisible = document.getElementById('divided-quran-container') && !document.getElementById('divided-quran-container').classList.contains('hidden');
    const onSelectionScreen = selectionVisible || dividedVisible;
    const show = prefs.readingState && onSelectionScreen;
    resumeReadingButton.classList.toggle('hidden', !show);
    if (bookmarksPanel) {
        bookmarksPanel.classList.toggle('hidden', !(onSelectionScreen && prefs.bookmarks.length));
    }
}

function resumeReading() {
    const state = prefs.readingState;
    if (!state) return;
    if (state.kind === 'surah') {
        applyViewState({ view: 'surah', surah: state.id, rewayah: state.rewayahId || 'Qaloon' }, 'push');
    } else if (state.kind === 'juz') {
        applyViewState({ view: 'juz', juz: state.id }, 'push');
    }
}

// --- bookmarks: verse-level, stored with the prefs blob --------------------
const BOOKMARK_LIMIT = 300; // keeps the prefs blob well inside the storage quota

function bookmarkIndex(surah, verse, rewayahId) {
    return prefs.bookmarks.findIndex(b => b.surah === surah && b.verse === verse && b.rewayah === rewayahId);
}

function toggleBookmark(surah, verse, rewayahId) {
    const existing = bookmarkIndex(surah, verse, rewayahId);
    if (existing >= 0) {
        prefs.bookmarks.splice(existing, 1);
    } else {
        prefs.bookmarks.push({ surah, verse, rewayah: rewayahId, ts: Date.now() });
        // Oldest first, so trimming the front drops the stalest bookmarks.
        if (prefs.bookmarks.length > BOOKMARK_LIMIT) prefs.bookmarks.splice(0, prefs.bookmarks.length - BOOKMARK_LIMIT);
    }
    savePrefs();
    renderBookmarks();
    updateResumeButton();
    return existing < 0; // true when it was added
}

function surahName(order) {
    const info = (quranData.surahs || []).find(sr => String(sr.order) === String(order));
    if (!info) return String(order);
    if (currentLanguage !== 'ar') return info.name_en;
    return info.name_ar.startsWith('سورة ') ? info.name_ar.substring(5) : info.name_ar;
}

// Arabic UI gets Arabic-Indic digits; the mushaf text already uses them, so
// Western digits next to it read as a different alphabet mid-sentence.
function localeNum(n) {
    return currentLanguage === 'ar' ? Number(n).toLocaleString('ar-EG') : String(n);
}

function verseLabel(surah, verse) {
    return `${surahName(surah)} ${localeNum(surah)}:${localeNum(verse)}`;
}

function renderBookmarks() {
    if (!bookmarksList) return;
    bookmarksList.replaceChildren();
    if (!prefs.bookmarks.length) {
        const empty = document.createElement('li');
        empty.className = 'bookmarks-empty';
        empty.textContent = translations[currentLanguage].bookmarksEmpty;
        bookmarksList.appendChild(empty);
        return;
    }
    // Newest first - the list is appended to, so render it reversed.
    prefs.bookmarks.slice().reverse().forEach(b => {
        const row = document.createElement('li');
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'bookmark-open';
        open.textContent = verseLabel(b.surah, b.verse);
        open.addEventListener('click', () => {
            applyViewState({ view: 'surah', surah: b.surah, rewayah: b.rewayah, verse: b.verse }, 'push');
        });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'bookmark-remove';
        remove.textContent = '\u00d7';
        remove.setAttribute('aria-label', `${translations[currentLanguage].removeBookmark}: ${verseLabel(b.surah, b.verse)}`);
        remove.addEventListener('click', () => {
            toggleBookmark(b.surah, b.verse, b.rewayah);
        });
        row.append(open, remove);
        bookmarksList.appendChild(row);
    });
}

// --- verse-by-verse recitation --------------------------------------------
// One audio file per ayah (everyayah.com), so the highlighted verse and the
// audible verse are the same thing by construction - no timing data, no drift.
// The whole-surah stream stays on the Audible section; this is a second,
// independent element so neither one's handlers touch the other.
//
// Verse numbering: the per-ayah files follow the Hafs (Kufan) count. Six of the
// eight rewayat number verses differently, so the control only appears for the
// editions that share that count.
const HAFS_NUMBERED_EDITIONS = ['Hafs', 'Shouba', ENGLISH_REWAYAH];

let versePlayer = null;
const verseAudio = {
    surah: null,      // surah the loaded verse belongs to
    verse: null,      // verse currently loaded
    total: 0,         // verses in the open surah
    playsLeft: 1,     // remaining plays of this verse (0 = endless)
    loopStart: null,  // A of the A-B loop
    loopEnd: null     // B of the A-B loop
};

function verseAudioAvailable() {
    return currentReadingKind === 'surah'
        && currentSurahOrder
        && HAFS_NUMBERED_EDITIONS.includes(selectedRewayahId || '')
        && !!currentReciterAyahBase();
}

function currentReciterAyahBase() {
    // A reader who has never opened the player has no reciter selected; the
    // verse reader still needs one, so fall back to the first in the list.
    const reciter = reciters.find(r => r.id === reciterSelect.value) || reciters[0];
    return reciter ? reciter.ayahBaseUrl : null;
}

function ayahUrl(surah, verse) {
    const base = currentReciterAyahBase();
    if (!base) return null;
    return `${base}${String(surah).padStart(3, '0')}${String(verse).padStart(3, '0')}.mp3`;
}

function getVersePlayer() {
    if (versePlayer) return versePlayer;
    versePlayer = new Audio();
    versePlayer.preload = 'auto';
    versePlayer.addEventListener('ended', handleVerseAudioEnded);
    versePlayer.addEventListener('error', () => {
        if (!versePlayer.getAttribute('src')) return;
        if (readingStatus) readingStatus.textContent = translations[currentLanguage].verseAudioError;
        stopVerseAudio();
    });
    versePlayer.addEventListener('play', renderVerseAudioBar);
    versePlayer.addEventListener('pause', renderVerseAudioBar);
    return versePlayer;
}

function repeatCount() {
    const value = parseInt(verseAudioRepeat ? verseAudioRepeat.value : '1', 10);
    return isNaN(value) ? 1 : value; // 0 means endless
}

function playVerseAudio(verse) {
    if (!verseAudioAvailable()) return;
    const total = verseCountForCurrentSurah();
    if (!(verse >= 1 && verse <= total)) return;
    const url = ayahUrl(currentSurahOrder, verse);
    if (!url) return;
    const player = getVersePlayer();
    verseAudio.surah = currentSurahOrder;
    verseAudio.verse = verse;
    verseAudio.total = total;
    verseAudio.playsLeft = repeatCount();
    audioPlayer.pause(); // never two recitations at once
    player.src = url;
    player.playbackRate = parseFloat(speedSelect ? speedSelect.value : 1) || 1;
    player.play().catch(() => {});
    highlightVerse(verse, { persist: true });
    renderVerseAudioBar();
}

function verseCountForCurrentSurah() {
    const edition = quranData.rewayaat[selectedRewayahId];
    const info = edition && edition.surah_info ? edition.surah_info[String(currentSurahOrder)] : null;
    return info ? info.verse_count : 0;
}

function handleVerseAudioEnded() {
    // the reader moved on while this verse was playing
    if (verseAudio.surah !== currentSurahOrder || !verseAudioAvailable()) {
        stopVerseAudio();
        return;
    }
    // repeat this verse first, then honour an A-B loop, then simply advance
    if (verseAudio.playsLeft === 0 || verseAudio.playsLeft > 1) {
        if (verseAudio.playsLeft > 1) verseAudio.playsLeft -= 1;
        versePlayer.currentTime = 0;
        versePlayer.play().catch(() => {});
        return;
    }
    const { loopStart, loopEnd } = verseAudio;
    if (loopStart && loopEnd && verseAudio.verse >= loopEnd) {
        playVerseAudio(loopStart);
        return;
    }
    const next = verseAudio.verse + 1;
    if (next > verseAudio.total) {
        stopVerseAudio();
        return;
    }
    playVerseAudio(next);
}

// Every exit from a reading view routes here: the verse player, its highlight
// and the pre-highlight snapshot all belong to the text that is going away.
// Without it a recitation kept running over the next surah, its 'ended' handler
// advanced verses in the NEW surah, and Stop repainted the old surah's text
// over whatever is on screen.
function resetReadingPlayback() {
    stopVerseAudio();
    highlightRawSnapshot = null;
}

function stopVerseAudio() {
    if (versePlayer) {
        versePlayer.pause();
        versePlayer.removeAttribute('src');
    }
    verseAudio.surah = null;
    verseAudio.verse = null;
    verseAudio.loopStart = null;
    verseAudio.loopEnd = null;
    removeVerseHighlight();
    renderVerseAudioBar();
}

function renderVerseAudioBar() {
    const active = !!(verseAudio.verse && versePlayer && versePlayer.getAttribute('src'));
    if (verseAudioBar) verseAudioBar.classList.toggle('hidden', !active);
    if (verseAudioToggle) {
        verseAudioToggle.classList.toggle('hidden', !verseAudioAvailable());
        verseAudioToggle.classList.toggle('active', active);
        verseAudioToggle.setAttribute('aria-pressed', String(active));
    }
    if (!active) return;
    if (verseAudioPosition) {
        verseAudioPosition.textContent = translations[currentLanguage].versePosition
            .replace('{n}', localeNum(verseAudio.verse))
            .replace('{total}', localeNum(verseAudio.total));
    }
    if (verseAudioPlay) {
        const paused = versePlayer.paused;
        verseAudioPlay.textContent = paused ? '\u25B6' : '\u2759\u2759';
        verseAudioPlay.setAttribute('aria-label', translations[currentLanguage][paused ? 'versePlay' : 'versePause']);
    }
    if (verseAudioAb) {
        const { loopStart, loopEnd } = verseAudio;
        if (loopStart && loopEnd) {
            verseAudioAb.textContent = translations[currentLanguage].abClear
                .replace('{a}', localeNum(loopStart)).replace('{b}', localeNum(loopEnd));
            verseAudioAb.classList.add('active');
        } else if (loopStart) {
            verseAudioAb.textContent = translations[currentLanguage].abSetEnd;
            verseAudioAb.classList.add('active');
        } else {
            verseAudioAb.textContent = translations[currentLanguage].abSetStart;
            verseAudioAb.classList.remove('active');
        }
    }
}

// One button cycles the classic A-B loop: set A, set B, clear.
function cycleAbLoop() {
    if (!verseAudio.verse) return;
    if (verseAudio.loopStart && verseAudio.loopEnd) {
        verseAudio.loopStart = null;
        verseAudio.loopEnd = null;
    } else if (verseAudio.loopStart) {
        verseAudio.loopEnd = Math.max(verseAudio.loopStart, verseAudio.verse);
    } else {
        verseAudio.loopStart = verseAudio.verse;
    }
    renderVerseAudioBar();
}

// --- khatma progress: which of the 30 ajzaa have been read -----------------
function isJuzRead(juz) {
    return prefs.juzRead.includes(Number(juz));
}

function toggleJuzRead(juz) {
    const n = Number(juz);
    const at = prefs.juzRead.indexOf(n);
    if (at >= 0) prefs.juzRead.splice(at, 1);
    else prefs.juzRead.push(n);
    prefs.juzRead.sort((a, b) => a - b);
    savePrefs();
    renderKhatma();
    updateJuzReadToggle();
    return at < 0; // true when it was marked read
}

// The next unread juz in order - what "continue" means for a khatma.
function nextUnreadJuz() {
    for (let i = 1; i <= 30; i++) {
        if (!isJuzRead(i)) return i;
    }
    return null;
}

function renderKhatma() {
    const juzGrid = document.querySelector('.juz-grid');
    if (juzGrid) {
        juzGrid.querySelectorAll('.juz-button').forEach(btn => {
            const read = isJuzRead(btn.dataset.juzNumber);
            btn.classList.toggle('read', read);
            btn.setAttribute('aria-pressed', String(read));
        });
    }
    const done = prefs.juzRead.length;
    const next = nextUnreadJuz();
    if (khatmaProgress) {
        if (!done) khatmaProgress.textContent = translations[currentLanguage].khatmaNone;
        else if (!next) khatmaProgress.textContent = translations[currentLanguage].khatmaDone;
        else khatmaProgress.textContent = translations[currentLanguage].khatmaProgress.replace('{done}', localeNum(done));
    }
    if (khatmaContinueButton) {
        khatmaContinueButton.classList.toggle('hidden', !(done && next));
        if (done && next) {
            khatmaContinueButton.textContent = translations[currentLanguage].khatmaContinue.replace('{n}', localeNum(next));
            khatmaContinueButton.dataset.juzNumber = String(next);
        }
    }
    if (khatmaResetButton) khatmaResetButton.classList.toggle('hidden', !done);
}

// The toolbar's read/unread button belongs to the juz view only - a surah is
// not a khatma portion, and verse-level bookmarks cover that case instead.
function updateJuzReadToggle() {
    if (!juzReadToggle) return;
    const show = currentReadingKind === 'juz' && currentJuzNumber;
    juzReadToggle.classList.toggle('hidden', !show);
    if (!show) return;
    const read = isJuzRead(currentJuzNumber);
    juzReadToggle.textContent = read
        ? translations[currentLanguage].markJuzUnread
        : translations[currentLanguage].markJuzRead;
    juzReadToggle.classList.toggle('active', read);
    juzReadToggle.setAttribute('aria-pressed', String(read));
}

// --- verse actions: tap a verse while reading to bookmark or copy it -------
// The reading view is deliberately ONE text node (wrapping every verse in a
// span risks breaking Arabic shaping at the boundaries), so the tapped verse is
// resolved from the caret offset under the pointer rather than from an element.
let verseActionsTarget = null; // { surah, verse, rewayah }

function offsetFromPoint(x, y) {
    let node = null;
    let offset = 0;
    if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos) { node = pos.offsetNode; offset = pos.offset; }
    } else if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(x, y);
        if (range) { node = range.startContainer; offset = range.startOffset; }
    }
    if (!node || !surahTextDisplay.contains(node)) return null;
    // An active deep-link highlight splits the display into several text nodes,
    // so the offset has to be summed across the ones before the tapped node.
    const walker = document.createTreeWalker(surahTextDisplay, NodeFilter.SHOW_TEXT);
    let total = 0;
    let current;
    while ((current = walker.nextNode())) {
        if (current === node) return total + offset;
        total += current.textContent.length;
    }
    return null;
}


// Which verse the reader is currently on, for carrying their place across a
// language flip. Three sources, in order of confidence: an active highlight
// (deep link or running recitation), the topmost visible verse element in the
// English view, or - in the Arabic view, which is deliberately one text node -
// the caret offset at the top of the viewport resolved through verseAtOffset.
// Returns null when it cannot tell, and the caller then just opens the surah.
function currentReadingVerse() {
    if (currentReadingKind !== 'surah' || !surahTextDisplay) return null;

    if (isEnglishReadingView()) {
        const marked = surahTextDisplay.querySelector('.verse-highlight');
        if (marked && marked.dataset.verse) return parseInt(marked.dataset.verse, 10);
        for (const el of surahTextDisplay.querySelectorAll('.verse-en')) {
            if (el.getBoundingClientRect().bottom > 0) return parseInt(el.dataset.verse, 10);
        }
        return null;
    }

    const raw = highlightRawSnapshot !== null ? highlightRawSnapshot : surahTextDisplay.textContent;
    if (!raw) return null;

    // An active highlight is the most precise answer, and it is the common case
    // when flipping twice in a row: without this the second flip would measure
    // the top of the viewport, where the highlight's own scroll offset leaves
    // the PREVIOUS verse still partly visible, so the place would creep
    // backwards a few verses on every flip.
    const marked = surahTextDisplay.querySelector('.verse-highlight');
    if (marked) {
        const walker = document.createTreeWalker(surahTextDisplay, NodeFilter.SHOW_TEXT);
        let before = 0;
        let node;
        while ((node = walker.nextNode())) {
            if (marked.contains(node)) return verseAtOffset(raw, before);
            before += node.textContent.length;
        }
    }

    const rect = surahTextDisplay.getBoundingClientRect();
    if (rect.height === 0) return null;
    // A point inside the text, as near the top of what is on screen as possible.
    const x = rect.left + rect.width / 2;
    const y = Math.min(Math.max(rect.top + 4, 8), window.innerHeight - 8);
    const offset = offsetFromPoint(x, y);
    return offset === null ? null : verseAtOffset(raw, offset);
}

// Verse numbering is not shared across editions: surah 2 is 286 verses in Hafs
// and 285 in Qaloon and Warsh, because the rewayat divide the same text
// differently. The owner's call (2026-10-16) is to carry the verse anyway - the
// drift is bounded by the number of division differences in that surah, so it
// is usually none and occasionally one, not an arbitrary jump. Clamping keeps
// it inside the target edition rather than failing to scroll at all.
function clampVerseToEdition(verse, editionId, surahOrder) {
    if (!verse) return null;
    const info = quranData && quranData.rewayaat[editionId]
        && quranData.rewayaat[editionId].surah_info[String(surahOrder)];
    if (!info || !info.verse_count) return verse;
    return Math.min(verse, info.verse_count);
}

function hideVerseActions() {
    verseActionsTarget = null;
    if (verseActions) verseActions.classList.add('hidden');
}

function showVerseActions(verse, x, y) {
    if (!verseActions || !currentSurahOrder) return;
    const rewayahId = selectedRewayahId || 'Qaloon';
    verseActionsTarget = { surah: currentSurahOrder, verse, rewayah: rewayahId };
    if (verseActionsRef) verseActionsRef.textContent = verseLabel(currentSurahOrder, verse);
    if (verseBookmarkButton) {
        const saved = bookmarkIndex(currentSurahOrder, verse, rewayahId) >= 0;
        verseBookmarkButton.textContent = saved
            ? translations[currentLanguage].bookmarkRemove
            : translations[currentLanguage].bookmarkAdd;
        verseBookmarkButton.classList.toggle('active', saved);
    }
    if (versePlayButton) versePlayButton.classList.toggle('hidden', !verseAudioAvailable());
    verseActions.classList.remove('hidden');
    // Clamp into the viewport after it is measurable
    const rect = verseActions.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - rect.width / 2), window.innerWidth - rect.width - 8);
    const top = y + rect.height + 16 > window.innerHeight ? y - rect.height - 12 : y + 12;
    verseActions.style.left = `${Math.round(left)}px`;
    verseActions.style.top = `${Math.round(Math.max(8, top))}px`;
}

function handleVerseTap(event) {
    if (currentReadingKind !== 'surah') return; // Juz view restarts verse numbers per surah
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return; // the user is selecting text, not tapping a verse
    if (isEnglishReadingView()) {
        // English verses are elements, so the tapped one is simply the ancestor
        const block = event.target.closest('[data-verse]');
        if (!block) return;
        showVerseActions(parseInt(block.dataset.verse, 10), event.clientX, event.clientY);
        return;
    }
    const offset = offsetFromPoint(event.clientX, event.clientY);
    if (offset === null) return;
    const verse = verseAtOffset(surahTextDisplay.textContent, offset);
    if (!verse) return;
    showVerseActions(verse, event.clientX, event.clientY);
}

async function copyCurrentVerse() {
    if (!verseActionsTarget) return;
    const { surah, verse, rewayah } = verseActionsTarget;
    let text;
    if (rewayah === ENGLISH_REWAYAH) {
        const block = surahTextDisplay.querySelector(`[data-verse="${verse}"]`);
        // the leading number span is presentation, not part of the translation
        text = block ? block.textContent.replace(/^\s*\d+\s*/, '').trim() : '';
    } else {
        const range = verseRange(surahTextDisplay.textContent, verse);
        text = range ? surahTextDisplay.textContent.slice(range.start, range.end).trim() : '';
    }
    if (!text) return;
    const link = `${window.location.origin}${urlForState({ view: 'surah', surah, rewayah, verse })}`;
    const credit = rewayah === ENGLISH_REWAYAH ? `\n${translations[currentLanguage].englishCredit}` : '';
    const ok = await copyTextToClipboard(`${text}\n\n${verseLabel(surah, verse)}${credit}\n${link}`);
    if (readingStatus) {
        readingStatus.textContent = ok
            ? translations[currentLanguage].verseCopied
            : translations[currentLanguage].verseCopyFailed;
    }
    hideVerseActions();
}

async function copyTextToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (e) {
        // fall through to legacy path
    }
    try {
        const tempInput = document.createElement('textarea');
        tempInput.value = text;
        tempInput.setAttribute('readonly', '');
        tempInput.style.position = 'fixed';
        tempInput.style.opacity = '0';
        document.body.appendChild(tempInput);
        tempInput.select();
        const ok = document.execCommand('copy');
        tempInput.remove();
        return ok;
    } catch (e) {
        return false;
    }
}

function buildShareUrl() {
    let params = `?lang=${encodeURIComponent(currentLanguage)}`;
    if (currentReadingKind === 'juz' && currentJuzNumber) {
        params += `&juz=${encodeURIComponent(currentJuzNumber)}`;
    } else if (currentReadingKind === 'surah' && currentSurahOrder) {
        params += `&surah=${encodeURIComponent(currentSurahOrder)}&rewayah=${encodeURIComponent(selectedRewayahId || 'Qaloon')}`;
    }
    return `${window.location.origin}${window.location.pathname}${params}`;
}

async function handleShareClick() {
    const url = buildShareUrl();
    const ok = await copyTextToClipboard(url);
    const labelSpan = shareButton ? shareButton.querySelector('[data-lang-key="share"]') : null;
    const message = ok ? translations[currentLanguage].shareCopied : translations[currentLanguage].shareFailed;
    if (shareStatus) shareStatus.textContent = message;
    if (labelSpan) labelSpan.textContent = message;
    window.setTimeout(() => {
        if (shareStatus) shareStatus.textContent = '';
        if (labelSpan) labelSpan.textContent = translations[currentLanguage].share;
    }, 2000);
}

function filterSurahButtons() {
    if (!surahSearchInput || !surahButtonsContainer) return;
    const query = surahSearchInput.value.trim().toLowerCase();
    surahButtonsContainer.querySelectorAll('.surah-button').forEach(btn => {
        const searchKey = btn.dataset.searchKey || '';
        const matches = !query || searchKey.includes(query);
        btn.classList.toggle('hidden', !matches);
    });
}

// Focus trap + Escape for the mobile TOC drawer
function isFocusableInSidebar(el) {
    return el.matches('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
}

function handleTocSidebarKeydown(event) {
    if (event.key === 'Escape') {
        event.preventDefault();
        closeMobileToc();
        return;
    }
    if (event.key !== 'Tab') return;
    // Only trap focus while the mobile drawer is open; on desktop the sidebar is inline
    if (!tocSidebar.classList.contains('toc-mobile-visible')) return;

    const focusables = Array.from(tocSidebar.querySelectorAll('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    const visible = focusables.filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!visible.length) return;

    const first = visible[0];
    const last = visible[visible.length - 1];

    if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
    }
}

// Global keyboard shortcuts (ignored while typing in form controls or activating buttons)
function isShortcutSafeTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return false;
    return !target.isContentEditable;
}

function handleGlobalKeydown(event) {
    if (event.key === 'Escape') {
        if (verseActionsTarget) {
            event.preventDefault();
            hideVerseActions();
            return;
        }
        if (tocSidebar && tocSidebar.classList.contains('toc-mobile-visible')) {
            event.preventDefault();
            closeMobileToc();
        }
        return;
    }
    if (!isShortcutSafeTarget(event.target)) return;

    if (event.key === ' ') {
        if (audioPlayer.src) {
            event.preventDefault();
            if (audioPlayer.paused) {
                audioPlayer.play().catch(() => {});
            } else {
                audioPlayer.pause();
            }
        }
        return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        if (audioPlayer.src && audioPlayer.readyState) {
            event.preventDefault();
            skipTime(event.key === 'ArrowLeft' ? -10 : 10);
        }
        return;
    }

    if (event.key === '[' || event.key === ']') {
        const readingOpen = surahTextDisplayContainer && !surahTextDisplayContainer.classList.contains('hidden');
        if (readingOpen && currentSurahOrder) {
            event.preventDefault();
            const targetOrder = event.key === '[' ? currentSurahOrder - 1 : currentSurahOrder + 1;
            if (targetOrder >= 1 && targetOrder <= 114) {
                displaySurahText(selectedRewayahId || 'Qaloon', targetOrder);
            }
        }
    }
}
// END ADDITION

// --- Event Listeners ---

reciterSelect.addEventListener('change', () => { // MODIFIED: persist selection
    prefs.reciter = reciterSelect.value;
    savePrefs();
    clearAudioPos(); // ADDED: changing reciter resets the saved audio position
    updateAudioSource();
});
surahSelect.addEventListener('change', () => { // MODIFIED: persist selection
    prefs.surah = surahSelect.value;
    savePrefs();
    clearAudioPos(); // ADDED: changing surah resets the saved audio position
    updateAudioSource();
});

langButtons.forEach(button => {
    button.addEventListener('click', () => {
        const lang = button.getAttribute('data-lang');
        switchLanguage(lang);
    });
});

// Add listeners for sidebar navigation
sidebarNavButtons.forEach(button => {
    button.addEventListener('click', () => {
        const sectionId = button.getAttribute('data-section');
        // ADDED: opening the search section records it as a navigation
        if (sectionId === 'search-section' && appViewState.view !== 'search') {
            applyViewState({ view: 'search' }, 'push');
            return;
        }
        switchSection(sectionId);
        // switchSection no longer touches history, so record this navigation here.
        // Pushing (not replacing) keeps the entry the user came from - so Back
        // returns to the surah they were reading.
        if (sectionId !== 'readable-section' && appViewState.view !== 'selection') {
            appViewState = { view: 'selection' };
            syncUrl(false); // push
        }
    });
});

// ADDED: full-text search section wiring
const fullSearchInput = document.getElementById('full-search-input');
const fullSearchGoButton = document.getElementById('full-search-go');

function submitFullSearch() {
    const query = fullSearchInput ? fullSearchInput.value.trim() : '';
    if (!query) return;
    applyViewState({ view: 'search', q: query }, 'push');
}

if (fullSearchInput) {
    fullSearchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            submitFullSearch();
        }
    });
}
if (fullSearchGoButton) {
    fullSearchGoButton.addEventListener('click', submitFullSearch);
}

// Add listeners for skip buttons
skipBackwardButton.addEventListener('click', () => {
    skipTime(-10); // Skip back 10 seconds
});

skipForwardButton.addEventListener('click', () => {
    skipTime(10); // Skip forward 10 seconds
});

// ADDED: playback speed, loop, audio error handling
if (speedSelect) {
    speedSelect.addEventListener('change', () => {
        const rate = parseFloat(speedSelect.value);
        if (!isNaN(rate) && rate > 0) {
            audioPlayer.playbackRate = rate;
            prefs.speed = rate;
            savePrefs();
        }
    });
}

if (loopToggleButton) {
    loopToggleButton.addEventListener('click', () => {
        audioPlayer.loop = !audioPlayer.loop;
        if (audioPlayer.loop && sleepAtSurahEnd) clearSleepTimer();
        prefs.loop = audioPlayer.loop;
        savePrefs();
        updateLoopButtonState();
    });
}

audioPlayer.addEventListener('error', () => {
    if (audioPlayer.getAttribute('src') || audioPlayer.currentSrc) showAudioError();
});
audioPlayer.addEventListener('play', clearAudioError);
audioPlayer.addEventListener('canplay', clearAudioError);

// ADDED: Media Session state mirroring (lock-screen controls)
if ('mediaSession' in navigator) {
    audioPlayer.addEventListener('play', () => {
        navigator.mediaSession.playbackState = 'playing';
        updateMediaSessionPosition();
    });
    audioPlayer.addEventListener('pause', () => { navigator.mediaSession.playbackState = 'paused'; });
    audioPlayer.addEventListener('seeked', updateMediaSessionPosition);
    audioPlayer.addEventListener('ratechange', updateMediaSessionPosition);
}

// ADDED: sleep timer selection
if (sleepSelect) {
    sleepSelect.addEventListener('change', () => {
        const value = sleepSelect.value;
        sleepTimerEndsAt = null;
        sleepAtSurahEnd = false;
        sleepStatusMinutes = null;
        if (value === 'surah') {
            sleepAtSurahEnd = true;
            // audio.loop suppresses 'ended', which is the only place this timer
            // can fire - so the two cannot both be on.
            if (audioPlayer.loop) {
                audioPlayer.loop = false;
                prefs.loop = false;
                savePrefs();
                updateLoopButtonState();
            }
        } else if (value) {
            const minutes = parseInt(value, 10);
            if (minutes > 0) sleepTimerEndsAt = Date.now() + minutes * 60000;
        }
        renderSleepStatus();
    });
}

// ADDED: global keyboard shortcuts
document.addEventListener('keydown', handleGlobalKeydown);

// ADDED: mobile TOC drawer focus management
if (tocSidebar) {
    tocSidebar.addEventListener('keydown', handleTocSidebarKeydown);
}
// END ADDITION

backToSurahSelectButton.addEventListener('click', () => {
    // Check which section is currently active
    const activeReadableButton = document.querySelector('.readable-nav-button.active');
    const activeSectionId = activeReadableButton ? activeReadableButton.dataset.readableSection : 'full-quran';

    // Clear the displayed text and font class
    if (surahTextDisplay) surahTextDisplay.textContent = '';
    if (surahTextDisplayContainer) {
        surahTextDisplayContainer.className = Object.values(rewayahFontMap).reduce((acc, val) => acc.replace(val, ''), surahTextDisplayContainer.className).trim();
    }
    currentSurahOrder = null; // Reset tracker
    currentReadingKind = null; // ADDED
    currentReadingScrollKey = null;
    currentJuzNumber = null; // ADDED
    displayRequestSeq++; // ADDED: invalidate in-flight text loads

    // ADDED: back to the selection screen, as a history navigation
    applyViewState({ view: 'selection', sub: activeSectionId }, 'push');
});

// --- ADDED: Event Listeners for Surah Navigation ---
if (prevSurahButton) {
    prevSurahButton.addEventListener('click', () => {
        if (currentSurahOrder && currentSurahOrder > 1) {
            const prevOrder = currentSurahOrder - 1;
            if (selectedRewayahId) { // Ensure a rewayah is selected
                applyViewState({ view: 'surah', surah: prevOrder, rewayah: selectedRewayahId }, 'push');
            } else {
                console.error("Cannot navigate: Rewayah not selected.");
            }
        }
    });
}

if (nextSurahButton) {
    nextSurahButton.addEventListener('click', () => {
        if (currentSurahOrder && currentSurahOrder < 114) {
            const nextOrder = currentSurahOrder + 1;
            if (selectedRewayahId) { // Ensure a rewayah is selected
                applyViewState({ view: 'surah', surah: nextOrder, rewayah: selectedRewayahId }, 'push');
            } else {
                console.error("Cannot navigate: Rewayah not selected.");
            }
        }
    });
}
// --- END ADDITION ---

// --- ADDED: PDF.js Navigation Listeners ---
if (pdfPrevButton) {
    pdfPrevButton.addEventListener('click', onPrevPage);
}
if (pdfNextButton) {
    pdfNextButton.addEventListener('click', onNextPage);
}
if (pdfPrevSideButton) {
    pdfPrevSideButton.addEventListener('click', onPrevPage);
}
if (pdfNextSideButton) {
    pdfNextSideButton.addEventListener('click', onNextPage);
}
if (pdfGoToPageButton) {
    pdfGoToPageButton.addEventListener('click', goToPage);
}
// Add listener for Enter key in the input field
if (pdfPageInput) {
    pdfPageInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent potential form submission
            goToPage();
        }
    });
}

// The download button's handler is assigned per-document as an .onclick inside
// loadPdfDocument, which is what binds the correct URL.
// A blanket addEventListener here fired first and passed the click Event as the
// `urlToDownload` argument, throwing a TypeError on every download click before
// the real handler ran. Intentionally not re-added.

// ADDED: TOC Header (Surah List) Listener
if (tocHeader) {
    tocHeader.addEventListener('click', () => {
        if (currentPdfUrl !== mainPdfUrl) { // Only load if not already viewing main PDF
            loadPdfDocument(mainPdfUrl);
        }
    });
}

// --- ADDED: Mobile TOC Event Listeners ---
if (hamburgerTocButton) {
    hamburgerTocButton.addEventListener('click', () => {
        // Check if sidebar is currently visible
        if (tocSidebar && tocSidebar.classList.contains('toc-mobile-visible')) {
            closeMobileToc();
        } else {
            openMobileToc();
        }
    });
}

if (tocOverlay) {
    tocOverlay.addEventListener('click', closeMobileToc); // Close when clicking overlay
}
// --- END ADDITION ---

// --- ADDED: search / share / font size / resume listeners ---
if (surahSearchInput) {
    surahSearchInput.addEventListener('input', filterSurahButtons);
}

if (shareButton) {
    shareButton.addEventListener('click', handleShareClick);
}

if (fontDecreaseButton) {
    fontDecreaseButton.addEventListener('click', () => applyFontScale(prefs.fontScale - FONT_SIZE_STEP));
}
if (fontResetButton) {
    fontResetButton.addEventListener('click', () => applyFontScale(1));
}
if (fontIncreaseButton) {
    fontIncreaseButton.addEventListener('click', () => applyFontScale(prefs.fontScale + FONT_SIZE_STEP));
}

if (resumeReadingButton) {
    resumeReadingButton.addEventListener('click', resumeReading);
}

// --- ADDED: verse actions + bookmarks ---
if (surahTextDisplay) {
    surahTextDisplay.addEventListener('click', handleVerseTap);
}
if (verseBookmarkButton) {
    verseBookmarkButton.addEventListener('click', () => {
        if (!verseActionsTarget) return;
        const { surah, verse, rewayah } = verseActionsTarget;
        const added = toggleBookmark(surah, verse, rewayah);
        if (readingStatus) {
            readingStatus.textContent = added
                ? translations[currentLanguage].bookmarkAdded
                : translations[currentLanguage].bookmarkRemoved;
        }
        hideVerseActions();
    });
}
if (verseCopyButton) {
    verseCopyButton.addEventListener('click', copyCurrentVerse);
}
if (juzReadToggle) {
    juzReadToggle.addEventListener('click', () => {
        if (currentReadingKind !== 'juz' || !currentJuzNumber) return;
        const juz = currentJuzNumber;
        const read = toggleJuzRead(juz);
        if (readingStatus) {
            const key = read ? 'juzMarkedRead' : 'juzMarkedUnread';
            readingStatus.textContent = translations[currentLanguage][key].replace('{n}', localeNum(juz));
        }
    });
}
if (khatmaContinueButton) {
    khatmaContinueButton.addEventListener('click', () => {
        const next = parseInt(khatmaContinueButton.dataset.juzNumber, 10);
        if (next >= 1 && next <= 30) applyViewState({ view: 'juz', juz: next }, 'push');
    });
}
if (khatmaResetButton) {
    khatmaResetButton.addEventListener('click', () => {
        prefs.juzRead = [];
        savePrefs();
        renderKhatma();
        updateJuzReadToggle();
    });
}
if (versePlayButton) {
    versePlayButton.addEventListener('click', () => {
        if (!verseActionsTarget) return;
        const verse = verseActionsTarget.verse;
        hideVerseActions();
        playVerseAudio(verse);
    });
}
if (verseAudioToggle) {
    verseAudioToggle.addEventListener('click', () => {
        if (verseAudio.verse) stopVerseAudio();
        else playVerseAudio(1);
    });
}
if (verseAudioPlay) {
    verseAudioPlay.addEventListener('click', () => {
        if (!versePlayer) return;
        if (versePlayer.paused) versePlayer.play().catch(() => {});
        else versePlayer.pause();
    });
}
if (verseAudioPrev) {
    verseAudioPrev.addEventListener('click', () => {
        if (verseAudio.verse > 1) playVerseAudio(verseAudio.verse - 1);
    });
}
if (verseAudioNext) {
    verseAudioNext.addEventListener('click', () => {
        if (verseAudio.verse < verseAudio.total) playVerseAudio(verseAudio.verse + 1);
    });
}
if (verseAudioStop) {
    verseAudioStop.addEventListener('click', stopVerseAudio);
}
if (verseAudioAb) {
    verseAudioAb.addEventListener('click', cycleAbLoop);
}
if (verseAudioRepeat) {
    verseAudioRepeat.addEventListener('change', () => {
        // applies from the next play of the current verse
        verseAudio.playsLeft = repeatCount();
    });
}
// The whole-surah player and the verse player must never sound together.
audioPlayer.addEventListener('play', () => {
    if (verseAudio.verse) stopVerseAudio();
});
// A different reciter means different per-ayah files.
reciterSelect.addEventListener('change', () => {
    renderVerseAudioBar();
    if (verseAudio.verse) {
        const resumeAt = verseAudio.verse;
        stopVerseAudio();
        playVerseAudio(resumeAt);
    }
});
if (openPdfEditionButton) {
    openPdfEditionButton.addEventListener('click', () => applyViewState({ view: 'pdf' }, 'push'));
}
if (bookmarksToggle) {
    bookmarksToggle.addEventListener('click', () => {
        const open = bookmarksList.classList.toggle('hidden');
        bookmarksToggle.setAttribute('aria-expanded', String(!open));
    });
}
// A tap anywhere else, or any scroll, dismisses the verse popover.
document.addEventListener('click', (event) => {
    if (!verseActionsTarget) return;
    if (verseActions.contains(event.target) || surahTextDisplay.contains(event.target)) return;
    hideVerseActions();
});
window.addEventListener('scroll', () => {
    if (verseActionsTarget) hideVerseActions();
}, { passive: true });
// --- END ADDITION ---
// --- END ADDITION ---

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    console.info('[Hasana] build', APP_VERSION);
    // NOTE: parse URL params first - the history.replaceState calls below
    // rewrite window.location.search, which would destroy unread deep-link params
    const urlParams = new URLSearchParams(window.location.search);
    const deepJuz = parseInt(urlParams.get('juz'), 10);
    const deepSurah = parseInt(urlParams.get('surah'), 10);
    const deepRewayah = urlParams.get('rewayah');
    const deepVerse = parseInt(urlParams.get('verse'), 10);
    const deepQuery = urlParams.get('q');

    // Set initial lang/dir based on detection *before* populating/setting text
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === 'ar' ? 'rtl' : 'ltr';

    // Populate reciters immediately
    populateReciters(currentLanguage);

    // Fetch the SINGLE combined data file
    await fetchQuranData(); // <<< CHANGED: Call the new fetch function

    // Now that data is fetched, populate other elements that depend on it
    // Populate Surahs for audio player select (already called in fetchQuranData callback)
    // Populate Rewayah selector (static for now)
    // populateRewayahSelect(currentLanguage); // Called by showSurahSelectionUI when needed
    
    // Set initial language button state
    langButtons.forEach(button => {
        if (button.getAttribute('data-lang') === currentLanguage) {
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true'); // ADDED
        } else {
            button.classList.remove('active');
            button.setAttribute('aria-pressed', 'false'); // ADDED
        }
    });

    // ADDED: initial aria-current on the readable (full/divided) toggle
    document.querySelectorAll('.readable-nav-button').forEach(btn => {
        if (btn.classList.contains('active')) {
            btn.setAttribute('aria-current', 'true');
        } else {
            btn.removeAttribute('aria-current');
        }
    });
    
    // Ensure initial label text is set correctly
    translatableElements.forEach(el => {
        const key = el.getAttribute('data-lang-key');
        if (translations[currentLanguage] && translations[currentLanguage][key]) {
            if (el.tagName === 'META') {
                el.setAttribute('content', translations[currentLanguage][key]);
            } else if (el.id === 'back-to-surah-select') {
                el.textContent = translations[currentLanguage][key];
                el.setAttribute('lang', currentLanguage);
            } else if (el === readablePlaceholder && currentLanguage === 'ar') {
                // Skip direct text set
            } else {
                el.textContent = translations[currentLanguage][key];
                if (el.tagName !== 'TITLE') el.setAttribute('lang', currentLanguage);
            }
        }
    });

    // --- ADDED: restore persisted preferences (after data fetch + populate) ---
    if (prefs.reciter && reciters.some(r => r.id === prefs.reciter)) {
        reciterSelect.value = prefs.reciter;
    }
    if (prefs.surah && quranData.surahs && quranData.surahs.some(s => String(s.order) === String(prefs.surah))) {
        surahSelect.value = String(prefs.surah);
    }
    if (prefs.selectedRewayahId && prefs.selectedRewayahId !== ENGLISH_REWAYAH
        && isKnownEdition(prefs.selectedRewayahId)) {
        lastArabicEdition = prefs.selectedRewayahId; // survives a reload
    }
    if (prefs.selectedRewayahId && isKnownEdition(prefs.selectedRewayahId)) {
        selectedRewayahId = prefs.selectedRewayahId;
    }
    if (speedSelect && !isNaN(parseFloat(prefs.speed))) {
        speedSelect.value = String(prefs.speed);
        audioPlayer.playbackRate = parseFloat(speedSelect.value) || 1;
    }
    audioPlayer.loop = !!prefs.loop;
    updateLoopButtonState();
    applyFontScale(prefs.fontScale);
    updateAudioSource();
    setupMediaSession();
    renderBookmarks();
    renderKhatma();
    updateDynamicLanguage(currentLanguage);
    // --- END ADDITION ---

    // --- session continuity: restore audio position (no autoplay) ---
    loadAudioPos();
    if (audioPos && audioPos.reciterId === reciterSelect.value && String(audioPos.surahOrder) === String(surahSelect.value)) {
        resumeSeekPending = true; // seek once loadedmetadata fires
    }
    updateAudioResumeHint();

    // --- session continuity: restore last view (URL deep links win over stored state) ---
    // NOTE: switchSection() now resets prefs.ui.view when leaving the readable section,
    // so no default section switch may run before this block reads the stored view.
    let initial = null;
    if (!isNaN(deepJuz) && deepJuz >= 1 && deepJuz <= 30) {
        initial = { view: 'juz', juz: deepJuz };
    } else if (!isNaN(deepSurah) && deepSurah >= 1 && deepSurah <= 114) {
        initial = { view: 'surah', surah: deepSurah, rewayah: (deepRewayah && isKnownEdition(deepRewayah)) ? deepRewayah : null };
        if (!isNaN(deepVerse) && deepVerse >= 1 && deepVerse <= 286) {
            pendingVerseScroll = deepVerse; // consume after the surah text loads
        }
    } else if (deepQuery) {
        if (deepRewayah && isKnownEdition(deepRewayah)) {
            selectedRewayahId = deepRewayah; // search honors the shared ?rewayah= param
        }
        initial = { view: 'search', q: deepQuery };
    } else if (prefs.ui && prefs.ui.view === 'juz' && prefs.readingState && prefs.readingState.kind === 'juz') {
        initial = { view: 'juz', juz: prefs.readingState.id };
    } else if (prefs.ui && prefs.ui.view === 'surah' && prefs.readingState && prefs.readingState.kind === 'surah') {
        initial = { view: 'surah', surah: prefs.readingState.id, rewayah: prefs.readingState.rewayahId };
    } else if (prefs.ui && prefs.ui.view === 'pdf') {
        initial = { view: 'pdf', pdfPage: prefs.pdf ? prefs.pdf.page : 1 };
    }

    if (initial) {
        applyViewState(initial, 'replace');
    } else {
        // No reading state to restore: restore the last top-level section
        const restoredSection = (prefs.ui && prefs.ui.section === 'readable-section') ? 'readable-section' : 'audible-section';
        switchSection(restoredSection);
        appViewState = { view: 'selection' };
        syncUrl(true);
    }
    // --- END ADDITION ---
}); 

// ADDED: Function to handle Go To Page button click
function goToPage() {
    if (!pdfDoc || !pdfPageInput) {
        return;
    }

    const requestedValue = pdfPageInput.value;
    const requestedPage = parseInt(requestedValue, 10);

    if (
        !isNaN(requestedPage) &&
        requestedPage >= 1 &&
        requestedPage <= pdfDoc.numPages
    ) {
        if (requestedPage !== pdfPageNum) {
            pdfPageNum = requestedPage;
            queueRenderPage(pdfPageNum);
        }
    } else {
        // Invalid page number: revert to current page number
        console.warn(`Invalid page number requested: ${requestedValue}, Total pages: ${pdfDoc.numPages}`);
        pdfPageInput.value = pdfPageNum;
    }
}

// ADDED: Function to handle PDF download click
function handlePdfDownload(urlToDownload) {
    if (isDownloadButtonDisabled) {
        return;
    }

    // Create a temporary anchor element
    const link = document.createElement('a');
    link.href = urlToDownload;
    
    // Extract filename or set a default
    const filename = urlToDownload.substring(urlToDownload.lastIndexOf('/') + 1) || "download.pdf";
    link.download = filename; 
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Disable button and set cooldown
    if(pdfDownloadButton) pdfDownloadButton.disabled = true;
    isDownloadButtonDisabled = true;

    setTimeout(() => {
        if(pdfDownloadButton) pdfDownloadButton.disabled = false;
        isDownloadButtonDisabled = false;
    }, downloadCooldown);
}

// Function to populate Juz buttons
function populateJuzButtons() {
    const juzGrid = document.querySelector('.juz-grid');
    if (!juzGrid) return;

    juzGrid.innerHTML = ''; // Clear existing buttons

    // Create 30 Juz buttons
    for (let i = 1; i <= 30; i++) {
        const button = document.createElement('button');
        button.classList.add('juz-button');
        button.dataset.juzNumber = i;
        button.textContent = `الجزء ${i}`; // Arabic numbering
        button.addEventListener('click', () => {
            // Load the Juz file directly from Written/Ajzaa/ folder
            applyViewState({ view: 'juz', juz: i }, 'push');
        });

        juzGrid.appendChild(button);
    }
    renderKhatma(); // paint the read state onto the freshly built grid
}

// Function to display Juz text from the Ajzaa folder
async function displayJuzText(juzNumber) {
    resetReadingPlayback(); // a new text invalidates any running recitation
    // Update current Surah tracker (set to null since we're displaying a Juz, not a specific Surah)
    currentSurahOrder = null;
    currentReadingKind = 'juz'; // ADDED
    currentJuzNumber = parseInt(juzNumber, 10); // ADDED
    const requestSeq = ++displayRequestSeq; // ADDED: invalidate any in-flight load
    pendingVerseScroll = null; // a Juz has no deep-linked verse; don't inherit one from a surah
    clearVerseHighlight(); // cancel any pending fade-restore from the previous surah

    const loadingKey = translations[currentLanguage].loading;
    surahTextDisplay.setAttribute('aria-busy', 'true'); // ADDED
    if (readingStatus) readingStatus.textContent = loadingKey; // announce to screen readers

    // Reveal the reading view and placeholder immediately (see displaySurahText).
    showSurahTextUI();
    showReadingSkeleton();

    const basmalaDisplayElement = document.getElementById('basmala-display');
    const surahTitleDisplayElement = document.getElementById('surah-display-title');

    // Hide basmala for Juz display
    basmalaDisplayElement.classList.add('hidden');
    // ...and the title too: it still holds the previously-read surah's name,
    // which would otherwise sit above the placeholder for the whole load.
    surahTitleDisplayElement.classList.add('hidden');

    const juzFilePath = `Written/Ajzaa/${juzNumber}.txt`;
    const fontReady = primeMushafFont(); // download the mushaf font alongside the verse-text fetch below
    // Juz text is always Hafs - apply it up front so the load never paints in
    // whichever rewayah font the previously-read surah left on the container.
    Object.values(rewayahFontMap).forEach((c) => surahTextDisplayContainer.classList.remove(c));
    surahTextDisplayContainer.classList.add('font-hafs');

    try {
        const response = await fetch(juzFilePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for ${juzFilePath}`);
        }
        const text = await response.text();
        if (requestSeq !== displayRequestSeq) return; // ADDED: stale load, ignore

        // Set title for Juz
        surahTitleDisplayElement.textContent = `الجزء ${juzNumber}`;
        surahTitleDisplayElement.classList.remove('hidden');

        // Apply font class for proper verse number styling (same as full Quran)
        surahTextDisplayContainer.className = 'surah-text-display-container';
        // Apply a default font class for proper verse number rendering
        surahTextDisplayContainer.classList.add('font-hafs'); // or whichever font you prefer

        // Display the Juz text
        surahTextDisplay.textContent = withAyahMarks(text.trim());
        surahTextDisplay.lang = 'ar';
        surahTextDisplay.dir = 'rtl';
        surahTextDisplay.setAttribute('aria-busy', 'false'); // ADDED

        // ADDED: announce completion politely + persist resume state
        if (readingStatus) readingStatus.textContent = translations[currentLanguage].juzLoaded.replace('{n}', juzNumber);
        prefs.readingState = { kind: 'juz', id: parseInt(juzNumber, 10) };
        prefs.ui.view = 'juz';
        savePrefs();

        // Show navigation header but hide prev/next buttons, only show back button
        if (surahNavigationHeader) {
            surahNavigationHeader.classList.remove('hidden');
            // Hide prev/next buttons for Juz display
            if (prevSurahButton) prevSurahButton.classList.add('hidden');
            if (nextSurahButton) nextSurahButton.classList.add('hidden');
            // Show back button
            if (backToSurahSelectButton) backToSurahSelectButton.classList.remove('hidden');
        }

        showSurahTextUI(); // Switch to the text view

        // Hold the placeholder until the Hafs OTF is usable, then restore scroll
        // against the final layout (see displaySurahText for the reasoning).
        await fontReady;
        if (requestSeq !== displayRequestSeq) return; // superseded while waiting on the font
        hideReadingSkeleton();

        currentReadingScrollKey = `juz-${juzNumber}`;
        restoreReadingScroll(currentReadingScrollKey);

    } catch (error) {
        if (requestSeq !== displayRequestSeq) return; // ADDED: stale load, ignore
        console.error(`Could not fetch or display Juz ${juzNumber} from ${juzFilePath}:`, error);
        hideReadingSkeleton(); // otherwise the placeholder animates over a failed load forever
        surahTextDisplay.textContent = translations[currentLanguage].juzLoadError.replace('{n}', juzNumber);
        surahTextDisplay.setAttribute('aria-busy', 'false'); // ADDED
        if (readingStatus) readingStatus.textContent = translations[currentLanguage].juzLoadError.replace('{n}', juzNumber);
        surahTitleDisplayElement.classList.add('hidden'); 
        basmalaDisplayElement.classList.add('hidden');
        // Hide nav header on error
        if (surahNavigationHeader) {
            surahNavigationHeader.classList.add('hidden');
        }
    }
}

// Modify the existing switchReadableSection function to handle the new readable toggle
function switchReadableSection(sectionId) {
    const readableToggleButtons = document.querySelectorAll('.readable-nav-button');
    const fullQuranContainer = document.getElementById('surah-buttons-container');
    const dividedQuranContainer = document.getElementById('divided-quran-container');
    const rewayahSelectorContainer = document.getElementById('rewayah-selector-container');

    // The Full/Divided toggle belongs to the Arabic mushaf view; ignore clicks in English
    if (currentLanguage === 'en') return;

    // Removing active class from all buttons
    readableToggleButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current'); // ADDED
    });

    // Find and activate the clicked button
    const activeButton = Array.from(readableToggleButtons).find(btn => btn.dataset.readableSection === sectionId);
    if (activeButton) {
        activeButton.classList.add('active');
        activeButton.setAttribute('aria-current', 'true'); // ADDED
    }

    // Hide all containers first
    if (fullQuranContainer) fullQuranContainer.classList.add('hidden');
    if (dividedQuranContainer) dividedQuranContainer.classList.add('hidden');
    if (rewayahSelectorContainer) rewayahSelectorContainer.classList.add('hidden');
    if (surahSearchWrap) surahSearchWrap.classList.add('hidden'); // ADDED

    // If a Surah/Juz text is currently displayed, return to the section's selection screen
    if (surahTextDisplayContainer) surahTextDisplayContainer.classList.add('hidden');
    if (surahNavigationHeader) surahNavigationHeader.classList.add('hidden');
    currentSurahOrder = null; // ADDED: reset tracker when leaving the reading view
    currentReadingKind = null; // ADDED
    currentReadingScrollKey = null;
    currentJuzNumber = null; // ADDED
    displayRequestSeq++; // ADDED: invalidate in-flight text loads

    // Show the selected container
    if (sectionId === 'full-quran') {
        if (fullQuranContainer) fullQuranContainer.classList.remove('hidden');
        if (rewayahSelectorContainer) rewayahSelectorContainer.classList.remove('hidden');
        if (surahSearchWrap) surahSearchWrap.classList.remove('hidden'); // ADDED
        populateReadableSurahButtons(); // Existing function to populate full Quran buttons
        filterSurahButtons(); // ADDED
        populateRewayahButtons(); // Show Rewayah buttons for full Quran
    } else if (sectionId === 'divided-quran') {
        if (dividedQuranContainer) dividedQuranContainer.classList.remove('hidden');
        // Don't show Rewayah selector for Juz section
        populateJuzButtons(); // New function to populate Juz buttons
    }
    updateResumeButton(); // ADDED
    prefs.ui.view = 'selection'; // ADDED: session restore knows we left the reading view
    savePrefs(); // ADDED
}

// Add event listeners for the new readable toggle buttons
document.addEventListener('DOMContentLoaded', () => {
    const readableToggleButtons = document.querySelectorAll('.readable-nav-button');
    readableToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionId = button.dataset.readableSection;
            applyViewState({ view: 'selection', sub: sectionId }, 'push');
        });
    });
}); 
// Manual theme toggle (light / dark override; defaults to system preference)
try {
    const themeToggleButton = document.getElementById('theme-toggle');
    if (themeToggleButton) {
        const isDark = () => {
            const saved = document.documentElement.getAttribute('data-theme');
            if (saved) return saved === 'dark';
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        };
        themeToggleButton.addEventListener('click', () => {
            const next = isDark() ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try {
                localStorage.setItem('hasana-theme', next);
            } catch (e) {
                // storage unavailable
            }
        });
    }
} catch (e) {
    console.warn('Theme toggle unavailable:', e);
}

// --- session continuity: audio position capture ---
audioPlayer.addEventListener('timeupdate', () => {
    checkSleepTimer();
    const now = Date.now();
    if (now - lastAudioPosSaved < 5000) return; // throttle to every ~5s
    lastAudioPosSaved = now;
    saveAudioPos();
});
audioPlayer.addEventListener('pause', saveAudioPos);
audioPlayer.addEventListener('ended', () => {
    clearAudioPos();
    // "End of surah" sleep timer: stop here instead of auto-advancing.
    if (sleepAtSurahEnd) {
        clearSleepTimer({ message: translations[currentLanguage].sleepDone });
        return;
    }
    // Advance the audio selection, not the reading view (currentSurahOrder).
    // audio.loop suppresses 'ended', so looping never reaches here.
    playAudioSurah(parseInt(surahSelect.value, 10) + 1);
});
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveAudioPos();
});
window.addEventListener('pagehide', saveAudioPos);

// Resume the saved position once the restored audio source is ready
audioPlayer.addEventListener('loadedmetadata', () => {
    if (resumeSeekPending && audioPos && isFinite(audioPos.time)) {
        resumeSeekPending = false;
        try {
            audioPlayer.currentTime = Math.min(audioPos.time, audioPlayer.duration - 1 || 0);
        } catch (e) {
            // seeking failed; ignore
        }
    }
    updateAudioResumeHint();
    updateMediaSessionPosition();
});
const audioResumeButton = document.getElementById('audio-resume-button');
if (audioResumeButton) {
    audioResumeButton.addEventListener('click', () => {
        if (audioPos && isFinite(audioPos.time)) {
            try {
                audioPlayer.currentTime = audioPos.time;
            } catch (e) {
                // seeking failed; ignore
            }
            audioPlayer.play().catch(() => {
                // play blocked (autoplay policy); the user can press the native play button
            });
        }
    });
}

// --- multi-tab sync: theme + user prefs ---
window.addEventListener('storage', (event) => {
    if (event.key === 'hasana-theme') {
        const value = event.newValue;
        if (value === 'light' || value === 'dark') {
            document.documentElement.setAttribute('data-theme', value);
        }
        return;
    }
    if (event.key !== PREFS_KEY) return;
    try {
        const incoming = event.newValue ? JSON.parse(event.newValue) : null;
        if (!incoming) return;
        applyingRemotePrefs = true; // suppress the write-back echo for everything below
        if (incoming.language && (incoming.language === 'ar' || incoming.language === 'en') && incoming.language !== currentLanguage) {
            switchLanguage(incoming.language);
        }
        if (quranData && quranData.surahs) {
            // Decide whether the audio actually needs re-pointing BEFORE touching the
            // selects. Assigning audioPlayer.src re-runs the media load algorithm even
            // for an identical URL, resetting playback to 0 - and this listener fires on
            // EVERY prefs write from another tab, including the scroll debounce's every
            // 400ms. Re-pointing unconditionally made audio restart while another tab scrolled.
            const reciterChanged = incoming.reciter
                && reciters.some(r => r.id === incoming.reciter)
                && reciterSelect.value !== incoming.reciter;
            const surahChanged = incoming.surah
                && quranData.surahs.some(s => String(s.order) === String(incoming.surah))
                && surahSelect.value !== String(incoming.surah);

            if (reciterChanged) reciterSelect.value = incoming.reciter;
            if (surahChanged) surahSelect.value = String(incoming.surah);
            if (isKnownEdition(incoming.selectedRewayahId)) selectedRewayahId = incoming.selectedRewayahId;
            if (speedSelect && !isNaN(parseFloat(incoming.speed))) {
                speedSelect.value = String(incoming.speed);
                audioPlayer.playbackRate = parseFloat(incoming.speed) || 1;
            }
            audioPlayer.loop = !!incoming.loop;
            updateLoopButtonState();
            applyFontScale(incoming.fontScale || 1);
            if (reciterChanged || surahChanged) updateAudioSource();
        }
        if (incoming.language) prefs.language = incoming.language;
    } catch (e) {
        // malformed payload; ignore
    } finally {
        applyingRemotePrefs = false;
    }
});

// --- service worker: offline app shell ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // SW unsupported or blocked; the app works fine without it
        });
    });
}
