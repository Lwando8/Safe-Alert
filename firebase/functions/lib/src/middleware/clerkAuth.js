"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRequestContextFromCallable = exports.resolveRequestContext = exports.requireTenantMatch = exports.requireAuth = exports.buildRequestContext = exports.authorizeAnyPermission = exports.authorize = void 0;
/**
 * Back-compat re-exports. Prefer importing from './requestContext'.
 */
var requestContext_1 = require("./requestContext");
Object.defineProperty(exports, "authorize", { enumerable: true, get: function () { return requestContext_1.authorize; } });
Object.defineProperty(exports, "authorizeAnyPermission", { enumerable: true, get: function () { return requestContext_1.authorizeAnyPermission; } });
Object.defineProperty(exports, "buildRequestContext", { enumerable: true, get: function () { return requestContext_1.buildRequestContext; } });
Object.defineProperty(exports, "requireAuth", { enumerable: true, get: function () { return requestContext_1.requireAuth; } });
Object.defineProperty(exports, "requireTenantMatch", { enumerable: true, get: function () { return requestContext_1.requireTenantMatch; } });
Object.defineProperty(exports, "resolveRequestContext", { enumerable: true, get: function () { return requestContext_1.resolveRequestContext; } });
Object.defineProperty(exports, "resolveRequestContextFromCallable", { enumerable: true, get: function () { return requestContext_1.resolveRequestContextFromCallable; } });
