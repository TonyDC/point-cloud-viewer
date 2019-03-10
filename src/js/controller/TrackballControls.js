/**
 * @author Eberhard Graether / http://egraether.com/
 * @author Mark Lundin 	/ http://mark-lundin.com
 * @author Simone Manini / http://daron1337.github.io
 * @author Luca Antiga 	/ http://lantiga.github.io
 */

import { Vector2, Vector3, Quaternion } from 'three';
import EventDispatcher from '../EventDispatcher';

const STATE = { NONE: -1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 };

// events
const changeEvent = { type: 'change' };
const startEvent = { type: 'start' };
const endEvent = { type: 'end' };

const EPS = 0.000001;

export default class TrackballControls extends EventDispatcher {

    constructor(object, domElement = window.document) {
        super();

        this.object = object;
        this.domElement = domElement;

        // API

        this.enabled = true;

        this.screen = { left: 0, top: 0, width: 0, height: 0 };

        this.rotateSpeed = 1.0;
        this.zoomSpeed = 1.2;
        this.panSpeed = 0.3;

        this.noRotate = false;
        this.noZoom = false;
        this.noPan = false;

        this.staticMoving = false;
        this.dynamicDampingFactor = 0.2;

        this.minDistance = 0;
        this.maxDistance = Infinity;

        this.keys = [65 /*A*/, 83 /*S*/, 68 /*D*/];

        // internals

        this.target = new Vector3();

        this.lastPosition = new Vector3();

        this.state = STATE.NONE;

        this.prevState = STATE.NONE;

        this.eye = new Vector3();

        this.movePrev = new Vector2();
        this.moveCurr = new Vector2();

        this.lastAxis = new Vector3();
        this.lastAngle = 0;

        this.zoomStart = new Vector2();
        this.zoomEnd = new Vector2();

        this.touchZoomDistanceStart = 0;
        this.touchZoomDistanceEnd = 0;

        this.panStart = new Vector2();
        this.panEnd = new Vector2();

        // for reset

        this.target0 = this.target.clone();
        this.position0 = this.object.position.clone();
        this.up0 = this.object.up.clone();

        this.domElement.addEventListener('contextmenu', this.contextmenu.bind(this), false);
        this.domElement.addEventListener('mousedown', this.mousedown.bind(this), false);
        this.domElement.addEventListener('wheel', this.mousewheel.bind(this), false);

        this.domElement.addEventListener('touchstart', this.touchstart.bind(this), false);
        this.domElement.addEventListener('touchend', this.touchend.bind(this), false);
        this.domElement.addEventListener('touchmove', this.touchmove.bind(this), false);

        this.domElement.addEventListener('keydown', this.keydown.bind(this), false);
        this.domElement.addEventListener('keyup', this.keyup.bind(this), false);

        this.domElement.addEventListener('mousemove', this.mousemove.bind(this), false);
        this.domElement.addEventListener('mouseup', this.mouseup.bind(this), false);

        this.handleResize();

        // force an update at start
        // TODO remove from constructor
        this.update();
    }

    handleResize() {
        if (this.domElement === document) {
            this.screen.left = 0;
            this.screen.top = 0;
            this.screen.width = window.innerWidth;
            this.screen.height = window.innerHeight;
        } else {
            const box = this.domElement.getBoundingClientRect();
            // adjustments come from similar code in the jquery offset() function
            const d = this.domElement.ownerDocument.documentElement;
            this.screen.left = box.left + window.pageXOffset - d.clientLeft;
            this.screen.top = box.top + window.pageYOffset - d.clientTop;
            this.screen.width = box.width;
            this.screen.height = box.height;
        }
    }

    getMouseOnScreen(pageX, pageY) {
        return new Vector2((pageX - this.screen.left) / this.screen.width, (pageY - this.screen.top) / this.screen.height);
    }

    getMouseOnCircle(pageX, pageY) {
        return new Vector2(
            ((pageX - this.screen.width * 0.5 - this.screen.left) / (this.screen.width * 0.5)),
            ((this.screen.height + 2 * (this.screen.top - pageY)) / this.screen.width) // screen.width intentional
        );
    }

