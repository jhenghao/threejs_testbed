uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;

varying vec3 vLightFront;
varying vec3 vIndirectFront;

#ifdef DOUBLE_SIDED
	varying vec3 vLightBack;
	varying vec3 vIndirectBack;
#endif


#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <uv2_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <fog_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	// #include <clipping_planes_fragment>
	#if NUM_CLIPPING_PLANES > 0
		vec4 plane;

		#pragma unroll_loop
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vViewPosition, plane.xyz ) > plane.w ) discard;
		}

		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;

			#pragma unroll_loop
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vViewPosition, plane.xyz ) > plane.w ) && clipped;
			}

			if ( clipped ) discard;
		#endif
	#endif

	// {
		vec4 diffuseColor = vec4( diffuse, opacity );
		ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
		vec3 totalEmissiveRadiance = emissive;
	// }

	// #include <logdepthbuf_fragment>
	#if defined( USE_LOGDEPTHBUF ) && defined( USE_LOGDEPTHBUF_EXT )
		gl_FragDepthEXT = log2( vFragDepth ) * logDepthBufFC * 0.5;
	#endif

	// #include <map_fragment>
	#ifdef USE_MAP
		vec4 texelColor = texture2D( map, vUv );

		texelColor = mapTexelToLinear( texelColor );
		diffuseColor *= texelColor;
	#endif

	// #include <color_fragment>
	#ifdef USE_COLOR
		diffuseColor.rgb *= vColor;
	#endif

	// #include <alphamap_fragment>
	#ifdef USE_ALPHAMAP
		diffuseColor.a *= texture2D( alphaMap, vUv ).g;
	#endif

	// #include <alphatest_fragment>
	#ifdef ALPHATEST
		if ( diffuseColor.a < ALPHATEST ) discard;
	#endif

	// #include <specularmap_fragment>
	float specularStrength;

	#ifdef USE_SPECULARMAP
		vec4 texelSpecular = texture2D( specularMap, vUv );
		specularStrength = texelSpecular.r;
	#else
		specularStrength = 1.0;
	#endif

	// #include <emissivemap_fragment>
	#ifdef USE_EMISSIVEMAP
		vec4 emissiveColor = texture2D( emissiveMap, vUv );
		emissiveColor.rgb = emissiveMapTexelToLinear( emissiveColor ).rgb;
		totalEmissiveRadiance *= emissiveColor.rgb;
	#endif

	{
		// accumulation
		reflectedLight.indirectDiffuse = getAmbientLightIrradiance( ambientLightColor );

		#ifdef DOUBLE_SIDED
			reflectedLight.indirectDiffuse += ( gl_FrontFacing ) ? vIndirectFront : vIndirectBack;
		#else
			reflectedLight.indirectDiffuse += vIndirectFront;
		#endif
	}

	// #include <lightmap_fragment>
	#ifdef USE_LIGHTMAP
		reflectedLight.indirectDiffuse += PI * texture2D( lightMap, vUv2 ).xyz * lightMapIntensity; // factor of PI should not be present; included here to prevent breakage
	#endif

	{
		reflectedLight.indirectDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb );

		#ifdef DOUBLE_SIDED
			reflectedLight.directDiffuse = ( gl_FrontFacing ) ? vLightFront : vLightBack;
		#else
			reflectedLight.directDiffuse = vLightFront;
		#endif

		reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();
	}

	// modulation
	#include <aomap_fragment>

	// {
		vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	// }

	// #include <envmap_fragment>
	#ifdef USE_ENVMAP
		#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG )
			vec3 cameraToVertex = normalize( vWorldPosition - cameraPosition );

			// Transforming Normal Vectors with the Inverse Transformation
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );

			#ifdef ENVMAP_MODE_REFLECTION
				vec3 reflectVec = reflect( cameraToVertex, worldNormal );
			#else
				vec3 reflectVec = refract( cameraToVertex, worldNormal, refractionRatio );
			#endif
		#else
			vec3 reflectVec = vReflect;
		#endif

		#ifdef ENVMAP_TYPE_CUBE
			vec4 envColor = textureCube( envMap, vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
		#elif defined( ENVMAP_TYPE_EQUIREC )
			vec2 sampleUV;

			reflectVec = normalize( reflectVec );
			sampleUV.y = asin( clamp( reflectVec.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
			sampleUV.x = atan( reflectVec.z, reflectVec.x ) * RECIPROCAL_PI2 + 0.5;

			vec4 envColor = texture2D( envMap, sampleUV );
		#elif defined( ENVMAP_TYPE_SPHERE )
			reflectVec = normalize( reflectVec );

			vec3 reflectView = normalize( ( viewMatrix * vec4( reflectVec, 0.0 ) ).xyz + vec3( 0.0, 0.0, 1.0 ) );
			vec4 envColor = texture2D( envMap, reflectView.xy * 0.5 + 0.5 );
		#else
			vec4 envColor = vec4( 0.0 );
		#endif

		envColor = envMapTexelToLinear( envColor );

		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif

	{
		gl_FragColor = vec4( outgoingLight, diffuseColor.a );
	}

	#include <tonemapping_fragment>
	#include <encodings_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}