'use strict';

import { WebGLLights } from '../../three.js/src/renderers/webgl/WebGLLights.js'

let webGlLights = new WebGLLights();

function LightUtilities ()
{

}

LightUtilities.updateMaterialUniforms = function (material, lights, shadowLights, camera)
{
    webGlLights.setup(lights, shadowLights, camera);

    let lightUniforms = webGlLights.state;

    if (material.uniforms != null)
    {
        let materialUniforms = material.uniforms;

        materialUniforms.ambientLightColor.value = lightUniforms.ambient;
		materialUniforms.directionalLights.value = lightUniforms.directional;
		materialUniforms.spotLights.value = lightUniforms.spot;
        materialUniforms.pointLights.value = lightUniforms.point;
        
        materialUniforms.directionalShadowMap.value = lightUniforms.directionalShadowMap;
        materialUniforms.directionalShadowMatrix.value = lightUniforms.directionalShadowMatrix;
        materialUniforms.spotShadowMap.value = lightUniforms.spotShadowMap;
        materialUniforms.spotShadowMatrix.value = lightUniforms.spotShadowMatrix;
        materialUniforms.pointShadowMap.value = lightUniforms.pointShadowMap;
        materialUniforms.pointShadowMatrix.value = lightUniforms.pointShadowMatrix;
    }
}

export { LightUtilities };