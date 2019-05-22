"use strict";

function loadScene()
{
    let bgTexture = new THREE.TextureLoader().load( textureDir + "IMG_4567.JPG" );
    scene.background = bgTexture;

    // add post processing
    var blurPass = new BlurPass();
    composer.addPass(blurPass);

    var effectCopy = new THREE.ShaderPass(THREE.CopyShader);
    effectCopy.renderToScreen = true;
    composer.addPass(effectCopy);
}

$( document ).ready(function()
{
    if ( WEBGL.isWebGLAvailable() === false ) {
        document.body.appendChild( WEBGL.getWebGLErrorMessage() );
    }

    init();
    loadScene();
    animate();
});
