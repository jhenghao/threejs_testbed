'use strict';

function addLineNumbers( string ) {

	var lines = string.split( '\n' );

	for ( var i = 0; i < lines.length; i ++ ) {

		lines[ i ] = ( i + 1 ) + ': ' + lines[ i ];

	}

	return lines.join( '\n' );

}

function generateDefines( defines ) {

	var chunks = [];

	for ( var name in defines ) {

		var value = defines[ name ];

		if ( value === false ) continue;

		chunks.push( '#define ' + name + ' ' + value );

	}

	return chunks.join( '\n' );

}

function fetchAttributeLocations( gl, program ) {

	var attributes = {};

	var n = gl.getProgramParameter( program, gl.ACTIVE_ATTRIBUTES );

	for ( var i = 0; i < n; i ++ ) {

		var info = gl.getActiveAttrib( program, i );
		var name = info.name;

		// console.log( 'THREE.WebGLProgram: ACTIVE VERTEX ATTRIBUTE:', name, i );

		attributes[ name ] = gl.getAttribLocation( program, name );

	}

	return attributes;

}

function replaceLightNums( string, parameters ) {

	return string
		.replace( /NUM_DIR_LIGHTS/g, parameters.numDirLights )
		.replace( /NUM_SPOT_LIGHTS/g, parameters.numSpotLights )
		.replace( /NUM_RECT_AREA_LIGHTS/g, parameters.numRectAreaLights )
		.replace( /NUM_POINT_LIGHTS/g, parameters.numPointLights )
		.replace( /NUM_HEMI_LIGHTS/g, parameters.numHemiLights );

}

function unrollLoops( string ) {

	var pattern = /#pragma unroll_loop[\s]+?for \( int i \= (\d+)\; i < (\d+)\; i \+\+ \) \{([\s\S]+?)(?=\})\}/g;

	function replace( match, start, end, snippet ) {

		var unroll = '';

		for ( var i = parseInt( start ); i < parseInt( end ); i ++ ) {

			unroll += snippet.replace( /\[ i \]/g, '[ ' + i + ' ]' );

		}

		return unroll;

	}

	return string.replace( pattern, replace );

}

function compileShader( gl, type, string ) {

	var shader = gl.createShader( type );

	gl.shaderSource( shader, string );
	gl.compileShader( shader );

	if ( gl.getShaderParameter( shader, gl.COMPILE_STATUS ) === false ) {

		console.error( 'THREE.WebGLShader: Shader couldn\'t compile.' );

	}

	if ( gl.getShaderInfoLog( shader ) !== '' ) {

		console.warn( 'THREE.WebGLShader: gl.getShaderInfoLog()', type === gl.VERTEX_SHADER ? 'vertex' : 'fragment', gl.getShaderInfoLog( shader ), addLineNumbers( string ) );

	}

	// --enable-privileged-webgl-extension
	// console.log( type, gl.getExtension( 'WEBGL_debug_shaders' ).getTranslatedShaderSource( shader ) );

	return shader;

}