    rotateCamera() {
        const axis = new Vector3(),
            quaternion = new Quaternion(),
            eyeDirection = new Vector3(),
            objectUpDirection = new Vector3(),
            objectSidewaysDirection = new Vector3(),
            moveDirection = new Vector3(this.moveCurr.x - this.movePrev.x, this.moveCurr.y - this.movePrev.y, 0);

        let angle = moveDirection.length();

        if (angle) {
            this.eye.copy(this.object.position).sub(this.target);

            eyeDirection.copy(this.eye).normalize();
            objectUpDirection.copy(this.object.up).normalize();
            objectSidewaysDirection.crossVectors(objectUpDirection, eyeDirection).normalize();

            objectUpDirection.setLength(this.moveCurr.y - this.movePrev.y);
            objectSidewaysDirection.setLength(this.moveCurr.x - this.movePrev.x);

            moveDirection.copy(objectUpDirection.add(objectSidewaysDirection));

            axis.crossVectors(moveDirection, this.eye).normalize();

            angle *= this.rotateSpeed;
            quaternion.setFromAxisAngle(axis, angle);

            this.eye.applyQuaternion(quaternion);
            this.object.up.applyQuaternion(quaternion);

            this.lastAxis.copy(axis);
            this.lastAngle = angle;
        } else if (!this.staticMoving && this.lastAngle) {
            this.lastAngle *= Math.sqrt(1.0 - this.dynamicDampingFactor);
            this.eye.copy(this.object.position).sub(this.target);
            quaternion.setFromAxisAngle(this.lastAxis, this.lastAngle);
            this.eye.applyQuaternion(quaternion);
            this.object.up.applyQuaternion(quaternion);
        }

        this.movePrev.copy(this.moveCurr);
    }

    zoomCamera() {
        let factor;
        if (this.state === STATE.TOUCH_ZOOM_PAN) {
            factor = this.touchZoomDistanceStart / this.touchZoomDistanceEnd;
            this.touchZoomDistanceStart = this.touchZoomDistanceEnd;
            this.eye.multiplyScalar(factor);
        } else {
            factor = 1.0 + (this.zoomEnd.y - this.zoomStart.y) * this.zoomSpeed;

            if (factor !== 1.0 && factor > 0.0) {
                this.eye.multiplyScalar(factor);
            }

            if (this.staticMoving) {
                this.zoomStart.copy(this.zoomEnd);
            } else {
                this.zoomStart.y += (this.zoomEnd.y - this.zoomStart.y) * this.dynamicDampingFactor;
            }
        }
    }

    panCamera() {
        const mouseChange = new Vector2(), objectUp = new Vector3(), pan = new Vector3();

        mouseChange.copy(this.panEnd).sub(this.panStart);

        if (mouseChange.lengthSq()) {
            mouseChange.multiplyScalar(this.eye.length() * this.panSpeed);
            pan.copy(this.eye).cross(this.object.up).setLength(mouseChange.x);
            pan.add(objectUp.copy(this.object.up).setLength(mouseChange.y));
            this.object.position.add(pan);
            this.target.add(pan);

            if (this.staticMoving) {
                this.panStart.copy(this.panEnd);
            } else {
                this.panStart.add(mouseChange.subVectors(this.panEnd, this.panStart).multiplyScalar(this.dynamicDampingFactor));
            }
        }
    }

    checkDistances() {
        if (!this.noZoom || !this.noPan) {
            if (this.eye.lengthSq() > this.maxDistance * this.maxDistance) {
                this.object.position.addVectors(this.target, this.eye.setLength(this.maxDistance));
                this.zoomStart.copy(this.zoomEnd);
            }

            if (this.eye.lengthSq() < this.minDistance * this.minDistance) {
                this.object.position.addVectors(this.target, this.eye.setLength(this.minDistance));
                this.zoomStart.copy(this.zoomEnd);
            }
        }
    }

    update() {
        this.eye.subVectors(this.object.position, this.target);

        if (!this.noRotate) {
            this.rotateCamera();
        }

        if (!this.noZoom) {
            this.zoomCamera();
        }

        if (!this.noPan) {
            this.panCamera();
        }

        this.object.position.addVectors(this.target, this.eye);
        this.checkDistances();
        this.object.lookAt(this.target);

        if (this.lastPosition.distanceToSquared(this.object.position) > EPS) {
            this.dispatchEvent(changeEvent);
            this.lastPosition.copy(this.object.position);
        }
    }

