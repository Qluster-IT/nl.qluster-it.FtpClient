"use strict";
const { randomBytes } = require('crypto');
const Homey = require('homey');
const { Stream, Readable, Writable } = require('stream');
const FileServer = require('../../lib/file-server');
const FtpClient = require('../../lib/ftp-client');
const FtpClientDevice = require('./device');
const _ = require('lodash-core');
const Icons = require('../../lib/icons');


const { readFile, writeFile, unlink, rename, exists, mkdir, copyFile, readdir, stat, rmdir } = require('fs');
const { promisify } = require('util');
const fs = require('fs');

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const copyFileAsync = promisify(copyFile);
const unlinkAsync = promisify(unlink);
const renameAsync = promisify(rename);
const existsAsync = promisify(exists);
const mkdirAsync = promisify(mkdir);
const readdirAsync = promisify(readdir);
const statAsync = promisify(stat);
const rmdirAsync = promisify(rmdir);


let app;


// var pkg = require('../../package.json');
// var Greenlock = require('greenlock');


module.exports = class FtpClientDriver extends Homey.Driver {

    async onInit() {
        app = this.homey.app;
        this.log('FtpClientDriver onInit');

        this.fileServer = new FileServer();
        this.fileServer.init(this.homey);

        // var greenlock = Greenlock.create({
        //     packageRoot:'./userdata/',
        //     configDir: 'greenlock.d/config.json',
        //     packageAgent: pkg.name + '/' + pkg.version,
        //     maintainerEmail: "arie@qluster-it.nl",// pkg.author,
        //     staging: true,
        //     notify: function(event, details) {
        //         if ('error' === event) {
        //             // `details` is an error object in this case
        //             console.error(details);
        //         }
        //     }
        // });

        // let fullConfig = await greenlock.manager
        //     .defaults({
        //         agreeToTerms: true,
        //         subscriberEmail: 'webhosting@example.com'
        //     });
        // var altnames = ['192-168-1-17.homey.homeylocal.com:47335'];

        // greenlock
        //     .add({
        //         subject: altnames[0],
        //         altnames: altnames
        //     })
        //     .then(function() {
        //         // saved config to db (or file system)
        //     });   
        //     // .then(function(fullConfig) {
        //     //     // ...
        //     // });

        // this.homey.app.on('microWebServerFtpPort', (microWebServerFtpPort)=> {
        //     this.ftpClient.init({ip:this.homey.app.ip, port:microWebServerFtpPort});
        // });



        const action_ftpclient_get_url = this.homey.flow.getActionCard('action_ftpclient_get_url');
        action_ftpclient_get_url.registerRunListener(async (args, state) => {
            //var defer = new Defer();
            try {
                if (!args.file) return false;
                if (args && args.file && args.file.isFile !== 'true' && args.file.isFile !== true) throw new Error('A file must be selected.');

                let url = await this.getFileUrl({file:args.file, device:args.device, type:'url'});
                
                return {url:url.url};

            } catch (error) {
                console.log('Error: ' + error);
                throw typeof(error)==='string'?new Error(error) : error;
            }

        });
        action_ftpclient_get_url.getArgument('file').registerAutocompleteListener(async (query, args) => {
            try {
                let path = (args.file ? (args.file.isDirectory === 'true' ? args.file.id : args.file.path) : query) || '';
                let pathsAbove = path.split('/');
                pathsAbove.pop();
                let pathAbove = pathsAbove.join('/');
                let startUrl = 
                args.device.settings.urlforicons===
                'local' ? 
                    `http://${this.homey.app.ip}/app/nl.qluster-it.FtpClient/drivers/ftpclient/assets/icons/ext/24x24/` :
                'cloud' ? 
                    `https://${this.homey.app.cloudId}.connect.athom.com/app/nl.qluster-it.FtpClient/drivers/ftpclient/assets/icons/ext/24x24/`
                :   '';

                let r = await args.device.ftpClient.getList({ path });

                r = r.map(x => { return { id: `${path}${path ? '/' : ''}${x.name}`, filename:x.name, name: `${path}${path ? '/' : ''}${x.name}`, path, description: path, isDirectory: x.isDirectory, isFile: x.isFile }; });
                //r = r.sort(x=>(x.isDirectory ? '0.' : '1.') + x.name);
                r = _.orderBy(r, x => (x.isDirectory ? '0.' : '1.') + x.name);
                
                if (pathAbove && pathAbove.length) r.unshift({ id: pathAbove, name: pathAbove, description: '..', isDirectory: true, isFile: false });
                _.each(r, (x) => {
                    //x.icon = ''; svg
                    //x.image = `http://${this.homey.app.ip}/app/nl.qluster-it.FtpClient/drivers/ftpclient/assets/icons/ext/24x24/${Icons.getIconsFromFile(x)}`;
                    x.image = startUrl + Icons.getIconsFromFile(x);
                });
                
                return r;
            } catch (error) { this.error('action_ftpclient_get_url.file.registerAutocompleteListener.error :', error); throw error; }
        });
    }

    // This method is called when a user is adding a device
    // and the 'list_devices' view is called
    async onPairListDevices(deviceName) {//}, withIcon) {
        let id = randomBytes(12).toString('hex');

        let device = {
            name: 'Custom Ftp Client ',
            data: {
                id: 'FtpClient' + id
            }
        };


        let devs = [];


        const discoveryStrategyFtp = this.homey.discovery.getStrategy("ftp_mDNS-SD");
        const discoveryResultsFtp = discoveryStrategyFtp.getDiscoveryResults();
        Object.values(discoveryResultsFtp).forEach((discoveryResult) => {
            devs.push({
                name: (discoveryResult.txt.name || discoveryResult.name),
                data: {
                    id: discoveryResult.id && discoveryResult.id != 'undefined' ? discoveryResult.id : discoveryResult.fullname,
                },
                settings: { ip: discoveryResult.address, port: discoveryResult.port }
            });
        });



        let ftpClient = new FtpClient();
        ftpClient.init({
            ip: this.homey.app.ip, port: 5081
        });
        try {
            let isConnected = await ftpClient.getFeatures();//{ip: this.homey.app.ip, port: 5081 });
            if (isConnected) {
                devs.push({ name: 'Ftp Micro Web Server', data: { id: 'FtpClientMWS' }, settings: { ip: this.homey.app.ip, port: 5081, username: 'anonymous' } });
            }
        } catch (error) { }

        devs.push(device);
        _.each(devs, d=> {            
            devs.store = {id:randomBytes(12).toString('hex')};
        });
        return devs;

    }

    async onPair(session, arg1) {
        let devices;//= await this.onPairListDevices();
        var device;

        session.setHandler('list_devices', async (data) => {
            return (devices = await this.onPairListDevices());
        });

        session.setHandler('list_devices_selection', async (selectedDevices) => {
            device = selectedDevices[0];
            //device.icon = '/icon-default.svg';
        });

        session.setHandler("showView", async (data) => {
            console.log("showiew: ");
            console.log(data);
            if (data === 'login_credentials' && device.settings.ip === this.homey.app.ip) {
                try {

                    let ftpClient = new FtpClient();
                    ftpClient.init({ ip: device.settings.ip, port: device.settings.port });
                    let isConnected = await ftpClient.getLogin();//{ip: this.homey.app.ip, port: 5081 });
                    this.isConnected = true;
                    session.showView('add_devices');
                    return true;
                } catch (error) { }
            }
        });

        session.setHandler("login", async (data) => {
            //username = data.username;
            //password = data.password;



            let ftpClient = new FtpClient();
            ftpClient.init({
                ip: device.settings.ip, port: device.settings.port, username: data.username, password: data.password
            });
            try {
                let isConnected = await ftpClient.getLogin(data.username, data.password);//{ip: this.homey.app.ip, port: 5081 });
                this.isConnected = true;
                this.username = data.username;
                this.password = data.password;
                return true;
            } catch (error) { }
            return false;

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

        session.setHandler('getContent', async ({ path } = { path: '' }) => {
            try {
                let r = (await device.ftpClient.getList({ path })).map(x => { return { name: x.name, isDirectory: x.isDirectory, isFile: x.isFile, size: x.size, rawModifiedAt: x.rawModifiedAt, children: [], path: path }; });//x.isDirectory = x.isDirectory; x.isFile = x.isFile; return x;});
                return r;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('deleteDirectory', async ({ directory }) => {
            try {
                let r = await device.ftpClient.client.removeDir((directory.path.length ? directory.path + '/' : '') + directory.name);
                //await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('renameDirectory', async ({ directory }) => {
            try {
                let r = await device.ftpClient.client.rename((directory.path.length ? directory.path + '/' : '') + directory.name, (directory.path.length ? directory.path + '/' : '') + directory.renameName);
                //await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('addDirectory', async ({ directory, name }) => {
            try {
                let r = await device.ftpClient.client.ensureDir((directory.path.length ? directory.path + '/' : '') + directory.name + '/' + name);
                await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });



        session.setHandler('deleteFile', async ({ file }) => {
            try {
                let r = await device.ftpClient.client.remove((file.path.length ? file.path + '/' : '') + file.name, true);
                //await device.ftpClient.client.cd('/');
                return true;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('renameFile', async ({ file }) => {
            try {
                let r = await device.ftpClient.client.rename((file.path.length ? file.path + '/' : '') + file.name, (file.path.length ? file.path + '/' : '') + file.renameName);
                //await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });

        session.setHandler('getFileUrl', async ({ file }) => {
            return await this.getFileUrl({file, device, type:'download'});
        });


        session.setHandler('uploadFiles', async () => {
            try {
                const id = randomBytes(12).toString('hex');
                if (!this.fileUploads) this.fileUploads = {};
                this.fileUploads[id] = { device };
                this.fileUploads[id].upload = async ({ directory, files } = {}) => {
                    this.log(directory);
                    this.log(files);
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        let path = (directory.path && directory.path !== '' ? directory.path + '/' : '') + directory.name;
                        const buf = Buffer.from(file.base64, 'base64');
                        let stream = Readable.from(buf);

                        let r = device.ftpClient.client.uploadFrom(stream, (path.length ? path + '/' : '') + file.name);
                        await r;
                    }
                    return {};
                };
                return { id };
            } catch (error) {
                this.error(error);
            }
        });

    }


    async getFileUrl({ file, device, type }) {
        try {
            let stream = new Writable();
            let s = '';
            //let buffer = Buffer.from);
            let buf = [];
            stream._write = function (chunk, encoding, done) {
                s += chunk.toString();
                let _buf = Buffer.from(chunk, encoding);
                buf.push(_buf);
                done();
            };
            await device.ftpClient.cd('/');
            let name = file.filename || file.name;

            await device.ftpClient.downloadTo(stream, (file.path.length ? file.path + '/' : '') + name);
            buf = Buffer.concat(buf);


            let base64 = buf.toString('base64');
            let randomId = randomBytes(24).toString('hex');
            let id = device.id + '/' + file.path + '/' + name;// randomBytes(12).toString('hex');
            let url = 'http://' + this.homey.app.ip + ":47335/file/" + id;
            let useUrl;

            if(type=='url') useUrl = device.settings.urlforurls;
            else if(type=='download') useUrl = device.settings.urlforfiles;
            
            id = encodeURIComponent(id);
            if(useUrl==='cloud') {
                id = randomId + '/' + name; //dont encode this id.
                url = `https://${this.homey.app.cloudId}.connect.athom.com/app/nl.qluster-it.FtpClient/userdata/` + id;
            }

            //args.device.settings.urlforicons

            if (!this.fileDownloads) this.fileDownloads = {};

            if (this.fileDownloads[id] && this.fileDownloads[id].timeout) {
                clearTimeout(this.fileDownloads[id].timeout);                
                if(this.fileDownloads[id].randomId)  {                    
                    if (!(await existsAsync(`./userdata/${this.fileDownloads[id].randomId}`))) await rmdirAsync(`./userdata/${this.fileDownloads[id].randomId}`);                
                }
                delete this.fileDownloads[id].timeout;
                
            }

            this.fileDownloads[id] = { base64, name: name, file: file, id };
            this.fileDownloads[id].timeout = setTimeout(async () => {
                if(this.fileDownloads[id].randomId)  {                    
                    if (!(await existsAsync(`./userdata/${this.fileDownloads[id].randomId}`))) await rmdirAsync(`./userdata/${this.fileDownloads[id].randomId}`);                
                }
                delete this.fileDownloads[id];                
            }, device.settings.downloadtime * 1000);
            
            if(useUrl==='cloud') {
                this.fileDownloads[id].randomId = randomId;
                if (!(await existsAsync(`./userdata/${randomId}/`))) await mkdirAsync(`./userdata/${randomId}/`);
                await writeFileAsync(`./userdata/${id}`, buf);
            }

            return { id, url }; //base64

        } catch (error) {
            this.error(error);
        }
    }
};