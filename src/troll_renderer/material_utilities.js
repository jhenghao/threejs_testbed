'use strict';

import { BasicUtilities } from './basic_utilities.js';

function MaterialUtilities() {

}

MaterialUtilities.createPhongMaterial = function (parameters) {

    let phongVertCode = BasicUtilities.loadText('/src/shaders/mesh_phong.vert');
    let phongFragCode = BasicUtilities.loadText('/src/shaders/mesh_phong.frag');

    let defaultColor = new THREE.Color(0xaaaaaa);
    let defaultSpecular = new THREE.Color(0x111111);
    let defaultShininess = 30;

    // Create phong material
    let phongMaterial = new THREE.RawShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.common,
            THREE.UniformsLib.lights,
            {
                specular: { value: defaultSpecular },
                shininess: { value: defaultShininess }
            },
        ]),
        vertexShader: phongVertCode,
        fragmentShader: phongFragCode,
    });

    phongMaterial.lights = true;
    phongMaterial.isMeshPhongMaterial = true;
    phongMaterial.color = defaultColor;
    phongMaterial.specular = defaultSpecular;
    phongMaterial.shininess = defaultShininess;

    phongMaterial.setValues(parameters);

    return phongMaterial;
}

MaterialUtilities.refreshUniformsCommon = function (uniforms, material) {

    uniforms.opacity.value = material.opacity;

    if (material.color) {

        uniforms.diffuse.value = material.color;

    }

    if (material.emissive) {

        uniforms.emissive.value.copy(material.emissive).multiplyScalar(material.emissiveIntensity);

    }

    if (material.map) {

        uniforms.map.value = material.map;

    }

    if (material.alphaMap) {

        uniforms.alphaMap.value = material.alphaMap;

    }

    if (material.specularMap) {

        uniforms.specularMap.value = material.specularMap;

    }

    if (material.envMap) {

        uniforms.envMap.value = material.envMap;

        // don't flip CubeTexture envMaps, flip everything else:
        //  WebGLRenderTargetCube will be flipped for backwards compatibility
        //  WebGLRenderTargetCube.texture will be flipped because it's a Texture and NOT a CubeTexture
        // this check must be handled differently, or removed entirely, if WebGLRenderTargetCube uses a CubeTexture in the future
        uniforms.flipEnvMap.value = material.envMap.isCubeTexture ? - 1 : 1;

        uniforms.reflectivity.value = material.reflectivity;
        uniforms.refractionRatio.value = material.refractionRatio;

        uniforms.maxMipLevel.value = properties.get(material.envMap).__maxMipLevel;

    }

    if (material.lightMap) {

        uniforms.lightMap.value = material.lightMap;
        uniforms.lightMapIntensity.value = material.lightMapIntensity;

    }

    if (material.aoMap) {

        uniforms.aoMap.value = material.aoMap;
        uniforms.aoMapIntensity.value = material.aoMapIntensity;

    }

    // uv repeat and offset setting priorities
    // 1. color map
    // 2. specular map
    // 3. normal map
    // 4. bump map
    // 5. alpha map
    // 6. emissive map

    var uvScaleMap;

    if (material.map) {

        uvScaleMap = material.map;

    } else if (material.specularMap) {

        uvScaleMap = material.specularMap;

    } else if (material.displacementMap) {

        uvScaleMap = material.displacementMap;

    } else if (material.normalMap) {

        uvScaleMap = material.normalMap;

    } else if (material.bumpMap) {

        uvScaleMap = material.bumpMap;

    } else if (material.roughnessMap) {

        uvScaleMap = material.roughnessMap;

    } else if (material.metalnessMap) {

        uvScaleMap = material.metalnessMap;

    } else if (material.alphaMap) {

        uvScaleMap = material.alphaMap;

    } else if (material.emissiveMap) {

        uvScaleMap = material.emissiveMap;

    }

    if (uvScaleMap !== undefined) {

        // backwards compatibility
        if (uvScaleMap.isWebGLRenderTarget) {

            uvScaleMap = uvScaleMap.texture;

        }

        if (uvScaleMap.matrixAutoUpdate === true) {

            uvScaleMap.updateMatrix();

        }

        uniforms.uvTransform.value.copy(uvScaleMap.matrix);

    }

}

MaterialUtilities.refreshUniformsPhong = function (uniforms, material) {

    MaterialUtilities.refreshUniformsCommon(uniforms, material);

    uniforms.specular.value = material.specular;
    uniforms.shininess.value = Math.max(material.shininess, 1e-4); // to prevent pow( 0.0, 0.0 )

    if (material.emissiveMap) {

        uniforms.emissiveMap.value = material.emissiveMap;

    }

    if (material.bumpMap) {

        uniforms.bumpMap.value = material.bumpMap;
        uniforms.bumpScale.value = material.bumpScale;
        if (material.side === BackSide) uniforms.bumpScale.value *= - 1;

    }

    if (material.normalMap) {

        uniforms.normalMap.value = material.normalMap;
        uniforms.normalScale.value.copy(material.normalScale);
        if (material.side === BackSide) uniforms.normalScale.value.negate();

    }

    if (material.displacementMap) {

        uniforms.displacementMap.value = material.displacementMap;
        uniforms.displacementScale.value = material.displacementScale;
        uniforms.displacementBias.value = material.displacementBias;

    }
}

export { MaterialUtilities };