'use strict';
const admin = require("firebase-admin");
const functions = require('firebase-functions');
admin.initializeApp();

const path = require('path');
const oas3Tools = require('oas3-tools');
const jsonUtil = require("./utils/jsonUtil");
const securizarMiddleware = require("./middleare/security");

async function getBonditClaimsOfUser(userRecord) {
    if (userRecord &&
        userRecord.customClaims) {
        let customClaims = await getCustomClaimsOfUser(uid);
        let result = null;
        if (customClaims && customClaims.bonditClaims) {
            result = customClaims.bonditClaims;
        }
        return result;
    }
    return null;
}

// swaggerRouter configuration
var options = {
    publicFolderPath: "public",
    routing: {
        controllers: path.join(__dirname, './controllers')
    },
    logging: {
        format: 'string',
        errorLimit: 400
    },
    callBackInitModules: function(app, name, pathController) {

        app.use(function(req, resp, next) {
            console.log(req.openapi && req.openapi.schema && jsonUtil.jsonify(req.openapi));
            console.log("middleware - Antes del ruteo " + name, pathController);
            next();
        });

        app.use(securizarMiddleware.securizar);

    }
};

var expressAppConfig = oas3Tools.expressAppConfig(path.join(__dirname, 'api/openapi.yaml'), options);

Object.assign(exports, expressAppConfig.getExportCloudFunction(functions.https.onRequest));