'use strict';

var gl = null;
var programIdCount = 0;
var count = 0;

var lightsState = {

    id: count ++,

    hash: {
        stateID: - 1,
        directionalLength: - 1,
        pointLength: - 1,
        spotLength: - 1,
        shadowsLength: - 1
    },

    ambient: [ 0, 0, 0 ],
    directional: [],
    directionalShadowMap: [],
    directionalShadowMatrix: [],
    spot: [],
    spotShadowMap: [],
    spotShadowMatrix: [],
    point: [],
    pointShadowMap: [],
    pointShadowMatrix: [],

};

var lightUniformsCache = {};

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

function isWebGl2 ( gl )
{
	return typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
}

function getLightUniforms ( light ) {

    if ( lightUniformsCache[ light.id ] !== undefined ) {

        return lightUniformsCache[ light.id ];

    }

    var uniforms;

    switch ( light.type ) {

        case 'DirectionalLight':
            uniforms = {
                direction: new THREE.Vector3(),
                color: new THREE.Color(),

                shadow: false,
                shadowBias: 0,
                shadowRadius: 1,
                shadowMapSize: new THREE.Vector2()
            };
            break;

        case 'SpotLight':
            uniforms = {
                position: new THREE.Vector3(),
                direction: new THREE.Vector3(),
                color: new THREE.Color(),
                distance: 0,
                coneCos: 0,
                penumbraCos: 0,
                decay: 0,

                shadow: false,
                shadowBias: 0,
                shadowRadius: 1,
                shadowMapSize: new THREE.Vector2()
            };
            break;

        case 'PointLight':
            uniforms = {
                position: new THREE.Vector3(),
                color: new THREE.Color(),
                distance: 0,
                decay: 0,

                shadow: false,
                shadowBias: 0,
                shadowRadius: 1,
                shadowMapSize: new THREE.Vector2(),
                shadowCameraNear: 1,
                shadowCameraFar: 1000
            };
            break;

    }

    lightUniformsCache[ light.id ] = uniforms;

    return uniforms;
}

function setupLights( lights, shadows, camera ) {

    var r = 0, g = 0, b = 0;

    var directionalLength = 0;
    var pointLength = 0;
    var spotLength = 0;

    var viewMatrix = camera.matrixWorldInverse;
    var vector3 = new THREE.Vector3();

    for ( var i = 0, l = lights.length; i < l; i ++ ) {

        var light = lights[ i ];

        var color = light.color;
        var intensity = light.intensity;
        var distance = light.distance;

        var shadowMap = ( light.shadow && light.shadow.map ) ? light.shadow.map.texture : null;

        if ( light.isAmbientLight ) {

            r += color.r * intensity;
            g += color.g * intensity;
            b += color.b * intensity;

        } else if ( light.isDirectionalLight ) {

            var uniforms = getLightUniforms( light );

            uniforms.color.copy( light.color ).multiplyScalar( light.intensity );
            uniforms.direction.setFromMatrixPosition( light.matrixWorld );
            vector3.setFromMatrixPosition( light.target.matrixWorld );
            uniforms.direction.sub( vector3 );
            uniforms.direction.transformDirection( viewMatrix );

            uniforms.shadow = light.castShadow;

            if ( light.castShadow ) {

                var shadow = light.shadow;

                uniforms.shadowBias = shadow.bias;
                uniforms.shadowRadius = shadow.radius;
                uniforms.shadowMapSize = shadow.mapSize;

            }

            lightsState.directionalShadowMap[ directionalLength ] = shadowMap;
            lightsState.directionalShadowMatrix[ directionalLength ] = light.shadow.matrix;
            lightsState.directional[ directionalLength ] = uniforms;

            directionalLength ++;

        } else if ( light.isSpotLight ) {

            var uniforms = getLightUniforms( light );

            uniforms.position.setFromMatrixPosition( light.matrixWorld );
            uniforms.position.applyMatrix4( viewMatrix );

            uniforms.color.copy( color ).multiplyScalar( intensity );
            uniforms.distance = distance;

            uniforms.direction.setFromMatrixPosition( light.matrixWorld );
            vector3.setFromMatrixPosition( light.target.matrixWorld );
            uniforms.direction.sub( vector3 );
            uniforms.direction.transformDirection( viewMatrix );

            uniforms.coneCos = Math.cos( light.angle );
            uniforms.penumbraCos = Math.cos( light.angle * ( 1 - light.penumbra ) );
            uniforms.decay = light.decay;

            uniforms.shadow = light.castShadow;

            if ( light.castShadow ) {

                var shadow = light.shadow;

                uniforms.shadowBias = shadow.bias;
                uniforms.shadowRadius = shadow.radius;
                uniforms.shadowMapSize = shadow.mapSize;

            }

            lightsState.spotShadowMap[ spotLength ] = shadowMap;
            lightsState.spotShadowMatrix[ spotLength ] = light.shadow.matrix;
            lightsState.spot[ spotLength ] = uniforms;

            spotLength ++;

        } else if ( light.isPointLight ) {

            var uniforms = getLightUniforms( light );

            uniforms.position.setFromMatrixPosition( light.matrixWorld );
            uniforms.position.applyMatrix4( viewMatrix );

            uniforms.color.copy( light.color ).multiplyScalar( light.intensity );
            uniforms.distance = light.distance;
            uniforms.decay = light.decay;

            uniforms.shadow = light.castShadow;

            if ( light.castShadow ) {

                var shadow = light.shadow;

                uniforms.shadowBias = shadow.bias;
                uniforms.shadowRadius = shadow.radius;
                uniforms.shadowMapSize = shadow.mapSize;
                uniforms.shadowCameraNear = shadow.camera.near;
                uniforms.shadowCameraFar = shadow.camera.far;

            }

            lightsState.pointShadowMap[ pointLength ] = shadowMap;
            lightsState.pointShadowMatrix[ pointLength ] = light.shadow.matrix;
            lightsState.point[ pointLength ] = uniforms;

            pointLength ++;

        }

    }

    lightsState.ambient[ 0 ] = r;
    lightsState.ambient[ 1 ] = g;
    lightsState.ambient[ 2 ] = b;

    lightsState.directional.length = directionalLength;
    lightsState.spot.length = spotLength;
    lightsState.point.length = pointLength;

    lightsState.hash.stateID = lightsState.id;
    lightsState.hash.directionalLength = directionalLength;
    lightsState.hash.pointLength = pointLength;
    lightsState.hash.spotLength = spotLength;
    lightsState.hash.shadowsLength = shadows.length;

    return lightsState;
}
