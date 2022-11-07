
const { BL } = require('./bll/bll-loader');

module.exports = class Icons {
    static getIconsFromFile(file) {
        
        if(file.isDirectory) return "folder.png";
        let ext = BL._.last((file.name||'').split('.')).toLowerCase();
        switch (ext) {
            case '3gp': return "3gp.png";
            case 'ace': return "ace.png";
            case 'arj': return "arj.png";
            case 'asf': return "asf.png";
            case 'asp': case 'aspx': return "asp.png";
            case 'avi': return "avi.png";
            case 'bin': return "bin.png";
            case 'bmp': return "bmp.png";
            case 'cab': return "cab.png";
            case 'cda': return "cda.png";
            case 'cgi': return "cgi.png";
            case 'chm': return "chm.png";
            case 'cur': return "cur.png";
            case 'doc': case 'docx': return "doc.png";
            case 'eps': return "eps.png";
            case 'flv': return "flv.png";
            case 'gif': return "gif.png";
            case 'htm': case 'html': return "htm.png";
            case 'icns': return "icns.png";
            case 'ico': return "ico.png";
            case 'jpg': case "jpeg": return "png.png";
            case 'jsp': return "jsp.png";
            case 'lzw': return "lzw.png";
            case 'mov': return "mov.png";
            case 'mp3': return "mp3.png";
            case 'mpg': case "mpeg": return "mpg.png";
            case 'pcx': return "pcx.png";
            case 'pdf': return "pdf.png";
            case 'php': return "php.png";
            case 'png': return "png.png";
            case 'ppt': case "pptx": return "ppt.png";
            case 'psd': return "psd.png";
            case 'ram': return "ram.png";
            case 'rar': return "rar.png";
            case 'rm': return "rm.png";
            case 'rmvb': return "rmvb.png";
            case 'rtf': return "rtf.png";
            case 'swf': return "swf.png";
            case 'tga': return "tga.png";
            case 'tif': case "tiff": return "tif.png";
            case 'tmp': return "tmp.png";
            case 'txt': return "txt.png";
            case 'vml': return "vml.png";
            case 'vob': return "vob.png";
            case 'wav': return "wav.png";
            case 'wma': return "wma.png";
            case 'wmv': return "wmv.png";
            case 'xls': case "xlsx": return "xls.png";
            case 'xml': return "xml.png";
            case 'zip': return "zip.png";
        }

        return "file.png";
    }

    static getFileType(file) {
        if(file.isDirectory) return ["folder"];
        let ext = BL._.last((file.name||'').split('.')).toLowerCase();
        switch (ext) {
            case 'bmp': 
            case 'gif': 
            case 'jpg': case "jpeg": 
            case 'png': 
            case 'tif': case "tiff": 
                return ["image"];
            
            case 'wav': 
            case 'wma': 
            case 'wmv': 
                return ["video"];
        }
        return ["file"];
    }
};