function WebGLProgram( renderer, material, shader, parameters, capabilities, textures ) {

	var gl = renderer.context;

	var defines = material.defines;

	var vertexShader = shader.vertexShader;
	var fragmentShader = shader.fragmentShader;

	var customDefines = generateDefines( defines );

	//

	var program = gl.createProgram();

	var prefixVertex, prefixFragment;

	vertexShader = replaceLightNums( vertexShader, parameters );
	fragmentShader = replaceLightNums( fragmentShader, parameters );

	vertexShader = unrollLoops( vertexShader );
	fragmentShader = unrollLoops( fragmentShader );

	if ( isWebGl2() && ! material.isRawShaderMaterial ) {

		var isGLSL3ShaderMaterial = false;

		var versionRegex = /^\s*#version\s+300\s+es\s*\n/;

		if ( material.isShaderMaterial &&
			vertexShader.match( versionRegex ) !== null &&
			fragmentShader.match( versionRegex ) !== null ) {

			isGLSL3ShaderMaterial = true;

			vertexShader = vertexShader.replace( versionRegex, '' );
			fragmentShader = fragmentShader.replace( versionRegex, '' );

		}

		// GLSL 3.0 conversion
		prefixVertex = [
			'#version 300 es\n',
			'#define attribute in',
			'#define varying out',
			'#define texture2D texture'
		].join( '\n' ) + '\n' + prefixVertex;

		prefixFragment = [
			'#version 300 es\n',
			'#define varying in',
			isGLSL3ShaderMaterial ? '' : 'out highp vec4 pc_fragColor;',
			isGLSL3ShaderMaterial ? '' : '#define gl_FragColor pc_fragColor',
			'#define gl_FragDepthEXT gl_FragDepth',
			'#define texture2D texture',
			'#define textureCube texture',
			'#define texture2DProj textureProj',
			'#define texture2DLodEXT textureLod',
			'#define texture2DProjLodEXT textureProjLod',
			'#define textureCubeLodEXT textureLod',
			'#define texture2DGradEXT textureGrad',
			'#define texture2DProjGradEXT textureProjGrad',
			'#define textureCubeGradEXT textureGrad'
		].join( '\n' ) + '\n' + prefixFragment;

	}

	var vertexGlsl = vertexShader;
	var fragmentGlsl = fragmentShader;

	// console.log( '*VERTEX*', vertexGlsl );
	// console.log( '*FRAGMENT*', fragmentGlsl );

	var glVertexShader = compileShader( gl, gl.VERTEX_SHADER, vertexGlsl );
	var glFragmentShader = compileShader( gl, gl.FRAGMENT_SHADER, fragmentGlsl );

	gl.attachShader( program, glVertexShader );
	gl.attachShader( program, glFragmentShader );

	// Force a particular attribute to index 0.

	if ( material.index0AttributeName !== undefined ) {

		gl.bindAttribLocation( program, 0, material.index0AttributeName );

	} else if ( parameters.morphTargets === true ) {

		// programs with morphTargets displace position out of attribute 0
		gl.bindAttribLocation( program, 0, 'position' );

	}

	gl.linkProgram( program );

	var programLog = gl.getProgramInfoLog( program ).trim();
	var vertexLog = gl.getShaderInfoLog( glVertexShader ).trim();
	var fragmentLog = gl.getShaderInfoLog( glFragmentShader ).trim();

	var runnable = true;
	var haveDiagnostics = true;

	// console.log( '**VERTEX**', gl.getExtension( 'WEBGL_debug_shaders' ).getTranslatedShaderSource( glVertexShader ) );
	// console.log( '**FRAGMENT**', gl.getExtension( 'WEBGL_debug_shaders' ).getTranslatedShaderSource( glFragmentShader ) );

	if ( gl.getProgramParameter( program, gl.LINK_STATUS ) === false ) {

		runnable = false;

		console.error( 'THREE.WebGLProgram: shader error: ', gl.getError(), 'gl.VALIDATE_STATUS', gl.getProgramParameter( program, gl.VALIDATE_STATUS ), 'gl.getProgramInfoLog', programLog, vertexLog, fragmentLog );

	} else if ( programLog !== '' ) {

		console.warn( 'THREE.WebGLProgram: gl.getProgramInfoLog()', programLog );

	} else if ( vertexLog === '' || fragmentLog === '' ) {

		haveDiagnostics = false;

	}

	if ( haveDiagnostics ) {

		this.diagnostics = {

			runnable: runnable,
			material: material,

			programLog: programLog,

			vertexShader: {

				log: vertexLog,
				prefix: prefixVertex

			},

			fragmentShader: {

				log: fragmentLog,
				prefix: prefixFragment

			}

		};

	}

	// clean up

	gl.deleteShader( glVertexShader );
	gl.deleteShader( glFragmentShader );

	// set up caching for uniform locations

	var cachedUniforms;

	this.getUniforms = function () {

		if ( cachedUniforms === undefined ) {

			cachedUniforms = new WebGLUniforms( gl, program, textures );

		}

		return cachedUniforms;

	};

	// set up caching for attribute locations

	var cachedAttributes;

	this.getAttributes = function () {

		if ( cachedAttributes === undefined ) {

			cachedAttributes = fetchAttributeLocations( gl, program );

		}

		return cachedAttributes;

	};

	// free resource

	this.destroy = function () {

		gl.deleteProgram( program );
		this.program = undefined;

	};

	this.name = shader.name;
	this.id = programIdCount++;
	this.usedTimes = 1;
	this.program = program;
	this.vertexShader = glVertexShader;
	this.fragmentShader = glFragmentShader;

	return this;

}

function renderBufferImmediate ( object, program )
{
    state.initAttributes();

    var buffers = properties.get( object );

    if ( object.hasPositions && ! buffers.position ) buffers.position = _gl.createBuffer();
    if ( object.hasNormals && ! buffers.normal ) buffers.normal = _gl.createBuffer();
    if ( object.hasUvs && ! buffers.uv ) buffers.uv = _gl.createBuffer();
    if ( object.hasColors && ! buffers.color ) buffers.color = _gl.createBuffer();

    var programAttributes = program.getAttributes();

    if ( object.hasPositions ) {

        _gl.bindBuffer( _gl.ARRAY_BUFFER, buffers.position );
        _gl.bufferData( _gl.ARRAY_BUFFER, object.positionArray, _gl.DYNAMIC_DRAW );

        state.enableAttribute( programAttributes.position );
        _gl.vertexAttribPointer( programAttributes.position, 3, _gl.FLOAT, false, 0, 0 );

    }

    if ( object.hasNormals ) {

        _gl.bindBuffer( _gl.ARRAY_BUFFER, buffers.normal );
        _gl.bufferData( _gl.ARRAY_BUFFER, object.normalArray, _gl.DYNAMIC_DRAW );

        state.enableAttribute( programAttributes.normal );
        _gl.vertexAttribPointer( programAttributes.normal, 3, _gl.FLOAT, false, 0, 0 );

    }

    if ( object.hasUvs ) {

        _gl.bindBuffer( _gl.ARRAY_BUFFER, buffers.uv );
        _gl.bufferData( _gl.ARRAY_BUFFER, object.uvArray, _gl.DYNAMIC_DRAW );

        state.enableAttribute( programAttributes.uv );
        _gl.vertexAttribPointer( programAttributes.uv, 2, _gl.FLOAT, false, 0, 0 );

    }

    if ( object.hasColors ) {

        _gl.bindBuffer( _gl.ARRAY_BUFFER, buffers.color );
        _gl.bufferData( _gl.ARRAY_BUFFER, object.colorArray, _gl.DYNAMIC_DRAW );

        state.enableAttribute( programAttributes.color );
        _gl.vertexAttribPointer( programAttributes.color, 3, _gl.FLOAT, false, 0, 0 );

    }

    state.disableUnusedAttributes();

    _gl.drawArrays( _gl.TRIANGLES, 0, object.count );

    object.count = 0;

};