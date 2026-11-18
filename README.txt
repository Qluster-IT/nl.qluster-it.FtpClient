Browse files on your FTP server and automate transfers from Homey. Save camera snapshots, send reports to your NAS, or make audio files available to a compatible player.

• Manage files from Homey: upload and download files, create folders, and rename, move, or delete files and folders.
• Automate with Flow: save images or base64-encoded files, list files as JSON, load images into Flows, or get a temporary download link.
• Save files from URLs: stream HTTP, HTTPS, or FTP downloads to your server, including log export links from Simple (Sys) Log, without passing the file through a Flow token.
• Simple (Sys) Log support: save CSV, Excel, or JSON exports with the dedicated export card, or connect its export URL card to “Save file from URL” for large logs.
• Monitor your connection: Homey checks the configured folder automatically. Trigger Flows when FTP becomes unavailable, comes back online, or a transfer fails.

To get started, add an “FTP Connection” device and enter your server details. Pairing tries secure FTP (FTPS) first and falls back to plain FTP if needed. If you choose a starting folder, browsing and Flow file operations stay inside it. Open Repair on the device to browse your files in the Homey app or web app.

Works with FTP servers including Micro Web Server.

Requires the Better Logic Library app. BLL coding is supported in filename/path text fields. See the Better Logic Library app settings for instructions on using BLL coding.

See the app’s topic on the Homey Community Forum for more information.
For the FTP Client wiki and user manual, select “Visit website” under “Developer website” on this app’s Homey App Store page.
