# English translation: ClearQuran (Allah Edition), Talal Itani

The files in this directory are **not** covered by the repository's MIT licence.

- Translator / rights holder: Talal Itani
- Edition: Clear Quran (Allah Edition), last updated by the translator 9 October 2026
- Licence: CC BY-ND 4.0 - https://creativecommons.org/licenses/by-nd/4.0/
- Source: https://blog.clearquran.com/download (file: https://d.clearquran.com/text/clearquran-allah-edition.txt)
- Source file SHA-256 (as imported 2026-10-16): `138b00041d6013f2dd96e84038529044da53748e8c534942af37edd2a4ca3eb5`

## Required credit

> Translation by Talal Itani, ClearQuran.com

Shown in the app's English reading view. Keep it there.

## What the grant allows

The translator's download page grants free use, storage, conversion and
distribution, including commercial, with no permission required, on two
conditions: the wording of the translation is unchanged, and the source is
credited. It additionally permits reformatting, converting and splitting long
verses - that is what this import does.

## What we did to the text

The source ships as `surah|ayah|text` lines. The import splits it into one file
per surah (`<surah>.txt`), one verse per line, in verse order. **No word of the
translation was changed, added or removed.** The no-derivatives condition means
any future tooling must not rewrite the wording - including punctuation.
Re-import with `Scripts/import_clearquran.py` rather than hand-editing.

## Known conflict, and why we judged it safe

An older 2012 PDF on the same site carries an "all rights reserved" notice. The
current download page states it supersedes older readme/licence text. A dated
copy of that page is kept in `docs/clearquran-grant-2026-10-16.md`, and the
translator confirmed the grant in writing on 2026-10-16, so it no longer rests
on a published page alone.

## Naming

Call it "ClearQuran, Talal Itani". Do **not** call it "The Clear Quran": that is
a different, trademarked translation by Dr. Mustafa Khattab.
