varying vec2 vecUv;
varying vec3 vecPos;
varying vec3 vecNormal;
varying vec4 vecColor;

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

void main()
{
    vec3 normalEyeSpace = (modelViewMatrix * vec4(normal, 0.0)).xyz;
    vec3 positionEyeSpace = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vec3 diffuse = vec3(0.0, 0.0, 0.0);

    for (int l = 0; l < NUM_POINT_LIGHTS; l++)
    {
        vec3 vDiff = pointLights[l].position - positionEyeSpace;
        float distance = length(vDiff);
        vec3 vDir = vDiff / distance;

        float lightAttenuation = dot(
            vec3(1.0, distance, distance * distance), vec3(1.0, 0.2, 0));

        diffuse += pointLights[l].color * 
            clamp(dot(vDir, normalEyeSpace), 0.0 ,1.0) / lightAttenuation;
    }

    vecColor = vec4(clamp(diffuse, 0.0, 1.0), 1.0);

    vecUv = uv;
    vecPos = (modelViewMatrix * vec4(position, 1.0)).xyz;

    // That's NOT exacly how you should transform your
    // normals but this will work fine, since my model
    // matrix is pretty basic
    vecNormal = (modelViewMatrix * vec4(normal, 0.0)).xyz;

    gl_Position = projectionMatrix * vec4(vecPos, 1.0);
}
