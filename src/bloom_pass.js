var BloomPass = function ( resolution, threshold ) {

	THREE.Pass.call( this );

	this.threshold = threshold;
	this.resolution = ( resolution !== undefined ) ? new THREE.Vector2( resolution.x, resolution.y ) : new THREE.Vector2( 256, 256 );

	// create color only once here, reuse it later inside the render function
	this.clearColor = new THREE.Color( 0, 0, 0 );

	// render targets
	var pars = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
	var resx = Math.round( this.resolution.x / 2 );
	var resy = Math.round( this.resolution.y / 2 );

	this.renderTargetBright = new THREE.WebGLRenderTarget( resx, resy, pars );
	this.renderTargetBright.texture.name = "BloomPass.bright";
	this.renderTargetBright.texture.generateMipmaps = false;

	// luminosity high pass material

	if ( THREE.LuminosityHighPassShader === undefined ) {

		console.error( "THREE.BloomPass relies on THREE.LuminosityHighPassShader" );

	}

	var highPassShader = THREE.LuminosityHighPassShader;
	this.highPassUniforms = THREE.UniformsUtils.clone( highPassShader.uniforms );

	this.highPassUniforms[ "luminosityThreshold" ].value = threshold;
	this.highPassUniforms[ "smoothWidth" ].value = 0.01;

	this.materialHighPassFilter = new THREE.ShaderMaterial( {
		uniforms: this.highPassUniforms,
		vertexShader: highPassShader.vertexShader,
		fragmentShader: highPassShader.fragmentShader,
		defines: {}
	} );

	// blur material
	if ( BlurPass === undefined ) {

		console.error( "THREE.BloomPass relies on BlurPass" );
	}

	this.blurPass = new BlurPass(1.0, 10.0);

	// copy material
	if ( THREE.CopyShader === undefined ) {

		console.error( "THREE.BloomPass relies on THREE.CopyShader" );

	}

	var copyShader = THREE.CopyShader;

	this.opacity = 0.7;
	this.copyUniforms = THREE.UniformsUtils.clone( copyShader.uniforms );
	this.copyUniforms[ "opacity" ].value = this.opacity;

	this.materialCopy = new THREE.ShaderMaterial( {
		uniforms: this.copyUniforms,
		vertexShader: copyShader.vertexShader,
		fragmentShader: copyShader.fragmentShader,
		blending: THREE.AdditiveBlending,
		depthTest: false,
		depthWrite: false,
		transparent: true
	} );

	this.enabled = true;
	this.needsSwap = false;

	this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;

	this.enableTexture = true;

	this.fsQuad = new THREE.Pass.FullScreenQuad( null );

};

BloomPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: BloomPass,

	dispose: function () {

		this.renderTargetBright.dispose();

	},

	setSize: function ( width, height ) {

		var resx = Math.round( width / 2 );
		var resy = Math.round( height / 2 );

		this.renderTargetBright.setSize( resx, resy );

	},

	render: function ( renderer, writeBuffer, readBuffer, deltaTime, maskActive ) {

		this.oldClearColor.copy( renderer.getClearColor() );
		this.oldClearAlpha = renderer.getClearAlpha();
		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		renderer.setClearColor( this.clearColor, 0 );

		if ( maskActive ) renderer.context.disable( renderer.context.STENCIL_TEST );

		// Render input to screen
/*
		if ( this.renderToScreen && this.enableTexture ) {

			this.fsQuad.material = this.materialCopy;
			this.copyUniforms[ "opacity" ].value = 1.0;
			this.copyUniforms[ "tDiffuse" ].value = readBuffer.texture;

			renderer.setRenderTarget( null );
			this.fsQuad.render( renderer );
		}
*/
		// 1. Extract Bright Areas

		this.highPassUniforms[ "tDiffuse" ].value = readBuffer.texture;
		this.highPassUniforms[ "luminosityThreshold" ].value = this.threshold;
		this.fsQuad.material = this.materialHighPassFilter;

		renderer.setRenderTarget( this.renderTargetBright );
		renderer.clear();
		this.fsQuad.render( renderer );

		// 2. Blur bright image
		this.blurPass.render(renderer, writeBuffer, this.renderTargetBright, deltaTime, maskActive);

		// Blend it additively over the input texture

		this.fsQuad.material = this.materialCopy;
		this.copyUniforms[ "opacity" ].value = this.opacity;
		this.copyUniforms[ "tDiffuse" ].value = this.blurPass.renderTargetY.texture;

		if ( maskActive ) renderer.context.enable( renderer.context.STENCIL_TEST );

		renderer.setRenderTarget( this.renderToScreen ? null : readBuffer );
		renderer.clear();
		this.fsQuad.render( renderer );

		// Restore renderer settings

		renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );
		renderer.autoClear = oldAutoClear;

	},

} );
