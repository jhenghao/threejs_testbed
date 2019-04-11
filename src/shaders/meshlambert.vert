#define LAMBERT

varying vec3 vLightFront;
varying vec3 vIndirectFront;

#ifdef DOUBLE_SIDED
	varying vec3 vLightBack;
	varying vec3 vIndirectBack;
#endif

#include <common>

// #include <uv_pars_vertex>
#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || defined( USE_ALPHAMAP ) || defined( USE_EMISSIVEMAP ) || defined( USE_ROUGHNESSMAP ) || defined( USE_METALNESSMAP )
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif

// #include <uv2_pars_vertex>
#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
	attribute vec2 uv2;
	varying vec2 vUv2;
#endif

// #include <envmap_pars_vertex>
#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )
		varying vec3 vWorldPosition;
	#else

		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif

#include <bsdfs>

// #include <lights_pars_begin>
uniform vec3 ambientLightColor;

vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;

	#ifndef PHYSICALLY_CORRECT_LIGHTS
		irradiance *= PI;
	#endif

	return irradiance;
}

#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;

		int shadow;
		float shadowBias;
		float shadowRadius;
		vec2 shadowMapSize;
	};

	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];

	void getDirectionalDirectLightIrradiance( const in DirectionalLight directionalLight, const in GeometricContext geometry, out IncidentLight directLight ) {
		directLight.color = directionalLight.color;
		directLight.direction = directionalLight.direction;
		directLight.visible = true;
	}
#endif

#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;

		int shadow;
		float shadowBias;
		float shadowRadius;
		vec2 shadowMapSize;
		float shadowCameraNear;
		float shadowCameraFar;
	};

	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];

	// directLight is an out parameter as having it as a return value caused compiler errors on some devices
	void getPointDirectLightIrradiance( const in PointLight pointLight, const in GeometricContext geometry, out IncidentLight directLight ) {
		vec3 lVector = pointLight.position - geometry.position;
		directLight.direction = normalize( lVector );

		float lightDistance = length( lVector );

		directLight.color = pointLight.color;
		directLight.color *= punctualLightIntensityToIrradianceFactor( lightDistance, pointLight.distance, pointLight.decay );
		directLight.visible = ( directLight.color != vec3( 0.0 ) );
	}
#endif

#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;

		int shadow;
		float shadowBias;
		float shadowRadius;
		vec2 shadowMapSize;
	};

	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];

	// directLight is an out parameter as having it as a return value caused compiler errors on some devices
	void getSpotDirectLightIrradiance( const in SpotLight spotLight, const in GeometricContext geometry, out IncidentLight directLight  ) {
		vec3 lVector = spotLight.position - geometry.position;
		directLight.direction = normalize( lVector );

		float lightDistance = length( lVector );
		float angleCos = dot( directLight.direction, spotLight.direction );

		if ( angleCos > spotLight.coneCos ) {
			float spotEffect = smoothstep( spotLight.coneCos, spotLight.penumbraCos, angleCos );

			directLight.color = spotLight.color;
			directLight.color *= spotEffect * punctualLightIntensityToIrradianceFactor( lightDistance, spotLight.distance, spotLight.decay );
			directLight.visible = true;
		} else {
			directLight.color = vec3( 0.0 );
			directLight.visible = false;
		}
	}
#endif

#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};

	// Pre-computed values of LinearTransformedCosine approximation of BRDF
	// BRDF approximation Texture is 64x64
	uniform sampler2D ltc_1; // RGBA Float
	uniform sampler2D ltc_2; // RGBA Float

	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif

#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};

	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];

	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in GeometricContext geometry ) {
		float dotNL = dot( geometry.normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;

		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );

		#ifndef PHYSICALLY_CORRECT_LIGHTS
			irradiance *= PI;
		#endif

		return irradiance;
	}
#endif

// #include <color_pars_vertex>
#ifdef USE_COLOR
	varying vec3 vColor;
