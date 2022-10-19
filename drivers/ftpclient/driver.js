"use strict";
const { randomBytes } = require('crypto');
const Homey = require('homey');
const { Stream, Readable, Writable } = require('stream');
const FtpClientDevice = require('./device');
let app;


module.exports = class FtpClientDriver extends Homey.Driver {

    async onInit() {
        app = this.homey.app;
        this.log('FtpClientDriver onInit');
        // this.homey.app.on('microWebServerFtpPort', (microWebServerFtpPort)=> {
        //     this.ftpClient.init({ip:this.homey.app.ip, port:microWebServerFtpPort});
        // });
    }

    // This method is called when a user is adding a device
    // and the 'list_devices' view is called
    async onPairListDevices(deviceName) {//}, withIcon) {
        let index = 0;
        let devices = this.homey.drivers.getDriver('ftpclient').getDevices();
        for (const key in devices) {
            if (Object.hasOwnProperty.call(devices, key)) {
                const element = devices[key];
                try {                    
                    let _id = element.getData().id;
                    let nr =Number.parseInt(_id.split('_')[1]);
                    index = Math.max(index,nr);
                } catch (error) {
                }

            }
        }
        if(deviceName) {        
            let nr =Number.parseInt(deviceName.split('_')[1]);
            index = Math.max(index,nr);
        }
        let id = '_'+(index+1).toString();
        
        let device = {
            name: 'Ftp Client '+(index+1),
            data: {
                id: 'FtpClient'+id
            }
        };
        return [device];
    }

    async onPair(session, arg1) {
    let devices = await this.onPairListDevices();
    var device;

    session.setHandler('list_devices', async (data) => {
        return devices;
    });
    
    session.setHandler('list_devices_selection', async (selectedDevices) => {
        device = selectedDevices[0];
        device.icon = '/icon-default.svg';
    });

    session.setHandler('add_device', async (device) => {
        console.log('on device added', device);
    });

    }

/**
 * 
 * @param {*} session 
 * @param {FtpClientDevice} device 
 */
    async onRepair(session, device) {
        let id = device.getData().id || device.id;

        session.setHandler('getContent', async ({path}={path:''}) => {
            try {                
                let r = (await device.ftpClient.getList({path})).map(x=>{return {name:x.name, isDirectory:x.isDirectory, isFile:x.isFile, size:x.size, rawModifiedAt:x.rawModifiedAt, children:[], path:path} ; });//x.isDirectory = x.isDirectory; x.isFile = x.isFile; return x;});
                return r;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('deleteDirectory', async ({directory}) => {
            try {                
                let r = await device.ftpClient.client.removeDir((directory.path.length ? directory.path + '/' : '') + directory.name);
                //await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('renameDirectory', async ({directory}) => {
            try {                
                let r = await device.ftpClient.client.rename((directory.path.length ? directory.path + '/' : '') + directory.name, (directory.path.length ? directory.path + '/' : '') + directory.renameName);
                //await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('addDirectory', async ({directory, name}) => {
            try {                
                let r= await device.ftpClient.client.ensureDir((directory.path.length ? directory.path + '/' : '') + directory.name + '/' + name);
                await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });


        
        session.setHandler('deleteFile', async ({file}) => {
            try {
                let r = await device.ftpClient.client.remove((file.path.length ? file.path + '/' : '') + file.name, true);                
                //await device.ftpClient.client.cd('/');
                return true;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('renameFile', async ({file}) => {
            try {                
                let r = await device.ftpClient.client.rename((file.path.length ? file.path + '/' : '') + file.name, (file.path.length ? file.path + '/' : '') + file.renameName);
                //await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });

        session.setHandler('downloadFile', async ({file}) => {
            try {          
                let stream = new Writable();
                let s = '';
                //let buffer = Buffer.from);
                let buf;
                stream._write = function (chunk, encoding, done) {
                    s+=chunk.toString();
                    let _buf = Buffer.from(chunk, encoding);
                    if(buf) buf = Buffer.concat(buf, _buf);
                    else buf = _buf;
                    //buffer.write(chunk, encoding);
                
                    done();
                  };
                
                let r = await device.ftpClient.client.downloadTo(stream, (file.path.length ? file.path + '/' : '') + file.name);
                //let buf = Buffer.from(stream);
                let base64 = buf.toString('base64');
                //await device.ftpClient.client.cd('/');
                return {base64};
            } catch (error) {
                this.error(error);
            }
        });


        session.setHandler('uploadFiles', async () => {
            try {
                const id = randomBytes(12).toString('hex');
                if(!this.fileUploads) this.fileUploads = {};
                this.fileUploads[id] = {device};
                this.fileUploads[id].upload = async ({directory, files}={})=> {
                    this.log(directory);
                    this.log(files);
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        let path = (directory.path && directory.path!=='' ? directory.path + '/' : '' ) + directory.name;
                        const buf = Buffer.from(file.base64, 'base64');
                        let stream = Readable.from(buf);
                        
                        let r = device.ftpClient.client.uploadFrom(stream,(path.length ? path + '/':'') + file.name);                        
                        await r;
                    }
                    return {};
                };
                return {id};
            } catch (error) {
                this.error(error);
            }
        });

    }
    
  };