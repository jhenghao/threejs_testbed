"use strict";

var phongShadingVertText = null;
var phongShadingFragText = null;

var params = {
    enableDepthOfField: true,
};

function createGui()
{
    var gui = new dat.GUI();
    gui.add( params, 'enableDepthOfField' ).name( 'Enable' );
}


var depthMaterial = new THREE.MeshDepthMaterial( {

    depthPacking: THREE.RGBADepthPacking,

} );

var _frustum = new THREE.Frustum();
var _projScreenMatrix = new THREE.Matrix4();

var _shadowMapSize = new THREE.Vector2();
var _maxShadowMapSize = null;

var _lookTarget = new THREE.Vector3();
var _lightPositionWorld = new THREE.Vector3();


function initShadowMap( _objects, maxTextureSize ) {

    _maxShadowMapSize = new THREE.Vector2( maxTextureSize, maxTextureSize );

}

function renderShadowMap ( renderer, lights, scene, camera ) {

    if ( lights.length === 0 ) return;

    var currentRenderTarget = renderer.getRenderTarget();

    var _state = renderer.state;

    // Set GL state for depth map.
    _state.setBlending( THREE.NoBlending );
    _state.buffers.color.setClear( 1, 1, 1, 1 );
    _state.buffers.depth.setTest( true );
    _state.setScissorTest( false );

    // render depth map

    for ( var i = 0, il = lights.length; i < il; i ++ ) {

        var light = lights[ i ];
        var shadow = light.shadow;

        if ( shadow === undefined ) {

            console.warn( 'THREE.WebGLShadowMap:', light, 'has no shadow.' );
            continue;

        }

        var shadowCamera = shadow.camera;

        _shadowMapSize.copy( shadow.mapSize );
        _shadowMapSize.min( _maxShadowMapSize );

        if ( shadow.map === null ) {

            var pars = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };

            shadow.map = new THREE.WebGLRenderTarget( _shadowMapSize.x, _shadowMapSize.y, pars );
            shadow.map.texture.name = light.name + ".shadowMap";

            shadowCamera.updateProjectionMatrix();

        }

        if ( shadow.isSpotLightShadow ) {

            shadow.update( light );

        }

        var shadowMap = shadow.map;
        var shadowMatrix = shadow.matrix;

        _lightPositionWorld.setFromMatrixPosition( light.matrixWorld );
        shadowCamera.position.copy( _lightPositionWorld );


        _lookTarget.setFromMatrixPosition( light.target.matrixWorld );
        shadowCamera.lookAt( _lookTarget );
        shadowCamera.updateMatrixWorld();

        // compute shadow matrix

        shadowMatrix.set(
            0.5, 0.0, 0.0, 0.5,
            0.0, 0.5, 0.0, 0.5,
            0.0, 0.0, 0.5, 0.5,
            0.0, 0.0, 0.0, 1.0
        );

        shadowMatrix.multiply( shadowCamera.projectionMatrix );
        shadowMatrix.multiply( shadowCamera.matrixWorldInverse );


        renderer.setRenderTarget( shadowMap );
        renderer.clear();

        // update camera matrices and frustum

        _projScreenMatrix.multiplyMatrices( shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse );
        _frustum.setFromMatrix( _projScreenMatrix );

        // set object matrices & frustum culling

        //renderObject( renderer, scene, camera, shadowCamera );
        renderer.render( scene, shadowCamera );

    }

    renderer.setRenderTarget( currentRenderTarget );

};

function renderObject( renderer, object, camera, shadowCamera ) {

    if ( object.visible === false ) return;

    var visible = object.layers.test( camera.layers );

    if ( visible && ( object.isMesh || object.isLine || object.isPoints ) ) {

        //if ( object.castShadow && ( ! object.frustumCulled || _frustum.intersectsObject( object ) ) ) {
        if ( ! object.frustumCulled || _frustum.intersectsObject( object ) ) {

            object.modelViewMatrix.multiplyMatrices( shadowCamera.matrixWorldInverse, object.matrixWorld );

            //var geometry = _objects.update( object );
            var geometry = object.geometry;
            var material = object.material;

            if ( Array.isArray( material ) ) {

                var groups = geometry.groups;

                for ( var k = 0, kl = groups.length; k < kl; k ++ ) {

                    var group = groups[ k ];
                    var groupMaterial = material[ group.materialIndex ];

                    if ( groupMaterial && groupMaterial.visible ) {

                        renderer.renderBufferDirect( shadowCamera, null, geometry, depthMaterial, object, group );

                    }

                }

            } else if ( material.visible ) {

                renderer.renderBufferDirect( shadowCamera, null, geometry, depthMaterial, object, null );

            }

        }

    }

    var children = object.children;

    for ( var i = 0, l = children.length; i < l; i ++ ) {

        renderObject( renderer, children[ i ], camera, shadowCamera );

    }

}




var clock;
var dirLight, spotLight;
var torusKnot, cube;
var dirLightShadowMapViewer, spotLightShadowMapViewer;


