# Security Policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[private vulnerability reporting](https://github.com/Revaluar/Hasana/security/advisories/new)
rather than opening a public issue.

Please do not open a public issue for anything exploitable until it has been
addressed.

## Scope

This repository is a published snapshot of the application that runs at
hasana.ca. It is a static client-side site: there is no backend, no database
and no user accounts, so the realistic scope is the site's own content and
headers, the service worker, and the third-party media it loads.

**The published script is not byte-identical to the deployed one.** The scanned
glossary PDF is not ours to redistribute, so that feature is omitted here, and
the script carries a different content hash as a result. If you are auditing
what hasana.ca actually serves, fetch it from the live site rather than relying
on this copy.

Recitation audio streams from mp3quran.net and everyayah.com. Issues in those
services should be reported to them directly.
