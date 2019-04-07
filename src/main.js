"use strict";


function createPointLight ()
{
    let spriteMap = new THREE.TextureLoader().load( textureDir + "light.png" );
    let spriteMaterial = new THREE.SpriteMaterial( { map: spriteMap, color: 0xffffff } );
    let sprite = new THREE.Sprite( spriteMaterial );
    sprite.scale.set(1, 1, 1);

    let pointLight = new THREE.PointLight(0xffffff, 5.0);
    sprite.add(pointLight);
    sprite.position.y = 500;

    scene.add(sprite);
}

function loadScene()
{
    let urls = [ 'posx.jpg', 'negx.jpg', 'posy.jpg', 'negy.jpg', 'posz.jpg', 'negz.jpg' ];
    let cubeloader = new THREE.CubeTextureLoader().setPath( '../textures/cube/Bridge2/' );
    let envMap = null;

    cubeloader.load( urls, function ( texture ) {
        var pmremGenerator = new THREE.PMREMGenerator( texture );
        pmremGenerator.update( renderer );
        var pmremCubeUVPacker = new THREE.PMREMCubeUVPacker( pmremGenerator.cubeLods );
        pmremCubeUVPacker.update( renderer );
        envMap = pmremCubeUVPacker.CubeUVRenderTarget.texture;

        pmremGenerator.dispose();
        pmremCubeUVPacker.dispose();
        scene.background = texture;
    } );

    // Instantiate a loader
    let loader = new THREE.GLTFLoader();
    loader.load(
        // resource URL
        '../models/gltf/lamborghini_asterion_lpi910-4_concept_2014/scene.gltf',
        // called when the resource is loaded
        function ( gltf ) {

            let callback = function(vertText, fragText)
            {
                gltf.scene.traverse( function ( child ) {
                    if ( child.isMesh ) {

                        child.material.onBeforeCompile = shader => {
                            shader.vertexShader = vertText;
                            shader.fragmentShader = fragText;
                        }

                        child.material.envMap = envMap;
                    }
                } );

                scene.add( gltf.scene );
            }

            let vertShaderPath = 'shaders/meshphysical.vert';
            let fragShaderPath = 'shaders/meshphysical.frag';
            loadShaders(vertShaderPath, fragShaderPath, callback);
        },
        // called while loading is progressing
        function ( xhr ) {
            console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );
        },
        // called when loading has errors
        function ( error ) {
            console.log( 'An error happened' );
        }
    );

    createPointLight();

    // adjust camera
    camera.position.set( 0.0, 200.0, 500.0 );
    camera.lookAt(new THREE.Vector3(0.0, 0.0, 0.0));
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