    reset() {
        this.state = STATE.NONE;
        this.prevState = STATE.NONE;

        this.target.copy(this.target0);
        this.object.position.copy(this.position0);
        this.object.up.copy(this.up0);

        this.eye.subVectors(this.object.position, this.target);
        this.object.lookAt(this.target);
        this.dispatchEvent(changeEvent);

        this.lastPosition.copy(this.object.position);
    }

    keydown(event) {
        if (this.enabled === false)
            return;

        // TODO
        // allow only one key event while pressing
        // window.removeEventListener('keydown', this.keydown);

        this.prevState = this.state;

        if (this.state !== STATE.NONE) {
            return;
        }

        if (event.keyCode === this.keys[STATE.ROTATE] && !this.noRotate) {
            this.state = STATE.ROTATE;
        }

        if (event.keyCode === this.keys[STATE.ZOOM] && !this.noZoom) {
            this.state = STATE.ZOOM;
        }

        if (event.keyCode === this.keys[STATE.PAN] && !this.noPan) {
            this.state = STATE.PAN;
        }
    }

    keyup(event) {
        if (this.enabled === false)
            return;

        this.state = this.prevState;
    }

    mousedown(event) {
        if (this.enabled === false)
            return;

        event.preventDefault();
        event.stopPropagation();

        // TODO why
        if (this.state === STATE.NONE) {
            this.state = event.button;
        }

        if (this.state === STATE.ROTATE && !this.noRotate) {
            this.moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
            this.movePrev.copy(this.moveCurr);
        } else if (this.state === STATE.ZOOM && !this.noZoom) {
            this.zoomStart.copy(this.getMouseOnScreen(event.pageX, event.pageY));
            this.zoomEnd.copy(this.zoomStart);
        } else if (this.state === STATE.PAN && !this.noPan) {
            this.panStart.copy(this.getMouseOnScreen(event.pageX, event.pageY));
            this.panEnd.copy(this.panStart);
        }

        this.dispatchEvent(startEvent);
    }

    mousemove(event) {
        if (this.enabled === false)
            return;

        event.preventDefault();
        event.stopPropagation();

        if (this.state === STATE.ROTATE && !this.noRotate) {
            this.movePrev.copy(this.moveCurr);
            this.moveCurr.copy(this.getMouseOnCircle(event.pageX, event.pageY));
        } else if (this.state === STATE.ZOOM && !this.noZoom) {
            this.zoomEnd.copy(this.getMouseOnScreen(event.pageX, event.pageY));
        } else if (this.state === STATE.PAN && !this.noPan) {
            this.panEnd.copy(this.getMouseOnScreen(event.pageX, event.pageY));
        }
    }

    mouseup(event) {
        if (this.enabled === false)
            return;

        event.preventDefault();
        event.stopPropagation();

        this.state = STATE.NONE;

        this.dispatchEvent(endEvent);
    }

    mousewheel(event) {
        if (this.enabled === false)
            return;
        if (this.noZoom === true)
            return;

        event.preventDefault();
        event.stopPropagation();

        switch (event.deltaMode) {
            case 2:
                // Zoom in pages
                this.zoomStart.y -= event.deltaY * 0.025;
                break;

            case 1:
                // Zoom in lines
                this.zoomStart.y -= event.deltaY * 0.01;
                break;

            default:
                // undefined, 0, assume pixels
                this.zoomStart.y -= event.deltaY * 0.00025;
                break;

        }

        this.dispatchEvent(startEvent);
        this.dispatchEvent(endEvent);
    }

