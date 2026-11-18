'use strict';

angular.module('ftpclient').directive('ftpDraggable', function ($rootScope) {
	return {
		restrict: 'A',
		link: function (scope, element, attrs) {
			const node = element[0];
			let gesture;
			let suppressClick = false;

			function dropTarget(x, y, item, parent) {
				const hit = document.elementFromPoint(x, y);
				const targetNode = hit && hit.closest('[ftp-drop-target]');
				if (!targetNode) return null;
				const targetScope = angular.element(targetNode).scope();
				const directory = targetScope.$eval(targetNode.getAttribute('ftp-drop-target'));
				if (!directory || directory === parent || directory.id === parent.id) return null;
				if (item.isDirectory && (directory.id === item.id || directory.id.startsWith(item.id + '/'))) return null;
				return { node: targetNode, directory };
			}

			function clearTarget() {
				if (gesture.target) gesture.target.node.classList.remove('ftp-drop-hover');
				gesture.target = null;
			}

			function updateTarget() {
				clearTarget();
				gesture.target = dropTarget(gesture.clientX, gesture.clientY, gesture.item, gesture.parent);
				if (gesture.target) gesture.target.node.classList.add('ftp-drop-hover');
			}

			function cleanup() {
				if (!gesture) return;
				clearTarget();
				clearInterval(gesture.scrollTimer);
				if (gesture.ghost) gesture.ghost.remove();
				const pointerId = gesture.pointerId;
				gesture = null;
				if (node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
			}

			function pointerDown(event) {
				suppressClick = false;
				const item = scope.$eval(attrs.ftpDraggable);
				if (!event.isPrimary || event.button !== 0 || !item || item.root ||
					scope.vars.selected !== item || scope.vars.pendingMove ||
					event.target.closest('button, input, select, textarea, .ftp-buttons, .window, .ftp-context-menu')) return;
				const parent = scope.$eval(attrs.ftpDragParent);
				gesture = { item, parent, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
				node.setPointerCapture(event.pointerId);
			}

			function pointerMove(event) {
				if (!gesture || event.pointerId !== gesture.pointerId) return;
				if (!gesture.ghost) {
					if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 10) return;
					const rect = node.getBoundingClientRect();
					const ghost = node.cloneNode(true);
					ghost.classList.add('ftp-drag-ghost');
					ghost.style.width = rect.width + 'px';
					ghost.setAttribute('aria-hidden', 'true');
					node.closest('.ftp-directory-root').appendChild(ghost);
					gesture.ghost = ghost;
					suppressClick = true;
					const root = node.closest('.ftp-directory-root');
					const viewport = root.classList.contains('list') ? root : node.closest('.ftp-directory-children:not(.non-active)');
					gesture.scrollTimer = setInterval(function () {
						const rect = viewport.getBoundingClientRect();
						const y = gesture.clientY;
						const step = y < rect.top + 32 ? -16 : y > rect.bottom - 32 ? 16 : 0;
						if (step) {
							viewport.scrollTop += step;
							updateTarget();
						}
					}, 50);
				}
				event.preventDefault();
				gesture.clientX = event.clientX;
				gesture.clientY = event.clientY;
				gesture.ghost.style.left = event.clientX + 12 + 'px';
				gesture.ghost.style.top = event.clientY + 12 + 'px';
				updateTarget();
			}

			function pointerUp(event) {
				if (!gesture || event.pointerId !== gesture.pointerId) return;
				const { item, parent, ghost } = gesture;
				const target = ghost && dropTarget(event.clientX, event.clientY, item, parent);
				cleanup();
				if (target) scope.$apply(function () {
					$rootScope.ftpDirectoryCtrl.moveItem(item, parent, target.directory);
				});
			}

			function pointerCancel(event) {
				if (gesture && event.pointerId === gesture.pointerId) cleanup();
			}

			function click(event) {
				if (!suppressClick) return;
				suppressClick = false;
				event.preventDefault();
				event.stopImmediatePropagation();
			}

			const unwatch = scope.$watch(function () {
				const item = scope.$eval(attrs.ftpDraggable);
				return item && !item.root && scope.vars.selected === item && !scope.vars.pendingMove;
			}, function (enabled) {
				node.classList.toggle('ftp-drag-enabled', !!enabled);
			});
			node.addEventListener('pointerdown', pointerDown);
			node.addEventListener('pointermove', pointerMove);
			node.addEventListener('pointerup', pointerUp);
			node.addEventListener('pointercancel', pointerCancel);
			node.addEventListener('lostpointercapture', pointerCancel);
			node.addEventListener('click', click, true);
			scope.$on('$destroy', function () {
				cleanup();
				unwatch();
				node.removeEventListener('pointerdown', pointerDown);
				node.removeEventListener('pointermove', pointerMove);
				node.removeEventListener('pointerup', pointerUp);
				node.removeEventListener('pointercancel', pointerCancel);
				node.removeEventListener('lostpointercapture', pointerCancel);
				node.removeEventListener('click', click, true);
			});
		}
	};
});
