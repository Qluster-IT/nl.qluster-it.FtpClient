"use strict";
const { randomBytes } = require('crypto');
const Homey = require('homey');
const { Stream, Readable, Writable } = require('stream');
const FileServer = require('../../lib/file-server');
const FtpClient = require('../../lib/ftp-client');
const FtpClientDevice = require('./device');
const { BL } = require('betterlogiclibrary');
const Icons = require('../../lib/icons');


const { readFile, writeFile, unlink, rename, exists, mkdir, copyFile, readdir, stat, rmdir, fstat , rm} = require('fs');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const { stream2buffer } = require('../../lib/proto');

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
const rmAsync = promisify(rm);


let app;


// var pkg = require('../../package.json');
// var Greenlock = require('greenlock');

const emptyDirectory = async function(path) {
  if (await existsAsync(path)) {
    const files = await readdirAsync(path);

    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const filename = files[i];
            if ((await statAsync(path + "/" + filename)).isDirectory()) {
                await rmAsync(path + "/" + filename, {force:true, recursive:true});
                await emptyDirectory(path + "/" + filename);
              } else {
                await unlinkAsync(path + "/" + filename);
              }
        }
    } else {
      console.log("No files found in the directory.");
    }
  } else {
    console.log("Directory path not found.");
  }
};

