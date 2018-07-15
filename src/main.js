"use strict";

let camera, scene, renderer;
let transformControl;
let orbitControl;
let clock = new THREE.Clock();
let objects = [];
const textureDir = "../textures/";

// Character 3d object
let character = null;

let pointLight;

init();

// Start animation
animate();
render();

function createPointLight () {

    let spriteMap = new THREE.TextureLoader().load( textureDir + "light.png" );
    let spriteMaterial = new THREE.SpriteMaterial( { map: spriteMap, color: 0xffffff } );
    let sprite = new THREE.Sprite( spriteMaterial );
    sprite.scale.set(100, 100, 1);

    pointLight = new THREE.PointLight(0xffffff, 1.0);
    sprite.add(pointLight);

    scene.add(sprite);
    objects.push(sprite);
}

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

    var light = new THREE.DirectionalLight( 0xffffff, 2 );
    light.position.set( 1, 1, 1 );
    scene.add( light );

    createPointLight();

    orbitControl = new THREE.OrbitControls( camera, renderer.domElement );
    orbitControl.enableZoom = true;
    orbitControl.enablePan = true;

    transformControl = new THREE.TransformControls( camera, renderer.domElement );
    scene.add( transformControl );

    loadObjects();

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

function buildCharacter () 
{
    let callback = function(vertText, fragText)
    {
        let g = new THREE.BoxGeometry( 200, 200, 200 )
            let textureLoader = new THREE.TextureLoader();
        let creatureImage = textureLoader.load('../textures/mrevil.png');
        creatureImage.magFilter = THREE.NearestFilter;

        let mat = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([
                          THREE.UniformsLib['lights'],
                          {
                              lightIntensity: {type: 'f', value: 1.0},
                              textureSampler: {type: 't', value: null}
                          }
                          ]),

            vertexShader: vertText,
            fragmentShader: fragText,
            transparent: true,
            lights: true
        });

        // THREE.UniformsUtils.merge() call THREE.clone() on
        // each uniform. We don't want our texture to be
        // duplicated, so I assign it to the uniform value
        // right here.
        mat.uniforms.textureSampler.value = creatureImage;

        character = new THREE.Mesh(g, mat);
        character.position.set(1,1,1);
        scene.add(character);
        objects.push(character);
    };

    //loadShaders('shaders/test.vert', 'shaders/test.frag', callback);
    loadShaders('shaders/vertex_lighting_point.vert', 'shaders/vertex_lighting_point.frag', callback);
}

function loadObjects()
{
    var texture = new THREE.TextureLoader().load( '../textures/crate.gif', render );
    texture.mapping = THREE.UVMapping;
    texture.anisotropy = renderer.getMaxAnisotropy();

    var geometry = new THREE.BoxGeometry( 200, 200, 200 );
    var material = new THREE.MeshLambertMaterial( { map: texture } );

    var mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );
    objects.push(mesh);

    // Create character
    buildCharacter();
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

function render() {

    let delta = clock.getDelta();

    orbitControl.updateWithDelta(delta);

    renderer.render( scene, camera );

}

function animate() {
    // Update light profile
    if (character !== null)
    {
        var timestampNow = new Date().getTime()/1000.0;
        var lightIntensity = 0.75 + 0.25 * Math.cos(timestampNow * Math.PI);

        character.material.uniforms.lightIntensity.value = lightIntensity;
        pointLight.color.setHSL(lightIntensity, 1.0, 0.5);
    }

    // Render scene
    render();
    requestAnimationFrame(animate);
}
