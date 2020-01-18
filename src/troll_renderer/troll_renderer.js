"use strict";

import { BasicUtilities } from './basic_utilities.js';
import { GlProgramUtilities } from './gl_program_utilities.js';
import { LightUtilities } from './light_utilities.js';
import { TextureUtilities } from './texture_utilities.js';

import { WebGLCapabilities } from '../../three.js/src/renderers/webgl/WebGLCapabilities.js';
import { WebGLExtensions } from '../../three.js/src/renderers/webgl/WebGLExtensions.js';
import { WebGLProperties } from '../../three.js/src/renderers/webgl/WebGLProperties.js';
import { WebGLRenderLists } from '../../three.js/src/renderers/webgl/WebGLRenderLists.js';
import { WebGLState } from '../../three.js/src/renderers/webgl/WebGLState.js';

function TrollRenderer(parameters) {

    parameters = parameters || {};

    let _this = this;
    let _canvas = parameters.canvas !== undefined ? parameters.canvas : document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
    let _context = parameters.context !== undefined ? parameters.context : null;
    let _gl;

    try {

        let contextAttributes = {
            alpha: parameters.alpha !== undefined ? parameters.alpha : false,
            depth: parameters.depth !== undefined ? parameters.depth : true,
            stencil: parameters.stencil !== undefined ? parameters.stencil : true,
            antialias: parameters.antialias !== undefined ? parameters.antialias : false,
            premultipliedAlpha: parameters.premultipliedAlpha !== undefined ? parameters.premultipliedAlpha : true,
            preserveDrawingBuffer: parameters.preserveDrawingBuffer !== undefined ? parameters.preserveDrawingBuffer : false,
            powerPreference: parameters.powerPreference !== undefined ? parameters.powerPreference : 'default',
            failIfMajorPerformanceCaveat: parameters.failIfMajorPerformanceCaveat !== undefined ? parameters.failIfMajorPerformanceCaveat : false,
            xrCompatible: true
        };

        _gl = _context || _canvas.getContext('webgl', contextAttributes) || _canvas.getContext('experimental-webgl', contextAttributes);

        if (_gl === null) {

            if (_canvas.getContext('webgl') !== null) {

                throw new Error('Error creating WebGL context with your selected attributes.');

            } else {

                throw new Error('Error creating WebGL context.');

            }
        }
    }
    catch (error) {

        console.error('TrollRenderer: ' + error.message);
        throw error;

    }

    let _width = _canvas.width;
    let _height = _canvas.height;

    let _pixelRatio = 1;

    let _viewport = new THREE.Vector4(0, 0, _width, _height);
    let _scissor = new THREE.Vector4(0, 0, _width, _height);
    let _scissorTest = false;

    let _currentViewport = new THREE.Vector4();
    let _currentScissor = new THREE.Vector4();
    let _currentScissorTest = null;

    let _framebuffer = null;

    let _currentActiveCubeFace = 0;
    let _currentActiveMipmapLevel = 0;
    let _currentRenderTarget = null;
    let _currentFramebuffer = null;

    let _frustum = new THREE.Frustum();
    let _projScreenMatrix = new THREE.Matrix4();
    let _vector3 = new THREE.Vector3();

    let _extensions = new WebGLExtensions(_gl);
    let _capabilities = new WebGLCapabilities(_gl, _extensions, parameters);
    let _state = new WebGLState(_gl, _extensions, _capabilities);
    let _properties = new WebGLProperties();
    let _textures = new TextureUtilities(_gl, _extensions, _properties, _capabilities);

    let _materialToProgramInfo = new Map();
    let _depthMaterial;

    let _renderLists = new WebGLRenderLists();
    let _currentRenderList;
    let _lights = [];
    let _shadowLights = [];

    // Full screen quad
    let _fullScreenQuadCamera;
    let _fullScreenQuadMesh;

    // Create depth material
    {
        let depthVertCode = BasicUtilities.loadText('/src/shaders/depth.vert');
        let depthFragCode = BasicUtilities.loadText('/src/shaders/depth.frag');

        _depthMaterial = new THREE.RawShaderMaterial({
            vertexShader: depthVertCode,
            fragmentShader: depthFragCode,
        });
        _depthMaterial.visible = true;
        _depthMaterial.isMeshDepthMaterial = true;
    }

    _state.scissor(_currentScissor.copy(_scissor).multiplyScalar(_pixelRatio).floor());
    _state.viewport(_currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor());

    _this.domElement = _canvas;
    _this.capabilities = _capabilities;
    _this.extensions = _extensions;
    _this.properties = _properties;
    _this.state = _state;

    // API

    this.getContext = getContext;

    this.setSize = setSize;
    this.setPixelRatio = setPixelRatio;
    this.setRenderTarget = setRenderTarget;
    this.getClearColor = getClearColor;
    this.setClearColor = setClearColor;
    this.clear = clear;
    this.clearColor = clearColor;
    this.clearDepth = clearDepth;
    this.clearStencil = clearStencil;

    this.render = render;
    this.renderFullScreenQuad = renderFullScreenQuad;

    // Functions

    function getContext() {

        return _gl;

    };

    function setSize(width, height, updateStyle) {

        _width = width;
        _height = height;

        _canvas.width = Math.floor(width * _pixelRatio);
        _canvas.height = Math.floor(height * _pixelRatio);

        if (updateStyle !== false) {

            _canvas.style.width = width + 'px';
            _canvas.style.height = height + 'px';

        }

        setViewport(0, 0, width, height);

    };

    function setPixelRatio(value) {

        if (value === undefined) return;

        _pixelRatio = value;

        setSize(_width, _height, false);

    };

    function getActiveCubeFace() {

        return _currentActiveCubeFace;

    };

    function getActiveMipmapLevel() {

        return _currentActiveMipmapLevel;

    };

    function getRenderTarget() {

        return _currentRenderTarget;

    };

    function setViewport(x, y, width, height) {

        if (x.isVector4) {

            _viewport.set(x.x, x.y, x.z, x.w);

        } else {

            _viewport.set(x, y, width, height);

        }

        _state.viewport(_currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor());

    };

    function setRenderTarget(renderTarget, activeCubeFace, activeMipmapLevel) {

        _currentRenderTarget = renderTarget;
        _currentActiveCubeFace = activeCubeFace;
        _currentActiveMipmapLevel = activeMipmapLevel;

        if (renderTarget && _properties.get(renderTarget).__webglFramebuffer === undefined) {

            _textures.setupRenderTarget(renderTarget);

        }

        var framebuffer = _framebuffer;
        var isCube = false;

        if (renderTarget) {

            var __webglFramebuffer = _properties.get(renderTarget).__webglFramebuffer;

            if (renderTarget.isWebGLRenderTargetCube) {

                framebuffer = __webglFramebuffer[activeCubeFace || 0];
                isCube = true;

            } else if (renderTarget.isWebGLMultisampleRenderTarget) {

                framebuffer = _properties.get(renderTarget).__webglMultisampledFramebuffer;

            } else {

                framebuffer = __webglFramebuffer;

            }

            _currentViewport.copy(renderTarget.viewport);
            _currentScissor.copy(renderTarget.scissor);
            _currentScissorTest = renderTarget.scissorTest;

        } else {

            _currentViewport.copy(_viewport).multiplyScalar(_pixelRatio).floor();
            _currentScissor.copy(_scissor).multiplyScalar(_pixelRatio).floor();
            _currentScissorTest = _scissorTest;

        }

        if (_currentFramebuffer !== framebuffer) {

            _gl.bindFramebuffer(_gl.FRAMEBUFFER, framebuffer);
            _currentFramebuffer = framebuffer;

        }

        _state.viewport(_currentViewport);
        _state.scissor(_currentScissor);
        _state.setScissorTest(_currentScissorTest);

        if (isCube) {

            var textureProperties = _properties.get(renderTarget.texture);
            _gl.framebufferTexture2D(_gl.FRAMEBUFFER, _gl.COLOR_ATTACHMENT0, _gl.TEXTURE_CUBE_MAP_POSITIVE_X + (activeCubeFace || 0), textureProperties.__webglTexture, activeMipmapLevel || 0);

        }

    };

    function getClearColor() {

        let clearColor = _gl.getParameter(_gl.COLOR_CLEAR_VALUE);

        return {
            rgb: new THREE.Color(clearColor[0], clearColor[1], clearColor[2]),
            alpha: clearColor[3],
        }

    }

    function setClearColor(color, alpha) {

        if (alpha == null)
        {
            alpha = 1;
        }

        if (alpha < 0 || alpha > 1)
        {
            console.log("Invalid alpha value.");
            return;
        }

        _state.buffers.color.setClear(color.r, color.g, color.b, alpha);

    };

    function clear(color, depth, stencil) {

        var bits = 0;

        if (color === undefined || color) bits |= _gl.COLOR_BUFFER_BIT;
        if (depth === undefined || depth) bits |= _gl.DEPTH_BUFFER_BIT;
        if (stencil === undefined || stencil) bits |= _gl.STENCIL_BUFFER_BIT;

        _gl.clear(bits);

    };

    function clearColor() {

        clear(true, false, false);

    };

    function clearDepth() {

        clear(false, true, false);

    };

    function clearStencil() {

        clear(false, false, true);

    };

    function generatePrecision(parameters) {

        var precisionstring = [

            'precision highp float;',
            'precision highp int;',
            '',
            '#define HIGH_PRECISION',
            '',

        ].join("\n");

        return precisionstring;

    }

    function generateDefines(defines) {

        var chunks = [];

        for (var name in defines) {

            var value = defines[name];

            if (value === false) continue;

            chunks.push('#define ' + name + ' ' + value);

        }

        chunks.push('');
        return chunks.join('\n');
    }

    function getLightParameters() {

        let dirLightCount = 0;
        let spotLightCount = 0;
        let pointLightCount = 0;
        let shadowDirLightCount = 0;
        let shadowSpotLightCount = 0;
        let shadowPointLightCount = 0;

        for (const light of _lights) {
            if (light.isDirectionalLight) {
                dirLightCount += 1;

                if (light.castShadow) {
                    shadowDirLightCount += 1;
                }
            }
            else if (light.isSpotLight) {
                spotLightCount += 1;

                if (light.castShadow) {
                    shadowSpotLightCount += 1;
                }
            }
            else if (light.isPointLight) {
                pointLightCount += 1;

                if (light.castShadow) {
                    shadowPointLightCount += 1;
                }
            }
        }

        return {
            numDirLights: dirLightCount,
            numSpotLights: spotLightCount,
            numPointLights: pointLightCount,
            numDirLightShadows: shadowDirLightCount,
            numSpotLightShadows: shadowSpotLightCount,
            numPointLightShadows: shadowPointLightCount
        };
    }

    function replaceLightNums(string, parameters) {

        return string
            .replace(/NUM_DIR_LIGHTS/g, parameters.numDirLights)
            .replace(/NUM_SPOT_LIGHTS/g, parameters.numSpotLights)
            .replace(/NUM_POINT_LIGHTS/g, parameters.numPointLights)
            .replace(/NUM_DIR_LIGHT_SHADOWS/g, parameters.numDirLightShadows)
            .replace(/NUM_SPOT_LIGHT_SHADOWS/g, parameters.numSpotLightShadows)
            .replace(/NUM_POINT_LIGHT_SHADOWS/g, parameters.numPointLightShadows);

    }

    function projectObject(object, camera) {

        if (object.visible === false) return;

        var visible = object.layers.test(camera.layers);

        if (visible) {

            if (object.isLight) {

                _lights.push(object);

                if (object.castShadow) {

                    _shadowLights.push(object);

                }

            } else if (object.isMesh || object.isLine || object.isPoints) {

                if (!object.frustumCulled || _frustum.intersectsObject(object)) {

                    _vector3.setFromMatrixPosition(object.matrixWorld)
                        .applyMatrix4(_projScreenMatrix);

                    let geometry = object.geometry;
                    let material = object.material;
                    let groupOrder = 0;

                    if (material.visible) {

                        _currentRenderList.push(object, geometry, material, groupOrder, _vector3.z, null);

                    }

                }

            }

        }

        var children = object.children;

        for (var i = 0, l = children.length; i < l; i++) {

            projectObject(children[i], camera);

        }

    }

    function renderBufferDirect(object, geometry, material, camera) {

        let programInfo = _materialToProgramInfo.get(material);
        if (programInfo == null) {

            let precision = generatePrecision();
            let defines = generateDefines(material.defines);

            let lightParameters = getLightParameters();

            let vertexShaderCode = precision + defines +
                replaceLightNums(material.vertexShader, lightParameters);
            let fragmentShaderCode = precision + defines +
                replaceLightNums(material.fragmentShader, lightParameters);

            programInfo = GlProgramUtilities.createProgram(_gl, vertexShaderCode, fragmentShaderCode);
            _materialToProgramInfo.set(material, programInfo);

        }

        GlProgramUtilities.setProgram(_gl, programInfo, object, geometry, material, camera, _textures);

        let frontFaceCW = (object.isMesh && object.matrixWorld.determinant() < 0);

        _state.setMaterial(material, frontFaceCW);

        _textures.resetTextureUnits();

        //

        var index = geometry.index;
        var position = geometry.attributes.position;

        //

        var dataCount = Infinity;

        if (index !== null) {

            dataCount = index.count;

        } else if (position !== undefined) {

            dataCount = position.count;

        }

        var drawStart = geometry.drawRange.start;
        var drawCount = Math.min(dataCount, geometry.drawRange.count);

        if (drawCount === 0) return;

        //

        if (!object.isMesh) {
            console.log("Cannot handle object other than mesh.");
            return;
        }

        if (index != null) {

            let bufferInfo = GlProgramUtilities.geometryToBufferInfo.get(geometry);

            if (bufferInfo == null) {
                console.log("Failed to get geometry buffer.");
                return;
            }

            let indexBufferInfo = bufferInfo.get(index);
            if (indexBufferInfo == null) {
                console.log("Failed to get buffer info.");
                return;
            }

            let buffer = indexBufferInfo.buffer;
            let type = indexBufferInfo.type;
            let bytesPerElement = indexBufferInfo.bytesPerElement;

            _gl.bindBuffer(_gl.ELEMENT_ARRAY_BUFFER, buffer);

            _gl.drawElements(_gl.TRIANGLES, drawCount, type, drawStart * bytesPerElement);
        }
        else {

            _gl.drawArrays(_gl.TRIANGLES, drawStart, drawCount);

        }
    };

    function renderObject(object, camera, drawShadowMap, overwriteMaterial) {

        if (object.visible === false) return;

        let visible = object.layers.test(camera.layers);

        if (visible && object.isMesh) {

            if (drawShadowMap && !object.castShadow) {

                visible = false;
            }
            else if (object.frustumCulled && !_frustum.intersectsObject(object)) {

                visible = false;
            }

            let geometry = object.geometry;
            let material = overwriteMaterial == null ? object.material : overwriteMaterial;

            if (visible && material.visible) {

                object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
                object.normalMatrix.getNormalMatrix(object.modelViewMatrix);

                if (material.isMeshDepthMaterial) {
                    switch (object.material.side) {
                        case THREE.FrontSide:
                            material.side = THREE.BackSide;
                            break;
                        case THREE.BackSide:
                            material.side = THREE.FrontSide;
                            break;
                        case THREE.DoubleSide:
                            material.side = THREE.DoubleSide;
                            break;
                    }
                }

                if (!drawShadowMap) {

                    if (typeof material.refreshMaterialUniformsCallback !== 'undefined') {
                        material.refreshMaterialUniformsCallback(object.material.uniforms, object.material);
                    }

                    if (material.needLights) {
                        LightUtilities.updateMaterialUniforms(object.material, _lights, _shadowLights, camera);
                    }
                }

                renderBufferDirect(object, geometry, material, camera);
            }

        }

        let children = object.children;

        for (let i = 0, l = children.length; i < l; i++) {

            renderObject(children[i], camera, drawShadowMap, overwriteMaterial);

        }

    }

    function renderShadowMap(lights, scene, camera) {

        if (lights.length === 0) return;

        let needShadow = false;
        for (let object in _currentRenderList)
        {
            if (object.receiveShadow)
            {
                needShadow = true;
                break;
            }
        }

        if (!needShadow) return;

        let clearColor = getClearColor();

        let currentRenderTarget = getRenderTarget();
        let activeCubeFace = getActiveCubeFace();
        let activeMipmapLevel = getActiveMipmapLevel();

        // Set GL state for depth map.
        _state.setBlending(THREE.NoBlending);
        _state.buffers.color.setClear(1, 1, 1, 1);
        _state.buffers.depth.setTest(true);
        _state.setScissorTest(false);

        // render depth map
        let maxTextureSize = _capabilities.maxTextureSize;

        let shadowMapSize = new THREE.Vector2();
        let viewportSize = new THREE.Vector2();
        let viewport = new THREE.Vector4();

        for (let i = 0, il = lights.length; i < il; i++) {

            let light = lights[i];
            let shadow = light.shadow;

            if (shadow === undefined) {

                console.warn('THREE.WebGLShadowMap:', light, 'has no shadow.');
                continue;

            }

            shadowMapSize.copy(shadow.mapSize);

            let shadowFrameExtents = shadow.getFrameExtents();

            shadowMapSize.multiply(shadowFrameExtents);

            viewportSize.copy(shadow.mapSize);

            if (shadowMapSize.x > maxTextureSize || shadowMapSize.y > maxTextureSize) {

                console.warn('THREE.WebGLShadowMap:', light, 'has shadow exceeding max texture size, reducing');

                if (shadowMapSize.x > maxTextureSize) {

                    viewportSize.x = Math.floor(maxTextureSize / shadowFrameExtents.x);
                    shadowMapSize.x = viewportSize.x * shadowFrameExtents.x;
                    shadow.mapSize.x = viewportSize.x;

                }

                if (shadowMapSize.y > maxTextureSize) {

                    viewportSize.y = Math.floor(maxTextureSize / shadowFrameExtents.y);
                    shadowMapSize.y = viewportSize.y * shadowFrameExtents.y;
                    shadow.mapSize.y = viewportSize.y;

                }

            }

            if (shadow.map === null) {

                var pars = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat };

                shadow.map = new THREE.WebGLRenderTarget(shadowMapSize.x, shadowMapSize.y, pars);
                shadow.map.texture.name = light.name + ".shadowMap";

                shadow.camera.updateProjectionMatrix();

            }

            setRenderTarget(shadow.map);
            clear();

            let shadowViewportCount = shadow.getViewportCount();

            for (let vp = 0; vp < shadowViewportCount; vp++) {

                let shadowViewport = shadow.getViewport(vp);

                viewport.set(
                    viewportSize.x * shadowViewport.x,
                    viewportSize.y * shadowViewport.y,
                    viewportSize.x * shadowViewport.z,
                    viewportSize.y * shadowViewport.w
                );

                _state.viewport(viewport);

                shadow.updateMatrices(light, camera, vp);

                _frustum = shadow.getFrustum();

                let drawShadowMap = true;
                renderObject(scene, shadow.camera, drawShadowMap, _depthMaterial);

            }

        }

        setRenderTarget(currentRenderTarget, activeCubeFace, activeMipmapLevel);
        setClearColor(clearColor.rgb, clearColor.alpha);

    };

    function render(scene, camera) {

        // update scene graph
        if (scene.autoUpdate === true) scene.updateMatrixWorld();

        // update camera matrices and frustum
        if (camera.parent === null) camera.updateMatrixWorld();

        _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _frustum.setFromMatrix(_projScreenMatrix);

        _currentRenderList = _renderLists.get(scene, camera);
        _currentRenderList.init();
        _lights.length = 0;
        _shadowLights.length = 0;

        // collect objects and lights
        projectObject(scene, camera);

        _currentRenderList.sort();

        renderShadowMap(_shadowLights, scene, camera);

        _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _frustum.setFromMatrix(_projScreenMatrix);

        let drawShadowMap = false;
        renderObject(scene, camera, drawShadowMap);

        _currentRenderList = null;
    }

    function renderFullScreenQuad(material) {
        if (_fullScreenQuadCamera == null) {
            _fullScreenQuadCamera = new THREE.OrthographicCamera(- 1, 1, 1, - 1, 0, 1);
        }

        if (_fullScreenQuadMesh == null) {
            _fullScreenQuadMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2));
        }

        _fullScreenQuadMesh.material = material;
        render(_fullScreenQuadMesh, _fullScreenQuadCamera);
    }
}

export { TrollRenderer };