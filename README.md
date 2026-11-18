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
* Create a new FTP Client device.
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

The app interface, device settings, and Flow cards are available in all 13
Homey-supported languages.



Flowcard to retrieve an Url.
It retrieves the file from the FTP server and keeps it accessable for 60* seconds through a url (* can be set per device in device-settings).

This works perfectly on Sonos speakers or any other device accepting a Url, like sending a image or movie to a TV with a Browser.

FTP commands submitted through the command queue execute one at a time, including
after connection failures. Routine commands no longer issue an extra working-
directory query just for logging. Protocol logging is enabled only in debug mode.