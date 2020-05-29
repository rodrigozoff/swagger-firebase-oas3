'use strict';

import * as express from 'express';
import cookieParser = require('cookie-parser');
import { SwaggerUI } from './swagger.ui';
import { SwaggerRouter } from './swagger.router';
import { SwaggerParameters } from './swagger.parameters';
import * as logger from 'morgan';
import * as fs from 'fs';
import * as jsyaml from 'js-yaml';
import { OpenApiValidator } from 'express-openapi-validator';

import * as url from 'url';
export class AppController {

    public app: express.Application;
    public name: string;
    public swaggerDoc: any;
    public pathController: string;
    public callBackInitModule: (app: express.Application, name: string, pathController: string) => void;

    public addValidator(routingOptions) {

        new OpenApiValidator({
            apiSpec: this.swaggerDoc,
        })
            .install(this.app)
            .then(() => {
                this.app.use(new SwaggerParameters().checkParameters());
                if (this.callBackInitModule) {
                    this.callBackInitModule(this.app, this.name, this.pathController);
                }
                this.app.use(new SwaggerRouter().initialize(routingOptions));
                this.app.use((err, req, res, next) => {
                    // format errors
                    res.status(err.status || 500).json({
                        message: err.message,
                        errors: err.errors,
                    });
                });
            });
    }
}

export interface IAppOptions {
    logging?: string;
    routing: any;
    publicFolderPath:string;
    callBackInitModules?: (app: express.Application, name: string, pathController: string) => void;
}

export class ExpressAppConfig {
    private app: express.Application;
    private appControllers: Array<AppController> = [];
    private routingOptions;

    constructor(definitionPath: string, appOptions: IAppOptions) {
        this.routingOptions = appOptions.routing;
        this.app = express();

        const spec = fs.readFileSync(definitionPath, 'utf8');
        const swaggerDoc = jsyaml.safeLoad(spec);

        //----------------------------------------------------
        for (var pathService in swaggerDoc.paths) {
            var service = swaggerDoc.paths[pathService];
            for (const methodName in service) {
                const method = service[methodName];
              
                let controllerName = method["x-swagger-router-controller"];

                if (!controllerName && method.tags && method.tags.length == 1) {
                    controllerName = method.tags[0];
                    console.log(`En el servicio ${pathService} sobre el metodo : ${methodName} - Se infirio el nombre del controller ${controllerName.charAt(0).toUpperCase() + controllerName.slice(1)} por nombre de tag.`)
                }

                if (!controllerName) {
                    throw Error(`El servicio ${pathService} con el metodo : ${methodName}  no posee controller. Falta atributo x-swagger-router-controller o un tag para inferirlo.`);
                }

                method["x-swagger-router-controller"] = controllerName.charAt(0).toUpperCase() + controllerName.slice(1);

                if (!this.appControllers.find(i => i.name === controllerName)) {
                    let appController = new AppController();
                    appController.name = controllerName;
                    this.appControllers.push(appController);
                    appController.app = express();
                    appController.callBackInitModule = appOptions.callBackInitModules;
                    this.agregarMiddlewareAppCloudFunction(appController.app, appOptions);
                }
            }
        }

        this.appControllers.forEach(appController => {
            const appName = appController.name;
            var sdoc = JSON.parse(JSON.stringify(swaggerDoc));

            // Se eliminan las tags no utilizadas
            var newTags = [];
            for (let index = 0; index < sdoc.tags.length; index++) {
                const tag = sdoc.tags[index];
                if (tag.name == appName.toLowerCase()) {
                    newTags.push(tag);
                }
            }

            sdoc.tags = newTags;

            sdoc.servers.forEach(server => {
                var q = url.parse(server.url, true);
                server.url = q.pathname + "/mod" + appName;
            });

            const rootPath = "/" + appName.toLowerCase();
            for (var pathService in sdoc.paths) {
                const service = sdoc.paths[pathService];
                delete sdoc.paths[pathService];
                if (pathService.indexOf(rootPath + "/") == 0 ||
                    pathService == rootPath
                ) {
                    sdoc.paths[pathService] = service;
                }
            }

            appController.pathController = "mod" + appController.name;
            appController.swaggerDoc = sdoc;
            appController.addValidator(this.routingOptions)

        });

        for (var pathService in swaggerDoc.paths) {
            var service = swaggerDoc.paths[pathService];
            for (const methodName in service) {
                delete swaggerDoc.paths[pathService];
                const method = service[methodName];
                let controllerName = method["x-swagger-router-controller"];
                if (!controllerName && method.tags && method.tags.length == 1) {
                    controllerName = method.tags[0];
                    console.log(`En el servicio ${pathService} sobre el metodo : ${methodName} - Se infirio el nombre del controller ${controllerName.charAt(0).toUpperCase() + controllerName.slice(1)} por nombre de tag.`)
                }
                method["x-swagger-router-controller"] = controllerName.charAt(0).toUpperCase() + controllerName.slice(1);
                swaggerDoc.paths["/mod" + controllerName + pathService] = service;
                break;
            }
        }

        //----------------------------------------------------
  
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.text());
        this.app.use(express.json());

        this.app.use(this.configureLogger(appOptions.logging));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: false }));
        this.app.use(cookieParser());

        const swaggerUi = new SwaggerUI(swaggerDoc, undefined);
        this.app.use(swaggerUi.serveStaticContent());

        this.app.use(express.static(appOptions.publicFolderPath));
    }

    private agregarMiddlewareAppCloudFunction(app: express.Application, appOptions) {

        app.use(express.urlencoded({ extended: true }));
        app.use(express.text());
        app.use(express.json());

        app.use(this.configureLogger(appOptions.logging));
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));
        app.use(cookieParser());

    }

    public configureLogger(loggerOptions) {
        let format = 'dev';
        if (loggerOptions.format != undefined
            && typeof loggerOptions.format === 'string') {
            format = loggerOptions.format;
        }

        let options: {} = {};
        if (loggerOptions.errorLimit != undefined
            && (typeof loggerOptions.errorLimit === 'string' || typeof loggerOptions.errorLimit === 'number')) {
            options['skip'] = function (req, res) { return res.statusCode < parseInt(loggerOptions.errorLimit); };
        }

        return logger(format, options);
    }

    public getAppSwaggerUI(): express.Application {
        return this.app;
    }
    public getAppsControllers(): Array<AppController> {
        return this.appControllers;
    }

    public getExportCloudFunction(handlerCreateServer: any): any {
        var resultExport: any = {};
        resultExport.swagger = handlerCreateServer(this.app);
        var appControllers = this.getAppsControllers();
        appControllers.forEach(appController => {
            resultExport["mod" + appController.name] = handlerCreateServer(appController.app);
        });
        return resultExport;
    }
}