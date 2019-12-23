"use strict";

import { TrollRenderer } from "./troll_renderer.js";

function MiscUtilities() {

    const textureDir = "../textures/";

    let _this = this;

    let _container, _controls;
    let _camera, _scene, _renderer;
    let _prevTimestamp, _animateCallback;
    let _stats;

    let _customRender;

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
        //container = document.createElement( 'div' );
        //document.body.appendChild( container );

        /*
        renderer = new THREE.WebGLRenderer( { antialias: true } );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.BasicShadowMap;
        renderer.gammaOutput = true;
        container.appendChild( renderer.domElement );

        let renderPass = new THREE.RenderPass( scene, camera );
    
        composer = new THREE.EffectComposer( renderer );
        composer.setSize( window.innerWidth, window.innerHeight );
        composer.addPass( renderPass );
        */

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

    function createOrditControl() {
        _controls = new THREE.OrbitControls(_camera);
        _controls.target.set(0, - 0.2, - 0.2);
        _controls.update();
    }

    function onWindowResize() {
        _camera.aspect = window.innerWidth / window.innerHeight;
        _camera.updateProjectionMatrix();

        _renderer.setSize(window.innerWidth, window.innerHeight);
    }

    this.animate = function (timestamp) {
        requestAnimationFrame(_this.animate);

        let deltaTime = null;
        if (_prevTimestamp && _animateCallback) {
            deltaTime = timestamp - prevTimestamp;
            _animateCallback(deltaTime);
        }

        if (_customRender === null)
            _composer.render(deltaTime);
        else
            _customRender();

        if (_stats !== null)
            _stats.update();

        _prevTimestamp = timestamp;
    }

}

export { MiscUtilities };