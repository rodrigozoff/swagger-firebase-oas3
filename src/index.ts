'use strict';
import { ExpressAppConfig, IAppOptions } from "./middleware/express.app.config";

export function expressAppConfig(definitionPath: string, appOptions:IAppOptions): ExpressAppConfig {
  return new ExpressAppConfig(definitionPath, appOptions);
}