    touchstart(event) {
        if (this.enabled === false)
            return;

        event.preventDefault();

        switch (event.touches.length) {
            case 1:
                this.state = STATE.TOUCH_ROTATE;
                this.moveCurr.copy(this.getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
                this.movePrev.copy(this.moveCurr);
                break;

            default: // 2 or more
                {
                    this.state = STATE.TOUCH_ZOOM_PAN;
                    const dx = event.touches[0].pageX - event.touches[1].pageX;
                    const dy = event.touches[0].pageY - event.touches[1].pageY;
                    this.touchZoomDistanceEnd = this.touchZoomDistanceStart = Math.sqrt(dx * dx + dy * dy);

                    const x = (event.touches[0].pageX + event.touches[1].pageX) / 2;
                    const y = (event.touches[0].pageY + event.touches[1].pageY) / 2;
                    this.panStart.copy(this.getMouseOnScreen(x, y));
                    this.panEnd.copy(this.panStart);
                }
                break;

        }

        this.dispatchEvent(startEvent);
    }

    touchmove(event) {
        if (this.enabled === false)
            return;

        event.preventDefault();
        event.stopPropagation();

        switch (event.touches.length) {
            case 1:
                this.movePrev.copy(this.moveCurr);
                this.moveCurr.copy(this.getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
                break;

            default: // 2 or more
                {
                    const dx = event.touches[0].pageX - event.touches[1].pageX;
                    const dy = event.touches[0].pageY - event.touches[1].pageY;
                    this.touchZoomDistanceEnd = Math.sqrt(dx * dx + dy * dy);

                    const x = (event.touches[0].pageX + event.touches[1].pageX) / 2;
                    const y = (event.touches[0].pageY + event.touches[1].pageY) / 2;
                    this.panEnd.copy(this.getMouseOnScreen(x, y));
                }
                break;
        }
    }

    touchend(event) {
        if (this.enabled === false) return;

        switch (event.touches.length) {
            case 0:
                this.state = STATE.NONE;
                break;

            case 1:
                this.state = STATE.TOUCH_ROTATE;
                this.moveCurr.copy(this.getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
                this.movePrev.copy(this.moveCurr);
                break;

            default:
                break;
        }

        this.dispatchEvent(endEvent);
    }

    contextmenu(event) {
        if (this.enabled === false) return;

        event.preventDefault();
    }

    dispose() {
        this.domElement.removeEventListener('contextmenu', this.contextmenu, false);
        this.domElement.removeEventListener('mousedown', this.mousedown, false);
        this.domElement.removeEventListener('wheel', this.mousewheel, false);

        this.domElement.removeEventListener('touchstart', this.touchstart, false);
        this.domElement.removeEventListener('touchend', this.touchend, false);
        this.domElement.removeEventListener('touchmove', this.touchmove, false);

        document.removeEventListener('mousemove', this.mousemove, false);
        document.removeEventListener('mouseup', this.mouseup, false);

        window.removeEventListener('keydown', this.keydown, false);
        window.removeEventListener('keyup', this.keyup, false);
    }
}




/*
THREE.TrackballControls = function (object, domElement) {

    var _this = this;
    var STATE = { NONE: - 1, ROTATE: 0, ZOOM: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_ZOOM_PAN: 4 };

    this.object = object;
    this.domElement = (domElement !== undefined) ? domElement : document;

    // API

    this.enabled = true;

    this.screen = { left: 0, top: 0, width: 0, height: 0 };

    this.rotateSpeed = 1.0;
    this.zoomSpeed = 1.2;
    this.panSpeed = 0.3;

    this.noRotate = false;
    this.noZoom = false;
    this.noPan = false;

    this.staticMoving = false;
    this.dynamicDampingFactor = 0.2;

    this.minDistance = 0;
    this.maxDistance = Infinity;

    this.keys = [65 , 83 , 68 ];

    // internals

    this.target = new THREE.Vector3();

    var EPS = 0.000001;

    var lastPosition = new THREE.Vector3();

    var _state = STATE.NONE,
        _prevState = STATE.NONE,

        _eye = new THREE.Vector3(),

        _movePrev = new THREE.Vector2(),
        _moveCurr = new THREE.Vector2(),

        _lastAxis = new THREE.Vector3(),
        _lastAngle = 0,

        _zoomStart = new THREE.Vector2(),
        _zoomEnd = new THREE.Vector2(),

        _touchZoomDistanceStart = 0,
        _touchZoomDistanceEnd = 0,

        _panStart = new THREE.Vector2(),
        _panEnd = new THREE.Vector2();

    // for reset

    this.target0 = this.target.clone();
    this.position0 = this.object.position.clone();
    this.up0 = this.object.up.clone();

    // events

    var changeEvent = { type: 'change' };
    var startEvent = { type: 'start' };
    var endEvent = { type: 'end' };


    // methods

    this.handleResize = function () {

        if (this.domElement === document) {

            this.screen.left = 0;
            this.screen.top = 0;
            this.screen.width = window.innerWidth;
            this.screen.height = window.innerHeight;

        } else {

            var box = this.domElement.getBoundingClientRect();
            // adjustments come from similar code in the jquery offset() function
            var d = this.domElement.ownerDocument.documentElement;
            this.screen.left = box.left + window.pageXOffset - d.clientLeft;
            this.screen.top = box.top + window.pageYOffset - d.clientTop;
            this.screen.width = box.width;
            this.screen.height = box.height;

        }

    };

    var getMouseOnScreen = (function () {

        var vector = new THREE.Vector2();

        return function getMouseOnScreen(pageX, pageY) {

            vector.set(
                (pageX - _this.screen.left) / _this.screen.width,
                (pageY - _this.screen.top) / _this.screen.height
            );

            return vector;

        };

    }());

    var getMouseOnCircle = (function () {

        var vector = new THREE.Vector2();

        return function getMouseOnCircle(pageX, pageY) {

            vector.set(
                ((pageX - _this.screen.width * 0.5 - _this.screen.left) / (_this.screen.width * 0.5)),
                ((_this.screen.height + 2 * (_this.screen.top - pageY)) / _this.screen.width) // screen.width intentional
            );

            return vector;

        };

    }());

    this.rotateCamera = (function () {

        var axis = new THREE.Vector3(),
            quaternion = new THREE.Quaternion(),
            eyeDirection = new THREE.Vector3(),
            objectUpDirection = new THREE.Vector3(),
            objectSidewaysDirection = new THREE.Vector3(),
            moveDirection = new THREE.Vector3(),
            angle;

        return function rotateCamera() {

            moveDirection.set(_moveCurr.x - _movePrev.x, _moveCurr.y - _movePrev.y, 0);
            angle = moveDirection.length();

            if (angle) {

                _eye.copy(_this.object.position).sub(_this.target);

                eyeDirection.copy(_eye).normalize();
                objectUpDirection.copy(_this.object.up).normalize();
                objectSidewaysDirection.crossVectors(objectUpDirection, eyeDirection).normalize();

                objectUpDirection.setLength(_moveCurr.y - _movePrev.y);
                objectSidewaysDirection.setLength(_moveCurr.x - _movePrev.x);

                moveDirection.copy(objectUpDirection.add(objectSidewaysDirection));

                axis.crossVectors(moveDirection, _eye).normalize();

                angle *= _this.rotateSpeed;
                quaternion.setFromAxisAngle(axis, angle);

                _eye.applyQuaternion(quaternion);
                _this.object.up.applyQuaternion(quaternion);

                _lastAxis.copy(axis);
                _lastAngle = angle;

            } else if (!_this.staticMoving && _lastAngle) {

                _lastAngle *= Math.sqrt(1.0 - _this.dynamicDampingFactor);
                _eye.copy(_this.object.position).sub(_this.target);
                quaternion.setFromAxisAngle(_lastAxis, _lastAngle);
                _eye.applyQuaternion(quaternion);
                _this.object.up.applyQuaternion(quaternion);

            }

            _movePrev.copy(_moveCurr);

        };

    }());


    this.zoomCamera = function () {

        var factor;

        if (_state === STATE.TOUCH_ZOOM_PAN) {

            factor = _touchZoomDistanceStart / _touchZoomDistanceEnd;
            _touchZoomDistanceStart = _touchZoomDistanceEnd;
            _eye.multiplyScalar(factor);

        } else {

            factor = 1.0 + (_zoomEnd.y - _zoomStart.y) * _this.zoomSpeed;

            if (factor !== 1.0 && factor > 0.0) {

                _eye.multiplyScalar(factor);

            }

            if (_this.staticMoving) {

                _zoomStart.copy(_zoomEnd);

            } else {

                _zoomStart.y += (_zoomEnd.y - _zoomStart.y) * this.dynamicDampingFactor;

            }

        }

    };

    this.panCamera = (function () {

        var mouseChange = new THREE.Vector2(),
            objectUp = new THREE.Vector3(),
            pan = new THREE.Vector3();

        return function panCamera() {

            mouseChange.copy(_panEnd).sub(_panStart);

            if (mouseChange.lengthSq()) {

                mouseChange.multiplyScalar(_eye.length() * _this.panSpeed);

                pan.copy(_eye).cross(_this.object.up).setLength(mouseChange.x);
                pan.add(objectUp.copy(_this.object.up).setLength(mouseChange.y));

                _this.object.position.add(pan);
                _this.target.add(pan);

                if (_this.staticMoving) {

                    _panStart.copy(_panEnd);

                } else {

                    _panStart.add(mouseChange.subVectors(_panEnd, _panStart).multiplyScalar(_this.dynamicDampingFactor));

                }

            }

        };

    }());

    this.checkDistances = function () {

        if (!_this.noZoom || !_this.noPan) {

            if (_eye.lengthSq() > _this.maxDistance * _this.maxDistance) {

                _this.object.position.addVectors(_this.target, _eye.setLength(_this.maxDistance));
                _zoomStart.copy(_zoomEnd);

            }

            if (_eye.lengthSq() < _this.minDistance * _this.minDistance) {

                _this.object.position.addVectors(_this.target, _eye.setLength(_this.minDistance));
                _zoomStart.copy(_zoomEnd);

            }

        }

    };

    this.update = function () {

        _eye.subVectors(_this.object.position, _this.target);

        if (!_this.noRotate) {

            _this.rotateCamera();

        }

        if (!_this.noZoom) {

            _this.zoomCamera();

        }

        if (!_this.noPan) {

            _this.panCamera();

        }

        _this.object.position.addVectors(_this.target, _eye);

        _this.checkDistances();

        _this.object.lookAt(_this.target);

        if (lastPosition.distanceToSquared(_this.object.position) > EPS) {

            _this.dispatchEvent(changeEvent);

            lastPosition.copy(_this.object.position);

        }

    };

    this.reset = function () {

        _state = STATE.NONE;
        _prevState = STATE.NONE;

        _this.target.copy(_this.target0);
        _this.object.position.copy(_this.position0);
        _this.object.up.copy(_this.up0);

        _eye.subVectors(_this.object.position, _this.target);

        _this.object.lookAt(_this.target);

        _this.dispatchEvent(changeEvent);

        lastPosition.copy(_this.object.position);

    };

    // listeners

    function keydown(event) {

        if (_this.enabled === false) return;

        window.removeEventListener('keydown', keydown);

        _prevState = _state;

        if (_state !== STATE.NONE) {

            return;

        } else if (event.keyCode === _this.keys[STATE.ROTATE] && !_this.noRotate) {

            _state = STATE.ROTATE;

        } else if (event.keyCode === _this.keys[STATE.ZOOM] && !_this.noZoom) {

            _state = STATE.ZOOM;

        } else if (event.keyCode === _this.keys[STATE.PAN] && !_this.noPan) {

            _state = STATE.PAN;

        }

    }

    function keyup(event) {

        if (_this.enabled === false) return;

        _state = _prevState;

        window.addEventListener('keydown', keydown, false);

    }

    function mousedown(event) {

        if (_this.enabled === false) return;

        event.preventDefault();
        event.stopPropagation();

        if (_state === STATE.NONE) {

            _state = event.button;

        }

        if (_state === STATE.ROTATE && !_this.noRotate) {

            _moveCurr.copy(getMouseOnCircle(event.pageX, event.pageY));
            _movePrev.copy(_moveCurr);

        } else if (_state === STATE.ZOOM && !_this.noZoom) {

            _zoomStart.copy(getMouseOnScreen(event.pageX, event.pageY));
            _zoomEnd.copy(_zoomStart);

        } else if (_state === STATE.PAN && !_this.noPan) {

            _panStart.copy(getMouseOnScreen(event.pageX, event.pageY));
            _panEnd.copy(_panStart);

        }

        document.addEventListener('mousemove', mousemove, false);
        document.addEventListener('mouseup', mouseup, false);

        _this.dispatchEvent(startEvent);

    }

    function mousemove(event) {

        if (_this.enabled === false) return;

        event.preventDefault();
        event.stopPropagation();

        if (_state === STATE.ROTATE && !_this.noRotate) {

            _movePrev.copy(_moveCurr);
            _moveCurr.copy(getMouseOnCircle(event.pageX, event.pageY));

        } else if (_state === STATE.ZOOM && !_this.noZoom) {

            _zoomEnd.copy(getMouseOnScreen(event.pageX, event.pageY));

        } else if (_state === STATE.PAN && !_this.noPan) {

            _panEnd.copy(getMouseOnScreen(event.pageX, event.pageY));

        }

    }

    function mouseup(event) {

        if (_this.enabled === false) return;

        event.preventDefault();
        event.stopPropagation();

        _state = STATE.NONE;

        document.removeEventListener('mousemove', mousemove);
        document.removeEventListener('mouseup', mouseup);
        _this.dispatchEvent(endEvent);

    }

    function mousewheel(event) {

        if (_this.enabled === false) return;

        if (_this.noZoom === true) return;

        event.preventDefault();
        event.stopPropagation();

        switch (event.deltaMode) {

            case 2:
                // Zoom in pages
                _zoomStart.y -= event.deltaY * 0.025;
                break;

            case 1:
                // Zoom in lines
                _zoomStart.y -= event.deltaY * 0.01;
                break;

            default:
                // undefined, 0, assume pixels
                _zoomStart.y -= event.deltaY * 0.00025;
                break;

        }

        _this.dispatchEvent(startEvent);
        _this.dispatchEvent(endEvent);

    }

    function touchstart(event) {

        if (_this.enabled === false) return;

        event.preventDefault();

        switch (event.touches.length) {

            case 1:
                _state = STATE.TOUCH_ROTATE;
                _moveCurr.copy(getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
                _movePrev.copy(_moveCurr);
                break;

            default: // 2 or more
                _state = STATE.TOUCH_ZOOM_PAN;
                var dx = event.touches[0].pageX - event.touches[1].pageX;
                var dy = event.touches[0].pageY - event.touches[1].pageY;
                _touchZoomDistanceEnd = _touchZoomDistanceStart = Math.sqrt(dx * dx + dy * dy);

                var x = (event.touches[0].pageX + event.touches[1].pageX) / 2;
                var y = (event.touches[0].pageY + event.touches[1].pageY) / 2;
                _panStart.copy(getMouseOnScreen(x, y));
                _panEnd.copy(_panStart);
                break;

        }

        _this.dispatchEvent(startEvent);

    }

    function touchmove(event) {

        if (_this.enabled === false) return;

        event.preventDefault();
        event.stopPropagation();

        switch (event.touches.length) {

            case 1:
                _movePrev.copy(_moveCurr);
                _moveCurr.copy(getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
                break;

            default: // 2 or more
                var dx = event.touches[0].pageX - event.touches[1].pageX;
                var dy = event.touches[0].pageY - event.touches[1].pageY;
                _touchZoomDistanceEnd = Math.sqrt(dx * dx + dy * dy);

                var x = (event.touches[0].pageX + event.touches[1].pageX) / 2;
                var y = (event.touches[0].pageY + event.touches[1].pageY) / 2;
                _panEnd.copy(getMouseOnScreen(x, y));
                break;

        }

    }

    function touchend(event) {

        if (_this.enabled === false) return;

        switch (event.touches.length) {

            case 0:
                _state = STATE.NONE;
                break;

            case 1:
                _state = STATE.TOUCH_ROTATE;
                _moveCurr.copy(getMouseOnCircle(event.touches[0].pageX, event.touches[0].pageY));
                _movePrev.copy(_moveCurr);
                break;

        }

        _this.dispatchEvent(endEvent);

    }

    function contextmenu(event) {

        if (_this.enabled === false) return;

        event.preventDefault();

    }

    this.dispose = function () {

        this.domElement.removeEventListener('contextmenu', contextmenu, false);
        this.domElement.removeEventListener('mousedown', mousedown, false);
        this.domElement.removeEventListener('wheel', mousewheel, false);

        this.domElement.removeEventListener('touchstart', touchstart, false);
        this.domElement.removeEventListener('touchend', touchend, false);
        this.domElement.removeEventListener('touchmove', touchmove, false);

        document.removeEventListener('mousemove', mousemove, false);
        document.removeEventListener('mouseup', mouseup, false);

        window.removeEventListener('keydown', keydown, false);
        window.removeEventListener('keyup', keyup, false);

    };

    this.domElement.addEventListener('contextmenu', contextmenu, false);
    this.domElement.addEventListener('mousedown', mousedown, false);
    this.domElement.addEventListener('wheel', mousewheel, false);

    this.domElement.addEventListener('touchstart', touchstart, false);
    this.domElement.addEventListener('touchend', touchend, false);
    this.domElement.addEventListener('touchmove', touchmove, false);

    window.addEventListener('keydown', keydown, false);
    window.addEventListener('keyup', keyup, false);

    this.handleResize();

    // force an update at start
    this.update();

};

THREE.TrackballControls.prototype = Object.create(THREE.EventDispatcher.prototype);
THREE.TrackballControls.prototype.constructor = THREE.TrackballControls;

*/
