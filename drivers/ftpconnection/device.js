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

		this.id = await this.getStoreValue('id');

		this.ftpClient = new FtpClient();
		if(this.driver.username) {
			await this.setSettings({username:this.driver.username});
			delete this.driver.username;
		}
		if(this.driver.password) {
			await this.setSettings({password:this.driver.password});
			delete this.driver.password;
		}
		
		if(this.driver.isConnected) delete this.driver.isConnected;

		await this.init();

		


		if (process.env.DEBUG === '1') { }


	}
	async onSettings({ oldSettings, newSettings, changedKeys }) {
		await this.init(newSettings);

	}

	async init(newSettings) {
		this.settings = newSettings || await this.getSettings();
		this.ftpClient.init({
			homey:this.homey,
			ip: this.settings.ip, port: this.settings.port,
			username: this.settings.username, password: this.settings.password, secure: this.settings.secure
		});
	}


	
  
	// onDiscoveryResult(discoveryResult) {
	// 	// Return a truthy value here if the discovery result matches your device.
	// 	this.log('onDiscoveryResult: ', discoveryResult);
	// 	return discoveryResult.id === this.getData().id;
	//   }
	
	//   async onDiscoveryAvailable(discoveryResult) {
	// 	this.setAddress(discoveryResult.address);
	
	// 	// this.api = new MyDeviceAPI(discoveryResult.address);
	// 	// await this.api.connect(); // When this throws, the device will become unavailable.
	//   }
	
	//   onDiscoveryAddressChanged(discoveryResult) {
	// 	this.setAddress(discoveryResult.address);
		
	// 	// this.api.address = discoveryResult.address;
	// 	// this.api.reconnect().catch(this.error);
	//   }
	
	//   onDiscoveryLastSeenChanged(discoveryResult) {
	// 	this.setAddress(discoveryResult.address);
		
	// 	// When the device is offline, try to reconnect here
	// 	// this.api.reconnect().catch(this.error);
	//   }
	
	//   setAddress(ip) {
	// 	this.setSettings({'ip': ip});
	// 	this.init();
	//   }	

};
