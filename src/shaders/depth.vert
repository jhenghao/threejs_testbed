precision highp float;
precision highp int;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;

attribute vec3 position;
attribute vec3 normal;

void main() {

	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}