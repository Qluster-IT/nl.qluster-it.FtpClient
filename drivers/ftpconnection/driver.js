"use strict";
const { randomBytes } = require('crypto');
const Homey = require('homey');
const { Readable } = require('stream');
const { createReadStream } = require('fs');
const { tmpdir } = require('os');
const FileServer = require('../../lib/file-server');
const DownloadCache = require('../../lib/download-cache');
const UploadSpool = require('../../lib/upload-spool');
const openSyslogExport = require('../../lib/syslog-export');
const createUrlSource = require('../../lib/url-source');
const FtpClient = require('../../lib/ftp-client');
const FtpClientDevice = require('./device');
const { BL, Defer } = require('betterlogiclibrary');
const Icons = require('../../lib/icons');
const { getRootPath, resolvePath } = require('../../lib/ftp-paths');


const path = require('path');
const { createBufferWriter } = require('../../lib/proto');

function base64Stream(value) {
    return Readable.from((function* () {
        // Four-character boundaries preserve Base64 groups; whitespace is ignored as before.
        let carry = '';
        for (let offset = 0; offset < value.length; offset += 64 * 1024) {
            const part = carry + value.slice(offset, offset + 64 * 1024).replace(/[^A-Za-z0-9+/_=-]/g, '');
            const padding = part.indexOf('=');
            const end = padding === -1 ? part.length - part.length % 4 : padding;
            if (end) yield Buffer.from(part.slice(0, end), 'base64');
            if (padding !== -1) return;
            carry = part.slice(end);
        }
        if (carry) yield Buffer.from(carry, 'base64');
    })(), { objectMode: false });
}

