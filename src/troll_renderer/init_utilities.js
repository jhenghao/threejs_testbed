"use strict";

import { TrollRenderer } from "./troll_renderer.js";

function InitUtilities() {

    let _this = this;

    let _container;
    let _camera, _scene, _renderer;
    let _prevTimestamp;
    let _stats;

    let _customRender;

    function onWindowResize() {

        _camera.aspect = window.innerWidth / window.innerHeight;
        _camera.updateProjectionMatrix();

        _renderer.setSize(window.innerWidth, window.innerHeight);
    }

    this.setCustomRender = function (customRender) {
        _customRender = customRender;
    }

    this.getRenderer = function () {
        return _renderer;
    }

    this.getCamera = function () {
        return _camera;
    }

    this.getScene = function () {
        return _scene;
    }

    this.initThreeJsRenderer = function () {

        _renderer = new THREE.WebGLRenderer({ antialias: true });
        _renderer.setPixelRatio(window.devicePixelRatio);
        _renderer.setSize(window.innerWidth, window.innerHeight);
        _renderer.shadowMap.enabled = true;
        _renderer.shadowMap.type = THREE.BasicShadowMap;
        _renderer.gammaOutput = true;

        _container = document.createElement('div');
        document.body.appendChild(_container);
        _container.appendChild(_renderer.domElement);
    }

    this.initTrollRenderer = function () {

        _renderer = new TrollRenderer({ antialias: true });
        _renderer.setPixelRatio(window.devicePixelRatio);
        _renderer.setSize(window.innerWidth, window.innerHeight);

        _container = document.createElement('div');
        document.body.appendChild(_container);
        _container.appendChild(_renderer.domElement);

    }

    this.initSceneAndCamera = function () {

        _camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.25, 2000);
        _camera.position.set(- 1.8, 0.9, 2.7);

        _scene = new THREE.Scene();
    }

    this.initMisc = function () {

        window.addEventListener('resize', onWindowResize, false);

        // stats
        _stats = new Stats();
        _container.appendChild(_stats.dom);
    }

    this.animate = function (timestamp) {

        requestAnimationFrame(_this.animate);

        if (_customRender != null) {
            if (_prevTimestamp != null) {
                _customRender(timestamp - _prevTimestamp);
            }
        }
        else if (_renderer != null) {
            _renderer.render();
        }

        if (_stats !== null) {
            _stats.update();
        }

        _prevTimestamp = timestamp;
    }

}

export { InitUtilities };