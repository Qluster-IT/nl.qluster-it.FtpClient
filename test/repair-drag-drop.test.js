'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function dragFixture() {
  const handlers = {};
  const classes = new Set();
  const captures = new Set();
  const moves = [];
  let ghosts = 0;
  let destroyed;
  let refresh;
  const parent = { id: '/media' };
  const item = { id: '/media/a.txt', name: 'a.txt', isDirectory: false };
  const target = { id: '/media/target' };
  const targetNode = {
    classList: { add() {}, remove() {} },
    closest() { return this; },
    getAttribute: () => 'directory'
  };
  const root = { classList: { contains: () => true }, appendChild() {} };
  const node = {
    classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
    closest: selector => selector === '.ftp-directory-root' ? root : null,
    addEventListener(name, handler) { handlers[name] = handler; },
    removeEventListener(name) { delete handlers[name]; },
    setPointerCapture: id => captures.add(id),
    hasPointerCapture: id => captures.has(id),
    releasePointerCapture: id => captures.delete(id),
    getBoundingClientRect: () => ({ width: 100 }),
    cloneNode: () => {
      ghosts++;
      return { classList: { add() {} }, style: {}, setAttribute() {}, remove() { ghosts--; } };
    }
  };
  const scope = {
    vars: {},
    $eval: expression => expression === 'file' ? item : parent,
    $apply: callback => callback(),
    $watch(expression, listener) { refresh = () => listener(expression()); refresh(); return () => {}; },
    $on(event, listener) { destroyed = listener; }
  };
  let factory;
  const angular = {
    module: () => ({ directive(name, callback) { factory = callback; } }),
    element: () => ({ scope: () => ({ $eval: () => target }) })
  };
  const source = fs.readFileSync(path.join(__dirname, '../drivers/ftpconnection/repair/ftp-drag-drop.js'), 'utf8');
  vm.runInNewContext(source, {
    angular,
    document: { elementFromPoint: () => targetNode },
    setInterval: () => 1,
    clearInterval() {}
  });
  factory({ ftpDirectoryCtrl: { moveItem: (...args) => moves.push(args) } })
    .link(scope, [node], { ftpDraggable: 'file', ftpDragParent: 'directory' });
  const send = (type, x = 20, y = 20) => handlers[type]({
    isPrimary: true, button: 0, pointerId: 7, target: node,
    clientX: x, clientY: y, preventDefault() {}, stopImmediatePropagation() {}
  });
  return {
    scope, item, parent, target, classes, captures, moves, handlers, send,
    select() { scope.vars.selected = item; refresh(); },
    destroy: () => destroyed(),
    get ghosts() { return ghosts; }
  };
}

test('dragging needs a prior selection and a movement threshold before offering a move', () => {
  const fixture = dragFixture();
  const { send } = fixture;
  send('pointerdown'); send('pointermove', 100, 100); send('pointerup', 100, 100);
  assert.equal(fixture.moves.length, 0);
  assert.equal(fixture.ghosts, 0);
  assert.equal(fixture.captures.size, 0);
  fixture.select();
  assert.ok(fixture.classes.has('ftp-drag-enabled'));
  send('pointerdown'); send('pointermove', 24, 24); send('pointerup', 24, 24);
  assert.equal(fixture.moves.length, 0);
  send('pointerdown'); send('pointermove', 100, 100);
  assert.equal(fixture.ghosts, 1);
  send('pointerup', 100, 100);
  assert.deepEqual(fixture.moves, [[fixture.item, fixture.parent, fixture.target]]);
  assert.equal(fixture.ghosts, 0);
  assert.equal(fixture.captures.size, 0);
  fixture.destroy();
});

test('cancelled gestures and destroyed views clean up dragging without offering a move', () => {
  const fixture = dragFixture();
  fixture.select();
  fixture.send('pointerdown'); fixture.send('pointermove', 100, 100);
  fixture.send('pointercancel');
  assert.equal(fixture.ghosts, 0);
  assert.equal(fixture.moves.length, 0);
  fixture.send('pointerdown'); fixture.send('pointermove', 100, 100);
  fixture.destroy();
  assert.equal(fixture.ghosts, 0);
  assert.equal(fixture.captures.size, 0);
  assert.equal(fixture.moves.length, 0);
  assert.deepEqual(Object.keys(fixture.handlers), []);
});
