"use strict";

function BasicUtilities() 
{
}

BasicUtilities.loadText = function (filePath) {

    let text;

    $.get({
        url: filePath,
        success: function (data) { text = data; },
        async: false,
    });

    return text;
}

export { BasicUtilities };