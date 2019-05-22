"use strict";

const textureDir = "../textures/";
var container, stats, controls;
var camera, scene, renderer, composer;
var animateCallback;
var prevTimestamp = null;


function loadShaders (vertShaderPath, fragShaderPath, callback)
{
    let vertText;
    let fragText;

    let vertRequest = $.get(vertShaderPath,
            function (data) { vertText = data; });
    let fragRequest = $.get(fragShaderPath,
            function (data) { fragText = data; });

    $.when(vertRequest, fragRequest).done(function(){
        callback(vertText, fragText);
    });
}

function init()
{
    container = document.createElement( 'div' );
    document.body.appendChild( container );

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.25, 2000 );
    camera.position.set( - 1.8, 0.9, 2.7 );

    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.gammaOutput = true;
    container.appendChild( renderer.domElement );

    let renderPass = new THREE.RenderPass( scene, camera );

    composer = new THREE.EffectComposer( renderer );
    composer.setSize( window.innerWidth, window.innerHeight );
    composer.addPass( renderPass );

    window.addEventListener( 'resize', onWindowResize, false );

    // stats
    stats = new Stats();
    container.appendChild( stats.dom );
}

function createOrditControl()
{
    controls = new THREE.OrbitControls( camera );
    controls.target.set( 0, - 0.2, - 0.2 );
    controls.update();
}

function onWindowResize()
{
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
}

function animate(timestamp)
{
    requestAnimationFrame( animate );

    let deltaTime = null;
    if (prevTimestamp && animateCallback)
    {
        deltaTime = timestamp - prevTimestamp;
        animateCallback(deltaTime);
    }

    composer.render(deltaTime);

    stats.update();

    prevTimestamp = timestamp;
}