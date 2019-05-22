"use strict";

var BlurPass = function ( strength, sigma, resolution ) {

	THREE.Pass.call( this );

	strength = ( strength !== undefined ) ? strength : 1;
	sigma = ( sigma !== undefined ) ? sigma : 4.0;
	resolution = ( resolution !== undefined ) ? resolution : new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);

	// render targets

	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };

	this.renderTargetX = new THREE.WebGLRenderTarget( resolution.x, resolution.y, pars );
	this.renderTargetX.texture.name = "BlurPass.x";
	this.renderTargetY = new THREE.WebGLRenderTarget( resolution.x, resolution.y, pars );
	this.renderTargetY.texture.name = "BlurPass.y";

	// copy material

	if ( THREE.CopyShader === undefined )
		console.error( "BlurPass relies on THREE.CopyShader" );

	var copyShader = THREE.CopyShader;

	this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );

	this.copyUniforms[ "opacity" ].value = strength;

	this.materialCopy = new THREE.ShaderMaterial( {

		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: THREE.AdditiveBlending,
		transparent: true

	} );

	// convolution material

	if ( ConvolutionShader === undefined )
		console.error( "BlurPass relies on ConvolutionShader" );

	BlurPass.imageIncrementX = ConvolutionShader.buildKernel( sigma, new THREE.Vector2(1.0 / resolution.x, 0.0) );
	BlurPass.imageIncrementY = ConvolutionShader.buildKernel( sigma, new THREE.Vector2(0.0, 1.0 / resolution.y) );
	let kernelSize = BlurPass.imageIncrementX.length;

	var convolutionShader = ConvolutionShader;

	this.convolutionUniforms = THREE.UniformsUtils.clone( convolutionShader.uniforms );
	this.convolutionUniforms[ "uImageIncrement" ].value = BlurPass.imageIncrementX;

	this.materialConvolution = new THREE.ShaderMaterial( {

		uniforms: this.convolutionUniforms,
		vertexShader: convolutionShader.vertexShader,
		fragmentShader: convolutionShader.fragmentShader,
		defines: {
			"KERNEL_SIZE_FLOAT": kernelSize.toFixed( 1 ),
			"KERNEL_SIZE_INT": kernelSize.toFixed( 0 )
		}

	} );

	this.needsSwap = false;

	this.fsQuad = new THREE.Pass.FullScreenQuad( null );

};

BlurPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: BlurPass,

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

		// Render quad with blured scene into texture (convolution pass 1)

		this.fsQuad.material = this.materialConvolution;

		this.convolutionUniforms[ "tDiffuse" ].value = readBuffer.texture;
		this.convolutionUniforms[ "uImageIncrement" ].value = BlurPass.imageIncrementX;

		renderer.setRenderTarget( this.renderTargetX );
		renderer.clear();
		this.fsQuad.render( renderer );


		// Render quad with blured scene into texture (convolution pass 2)

		this.convolutionUniforms[ "tDiffuse" ].value = this.renderTargetX.texture;
		this.convolutionUniforms[ "uImageIncrement" ].value = BlurPass.imageIncrementY;

		renderer.setRenderTarget( this.renderTargetY );
		renderer.clear();
		this.fsQuad.render( renderer );

		// Render original scene with superimposed blur to texture

		this.fsQuad.material = this.materialCopy;

		this.copyUniforms[ "tDiffuse" ].value = this.renderTargetY.texture;

		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

		renderer.setRenderTarget( readBuffer );
		if ( this.clear ) renderer.clear();
		this.fsQuad.render( renderer );

	},

	setSize: function ( width, height ) {

		/*
		var resx = Math.round( width / 2 );
		var resy = Math.round( height / 2 );

		this.renderTargetBright.setSize( resx, resy );

		for ( var i = 0; i < this.nMips; i ++ ) {

			this.renderTargetsHorizontal[ i ].setSize( resx, resy );
			this.renderTargetsVertical[ i ].setSize( resx, resy );

			this.separableBlurMaterials[ i ].uniforms[ "texSize" ].value = new THREE.Vector2( resx, resy );

			resx = Math.round( resx / 2 );
			resy = Math.round( resy / 2 );

		}
*/
	}

} );

BlurPass.blurX = new THREE.Vector2( 0.001953125, 0.0 );
BlurPass.blurY = new THREE.Vector2( 0.0, 0.001953125 );
