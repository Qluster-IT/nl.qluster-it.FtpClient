'use strict';

const getFileIcon = require('../drivers/ftpconnection/repair/ftp-file-icons');

module.exports = {
    getIconsFromFile(file) {
        const image = file.isDirectory ? 'folder.png' : getFileIcon(file.filename || file.name || '').image;
        // Keep the published URLs for SVGs, which don't have a fixed resolution.
        return `${image.endsWith('.svg') ? '24x24' : '48x48'}/${image}`;
    },

    getFileType(file) {
        if (file.isDirectory) return ['folder'];
        const ext = (file.name || '').split('.').pop().toLowerCase();
        if (['bmp', 'gif', 'jpg', 'jpeg', 'png', 'tif', 'tiff'].includes(ext)) return ['image'];
        if (['wav', 'wma', 'wmv'].includes(ext)) return ['video'];
        return ['file'];
    }
};
