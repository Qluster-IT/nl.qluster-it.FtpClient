'use strict';

const { posix } = require('path');

function pathError(translate) {
  return new Error(translate ? translate('errors.outsideRoot') : 'The path must stay inside the configured root directory.');
}

function getRootPath(workdirectory = '', translate) {
  const root = posix.normalize(workdirectory || '');
  if (root === '..' || root.startsWith('../') || root.includes('\0')) throw pathError(translate);
  return root === '.' || root === '/' ? '' : root.replace(/\/+$/, '');
}

function resolvePath(workdirectory, remotePath = '', translate) {
  const root = getRootPath(workdirectory, translate);
  if (typeof remotePath !== 'string' || remotePath.includes('\0')) throw pathError(translate);
  if (!root) return remotePath;
  const parts = remotePath.split('/').filter(part => part && part !== '.');
  const rootParts = root.split('/').filter(Boolean);
  if (rootParts.every((part, index) => parts[index] === part)) parts.splice(0, rootParts.length);
  const relative = [];
  for (const part of parts) {
    if (part === '..') {
      if (!relative.length) throw pathError(translate);
      relative.pop();
    } else relative.push(part);
  }
  return [root, ...relative].join('/');
}

module.exports = { getRootPath, resolvePath };
