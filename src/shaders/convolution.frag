uniform sampler2D tDiffuse;
uniform vec4 uImageIncrement[ KERNEL_SIZE_INT ];

varying vec2 vUv;

void main() {

	vec2 imageCoord = vUv;

	vec4 sum = vec4( 0.0, 0.0, 0.0, 0.0 );

	for( int i = 0; i < KERNEL_SIZE_INT; i ++ ) {

		sum += texture2D( tDiffuse, imageCoord + uImageIncrement[ i ].xy ) * uImageIncrement[ i ].w;

	}

	gl_FragColor = sum;
}