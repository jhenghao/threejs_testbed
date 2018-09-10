"use strict";

const textureDir = "../textures/";

function loadModel (geometry, texture, vertShaderPath, fragShaderPath) 
{
    let callback = function(vertText, fragText)
    {
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
        mat.uniforms.textureSampler.value = texture;

        let model = new THREE.Mesh(geometry, mat);
        model.position.set(0,0,0);

        scene.add(model);
        objects.push(model);
    };

    loadShaders(vertShaderPath, fragShaderPath, callback);
}

function loadScene()
{
    let texturePath = '../textures/crate.gif';
    let textureLoader = new THREE.TextureLoader();
    let texture = null;
    if (texturePath != null)
    {
        texture = textureLoader.load(texturePath);
        texture.magFilter = THREE.NearestFilter;
    }

    let geometry = new THREE.BoxGeometry( 5, 5, 5 );

    loadModel(
        geometry,
        texture,
        'shaders/vertex_lighting_point.vert',
        'shaders/vertex_lighting_point.frag'
    );

    createPointLight();

    addUpdateListener(update);
}

function createPointLight () {

    let spriteMap = new THREE.TextureLoader().load( textureDir + "light.png" );
    let spriteMaterial = new THREE.SpriteMaterial( { map: spriteMap, color: 0xffffff } );
    let sprite = new THREE.Sprite( spriteMaterial );
    sprite.scale.set(1, 1, 1);

    let pointLight = new THREE.PointLight(0xffffff, 5.0);
    sprite.add(pointLight);

    scene.add(sprite);
    objects.push(sprite);
}

function update (delta) {
}

loadScene();