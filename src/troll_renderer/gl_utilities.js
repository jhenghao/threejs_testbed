"use strict";

import { WebGLUniforms } from '../../three.js/src/renderers/webgl/WebGLUniforms.js'

function GlUtilities ()
{
}

GlUtilities.fetchAttributeLocations = function (gl, program) {

    var attributes = {};

    var n = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

    for (var i = 0; i < n; i++) {

        var info = gl.getActiveAttrib(program, i);
        var name = info.name;

        // console.log( 'THREE.WebGLProgram: ACTIVE VERTEX ATTRIBUTE:', name, i );

        attributes[name] = gl.getAttribLocation(program, name);

    }

    return attributes;

}

GlUtilities.createShader = function (gl, type, string) {

    let shader = gl.createShader(type);

    gl.shaderSource(shader, string);
    gl.compileShader(shader);

    // Check the compile status
    const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

    if (!compiled) {
        // Something went wrong during compilation; get the error
        const lastError = gl.getShaderInfoLog(shader);
        console.log('*** Error compiling shader:' + lastError);
        gl.deleteShader(shader);

        return null;
    }

    return shader;

}

GlUtilities.createProgram = function (gl, vertexShaderCode, fragmentShaderCode) {

    let program = gl.createProgram();

    let glVertexShader = GlUtilities.createShader(gl, gl.VERTEX_SHADER, vertexShaderCode);
    let glFragmentShader = GlUtilities.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderCode);

    if (glVertexShader == null || glFragmentShader == null)
        return null;

    gl.attachShader(program, glVertexShader);
    gl.attachShader(program, glFragmentShader);

    gl.linkProgram(program);

    gl.deleteShader(glVertexShader);
    gl.deleteShader(glFragmentShader);

    // Check the link status
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);

    if (!linked) {
        // something went wrong with the link
        const lastError = gl.getProgramInfoLog(program);
        errFn('Error in program linking:' + lastError);

        gl.deleteProgram(program);
        return null;
    }

    let attributeLocations = GlUtilities.fetchAttributeLocations(gl, program);
    let uniforms = new WebGLUniforms(gl, program);

    return {
        program: program,
        attributeLocations: attributeLocations,
        uniforms: uniforms,
    };
}

GlUtilities.createBuffer = function (gl, attribute, bufferType) {

    let array = attribute.array;
    //let usage = attribute.usage ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW;
    let usage = attribute.usage;

    let buffer = gl.createBuffer();

    gl.bindBuffer(bufferType, buffer);
    gl.bufferData(bufferType, array, usage);

    attribute.onUploadCallback();

    let type = gl.FLOAT;

    if (array instanceof Float32Array) {

        type = gl.FLOAT;

    } else if (array instanceof Float64Array) {

        console.warn('THREE.WebGLAttributes: Unsupported data buffer format: Float64Array.');

    } else if (array instanceof Uint16Array) {

        type = gl.UNSIGNED_SHORT;

    } else if (array instanceof Int16Array) {

        type = gl.SHORT;

    } else if (array instanceof Uint32Array) {

        type = gl.UNSIGNED_INT;

    } else if (array instanceof Int32Array) {

        type = gl.INT;

    } else if (array instanceof Int8Array) {

        type = gl.BYTE;

    } else if (array instanceof Uint8Array) {

        type = gl.UNSIGNED_BYTE;

    }

    return {
        buffer: buffer,
        type: type,
        bytesPerElement: array.BYTES_PER_ELEMENT,
        version: attribute.version
    };

}

GlUtilities.createGeometryBuffer = function (gl, geometry) {

    let index = geometry.index;
    let geometryAttributes = geometry.attributes;

    let buffers = new Map();

    if (index !== null) {

        buffers.set(index, GlUtilities.createBuffer(gl, index, gl.ELEMENT_ARRAY_BUFFER));

    }

    for (let name in geometryAttributes) {

        buffers.set(geometryAttributes[name],
            GlUtilities.createBuffer(gl, geometryAttributes[name], gl.ARRAY_BUFFER));

    }

    return buffers;
}

GlUtilities.setVertexAttributes = function (gl, programInfo, object, geometry, material) {

    //state.initAttributes();

    let bufferInfo = GlUtilities.geometryToBufferInfo.get(geometry);
    if (bufferInfo == null) {

        bufferInfo = GlUtilities.createGeometryBuffer(gl, geometry);
        GlUtilities.geometryToBufferInfo.set(geometry, bufferInfo);
        
    }

    let attributeLocations = programInfo.attributeLocations;

    let geometryAttributes = geometry.attributes;
    let materialDefaultAttributeValues = material.defaultAttributeValues;

    for (let name in attributeLocations) {

        let attributeLocation = attributeLocations[name];

        if (attributeLocation < 0) {
            console.log('Invalid attribute location: ' + name);
            continue;
        }

        let geometryAttribute = geometryAttributes[name];

        if (geometryAttribute !== undefined) {

            if (geometryAttribute.isInterleavedBufferAttribute) {
                console.log("Cannot handle interleave buffer attribute.");
                continue;
            }

            if (geometryAttribute.isInstancedBufferAttribute) {
                console.log("Cannot handle instanced buffer attribute.");
                continue;
            }

            let attributeBufferInfo = bufferInfo.get(geometryAttribute);

            if (attributeBufferInfo == null) {
                console.log('Cannot find attribute buffer info: ' + name);
                continue;
            }

            let normalized = geometryAttribute.normalized;
            let size = geometryAttribute.itemSize;

            let buffer = attributeBufferInfo.buffer;
            let type = attributeBufferInfo.type;
            let bytesPerElement = attributeBufferInfo.bytesPerElement;

            gl.enableVertexAttribArray(attributeLocation);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.vertexAttribPointer(attributeLocation, size, type, normalized, 0, 0);

        } else if (materialDefaultAttributeValues !== undefined) {

            let value = materialDefaultAttributeValues[name];

            if (value !== undefined) {

                switch (value.length) {

                    case 2:
                        gl.vertexAttrib2fv(attributeLocation, value);
                        break;

                    case 3:
                        gl.vertexAttrib3fv(attributeLocation, value);
                        break;

                    case 4:
                        gl.vertexAttrib4fv(attributeLocation, value);
                        break;

                    default:
                        gl.vertexAttrib1fv(attributeLocation, value);

                }

            }

        }

    }

    //state.disableUnusedAttributes();

}

GlUtilities.setUniforms = function (gl, programInfo, object, material, camera, textures) {

    let p_uniforms = programInfo.uniforms;
    let m_uniforms = material.uniforms;

    let uniformsList = WebGLUniforms.seqWithValue(p_uniforms.seq, m_uniforms);

    WebGLUniforms.upload(gl, uniformsList, m_uniforms, textures);

    // common matrices

    p_uniforms.setValue(gl, 'projectionMatrix', camera.projectionMatrix);

    p_uniforms.setValue(gl, 'modelViewMatrix', object.modelViewMatrix);
    p_uniforms.setValue(gl, 'normalMatrix', object.normalMatrix);
    p_uniforms.setValue(gl, 'modelMatrix', object.matrixWorld);
}

GlUtilities.setProgram = function (gl, programInfo, object, geometry, material, camera, textures) {

    gl.useProgram(programInfo.program);

    GlUtilities.setVertexAttributes(gl, programInfo, object, geometry, material);
    GlUtilities.setUniforms(gl, programInfo, object, material, camera, textures);

}

GlUtilities.geometryToBufferInfo = new Map();

export { GlUtilities };