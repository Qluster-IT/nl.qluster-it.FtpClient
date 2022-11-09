This App let's you control any FTP Server directly from your Homey, in a directory based UI.
You can Add, Rename, Move and Delete folders and files directly from the Homey App or Web App, anywhere you want!

You can also Download files anywhere on the Homey Web App or with the Homey Mobile App, secure, without opening ports or firewalls!

To drag and drop on Mobiles or Tablets, first select a folder or file, than start dragging.
Click right-click or press/tab-long on items for a contextmenu.


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
* Create a new FTP Connection Device.
* Select the FTP Micro Web Server and press next.
Done!

Now go into Device Repair and start editing your locally-on-homey-stored folders and files!



Flowcard to retrieve an Url.
It retrieves the file from the FTP server and keeps it accessable for 60* seconds through a url (* can be set per device in device-settings).

This works perfectly on Sonos speakers or any other device accepting a Url, like sending a image or movie to a TV with a Browser.


* Requires the Better Logic Library App to be installed.