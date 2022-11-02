const ftp = require("basic-ftp") ;
const { Defer } = require("./proto");

module.exports = class FtpClient {
    
  async init({homey, ip, port, username, password, secure}) {
    if(homey) this.homey = homey;
    this.ip = ip;
    this.port = port;
    this.username = username;
    this.password = password;
    this.secure = secure;
    
    if(this.client) {
      try {
        this.client.close();
      } catch (error) { }
      delete this.client;      
    }
    
  }

  async exec({action, oneTry}, a,b,c,d,e) {
    if(this._exec) await this._exec;
    let defer = new Defer();
    this._exec = defer.promise;
    let ftp = await this.getClient();
    try {
      try {        
        await ftp.cd('/');
        console.log("------------------ await ftp.pwd() ------------------");
        console.log(await ftp.pwd());
      } catch (error) {
        this.homey.error(error);
        
      }
      // await ftp.cdup();
      // console.log(await ftp.pwd());
      // await ftp.cd('./');
      // console.log(await ftp.pwd());
      // await ftp.cd('..');
      // console.log(await ftp.pwd());
      return await ftp[action](a,b,c,d,e);
    } catch (error) {
      this.homey.error(error);
      if(oneTry) throw error;
      ftp = await this.getClient({refresh:true});
      try {        
        await ftp.cd('');
        console.log(await ftp.pwd());
      } catch (error2) {
        this.homey.error(error2);
        
      }
      return await ftp[action](a,b,c,d,e);
    }
    finally {
      console.log('finally');

      delete this._exec;
      defer.resolve();
    }
  }

  async downloadTo(a,b) {
    let ftp = await this.getClient();
    try {      
      return await ftp.downloadTo(a,b);
    } catch (error) {
      ftp = await this.getClient({refresh:true});
      return await ftp.downloadTo(a,b);
    }
  }

  async cd(a,b) {
    let ftp = await this.getClient();
    try {      
      return await ftp.cd(a,b);
    } catch (error) {
      ftp = await this.getClient({refresh:true});
      return await ftp.cd(a,b);
    }
  }


  async getList({path, oneTry} = {path:''}) {
    let ftp = await this.getClient();
    try {      
      return await ftp.list(path);
    } catch (error) {
      if(oneTry) throw error;
      ftp = await this.getClient({refresh:true});
      return await ftp.list(path);
    }
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
      this.client = new ftp.Client();
      this.client.ftp.verbose = true;
      try {
          let r = await this.client.access({
              host: this.ip,
              port:this.port,
              user: this.username,
              password: this.password,
              secure: this.secure
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
            console.log(err);
        }
    }
    return this.client;
  }

  close() {
    if(this.client) this.client.close();
  } 
};