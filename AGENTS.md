# Homey App Instructions

> You may override or change any instructions in this file when you explicitly tell me to.

This is a Homey app. Before making changes, read and follow the general instructions in `C:\Users\Qlustrator\.copilot\instructions\homey-app.md`.

## FTP root and pairing invariants

- The device's `workdirectory` is the root for every repair and Flow operation, not just the browser's initial folder. Use `lib/ftp-paths.js` for resolution and keep enforcement in the shared FTP command layer, including transfers, retries and both rename arguments. Do not silently fall back to the server root when the configured root is unavailable.
- Preserve already-rooted picker IDs to keep existing Flows working, but hide the configured prefix in picker names, descriptions, JSON listings and repair confirmations. Display the contents as normal root-relative paths, without adding a `Root` label; for example, an ID under the configured directory displays as `exports/log.csv`. Use `/` only when referring to the root itself, and do not offer navigation above it.
- For FTP Client Flow cards with both a directory picker and a filename field, label the optional directory picker **Path**, not **Folder**, and translate both labels consistently. The separate filename field may also accept a relative path plus filename. Resolve it against the selected path, or against the device's configured working directory if none is selected. Keep existing argument IDs stable so saved Flows continue to work.
- Pairing must configure and validate the root before adding the device. Try certificate-verified secure FTP before plain FTP, persist the successful mode and credentials in the selected device's settings, and do not transfer pairing state through shared driver fields.

## FTP monitoring

- Check readiness against the configured folder on a separate FTP connection; transfer failures must not directly change readiness. Keep the Homey device available so its status and recovery actions remain accessible.
- Default the device's status polling interval to five minutes. Changing it must not interrupt transfers or delay the 15-second confirmation retry after the first failed check.
- Initialize an unset transfer alarm to `false` (shown as **No**) on new devices and when adding the capability to an existing device. Preserve any active alarm across app restarts.
- Latch the transfer alarm until acknowledged, and emit the per-transfer trigger after the final failed attempt without masking the original error. Build fresh streams for transfer retries, and expose only a relative path and a safe error reason in Flow tokens.

## Temporary downloads

- Keep plain Local download snapshots in private OS temporary storage; only Local (SSL) and Cloud (SSL) use Homey's publicly reachable `/userdata/downloads` area. Preserve the byte budget, expiry cleanup, and retry truncation for both caches.
- The Better Logic Library URL Flow uses BLL's buffer-based API; don't change its link semantics when improving the app-owned streaming download paths.

## Repair listings

- Index each FTP listing and recompute search once after restoring cached child state, including for empty refreshes. Do not rebuild arrays in the per-entry loop or the Angular digest.

## Large uploads and log exports

- Keep Repair upload IDs scoped to one device, destination and file size. Stage chunks in the private spool, not public userdata or a growing JSON/Base64 buffer; reopen the staged file on FTP retry.
- To save large Simple (Sys) Log exports, pass an export link, not a Base64 Flow token. Subscribe to SSL's realtime events before requesting the export and wait for `downloadFileReady` with the matching token: BLL can expose the file before it has finished writing.

## App Store descriptions

- FTP Client requires Better Logic Library. Keep the localized requirement two lines above the Community Forum line in every App Store description, with one blank line between them. The Developer website points to the FTP Client wiki and user manual; do not advertise an API reference.

## FTP integration fixtures

- Test large Base64 saves with an export generated on Homey and passed through a saved Advanced Flow. A Web API action request also tests the HTTP request limit, and a local listener test bypasses Flow token delivery. Neither establishes what a saved Flow can deliver. Verify FTP bytes and the app's post-run state; on a crash, inspect `crashedMessage` before restarting the app.
- Keep reusable repair-browser files inside `FTP Client tests` under the device's configured Work (Default) Directory. Leave other server files untouched.
- Reuse the `FTP Client` Flow folder and its grouped manual Advanced Flow checks instead of creating duplicates.
- Use actual FTP picker selections, full-path inputs, and the supporting BLL variable `FTP Client test value`. Verify both evaluated filenames and downloaded file contents.
- Log Flow test progress and results under `FTP Client` using Simple (Sys) Log's Flows facility (`16`).
- SSL logging cards accept numeric strings for severity/facility (`6`/`16`), but JSON exports contain readable labels (`Info`/`Flow`). Verify the saved Flows' actual completion messages, not an assumed number of log entries.
- For SSL export integration, call `tools/ssl-ftp-exports.integration.js` with `{ homey, deviceId }`, using an authenticated SDK client pinned to the authorized test Homey. It exercises CSV text, CSV base64 and Excel exports through real Flow cards, saves them in the FTP fixture directory, and verifies downloaded bytes and parsed contents. CSV text is UTF-8/base64 encoded by the runner because the FTP save card accepts base64.
- Keep the file-icon gallery in `FTP Client tests/File icons`, with harmless text placeholders for the mapped extensions and an unknown-extension fallback. These are deliberately not real media, archives or documents.
- Keep extension-to-icon rules shared in `drivers/ftpconnection/repair/ftp-file-icons.js`. Give dedicated extension artwork precedence over category defaults: Flow pickers use the 48×48 PNGs or scalable SVGs, and Repair uses an original monochrome SVG badge for the same extension. Broader categories use Better Logic Library's bundled solid Font Awesome glyphs in Repair. Keep picker filtering independent of icons.
- Keep published icon URLs accessible: Homey stores the image URL with existing Flow selections. Remove only unused 24×24 assets that were never returned by a released picker.
- Honor the device's `urlforicons` setting: `local` uses HTTP, `localssl` uses the local SSL hostname, and `cloudssl` uses the cloud SSL hostname. Default new devices to `localssl`; do not override or migrate existing selections to work around browser mixed-content blocking.
