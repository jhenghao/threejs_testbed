"use strict";

var ConvolutionShader = {

	defines: {

		"KERNEL_SIZE_FLOAT": "25.0",
		"KERNEL_SIZE_INT": "25"

	},

	uniforms: {

		"tDiffuse":        { value: null },
		"uImageIncrement": { value: null },

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		"uniform vec4 uImageIncrement[ KERNEL_SIZE_INT ];",

		"varying vec2 vUv;",

		"void main() {",

			"vec2 imageCoord = vUv;",
			"vec4 sum = vec4( 0.0, 0.0, 0.0, 0.0 );",

			"for( int i = 0; i < KERNEL_SIZE_INT; i ++ ) {",

				"sum += texture2D( tDiffuse, imageCoord + uImageIncrement[ i ].xy ) * uImageIncrement[ i ].w;",

			"}",

			"gl_FragColor = sum;",

		"}"


	].join( "\n" ),

	buildKernel: function ( sigma, toxelOffset ) {

		// We lop off the sqrt(2 * pi) * sigma term, since we're going to normalize anyway.

		function gauss( x, sigma ) {

			return Math.exp( - ( x * x ) / ( 2.0 * sigma * sigma ) );

		}

		let cMaxSigmaSize = 10;
		if ( sigma > cMaxSigmaSize )
			sigma = cMaxSigmaSize;

		let kernelSize = 2 * Math.ceil( sigma * 3.0 ) + 1;
		let halfWidth = ( kernelSize - 1 ) * 0.5;

		let values = new Array( kernelSize );
		let sum = 0.0;
		for ( let i = 0; i < kernelSize; ++ i ) {

			values[ i ] = gauss( i - halfWidth, sigma );
			sum += values[ i ];

		}

		// normalize the kernel

		for ( let i = 0; i < kernelSize; ++ i ) values[ i ] /= sum;

		let ret = new Array( kernelSize );
		for ( let i = 0; i < kernelSize; ++ i )
			ret[i] = new THREE.Vector4( toxelOffset.x * (i - halfWidth), toxelOffset.y * (i - halfWidth), 0, values[ i ] );

		return ret;

	}

};
