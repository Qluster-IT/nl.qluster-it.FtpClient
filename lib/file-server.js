const http = require('http');



class FileServer  {
  
  
  close() {
    if(this.server) this.server.close(((err) =>{
      if(!err); this.server = null;
    }).bind(this));
  }

  init (homey) {
    this.homey = homey;
    let driver = homey.drivers.getDriver('ftpclient');
    this.server = http.createServer((function (req, res) {
      try {
          
        if(!req.headers || !req.headers.host || req.headers.host  != this.homey.app.ip + ':47335') return return404();
        
        if (req.url.startsWith('/status')) {
          return return200();
        }

        if (req.url.slice(0, 6) !== '/file/') {
          return return404();
        }

        var id = req.url.substr(6).split('/');
        let file = driver.fileDownloads[id];
        if(!file) return return404();
        let buf = Buffer.from(file.base64, 'base64');
        
        return returnBinary(res, buf);
      
      } catch (error) {
        console.log(error);
      }

      function returnBinary(res, b) {
        //console.log('write response buffer');
        res.writeHead(200, {'content-type' : 'application/octet-stream'});
        res.write(b, 'binary');
        res.end(null, 'binary');
      }



      
      function return200() {
        res.writeHead(200, {
          //'Content-Type': 'application/json'
        });
        res.end();
      }

      function return404() {
        res.writeHead(404, {
          //'Content-Type': 'application/json'
        });
        res.end();
      }


    
    }).bind(this)).listen(47335);//, '127.0.0.1')
  }
}

module.exports = FileServer;