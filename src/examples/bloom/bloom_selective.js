"use strict";

import { BasicUtilities } from '../../troll_renderer/basic_utilities.js';
import { InitUtilities } from '../../troll_renderer/init_utilities.js'
import { MaterialUtilities } from '../../troll_renderer/material_utilities.js';

import { BloomPass } from './bloom_pass.js';

let _renderer;
let _scene;
let _camera;

let _ENTIRE_SCENE = 0;
let _BLOOM_SCENE = 1;
let _mouse = new THREE.Vector2();
let _raycaster = new THREE.Raycaster();

let _renderTargetBase = null;
let _materialCopy = null;
let _bloomPass = null;

let _params = {
    mode: "Scene with Glow",
    intensity: 2.0
};

function createGui() {

    let gui = new dat.GUI();

    gui.add(_bloomPass, 'threshold', 0, 1).step(0.01).name('threshold');
    gui.add(_params, 'intensity', 0, 5).step(0.01).name('intensity');
    gui.add(_params, 'mode', ['Scene with Glow', 'Glow only', 'Scene only']);
}

function onDocumentMouseClick(event) {

    event.preventDefault();

    _mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    _mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    _raycaster.setFromCamera(_mouse, _camera);

    let intersects = _raycaster.intersectObjects(_scene.children);

    if (intersects.length > 0) {
        let object = intersects[0].object;
        object.layers.toggle(_BLOOM_SCENE);
    }
}

function loadScene() {

    // create spheres
    let geometry = new THREE.IcosahedronBufferGeometry(1, 4);
    for (let i = 0; i < 50; i++) {
        let color = new THREE.Color();
        color.setHSL(Math.random(), 0.7, Math.random() * 0.2 + 0.05);
        let material = MaterialUtilities.createPhongMaterial({ color: color });
        let sphere = new THREE.Mesh(geometry, material);
        sphere.position.x = Math.random() * 10 - 5;
        sphere.position.y = Math.random() * 10 - 5;
        sphere.position.z = Math.random() * 10 - 5;
        sphere.position.normalize().multiplyScalar(Math.random() * 4.0 + 2.0);
        sphere.scale.setScalar(Math.random() * Math.random() + 0.5);
        _scene.add(sphere);
        if (Math.random() < 0.25) sphere.layers.enable(_BLOOM_SCENE);
    }

    // set camera
    _camera.position.set(0, 0, 15);
    _camera.lookAt(0, 0, 0);
    _camera.fov = 40;
    _camera.aspect = window.innerWidth / window.innerHeight;
    _camera.near = 1;
    _camera.far = 200;
    _camera.updateProjectionMatrix();

    // add lights
    let ambiantLight = new THREE.AmbientLight(0x404040);
    ambiantLight.layers.enable(_BLOOM_SCENE);
    _scene.add(ambiantLight);

    let dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.name = 'Dir. Light';
    dirLight.position.set(-10, -10, 10);
    dirLight.castShadow = true;
    dirLight.shadow.bias = 0.0001;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.left = - 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = - 15;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.layers.enable(_BLOOM_SCENE);
    _scene.add(dirLight);

    // prepare for bloom post-effects
    _renderTargetBase = BasicUtilities.createRenderTarget(window.innerWidth, window.innerHeight, "Base");
    _materialCopy = MaterialUtilities.createCopyMaterial();
    _bloomPass = new BloomPass(window.innerWidth, window.innerHeight, 0.1);
    _renderer.autoClear = false;

}

function renderBloom(glowOnly) {

    // Render all objects to base render target
    {
        _camera.layers.set(_ENTIRE_SCENE);

        _renderer.setRenderTarget(_renderTargetBase);
        _renderer.clear();
        _renderer.render(_scene, _camera);
    }

    // Copy texture from base render target to frame buffer
    {
        _materialCopy.uniforms["opacity"].value = 1.0;
        _materialCopy.uniforms["tDiffuse"].value = _renderTargetBase.texture;

        _renderer.setRenderTarget(null);
        _renderer.clear();
        _renderer.renderFullScreenQuad(_materialCopy);
    }

    // Render selected objects to base render target
    {
        _camera.layers.set(_BLOOM_SCENE);

        _renderer.setRenderTarget(_renderTargetBase);
        _renderer.clearColor();
        _renderer.render(_scene, _camera);

        // Apply bloom effect to base render target
        _bloomPass.render(_renderer, _renderTargetBase);
    }

    if (glowOnly === true) {

        _materialCopy.uniforms["opacity"].value = _params.intensity;
        _materialCopy.uniforms["tDiffuse"].value = _bloomPass.blurPass.renderTargetY.texture;

        _renderer.setRenderTarget(null);
        _renderer.clear();
        _renderer.renderFullScreenQuad(_materialCopy);

    } else {

        _materialCopy.uniforms["opacity"].value = _params.intensity;
        _materialCopy.uniforms["tDiffuse"].value = _bloomPass.blurPass.renderTargetY.texture;

        _renderer.setRenderTarget(null);
        _renderer.renderFullScreenQuad(_materialCopy);

    }

}

function customRender() {

    switch (_params.mode) {
        case 'Scene only':
            _renderer.render(_scene, _camera);
            break;
        case 'Glow only':
            renderBloom(true);
            break;
        case 'Scene with Glow':
        default:
            renderBloom(false);
            break;
    }
}

function onWindowResize() {

    //_renderTargetBase.setSize(window.innerWidth, window.innerHeight);
    //_bloomPass.setSize(window.innerWidth, window.innerHeight);

}

$(document).ready(function () {

    if (THREE.WEBGL.isWebGLAvailable() === false) {
        document.body.appendChild(WEBGL.getWebGLErrorMessage());
    }

    let initUtilities = new InitUtilities();

    initUtilities.initTrollRenderer();
    initUtilities.initSceneAndCamera();
    initUtilities.initMisc();

    _renderer = initUtilities.getRenderer();
    _scene = initUtilities.getScene();
    _camera = initUtilities.getCamera();

    window.addEventListener('click', onDocumentMouseClick, false);
    window.addEventListener('resize', onWindowResize, false);

    loadScene();
    createGui();

    initUtilities.setCustomRender(customRender);
    initUtilities.animate();
});
