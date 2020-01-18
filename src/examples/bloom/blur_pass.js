"use strict";

import { BasicUtilities } from '../../troll_renderer/basic_utilities.js';
import { MaterialUtilities } from '../../troll_renderer/material_utilities.js';

function buildKernel ( sigma, toxelOffset ) {

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
	{
		ret[i] = new THREE.Vector4( toxelOffset.x * (i - halfWidth), toxelOffset.y * (i - halfWidth), 0, values[ i ] );
	}

	return ret;

}

function BlurPass ( width, height, strength, sigma ) {

	strength = ( strength !== undefined ) ? strength : 1;
	sigma = ( sigma !== undefined ) ? sigma : 4.0;

	// render targets
	let resx = Math.round( width / 2 );
	let resy = Math.round( height / 2 );

	this.renderTargetX = BasicUtilities.createRenderTarget(resx, resy, "BlurPass.x");
	this.renderTargetY = BasicUtilities.createRenderTarget(resx, resy, "BlurPass.y");

	// copy material
	this.materialCopy = MaterialUtilities.createCopyMaterial({
		opacity: strength,
	});

	// convolution material
	BlurPass.imageIncrementX = buildKernel( sigma, new THREE.Vector2(1.0 / resx, 0.0) );
	BlurPass.imageIncrementY = buildKernel( sigma, new THREE.Vector2(0.0, 1.0 / resy) );
	let kernelSize = BlurPass.imageIncrementX.length;

	let convolutionVertCode = BasicUtilities.loadText('/src/shaders/convolution.vert');
    let convolutionFragCode = BasicUtilities.loadText('/src/shaders/convolution.frag');

	this.materialConvolution = new THREE.RawShaderMaterial( {

		uniforms: {
			"tDiffuse":        { value: null },
			"uImageIncrement": { value: null },
		},
		vertexShader: convolutionVertCode,
		fragmentShader: convolutionFragCode,
		defines: {
			"KERNEL_SIZE_FLOAT": kernelSize.toFixed( 1 ),
			"KERNEL_SIZE_INT": kernelSize.toFixed( 0 )
		}

	} );

};

BlurPass.prototype = Object.assign( {

	constructor: BlurPass,

	render: function ( renderer, readBuffer ) {

		// Render quad with blured scene into texture (convolution pass 1)

		this.materialConvolution.uniforms[ "tDiffuse" ].value = readBuffer.texture;
		this.materialConvolution.uniforms[ "uImageIncrement" ].value = BlurPass.imageIncrementX;

		renderer.setRenderTarget( this.renderTargetX );
		renderer.clear();
		renderer.renderFullScreenQuad(this.materialConvolution);

		// Render quad with blured scene into texture (convolution pass 2)

		this.materialConvolution.uniforms[ "tDiffuse" ].value = this.renderTargetX.texture;
		this.materialConvolution.uniforms[ "uImageIncrement" ].value = BlurPass.imageIncrementY;

		renderer.setRenderTarget( this.renderTargetY );
		renderer.clear();
		renderer.renderFullScreenQuad(this.materialConvolution);
	},

	setSize: function ( width, height ) {

		let resx = Math.round( width / 2 );
		let resy = Math.round( height / 2 );

		this.renderTargetX.setSize( resx, resy );
		this.renderTargetY.setSize( resx, resy );

	}

} );

export { BlurPass };
