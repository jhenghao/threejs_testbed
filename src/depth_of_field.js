"use strict";

var renderTargetBase = null;
var renderTargetBlur = null;
var fsQuad = null;
var blurPass = null;
var materialCopy = null;
var materialMix = null;

var params = {
    enableDepthOfField: true,
};

function createGui()
{
    var gui = new dat.GUI();
    gui.add( params, 'enableDepthOfField' ).name( 'Enable' );
}

function loadScene()
{
    // create spheres
    var geometry = new THREE.IcosahedronBufferGeometry( 1, 4 );
    for ( var i = 0; i < 50; i ++ ) {
        var color = new THREE.Color();
        color.setHSL( Math.random(), 0.7, Math.random() * 0.2 + 0.05 );
        var material = new THREE.MeshPhongMaterial( { color: color, dithering: true } );
        var sphere = new THREE.Mesh( geometry, material );
        sphere.position.x = Math.random() * 10 - 5;
        sphere.position.y = Math.random() * 10 - 5;
        sphere.position.z = Math.random() * 10 - 5;
        sphere.position.normalize().multiplyScalar( Math.random() * 4.0 + 2.0 );
        sphere.scale.setScalar( Math.random() * Math.random() + 0.5 );
        scene.add( sphere );
    }

    // set camera
    camera.position.set( 0, 0, 15 );
    camera.lookAt( 0, 0, 0 );
    camera.fov = 40;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.near = 1;
    camera.far = 200;
    camera.updateProjectionMatrix();

    var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
    renderTargetBase = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, pars );
    renderTargetBase.texture.name = "Base";
    renderTargetBase.texture.generateMipmaps = false;
    renderTargetBase.stencilBuffer = false;
	renderTargetBase.depthBuffer = true;
	renderTargetBase.depthTexture = new THREE.DepthTexture();
	renderTargetBase.depthTexture.type = THREE.UnsignedShortType;

    renderTargetBlur = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, pars );
    renderTargetBlur.texture.name = "Blur";
    renderTargetBlur.texture.generateMipmaps = false;

    let copyShader = THREE.CopyShader;
    let copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
    copyUniforms[ "opacity" ].value = 1.0;
    copyUniforms[ "tDiffuse" ].value = renderTargetBase.texture;

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

    let callback = function(vertText, fragText)
    {
        materialMix = new THREE.ShaderMaterial( {
            uniforms: {
                "baseTexture": { value: renderTargetBase.texture },
                "blurTexture": { value: renderTargetBlur.texture },
                "zBuffer": { value: renderTargetBase.depthTexture },
                "zNear": { value: camera.near }, 
                "zFar": { value: camera.far }, 
                "vDepthOfField": { value: new THREE.Vector4(0, 1, -14, 1) }
            },
            vertexShader: vertText,
            fragmentShader: fragText,
        } );
    };

    let vertShaderPath = 'shaders/depth_of_field.vert';
    let fragShaderPath = 'shaders/depth_of_field.frag';
    loadShaders(vertShaderPath, fragShaderPath, callback);

    blurPass = new BlurPass(1.0, 3, new THREE.Vector2( window.innerWidth / 2.0, window.innerHeight / 2.0));
    blurPass.clear = true;
    blurPass.renderToScreen = false;

    // create light
    var directionalLight = new THREE.DirectionalLight( 0xffffff, 1.5 );
    directionalLight.position.set( 2, 2, 20 );
    scene.add( directionalLight );

    renderer.autoClear = false;
}

function renderDepthOfField() {

    if (materialMix == null)
        return;

    // render base scene
    renderer.setRenderTarget( renderTargetBase );
    renderer.clear();
    renderer.render( scene, camera );

    // render blur image
    renderer.setRenderTarget( renderTargetBlur );
    renderer.clear();

    fsQuad.material = materialCopy;
    fsQuad.render( renderer );

    blurPass.render( renderer, null, renderTargetBlur );

    // render depth of field
    fsQuad.material = materialMix;

    renderer.setRenderTarget( null );
    renderer.clear();
    fsQuad.render( renderer );
}

renderCustom = function () {

    if (params.enableDepthOfField)
        renderDepthOfField();
    else
        renderer.render( scene, camera );
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
