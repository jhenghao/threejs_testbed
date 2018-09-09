"use strict";

const textureDir = "../textures/";

// Character 3d object
let character = null;

let pointLight;

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

    //addObject(mesh);
    scene.add( mesh );
    objects.push(mesh);

    // Create character
    buildCharacter();



    var light = new THREE.DirectionalLight( 0xffffff, 2 );
    light.position.set( 1, 1, 1 );
    scene.add( light );

    createPointLight();

    addUpdateListener(update);
}

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

function update (delta) {
    // Update light profile
    if (character !== null)
    {
        var timestampNow = new Date().getTime()/1000.0;
        var lightIntensity = 0.75 + 0.25 * Math.cos(timestampNow * Math.PI);

        character.material.uniforms.lightIntensity.value = lightIntensity;
        pointLight.color.setHSL(lightIntensity, 1.0, 0.5);
    }
}

loadObjects();