/**
 * TimeAM API – Entry Point
 */

// Load environment variables FIRST
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { initializeFirebaseAdmin } from './core/firebase';
import { requireAuth, type AuthenticatedRequest } from './core/auth';
import { getTenantForUser, createTenant } from './core/tenancy';
import { timeTrackingRouter } from './modules/time-tracking';
import { shiftPoolRouter } from './modules/shift-pool';
import { membersRouter } from './modules/members';
import { calendarCoreRouter } from './modules/calendar-core';
import { notificationsRouter } from './modules/notifications';
import { settingsRouter } from './modules/settings';
import { adminRouter } from './modules/admin';
import { reportsRouter } from './modules/reports';

// Firebase Admin initialisieren
initializeFirebaseAdmin();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// Middleware
// =============================================================================

// CORS für Vite Dev Server
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
    ];

    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

// Request Logging (Development)
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path} [Origin: ${req.headers.origin || 'none'}]`);
  next();
});

// =============================================================================
// Public Routes
// =============================================================================

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'timeam-api',
  });
});

// API Info
app.get('/api', (_req, res) => {
  res.json({
    name: 'TimeAM API',
    version: '0.1.0',
    endpoints: {
      health: '/api/health',
      me: '/api/me (auth required)',
      createTenant: '/api/onboarding/create-tenant (auth required)',
    },
  });
});

// =============================================================================
// Protected Routes (require authentication)
// =============================================================================

/**
 * GET /api/me
 *
 * Gibt Informationen über den aktuell eingeloggten User zurück.
 * Inkl. Tenant, Role und Entitlements falls Mitglied.
 */
app.get('/api/me', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Tenant-Daten laden
    const tenantData = await getTenantForUser(user.uid);

    if (!tenantData) {
      // User hat noch keinen Tenant → Onboarding nötig
      res.json({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        needsOnboarding: true,
      });
      return;
    }

    // User ist Tenant-Mitglied
    res.json({
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      needsOnboarding: false,
      tenant: {
        id: tenantData.tenant.id,
        name: tenantData.tenant.name,
      },
      role: tenantData.member.role,
      entitlements: tenantData.entitlements,
    });
  } catch (error) {
    console.error('Error in GET /api/me:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/onboarding/create-tenant
 *
 * Erstellt einen neuen Tenant mit dem aktuellen User als Admin.
 */
app.post('/api/onboarding/create-tenant', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { tenantName } = req.body as { tenantName?: string };

  // Validierung
  if (!tenantName || typeof tenantName !== 'string' || tenantName.trim().length < 2) {
    res.status(400).json({
      error: 'Tenant name is required (min. 2 characters)',
      code: 'INVALID_TENANT_NAME',
    });
    return;
  }

  try {
    // Prüfen, ob User bereits einem Tenant zugeordnet ist
    const existingTenant = await getTenantForUser(user.uid);
    if (existingTenant) {
      res.status(409).json({
        error: 'User is already a member of a tenant',
        code: 'ALREADY_HAS_TENANT',
      });
      return;
    }

    // Tenant erstellen
    const { tenantId, entitlements } = await createTenant(
      user.uid,
      user.email || '',
      tenantName.trim()
    );

    console.log(`✅ Tenant created: ${tenantId} by ${user.uid}`);

    res.status(201).json({
      tenant: {
        id: tenantId,
        name: tenantName.trim(),
      },
      role: 'admin',
      entitlements,
    });
  } catch (error) {
    console.error('Error in POST /api/onboarding/create-tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// =============================================================================
// Feature Module Routes
// =============================================================================

// Time Tracking Module
app.use('/api/time-tracking', timeTrackingRouter);

// Shift Pool Module
app.use('/api/shift-pool', shiftPoolRouter);

// Members Module
app.use('/api/members', membersRouter);

// Calendar Core Module
app.use('/api/calendar', calendarCoreRouter);

// Notifications Module
app.use('/api/notifications', notificationsRouter);

// Settings Module (Tenant-Admin) - wird möglicherweise entfernt
app.use('/api/settings', settingsRouter);

// Admin Module (Super-Admin / Developer Dashboard)
app.use('/api/admin', adminRouter);

// Reports & Analytics Module
app.use('/api/reports', reportsRouter);

// =============================================================================
// 404 Handler
// =============================================================================

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// =============================================================================
// Start Server
// =============================================================================

app.listen(PORT, () => {
  console.log(`
🚀 TimeAM API running on http://localhost:${PORT}
📍 Health: http://localhost:${PORT}/api/health
👤 Me:     http://localhost:${PORT}/api/me (auth required)
🏢 Create: http://localhost:${PORT}/api/onboarding/create-tenant (auth required)
⏱️ Time:   http://localhost:${PORT}/api/time-tracking/* (auth + entitlement)
📋 Shifts: http://localhost:${PORT}/api/shift-pool/* (auth + entitlement)
👥 Members: http://localhost:${PORT}/api/members/* (auth required)
📅 Calendar: http://localhost:${PORT}/api/calendar/* (auth + entitlement)
🔔 Notifications: http://localhost:${PORT}/api/notifications/* (auth required)
⚙️ Settings: http://localhost:${PORT}/api/settings/* (tenant-admin)
🔐 Admin:  http://localhost:${PORT}/api/admin/* (super-admin only)
📈 Reports: http://localhost:${PORT}/api/reports/* (auth + entitlement)
🌐 CORS:   localhost:5173-5175, localhost:3000
  `);
});
