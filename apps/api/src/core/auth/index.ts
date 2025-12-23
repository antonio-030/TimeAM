/**
 * Auth Module – Public API
 *
 * Authentifizierung für das TimeAM Backend.
 */

// Types
export {
  type AuthUser,
  type AuthenticatedRequest as AuthenticatedRequestBase,
  AuthError,
  type AuthErrorCode,
} from './types';

// Token Verification
export {
  verifyIdToken,
  extractAuthUser,
  extractTokenFromHeader,
} from './verify-token';

// Middleware (Framework-agnostisch)
export {
  authenticateRequest,
  isAuthenticated,
  type AuthResult,
} from './middleware';

// Express Middleware
export {
  requireAuth,
  optionalAuth,
  type AuthenticatedRequest,
} from './express-middleware';

