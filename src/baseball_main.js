"use strict";

let baseball = null;
let pitcherPosition = new THREE.Vector3(0, 0, -26);
let homePlatePosition = new THREE.Vector3(0, 0 , 0);
let trajectory = null;

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

    //const loader = new THREE.TextureLoader();
    //const bgTexture = loader.load('../textures/catcher_view_adjusted.jpg');
    //scene.background = bgTexture;


    const loader = new THREE.TextureLoader();
    const bgTexture = loader.load('../textures/SuntrustParkDimensions.jpg');
    var geometry = new THREE.PlaneGeometry( 200, 200, 32 );
    var material = new THREE.MeshBasicMaterial( {map : bgTexture, side: THREE.DoubleSide} );
    var plane = new THREE.Mesh( geometry, material );
    //var quaternion = new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), Math.PI / 2 );
    plane.applyQuaternion( new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 1, 0, 0 ), Math.PI / 2 ) );
    plane.applyQuaternion( new THREE.Quaternion().setFromAxisAngle( new THREE.Vector3( 0, 1, 0 ), Math.PI ) );
    plane.position.x += 2;
    plane.position.z += -77;
    scene.add( plane );

    // Instantiate a loader
    /*
    let loader = new THREE.GLTFLoader();
    loader.load(
        // resource URL
        '../models/gltf/lamborghini_asterion_lpi910-4_concept_2014/scene.gltf',
        //'../models/gltf/brick_textures/scene.gltf',
        //'../models/gltf/pokemon_jigglypuff/scene.gltf',
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

            //let vertShaderPath = 'shaders/meshphysical.vert';
            //let fragShaderPath = 'shaders/meshphysical.frag';
            let vertShaderPath = 'shaders/meshlambert.vert';
            let fragShaderPath = 'shaders/meshlambert.frag';
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
    */

    createPointLight();

    // adjust camera
    camera.position.set( 0.0, 3.0, 0.0 );
    camera.lookAt(new THREE.Vector3(0.0, 0.0, -20.0));

    // baseball
    var geometry = new THREE.SphereGeometry( 0.1, 32, 32 );
    var material = new THREE.MeshBasicMaterial( {color: 0xff0000} );
    baseball = new THREE.Mesh( geometry, material );
    baseball.position.set(pitcherPosition.x, 3, pitcherPosition.z);
    scene.add( baseball );

    {
        var geometry = new THREE.SphereGeometry( 1, 32, 32 );
        var material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
        var sphere = new THREE.Mesh( geometry, material );
        sphere.position.set(pitcherPosition.x, pitcherPosition.y, pitcherPosition.z);
        scene.add( sphere );
    }

    {
        //var geometry = new THREE.BoxGeometry( 1, 1, 1 );
        //var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
        //var cube = new THREE.Mesh( geometry, material );
        //scene.add( cube );
    }

    // strike zone
    {
        var spriteMap = new THREE.TextureLoader().load( '../textures/transparent_square.png' );
        var spriteMaterial = new THREE.SpriteMaterial( { map: spriteMap, color: 0xffffff } );
        var sprite = new THREE.Sprite( spriteMaterial );
        spriteMaterial.depthTest = false;
        spriteMaterial.depthWrite = false;
        sprite.scale.set(window.innerWidth * 0.0015, window.innerHeight * 0.0036, 1);
        sprite.position.set(0, 2.2, -5);
        sprite.renderOrder = 1;

        scene.add( sprite );
    }

    // trajectory
    {
        var material = new THREE.LineBasicMaterial( { color: 0x0000ff } );
        trajectory = new THREE.Geometry();
        var line = new THREE.Line( trajectory, material );

        scene.add( line );
    }
}

let t = 2.0;
let x0 = pitcherPosition.x;
let x = 0.4;
let vx = (x - x0) / t;
let y0 = 5;
let y = -0.3;
let vy = (y - y0) / t;
let vz = Math.abs(pitcherPosition.z - homePlatePosition.z) / t;

let ax = 0.5;
let ay = 0.5;

console.log(vz);
let total = 0;

function update(deltaTime)
{
    if (baseball.position.z < -5)
    {
        total += deltaTime;
        let t = total / 1000;
        //console.log(total);
        //baseball.position.x += deltaTime * vx;
        //baseball.position.y += deltaTime * vy;
        //baseball.position.z += deltaTime * vz;
        baseball.position.x = x0 + vx * t + 0.5 * ax * t * t;
        baseball.position.y = y0 + vy * t + 0.5 * ay * t * t;
        baseball.position.z = pitcherPosition.z + vz * t;

        trajectory.vertices.push(new THREE.Vector3(baseball.position.x, baseball.position.y, baseball.position.z) );

        //console.log(baseball.position.z);
    }
}

$( document ).ready(function()
{
    if ( WEBGL.isWebGLAvailable() === false ) {
        document.body.appendChild( WEBGL.getWebGLErrorMessage() );
    }

    init();
    loadScene();

    animateCallback = update;

    animate();
});
