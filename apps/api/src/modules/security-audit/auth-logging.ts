/**
 * Auth Logging Endpoint
 *
 * Endpoint für Login-Logging vom Frontend.
 * Wird nach erfolgreichem/fehlgeschlagenem Login aufgerufen.
 */

import { Router } from 'express';
import { getTenantForUser } from '../../core/tenancy/index.js';
import {
  logAuthEvent,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
} from './service.js';

const router = Router();

/**
 * POST /api/security-audit/log-auth-event
 * Loggt ein Auth-Event (Login, Logout, fehlgeschlagener Versuch).
 * Öffentlich zugänglich (kein Auth erforderlich), da es für fehlgeschlagene Logins verwendet wird.
 */
router.post('/log-auth-event', async (req, res) => {
  const { eventType, email, userId, errorMessage } = req.body;

  // Validierung
  if (!eventType || !['auth.login.success', 'auth.login.failed', 'auth.logout'].includes(eventType)) {
    res.status(422).json({
      error: 'Invalid eventType',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  if (!email && !userId) {
    res.status(422).json({
      error: 'email or userId required',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  try {
    // IP-Adresse und User-Agent extrahieren
    const ipAddressRaw = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const ipAddress = Array.isArray(ipAddressRaw) ? ipAddressRaw[0] : (typeof ipAddressRaw === 'string' ? ipAddressRaw : undefined);
    const userAgent = req.headers['user-agent'] || undefined;

    // Tenant-ID ermitteln (falls userId vorhanden)
    let tenantId: string | null = null;
    if (userId) {
      try {
        const tenantData = await getTenantForUser(userId);
        tenantId = tenantData?.tenant.id || null;
      } catch {
        // Tenant nicht gefunden - ok für fehlgeschlagene Logins
      }
    }

    // Rate-Limiting für fehlgeschlagene Logins
    if (eventType === 'auth.login.failed') {
      const identifier = email || ipAddress || 'unknown';
      const rateLimitCheck = await checkRateLimit(identifier);

      if (rateLimitCheck.blocked) {
        // Rate-Limit überschritten - Event loggen
        await logAuthEvent(tenantId, 'auth.rate_limit_exceeded', {
          email,
          userId,
          ipAddress,
          userAgent,
          errorMessage: 'Rate limit exceeded',
        });

        res.status(429).json({
          error: 'Too many failed login attempts. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          blockedUntil: rateLimitCheck.blockedUntil?.toISOString(),
        });
        return;
      }

      // Fehlgeschlagenen Versuch aufzeichnen
      await recordFailedAttempt(identifier);
    } else if (eventType === 'auth.login.success') {
      // Rate-Limit zurücksetzen bei erfolgreichem Login
      const identifier = email || ipAddress || 'unknown';
      await resetRateLimit(identifier);
    }

    // Event loggen
    await logAuthEvent(tenantId, eventType, {
      userId,
      email,
      ipAddress,
      userAgent,
      errorMessage,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error in POST /security-audit/log-auth-event:', error);
    const message = error instanceof Error ? error.message : 'Failed to log event';
    res.status(500).json({ error: message });
  }
});

export { router as authLoggingRouter };

