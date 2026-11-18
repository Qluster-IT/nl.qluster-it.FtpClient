# Ftp Client

This App let's you control any FTP Server directly from your Homey, in a directory based UI.
You can Add, Rename, Move and Delete folders and files directly from the Homey App or Web App, anywhere you want!

You can also Download files anywhere on the Homey Web App or with the Homey Mobile App, secure, without opening ports or firewalls!

To drag and drop, first select a folder or file, then drag it. Unselected items
can be swiped to scroll. Moving a file or folder asks for confirmation.
Click right-click or press/tab-long on items for a contextmenu.

Folder refreshes preserve expanded subfolders. Failed changes and uploads show
an error so they can be retried. Renaming or deleting the folder currently being
browsed returns to its parent.

Use **Search this folder** to filter files and folders by name without another
FTP request. Search does not include subfolders and resets when you navigate.

Repair downloads use temporary storage on Homey instead of keeping entire
files in the app's memory. Links expire after the device's **Download Time**.
The shared temporary download cache is limited to 256 MiB; if it is full,
wait for existing links to expire or choose a smaller file.

This works great with f.i. a FTP Server running on a Synology.

It contains a flowcard to retrieve a (http) url to access the files: So you can use this to play a file on Sonos f.i..

But this is developed for and works great with the Micro Web Server (MWS) App.
**Combine these two apps to replace Soundboard as local storage!**

Install the FTP Server from Micro Web Server
* Install the Micro Web Server App.
* Go to the MWS App Settings and turn on the FTP Server and put it on Autostart.
Done!

Install the FTP Client.
* Install the FTP Client App.
* Add an **FTP Connection** device.
* Select the FTP Micro Web Server and press next.
* Choose a root directory, or leave it empty for the FTP server root.
Done!

Now go into Device Repair and start editing your locally-on-homey-stored folders and files!

The device's **Work (Default) Directory** is its root for both the repair browser
and all Flow file operations. Relative paths and paths starting with `/` stay
inside it; existing picker paths that already include the root remain valid.
Navigation above the root and moving or deleting the root itself are blocked.
Leave the setting empty to use the FTP server's root.
Flow pickers, file listings and move confirmations show paths relative to the
configured directory, without a root label or the server's physical prefix.

Pairing tries secure FTP first and falls back to plain FTP if necessary. You can
enter the root during pairing; it must be accessible before the device is added.

The browser distinguishes audio, video, images, archives, documents, spreadsheets,
presentations, code, CSV, text, PDF, signatures and medical-image files.
Flow pickers recognize the same file types as Repair. When a file extension has
dedicated artwork, the picker shows that image and Repair shows a matching
monochrome badge with the extension. Picker images use 48×48 PNGs or scalable
SVGs. Other known types use category icons. Picker icons
use the device's selected connection mode, defaulting to
**Local (SSL)** for new devices. Plain **Local** uses HTTP, which HTTPS browsers
may block as mixed content.

### Uploads and large log exports

Repair uploads one file at a time and shows progress. Files are staged in
private temporary storage on Homey, with a shared 256 MiB budget for pending
Repair uploads.

Existing **Save file from base64** and image-save Flows still work. Homey must
deliver the entire Base64 token before FTP Client can decode it, so that card
cannot bypass Homey's Flow payload limits.

For large logs, use **Save a Simple (Sys) Log export** instead. Choose CSV,
Excel (.xlsx), or JSON. Optionally select an FTP directory in **Path** and enter the filename
(for example, select `exports` and enter `homey-log.xlsx`, or leave the picker
empty and enter `exports/homey-log.xlsx`). The card streams the completed export from the same
Homey without passing the file through a Flow token. Simple (Sys) Log and
Better Logic Library must be running; export preparation still depends on those
apps and available storage.

Use **Save file from URL** for files from Simple (Sys) Log or any other source.
Pass the log export URL token (or enter a direct `http://`, `https://`, or `ftp://`
link reachable from Homey), optionally select a directory in **Path**, and enter a filename or
relative path. Only the URL passes through the Flow; Homey streams the file to
the configured FTP connection. With Simple (Sys) Log, connect its
**Get log export URL** card's **Local URL** or **Local SSL URL** token to this
card's **URL** field. The export card waits until the file is ready to download.
Choose your own destination filename, including its extension.

HTTP redirects are followed, and HTTPS certificates are verified. FTP source
URLs can include a username and password when required. Source files must be
reachable from Homey, whether on the internet or your local network.
Use trusted links: Homey can reach local network
services, and plain HTTP and FTP do not encrypt the download. Treat private
download URLs as secrets.

### Connection status and transfer alerts

