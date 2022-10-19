"use strict";

const Homey = require('homey');
const FtpClient = require('../../lib/ftp-client');


module.exports = class FtpClientDevice extends Homey.Device {


	onDeleted() {
		//delete Homeyman.Current.VirtualDevices[this.getName()];
	}
	// this method is called when the Device is inited
	async onInit() {
		this.log('Device init');
		this.log('Name:', this.getName());
		this.log('Class:', this.getClass());

		this.ftpClient = new FtpClient();
		await this.init();



		if (process.env.DEBUG === '1') { }


	}
	async onSettings({ oldSettings, newSettings, changedKeys }) {
		await this.init(newSettings);

	}

	async init(newSettings) {
		this.settings = newSettings || await this.getSettings();
		this.ftpClient.init({
			ip: this.settings.ip, port: this.settings.port,
			username: this.settings.username, password: this.settings.password, secure: this.settings.secure
		});
	}

};