function loadScene() {

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.set( 0, 15, 35 );
    camera.lookAt( 0, 0, 0 );

    // Lights

    scene.add( new THREE.AmbientLight( 0x404040 ) );

    spotLight = new THREE.SpotLight( 0xffffff );
    spotLight.name = 'Spot Light';
    spotLight.angle = Math.PI / 5;
    spotLight.penumbra = 0.3;
    spotLight.position.set( 10, 10, 5 );
    spotLight.castShadow = true;
    spotLight.shadow.camera.near = 8;
    spotLight.shadow.camera.far = 30;
    spotLight.shadow.mapSize.width = 1024;
    spotLight.shadow.mapSize.height = 1024;
    scene.add( spotLight );

    dirLight = new THREE.DirectionalLight( 0xffffff, 1 );
    dirLight.name = 'Dir. Light';
    dirLight.position.set( 0, 10, 0 );
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 10;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.left = - 15;
    dirLight.shadow.camera.top	= 15;
    dirLight.shadow.camera.bottom = - 15;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add( dirLight );

    // Geometry
    var geometry = new THREE.TorusKnotBufferGeometry( 25, 8, 75, 20 );
/*
    var material = new THREE.MeshPhongMaterial( {
        color: 0xff0000,
        shininess: 150,
        specular: 0x222222
    } );
*/


    var material = new THREE.RawShaderMaterial( {
        uniforms: THREE.UniformsUtils.merge( [
            THREE.UniformsLib.common,
            THREE.UniformsLib.lights,
            {
				emissive: { value: new THREE.Color( 0x000000 ) },
				specular: { value: new THREE.Color( 0x111111 ) },
				shininess: { value: 30 }
			},
		] ),
        vertexShader: phongShadingVertText,
        fragmentShader: phongShadingFragText,
    } );

    material.lights = true;
    material.color = new THREE.Color( 0xff0000 );
    material.specular = new THREE.Color( 0x222222 );
	material.shininess = 150;
    material.refreshFunction = refreshUniformsPhong;


    //renderer.shadowMap.enabled = true;
	//renderer.shadowMap.type = THREE.BasicShadowMap;

    torusKnot = new THREE.Mesh( geometry, material );
    torusKnot.scale.multiplyScalar( 1 / 18 );
    torusKnot.position.y = 3;
    torusKnot.castShadow = true;
    torusKnot.receiveShadow = true;
    scene.add( torusKnot );

    var geometry = new THREE.BoxBufferGeometry( 3, 3, 3 );
    cube = new THREE.Mesh( geometry, material );
    cube.position.set( 8, 3, 8 );
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add( cube );

/*
    var geometry = new THREE.BoxBufferGeometry( 10, 0.15, 10 );

    var material = new THREE.ShaderMaterial( {
        color: 0xa0adaf,
        shininess: 150,
        specular: 0x111111,
        vertexShader: phongShadingVertText,
        fragmentShader: phongShadingFragText,
    } );

    var ground = new THREE.Mesh( geometry, material );
    ground.scale.multiplyScalar( 3 );
    ground.castShadow = false;
    ground.receiveShadow = true;
    scene.add( ground );
    */
}

function initShadowMapViewers() {

    dirLightShadowMapViewer = new THREE.ShadowMapViewer( dirLight );
    dirLightShadowMapViewer.position.x = 10;
    dirLightShadowMapViewer.position.y = 10;
    dirLightShadowMapViewer.size.width = 256;
    dirLightShadowMapViewer.size.height = 256;
    dirLightShadowMapViewer.update(); //Required when setting position or size directly

    spotLightShadowMapViewer = new THREE.ShadowMapViewer( spotLight );
    spotLightShadowMapViewer.size.set( 256, 256 );
    spotLightShadowMapViewer.position.set( 276, 10 );
    // spotLightShadowMapViewer.update();	//NOT required because .set updates automatically

}

function initMisc() {

    // Mouse control
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.target.set( 0, 2, 0 );
    controls.update();

    clock = new THREE.Clock();

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

    dirLightShadowMapViewer.updateForWindowResize();
    spotLightShadowMapViewer.updateForWindowResize();

}

function renderShadowMapViewers() {

    dirLightShadowMapViewer.enabled = true;
    dirLightShadowMapViewer.render( renderer );
    spotLightShadowMapViewer.render( renderer );

}

renderCustom = function () {

    var delta = clock.getDelta();

    renderer.render( scene, camera );

    //renderScene();

    //renderShadowMap( renderer, [ dirLight, spotLight ], scene, camera );

    //renderShadowMapViewers();

    torusKnot.rotation.x += 0.25 * delta;
    torusKnot.rotation.y += 2 * delta;
    torusKnot.rotation.z += 1 * delta;

    cube.rotation.x += 0.25 * delta;
    cube.rotation.y += 2 * delta;
    cube.rotation.z += 1 * delta;
}

$( document ).ready(function()
{
    if ( WEBGL.isWebGLAvailable() === false ) {
        document.body.appendChild( WEBGL.getWebGLErrorMessage() );
    }

    let callback = function(vertText, fragText)
    {
        phongShadingVertText = vertText;
        phongShadingFragText = fragText;

        init();
    
        //initShadowMap( renderer.objects, renderer.capabilities.maxTextureSize );
        loadScene();
        //initShadowMapViewers();
        //initMisc();
        createGui();
        animate();
    };

    let vertShaderPath = 'shaders/meshphong.vert';
    let fragShaderPath = 'shaders/meshphong.frag';
    loadShaders(vertShaderPath, fragShaderPath, callback);
});
