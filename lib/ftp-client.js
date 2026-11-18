// basic-ftp (with tls) is loaded on the first FTP connection.
let basicFtp;
const { Defer } = require("./proto");
const { getRootPath, resolvePath } = require('./ftp-paths');

module.exports = class FtpClient {
    
  init({homey, ip, port, username, password, secure, allow_incorrect_certificate, workdirectory, timeout}) {
    if(homey) this.homey = homey;
    const root = getRootPath(workdirectory, this.homey.__ && this.homey.__.bind(this.homey));
    this.ip = ip;
    this.port = port;
    this.username = username;
    this.password = password;
    this.secure = secure;
    this.allow_incorrect_certificate = allow_incorrect_certificate;
    this.timeout = timeout;
    this.workdirectory = root;
    
    if(this.client) {
      try {
        this.client.close();
      } catch (error) { }
      delete this.client;      
    }
    
  }

  async exec({action, oneTry, createTransferStream}, a,b,c,d,e) {
    const args = [a,b,c,d,e];
    const pathArguments = {
      list: [0], cd: [0], ensureDir: [0], remove: [0], removeDir: [0],
      rename: [0, 1], uploadFrom: [1], downloadTo: [1]
    };
    const translate = this.homey.__ && this.homey.__.bind(this.homey);
    for (const index of pathArguments[action] || []) {
      args[index] = resolvePath(this.workdirectory, args[index], translate);
      if (this.workdirectory && args[index] === this.workdirectory &&
          ['remove', 'removeDir', 'rename', 'uploadFrom', 'downloadTo'].includes(action)) {
        throw new Error(translate ? translate('errors.rootProtected') : 'Choose a file or subfolder inside the configured root directory.');
      }
    }
    const previous = this._exec;
    let defer = new Defer();
    this._exec = defer.promise;
    let ftp;
    const execute = () => {
      if (createTransferStream) args[0] = createTransferStream();
      return ftp[action](...args);
    };
    try {
      if(previous) await previous;
      ftp = await this.getClient();
      await ftp.cd('/');
      // await ftp.cdup();
      // console.log(await ftp.pwd());
      // await ftp.cd('./');
      // console.log(await ftp.pwd());
      // await ftp.cd('..');
      // console.log(await ftp.pwd());
      return await execute();
    } catch (error) {
      this.homey.error(error);
      if(oneTry) throw error;
      ftp = await this.getClient({refresh:true});
      await ftp.cd('/');
      return await execute();
    }
    finally {
      if (this._exec === defer.promise) delete this._exec;
      defer.resolve();
    }
  }

  async downloadTo(a,b) {
    return await this.exec({ action: 'downloadTo' }, a, b);
  }

  async cd(a,b) {
    return await this.exec({ action: 'cd' }, a, b);
  }


  async getList({path, oneTry} = {path:''}) {
    return await this.exec({ action: 'list', oneTry }, path);
  }

  async getFeatures() {
    let ftp = await this.getClient();
    try {      
      return await ftp.features();
    } catch (error) {
      ftp = await this.getClient({refresh:true});
      return await ftp.features();
    }
  }

  async getLogin() {
    let ftp = await this.getClient();
    try {      
      return await ftp.login(this.username, this.password);
    } catch (error) {
      // ftp = await this.getClient({refresh:true});
      // return await ftp.login(this.username, this.password);
    }
  }
  // async isConnected() {
  //   let ftp = await this.getClient();
  //   try {      
  //     return await ftp.connect();
  //   } catch (error) {
  //     ftp = await this.getClient({refresh:true});
  //     return await ftp.connect();
  //   }
  //   return false;
  // }

  async refresh() {
    return this.getClient({refresh:true});
  }

  async getClient({refresh}={}) {
    if(refresh && this.client) {
      try {
        this.client.close();
      } catch (error) { }
      delete this.client;
    }
    if(!this.client) {
      const client = this.client = new (basicFtp || (basicFtp = require('basic-ftp'))).Client(this.timeout);
      client.ftp.verbose = process.env.DEBUG === '1';
      try {
          let r = await client.access({
              host: this.ip,
              port:this.port,
              user: this.username,
              password: this.password,
              secure: this.secure,
              secureOptions: {
                rejectUnauthorized : this.allow_incorrect_certificate===true ? false : true
              }
          });
        //   let _list = await this.client.list();
        //   await this.client.prepareTransfer(this.client.ftp);
          
        //  // let acct = await this.client.sendIgnoringError('ACCT');
        //  let siteHelp = await this.client.sendIgnoringError('STIE HELP');
        //  let help = await this.client.sendIgnoringError('HELP');
        //  let stat = await this.client.sendIgnoringError('STAT');
        //  let feat = await this.client.sendIgnoringError('FEAT');

        //   let _MLSD = await this.client._requestListWithCommand('MLSD');

        //   let MLSD = await this.client.sendIgnoringError('MLSD');
        //   let list_a = await this.client.sendIgnoringError('LIST -a');
        //   let list = await this.client.sendIgnoringError('LIST');
          //console.log(r);
        }
        catch(err) {
            client.close();
            if (this.client === client) delete this.client;
            this.homey.error('FTP connection failed', err);
            throw err;
        }
    }
    return this.client;
  }

  close() {
    if(this.client) {
      try {
        this.client.close();
      } catch (error) { }
      delete this.client;
    }
  } 
};