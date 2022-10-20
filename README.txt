FTP Client(s)

This brand new App lets you control any FTP Server directly from your Homey.
You can Add, Rename and Delete folders and files directly from the Homey App, anywhere you want!

You can also download files on the Web or Mobile. :slight_smile: anywhere you want, without opening ports up.


This works great with f.i. a Ftp Server running on a Synology.

It contains a flowcard to retrieve a (http) url to access the files: So you can use this to play a file on Sonos f.i..

But this is developed for and works great with the Micro Web Server (MWS) App.
**Combine these two apps to replace Soundboard as local storage!**

### Install the Ftp Server (Micro Web Server)
* Install the Micro Web Server App.
* Go to the MWS App Settings and turn on the Ftp Server and put it on Autostart.
Done!

### Install the Ftp Client.
* Install the Ftp Client App.
* Create a new Ftp Client Device.
* Select the Ftp Micro Web Server and press next.
Done!

Now go into Device Repair and start editing your locally-on-homey-stored folders and files!



# Flowcard to retrieve an Url.
It retrieves the file from the Ftp server and keeps it accessable for 60 seconds (this can be set per device in device-settings) through a url.
This works perfectly on my Sonos speakers!