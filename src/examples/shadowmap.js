"use strict";

import { MiscUtilities } from '../troll_renderer/misc_utilities.js'
import { MaterialUtilities } from '../troll_renderer/material_utilities.js';

let _miscUtilities;

let _renderer;
let _scene;
let _camera;


var params = {
    enableDepthOfField: true,
};

function createGui() {
    var gui = new dat.GUI();
    gui.add(params, 'enableDepthOfField').name('Enable');
}


var phongMaterial = null;




var clock;
var dirLight, spotLight;
var torusKnot, cube, ground;


function loadScene() {

    phongMaterial = MaterialUtilities.createPhongMaterial({
        color: 0xaaaaaa,
        shininess: 150,
        specular: 0x222222
    });

    _camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    _camera.position.set(0, 15, 35);
    _camera.lookAt(0, 0, 0);

    // Lights

    let ambiantLight = new THREE.AmbientLight(0x404040);
    _scene.add(ambiantLight);

    //spotLight = new THREE.SpotLight(0xffffff);
    //spotLight.name = 'Spot Light';
    //spotLight.angle = Math.PI / 5;
    //spotLight.penumbra = 0.3;
    //spotLight.position.set(10, 10, 5);
    //spotLight.castShadow = true;
    //spotLight.shadow.camera.near = 8;
    //spotLight.shadow.camera.far = 30;
    //spotLight.shadow.mapSize.width = 1024;
    //spotLight.shadow.mapSize.height = 1024;
    //scene.add(spotLight);

    dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.name = 'Dir. Light';
    dirLight.position.set(0, 10, 0);
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 10;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.left = - 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = - 15;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    _scene.add(dirLight);

    // Geometry
    var geometry = new THREE.TorusKnotBufferGeometry(25, 8, 75, 20);

    torusKnot = new THREE.Mesh(geometry, phongMaterial);
    torusKnot.scale.multiplyScalar(1 / 18);
    torusKnot.position.y = 4;
    torusKnot.castShadow = true;
    torusKnot.receiveShadow = true;
    _scene.add(torusKnot);

    //var geometry = new THREE.BoxBufferGeometry(3, 3, 3);

    //cube = new THREE.Mesh(geometry, phongMaterial);
    //cube.position.set(8, 3, 8);
    //cube.castShadow = true;
    //cube.receiveShadow = true;
    //scene.add(cube);


    /*
    var geometry = new THREE.BoxBufferGeometry(10, 0.15, 10);

    ground = new THREE.Mesh(geometry, phongMaterial);
    ground.scale.multiplyScalar(3);
    ground.castShadow = false;
    ground.receiveShadow = true;
    scene.add( ground );
    */

}

function customRender() {

    //torusKnot.rotation.x += 0.25 * delta;
    //torusKnot.rotation.y += 2 * delta;
    //torusKnot.rotation.z += 1 * delta;

    //cube.rotation.x += 0.25 * delta;
    //cube.rotation.y += 2 * delta;
    //cube.rotation.z += 1 * delta;

    _renderer.render(_scene, _camera);
}

$(document).ready(function () {

    if (THREE.WEBGL.isWebGLAvailable() === false) {
        document.body.appendChild(THREE.WEBGL.getWebGLErrorMessage());
    }

    _miscUtilities = new MiscUtilities()

    _miscUtilities.initTrollRenderer();
    _miscUtilities.initSceneAndCamera();
    _miscUtilities.initMisc();

    _renderer = _miscUtilities.getRenderer();
    _scene = _miscUtilities.getScene();
    _camera = _miscUtilities.getCamera();

    loadScene();

    createGui();

    _miscUtilities.setCustomRender(customRender);
    _miscUtilities.animate();
});
