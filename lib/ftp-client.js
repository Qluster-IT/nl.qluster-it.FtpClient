const ftp = require("basic-ftp") ;

module.exports = class FtpClient {
    
  async init({homey, ip, port, username, password, secure}) {
    this.homey = homey;
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

  
  async downloadTo(a,b) {
    let ftp = await this.getClient();
    try {      
      return await ftp.downloadTo(a,b);
    } catch (error) {
      ftp = await this.getClient({refresh:true});
      return await ftp.downloadTo(a,b);
    }
  }


  async getList({path} = {path:''}) {
    let ftp = await this.getClient();
    try {      
      return await ftp.list(path);
    } catch (error) {
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
          await this.client.access({
              host: this.ip,
              port:this.port,
              user: this.username,
              password: this.password,
              secure: this.secure
          });
          //console.log(await this.client.list());
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