module.exports = class FtpClientDriver extends Homey.Driver {

    async onInit() {
        app = this.homey.app;
        this.log('FtpClientDriver onInit');

        this.fileServer = new FileServer();
        this.fileServer.init(this.homey);

        // let filesandfolders = await readdirAsync('./');
        
        // let filesandfoldersdonwloads = await readdirAsync('./..');


        if (!(await existsAsync(`/userdata/downloads/`))) await mkdirAsync(`/userdata/downloads/`);
        await emptyDirectory(`/userdata/downloads/`);
        
        // let filesandfolders = await readdirAsync('/userdata/');
        
        //let filesandfoldersdonwloads = await readdirAsync('/userdata/downloads/');


        // var greenlock = Greenlock.create({
        //     packageRoot:'/userdata/',
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



        const action_ftpconnection_get_url = this.homey.flow.getActionCard('action_ftpconnection_get_url');
        action_ftpconnection_get_url.registerRunListener(async (args) => {
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
        action_ftpconnection_get_url.getArgument('file').registerAutocompleteListener(async (query, args) => {
            try {
                return await this.getFiles({file:args.file, query, device:args.device });
            } catch (error) { this.error('action_ftpconnection_get_url.file.registerAutocompleteListener.error :', error); throw error; }
        });

        
        const action_ftpclient_get_imagetoken = this.homey.flow.getActionCard('action_ftpclient_get_imagetoken');
        action_ftpclient_get_imagetoken.registerRunListener(async (args) => {
            try {
                if ((!args.image && !args.path) || (args && args.image && args.image.isFile !== 'true' && args.image.isFile !== true && (!args.path || !args.path.length))) 
                    throw new Error('An image must be selected or a path given.');
                
                args.path = await BL.decode(args.path);

                let path = args.path;
                if(args.image) {
                    if(args.image.isDirectory) path = args.image.id + (path && path.length ? (!path.startsWith('/')?'/':'') + path : '');
                    else path = args.image.id;
                }
                
                //this.log('action_ftpclient_get_imagetoken args.image: ', typeof(args.image), args.image);
                //this.log('action_ftpclient_get_imagetoken args.path: ', args.path);

                if(!args.image || args.image==='undefined' || (args.path && args.path.length)) {
                    try {
                        
                        let _files = await this.getFiles({path, device:args.device, includeDiretories:false });
                        //this.log('_files: ', _files);
                        args.image = BL._.first(_files);
                    } catch (error) {
                        let _files = await this.getFiles({path, device:args.device, includeDiretories:false });
                        //this.log('_files error: ', _files);
                        args.image = BL._.first(_files);
                    }
                    //args.image = BL._.first(await this.getFiles({path, device:args.device, includeDiretories:false }));
                }
                let fileInfo = await this.getFileUrl({file:args.image, device:args.device, type:'url', createToken:true});
                
                return {image:fileInfo.image};

            } catch (error) {
                console.log('Error: ' + error);
                throw typeof(error)==='string'?new Error(error) : error;
            }

        });
        action_ftpclient_get_imagetoken.getArgument('image').registerAutocompleteListener(async (query, args) => {
            try {
                return await this.getFiles({file:args.image, query, device:args.device });
            } catch (error) { this.error('action_ftpclient_get_imagetoken.image.registerAutocompleteListener.error :', error); throw error; }
        });

        
        const action_ftpclient_save_imagetoken = this.homey.flow.getActionCard('action_ftpclient_save_imagetoken');
        action_ftpclient_save_imagetoken.registerRunListener(async (args) => {
            try {
                if ((!args.directory && !args.path) || (args && args.directory && args.directory.isDirectory !== 'true' && args.directory.isDirectory !== true && (!args.path || !args.path.length))) 
                throw new Error('An directory and/or path must be set.');
                                    
                let time = Date.now();
                args.path = await BL.decode(args.path); 
                BL.homey.log('BL.decode time: ', Date.now() - time);

                let path = args.path;
                if(args.directory) {
                    if(args.directory.isDirectory) path = args.directory.id + (path && path.length ? (!path.startsWith('/')?'/':'') + path : '');
                    else path = args.directory.id;
                }
                await this.saveFile({device:args.device, path, stream:await args.droptoken.getStream()});
                return true;
                // let files = await this.getFiles({file:args.directory, device:args.device, includeDiretories:false });
                // files = BL._.map(files, x=>x.id);
                
                // return {files:JSON.stringify(files)};

            } catch (error) {
                console.log('Error: ' + error);
                throw typeof(error)==='string'?new Error(error) : error;
            }

        });
        action_ftpclient_save_imagetoken.getArgument('directory').registerAutocompleteListener(async (query, args) => {
            try {
                return await this.getFiles({file:args.image, query, device:args.device, type:'folder' });
            } catch (error) { this.error('action_ftpclient_save_imagetoken.directory.registerAutocompleteListener.error :', error); throw error; }
        });


        
        const action_ftpclient_get_files = this.homey.flow.getActionCard('action_ftpclient_get_files');
        action_ftpclient_get_files.registerRunListener(async (args) => {
            try {
                if (args && args.directory && args.directory.isDirectory !== 'true' && args.directory.isDirectory !== true) throw new Error('A directory must be selected.');

                let files = await this.getFiles({file:args.directory, device:args.device, includeDiretories:false });
                files = BL._.map(files, x=>x.id);
                // let fileInfo = await this.getFileUrl({file:args.image, device:args.device, type:'url', createToken:true});
                
                return {files:JSON.stringify(files)};

            } catch (error) {
                console.log('Error: ' + error);
                throw typeof(error)==='string'?new Error(error) : error;
            }

        });
        action_ftpclient_get_files.getArgument('directory').registerAutocompleteListener(async (query, args) => {
            try {
                return await this.getFiles({file:args.image, query, device:args.device, type:'folder' });
            } catch (error) { this.error('action_ftpclient_get_files.directory.registerAutocompleteListener.error :', error); throw error; }
        });

    }

    async getFiles({type, file, query, device, includeDiretories=true, path} = {includeDiretories:true}) {
        path = path || (file ? (file.isDirectory === 'true' || file.isDirectory === true ? file.id : file.path) : query) || '';
        let pathsAbove = path.split('/');
        pathsAbove.pop();
        let pathAbove = pathsAbove.join('/');
        let startUrl = 
        device.settings.urlforicons===
        'local' ? 
            `http://${this.homey.app.ip}/app/nl.qluster-it.FtpClient/drivers/ftpconnection/assets/icons/ext/24x24/` :
        'localssl' ? 
            `https://${this.homey.app.ip.replaceAll('.', '-')}.homey.homeylocal.com/app/nl.qluster-it.FtpClient/drivers/ftpconnection/assets/icons/ext/24x24/` :
        'cloudssl' ? 
            `https://${this.homey.app.cloudId}.connect.athom.com/app/nl.qluster-it.FtpClient/drivers/ftpconnection/assets/icons/ext/24x24/`
        :   '';

        let r = await device.ftpClient.exec({action:'list'}, path );

        //r = r.map(x => { return { id: `${path}${path ? '/' : ''}${x.name}`, filename:x.name, name: `${path}${path ? '/' : ''}${x.name}`, path, description: path, isDirectory: x.isDirectory, isFile: x.isFile }; });
        r = r.map(x => { 
            let p = x.name;
            let id = x.name;
            let filename;
            if(x.isFile) filename = BL._.last(x.name.split('/'));
            if(x.isFile && x.name===path) { 
                p=p.split('/');p.pop();p=p.join('/');
            }
            else {
                //if(x.isFile) full                
                p = (path && path.length ? path + '/':'') + p;
                id = p;
            }
            return { id: id, filename:filename, name: id, path:p, description: path, isDirectory: x.isDirectory, isFile: x.isFile }; 
        });
        r = BL._.orderBy(r, x => (x.isDirectory ? '0.' : '1.') + x.name);
        if(type) r = BL._.filter(r, x => (x.isDirectory && includeDiretories) || Icons.getFileType(x).contains(type));
        
        if (includeDiretories && path && path.length) r.unshift({ id: pathAbove, name: pathAbove, description: '..', isDirectory: true, isFile: false });
        BL._.each(r, (x) => {
            //x.icon = ''; svg
            //x.image = `http://${this.homey.app.ip}/app/nl.qluster-it.FtpClient/drivers/ftpconnection/assets/icons/ext/24x24/${Icons.getIconsFromFile(x)}`;
            x.image = startUrl + Icons.getIconsFromFile(x);
        });
        
        return r;
    }

    // This method is called when a user is adding a device
    // and the 'list_devices' view is called
    async onPairListDevices(deviceName) {//}, withIcon) {
        let id = randomBytes(12).toString('hex');

        let device = {
            name: 'Custom FTP Client ',
            data: {
                id: 'FtpClient' + id
            },
            custom:true
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
                settings: { ip: discoveryResult.address, port: discoveryResult.port, username:"", password:"" }
            });
        });



        let ftpClientMWS = new FtpClient();
        ftpClientMWS.init({
            
			homey:this.homey, ip: this.homey.app.ip, port: 5081
        });
        try {
            let isConnected = await ftpClientMWS.getFeatures();//{ip: this.homey.app.ip, port: 5081 });
            if (isConnected) {
                devs.push({ name: 'Micro Web Server', data: { id: 'FtpClientMWS' }, settings: { ip: this.homey.app.ip, port: 5081, username: 'anonymous', password:"" } });
            }
        } catch (error) { }

        let ftpClientHFS = new FtpClient();
        ftpClientHFS.init({            
			homey:this.homey, ip: this.homey.app.ip, port: 2100
        });
        try {
            let isConnected = await ftpClientHFS.getFeatures();//{ip: this.homey.app.ip, port: 5081 });
            if (isConnected) {
                devs.push({ name: 'HTTP/FTP Server', data: { id: 'FtpClientHFS' }, settings: { ip: this.homey.app.ip, port: 2100, username:"", password:"" } });
            }
        } catch (error) { }

        
        devs.push(device);
        BL._.each(devs, d=> {            
            d.store = {id:randomBytes(12).toString('hex')};
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
            if(data=== 'loading_credentials') {
                if(device.custom) session.showView('add_devices');
                else if(device.settings && device.settings) { //}.ip === this.homey.app.ip) {
                    try {

                        let ftpClient = new FtpClient();
                        ftpClient.init({ 
                            homey:this.homey, ip: device.settings.ip, port: device.settings.port });
                        //let isConnected = await ftpClient.getLogin();//{ip: this.homey.app.ip, port: 5081 });
                        let isConnected = await ftpClient.exec({action:'list',oneTry:true});//{ip: this.homey.app.ip, port: 5081 });
                        this.isConnected = true;
                        session.showView('add_devices');
                        return true;
                    } catch (error) {                    
                        session.showView('login_credentials');
                        return true;
                    }
                }
                else session.showView('login_credentials');
            }
        });

        session.setHandler("login", async (data) => {
            //username = data.username;
            //password = data.password;



            let ftpClient = new FtpClient();
            ftpClient.init({                
			    homey:this.homey, ip: device.settings.ip, port: device.settings.port, username: data.username, password: data.password
            });
            try {
                let isConnected = await ftpClient.exec({action:'list', oneTry:true});
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
                let list = (await device.ftpClient.exec({action:'list'},  path));
                let r = list.map(x => { return { id:(path && path.length>0 ? path + '/' : '') + x.name,  name: x.name, isDirectory: x.isDirectory, isFile: x.isFile, size: x.size, rawModifiedAt: x.rawModifiedAt, children: [], path: path, fullPath:(path && path.length>0 ? path + '/' : '') + x.name }; });//x.isDirectory = x.isDirectory; x.isFile = x.isFile; return x;});
                return r;
            } catch (error) {
                this.error(error);
                throw error;
            }
        });
        session.setHandler('moveItem', async ({ item, targetDirectory }) => {
            try {
                let sourcePath =item.id;// (item.path.length ? item.path + '/' : '') + item.name;
                let targetPath =  targetDirectory.id + '/' + item.name;
                let r = await device.ftpClient.exec({action:'rename'}, sourcePath, targetPath);
                return r;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('deleteDirectory', async ({ directory }) => {
            let error1;
            try {
                let r;
                try {
                    r = await device.ftpClient.exec({action:'removeDir'}, directory.id);    
                } catch (error) {
                    error1 = error;
                }
                
                if(error1) r = await device.ftpClient.exec({action:'remove'}, directory.id);
                return r;
            } catch (error) {
                this.error(error1);
                this.error(error);
            }
        });
        session.setHandler('renameDirectory', async ({ directory }) => {
            try {
                let r = await device.ftpClient.exec({action:'rename'}, directory.id, (directory.path && directory.path.length ? directory.path + '/' : '') + directory.renameName);
                //await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('addDirectory', async ({ directory, name }) => {
            try {
                let r = await device.ftpClient.exec({action:'ensureDir'}, (directory.id && directory.id.length?directory.id + '/':'') + name);
                //await device.ftpClient.client.cd('/');
                return r;
            } catch (error) {
                this.error(error);
            }
        });



        session.setHandler('deleteFile', async ({ file }) => {
            try {
                let r = await device.ftpClient.exec({action:'remove'}, file.id, true);
                //await device.ftpClient.client.cd('/');
                return true;
            } catch (error) {
                this.error(error);
            }
        });
        session.setHandler('renameFile', async ({ file }) => {
            try {
                let r = await device.ftpClient.exec({action:'rename'}, file.id, (file.path && file.path.length ? file.path + '/' : '') + file.renameName);
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
                    //this.log(directory);
                    //this.log(files);
                    for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        let path = directory.id;// (directory.path && directory.path !== '' ? directory.path + '/' : '') + directory.name;
                        const buf = Buffer.from(file.base64, 'base64');
                        let stream = Readable.from(buf);

                        let r = device.ftpClient.exec({action:'uploadFrom'}, stream, (path && path.length ? path + '/' : '') + file.name);
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

    async saveFile({path, device, stream}) {
        let parentPath = path.split('/'); parentPath.pop(); parentPath = parentPath.join('/');
        try {
            await device.ftpClient.exec({action:'ensureDir'}, parentPath);            
        } catch (error) {
            
        }
        const buf = await stream2buffer(stream);
        let newStream = Readable.from(buf);

        return await device.ftpClient.exec({action:'uploadFrom'}, newStream, path);
    }
    async getFileUrl({ file, device, type , createToken}) {
        try {
            // let filesandfolders = await readdirAsync('/userdata/');
            // for (let i = 0; i < filesandfolders.length; i++) {
            //     const faf = filesandfolders[i];
            //     let stats = await statAsync(path.join('/userdata/',faf));
            //     try {
            //         if(stats.isDirectory()) await rmAsync(path.join('/userdata/',faf), {force:true, recursive:true});
            //         else await unlinkAsync(path.join('/userdata/',faf));
                        
            //     } catch (error) {
            //         this.error(error);                    
            //     }
            // }

            //let filesandfolders1 = await readdirAsync(`/userdata/downloads/`);

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

            //await device.ftpClient.downloadTo(stream, (file.path.length ? file.path + '/' : '') + name);
            await device.ftpClient.downloadTo(stream, file.id);
            stream = null;
            //global.gc();
            await device.ftpClient.refresh();
            buf = Buffer.concat(buf);
                //buf.

                //base64 = buf.toString('base64');                
            //buf = null;
            //}
            //global.gc();

            let randomId = randomBytes(24).toString('hex');
            let id = device.id + file.id;// randomBytes(12).toString('hex');
            id = encodeURIComponent(id);
            let url = 'http://' + this.homey.app.ip + ":47335/file/" + id;
            let useUrl;
            let path;

            if(type=='url') useUrl = device.settings.urlforurls;
            else if(type=='download') useUrl = device.settings.urlforfiles;
            
            if(useUrl==='cloudssl' || useUrl==='localssl') {
                //id = 'downloads/'+ randomId + '/' + name.replaceAll(' ', '_');// '%20'); //dont encode this id.
                if(type==='url') 
                {
                    id = 'downloads/'+ randomId + '/' + randomBytes(8).toString('hex') + '.' + BL._.last(name.split('.')) ; //encodeURIComponent(encodeURIComponent(name));
                    url = `app/nl.qluster-it.FtpClient/userdata/` + id;
                }
                
                if(type==='download') {
                    id = 'downloads/'+ randomId + '/' + encodeURIComponent(name);
                    url = `app/nl.qluster-it.FtpClient/userdata/` + 'downloads/'+ randomId + '/' + encodeURIComponent(encodeURIComponent(name));
                }
                
                    //id = 'downloads/'+ randomId + '/' + encodeURIComponent(encodeURIComponent(name));

                this.log('new id', id);
            }

            //args.device.settings.urlforicons

            if (!this.fileDownloads) this.fileDownloads = {};

            let deleteFile = async (fileObject) => {
                clearTimeout(fileObject.timeout);
                delete fileObject.timeout;
                if(fileObject.randomId)  {
                    this.log('deleting file');
                    if ((await existsAsync(`/userdata/downloads/${fileObject.randomId}`))) await rmAsync(`/userdata/downloads/${fileObject.randomId}`, {force:true, recursive:true});                
                }
                // if(fileObject.token)  {
                //     this.log('deleting token');
                //     await this.homey.flow.unregisterToken(fileObject.token);
                // }
                if(fileObject.image)  {
                    this.log('deleting image');
                    await this.homey.images.unregisterImage(fileObject.image);
                }
                
                
            };

            if (this.fileDownloads[id] && this.fileDownloads[id].timeout) {
                await deleteFile(this.fileDownloads[id]);
                 
            }

            this.fileDownloads[id] = { name: name, id };
            
            let token, image;
            if(useUrl==='cloudssl' || useUrl==='localssl' || createToken) {
                this.fileDownloads[id].randomId = randomId;
                if (!(await existsAsync(`/userdata/downloads/${randomId}/`))) await mkdirAsync(`/userdata/downloads/${randomId}/`, {recursive:true});
                path = `/userdata/${id}`;
                await writeFileAsync(path, buf);
                
                this.log('writefile', path);
                if(createToken) {
                    this.fileDownloads[id].image = await this.homey.images.createImage();
                    this.fileDownloads[id].image.setPath(path);
                    // this.fileDownloads[id].token = await this.homey.flow.createToken(randomBytes(12).toString('hex'), {
                    //     type: "image",
                    //     title: file.name,
                    //   });                  
                    //   await this.fileDownloads[id].token.setValue(this.fileDownloads[id].image);
                }

               // let filesandfolders = await readdirAsync(`/userdata/downloads/${randomId}/`);

            } 
            
            if(useUrl==='local') {
                //this.fileDownloads[id].base64 = buf.toString('base64');
                this.fileDownloads[id].buffer = buf;
                //if(createToken) throw new Error('To get image tokens');
            }
            if (useUrl==='localssl') url = `https://${this.homey.app.ip.replaceAll('.', '-')}.homey.homeylocal.com/` + url;
            else if  (useUrl==='cloudssl') url = `https://${this.homey.app.cloudId}.connect.athom.com/` + url;
            buf = null;
            //global.gc();
            
            this.fileDownloads[id].timeout = setTimeout((async (id) => {
                await deleteFile(this.fileDownloads[id]);
            }).bind(this, id), device.settings.downloadtime * 1000);
            
            return { id, url, path, image:this.fileDownloads[id].image }; //base64 //, token:this.fileDownloads[id].token

        } catch (error) {
            this.error(error);
            throw error;
        }
    }
};