module.exports = class FtpClientDriver extends Homey.Driver {

    async onUninit() {
        if(this.fileServer) this.fileServer.close();
        const files = this.fileDownloads;
        this.fileDownloads = Object.create(null);
        await Promise.all(Object.values(files || {}).map(entry => this.removeDownload(entry)));
        if (this.uploadSpool) await this.uploadSpool.close();
    }
    async onInit() {
        this.log('FtpClientDriver onInit');
        this.homey.flow.getActionCard('ftp_check_connection').registerRunListener(async ({ device }) => {
            if (!await device.checkConnection()) throw new Error(this.homey.__('monitor.connectionFailed'));
            return true;
        });
        this.homey.flow.getActionCard('ftp_clear_transfer_error').registerRunListener(async ({ device }) => {
            await device.clearTransferError();
            return true;
        });
        this.homey.flow.getConditionCard('ftp_is_ready').registerRunListener(({ device }) => device.isFtpReady());
        this.homey.flow.getConditionCard('ftp_transfer_error_active').registerRunListener(({ device }) => device.hasTransferError());

        this.fileServer = new FileServer();
        this.fileServer.init(this.homey);

        // let filesandfolders = await readdirAsync('./');

        // let filesandfoldersdonwloads = await readdirAsync('./..');


        this.downloadCache = new DownloadCache({
            localRoot: path.join(tmpdir(), 'nl.qluster-it.FtpClient-downloads'),
            sslRoot: '/userdata/downloads'
        });
        this.downloadReady = this.downloadCache.init();
        await this.downloadReady;
        this.uploadSpool = new UploadSpool(path.join(tmpdir(), 'nl.qluster-it.FtpClient-uploads'),
            error => this.error('Temporary upload cleanup failed', error));
        await this.uploadSpool.init();

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
                if (args && args.file && args.file.isFile !== 'true' && args.file.isFile !== true) throw new Error(this.homey.__('errors.fileRequired'));
                const defer = new Defer();

                const link = await BL.getDownloadUrl({ contentType: '*/*', filename:args.file.filename });
                this.homey.setTimeout(async () => {
                    try {
                        let file = await this.getFile({ file: args.file, device: args.device  });
                        
                        await BL.setDownloadUrl({ link, buffer:file.buffer, callback: ()=> {
                            defer.resolve({url : encodeURI(link.localUrl), cloudUrl : encodeURI(link.cloudUrl)});
                        } });
                    } catch (error) {
                        defer.reject(error);
                    }
                }, 0);

                return defer.promise;                

            } catch (error) {
                throw typeof (error) === 'string' ? new Error(error) : error;
            }

        });
        action_ftpconnection_get_url.getArgument('file').registerAutocompleteListener(async (query, args) => {
            return this.getFiles({ file: args.file, query, device: args.device });
        });


        const action_ftpclient_get_imagetoken = this.homey.flow.getActionCard('action_ftpclient_get_imagetoken');
        action_ftpclient_get_imagetoken.registerRunListener(async (args) => {
            try {
                if ((!args.image && !args.path) || (args && args.image && args.image.isFile !== 'true' && args.image.isFile !== true && (!args.path || !args.path.length)))
                    throw new Error(this.homey.__('errors.imageRequired'));

                args.path = await BL.decode(args.path);

                let path = args.path;
                if (args.image) {
                    if (args.image.isDirectory) path = args.image.id + (path && path.length ? (!path.startsWith('/') ? '/' : '') + path : '');
                    else path = args.image.id;
                }

                //this.log('action_ftpclient_get_imagetoken args.image: ', typeof(args.image), args.image);
                //this.log('action_ftpclient_get_imagetoken args.path: ', args.path);

                if (!args.image || args.image === 'undefined' || (args.path && args.path.length)) {
                    const files = await this.getFiles({ path, device: args.device, includeDiretories: false });
                    args.image = BL._.first(files);
                }
                let fileInfo = await this.getFileUrl({ file: args.image, device: args.device, type: 'url', createToken: true });

                return { image: fileInfo.image };

            } catch (error) {
                throw typeof (error) === 'string' ? new Error(error) : error;
            }

        });
        action_ftpclient_get_imagetoken.getArgument('image').registerAutocompleteListener(async (query, args) => {
            return this.getFiles({ file: args.image, query, device: args.device });
        });


        const action_ftpclient_save_imagetoken = this.homey.flow.getActionCard('action_ftpclient_save_imagetoken');
        action_ftpclient_save_imagetoken.registerRunListener(async (args) => {
            try {
                if ((!args.directory && !args.path) || (args && args.directory && args.directory.isDirectory !== 'true' && args.directory.isDirectory !== true && (!args.path || !args.path.length)))
                    throw new Error(this.homey.__('errors.pathRequired'));

                //let time = Date.now();
                args.path = await BL.decode(args.path);
                //BL.homey.log('BL.decode time: ', Date.now() - time);

                let path = args.path;
                if (args.directory) {
                    if (args.directory.isDirectory) path = args.directory.id + (path && path.length ? (!path.startsWith('/') ? '/' : '') + path : '');
                    else path = args.directory.id;
                }
                await this.saveFile({ device: args.device, path, getStream: () => args.droptoken.getStream() });
                return true;
                // let files = await this.getFiles({file:args.directory, device:args.device, includeDiretories:false });
                // files = BL._.map(files, x=>x.id);

                // return {files:JSON.stringify(files)};

            } catch (error) {
                throw typeof (error) === 'string' ? new Error(error) : error;
            }

        });
        action_ftpclient_save_imagetoken.getArgument('directory').registerAutocompleteListener(async (query, args) => {
            return this.getFiles({ file: args.directory, query, device: args.device, type: 'folder' });
        });


        const action_ftpclient_save_file_base64 = this.homey.flow.getActionCard('action_ftpclient_save_file_base64');
        action_ftpclient_save_file_base64.registerRunListener(async (args) => {
            try {
                if ((!args.directory && !args.path) || (args && args.directory && args.directory.isDirectory !== 'true' && args.directory.isDirectory !== true && (!args.path || !args.path.length)))
                    throw new Error(this.homey.__('errors.pathRequired'));

                args.path = await BL.decode(args.path);

                let path = args.path;
                if (args.directory) {
                    if (args.directory.isDirectory) path = args.directory.id + (path && path.length ? (!path.startsWith('/') ? '/' : '') + path : '');
                    else path = args.directory.id;
                }
                if (typeof args.file !== 'string') throw new TypeError(this.homey.__('repair.uploadFailed'));
                await this.saveFile({ device: args.device, path, getStream: () => base64Stream(args.file) });
                return true;
                // let files = await this.getFiles({file:args.directory, device:args.device, includeDiretories:false });
                // files = BL._.map(files, x=>x.id);

                // return {files:JSON.stringify(files)};

            } catch (error) {
                throw typeof (error) === 'string' ? new Error(error) : error;
            }

        });
        action_ftpclient_save_file_base64.getArgument('directory').registerAutocompleteListener(async (query, args) => {
            return this.getFiles({ file: args.directory, query, device: args.device, type: 'folder' });
        });

        const action_ftpclient_save_syslog_export = this.homey.flow.getActionCard('action_ftpclient_save_syslog_export');
        action_ftpclient_save_syslog_export.registerRunListener(async ({ device, format, directory, path }) => {
            const destination = await this.getSaveDestination(directory, path);
            await this.saveFile({ device, path: destination, prepare: () => openSyslogExport(this.homey, format) });
            return true;
        });
        action_ftpclient_save_syslog_export.getArgument('directory').registerAutocompleteListener((query, args) =>
            this.getFiles({ file: args.directory, query, device: args.device, type: 'folder' }));

        const saveFileFromUrl = this.homey.flow.getActionCard('action_ftpclient_save_file_from_url');
        saveFileFromUrl.registerRunListener(async ({ device, url, directory, path }) => {
            const destination = await this.getSaveDestination(directory, path);
            const getStream = createUrlSource(url);
            await this.saveFile({ device, path: destination, getStream });
            return true;
        });
        saveFileFromUrl.getArgument('directory').registerAutocompleteListener((query, args) =>
            this.getFiles({ file: args.directory, query, device: args.device, type: 'folder' }));

        const action_ftpclient_get_files = this.homey.flow.getActionCard('action_ftpclient_get_files');
        action_ftpclient_get_files.registerRunListener(async (args) => {
            try {
                if (args && args.directory && args.directory.isDirectory !== 'true' && args.directory.isDirectory !== true) throw new Error(this.homey.__('errors.folderRequired'));

                let files = await this.getFiles({ file: args.directory, device: args.device, includeDiretories: false });
                files = BL._.map(files, x => x.name);
                // let fileInfo = await this.getFileUrl({file:args.image, device:args.device, type:'url', createToken:true});

                return { files: JSON.stringify(files) };

            } catch (error) {
                throw typeof (error) === 'string' ? new Error(error) : error;
            }

        });
        action_ftpclient_get_files.getArgument('directory').registerAutocompleteListener(async (query, args) => {
            return this.getFiles({ file: args.directory, query, device: args.device, type: 'folder' });
        });

    }

    async getFiles({ type, file, query, device, includeDiretories = true, path } = { includeDiretories: true }) {
        path = path || (file ? (file.isDirectory === 'true' || file.isDirectory === true ? file.id : file.path) : query) || '';
        const root = getRootPath(device.settings.workdirectory);
        path = resolvePath(root, path, this.homey.__ && this.homey.__.bind(this.homey));
        const displayPath = remotePath => {
            const relative = (root ? remotePath.slice(root.length) : remotePath).replace(/^\/+/, '');
            return relative;
        };
        let pathsAbove = path.split('/');
        pathsAbove.pop();
        let pathAbove = pathsAbove.join('/');
        const iconPath = '/app/nl.qluster-it.FtpClient/drivers/ftpconnection/assets/icons/ext/';
        const startUrl = device.settings.urlforicons === 'local'
            ? `http://${this.homey.app.ip}${iconPath}`
            : device.settings.urlforicons === 'cloudssl'
                ? `https://${this.homey.app.cloudId}.connect.athom.com${iconPath}`
                : `https://${this.homey.app.ip.replaceAll('.', '-')}.homey.homeylocal.com${iconPath}`;

        let r = await device.ftpClient.exec({ action: 'list' }, path);

        //r = r.map(x => { return { id: `${path}${path ? '/' : ''}${x.name}`, filename:x.name, name: `${path}${path ? '/' : ''}${x.name}`, path, description: path, isDirectory: x.isDirectory, isFile: x.isFile }; });
        r = r.map(x => {
            let p = x.name;
            let id = x.name;
            let filename;
            if (x.isFile) filename = BL._.last(x.name.split('/'));
            if (x.isFile && x.name === path) {
                p = p.split('/'); p.pop(); p = p.join('/');
            }
            else {
                //if(x.isFile) full                
                p = (path && path.length ? path + '/' : '') + p;
                id = p;
            }
            return { id: id, filename: filename, name: displayPath(id) || '/', path: p, description: displayPath(path), isDirectory: x.isDirectory, isFile: x.isFile };
        });
        r = BL._.orderBy(r, x => (x.isDirectory ? '0.' : '1.') + x.name);
        if (type) r = BL._.filter(r, x => (x.isDirectory && includeDiretories) || Icons.getFileType(x).includes(type));

        if (includeDiretories && path && path.length && path !== root) r.unshift({ id: pathAbove, name: displayPath(pathAbove) || '/', description: '..', isDirectory: true, isFile: false });
        BL._.each(r, (x) => {
            x.image = startUrl + Icons.getIconsFromFile(x);
        });

        return r;
    }

    // This method is called when a user is adding a device
    // and the 'list_devices' view is called
    async onPairListDevices(deviceName) {//}, withIcon) {
        let id = randomBytes(12).toString('hex');

        let device = {
            name: this.homey.__('pair.custom'),
            data: {
                id: 'FtpClient' + id
            },
            custom: true
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
                settings: { ip: discoveryResult.address, port: discoveryResult.port, username: "", password: "" }
            });
        });



        let ftpClientMWS = new FtpClient();
        ftpClientMWS.init({

            homey: this.homey, ip: this.homey.app.ip, port: 5081
        });
        try {
            let isConnected = await ftpClientMWS.getFeatures();//{ip: this.homey.app.ip, port: 5081 });
            if (isConnected) {
                devs.push({ name: 'Micro Web Server', data: { id: 'FtpClientMWS' }, settings: { ip: this.homey.app.ip, port: 5081, username: 'anonymous', password: "" } });
            }
        } catch (error) {
            if (error.code !== 'ECONNREFUSED') this.error('Micro Web Server FTP discovery failed', error);
        }
        finally { ftpClientMWS.close(); }

        let ftpClientHFS = new FtpClient();
        ftpClientHFS.init({
            homey: this.homey, ip: this.homey.app.ip, port: 2100
        });
        try {
            let isConnected = await ftpClientHFS.getFeatures();//{ip: this.homey.app.ip, port: 5081 });
            if (isConnected) {
                devs.push({ name: 'HTTP/FTP Server', data: { id: 'FtpClientHFS' }, settings: { ip: this.homey.app.ip, port: 2100, username: "", password: "" } });
            }
        } catch (error) {
            if (error.code !== 'ECONNREFUSED') this.error('HTTP/FTP Server discovery failed', error);
        }
        finally { ftpClientHFS.close(); }


        devs.push(device);
        BL._.each(devs, d => {
            d.store = { id: randomBytes(12).toString('hex') };
        });
        return devs;

    }

    async checkPairConnection(settings) {
        const ftpClient = new FtpClient();
        try {
            for (const secure of [true, false]) {
                try {
                    const connection = { ...settings, secure, allow_incorrect_certificate: false };
                    ftpClient.init({ homey: this.homey, ...connection });
                    await ftpClient.exec({ action: 'list', oneTry: true });
                    return connection;
                } catch (error) {
                    if (!secure) throw error;
                }
            }
        } finally {
            ftpClient.close();
        }
    }

    async onPair(session) {
        let device;
        let connected = false;
        session.setHandler('list_devices', () => this.onPairListDevices());
        session.setHandler('list_devices_selection', async selectedDevices => {
            device = selectedDevices[0];
            connected = false;
        });
        session.setHandler('getConnectionSettings', async () => ({
            ip: device.settings && device.settings.ip || '',
            port: device.settings && device.settings.port || 21
        }));
        session.setHandler('setConnectionSettings', async ({ ip, port }) => {
            if (typeof ip !== 'string' || !ip.trim() || !Number.isInteger(port) || port < 1 || port > 65535) {
                throw new Error(this.homey.__('pair.invalidConnection'));
            }
            device.settings = { ...device.settings, ip: ip.trim(), port };
            connected = false;
        });
        session.setHandler('showView', async view => {
            if (view !== 'loading_credentials') return;
            if (device.custom) return session.showView('connection');
            try {
                device.settings = await this.checkPairConnection({
                    ...device.settings, username: device.settings.username || 'anonymous'
                });
                connected = true;
                return session.showView('root_directory');
            } catch (error) {
                return session.showView('login_credentials');
            }
        });
        session.setHandler('login', async ({ username, password }) => {
            connected = false;
            try {
                device.settings = await this.checkPairConnection({ ...device.settings, username, password });
                connected = true;
                return true;
            } catch (error) {
                return false;
            }
        });
        session.setHandler('getRootDirectory', async () => device.settings.workdirectory || '');
        session.setHandler('setRootDirectory', async workdirectory => {
            if (!connected) throw new Error(this.homey.__('pair.loginRequired'));
            const root = getRootPath(workdirectory, this.homey.__.bind(this.homey));
            const ftpClient = new FtpClient();
            try {
                ftpClient.init({ homey: this.homey, ...device.settings, workdirectory: root });
                await ftpClient.exec({ action: 'list', oneTry: true }, root);
                device.settings.workdirectory = root;
                return { name: device.name, data: device.data, store: device.store, settings: device.settings };
            } finally {
                ftpClient.close();
            }
        });
    }

    /**
     * 
     * @param {*} session 
     * @param {FtpClientDevice} device 
     */
    async onRepair(session, device) {
        let id = device.getData().id || device.id;

        session.setHandler('getRootPath', async () => {
            return getRootPath(device.getSettings().workdirectory, this.homey.__ && this.homey.__.bind(this.homey));
        });

        session.setHandler('getContent', async ({ path } = { path: '' }) => {
            path = resolvePath(device.getSettings().workdirectory, path, this.homey.__ && this.homey.__.bind(this.homey));
            const list = await device.ftpClient.exec({ action: 'list' }, path);
            return list.map(x => {
                const id = (path ? path + '/' : '') + x.name;
                return { id, name: x.name, isDirectory: x.isDirectory, isFile: x.isFile, size: x.size, rawModifiedAt: x.rawModifiedAt, children: [], path, fullPath: id };
            });
        });
        session.setHandler('moveItem', ({ item, targetDirectory }) =>
            device.ftpClient.exec({ action: 'rename' }, item.id, targetDirectory.id + '/' + item.name));
        session.setHandler('deleteDirectory', async ({ directory }) => {
            try {
                return await device.ftpClient.exec({ action: 'removeDir' }, directory.id);
            } catch (error) {
                if (!/^[45]\d\d$/.test(String(error.code))) throw error;
                return device.ftpClient.exec({ action: 'remove' }, directory.id);
            }
        });
        session.setHandler('renameDirectory', ({ directory }) =>
            device.ftpClient.exec({ action: 'rename' }, directory.id, (directory.path ? directory.path + '/' : '') + directory.renameName));
        session.setHandler('addDirectory', ({ directory, name }) =>
            device.ftpClient.exec({ action: 'ensureDir' }, (directory.id ? directory.id + '/' : '') + name));
        session.setHandler('deleteFile', async ({ file }) => {
            await device.ftpClient.exec({ action: 'remove' }, file.id);
            return true;
        });
        session.setHandler('renameFile', ({ file }) =>
            device.ftpClient.exec({ action: 'rename' }, file.id, (file.path ? file.path + '/' : '') + file.renameName));

        session.setHandler('getFileUrl', async ({ file }) => {
            return await this.getFileUrl({ file, device, type: 'download' });
        });


        session.setHandler('uploadFiles', async ({ directory, name, size }) => {
            const workdirectory = device.getSettings().workdirectory;
            const translate = this.homey.__.bind(this.homey);
            if (typeof name !== 'string' || !name || /[/\\\0\r\n]/.test(name) || name === '.' || name === '..') {
                throw new Error(translate('repair.uploadFailed'));
            }
            const folder = resolvePath(workdirectory, directory.id, translate);
            const destination = folder ? `${folder.replace(/\/$/, '')}/${name}` : name;
            return this.uploadSpool.start({
                size, limitMessage: translate('repair.uploadFailed'),
                upload: source => this.runTransfer(device, 'upload', destination, () =>
                    this.uploadStream(device, destination, () => createReadStream(source)))
            });
        });

    }

    async runTransfer(device, operation, path, transfer) {
        try {
            return await transfer();
        } catch (error) {
            try {
                await device.reportTransferError(operation, path, error);
            } catch (reportError) {
                this.error('FTP transfer failure notification failed', reportError);
            }
            throw error;
        }
    }

    async getSaveDestination(directory, path) {
        const filename = await BL.decode(path);
        if (typeof filename !== 'string' || ['', '.', '..'].includes(filename.split('/').pop().trim())) {
            throw new Error(this.homey.__('errors.pathRequired'));
        }
        if (directory && (typeof directory.id !== 'string' || ![true, 'true'].includes(directory.isDirectory))) {
            throw new Error(this.homey.__('errors.folderRequired'));
        }
        return directory?.id ? `${directory.id}/${filename.replace(/^\/+/, '')}` : filename;
    }

    async saveFile({ path, device, getStream, prepare }) {
        return this.runTransfer(device, 'upload', path, async () => {
            const destination = resolvePath(device.settings.workdirectory, path, this.homey.__ && this.homey.__.bind(this.homey));
            const parentPath = destination.slice(0, Math.max(0, destination.lastIndexOf('/')));
            const source = prepare ? await prepare() : getStream;
            await device.ftpClient.exec({ action: 'ensureDir' }, parentPath);
            return this.uploadStream(device, destination, source);
        });
    }

    uploadStream(device, destination, getStream) {
        return device.ftpClient.exec({
            action: 'uploadFrom',
            createTransferStream: () => Readable.from((async function* () {
                yield* await getStream();
            })(), { objectMode: false })
        }, undefined, destination);
    }

    async getFile({ file, device }) {
        return this.runTransfer(device, 'download', file.id, async () => {
            let writer;
            await device.ftpClient.exec({
                action: 'downloadTo',
                createTransferStream: () => {
                    writer = createBufferWriter();
                    return writer.stream;
                }
            }, undefined, file.id);
            return { buffer: writer.toBuffer() };
        });
    }

    async getFileUrl({ file, device, type, createToken }) {
        await this.downloadReady;
        const name = file.filename || file.name;
        const mode = (type === 'url' ? device.settings.urlforurls : device.settings.urlforfiles) || 'local';
        const ssl = mode === 'localssl' || mode === 'cloudssl';
        const key = randomBytes(24).toString('hex');
        const filename = encodeURIComponent(name);
        const extension = path.posix.extname(name).match(/^\.[a-z0-9]{1,16}$/i)?.[0] || '';
        const storedName = type === 'url' ? randomBytes(8).toString('hex') + extension
            : filename && filename !== '.' && filename !== '..' ? filename : 'download';
        const id = ssl ? `downloads/${key}/${storedName}` : key;
        const localHost = this.homey.app.ip;
        const httpsHost = mode === 'cloudssl' ? `${this.homey.app.cloudId}.connect.athom.com`
            : `${localHost.replaceAll('.', '-')}.homey.homeylocal.com`;
        const url = ssl ? `https://${httpsHost}/app/nl.qluster-it.FtpClient/userdata/downloads/${key}/${encodeURIComponent(storedName)}`
            : `http://${localHost}:47335/file/${id}`;
        const entry = await this.runTransfer(device, 'download', file.id, () => this.downloadCache.download({
            id: key, name: storedName, ssl,
            limitMessage: this.homey.__('errors.downloadCacheFull'),
            transfer: createTransferStream => device.ftpClient.exec({ action: 'downloadTo', createTransferStream }, undefined, file.id)
        }));
        try {
            if (createToken) {
                entry.image = await this.homey.images.createImage();
                await entry.image.setPath(entry.path);
            }
        } catch (error) {
            await this.removeDownload(entry);
            throw error;
        }
        this.fileDownloads ??= Object.create(null);
        entry.local = !ssl;
        this.fileDownloads[id] = entry;
        entry.timeout = setTimeout(() => {
            delete this.fileDownloads[id];
            return this.removeDownload(entry);
        }, device.settings.downloadtime * 1000);
        return { id, url, path: ssl || createToken ? entry.path : undefined, image: entry.image };
    }

    async removeDownload(entry) {
        clearTimeout(entry.timeout);
        if (entry.image) {
            try {
                await this.homey.images.unregisterImage(entry.image);
            } catch (error) {
                this.error('Could not unregister download image', error);
            }
        }
        try {
            await this.downloadCache.remove(entry);
        } catch (error) {
            this.error('Could not remove temporary download', error);
        }
    }
};