#endif

// #include <fog_pars_vertex>
#ifdef USE_FOG
	varying float fogDepth;
#endif

// #include <morphtarget_pars_vertex>
#ifdef USE_MORPHTARGETS
	#ifndef USE_MORPHNORMALS
		uniform float morphTargetInfluences[ 8 ];
	#else
		uniform float morphTargetInfluences[ 4 ];
	#endif
#endif

// #include <skinning_pars_vertex>
#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;

	#ifdef BONE_TEXTURE
		uniform sampler2D boneTexture;
		uniform int boneTextureSize;

		mat4 getBoneMatrix( const in float i ) {
			float j = i * 4.0;
			float x = mod( j, float( boneTextureSize ) );
			float y = floor( j / float( boneTextureSize ) );

			float dx = 1.0 / float( boneTextureSize );
			float dy = 1.0 / float( boneTextureSize );

			y = dy * ( y + 0.5 );

			vec4 v1 = texture2D( boneTexture, vec2( dx * ( x + 0.5 ), y ) );
			vec4 v2 = texture2D( boneTexture, vec2( dx * ( x + 1.5 ), y ) );
			vec4 v3 = texture2D( boneTexture, vec2( dx * ( x + 2.5 ), y ) );
			vec4 v4 = texture2D( boneTexture, vec2( dx * ( x + 3.5 ), y ) );

			mat4 bone = mat4( v1, v2, v3, v4 );

			return bone;
		}
	#else
		uniform mat4 boneMatrices[ MAX_BONES ];

		mat4 getBoneMatrix( const in float i ) {
			mat4 bone = boneMatrices[ int(i) ];
			return bone;
		}
	#endif
#endif

// #include <shadowmap_pars_vertex>
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHTS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHTS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHTS ];
	#endif

	#if NUM_SPOT_LIGHTS > 0
		uniform mat4 spotShadowMatrix[ NUM_SPOT_LIGHTS ];
		varying vec4 vSpotShadowCoord[ NUM_SPOT_LIGHTS ];
	#endif

	#if NUM_POINT_LIGHTS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHTS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHTS ];
	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0
		// TODO (abelnation): uniforms for area light shadows
	#endif
	*/
#endif

// #include <logdepthbuf_pars_vertex>
#ifdef USE_LOGDEPTHBUF
	#ifdef USE_LOGDEPTHBUF_EXT
		varying float vFragDepth;
	#else
		uniform float logDepthBufFC;
	#endif
#endif

// #include <clipping_planes_pars_vertex>
#if NUM_CLIPPING_PLANES > 0 && ! defined( PHYSICAL ) && ! defined( PHONG ) && ! defined( MATCAP )
	varying vec3 vViewPosition;
#endif

