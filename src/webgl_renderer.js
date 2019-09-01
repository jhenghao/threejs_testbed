'usc strict'

//import { WebGlLights } from '../three.js-master/src/renderers/webgl/WebGLLights.js';

function WebGLRenderer( parameters ) {

	console.log( 'THREE.WebGLRenderer', THREE.REVISION );

	parameters = parameters || {};

	var _canvas = parameters.canvas !== undefined ? parameters.canvas : document.createElementNS( 'http://www.w3.org/1999/xhtml', 'canvas' ),
		_context = parameters.context !== undefined ? parameters.context : null,

		_alpha = parameters.alpha !== undefined ? parameters.alpha : false,
		_depth = parameters.depth !== undefined ? parameters.depth : true,
		_stencil = parameters.stencil !== undefined ? parameters.stencil : true,
		_antialias = parameters.antialias !== undefined ? parameters.antialias : false,
		_premultipliedAlpha = parameters.premultipliedAlpha !== undefined ? parameters.premultipliedAlpha : true,
		_preserveDrawingBuffer = parameters.preserveDrawingBuffer !== undefined ? parameters.preserveDrawingBuffer : false,
		_powerPreference = parameters.powerPreference !== undefined ? parameters.powerPreference : 'default';

	var currentRenderList = null;
	var currentRenderState = null;

	var shaderIDs = {
		MeshDepthMaterial: 'depth',
		MeshDistanceMaterial: 'distanceRGBA',
		MeshNormalMaterial: 'normal',
		MeshBasicMaterial: 'basic',
		MeshLambertMaterial: 'lambert',
		MeshPhongMaterial: 'phong',
		MeshToonMaterial: 'phong',
		MeshStandardMaterial: 'physical',
		MeshPhysicalMaterial: 'physical',
		MeshMatcapMaterial: 'matcap',
		LineBasicMaterial: 'basic',
		LineDashedMaterial: 'dashed',
		PointsMaterial: 'points',
		ShadowMaterial: 'shadow',
		SpriteMaterial: 'sprite'
	};

	var programParameterNames = [
		"precision", "supportsVertexTextures", "map", "mapEncoding", "matcap", "matcapEncoding", "envMap", "envMapMode", "envMapEncoding",
		"lightMap", "aoMap", "emissiveMap", "emissiveMapEncoding", "bumpMap", "normalMap", "objectSpaceNormalMap", "displacementMap", "specularMap",
		"roughnessMap", "metalnessMap", "gradientMap",
		"alphaMap", "combine", "vertexColors", "vertexTangents", "fog", "useFog", "fogExp",
		"flatShading", "sizeAttenuation", "logarithmicDepthBuffer", "skinning",
		"maxBones", "useVertexTexture", "morphTargets", "morphNormals",
		"maxMorphTargets", "maxMorphNormals", "premultipliedAlpha",
		"numDirLights", "numPointLights", "numSpotLights", "numHemiLights", "numRectAreaLights",
		"shadowMapEnabled", "shadowMapType", "toneMapping", 'physicallyCorrectLights',
		"alphaTest", "doubleSided", "flipSided", "numClippingPlanes", "numClipIntersection", "depthPacking", "dithering"
	];

	var memoryInfo = {
		geometries: 0,
		textures: 0
	};

	var renderInfo = {
		frame: 0,
		calls: 0,
		triangles: 0,
		points: 0,
		lines: 0
	};

	var attributeBuffers = new WeakMap();
	var objectPropertiesMap = new WeakMap();

	var lightsArray = [];
	var shadowsArray = [];

	var renderItems = [];
	var renderItemsIndex = 0;

	var opaqueObjects = [];
	var transparentObjects = [];

	var geometryUpdateList = {};
	var bufferGeometries = {};

	var enabledCapabilities = {};

	var currentDepthMask = null;
	var currentDepthFunc = null;
	var currentDepthClear = null;

	var currentProgram = null;

	var currentBlendingEnabled = null;
	var currentBlending = null;
	var currentBlendEquation = null;
	var currentBlendSrc = null;
	var currentBlendDst = null;
	var currentBlendEquationAlpha = null;
	var currentBlendSrcAlpha = null;
	var currentBlendDstAlpha = null;
	var currentPremultipledAlpha = false;

	var currentFlipSided = null;

	var currentColorMask = null;

	// public properties

	this.domElement = _canvas;
	this.context = null;

	// clearing

	this.autoClear = true;
	this.autoClearColor = true;
	this.autoClearDepth = true;
	this.autoClearStencil = true;

	// scene graph

	this.sortObjects = true;

	// tone mapping

	this.toneMapping = THREE.LinearToneMapping;
	this.toneMappingExposure = 1.0;
	this.toneMappingWhitePoint = 1.0;

	// internal properties

	var _this = this,

		_isContextLost = false,

		// internal state cache

		_framebuffer = null,

		_currentRenderTarget = null,
		_currentFramebuffer = null,
		_currentMaterialId = - 1,

		// geometry and program caching

		_currentGeometryProgram = {
			geometry: null,
			program: null,
			wireframe: false
		},

		_currentCamera = null,
		_currentArrayCamera = null,

		_currentViewport = new THREE.Vector4(),
		_currentScissor = new THREE.Vector4(),
		_currentScissorTest = null,

		//

		_width = _canvas.width,
		_height = _canvas.height,

		_pixelRatio = 1,

		_viewport = new THREE.Vector4( 0, 0, _width, _height ),
		_scissor = new THREE.Vector4( 0, 0, _width, _height ),
		_scissorTest = false,

		// frustum

		_frustum = new THREE.Frustum(),

		// camera matrices cache

		_projScreenMatrix = new THREE.Matrix4(),

		_vector3 = new THREE.Vector3();

	function getTargetPixelRatio() {

		return _currentRenderTarget === null ? _pixelRatio : 1;

	}

	// initialize

	var _gl;

	try {

		var contextAttributes = {
			alpha: _alpha,
			depth: _depth,
			stencil: _stencil,
			antialias: _antialias,
			premultipliedAlpha: _premultipliedAlpha,
			preserveDrawingBuffer: _preserveDrawingBuffer,
			powerPreference: _powerPreference
		};

		// event listeners must be registered before WebGL context is created, see #12753

		_canvas.addEventListener( 'webglcontextlost', onContextLost, false );
		_canvas.addEventListener( 'webglcontextrestored', onContextRestore, false );

		_gl = _context || _canvas.getContext( 'webgl', contextAttributes ) || _canvas.getContext( 'experimental-webgl', contextAttributes );

		if ( _gl === null ) {

			if ( _canvas.getContext( 'webgl' ) !== null ) {

				throw new Error( 'Error creating WebGL context with your selected attributes.' );

			} else {

				throw new Error( 'Error creating WebGL context.' );

			}

		}

		// Some experimental-webgl implementations do not have getShaderPrecisionFormat

		if ( _gl.getShaderPrecisionFormat === undefined ) {

			_gl.getShaderPrecisionFormat = function () {

				return { 'rangeMin': 1, 'rangeMax': 1, 'precision': 1 };

			};

		}

	} catch ( error ) {

		console.error( 'THREE.WebGLRenderer: ' + error.message );
		throw error;

	}

	var extensions, capabilities, state, info;
	var properties, textures, attributes, geometries, objects;
	var programCache, renderLists, renderStates;

	var background, bufferRenderer, indexedBufferRenderer;

	var utils;

	function initGLContext() {

		/*
		extensions = new THREE.WebGLExtensions( _gl );

		capabilities = new THREE.WebGLCapabilities( _gl, extensions, parameters );

		if ( ! capabilities.isWebGL2 ) {

			extensions.get( 'WEBGL_depth_texture' );
			extensions.get( 'OES_texture_float' );
			extensions.get( 'OES_texture_half_float' );
			extensions.get( 'OES_texture_half_float_linear' );
			extensions.get( 'OES_standard_derivatives' );
			extensions.get( 'OES_element_index_uint' );
			extensions.get( 'ANGLE_instanced_arrays' );

		}

		extensions.get( 'OES_texture_float_linear' );

		utils = new THREE.WebGLUtils( _gl, extensions, capabilities );

		state = new THREE.WebGLState( _gl, extensions, utils, capabilities );
		state.scissor( _currentScissor.copy( _scissor ).multiplyScalar( _pixelRatio ) );
		state.viewport( _currentViewport.copy( _viewport ).multiplyScalar( _pixelRatio ) );

		info = new THREE.WebGLInfo( _gl );
		properties = new THREE.WebGLProperties();
		textures = new WebGLTextures( _gl, extensions, state, properties, capabilities, utils, info );
		attributes = new WebGLAttributes( _gl );
		geometries = new WebGLGeometries( _gl, attributes, info );
		objects = new WebGLObjects( geometries, info );
		programCache = new WebGLPrograms( _this, extensions, capabilities, textures );
		renderLists = new WebGLRenderLists();
		renderStates = new WebGLRenderStates();

		bufferRenderer = new WebGLBufferRenderer( _gl, extensions, info, capabilities );
		indexedBufferRenderer = new WebGLIndexedBufferRenderer( _gl, extensions, info, capabilities );

		info.programs = programCache.programs;
		*/

		_this.context = _gl;
		//_this.capabilities = capabilities;
		//_this.extensions = extensions;
		//_this.properties = properties;
		//_this.renderLists = renderLists;
		//_this.state = state;
		//_this.info = info;

	}

	initGLContext();

	var maxVertexAttributes = _gl.getParameter( _gl.MAX_VERTEX_ATTRIBS );
	var newAttributes = new Uint8Array( maxVertexAttributes );
	var enabledAttributes = new Uint8Array( maxVertexAttributes );
	var attributeDivisors = new Uint8Array( maxVertexAttributes );

	// shadow map

	//var shadowMap = new WebGLShadowMap( _this, objects, capabilities.maxTextureSize );

	//this.shadowMap = shadowMap;

	// API

	this.getContext = function () {

		return _gl;

	};

	this.getContextAttributes = function () {

		return _gl.getContextAttributes();

	};

	this.forceContextLoss = function () {

		var extension = extensions.get( 'WEBGL_lose_context' );
		if ( extension ) extension.loseContext();

	};

	this.forceContextRestore = function () {

		var extension = extensions.get( 'WEBGL_lose_context' );
		if ( extension ) extension.restoreContext();

	};

	this.getPixelRatio = function () {

		return _pixelRatio;

	};

	this.setPixelRatio = function ( value ) {

		if ( value === undefined ) return;

		_pixelRatio = value;

		this.setSize( _width, _height, false );

	};

	this.getSize = function ( target ) {

		if ( target === undefined ) {

			console.warn( 'WebGLRenderer: .getsize() now requires a Vector2 as an argument' );

			target = new Vector2();

		}

		return target.set( _width, _height );

	};

	this.setSize = function ( width, height, updateStyle ) {

		_width = width;
		_height = height;

		_canvas.width = width * _pixelRatio;
		_canvas.height = height * _pixelRatio;

		if ( updateStyle !== false ) {

			_canvas.style.width = width + 'px';
			_canvas.style.height = height + 'px';

		}

		this.setViewport( 0, 0, width, height );

	};

	this.getDrawingBufferSize = function ( target ) {

		if ( target === undefined ) {

			console.warn( 'WebGLRenderer: .getdrawingBufferSize() now requires a Vector2 as an argument' );

			target = new Vector2();

		}

		return target.set( _width * _pixelRatio, _height * _pixelRatio );

	};

	this.getCurrentViewport = function ( target ) {

		if ( target === undefined ) {

			console.warn( 'WebGLRenderer: .getCurrentViewport() now requires a Vector4 as an argument' );

			target = new Vector4();

		}

		return target.copy( _currentViewport );

	};

	this.getViewport = function ( target ) {

		return target.copy( _viewport );

	};

	this.setViewport = function ( x, y, width, height ) {

		if ( x.isVector4 ) {

			_viewport.set( x.x, x.y, x.z, x.w );

		} else {

			_viewport.set( x, y, width, height );

		}

		_currentViewport.copy( _viewport ).multiplyScalar( _pixelRatio );
		_gl.viewport( _currentViewport.x, _currentViewport.y, _currentViewport.z, _currentViewport.w );

	};

	this.getScissor = function ( target ) {

		return target.copy( _scissor );

	};

	this.setScissor = function ( x, y, width, height ) {

		if ( x.isVector4 ) {

			_scissor.set( x.x, x.y, x.z, x.w );

		} else {

			_scissor.set( x, y, width, height );

		}

		state.scissor( _currentScissor.copy( _scissor ).multiplyScalar( _pixelRatio ) );

	};

	this.getScissorTest = function () {

		return _scissorTest;

	};

	this.setScissorTest = function ( boolean ) {

		state.setScissorTest( _scissorTest = boolean );

	};

	// Clearing

	this.getClearColor = function () {

		return background.getClearColor();

	};

	this.setClearColor = function () {

		background.setClearColor.apply( background, arguments );

	};

	this.getClearAlpha = function () {

		return background.getClearAlpha();

	};

	this.setClearAlpha = function () {

		background.setClearAlpha.apply( background, arguments );

	};

	this.clear = function ( color, depth, stencil ) {

		var bits = 0;

		if ( color === undefined || color ) bits |= _gl.COLOR_BUFFER_BIT;
		if ( depth === undefined || depth ) bits |= _gl.DEPTH_BUFFER_BIT;
		if ( stencil === undefined || stencil ) bits |= _gl.STENCIL_BUFFER_BIT;

		_gl.clear( bits );

	};

	this.clearColor = function () {

		this.clear( true, false, false );

	};

	this.clearDepth = function () {

		this.clear( false, true, false );

	};

	this.clearStencil = function () {

		this.clear( false, false, true );

	};

	//

	this.dispose = function () {

		_canvas.removeEventListener( 'webglcontextlost', onContextLost, false );
		_canvas.removeEventListener( 'webglcontextrestored', onContextRestore, false );

		renderLists.dispose();
		renderStates.dispose();
		properties.dispose();
		objects.dispose();

		vr.dispose();

		animation.stop();

	};

	// Events

	function onContextLost( event ) {

		event.preventDefault();

		console.log( 'THREE.WebGLRenderer: Context Lost.' );

		_isContextLost = true;

	}

	function onContextRestore( /* event */ ) {

		console.log( 'THREE.WebGLRenderer: Context Restored.' );

		_isContextLost = false;

		initGLContext();

	}

	function onMaterialDispose( event ) {

		var material = event.target;

		material.removeEventListener( 'dispose', onMaterialDispose );

		deallocateMaterial( material );

	}

	// Buffer deallocation

	function deallocateMaterial( material ) {

		releaseMaterialProgramReference( material );

		properties.remove( material );

	}


	function releaseMaterialProgramReference( material ) {

		var programInfo = properties.get( material ).program;

		material.program = undefined;

		if ( programInfo !== undefined ) {

			programCache.releaseProgram( programInfo );

		}

	}

	// Buffer rendering

	this.renderBufferDirect = function ( camera, geometry, material, object, group ) {

		var frontFaceCW = ( object.isMesh && object.matrixWorld.determinant() < 0 );

		setMaterial( _gl, material, frontFaceCW );

		var program = setProgram( _gl, camera, material, object );

		var updateBuffers = false;

		if ( _currentGeometryProgram.geometry !== geometry.id ||
			_currentGeometryProgram.program !== program.id ||
			_currentGeometryProgram.wireframe !== ( material.wireframe === true ) ) {

			_currentGeometryProgram.geometry = geometry.id;
			_currentGeometryProgram.program = program.id;
			_currentGeometryProgram.wireframe = material.wireframe === true;
			updateBuffers = true;

		}

		//

		var index = geometry.index;
		var position = geometry.attributes.position;
		var rangeFactor = 1;

		if ( material.wireframe === true ) {

			index = geometries.getWireframeAttribute( geometry );
			rangeFactor = 2;

		}

		var attribute;
		var renderer = bufferRenderer;

		if ( index !== null ) {

			attribute = getAttributeBuffer( index );

		}

		if ( updateBuffers ) {

			setupVertexAttributes( material, program, geometry );

			if ( index !== null ) {

				_gl.bindBuffer( _gl.ELEMENT_ARRAY_BUFFER, attribute.buffer );

			}

		}

		//

		var dataCount = Infinity;

		if ( index !== null ) {

			dataCount = index.count;

		} else if ( position !== undefined ) {

			dataCount = position.count;

		}

		var rangeStart = geometry.drawRange.start * rangeFactor;
		var rangeCount = geometry.drawRange.count * rangeFactor;

		var groupStart = group !== null ? group.start * rangeFactor : 0;
		var groupCount = group !== null ? group.count * rangeFactor : Infinity;

		var drawStart = Math.max( rangeStart, groupStart );
		var drawEnd = Math.min( dataCount, rangeStart + rangeCount, groupStart + groupCount ) - 1;

		var drawCount = Math.max( 0, drawEnd - drawStart + 1 );

		if ( drawCount === 0 ) return;

		//

		var renderMode = null;

		if ( object.isMesh ) {

			if ( material.wireframe === true ) {

				state.setLineWidth( material.wireframeLinewidth * getTargetPixelRatio() );
				renderer.setMode( _gl.LINES );

			} else {

				switch ( object.drawMode ) {

					case THREE.TrianglesDrawMode:
						renderMode = _gl.TRIANGLES;
						break;

					case THREE.TriangleStripDrawMode:
						renderMode = _gl.TRIANGLE_STRIP;
						break;

					case THREE.TriangleFanDrawMode:
						renderMode = _gl.TRIANGLE_FAN;
						break;
				}

			}

		} 

		if ( index !== null ) {

			let attribute = getAttributeBuffer( index );

			let type = attribute.type;
			let bytesPerElement = attribute.bytesPerElement;

			_gl.drawElements( renderMode, drawCount, type, drawStart * bytesPerElement );

		}

	};

	function glEnable( gl, id ) {

		if ( enabledCapabilities[ id ] !== true ) {

			gl.enable( id );
			enabledCapabilities[ id ] = true;

		}

	}

	function glDisable( gl, id ) {

		if ( enabledCapabilities[ id ] !== false ) {

			gl.disable( id );
			enabledCapabilities[ id ] = false;

		}

	}

	function setDepthTest ( gl, depthTest ) {

		if ( depthTest ) {

			glEnable( gl, gl.DEPTH_TEST );

		} else {

			glDisable( gl, gl.DEPTH_TEST );

		}

	};

	function setDepthMask ( gl, depthMask ) {

		if ( currentDepthMask !== depthMask ) {

			gl.depthMask( depthMask );
			currentDepthMask = depthMask;

		}

	};

	function setDepthFunc ( gl, depthFunc ) {

		if ( currentDepthFunc !== depthFunc ) {

			if ( depthFunc ) {

				switch ( depthFunc ) {

					case THREE.NeverDepth:

						gl.depthFunc( gl.NEVER );
						break;

					case THREE.AlwaysDepth:

						gl.depthFunc( gl.ALWAYS );
						break;

					case THREE.LessDepth:

						gl.depthFunc( gl.LESS );
						break;

					case THREE.LessEqualDepth:

						gl.depthFunc( gl.LEQUAL );
						break;

					case THREE.EqualDepth:

						gl.depthFunc( gl.EQUAL );
						break;

					case THREE.GreaterEqualDepth:

						gl.depthFunc( gl.GEQUAL );
						break;

					case THREE.GreaterDepth:

						gl.depthFunc( gl.GREATER );
						break;

					case THREE.NotEqualDepth:

						gl.depthFunc( gl.NOTEQUAL );
						break;

					default:

						gl.depthFunc( gl.LEQUAL );

				}

			} else {

				gl.depthFunc( gl.LEQUAL );

			}

			currentDepthFunc = depthFunc;

		}

	};

	function setFlipSided( gl, flipSided ) {

		if ( currentFlipSided !== flipSided ) {

			if ( flipSided ) {

				gl.frontFace( gl.CW );

			} else {

				gl.frontFace( gl.CCW );

			}

			currentFlipSided = flipSided;

		}

	}

	function setBlending( gl, blending, blendEquation, blendSrc, blendDst, blendEquationAlpha, blendSrcAlpha, blendDstAlpha, premultipliedAlpha ) {

		if ( blending === THREE.NoBlending ) {

			if ( currentBlendingEnabled ) {

				glDisable( gl.BLEND );
				currentBlendingEnabled = false;

			}

			return;

		}

		if ( ! currentBlendingEnabled ) {

			glEnable( gl, gl.BLEND );
			currentBlendingEnabled = true;

		}

		if ( blending !== THREE.CustomBlending ) {

			if ( blending !== currentBlending || premultipliedAlpha !== currentPremultipledAlpha ) {

				if ( currentBlendEquation !== THREE.AddEquation || currentBlendEquationAlpha !== THREE.AddEquation ) {

					gl.blendEquation( gl.FUNC_ADD );

					currentBlendEquation = THREE.AddEquation;
					currentBlendEquationAlpha = THREE.AddEquation;

				}

				if ( premultipliedAlpha ) {

					switch ( blending ) {

						case THREE.NormalBlending:
							gl.blendFuncSeparate( gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA );
							break;

						case THREE.AdditiveBlending:
							gl.blendFunc( gl.ONE, gl.ONE );
							break;

						case THREE.SubtractiveBlending:
							gl.blendFuncSeparate( gl.ZERO, gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ONE_MINUS_SRC_ALPHA );
							break;

						case THREE.MultiplyBlending:
							gl.blendFuncSeparate( gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.SRC_ALPHA );
							break;

						default:
							console.error( 'THREE.WebGLState: Invalid blending: ', blending );
							break;

					}

				} else {

					switch ( blending ) {

						case THREE.NormalBlending:
							gl.blendFuncSeparate( gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA );
							break;

						case THREE.AdditiveBlending:
							gl.blendFunc( gl.SRC_ALPHA, gl.ONE );
							break;

						case THREE.SubtractiveBlending:
							gl.blendFunc( gl.ZERO, gl.ONE_MINUS_SRC_COLOR );
							break;

						case THREE.MultiplyBlending:
							gl.blendFunc( gl.ZERO, gl.SRC_COLOR );
							break;

						default:
							console.error( 'THREE.WebGLState: Invalid blending: ', blending );
							break;

					}

				}

				currentBlendSrc = null;
				currentBlendDst = null;
				currentBlendSrcAlpha = null;
				currentBlendDstAlpha = null;

				currentBlending = blending;
				currentPremultipledAlpha = premultipliedAlpha;

			}

			return;

		}

		// custom blending

		blendEquationAlpha = blendEquationAlpha || blendEquation;
		blendSrcAlpha = blendSrcAlpha || blendSrc;
		blendDstAlpha = blendDstAlpha || blendDst;

		if ( blendEquation !== currentBlendEquation || blendEquationAlpha !== currentBlendEquationAlpha ) {

			gl.blendEquationSeparate( utils.convert( blendEquation ), utils.convert( blendEquationAlpha ) );

			currentBlendEquation = blendEquation;
			currentBlendEquationAlpha = blendEquationAlpha;

		}

		if ( blendSrc !== currentBlendSrc || blendDst !== currentBlendDst || blendSrcAlpha !== currentBlendSrcAlpha || blendDstAlpha !== currentBlendDstAlpha ) {

			gl.blendFuncSeparate( utils.convert( blendSrc ), utils.convert( blendDst ), utils.convert( blendSrcAlpha ), utils.convert( blendDstAlpha ) );

			currentBlendSrc = blendSrc;
			currentBlendDst = blendDst;
			currentBlendSrcAlpha = blendSrcAlpha;
			currentBlendDstAlpha = blendDstAlpha;

		}

		currentBlending = blending;
		currentPremultipledAlpha = null;

	}

	function setColorMask ( gl, colorMask ) {

		if ( currentColorMask !== colorMask ) {

			gl.colorMask( colorMask, colorMask, colorMask, colorMask );
			currentColorMask = colorMask;

		}

	};

	function setMaterial( gl, material, frontFaceCW ) {

		material.side === THREE.DoubleSide
			? glDisable( gl, gl.CULL_FACE )
			: glEnable( gl, gl.CULL_FACE );

		var flipSided = ( material.side === THREE.BackSide );
		if ( frontFaceCW ) flipSided = ! flipSided;

		setFlipSided( gl, flipSided );

		( material.blending === THREE.NormalBlending && material.transparent === false )
			? setBlending( gl, THREE.NoBlending )
			: setBlending( gl, material.blending, material.blendEquation, material.blendSrc, material.blendDst, material.blendEquationAlpha, material.blendSrcAlpha, material.blendDstAlpha, material.premultipliedAlpha );

		setDepthFunc( gl, material.depthFunc );
		setDepthTest( gl, material.depthTest );
		setDepthMask( gl, material.depthWrite );
		setColorMask( gl, material.colorWrite );

	}
	
	function enableAttribute( gl, attribute ) {

		enableAttributeAndDivisor( gl, attribute, 0 );

	}

	function enableAttributeAndDivisor( gl, attribute, meshPerAttribute ) {

		newAttributes[ attribute ] = 1;

		if ( enabledAttributes[ attribute ] === 0 ) {

			gl.enableVertexAttribArray( attribute );
			enabledAttributes[ attribute ] = 1;

		}

		if ( attributeDivisors[ attribute ] !== meshPerAttribute ) {

			var extension = isWebGl2( gl ) ? gl : extensions.get( 'ANGLE_instanced_arrays' );

			extension[ isWebGl2( gl ) ? 'vertexAttribDivisor' : 'vertexAttribDivisorANGLE' ]( attribute, meshPerAttribute );
			attributeDivisors[ attribute ] = meshPerAttribute;

		}

	}

	function disableUnusedAttributes( gl ) {

		for ( var i = 0, l = enabledAttributes.length; i !== l; ++ i ) {

			if ( enabledAttributes[ i ] !== newAttributes[ i ] ) {

				gl.disableVertexAttribArray( i );
				enabledAttributes[ i ] = 0;

			}

		}

	}

	function setupVertexAttributes( material, program, geometry ) {

		if ( geometry && geometry.isInstancedBufferGeometry && ! capabilities.isWebGL2 ) {

			if ( extensions.get( 'ANGLE_instanced_arrays' ) === null ) {

				console.error( 'THREE.WebGLRenderer.setupVertexAttributes: using THREE.InstancedBufferGeometry but hardware does not support extension ANGLE_instanced_arrays.' );
				return;

			}

		}
		
		// init attributes;
		{
			for ( var i = 0, l = newAttributes.length; i < l; i ++ ) {

				newAttributes[ i ] = 0;

			}
		}

		var geometryAttributes = geometry.attributes;

		var programAttributes = program.getAttributes();

		var materialDefaultAttributeValues = material.defaultAttributeValues;

		for ( var name in programAttributes ) {

			var programAttribute = programAttributes[ name ];

			if ( programAttribute >= 0 ) {

				var geometryAttribute = geometryAttributes[ name ];

				if ( geometryAttribute !== undefined ) {

					var normalized = geometryAttribute.normalized;
					var size = geometryAttribute.itemSize;

					var attribute = getAttributeBuffer( geometryAttribute );

					// TODO Attribute may not be available on context restore

					if ( attribute === undefined ) continue;

					var buffer = attribute.buffer;
					var type = attribute.type;
					var bytesPerElement = attribute.bytesPerElement;

					enableAttribute( _gl, programAttribute );

					_gl.bindBuffer( _gl.ARRAY_BUFFER, buffer );
					_gl.vertexAttribPointer( programAttribute, size, type, normalized, 0, 0 );

				} else if ( materialDefaultAttributeValues !== undefined ) {

					var value = materialDefaultAttributeValues[ name ];

					if ( value !== undefined ) {

						switch ( value.length ) {

							case 2:
								_gl.vertexAttrib2fv( programAttribute, value );
								break;

							case 3:
								_gl.vertexAttrib3fv( programAttribute, value );
								break;

							case 4:
								_gl.vertexAttrib4fv( programAttribute, value );
								break;

							default:
								_gl.vertexAttrib1fv( programAttribute, value );

						}

					}

				}

			}

		}

		disableUnusedAttributes( _gl );

	}

	// Animation Loop

	var onAnimationFrameCallback = null;

	function onAnimationFrame( time ) {

		if ( vr.isPresenting() ) return;
		if ( onAnimationFrameCallback ) onAnimationFrameCallback( time );

	}

	// Rendering

	this.render = function ( scene, camera ) {

		var renderTarget, forceClear;

		if ( arguments[ 2 ] !== undefined ) {

			console.warn( 'THREE.WebGLRenderer.render(): the renderTarget argument has been removed. Use .setRenderTarget() instead.' );
			renderTarget = arguments[ 2 ];

		}

		if ( arguments[ 3 ] !== undefined ) {

			console.warn( 'THREE.WebGLRenderer.render(): the forceClear argument has been removed. Use .clear() instead.' );
			forceClear = arguments[ 3 ];

		}

		if ( ! ( camera && camera.isCamera ) ) {

			console.error( 'THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.' );
			return;

		}

		// reset caching for this frame

		_currentGeometryProgram.geometry = null;
		_currentGeometryProgram.program = null;
		_currentGeometryProgram.wireframe = false;
		_currentMaterialId = - 1;
		_currentCamera = null;

		// update scene graph

		if ( scene.autoUpdate === true ) scene.updateMatrixWorld();

		// update camera matrices and frustum

		if ( camera.parent === null ) camera.updateMatrixWorld();

		//

		lightsArray.length = 0;
		shadowsArray.length = 0;

		renderItemsIndex = 0;

		opaqueObjects.length = 0;
		transparentObjects.length = 0;

		scene.onBeforeRender( _this, scene, camera, renderTarget || _currentRenderTarget );

		_projScreenMatrix.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );
		_frustum.setFromMatrix( _projScreenMatrix );

		projectObject( scene, camera, 0, _this.sortObjects );

		if ( _this.sortObjects === true ) {

			sortRenderList();

		}

		//

		//shadowMap.render( shadowsArray, scene, camera );

		setupLights( lightsArray, shadowsArray, camera );

		//

		if ( renderTarget !== undefined ) {

			this.setRenderTarget( renderTarget );

		}

		//

		// render scene

		// opaque pass (front-to-back order)

		if ( opaqueObjects.length ) renderObjects( opaqueObjects, scene, camera );

		// transparent pass (back-to-front order)

		if ( transparentObjects.length ) renderObjects( transparentObjects, scene, camera );

		//

		scene.onAfterRender( _this, scene, camera );

		//

		if ( _currentRenderTarget !== null ) {

			// Generate mipmap if we're using any kind of mipmap filtering

			textures.updateRenderTargetMipmap( _currentRenderTarget );

			// resolve multisample renderbuffers to a single-sample texture if necessary

			textures.updateMultisampleRenderTarget( _currentRenderTarget );

		}

		// Ensure depth buffer writing is enabled so it can be cleared on next render

		setDepthTest( _gl, true );
		setDepthMask( _gl, true );
		setColorMask( _gl, true );

		// _gl.finish();

		currentRenderList = null;
		currentRenderState = null;

	};

	function getObjectProperties( object ) {

		var map = objectPropertiesMap.get( object );

		if ( map === undefined ) {

			map = {};
			objectPropertiesMap.set( object, map );

		}

		return map;

	}

	function getNextRenderItem( object, geometry, material, groupOrder, z, group ) {

		var defaultProgram = { id: - 1 };
		var renderItem = renderItems[ renderItemsIndex ];

		if ( renderItem === undefined ) {

			renderItem = {
				id: object.id,
				object: object,
				geometry: geometry,
				material: material,
				program: material.program || defaultProgram,
				groupOrder: groupOrder,
				renderOrder: object.renderOrder,
				z: z,
				group: group
			};

			renderItems[ renderItemsIndex ] = renderItem;

		} else {

			renderItem.id = object.id;
			renderItem.object = object;
			renderItem.geometry = geometry;
			renderItem.material = material;
			renderItem.program = material.program || defaultProgram;
			renderItem.groupOrder = groupOrder;
			renderItem.renderOrder = object.renderOrder;
			renderItem.z = z;
			renderItem.group = group;

		}

		renderItemsIndex ++;

		return renderItem;

	}

	function pushToRenderList( object, geometry, material, groupOrder, z, group ) {

		var renderItem = getNextRenderItem( object, geometry, material, groupOrder, z, group );

		( material.transparent === true ? transparentObjects : opaqueObjects ).push( renderItem );

	}

	function painterSortStable( a, b ) {

		if ( a.groupOrder !== b.groupOrder ) {
	
			return a.groupOrder - b.groupOrder;
	
		} else if ( a.renderOrder !== b.renderOrder ) {
	
			return a.renderOrder - b.renderOrder;
	
		} else if ( a.program !== b.program ) {
	
			return a.program.id - b.program.id;
	
		} else if ( a.material.id !== b.material.id ) {
	
			return a.material.id - b.material.id;
	
		} else if ( a.z !== b.z ) {
	
			return a.z - b.z;
	
		} else {
	
			return a.id - b.id;
	
		}
	
	}

	function reversePainterSortStable( a, b ) {

		if ( a.groupOrder !== b.groupOrder ) {
	
			return a.groupOrder - b.groupOrder;
	
		} else if ( a.renderOrder !== b.renderOrder ) {
	
			return a.renderOrder - b.renderOrder;
	
		} else if ( a.z !== b.z ) {
	
			return b.z - a.z;
	
		} else {
	
			return a.id - b.id;
	
		}
	
	}

	function sortRenderList() {

		if ( opaqueObjects.length > 1 ) opaqueObjects.sort( painterSortStable );
		if ( transparentObjects.length > 1 ) transparentObjects.sort( reversePainterSortStable );

	}

	function getBufferGeometry( object, geometry ) {

		var buffergeometry = bufferGeometries[ geometry.id ];

		if ( buffergeometry ) return buffergeometry;

		//geometry.addEventListener( 'dispose', onGeometryDispose );

		if ( geometry.isBufferGeometry ) {

			buffergeometry = geometry;

		} else if ( geometry.isGeometry ) {

			if ( geometry._bufferGeometry === undefined ) {

				geometry._bufferGeometry = new THREE.BufferGeometry().setFromObject( object );

			}

			buffergeometry = geometry._bufferGeometry;

		}

		bufferGeometries[ geometry.id ] = buffergeometry;

		memoryInfo.geometries++;

		return buffergeometry;

	}

	function createAttributeBuffer( attribute, bufferType ) {

		var array = attribute.array;
		var usage = attribute.dynamic ? _gl.DYNAMIC_DRAW : _gl.STATIC_DRAW;

		var buffer = _gl.createBuffer();

		_gl.bindBuffer( bufferType, buffer );
		_gl.bufferData( bufferType, array, usage );

		attribute.onUploadCallback();

		var type = _gl.FLOAT;

		if ( array instanceof Float32Array ) {

			type = _gl.FLOAT;

		} else if ( array instanceof Float64Array ) {

			console.warn( 'THREE.WebGLAttributes: Unsupported data buffer format: Float64Array.' );

		} else if ( array instanceof Uint16Array ) {

			type = _gl.UNSIGNED_SHORT;

		} else if ( array instanceof Int16Array ) {

			type = _gl.SHORT;

		} else if ( array instanceof Uint32Array ) {

			type = _gl.UNSIGNED_INT;

		} else if ( array instanceof Int32Array ) {

			type = _gl.INT;

		} else if ( array instanceof Int8Array ) {

			type = _gl.BYTE;

		} else if ( array instanceof Uint8Array ) {

			type = _gl.UNSIGNED_BYTE;

		}

		return {
			buffer: buffer,
			type: type,
			bytesPerElement: array.BYTES_PER_ELEMENT,
			version: attribute.version
		};

	}

	function updateGlAttributeBuffer( buffer, attribute, bufferType ) {

		var array = attribute.array;
		var updateRange = attribute.updateRange;

		_gl.bindBuffer( bufferType, buffer );

		if ( attribute.dynamic === false ) {

			_gl.bufferData( bufferType, array, gl.STATIC_DRAW );

		} else if ( updateRange.count === - 1 ) {

			// Not using update ranges

			_gl.bufferSubData( bufferType, 0, array );

		} else if ( updateRange.count === 0 ) {

			console.error( 'THREE.WebGLObjects.updateBuffer: dynamic THREE.BufferAttribute marked as needsUpdate but updateRange.count is 0, ensure you are using set methods or updating manually.' );

		} else {

			_gl.bufferSubData( bufferType, updateRange.offset * array.BYTES_PER_ELEMENT,
				array.subarray( updateRange.offset, updateRange.offset + updateRange.count ) );

			updateRange.count = - 1; // reset range

		}

	}

	function getAttributeBuffer ( attribute ) {

		if ( attribute.isInterleavedBufferAttribute ) attribute = attribute.data;

		return attributeBuffers.get( attribute );

	}

	function updateGlAttribute( attribute, bufferType ) {

		if ( attribute.isInterleavedBufferAttribute ) attribute = attribute.data;

		var data = getAttributeBuffer( attribute );

		if ( data === undefined ) {

			attributeBuffers.set( attribute, createAttributeBuffer( attribute, bufferType ) );

		} else if ( data.version < attribute.version ) {

			updateGlAttributeBuffer( data.buffer, attribute, bufferType );

			data.version = attribute.version;

		}

	}

	function updateBufferGeometry( geometry ) {

		var index = geometry.index;
		var geometryAttributes = geometry.attributes;

		if ( index !== null ) {

			updateGlAttribute( index, _gl.ELEMENT_ARRAY_BUFFER );

		}

		for ( var name in geometryAttributes ) {

			updateGlAttribute( geometryAttributes[ name ], _gl.ARRAY_BUFFER );

		}

	}

	function updateObject( object ) {

		var frame = renderInfo.frame;

		var geometry = object.geometry;
		var buffergeometry = getBufferGeometry( object, geometry );

		// Update once per frame

		if ( geometryUpdateList[ buffergeometry.id ] !== frame ) {

			if ( geometry.isGeometry ) {

				buffergeometry.updateFromObject( object );

			}

			updateBufferGeometry( buffergeometry );

			geometryUpdateList[ buffergeometry.id ] = frame;

		}

		return buffergeometry;

	}

	function projectObject( object, camera, groupOrder, sortObjects ) {

		if ( object.visible === false ) return;

		var visible = object.layers.test( camera.layers );

		if ( visible ) {

			if ( object.isGroup ) {

				groupOrder = object.renderOrder;

			} else if ( object.isLight ) {

				lightsArray.push( object );


				if ( object.castShadow ) {

					shadowsArray.push( object );

				}

			} else if ( object.isMesh || object.isLine || object.isPoints ) {

				if ( ! object.frustumCulled || _frustum.intersectsObject( object ) ) {

					if ( sortObjects ) {

						_vector3.setFromMatrixPosition( object.matrixWorld )
							.applyMatrix4( _projScreenMatrix );

					}

					var geometry = updateObject( object );
					var material = object.material;

					if ( Array.isArray( material ) ) {

						var groups = geometry.groups;

						for ( var i = 0, l = groups.length; i < l; i ++ ) {

							var group = groups[ i ];
							var groupMaterial = material[ group.materialIndex ];

							if ( groupMaterial && groupMaterial.visible ) {

								pushToRenderList( object, geometry, groupMaterial, groupOrder, _vector3.z, group );

							}

						}

					} else if ( material.visible ) {

						pushToRenderList( object, geometry, material, groupOrder, _vector3.z, null );

					}

				}

			}

		}

		var children = object.children;

		for ( var i = 0, l = children.length; i < l; i ++ ) {

			projectObject( children[ i ], camera, groupOrder, sortObjects );

		}

	}

	function renderObjects( renderList, scene, camera, overrideMaterial ) {

		for ( var i = 0, l = renderList.length; i < l; i ++ ) {

			var renderItem = renderList[ i ];

			var object = renderItem.object;
			var geometry = renderItem.geometry;
			var material = overrideMaterial === undefined ? renderItem.material : overrideMaterial;
			var group = renderItem.group;

			renderObject( object, scene, camera, geometry, material, group );

		}

	}

	function renderObject( object, scene, camera, geometry, material, group ) {

		//object.onBeforeRender( _this, scene, camera, geometry, material, group );

		object.modelViewMatrix.multiplyMatrices( camera.matrixWorldInverse, object.matrixWorld );
		object.normalMatrix.getNormalMatrix( object.modelViewMatrix );

		_this.renderBufferDirect( camera, geometry, material, object, group );

		//object.onAfterRender( _this, scene, camera, geometry, material, group );

	}

	function getTextureEncodingFromMap( map ) {

		var encoding;

		if ( ! map ) {

			encoding = THREE.LinearEncoding;

		} else if ( map.isTexture ) {

			encoding = map.encoding;

		} else if ( map.isWebGLRenderTarget ) {

			console.warn( "THREE.WebGLPrograms.getTextureEncodingFromMap: don't use render targets as textures. Use their .texture property instead." );
			encoding = map.texture.encoding;

		}

		return encoding;

	}

	function getMaxPrecision( gl, precision ) {

		if ( precision === 'highp' ) {

			if ( gl.getShaderPrecisionFormat( gl.VERTEX_SHADER, gl.HIGH_FLOAT ).precision > 0 &&
			     gl.getShaderPrecisionFormat( gl.FRAGMENT_SHADER, gl.HIGH_FLOAT ).precision > 0 ) {

				return 'highp';

			}

			precision = 'mediump';

		}

		if ( precision === 'mediump' ) {

			if ( gl.getShaderPrecisionFormat( gl.VERTEX_SHADER, gl.MEDIUM_FLOAT ).precision > 0 &&
			     gl.getShaderPrecisionFormat( gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT ).precision > 0 ) {

				return 'mediump';

			}

		}

		return 'lowp';

	}

	function getProgramParameters( gl, material, shadows, object ) {

		var shaderID = shaderIDs[ material.type ];

		// heuristics to create shader parameters according to lights in the scene
		// (not to blow over maxLights budget)

		var precision = 'highp';

		if ( material.precision !== null ) {

			precision = getMaxPrecision( gl, material.precision );

			if ( precision !== material.precision ) {

				console.warn( 'THREE.WebGLProgram.getParameters:', material.precision, 'not supported, using', precision, 'instead.' );

			}

		}

		var currentRenderTarget = getRenderTarget();

		var parameters = {

			shaderID: shaderID,

			precision: precision,
			outputEncoding: getTextureEncodingFromMap( ( ! currentRenderTarget ) ? null : currentRenderTarget.texture ),
			map: !! material.map,
			mapEncoding: getTextureEncodingFromMap( material.map ),
			matcap: !! material.matcap,
			matcapEncoding: getTextureEncodingFromMap( material.matcap ),
			envMap: !! material.envMap,
			envMapMode: material.envMap && material.envMap.mapping,
			envMapEncoding: getTextureEncodingFromMap( material.envMap ),
			envMapCubeUV: ( !! material.envMap ) && ( ( material.envMap.mapping === THREE.CubeUVReflectionMapping ) || ( material.envMap.mapping === THREE.CubeUVRefractionMapping ) ),
			lightMap: !! material.lightMap,
			aoMap: !! material.aoMap,
			emissiveMap: !! material.emissiveMap,
			emissiveMapEncoding: getTextureEncodingFromMap( material.emissiveMap ),
			bumpMap: !! material.bumpMap,
			normalMap: !! material.normalMap,
			objectSpaceNormalMap: material.normalMapType === THREE.ObjectSpaceNormalMap,
			displacementMap: !! material.displacementMap,
			roughnessMap: !! material.roughnessMap,
			metalnessMap: !! material.metalnessMap,
			specularMap: !! material.specularMap,
			alphaMap: !! material.alphaMap,

			gradientMap: !! material.gradientMap,

			combine: material.combine,

			vertexTangents: ( material.normalMap && material.vertexTangents ),
			vertexColors: material.vertexColors,

			flatShading: material.flatShading,

			sizeAttenuation: material.sizeAttenuation,

			numDirLights: lightsState.directional.length,
			numPointLights: lightsState.point.length,
			numSpotLights: lightsState.spot.length,

			dithering: material.dithering,

			//shadowMapEnabled: renderer.shadowMap.enabled && object.receiveShadow && shadows.length > 0,
			//shadowMapType: renderer.shadowMap.type,

			premultipliedAlpha: material.premultipliedAlpha,

			alphaTest: material.alphaTest,
			doubleSided: material.side === THREE.DoubleSide,
			flipSided: material.side === THREE.BackSide,

			depthPacking: ( material.depthPacking !== undefined ) ? material.depthPacking : false

		};

		return parameters;

	};

	function initMaterial( gl, material, object ) {

		var materialProperties = getObjectProperties( material );

		var lightsHash = materialProperties.lightsHash;
		var lightsStateHash = lightsState.hash;

		var parameters = getProgramParameters( gl, material, shadowsArray, object );

		//var code = programCache.getProgramCode( material, parameters );

		var program = materialProperties.program;
		var programChange = true;

		if ( program === undefined ) {

			// new material
			material.addEventListener( 'dispose', onMaterialDispose );

		//} else if ( program.code !== code ) {

			// changed glsl or parameters
		//	releaseMaterialProgramReference( material );

		} else if ( lightsHash.stateID !== lightsStateHash.stateID ||
			lightsHash.directionalLength !== lightsStateHash.directionalLength ||
			lightsHash.pointLength !== lightsStateHash.pointLength ||
			lightsHash.spotLength !== lightsStateHash.spotLength ||
			lightsHash.shadowsLength !== lightsStateHash.shadowsLength ) {

			lightsHash.stateID = lightsStateHash.stateID;
			lightsHash.directionalLength = lightsStateHash.directionalLength;
			lightsHash.pointLength = lightsStateHash.pointLength;
			lightsHash.spotLength = lightsStateHash.spotLength;
			lightsHash.shadowsLength = lightsStateHash.shadowsLength;

			programChange = false;

		} else if ( parameters.shaderID !== undefined ) {

			// same glsl and uniform list
			return;

		} else {

			// only rebuild uniform list
			programChange = false;

		}

		if ( programChange ) {

			materialProperties.shader = {
				name: material.type,
				uniforms: material.uniforms,
				vertexShader: material.vertexShader,
				fragmentShader: material.fragmentShader
			};

			material.onBeforeCompile( materialProperties.shader, _this );

			// Computing code again as onBeforeCompile may have changed the shaders
			//code = programCache.getProgramCode( material, parameters );

			//program = programCache.acquireProgram( material, materialProperties.shader, parameters, code );
			program = new WebGLProgram( _this, material, materialProperties.shader, parameters, capabilities, textures );

			materialProperties.program = program;
			material.program = program;

		}

		var uniforms = materialProperties.shader.uniforms;

		// store the light setup it was created for
		if ( lightsHash === undefined ) {

			materialProperties.lightsHash = lightsHash = {};

		}

		lightsHash.stateID = lightsStateHash.stateID;
		lightsHash.directionalLength = lightsStateHash.directionalLength;
		lightsHash.pointLength = lightsStateHash.pointLength;
		lightsHash.spotLength = lightsStateHash.spotLength;
		lightsHash.rectAreaLength = lightsStateHash.rectAreaLength;
		lightsHash.hemiLength = lightsStateHash.hemiLength;
		lightsHash.shadowsLength = lightsStateHash.shadowsLength;

		if ( material.lights ) {

			// wire up the material to this renderer's lighting state

			uniforms.ambientLightColor.value = lightsState.ambient;
			uniforms.directionalLights.value = lightsState.directional;
			uniforms.spotLights.value = lightsState.spot;
			uniforms.pointLights.value = lightsState.point;

			uniforms.directionalShadowMap.value = lightsState.directionalShadowMap;
			uniforms.directionalShadowMatrix.value = lightsState.directionalShadowMatrix;
			uniforms.spotShadowMap.value = lightsState.spotShadowMap;
			uniforms.spotShadowMatrix.value = lightsState.spotShadowMatrix;
			uniforms.pointShadowMap.value = lightsState.pointShadowMap;
			uniforms.pointShadowMatrix.value = lightsState.pointShadowMatrix;
			// TODO (abelnation): add area lights shadow info to uniforms

		}

		var progUniforms = materialProperties.program.getUniforms(),
			uniformsList =
				WebGLUniforms.seqWithValue( progUniforms.seq, uniforms );

		materialProperties.uniformsList = uniformsList;

	}

	function useProgram( gl, program ) {

		if ( currentProgram !== program ) {

			gl.useProgram( program );

			currentProgram = program;

			return true;

		}

		return false;

	}

	function setProgram( gl, camera, material, object ) {

		//textures.resetTextureUnits();

		var materialProperties = getObjectProperties( material );

		if ( material.needsUpdate ) {

			initMaterial( gl, material, object );
			material.needsUpdate = false;

		}

		var refreshProgram = false;
		var refreshMaterial = false;
		var refreshLights = false;

		var program = materialProperties.program;
		var p_uniforms = program.getUniforms();
		var m_uniforms = materialProperties.shader.uniforms;

		if ( useProgram( gl, program.program ) ) {

			refreshProgram = true;
			refreshMaterial = true;
			refreshLights = true;

		}

		if ( material.id !== _currentMaterialId ) {

			_currentMaterialId = material.id;

			refreshMaterial = true;

		}

		if ( refreshProgram || _currentCamera !== camera ) {

			p_uniforms.setValue( _gl, 'projectionMatrix', camera.projectionMatrix );

			if ( _currentCamera !== camera ) {

				_currentCamera = camera;

				// lighting uniforms depend on the camera so enforce an update
				// now, in case this material supports lights - or later, when
				// the next material that does gets activated:

				refreshMaterial = true;		// set to true on material change
				refreshLights = true;		// remains set until update done

			}

			// load material specific uniforms
			// (shader material also gets them for the sake of genericity)

			if ( material.isShaderMaterial ||
				material.isMeshPhongMaterial ||
				material.isMeshStandardMaterial ||
				material.envMap ) {

				var uCamPos = p_uniforms.map.cameraPosition;

				if ( uCamPos !== undefined ) {

					uCamPos.setValue( _gl,
						_vector3.setFromMatrixPosition( camera.matrixWorld ) );

				}

			}

			if ( material.isMeshPhongMaterial ||
				material.isMeshLambertMaterial ||
				material.isMeshBasicMaterial ||
				material.isMeshStandardMaterial ||
				material.isShaderMaterial ||
				material.skinning ) {

				p_uniforms.setValue( _gl, 'viewMatrix', camera.matrixWorldInverse );

			}

		}

		if ( refreshMaterial ) {

			p_uniforms.setValue( _gl, 'toneMappingExposure', _this.toneMappingExposure );
			p_uniforms.setValue( _gl, 'toneMappingWhitePoint', _this.toneMappingWhitePoint );

			if ( material.lights ) {

				// the current material requires lighting info

				// note: all lighting uniforms are always set correctly
				// they simply reference the renderer's state for their
				// values
				//
				// use the current material's .needsUpdate flags to set
				// the GL state when required

				markUniformsLightsNeedsUpdate( m_uniforms, refreshLights );

			}

			// refresh uniforms common to several materials

			if ( typeof material.refreshFunction !== 'undefined' )
			{
				material.refreshFunction( m_uniforms, material );
			}

			WebGLUniforms.upload( _gl, materialProperties.uniformsList, m_uniforms, textures );

		}

		if ( material.isShaderMaterial && material.uniformsNeedUpdate === true ) {

			WebGLUniforms.upload( _gl, materialProperties.uniformsList, m_uniforms, textures );
			material.uniformsNeedUpdate = false;

		}

		// common matrices

		p_uniforms.setValue( _gl, 'modelViewMatrix', object.modelViewMatrix );
		p_uniforms.setValue( _gl, 'normalMatrix', object.normalMatrix );
		p_uniforms.setValue( _gl, 'modelMatrix', object.matrixWorld );

		return program;

	}

	// If uniforms are marked as clean, they don't need to be loaded to the GPU.

	function markUniformsLightsNeedsUpdate( uniforms, value ) {

		uniforms.ambientLightColor.needsUpdate = value;

		uniforms.directionalLights.needsUpdate = value;
		uniforms.pointLights.needsUpdate = value;
		uniforms.spotLights.needsUpdate = value;

	}

	//

	this.setFramebuffer = function ( value ) {

		_framebuffer = value;

	};

	function getRenderTarget () {

		return _currentRenderTarget;

	};

	this.setRenderTarget = function ( renderTarget, activeCubeFace, activeMipMapLevel ) {

		_currentRenderTarget = renderTarget;

		if ( renderTarget && properties.get( renderTarget ).__webglFramebuffer === undefined ) {

			textures.setupRenderTarget( renderTarget );

		}

		var framebuffer = _framebuffer;
		var isCube = false;

		if ( renderTarget ) {

			var __webglFramebuffer = properties.get( renderTarget ).__webglFramebuffer;

			if ( renderTarget.isWebGLRenderTargetCube ) {

				framebuffer = __webglFramebuffer[ activeCubeFace || 0 ];
				isCube = true;

			} else if ( renderTarget.isWebGLMultisampleRenderTarget ) {

				framebuffer = properties.get( renderTarget ).__webglMultisampledFramebuffer;

			} else {

				framebuffer = __webglFramebuffer;

			}

			_currentViewport.copy( renderTarget.viewport );
			_currentScissor.copy( renderTarget.scissor );
			_currentScissorTest = renderTarget.scissorTest;

		} else {

			_currentViewport.copy( _viewport ).multiplyScalar( _pixelRatio );
			_currentScissor.copy( _scissor ).multiplyScalar( _pixelRatio );
			_currentScissorTest = _scissorTest;

		}

		if ( _currentFramebuffer !== framebuffer ) {

			_gl.bindFramebuffer( _gl.FRAMEBUFFER, framebuffer );
			_currentFramebuffer = framebuffer;

		}

		state.viewport( _currentViewport );
		state.scissor( _currentScissor );
		state.setScissorTest( _currentScissorTest );

		if ( isCube ) {

			var textureProperties = properties.get( renderTarget.texture );
			_gl.framebufferTexture2D( _gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_CUBE_MAP_POSITIVE_X + ( activeCubeFace || 0 ), textureProperties.__webglTexture, activeMipMapLevel || 0 );

		}

	};

	this.readRenderTargetPixels = function ( renderTarget, x, y, width, height, buffer ) {

		if ( ! ( renderTarget && renderTarget.isWebGLRenderTarget ) ) {

			console.error( 'THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.' );
			return;

		}

		var framebuffer = properties.get( renderTarget ).__webglFramebuffer;

		if ( framebuffer ) {

			var restore = false;

			if ( framebuffer !== _currentFramebuffer ) {

				_gl.bindFramebuffer( _gl.FRAMEBUFFER, framebuffer );

				restore = true;

			}

			try {

				var texture = renderTarget.texture;
				var textureFormat = texture.format;
				var textureType = texture.type;

				if ( textureFormat !== RGBAFormat && utils.convert( textureFormat ) !== _gl.getParameter( _gl.IMPLEMENTATION_COLOR_READ_FORMAT ) ) {

					console.error( 'THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.' );
					return;

				}

				if ( textureType !== UnsignedByteType && utils.convert( textureType ) !== _gl.getParameter( _gl.IMPLEMENTATION_COLOR_READ_TYPE ) && // IE11, Edge and Chrome Mac < 52 (#9513)
					! ( textureType === FloatType && ( capabilities.isWebGL2 || extensions.get( 'OES_texture_float' ) || extensions.get( 'WEBGL_color_buffer_float' ) ) ) && // Chrome Mac >= 52 and Firefox
					! ( textureType === HalfFloatType && ( capabilities.isWebGL2 ? extensions.get( 'EXT_color_buffer_float' ) : extensions.get( 'EXT_color_buffer_half_float' ) ) ) ) {

					console.error( 'THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.' );
					return;

				}

				if ( _gl.checkFramebufferStatus( _gl.FRAMEBUFFER ) === _gl.FRAMEBUFFER_COMPLETE ) {

					// the following if statement ensures valid read requests (no out-of-bounds pixels, see #8604)

					if ( ( x >= 0 && x <= ( renderTarget.width - width ) ) && ( y >= 0 && y <= ( renderTarget.height - height ) ) ) {

						_gl.readPixels( x, y, width, height, utils.convert( textureFormat ), utils.convert( textureType ), buffer );

					}

				} else {

					console.error( 'THREE.WebGLRenderer.readRenderTargetPixels: readPixels from renderTarget failed. Framebuffer not complete.' );

				}

			} finally {

				if ( restore ) {

					_gl.bindFramebuffer( _gl.FRAMEBUFFER, _currentFramebuffer );

				}

			}

		}

	};

	this.copyFramebufferToTexture = function ( position, texture, level ) {

		var width = texture.image.width;
		var height = texture.image.height;
		var glFormat = utils.convert( texture.format );

		textures.setTexture2D( texture, 0 );

		_gl.copyTexImage2D( _gl.TEXTURE_2D, level || 0, glFormat, position.x, position.y, width, height, 0 );

	};

	this.copyTextureToTexture = function ( position, srcTexture, dstTexture, level ) {

		var width = srcTexture.image.width;
		var height = srcTexture.image.height;
		var glFormat = utils.convert( dstTexture.format );
		var glType = utils.convert( dstTexture.type );

		textures.setTexture2D( dstTexture, 0 );

		if ( srcTexture.isDataTexture ) {

			_gl.texSubImage2D( _gl.TEXTURE_2D, level || 0, position.x, position.y, width, height, glFormat, glType, srcTexture.image.data );

		} else {

			_gl.texSubImage2D( _gl.TEXTURE_2D, level || 0, position.x, position.y, glFormat, glType, srcTexture.image );

		}

	};

}
