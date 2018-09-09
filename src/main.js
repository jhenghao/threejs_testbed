"use strict";

let camera, scene, renderer;
let transformControl;
let orbitControl;
let clock = new THREE.Clock();
let objects = [];
let updateListeners = new Set();

init();

// Start animation
animate();

function init() {

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.sortObjects = false;
    document.body.appendChild( renderer.domElement );

    //

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 3000 );
    camera.position.set( 400, 400, 300 );
    camera.lookAt( new THREE.Vector3( 0, 200, 0 ) );

    scene = new THREE.Scene();
    scene.add( new THREE.GridHelper( 500, 10 ) );

    orbitControl = new THREE.OrbitControls( camera, renderer.domElement );
    orbitControl.enableZoom = true;
    orbitControl.enablePan = true;
    addUpdateListener(orbitControl.updateWithDelta);

    transformControl = new THREE.TransformControls( camera, renderer.domElement );
    scene.add( transformControl );

    document.addEventListener( 'mousedown', onDocumentMouseDown, false );

    window.addEventListener( 'resize', onWindowResize, false );

    window.addEventListener( 'keydown', function ( event ) {

        switch ( event.keyCode ) {

            case 81: // Q
                transformControl.setSpace( transformControl.space === "local" ? "world" : "local" );
                break;

            case 17: // Ctrl
                transformControl.setTranslationSnap( 100 );
                transformControl.setRotationSnap( THREE.Math.degToRad( 15 ) );
                break;

            case 87: // W
                transformControl.setMode( "translate" );
                break;

            case 69: // E
                transformControl.setMode( "rotate" );
                break;

            case 82: // R
                transformControl.setMode( "scale" );
                break;

            case 187:
            case 107: // +, =, num+
                transformControl.setSize( transformControl.size + 0.1 );
                break;

            case 189:
            case 109: // -, _, num-
                transformControl.setSize( Math.max( transformControl.size - 0.1, 0.1 ) );
                break;

        }

    });

    window.addEventListener( 'keyup', function ( event ) {

        switch ( event.keyCode ) {

            case 17: // Ctrl
                transformControl.setTranslationSnap( null );
                transformControl.setRotationSnap( null );
                break;

        }

    });

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

    render();

}

function onDocumentMouseDown( event ) 
{
    event.preventDefault();

    var mouse = new THREE.Vector2();
    mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = - (event.clientY / renderer.domElement.clientHeight) * 2 + 1;

    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera( mouse, camera );

    var intersects = raycaster.intersectObjects( objects );

    if (intersects.length > 0)
    {
        transformControl.attach(intersects[0].object);
        transformControl.update();
        render();
    }
}

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

function addUpdateListener (listener) {

    updateListeners.add(listener);
}

function deleteUpdateListener (listener) {

    updateListeners.delete(listener);
}

function render() {

    renderer.render( scene, camera );
}

function animate() {

    let delta = clock.getDelta();

    for (let updateListener of updateListeners)
        updateListener(delta);

    // Render scene
    render();
    requestAnimationFrame(animate);
}
