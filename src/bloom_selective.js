"use strict";

var ENTIRE_SCENE = 0, BLOOM_SCENE = 1;
var mouse = new THREE.Vector2();
var raycaster = new THREE.Raycaster();

var renderTargetBase = null;
var fsQuad = null;
var materialCopy = null;
var copyUniforms = null;
var materialAdditive = null;
var bloomPass = null;

var params = {
    mode: "Scene with Glow"
};

function createGui()
{
    var gui = new dat.GUI();

    gui.add( bloomPass, 'threshold', 0, 1 ).step( 0.01 ).name( 'threshold' ).onChange( function ( value ) {
        bloomPass.threshold = value;
	} );

	gui.add( bloomPass, 'opacity', 0, 5 ).step( 0.01 ).name( 'opacity' ).onChange( function ( value ) {
		bloomPass.opacity = value;
    } );

    gui.add( params, 'mode', [ 'Scene with Glow', 'Glow only', 'Scene only' ] ).onChange( function ( value ) {
    } );
}

function onDocumentMouseClick( event ) {
    event.preventDefault();
    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
    raycaster.setFromCamera( mouse, camera );
    var intersects = raycaster.intersectObjects( scene.children );
    if ( intersects.length > 0 ) {
        var object = intersects[ 0 ].object;
        object.layers.toggle( BLOOM_SCENE );
    }
}

function loadScene()
{
    // create spheres
    var geometry = new THREE.IcosahedronBufferGeometry( 1, 4 );
    for ( var i = 0; i < 50; i ++ ) {
        var color = new THREE.Color();
        color.setHSL( Math.random(), 0.7, Math.random() * 0.2 + 0.05 );
        var material = new THREE.MeshBasicMaterial( { color: color } );
        var sphere = new THREE.Mesh( geometry, material );
        sphere.position.x = Math.random() * 10 - 5;
        sphere.position.y = Math.random() * 10 - 5;
        sphere.position.z = Math.random() * 10 - 5;
        sphere.position.normalize().multiplyScalar( Math.random() * 4.0 + 2.0 );
        sphere.scale.setScalar( Math.random() * Math.random() + 0.5 );
        scene.add( sphere );
        if ( Math.random() < 0.25 ) sphere.layers.enable( BLOOM_SCENE );
    }

    // set camera
    camera.position.set( 0, 0, 15 );
    camera.lookAt( 0, 0, 0 );
    camera.fov = 40;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.near = 1;
    camera.far = 200;
    camera.updateProjectionMatrix();

    // prepare for bloom post-effects
    var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
    renderTargetBase = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, pars );
    renderTargetBase.texture.name = "Base";
    renderTargetBase.texture.generateMipmaps = false;


    var copyShader = THREE.CopyShader;

    copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );

    fsQuad = new THREE.Pass.FullScreenQuad( null );
    materialCopy = new THREE.ShaderMaterial( {
        uniforms: copyUniforms,
        vertexShader: copyShader.vertexShader,
        fragmentShader: copyShader.fragmentShader,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true
    } );

    materialAdditive = new THREE.MeshBasicMaterial( {
        blending: THREE.AdditiveBlending,
    } );

    bloomPass = new BloomPass(new THREE.Vector2( window.innerWidth, window.innerHeight), 0.1);
    bloomPass.opacity = 2.5;

    renderer.autoClear = false;
}

function renderBloom( mask ) {

    camera.layers.set( ENTIRE_SCENE );

    renderer.setRenderTarget( renderTargetBase );
    renderer.clear();
    renderer.render( scene, camera );

    fsQuad.material = materialCopy;
    copyUniforms[ "opacity" ].value = 1.0;
    copyUniforms[ "tDiffuse" ].value = renderTargetBase.texture;

    renderer.setRenderTarget( null );
    fsQuad.render( renderer );

    camera.layers.set( BLOOM_SCENE );
    
    renderer.setRenderTarget( renderTargetBase );
    renderer.clearColor();
    renderer.render( scene, camera );

    bloomPass.render( renderer, null, renderTargetBase );

    if ( mask === true ) {

        materialAdditive.map = renderTargetBase.texture;
        fsQuad.material = materialAdditive;

        renderer.setRenderTarget( null );
        fsQuad.render( renderer );

    } else {

        fsQuad.material = materialCopy;
        copyUniforms[ "opacity" ].value = 1.0;
        copyUniforms[ "tDiffuse" ].value = renderTargetBase.texture;

        renderer.setRenderTarget( null );
        renderer.clear();
        fsQuad.render( renderer );

    }
}

renderCustom = function () {

    switch ( params.mode ) {
        case 'Scene only':
            renderer.render( scene, camera );
            break;
        case 'Glow only':
            renderBloom( false );
            break;
        case 'Scene with Glow':
        default:
            renderBloom( true );
            break;
    }
}

$( document ).ready(function()
{
    if ( WEBGL.isWebGLAvailable() === false ) {
        document.body.appendChild( WEBGL.getWebGLErrorMessage() );
    }

    window.addEventListener( 'click', onDocumentMouseClick, false );

    init();
    loadScene();
    createGui();
    animate();
});