void main() {

	// #include <uv_vertex>
	#if defined( USE_MAP ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( USE_SPECULARMAP ) || defined( USE_ALPHAMAP ) || defined( USE_EMISSIVEMAP ) || defined( USE_ROUGHNESSMAP ) || defined( USE_METALNESSMAP )
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif

	// #include <uv2_vertex>
	#if defined( USE_LIGHTMAP ) || defined( USE_AOMAP )
		vUv2 = uv2;
	#endif

	// #include <color_vertex>
	#ifdef USE_COLOR
		vColor.xyz = color.xyz;
	#endif

	// #include <beginnormal_vertex>
	vec3 objectNormal = vec3( normal );
	#ifdef USE_TANGENT
		vec3 objectTangent = vec3( tangent.xyz );
	#endif

	// #include <morphnormal_vertex>
	#ifdef USE_MORPHNORMALS
		objectNormal += ( morphNormal0 - normal ) * morphTargetInfluences[ 0 ];
		objectNormal += ( morphNormal1 - normal ) * morphTargetInfluences[ 1 ];
		objectNormal += ( morphNormal2 - normal ) * morphTargetInfluences[ 2 ];
		objectNormal += ( morphNormal3 - normal ) * morphTargetInfluences[ 3 ];
	#endif

	// #include <skinbase_vertex>
	#ifdef USE_SKINNING
		mat4 boneMatX = getBoneMatrix( skinIndex.x );
		mat4 boneMatY = getBoneMatrix( skinIndex.y );
		mat4 boneMatZ = getBoneMatrix( skinIndex.z );
		mat4 boneMatW = getBoneMatrix( skinIndex.w );
	#endif

	// #include <skinnormal_vertex>
	#ifdef USE_SKINNING
		mat4 skinMatrix = mat4( 0.0 );
		skinMatrix += skinWeight.x * boneMatX;
		skinMatrix += skinWeight.y * boneMatY;
		skinMatrix += skinWeight.z * boneMatZ;
		skinMatrix += skinWeight.w * boneMatW;
		skinMatrix  = bindMatrixInverse * skinMatrix * bindMatrix;

		objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;

		#ifdef USE_TANGENT
			objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
		#endif
	#endif

	// #include <defaultnormal_vertex>
	vec3 transformedNormal = normalMatrix * objectNormal;
	#ifdef FLIP_SIDED
		transformedNormal = - transformedNormal;
	#endif

	#ifdef USE_TANGENT
		vec3 transformedTangent = normalMatrix * objectTangent;
		#ifdef FLIP_SIDED
			transformedTangent = - transformedTangent;
		#endif
	#endif

	// #include <begin_vertex>
	vec3 transformed = vec3( position );

	// #include <morphtarget_vertex>
	#ifdef USE_MORPHTARGETS
		transformed += ( morphTarget0 - position ) * morphTargetInfluences[ 0 ];
		transformed += ( morphTarget1 - position ) * morphTargetInfluences[ 1 ];
		transformed += ( morphTarget2 - position ) * morphTargetInfluences[ 2 ];
		transformed += ( morphTarget3 - position ) * morphTargetInfluences[ 3 ];

		#ifndef USE_MORPHNORMALS
			transformed += ( morphTarget4 - position ) * morphTargetInfluences[ 4 ];
			transformed += ( morphTarget5 - position ) * morphTargetInfluences[ 5 ];
			transformed += ( morphTarget6 - position ) * morphTargetInfluences[ 6 ];
			transformed += ( morphTarget7 - position ) * morphTargetInfluences[ 7 ];
		#endif
	#endif

	// #include <skinning_vertex>
	#ifdef USE_SKINNING
		vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );

		vec4 skinned = vec4( 0.0 );
		skinned += boneMatX * skinVertex * skinWeight.x;
		skinned += boneMatY * skinVertex * skinWeight.y;
		skinned += boneMatZ * skinVertex * skinWeight.z;
		skinned += boneMatW * skinVertex * skinWeight.w;

		transformed = ( bindMatrixInverse * skinned ).xyz;
	#endif

	// #include <project_vertex>
	vec4 mvPosition = modelViewMatrix * vec4( transformed, 1.0 );
	gl_Position = projectionMatrix * mvPosition;

	// #include <logdepthbuf_vertex>
	#ifdef USE_LOGDEPTHBUF
		#ifdef USE_LOGDEPTHBUF_EXT
			vFragDepth = 1.0 + gl_Position.w;
		#else
			gl_Position.z = log2( max( EPSILON, gl_Position.w + 1.0 ) ) * logDepthBufFC - 1.0;
			gl_Position.z *= gl_Position.w;
		#endif
	#endif

	// #include <clipping_planes_vertex>
	#if NUM_CLIPPING_PLANES > 0 && ! defined( PHYSICAL ) && ! defined( PHONG ) && ! defined( MATCAP )
		vViewPosition = - mvPosition.xyz;
	#endif

	// #include <worldpos_vertex>
	#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
		vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
	#endif

	// #include <envmap_vertex>
	#ifdef USE_ENVMAP
		#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )
			vWorldPosition = worldPosition.xyz;
		#else
			vec3 cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
			vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		
			#ifdef ENVMAP_MODE_REFLECTION
				vReflect = reflect( cameraToVertex, worldNormal );
			#else
				vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
			#endif
		#endif
	#endif

	// #include <lights_lambert_vertex>
	vec3 diffuse = vec3( 1.0 );

	GeometricContext geometry;
	geometry.position = mvPosition.xyz;
	geometry.normal = normalize( transformedNormal );
	geometry.viewDir = normalize( -mvPosition.xyz );

	GeometricContext backGeometry;
	backGeometry.position = geometry.position;
	backGeometry.normal = -geometry.normal;
	backGeometry.viewDir = geometry.viewDir;

	vLightFront = vec3( 0.0 );
	vIndirectFront = vec3( 0.0 );

	#ifdef DOUBLE_SIDED
		vLightBack = vec3( 0.0 );
		vIndirectBack = vec3( 0.0 );
	#endif

	IncidentLight directLight;
	float dotNL;
	vec3 directLightColor_Diffuse;

	#if NUM_POINT_LIGHTS > 0
		#pragma unroll_loop
		for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
			getPointDirectLightIrradiance( pointLights[ i ], geometry, directLight );

			dotNL = dot( geometry.normal, directLight.direction );
			directLightColor_Diffuse = PI * directLight.color;

			vLightFront += saturate( dotNL ) * directLightColor_Diffuse;

			#ifdef DOUBLE_SIDED
				vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
			#endif
		}
	#endif

	#if NUM_SPOT_LIGHTS > 0
		#pragma unroll_loop
		for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
			getSpotDirectLightIrradiance( spotLights[ i ], geometry, directLight );

			dotNL = dot( geometry.normal, directLight.direction );
			directLightColor_Diffuse = PI * directLight.color;

			vLightFront += saturate( dotNL ) * directLightColor_Diffuse;

			#ifdef DOUBLE_SIDED
				vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
			#endif
		}
	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0
		for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
			// TODO (abelnation): implement
		}
	#endif
	*/

	#if NUM_DIR_LIGHTS > 0
		#pragma unroll_loop
		for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
			getDirectionalDirectLightIrradiance( directionalLights[ i ], geometry, directLight );

			dotNL = dot( geometry.normal, directLight.direction );
			directLightColor_Diffuse = PI * directLight.color;

			vLightFront += saturate( dotNL ) * directLightColor_Diffuse;

			#ifdef DOUBLE_SIDED
				vLightBack += saturate( -dotNL ) * directLightColor_Diffuse;
			#endif
		}
	#endif

	#if NUM_HEMI_LIGHTS > 0
		#pragma unroll_loop
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			vIndirectFront += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );

			#ifdef DOUBLE_SIDED
				vIndirectBack += getHemisphereLightIrradiance( hemisphereLights[ i ], backGeometry );
			#endif
		}
	#endif

	// #include <shadowmap_vertex>
	#ifdef USE_SHADOWMAP
		#if NUM_DIR_LIGHTS > 0
			#pragma unroll_loop
			for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
				vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * worldPosition;
			}
		#endif

		#if NUM_SPOT_LIGHTS > 0
			#pragma unroll_loop
			for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
				vSpotShadowCoord[ i ] = spotShadowMatrix[ i ] * worldPosition;
			}
		#endif

		#if NUM_POINT_LIGHTS > 0
			#pragma unroll_loop
			for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
				vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * worldPosition;
			}
		#endif

		/*
		#if NUM_RECT_AREA_LIGHTS > 0
			// TODO (abelnation): update vAreaShadowCoord with area light info
		#endif
		*/
	#endif

	// #include <fog_vertex>
	#ifdef USE_FOG
		fogDepth = -mvPosition.z;
	#endif
}