**FTP status** (server icon) checks whether Homey can sign in and list the configured folder.
It checks at startup and then every five minutes by default. Change
**FTP status check interval (minutes)** in the device's advanced settings.
A failed check is retried after 15 seconds before the status changes to
**Unavailable**. Use **Check FTP connection now**
for an immediate check, or build Flows around readiness and status changes.

**Transfer error** (warning icon) starts at **No**, including when added to an
existing device for the first time. Once active, it stays active until you run
**Clear transfer error**. Every
failed upload or download fires **A transfer failed**, even if the alarm is
already on. That trigger provides the operation, relative path, and short
reason. The original action still fails normally, so Advanced Flow error
branches continue to work.

If reconnecting and retrying an FTP operation still fails, Repair shows an error
and Flow cards report the failure. Failed scheduled connection checks are written
to the app's error log without opening a dialog.

The app interface, device settings, and Flow cards are available in all 13
Homey-supported languages.



Flowcard to retrieve an Url.
It retrieves the file from the FTP server and keeps it accessable for 60* seconds through a url (* can be set per device in device-settings).

This works perfectly on Sonos speakers or any other device accepting a Url, like sending a image or movie to a TV with a Browser.

## Changelog

### 1.6.0

- Save files from HTTP, HTTPS, and FTP URLs, including Simple (Sys) Log export links.
- Improved file browsing, configured-root handling, and large-file transfers.
- Added FTP connection status and transfer alerts.
- Save cards use **Path** and **Filename**.
- Fixed connection conflicts when downloads run at the same time and improved recovery after connection failures.

### 1.5.4

- Moved the source code and issue tracker from Bitbucket to GitHub.

### 1.5.3

- Added a setting to allow an invalid FTP certificate.

### 1.5.2

- Fixed a startup issue.

### 1.5.1

- Fixed secure FTP login requiring manual intervention.

### 1.5.0

- Added a Flow card to save Base64 text as a file on the FTP server, for example to save Simple Log exports or Better Logic Library variables.

### 1.4.12

- Fixed another potential startup issue on Homey Pro (Early 2023).

### 1.4.11

- Fixed another startup issue.

### 1.4.10

- Improved memory performance.

### 1.4.9

- Improved memory performance.

### 1.4.8

- Resolved startup issues.

### 1.4.7

- Fixed startup issues.

### 1.4.6

- Test release with startup fixes; may contain bugs.

### 1.4.5

- Fixed startup issues.

### 1.4.4

- Fixed startup issues.

### 1.4.3

- Improved handling of Better Logic Library updates while the app is running.

### 1.4.2

- Bug fixes.

### 1.4.1

- Further compatibility fixes for all Homey Pro models.

### 1.4.0

- Restored compatibility with all Homey Pro models.

### 1.3.10

- Improved Better Logic Library support.

### 1.3.9

- Added compatibility with Homey Pro (Early 2023).

### 1.3.7

- Added automatic discovery and support for Athom's HTTP/FTP Server.
- Fixed root directory handling.

### 1.3.6

- Fixed the Better Logic Library restart message.

### 1.3.5

- Improved performance.

### 1.3.4

- Improved performance.

### 1.3.3

- Supported Better Logic Library (BLL) coding in Flow cards.

### 1.3.2

- Supported Better Logic Library coding in Flow cards.

### 1.3.1

- Added support for Better Logic Library coding in Flow cards.

### 1.3.0

- Added support for Better Logic Library coding in Flow cards.

### 1.2.12

- Fixed uploading an Image Token to FTP.

### 1.2.10

- Completed testing.

### 1.2.9

- Test release.

### 1.2.8

- Test release.

### 1.2.7

- Improved the Flow card that gets an Image Token from a URL.

### 1.2.6

- Added a Flow card to get an Image Token from a URL.

### 1.2.5

- Fixed retrieving an Image Token.

### 1.2.4

- Added Patreon and GitHub Sponsors as contribution options alongside PayPal.

### 1.2.3

- Added App Store links to the issue tracker and source code.

### 1.2.2

- Added a Flow card to save an Image Token to the FTP server.

### 1.2.1

- Added a Flow card to list files in a directory as JSON for use with JSON Handler.

### 1.2.0

- Added a Flow card to retrieve an image as an Image Token.

### 1.1.2

- Improved the app description.

### 1.1.1

- Improved interface text.

### 1.1.0

- Completed the basic file browser interface.

### 1.0.5

- Improved scrolling while dragging items on phones.

### 1.0.4

- Further improved drag and drop on phones.

### 1.0.3

- Added support for files larger than 1 MB and improved drag and drop and error handling.

### 1.0.2

- Improved drag and drop.

### 1.0.1

- Improved the interface.

### 1.0.0

- First release.
