precision highp float;

varying vec2 vecUv;
varying vec3 vecPos;
varying vec3 vecNormal;

uniform float lightIntensity;
uniform sampler2D textureSampler;

struct PointLight {
    vec3 color;
    vec3 position; // light position, in camera coordinates
    float distance; // used for attenuation purposes. Since
    // we're writing our own shader, it can
    // really be anything we want (as long as
    // we assign it to our light in its
    // "distance" field
};

uniform PointLight pointLights[NUM_POINT_LIGHTS];

void main(void) {
    // Pretty basic lambertian lighting...
    vec4 addedLights = vec4(0.0, 0.0, 0.0, 1.0);

    for (int l = 0; l < NUM_POINT_LIGHTS; l++)
    {
        vec3 lightDirection = normalize(vecPos - pointLights[l].position);
        addedLights.rgb += clamp(dot(-lightDirection, vecNormal), 0.0, 1.0)
            * pointLights[l].color * lightIntensity;
    }

    gl_FragColor = texture2D(textureSampler, vecUv) * addedLights;
}

