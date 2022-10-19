'use strict';

const Homey = require('homey');

class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');
    if (process.env.DEBUG === '1') require('inspector').open(9220, '0.0.0.0', true);
    this.ip = (await this.homey.cloud.getLocalAddress()).split(':')[0];
    
  }

}

module.exports = MyApp;
