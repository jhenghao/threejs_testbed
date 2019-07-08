#include <packing>

uniform sampler2D baseTexture;
uniform sampler2D blurTexture;
uniform sampler2D zBuffer;

uniform float zNear;
uniform float zFar;
uniform vec4 vDepthOfField;

varying vec2 vUv;

vec4 getTexture( sampler2D texelToLinearTexture ) {
	return mapTexelToLinear( texture2D( texelToLinearTexture , vUv ) );
}

float linearizeDepth(vec2 uv) {
	
	float z_b = texture2D(zBuffer, uv).x;
    float z_n = 2.0 * z_b - 1.0;
    float z_e = 2.0 * zNear * zFar / (zFar + zNear - z_n * (zFar - zNear));

	return z_e;
}

float readDepth( sampler2D depthSampler, vec2 coord ) {

	float fragCoordZ = texture2D( depthSampler, coord ).x;
	float viewZ = perspectiveDepthToViewZ( fragCoordZ, zNear, zFar );
	//return viewZToOrthographicDepth( viewZ, zNear, zFar );
	return viewZ;
}

void main() {

	//float fLinearZ = linearizeDepth(vUv);
	float fLinearZ = readDepth( zBuffer, vUv );

	float fNearBlur = clamp((fLinearZ - vDepthOfField.x) / vDepthOfField.y, 0.0, 1.0);
	float fFarBlur = clamp((vDepthOfField.z - fLinearZ) / vDepthOfField.w, 0.0, 1.0);

	float fBlur = max(fNearBlur, fFarBlur);

	vec4 baseTextureColor = texture2D(baseTexture, vUv);
	vec4 blurTextureColor = texture2D(blurTexture, vUv);

	gl_FragColor = mix(baseTextureColor, blurTextureColor, fBlur);
}