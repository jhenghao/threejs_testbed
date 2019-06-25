"use strict";

var bloomPass = null;
var bgTexture = null;
var renderTargetBase = null;
var fsQuad = null;
var materialAdditive = null;
var materialCopy = null;
var copyUniforms = null;

var params = {
    enableTexture: true
};

function createGui()
{
	var gui = new dat.GUI();

	gui.add( params, 'enableTexture' ).name( 'enable texture' ).onChange( function ( value ) {
    } );

	gui.add( bloomPass, 'threshold', 0, 1 ).step( 0.01 ).name( 'threshold' ).onChange( function ( value ) {
        bloomPass.threshold = value;
	} );

	gui.add( bloomPass, 'opacity', 0, 1 ).step( 0.01 ).name( 'opacity' ).onChange( function ( value ) {
		bloomPass.opacity = value;
    } );
}

function loadScene()
{
    bgTexture = new THREE.TextureLoader().load( textureDir + "Hong_Kong_Night_view.jpg" );

    let texturePass = new THREE.TexturePass(bgTexture, 1.0);
    composer.addPass(texturePass);

    // add post processing
    bloomPass = new BloomPass(new THREE.Vector2( window.innerWidth, window.innerHeight), 0.3);
    composer.addPass(bloomPass);
    composer.renderToScreen = false;

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
        depthTest: false,
        depthWrite: false,
        transparent: true
    } );

    renderer.autoClear = false;
}

renderCustom = function() {

    if (bgTexture == null)
        return;

    composer.render(scene, camera);

    renderer.setRenderTarget( null );
    renderer.clear();

    if (params.enableTexture)
    {
        fsQuad.material = materialCopy;
        copyUniforms[ "opacity" ].value = 1.0;
        copyUniforms[ "tDiffuse" ].value = bgTexture;

        renderer.setRenderTarget( null );
        fsQuad.render( renderer );
    }

    materialAdditive.map = composer.renderTarget2.texture;
    fsQuad.material = materialAdditive;

    renderer.setRenderTarget( null );
    fsQuad.render( renderer );
}

$( document ).ready(function()
{
    if ( WEBGL.isWebGLAvailable() === false ) {
        document.body.appendChild( WEBGL.getWebGLErrorMessage() );
    }

    init();
    loadScene();
    createGui();
    animate();
});
