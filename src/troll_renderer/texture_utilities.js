'use strict';

import { BasicUtilities } from './basic_utilities.js';

import { LinearFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, NearestFilter, NearestMipmapLinearFilter, NearestMipmapNearestFilter, RGBFormat, RGBAFormat, DepthFormat, DepthStencilFormat, UnsignedShortType, UnsignedIntType, UnsignedInt248Type, FloatType, HalfFloatType, MirroredRepeatWrapping, ClampToEdgeWrapping, RepeatWrapping } from '../../three.js/src/constants.js';
import { _Math } from '../../three.js/src/math/Math.js';

function TextureUtilities(_gl, extensions, properties, capabilities) {
	let _isWebGL2 = capabilities.isWebGL2;
	let _maxTextures = capabilities.maxTextures;
	let _maxTextureSize = capabilities.maxTextureSize;

	let _wrappingToGL = {
		[RepeatWrapping]: _gl.REPEAT,
		[ClampToEdgeWrapping]: _gl.CLAMP_TO_EDGE,
		[MirroredRepeatWrapping]: _gl.MIRRORED_REPEAT
	};

	let _filterToGL = {
		[NearestFilter]: _gl.NEAREST,
		[NearestMipmapNearestFilter]: _gl.NEAREST_MIPMAP_NEAREST,
		[NearestMipmapLinearFilter]: _gl.NEAREST_MIPMAP_LINEAR,

		[LinearFilter]: _gl.LINEAR,
		[LinearMipmapNearestFilter]: _gl.LINEAR_MIPMAP_NEAREST,
		[LinearMipmapLinearFilter]: _gl.LINEAR_MIPMAP_LINEAR
	};

	let _currentTextureSlot = null;
	let _currentBoundTextures = {};

	let _emptyTextures = {};
	_emptyTextures[_gl.TEXTURE_2D] = createTexture(_gl.TEXTURE_2D, _gl.TEXTURE_2D, 1);
	_emptyTextures[_gl.TEXTURE_CUBE_MAP] = createTexture(_gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_CUBE_MAP_POSITIVE_X, 6);

	let _textureUnits = 0;

	function resetTextureUnits() {

		_textureUnits = 0;

	}

	function allocateTextureUnit() {

		var textureUnit = _textureUnits;

		if (textureUnit >= _maxTextures) {

			console.warn('TextureUtilities: Trying to use ' + textureUnit + ' texture units while this GPU supports only ' + _maxTextures);

		}

		_textureUnits += 1;

		return textureUnit;

	}

	function deallocateTexture(texture) {

		var textureProperties = properties.get(texture);

		if (textureProperties.__webglInit === undefined) return;

		_gl.deleteTexture(textureProperties.__webglTexture);

		properties.remove(texture);

	}

	function deallocateRenderTarget(renderTarget) {

		var renderTargetProperties = properties.get(renderTarget);
		var textureProperties = properties.get(renderTarget.texture);

		if (!renderTarget) return;

		if (textureProperties.__webglTexture !== undefined) {

			_gl.deleteTexture(textureProperties.__webglTexture);

		}

		if (renderTarget.depthTexture) {

			renderTarget.depthTexture.dispose();

		}

		if (renderTarget.isWebGLRenderTargetCube) {

			for (var i = 0; i < 6; i++) {

				_gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer[i]);
				if (renderTargetProperties.__webglDepthbuffer) _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer[i]);

			}

		} else {

			_gl.deleteFramebuffer(renderTargetProperties.__webglFramebuffer);
			if (renderTargetProperties.__webglDepthbuffer) _gl.deleteRenderbuffer(renderTargetProperties.__webglDepthbuffer);

		}

		if (renderTarget.isWebGLMultiviewRenderTarget) {

			_gl.deleteTexture(renderTargetProperties.__webglColorTexture);
			_gl.deleteTexture(renderTargetProperties.__webglDepthStencilTexture);

			for (var i = 0, il = renderTargetProperties.__webglViewFramebuffers.length; i < il; i++) {

				_gl.deleteFramebuffer(renderTargetProperties.__webglViewFramebuffers[i]);

			}

		}

		properties.remove(renderTarget.texture);
		properties.remove(renderTarget);

	}

	function onTextureDispose(event) {

		var texture = event.target;

		texture.removeEventListener('dispose', onTextureDispose);

		deallocateTexture(texture);

	}

	function onRenderTargetDispose(event) {

		var renderTarget = event.target;

		renderTarget.removeEventListener('dispose', onRenderTargetDispose);

		deallocateRenderTarget(renderTarget);

	}

	function resizeImage(image, needsPowerOfTwo, needsNewCanvas, maxSize) {

		var scale = 1;

		// handle case if texture exceeds max size

		if (image.width > maxSize || image.height > maxSize) {

			scale = maxSize / Math.max(image.width, image.height);

		}

		// only perform resize if necessary

		if (scale < 1 || needsPowerOfTwo === true) {

			// only perform resize for certain image types

			if ((typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
				(typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
				(typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)) {

				var floor = needsPowerOfTwo ? _Math.floorPowerOfTwo : Math.floor;

				var width = floor(scale * image.width);
				var height = floor(scale * image.height);

				if (_canvas === undefined) _canvas = createCanvas(width, height);

				// cube textures can't reuse the same canvas

				var canvas = needsNewCanvas ? createCanvas(width, height) : _canvas;

				canvas.width = width;
				canvas.height = height;

				var context = canvas.getContext('2d');
				context.drawImage(image, 0, 0, width, height);

				console.warn('TextureUtilities: Texture has been resized from (' + image.width + 'x' + image.height + ') to (' + width + 'x' + height + ').');

				return canvas;

			} else {

				if ('data' in image) {

					console.warn('TextureUtilities: Image in DataTexture is too big (' + image.width + 'x' + image.height + ').');

				}

				return image;

			}

		}

		return image;

	}

	function isPowerOfTwo(image) {

		return _Math.isPowerOfTwo(image.width) && _Math.isPowerOfTwo(image.height);

	}

	function textureNeedsPowerOfTwo(texture) {

		if (_isWebGL2) return false;

		return (texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping) ||
			(texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter);

	}

	function textureNeedsGenerateMipmaps(texture, supportsMips) {

		return texture.generateMipmaps && supportsMips &&
			texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;

	}

	function generateMipmap(target, texture, width, height) {

		_gl.generateMipmap(target);

		var textureProperties = properties.get(texture);

		// Note: Math.log( x ) * Math.LOG2E used instead of Math.log2( x ) which is not supported by IE11
		textureProperties.__maxMipLevel = Math.log(Math.max(width, height)) * Math.LOG2E;

	}

	function getInternalFormat(internalFormatName, glFormat, glType) {

		if (_isWebGL2 === false) return glFormat;

		if (internalFormatName !== null) {

			if (_gl[internalFormatName] !== undefined) return _gl[internalFormatName];

			console.warn('TextureUtilities: Attempt to use non-existing WebGL internal format \'' + internalFormatName + '\'');

		}

		var internalFormat = glFormat;

		if (glFormat === _gl.RED) {

			if (glType === _gl.FLOAT) internalFormat = _gl.R32F;
			if (glType === _gl.HALF_FLOAT) internalFormat = _gl.R16F;
			if (glType === _gl.UNSIGNED_BYTE) internalFormat = _gl.R8;

		}

		if (glFormat === _gl.RGB) {

			if (glType === _gl.FLOAT) internalFormat = _gl.RGB32F;
			if (glType === _gl.HALF_FLOAT) internalFormat = _gl.RGB16F;
			if (glType === _gl.UNSIGNED_BYTE) internalFormat = _gl.RGB8;

		}

		if (glFormat === _gl.RGBA) {

			if (glType === _gl.FLOAT) internalFormat = _gl.RGBA32F;
			if (glType === _gl.HALF_FLOAT) internalFormat = _gl.RGBA16F;
			if (glType === _gl.UNSIGNED_BYTE) internalFormat = _gl.RGBA8;

		}

		if (internalFormat === _gl.R16F || internalFormat === _gl.R32F ||
			internalFormat === _gl.RGBA16F || internalFormat === _gl.RGBA32F) {

			extensions.get('EXT_color_buffer_float');

		} else if (internalFormat === _gl.RGB16F || internalFormat === _gl.RGB32F) {

			console.warn('TextureUtilities: Floating point textures with RGB format not supported. Please use RGBA instead.');

		}

		return internalFormat;

	}

	// Fallback filters for non-power-of-2 textures

	function filterFallback(f) {

		if (f === NearestFilter || f === NearestMipmapNearestFilter || f === NearestMipmapLinearFilter) {

			return _gl.NEAREST;

		}

		return _gl.LINEAR;

	}

	function activeTexture(webglSlot) {

		if (webglSlot === undefined) webglSlot = _gl.TEXTURE0 + _maxTextures - 1;

		if (_currentTextureSlot !== webglSlot) {

			_gl.activeTexture(webglSlot);
			_currentTextureSlot = webglSlot;

		}

	}

	function bindTexture(webglType, webglTexture) {

		if (_currentTextureSlot === null) {

			activeTexture();

		}

		var boundTexture = _currentBoundTextures[_currentTextureSlot];

		if (boundTexture === undefined) {

			boundTexture = { type: undefined, texture: undefined };
			_currentBoundTextures[_currentTextureSlot] = boundTexture;

		}

		if (boundTexture.type !== webglType || boundTexture.texture !== webglTexture) {

			_gl.bindTexture(webglType, webglTexture || _emptyTextures[webglType]);

			boundTexture.type = webglType;
			boundTexture.texture = webglTexture;

		}

	}

	function unbindTexture() {

		var boundTexture = _currentBoundTextures[_currentTextureSlot];

		if (boundTexture !== undefined && boundTexture.type !== undefined) {

			_gl.bindTexture(boundTexture.type, null);

			boundTexture.type = undefined;
			boundTexture.texture = undefined;

		}

	}

	function compressedTexImage2D() {

		try {

			_gl.compressedTexImage2D.apply(_gl, arguments);

		} catch (error) {

			console.error('TextureUtilities:', error);

		}

	}

	function texImage2D() {

		try {

			_gl.texImage2D.apply(_gl, arguments);

		} catch (error) {

			console.error('TextureUtilities:', error);

		}

	}

	function texImage3D() {

		try {

			gl.texImage3D.apply(gl, arguments);

		} catch (error) {

			console.error('TextureUtilities:', error);

		}

	}

	function setTextureParameters(textureType, texture, supportsMips) {

		if (supportsMips) {

			_gl.texParameteri(textureType, _gl.TEXTURE_WRAP_S, _wrappingToGL[texture.wrapS]);
			_gl.texParameteri(textureType, _gl.TEXTURE_WRAP_T, _wrappingToGL[texture.wrapT]);

			if (textureType === _gl.TEXTURE_3D || textureType === _gl.TEXTURE_2D_ARRAY) {

				_gl.texParameteri(textureType, _gl.TEXTURE_WRAP_R, _wrappingToGL[texture.wrapR]);

			}

			_gl.texParameteri(textureType, _gl.TEXTURE_MAG_FILTER, _filterToGL[texture.magFilter]);
			_gl.texParameteri(textureType, _gl.TEXTURE_MIN_FILTER, _filterToGL[texture.minFilter]);

		} else {

			_gl.texParameteri(textureType, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE);
			_gl.texParameteri(textureType, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE);

			if (textureType === _gl.TEXTURE_3D || textureType === _gl.TEXTURE_2D_ARRAY) {

				_gl.texParameteri(textureType, _gl.TEXTURE_WRAP_R, _gl.CLAMP_TO_EDGE);

			}

			if (texture.wrapS !== ClampToEdgeWrapping || texture.wrapT !== ClampToEdgeWrapping) {

				console.warn('TextureUtilities: Texture is not power of two. Texture.wrapS and Texture.wrapT should be set to THREE.ClampToEdgeWrapping.');

			}

			_gl.texParameteri(textureType, _gl.TEXTURE_MAG_FILTER, filterFallback(texture.magFilter));
			_gl.texParameteri(textureType, _gl.TEXTURE_MIN_FILTER, filterFallback(texture.minFilter));

			if (texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter) {

				console.warn('TextureUtilities: Texture is not power of two. Texture.minFilter should be set to THREE.NearestFilter or THREE.LinearFilter.');

			}

		}

		var extension = extensions.get('EXT_texture_filter_anisotropic');

		if (extension) {

			if (texture.type === FloatType && extensions.get('OES_texture_float_linear') === null) return;
			if (texture.type === HalfFloatType && (_isWebGL2 || extensions.get('OES_texture_half_float_linear')) === null) return;

			if (texture.anisotropy > 1 || properties.get(texture).__currentAnisotropy) {

				_gl.texParameterf(textureType, extension.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(texture.anisotropy, capabilities.getMaxAnisotropy()));
				properties.get(texture).__currentAnisotropy = texture.anisotropy;

			}

		}

	}

	function createTexture(type, target, count) {

		var data = new Uint8Array(4); // 4 is required to match default unpack alignment of 4.
		var texture = _gl.createTexture();

		_gl.bindTexture(type, texture);
		_gl.texParameteri(type, _gl.TEXTURE_MIN_FILTER, _gl.NEAREST);
		_gl.texParameteri(type, _gl.TEXTURE_MAG_FILTER, _gl.NEAREST);

		for (var i = 0; i < count; i++) {

			_gl.texImage2D(target + i, 0, _gl.RGBA, 1, 1, 0, _gl.RGBA, _gl.UNSIGNED_BYTE, data);

		}

		return texture;

	}

	function initTexture(textureProperties, texture) {

		if (textureProperties.__webglInit === undefined) {

			textureProperties.__webglInit = true;

			texture.addEventListener('dispose', onTextureDispose);

			textureProperties.__webglTexture = _gl.createTexture();

		}

	}

	function uploadTexture(textureProperties, texture, slot) {

		var textureType = _gl.TEXTURE_2D;

		if (texture.isDataTexture2DArray) textureType = _gl.TEXTURE_2D_ARRAY;
		if (texture.isDataTexture3D) textureType = _gl.TEXTURE_3D;

		initTexture(textureProperties, texture);

		activeTexture(_gl.TEXTURE0 + slot);
		bindTexture(textureType, textureProperties.__webglTexture);

		_gl.pixelStorei(_gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
		_gl.pixelStorei(_gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
		_gl.pixelStorei(_gl.UNPACK_ALIGNMENT, texture.unpackAlignment);

		var needsPowerOfTwo = textureNeedsPowerOfTwo(texture) && isPowerOfTwo(texture.image) === false;
		var image = resizeImage(texture.image, needsPowerOfTwo, false, _maxTextureSize);

		var supportsMips = isPowerOfTwo(image) || _isWebGL2,
			glFormat = BasicUtilities.convert(_gl, texture.format),
			glType = BasicUtilities.convert(_gl, texture.type),
			glInternalFormat = getInternalFormat(texture.internalFormat, glFormat, glType);

		setTextureParameters(textureType, texture, supportsMips);

		var mipmap, mipmaps = texture.mipmaps;

		if (texture.isDepthTexture) {

			// populate depth texture with dummy data

			glInternalFormat = _gl.DEPTH_COMPONENT;

			if (texture.type === FloatType) {

				if (_isWebGL2 === false) throw new Error('Float Depth Texture only supported in WebGL2.0');
				glInternalFormat = _gl.DEPTH_COMPONENT32F;

			} else if (_isWebGL2) {

				// WebGL 2.0 requires signed internalformat for glTexImage2D
				glInternalFormat = _gl.DEPTH_COMPONENT16;

			}

			if (texture.format === DepthFormat && glInternalFormat === _gl.DEPTH_COMPONENT) {

				// The error INVALID_OPERATION is generated by texImage2D if format and internalformat are
				// DEPTH_COMPONENT and type is not UNSIGNED_SHORT or UNSIGNED_INT
				// (https://www.khronos.org/registry/webgl/extensions/WEBGL_depth_texture/)
				if (texture.type !== UnsignedShortType && texture.type !== UnsignedIntType) {

					console.warn('TextureUtilities: Use UnsignedShortType or UnsignedIntType for DepthFormat DepthTexture.');

					texture.type = UnsignedShortType;
					glType = BasicUtilities.convert(_gl, texture.type);

				}

			}

			// Depth stencil textures need the DEPTH_STENCIL internal format
			// (https://www.khronos.org/registry/webgl/extensions/WEBGL_depth_texture/)
			if (texture.format === DepthStencilFormat) {

				glInternalFormat = _gl.DEPTH_STENCIL;

				// The error INVALID_OPERATION is generated by texImage2D if format and internalformat are
				// DEPTH_STENCIL and type is not UNSIGNED_INT_24_8_WEBGL.
				// (https://www.khronos.org/registry/webgl/extensions/WEBGL_depth_texture/)
				if (texture.type !== UnsignedInt248Type) {

					console.warn('TextureUtilities: Use UnsignedInt248Type for DepthStencilFormat DepthTexture.');

					texture.type = UnsignedInt248Type;
					glType = BasicUtilities.convert(_gl, texture.type);

				}

			}

			texImage2D(_gl.TEXTURE_2D, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, null);

		} else if (texture.isDataTexture) {

			// use manually created mipmaps if available
			// if there are no manual mipmaps
			// set 0 level mipmap and then use GL to generate other mipmap levels

			if (mipmaps.length > 0 && supportsMips) {

				for (var i = 0, il = mipmaps.length; i < il; i++) {

					mipmap = mipmaps[i];
					texImage2D(_gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);

				}

				texture.generateMipmaps = false;
				textureProperties.__maxMipLevel = mipmaps.length - 1;

			} else {

				texImage2D(_gl.TEXTURE_2D, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, image.data);
				textureProperties.__maxMipLevel = 0;

			}

		} else if (texture.isCompressedTexture) {

			for (var i = 0, il = mipmaps.length; i < il; i++) {

				mipmap = mipmaps[i];

				if (texture.format !== RGBAFormat && texture.format !== RGBFormat) {

					if (glFormat !== null) {

						compressedTexImage2D(_gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, mipmap.data);

					} else {

						console.warn('TextureUtilities: Attempt to load unsupported compressed texture format in .uploadTexture()');

					}

				} else {

					texImage2D(_gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);

				}

			}

			textureProperties.__maxMipLevel = mipmaps.length - 1;

		} else if (texture.isDataTexture2DArray) {

			texImage3D(_gl.TEXTURE_2D_ARRAY, 0, glInternalFormat, image.width, image.height, image.depth, 0, glFormat, glType, image.data);
			textureProperties.__maxMipLevel = 0;

		} else if (texture.isDataTexture3D) {

			texImage3D(_gl.TEXTURE_3D, 0, glInternalFormat, image.width, image.height, image.depth, 0, glFormat, glType, image.data);
			textureProperties.__maxMipLevel = 0;

		} else {

			// regular Texture (image, video, canvas)

			// use manually created mipmaps if available
			// if there are no manual mipmaps
			// set 0 level mipmap and then use GL to generate other mipmap levels

			if (mipmaps.length > 0 && supportsMips) {

				for (var i = 0, il = mipmaps.length; i < il; i++) {

					mipmap = mipmaps[i];
					texImage2D(_gl.TEXTURE_2D, i, glInternalFormat, glFormat, glType, mipmap);

				}

				texture.generateMipmaps = false;
				textureProperties.__maxMipLevel = mipmaps.length - 1;

			} else {

				texImage2D(_gl.TEXTURE_2D, 0, glInternalFormat, glFormat, glType, image);
				textureProperties.__maxMipLevel = 0;

			}

		}

		if (textureNeedsGenerateMipmaps(texture, supportsMips)) {

			generateMipmap(textureType, texture, image.width, image.height);

		}

		textureProperties.__version = texture.version;

		if (texture.onUpdate) texture.onUpdate(texture);

	}

	// Render targets

	// Setup storage for target texture and bind it to correct framebuffer
	function setupFrameBufferTexture(framebuffer, renderTarget, attachment, textureTarget) {

		var glFormat = BasicUtilities.convert(_gl, renderTarget.texture.format);
		var glType = BasicUtilities.convert(_gl, renderTarget.texture.type);
		var glInternalFormat = getInternalFormat(renderTarget.texture.internalFormat, glFormat, glType);
		texImage2D(textureTarget, 0, glInternalFormat, renderTarget.width, renderTarget.height, 0, glFormat, glType, null);
		_gl.bindFramebuffer(_gl.FRAMEBUFFER, framebuffer);
		_gl.framebufferTexture2D(_gl.FRAMEBUFFER, attachment, textureTarget, properties.get(renderTarget.texture).__webglTexture, 0);
		_gl.bindFramebuffer(_gl.FRAMEBUFFER, null);

	}

	// Setup storage for internal depth/stencil buffers and bind to correct framebuffer
	function setupRenderBufferStorage(renderbuffer, renderTarget, isMultisample) {

		_gl.bindRenderbuffer(_gl.RENDERBUFFER, renderbuffer);

		if (renderTarget.depthBuffer && !renderTarget.stencilBuffer) {

			if (isMultisample) {

				var samples = getRenderTargetSamples(renderTarget);

				_gl.renderbufferStorageMultisample(_gl.RENDERBUFFER, samples, _gl.DEPTH_COMPONENT16, renderTarget.width, renderTarget.height);

			} else {

				_gl.renderbufferStorage(_gl.RENDERBUFFER, _gl.DEPTH_COMPONENT16, renderTarget.width, renderTarget.height);

			}

			_gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer);

		} else if (renderTarget.depthBuffer && renderTarget.stencilBuffer) {

			if (isMultisample) {

				var samples = getRenderTargetSamples(renderTarget);

				_gl.renderbufferStorageMultisample(_gl.RENDERBUFFER, samples, _gl.DEPTH24_STENCIL8, renderTarget.width, renderTarget.height);

			} else {

				_gl.renderbufferStorage(_gl.RENDERBUFFER, _gl.DEPTH_STENCIL, renderTarget.width, renderTarget.height);

			}


			_gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.DEPTH_STENCIL_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer);

		} else {

			var glFormat = BasicUtilities.convert(_gl, renderTarget.texture.format);
			var glType = BasicUtilities.convert(_gl, renderTarget.texture.type);
			var glInternalFormat = getInternalFormat(renderTarget.texture.internalFormat, glFormat, glType);

			if (isMultisample) {

				var samples = getRenderTargetSamples(renderTarget);

				_gl.renderbufferStorageMultisample(_gl.RENDERBUFFER, samples, glInternalFormat, renderTarget.width, renderTarget.height);

			} else {

				_gl.renderbufferStorage(_gl.RENDERBUFFER, glInternalFormat, renderTarget.width, renderTarget.height);

			}

		}

		_gl.bindRenderbuffer(_gl.RENDERBUFFER, null);

	}

	// Setup GL resources for a non-texture depth buffer
	function setupDepthRenderbuffer(renderTarget) {

		var renderTargetProperties = properties.get(renderTarget);

		var isCube = (renderTarget.isWebGLRenderTargetCube === true);

		if (renderTarget.depthTexture) {

			if (isCube) throw new Error('target.depthTexture not supported in Cube render targets');

			setupDepthTexture(renderTargetProperties.__webglFramebuffer, renderTarget);

		} else {

			if (isCube) {

				renderTargetProperties.__webglDepthbuffer = [];

				for (var i = 0; i < 6; i++) {

					_gl.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer[i]);
					renderTargetProperties.__webglDepthbuffer[i] = _gl.createRenderbuffer();
					setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer[i], renderTarget);

				}

			} else {

				_gl.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);
				renderTargetProperties.__webglDepthbuffer = _gl.createRenderbuffer();
				setupRenderBufferStorage(renderTargetProperties.__webglDepthbuffer, renderTarget);

			}

		}

		_gl.bindFramebuffer(_gl.FRAMEBUFFER, null);

	}

	// Set up GL resources for the render target
	function setupRenderTarget(renderTarget) {

		var renderTargetProperties = properties.get(renderTarget);
		var textureProperties = properties.get(renderTarget.texture);

		renderTarget.addEventListener('dispose', onRenderTargetDispose);

		textureProperties.__webglTexture = _gl.createTexture();

		var isCube = (renderTarget.isWebGLRenderTargetCube === true);
		var isMultisample = (renderTarget.isWebGLMultisampleRenderTarget === true);
		var isMultiview = (renderTarget.isWebGLMultiviewRenderTarget === true);
		var supportsMips = isPowerOfTwo(renderTarget) || _isWebGL2;

		// Setup framebuffer

		if (isCube) {

			renderTargetProperties.__webglFramebuffer = [];

			for (var i = 0; i < 6; i++) {

				renderTargetProperties.__webglFramebuffer[i] = _gl.createFramebuffer();

			}

		} else {

			renderTargetProperties.__webglFramebuffer = _gl.createFramebuffer();

			if (isMultisample) {

				if (_isWebGL2) {

					renderTargetProperties.__webglMultisampledFramebuffer = _gl.createFramebuffer();
					renderTargetProperties.__webglColorRenderbuffer = _gl.createRenderbuffer();

					_gl.bindRenderbuffer(_gl.RENDERBUFFER, renderTargetProperties.__webglColorRenderbuffer);

					var glFormat = BasicUtilities.convert(_gl, renderTarget.texture.format);
					var glType = BasicUtilities.convert(_gl, renderTarget.texture.type);
					var glInternalFormat = getInternalFormat(renderTarget.texture.internalFormat, glFormat, glType);
					var samples = getRenderTargetSamples(renderTarget);
					_gl.renderbufferStorageMultisample(_gl.RENDERBUFFER, samples, glInternalFormat, renderTarget.width, renderTarget.height);

					_gl.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglMultisampledFramebuffer);
					_gl.framebufferRenderbuffer(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, _gl.RENDERBUFFER, renderTargetProperties.__webglColorRenderbuffer);
					_gl.bindRenderbuffer(_gl.RENDERBUFFER, null);

					if (renderTarget.depthBuffer) {

						renderTargetProperties.__webglDepthRenderbuffer = _gl.createRenderbuffer();
						setupRenderBufferStorage(renderTargetProperties.__webglDepthRenderbuffer, renderTarget, true);

					}

					_gl.bindFramebuffer(_gl.FRAMEBUFFER, null);


				} else {

					console.warn('TextureUtilities: WebGLMultisampleRenderTarget can only be used with WebGL2.');

				}

			} else if (isMultiview) {

				var width = renderTarget.width;
				var height = renderTarget.height;
				var numViews = renderTarget.numViews;

				_gl.bindFramebuffer(_gl.FRAMEBUFFER, renderTargetProperties.__webglFramebuffer);

				var ext = extensions.get('OVR_multiview2');

				info.memory.textures += 2;

				var colorTexture = _gl.createTexture();
				_gl.bindTexture(_gl.TEXTURE_2D_ARRAY, colorTexture);
				_gl.texParameteri(_gl.TEXTURE_2D_ARRAY, _gl.TEXTURE_MAG_FILTER, _gl.NEAREST);
				_gl.texParameteri(_gl.TEXTURE_2D_ARRAY, _gl.TEXTURE_MIN_FILTER, _gl.NEAREST);
				_gl.texImage3D(_gl.TEXTURE_2D_ARRAY, 0, _gl.RGBA8, width, height, numViews, 0, _gl.RGBA, _gl.UNSIGNED_BYTE, null);
				ext.framebufferTextureMultiviewOVR(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, colorTexture, 0, 0, numViews);

				var depthStencilTexture = _gl.createTexture();
				_gl.bindTexture(_gl.TEXTURE_2D_ARRAY, depthStencilTexture);
				_gl.texParameteri(_gl.TEXTURE_2D_ARRAY, _gl.TEXTURE_MAG_FILTER, _gl.NEAREST);
				_gl.texParameteri(_gl.TEXTURE_2D_ARRAY, _gl.TEXTURE_MIN_FILTER, _gl.NEAREST);
				_gl.texImage3D(_gl.TEXTURE_2D_ARRAY, 0, _gl.DEPTH24_STENCIL8, width, height, numViews, 0, _gl.DEPTH_STENCIL, _gl.UNSIGNED_INT_24_8, null);
				ext.framebufferTextureMultiviewOVR(_gl.FRAMEBUFFER, _gl.DEPTH_STENCIL_ATTACHMENT, depthStencilTexture, 0, 0, numViews);

				var viewFramebuffers = new Array(numViews);
				for (var i = 0; i < numViews; ++i) {

					viewFramebuffers[i] = _gl.createFramebuffer();
					_gl.bindFramebuffer(_gl.FRAMEBUFFER, viewFramebuffers[i]);
					_gl.framebufferTextureLayer(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, colorTexture, 0, i);

				}

				renderTargetProperties.__webglColorTexture = colorTexture;
				renderTargetProperties.__webglDepthStencilTexture = depthStencilTexture;
				renderTargetProperties.__webglViewFramebuffers = viewFramebuffers;

				_gl.bindFramebuffer(_gl.FRAMEBUFFER, null);
				_gl.bindTexture(_gl.TEXTURE_2D_ARRAY, null);

			}

		}

		// Setup color buffer

		if (isCube) {

			bindTexture(_gl.TEXTURE_CUBE_MAP, textureProperties.__webglTexture);
			setTextureParameters(_gl.TEXTURE_CUBE_MAP, renderTarget.texture, supportsMips);

			for (var i = 0; i < 6; i++) {

				setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer[i], renderTarget, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_CUBE_MAP_POSITIVE_X + i);

			}

			if (textureNeedsGenerateMipmaps(renderTarget.texture, supportsMips)) {

				generateMipmap(_gl.TEXTURE_CUBE_MAP, renderTarget.texture, renderTarget.width, renderTarget.height);

			}

			bindTexture(_gl.TEXTURE_CUBE_MAP, null);

		} else if (!isMultiview) {

			bindTexture(_gl.TEXTURE_2D, textureProperties.__webglTexture);
			setTextureParameters(_gl.TEXTURE_2D, renderTarget.texture, supportsMips);
			setupFrameBufferTexture(renderTargetProperties.__webglFramebuffer, renderTarget, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_2D);

			if (textureNeedsGenerateMipmaps(renderTarget.texture, supportsMips)) {

				generateMipmap(_gl.TEXTURE_2D, renderTarget.texture, renderTarget.width, renderTarget.height);

			}

			bindTexture(_gl.TEXTURE_2D, null);

		}

		// Setup depth and stencil buffers

		if (renderTarget.depthBuffer) {

			setupDepthRenderbuffer(renderTarget);

		}

	}

	function setTexture2D(texture, slot) {

		var textureProperties = properties.get(texture);

		if (texture.version > 0 && textureProperties.__version !== texture.version) {

			var image = texture.image;

			if (image === undefined) {

				console.warn('TextureUtilities: Texture marked for update but image is undefined');

			} else if (image.complete === false) {

				console.warn('TextureUtilities: Texture marked for update but image is incomplete');

			} else {

				uploadTexture(textureProperties, texture, slot);
				return;

			}

		}

		activeTexture(_gl.TEXTURE0 + slot);
		bindTexture(_gl.TEXTURE_2D, textureProperties.__webglTexture);

	}

	function safeSetTexture2D(texture, slot) {

		if (texture && texture.isWebGLRenderTarget) {

			if (warnedTexture2D === false) {

				console.warn("TextureUtilities: don't use render targets as textures. Use their .texture property instead.");
				warnedTexture2D = true;

			}

			texture = texture.texture;

		}

		setTexture2D(texture, slot);

	}

	// API

	this.allocateTextureUnit = allocateTextureUnit;
	this.resetTextureUnits = resetTextureUnits;

	this.setupRenderTarget = setupRenderTarget;

	this.safeSetTexture2D = safeSetTexture2D;

}

export { TextureUtilities };