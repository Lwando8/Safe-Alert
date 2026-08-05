/**
 * Back-compat re-exports. Prefer importing from './requestContext'.
 */
export {
  authorize,
  authorizeAnyPermission,
  buildRequestContext,
  requireAuth,
  requireTenantMatch,
  resolveRequestContext,
  resolveRequestContextFromCallable,
  type RequestContext,
} from './requestContext';
