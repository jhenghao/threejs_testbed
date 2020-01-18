"use strict";

import { BasicUtilities } from '../../troll_renderer/basic_utilities.js';

import { BlurPass } from './blur_pass.js'

function BloomPass(width, height, threshold) {

	this.threshold = threshold;

	// render targets
	let resx = Math.round(width / 2);
	let resy = Math.round(height / 2);

	this.renderTargetBright = BasicUtilities.createRenderTarget(resx, resy, "BloomPass.bright");

	// luminosity high pass material
	let highPassVertCode = BasicUtilities.loadText('/src/shaders/luminosity_high_pass.vert');
	let highPassFragCode = BasicUtilities.loadText('/src/shaders/luminosity_high_pass.frag');

	this.materialHighPassFilter = new THREE.RawShaderMaterial({
		uniforms: {
			"tDiffuse": { value: null },
			"luminosityThreshold": { value: threshold },
			"smoothWidth": { value: 0.01 },
			"defaultColor": { value: new THREE.Color(0, 0, 0) },
			"defaultOpacity": { value: 0.0 }
		},
		vertexShader: highPassVertCode,
		fragmentShader: highPassFragCode,
	});

	// blur material
	this.blurPass = new BlurPass(width, height, 1.0, 10.0);

};

BloomPass.prototype = Object.assign({

	constructor: BloomPass,

	dispose: function () {

		this.renderTargetBright.dispose();

	},

	setSize: function (width, height) {

		let resx = Math.round(width / 2);
		let resy = Math.round(height / 2);

		this.renderTargetBright.setSize(resx, resy);
		this.blurPass.setSize(width, height);

	},

	render: function (renderer, readBuffer) {

		var oldAutoClear = renderer.autoClear;
		renderer.autoClear = false;

		// 1. Extract Bright Areas
		this.materialHighPassFilter.uniforms["tDiffuse"].value = readBuffer.texture;
		this.materialHighPassFilter.uniforms["luminosityThreshold"].value = this.threshold;

		renderer.setRenderTarget(this.renderTargetBright);
		renderer.clear();
		renderer.renderFullScreenQuad(this.materialHighPassFilter);

		// 2. Blur bright image
		this.blurPass.render(renderer, this.renderTargetBright);

		// Restore renderer settings
		renderer.autoClear = oldAutoClear;

	},

});

export { BloomPass };
