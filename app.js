'use strict';

const { randomBytes } = require('crypto');
const { ReadStream } = require('fs');
const Homey = require('homey');
const { Readable } = require('stream');

/** @type {import("./lib/bll/bl.typedef")} */
const { BL } = require('./lib/bll/bl');

const { httpsGet, httpGet } = require('./lib/proto');



class MyApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');
    if (process.env.DEBUG === '1') require('inspector').open(9220, '0.0.0.0', true);

    let bllRequiredNotified = await this.homey.settings.get('notification_bll_required');
    this.bl = new BL({
      homey:this.homey,
      waitForBll:!bllRequiredNotified,
			modules:[
				"_",
        "math", 
				"datetime",
			]});
      

		if(!bllRequiredNotified) {
      if(!BL.isRunning) this.homey.notifications.createNotification({excerpt : "Warning: The Better Logic Library App is required for FTP Client (to massivly reduce install sizes and LBB coding in filenames).\nPlease install the Better Logic Library App from the Athom Store." });
			//this.homey.settings.set('notification_bll_required', true);
		} else await this.bl;

    //console.log(BL.datetime.toString('dd-MM-yyyy'));

    //let add = await this.homey.cloud.getLocalAddress();
    this.ip = (await this.homey.cloud.getLocalAddress()).split(':')[0];
    this.cloudId = (await this.homey.cloud.getHomeyId());
    

    
    const action_app_get_imagetokenfromurl = this.homey.flow.getActionCard('action_app_get_imagetokenfromurl');
    action_app_get_imagetokenfromurl.registerRunListener(async (args) => {
        try {
            if (!args.url) 
                throw new Error('An URL must be given.');
            args.url = await BL.decode(args.url); 
            
            let func = args.url.toLowerCase().startsWith('https://') ? httpsGet : httpGet;
            let image = await this.homey.images.createImage();
            image.setStream(async (stream)=> {
              let imageBuffer = await func({url:args.url, bin:true});
              let imageStream = Readable.from(imageBuffer);
              return imageStream.pipe(stream);
            });

            if(args.availableduration!==0) setTimeout(()=>{
              image.unregister();
              image = null;
            }, (args.availableduration||60) * 1000);
            // let token = await this.homey.flow.createToken(randomBytes(12).toString('hex'), {
            //     type: "image",
            //     title: "Image",
            //   });                  
            //   await token.setValue(image);
          return {image};
            //return {image:fileInfo.image};

        } catch (error) {
            console.log('Error: ' + error);
            throw typeof(error)==='string'?new Error(error) : error;
        }

    });


  }

}

module.exports = MyApp;
