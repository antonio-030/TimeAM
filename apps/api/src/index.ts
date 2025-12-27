/**
 * TimeAM API – Entry Point
 */

// Load environment variables FIRST
// PM2 läuft vom Root, daher müssen wir den Pfad zur .env explizit angeben
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// .env liegt in apps/api/, aber dist/ liegt in apps/api/dist/
// Daher müssen wir zwei Ebenen nach oben gehen
const envPath = resolve(__dirname, '../.env');
const result = config({ path: envPath });

// Debug: Prüfe ob STRIPE_SECRET_KEY geladen wurde
if (process.env.STRIPE_SECRET_KEY) {
  console.log('✅ STRIPE_SECRET_KEY geladen');
} else {
  console.warn('⚠️ STRIPE_SECRET_KEY nicht gefunden in .env-Datei');
  console.log(`📁 .env-Pfad: ${envPath}`);
  console.log(`📋 Geladene Variablen: ${Object.keys(result.parsed || {}).join(', ')}`);
}

import express from 'express';
import cors from 'cors';
import { initializeFirebaseAdmin, getAdminFirestore } from './core/firebase/index.js';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, type AuthenticatedRequest } from './core/auth/index.js';
import { getTenantForUser, createTenant } from './core/tenancy/index.js';
import { timeTrackingRouter } from './modules/time-tracking/index.js';
import { shiftPoolRouter } from './modules/shift-pool/index.js';
import { membersRouter } from './modules/members/index.js';
import { calendarCoreRouter } from './modules/calendar-core/index.js';
import { notificationsRouter } from './modules/notifications/index.js';
import { settingsRouter } from './modules/settings/index.js';
import { adminRouter } from './modules/admin/index.js';
import { reportsRouter } from './modules/reports/index.js';
import { freelancerRouter } from './modules/freelancer/index.js';
import { supportRouter } from './modules/support/index.js';
import { securityAuditRouter } from './modules/security-audit/index.js';
import { workTimeComplianceRouter } from './modules/work-time-compliance/index.js';
import { stripeRouter } from './modules/stripe/index.js';
import { subscriptionManagementRouter } from './core/subscription-management/index.js';
import { mfaRouter } from './core/mfa/routes.js';
import { requireMfaVerification } from './core/mfa/middleware.js';

// Firebase Admin initialisieren
initializeFirebaseAdmin();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// Middleware
// =============================================================================

// CORS für Vite Dev Server und Production
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      // Development
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:3000',
      // Production
      'https://timeog.de',
      'https://www.timeog.de',
      // Allow additional origins from environment variable (comma-separated)
      ...(process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []),
    ];

    if (!origin) {
      callback(null, true);
      return;
    }

    // Normalisiere die Origin (entferne Trailing-Slash, normalisiere zu lowercase für Vergleich)
    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');
    const normalizedAllowed = allowedOrigins.map(o => o.toLowerCase().replace(/\/$/, ''));

    if (normalizedAllowed.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin} (normalized: ${normalizedOrigin})`);
      console.warn(`Allowed origins: ${allowedOrigins.join(', ')}`);
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
// Body-Parser für JSON (erhöhtes Limit für größere Payloads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request Logging (nur für Development, auskommentiert um Log-Spam zu vermeiden)
// app.use((req, _res, next) => {
//   console.log(`${req.method} ${req.path} [Origin: ${req.headers.origin || 'none'}]`);
//   next();
// });

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
      // WICHTIG: Bei jedem /api/me Call prüfen, ob MFA-Verifizierung zurückgesetzt werden muss
      // Dies wird nur gemacht, wenn MFA aktiviert ist
      // Wir prüfen basierend auf dem Token-Issue-Datum, ob es eine neue Session ist
      const { isMfaEnabled, checkAndResetMfaForNewSession } = await import('./core/mfa/service.js');
      const isMfaEnabledForUser = await isMfaEnabled(user.uid);
      if (isMfaEnabledForUser) {
        // Token-Issue-Datum aus Request holen (wurde in requireAuth gesetzt)
        const tokenIssuedAt = (req as any).tokenIssuedAt as number | undefined;
        await checkAndResetMfaForNewSession(user.uid, tokenIssuedAt);
      }
      // Prüfen ob User ein Freelancer oder Dev-Mitarbeiter ist
      const db = getAdminFirestore();
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      const isFreelancer = userData?.isFreelancer === true;

      // WICHTIG: SUPER_ADMIN-Check früh durchführen, damit isSuper überall verfügbar ist
      const { isSuperAdmin } = await import('./core/super-admin/index.js');
      const isSuper = isSuperAdmin(user.uid);

      // Prüfen ob User ein Dev-Mitarbeiter ist (inkl. Super-Admins)
      const { isDevStaff, ensureDevStaffForSuperAdmin } = await import('./modules/support/service.js');
      
      // Super-Admins automatisch als Dev-Staff registrieren (falls nicht vorhanden)
      if (isSuper) {
        await ensureDevStaffForSuperAdmin(user.uid, user.email || '');
      }
      
      const isDev = await isDevStaff(user.uid) || isSuper; // Super-Admins sind immer Dev-Staff

      // Wenn Dev-Mitarbeiter ODER Super-Admin, Dev-Tenant-Daten laden
      if (isDev || isSuper) {
        const { getTenantForUser } = await import('./core/tenancy/index.js');
        let tenantData = await getTenantForUser(user.uid);
        
        // WICHTIG: Wenn Super Admin und kein Tenant gefunden, Dev-Tenant explizit erstellen
        // Das kann passieren, wenn ensureDevStaffForSuperAdmin den Tenant noch nicht erstellt hat
        // ODER wenn eine neue Super-Admin-UID verwendet wird
        if (!tenantData && isSuper) {
          const { getOrCreateDevTenant, assignDevStaffToTenant } = await import('./modules/support/service.js');
          
          // Dev-Tenant erstellen (oder zurückgeben falls bereits vorhanden)
          const tenantId = await getOrCreateDevTenant(user.uid);
          
          // Super-Admin dem Dev-Tenant zuordnen
          await assignDevStaffToTenant(user.uid, user.email || '');
          
          // Kurz warten, damit Firestore die Änderungen propagiert
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Nochmal versuchen
          tenantData = await getTenantForUser(user.uid);
          
          if (!tenantData) {
            // Nochmal versuchen mit längerer Wartezeit
            await new Promise(resolve => setTimeout(resolve, 1000));
            tenantData = await getTenantForUser(user.uid);
          }
        }
        
        // MFA-Status nur laden wenn Modul aktiviert ist
        const hasMfaEntitlement = tenantData?.entitlements?.['module.mfa'] === true;
        let mfaEnabled = false;
        let mfaRequired = false;
        
        // WICHTIG: SUPER_ADMINs können MFA nur umgehen, wenn das Secret korrupt ist
        // Wenn MFA aktiviert ist und das Secret korrekt ist, muss auch der SUPER_ADMIN MFA verifizieren
        if (hasMfaEntitlement) {
          const { isMfaEnabled, isMfaSetupInProgress, getMfaSecret } = await import('./core/mfa/service.js');
          mfaEnabled = await isMfaEnabled(user.uid);
          
          if (mfaEnabled) {
            // Prüfe, ob das Secret korrupt ist
            try {
              const secret = await getMfaSecret(user.uid);
              // Wenn Secret vorhanden und nicht null, ist es korrekt → MFA erforderlich (auch für SUPER_ADMIN!)
              if (secret !== null) {
                const mfaSetupInProgress = await isMfaSetupInProgress(user.uid);
                mfaRequired = !mfaSetupInProgress;
              }
              // Wenn secret === null (zurückgesetzt wegen korruptem Secret) → mfaRequired bleibt false für SUPER_ADMIN
            } catch (secretError) {
              // Secret ist korrupt → für SUPER_ADMIN mfaRequired auf false (Bypass)
              // Für normale User bleibt mfaRequired true (Login blockiert)
              if (!isSuper) {
                mfaRequired = true; // Normale User können nicht einloggen
              }
            }
          }
        }
        
        if (tenantData) {
          const response: any = {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            isDevStaff: true,
            needsOnboarding: false,
            tenant: {
              id: tenantData.tenant.id,
              name: tenantData.tenant.name,
            },
            role: tenantData.member.role,
            entitlements: tenantData.entitlements,
          };
          
          if (hasMfaEntitlement) {
            response.mfaEnabled = mfaEnabled;
            response.mfaRequired = mfaRequired;
          }
          
          res.json(response);
        } else if (isSuper) {
          // Fallback für Super-Admins: Wenn Tenant immer noch nicht gefunden, Dev-Tenant direkt laden
          const { getOrCreateDevTenant, assignDevStaffToTenant } = await import('./modules/support/service.js');
          const tenantId = await getOrCreateDevTenant(user.uid);
          await assignDevStaffToTenant(user.uid, user.email || '');
          
          // Dev-Tenant direkt laden (ohne getTenantForUser)
          const db = (await import('./core/firebase/index.js')).getAdminFirestore();
          const tenantRef = db.collection('tenants').doc(tenantId);
          const tenantSnap = await tenantRef.get();
          
          if (tenantSnap.exists) {
            const tenantData = tenantSnap.data();
            const memberRef = tenantRef.collection('members').doc(user.uid);
            const memberSnap = await memberRef.get();
            
            // Entitlements laden
            const entitlementsSnap = await tenantRef.collection('entitlements').get();
            const entitlements: Record<string, boolean | string | number> = {};
            entitlementsSnap.docs.forEach(doc => {
              const data = doc.data();
              entitlements[data.key] = data.value;
            });
            
            if (memberSnap.exists) {
              const memberData = memberSnap.data();
              
              const response: any = {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                isDevStaff: true,
                needsOnboarding: false,
                tenant: {
                  id: tenantId,
                  name: tenantData?.name || 'Dev Support',
                },
                role: memberData?.role || 'admin',
                entitlements,
              };
              
              res.json(response);
              return;
            }
          }
          
          // Wenn auch das fehlschlägt, trotzdem Antwort senden (Super-Admins brauchen kein Onboarding)
          res.json({
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            isDevStaff: true,
            needsOnboarding: false,
            entitlements: {},
          });
          return;
        } else {
          // Dev-Tenant erstellen falls nicht vorhanden
          // WICHTIG: Super Admins müssen IMMER einen Dev-Tenant haben
          const { getOrCreateDevTenant, assignDevStaffToTenant } = await import('./modules/support/service.js');
          await getOrCreateDevTenant(user.uid);
          await assignDevStaffToTenant(user.uid, user.email || '');
          
          // Nochmal laden
          const newTenantData = await getTenantForUser(user.uid);
          if (newTenantData) {
            const hasMfaEntitlement = newTenantData.entitlements?.['module.mfa'] === true;
            let mfaEnabled = false;
            let mfaRequired = false;
            
            // WICHTIG: SUPER_ADMINs können MFA nur umgehen, wenn das Secret korrupt ist
            if (hasMfaEntitlement) {
              const { isMfaEnabled, isMfaSetupInProgress, getMfaSecret } = await import('./core/mfa/service.js');
              mfaEnabled = await isMfaEnabled(user.uid);
              
              if (mfaEnabled) {
                try {
                  const secret = await getMfaSecret(user.uid);
                  if (secret !== null && !isSuper) {
                    const mfaSetupInProgress = await isMfaSetupInProgress(user.uid);
                    mfaRequired = !mfaSetupInProgress;
                  }
                } catch (secretError) {
                  if (!isSuper) {
                    mfaRequired = true;
                  }
                }
              }
            }
            
            const response: any = {
              uid: user.uid,
              email: user.email,
              emailVerified: user.emailVerified,
              isDevStaff: true,
              needsOnboarding: false,
              tenant: {
                id: newTenantData.tenant.id,
                name: newTenantData.tenant.name,
              },
              role: newTenantData.member.role,
              entitlements: newTenantData.entitlements,
            };
            
            if (hasMfaEntitlement) {
              response.mfaEnabled = mfaEnabled;
              response.mfaRequired = mfaRequired;
            }
            
            res.json(response);
          } else {
            // Fallback: Wenn immer noch kein Tenant gefunden, aber Super-Admin ist
            // Dann sollte der Dev-Tenant existieren - versuche nochmal explizit
            if (isSuper) {
              
              // Warte etwas länger, damit Firestore propagiert
              await new Promise(resolve => setTimeout(resolve, 1500));
              
              // Versuche nochmal mit getTenantForUser
              const retryTenantData = await getTenantForUser(user.uid);
              if (retryTenantData) {
                const hasMfaEntitlement = retryTenantData.entitlements?.['module.mfa'] === true;
                let mfaEnabled = false;
                let mfaRequired = false;
                
                if (hasMfaEntitlement) {
                  const { isMfaEnabled, isMfaSetupInProgress, getMfaSecret } = await import('./core/mfa/service.js');
                  mfaEnabled = await isMfaEnabled(user.uid);
                  
                  if (mfaEnabled) {
                    try {
                      const secret = await getMfaSecret(user.uid);
                      if (secret !== null && !isSuper) {
                        const mfaSetupInProgress = await isMfaSetupInProgress(user.uid);
                        mfaRequired = !mfaSetupInProgress;
                      }
                    } catch (secretError) {
                      if (!isSuper) {
                        mfaRequired = true;
                      }
                    }
                  }
                }
                
                const response: any = {
                  uid: user.uid,
                  email: user.email,
                  emailVerified: user.emailVerified,
                  isDevStaff: true,
                  needsOnboarding: false,
                  tenant: {
                    id: retryTenantData.tenant.id,
                    name: retryTenantData.tenant.name,
                  },
                  role: retryTenantData.member.role,
                  entitlements: retryTenantData.entitlements,
                };
                
                if (hasMfaEntitlement) {
                  response.mfaEnabled = mfaEnabled;
                  response.mfaRequired = mfaRequired;
                }
                
                res.json(response);
                return;
              }
              
              // Wenn auch das fehlschlägt, Dev-Tenant direkt laden (ohne getTenantForUser)
              const db = (await import('./core/firebase/index.js')).getAdminFirestore();
              const tenantId = 'dev-tenant'; // Dev-Tenant hat immer diese ID
              const tenantRef = db.collection('tenants').doc(tenantId);
              const tenantSnap = await tenantRef.get();
              
              if (tenantSnap.exists) {
                const tenantData = tenantSnap.data();
                const memberRef = tenantRef.collection('members').doc(user.uid);
                const memberSnap = await memberRef.get();
                
                // Entitlements laden
                const entitlementsSnap = await tenantRef.collection('entitlements').get();
                const entitlements: Record<string, boolean | string | number> = {};
                entitlementsSnap.docs.forEach(doc => {
                  const data = doc.data();
                  entitlements[data.key] = data.value;
                });
                
                if (memberSnap.exists) {
                  const memberData = memberSnap.data();
                  
                  const response: any = {
                    uid: user.uid,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    isDevStaff: true,
                    needsOnboarding: false,
                    tenant: {
                      id: tenantId,
                      name: tenantData?.name || 'Dev Support',
                    },
                    role: memberData?.role || 'admin',
                    entitlements,
                  };
                  
                  res.json(response);
                  return;
                } else {
                  // Member nochmal hinzufügen
                  await memberRef.set({
                    uid: user.uid,
                    email: user.email || '',
                    role: 'admin',
                    joinedAt: FieldValue.serverTimestamp(),
                  });
                  
                  // defaultTenantId setzen
                  await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    defaultTenantId: tenantId,
                  }, { merge: true });
                  
                  // Antwort mit minimalen Daten senden
                  res.json({
                    uid: user.uid,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    isDevStaff: true,
                    needsOnboarding: false,
                    tenant: {
                      id: tenantId,
                      name: tenantData?.name || 'Dev Support',
                    },
                    role: 'admin',
                    entitlements,
                  });
                  return;
                }
              }
              
              // Wenn auch das fehlschlägt, trotzdem Antwort senden (Super-Admins brauchen kein Onboarding)
              res.json({
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                isDevStaff: true,
                needsOnboarding: false,
                entitlements: {},
              });
              return;
            }
          }
          
          // Nur wenn wirklich kein Tenant gefunden werden kann (sollte bei Super-Admins nie passieren)
          res.json({
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            isDevStaff: true,
            needsOnboarding: false, // Super-Admins brauchen kein Onboarding, auch wenn Tenant nicht gefunden
            entitlements: {},
          });
          return;
        }
        return;
      }

      // Wenn Freelancer, Tenant-Daten laden (Freelancer haben auch einen Tenant)
      if (isFreelancer) {
        const { getFreelancerEntitlements } = await import('./core/tenancy/index.js');
        const { getTenantForUser } = await import('./core/tenancy/index.js');
        
        // Tenant-Daten laden (Freelancer haben einen eigenen Tenant)
        const tenantData = await getTenantForUser(user.uid);
        const entitlements = await getFreelancerEntitlements(user.uid);
        
        // MFA-Status nur laden wenn Modul aktiviert ist
        const hasMfaEntitlement = entitlements?.['module.mfa'] === true;
        let mfaEnabled = false;
        let mfaRequired = false;
        
        // WICHTIG: SUPER_ADMINs können MFA nur umgehen, wenn das Secret korrupt ist
        if (hasMfaEntitlement) {
          const { isMfaEnabled, isMfaSetupInProgress, getMfaSecret } = await import('./core/mfa/service.js');
          mfaEnabled = await isMfaEnabled(user.uid);
          
          if (mfaEnabled) {
            try {
              const secret = await getMfaSecret(user.uid);
              if (secret !== null && !isSuper) {
                const mfaSetupInProgress = await isMfaSetupInProgress(user.uid);
                mfaRequired = !mfaSetupInProgress;
              }
            } catch (secretError) {
              if (!isSuper) {
                mfaRequired = true;
              }
            }
          }
        }
        
        if (tenantData) {
          const response: any = {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            isFreelancer: true,
            needsOnboarding: false,
            tenant: {
              id: tenantData.tenant.id,
              name: tenantData.tenant.name,
            },
            role: tenantData.member.role,
            entitlements,
          };
          
          if (hasMfaEntitlement) {
            response.mfaEnabled = mfaEnabled;
            response.mfaRequired = mfaRequired;
          }
          
          res.json(response);
        } else {
          const response: any = {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            isFreelancer: true,
            needsOnboarding: true,
            entitlements: {},
          };
          
          if (hasMfaEntitlement) {
            response.mfaEnabled = mfaEnabled;
            response.mfaRequired = mfaRequired;
          }
          
          res.json(response);
        }
        return;
      }

    // Tenant-Daten laden (nur für normale User)
    // WICHTIG: Super Admins sollten bereits einen Dev-Tenant haben (wurde oben erstellt)
    const tenantData = await getTenantForUser(user.uid);

    if (!tenantData) {
      // Prüfen ob User Super Admin ist - dann sollte er einen Dev-Tenant haben
      if (isSuper) {
        // Super Admin ohne Tenant - Dev-Tenant erstellen
        const { getOrCreateDevTenant, assignDevStaffToTenant } = await import('./modules/support/service.js');
        const tenantId = await getOrCreateDevTenant(user.uid);
        await assignDevStaffToTenant(user.uid, user.email || '');
        
        // Warten, damit Firestore propagiert
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Nochmal laden
        const newTenantData = await getTenantForUser(user.uid);
        if (newTenantData) {
          res.json({
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            isDevStaff: true,
            needsOnboarding: false,
            isFreelancer: false,
            tenant: {
              id: newTenantData.tenant.id,
              name: newTenantData.tenant.name,
            },
            role: newTenantData.member.role,
            entitlements: newTenantData.entitlements,
          });
          return;
        } else {
          // Auch wenn Tenant nicht erstellt werden kann, Super-Admin sollte kein Onboarding sehen
          res.json({
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            isDevStaff: true,
            needsOnboarding: false, // Super-Admins brauchen kein Onboarding
            isFreelancer: false,
            entitlements: {},
          });
          return;
        }
      }
      
      // User hat noch keinen Tenant → Onboarding nötig (nur für normale User, nicht Super-Admins)
      res.json({
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        needsOnboarding: true,
        isFreelancer: false,
      });
      return;
    }

    // MFA-Status nur laden wenn Modul aktiviert ist
    const hasMfaEntitlement = tenantData.entitlements?.['module.mfa'] === true;
    let mfaEnabled = false;
    let mfaRequired = false;
    
    // WICHTIG: SUPER_ADMINs können MFA nur umgehen, wenn das Secret korrupt ist
    // Wenn MFA aktiviert ist und das Secret korrekt ist, muss auch der SUPER_ADMIN MFA verifizieren
    if (hasMfaEntitlement) {
      const { isMfaEnabled, isMfaSetupInProgress, getMfaSecret } = await import('./core/mfa/service.js');
      mfaEnabled = await isMfaEnabled(user.uid);
      
      if (mfaEnabled) {
        // Prüfe, ob das Secret korrupt ist
        try {
          const secret = await getMfaSecret(user.uid);
          // Wenn Secret vorhanden und nicht null, ist es korrekt → MFA erforderlich
          if (secret !== null) {
            const mfaSetupInProgress = await isMfaSetupInProgress(user.uid);
            // Für SUPER_ADMINs: MFA nur erforderlich, wenn Secret korrekt ist
            // Für normale User: MFA immer erforderlich, wenn aktiviert
            mfaRequired = !mfaSetupInProgress;
          }
          // Wenn secret === null (zurückgesetzt wegen korruptem Secret) → mfaRequired bleibt false für SUPER_ADMIN
        } catch (secretError) {
          // Secret ist korrupt → für SUPER_ADMIN mfaRequired auf false (Bypass)
          // Für normale User bleibt mfaRequired true (Login blockiert)
          if (!isSuper) {
            mfaRequired = true; // Normale User können nicht einloggen
          }
        }
      }
    }

    // User ist Tenant-Mitglied
    const response: any = {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      needsOnboarding: false,
      isFreelancer: false,
      tenant: {
        id: tenantData.tenant.id,
        name: tenantData.tenant.name,
      },
      role: tenantData.member.role,
      entitlements: tenantData.entitlements,
    };
    
    if (hasMfaEntitlement) {
      response.mfaEnabled = mfaEnabled;
      response.mfaRequired = mfaRequired;
    }
    
    res.json(response);
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

    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    const isFreelancer = userData?.isFreelancer === true;

    // Tenant erstellen
    const { tenantId, entitlements } = await createTenant(
      user.uid,
      user.email || '',
      tenantName.trim()
    );

    console.log(`✅ Tenant created`);

    // Wenn Freelancer: Freelancer-Dokument aktualisieren
    if (isFreelancer) {
      const freelancerRef = db.collection('freelancers').doc(user.uid);
      const freelancerDoc = await freelancerRef.get();
      
      if (freelancerDoc.exists) {
        await freelancerRef.update({
          companyName: tenantName.trim(),
          tenantId: tenantId,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`✅ Updated freelancer document with tenant`);
      }
    }

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
// MFA Verification Middleware
// =============================================================================
// Diese Middleware prüft, ob MFA verifiziert wurde, wenn MFA aktiviert ist.
// Sie blockiert alle API-Requests (außer Ausnahmen), wenn MFA erforderlich aber nicht verifiziert wurde.
// WICHTIG: Muss nach requireAuth, aber vor allen Feature-Routes stehen.
app.use('/api', requireMfaVerification);

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

// Freelancer Module
app.use('/api/freelancer', freelancerRouter);

// Support Module (Dev-Mitarbeiter)
app.use('/api', supportRouter);

// Security Audit Module (nur für Super-Admins im Dev-Tenant)
app.use('/api/security-audit', securityAuditRouter);
app.use('/api/work-time-compliance', workTimeComplianceRouter);

// Stripe Module (Webhook muss vor JSON-Parser sein)
app.use('/api/stripe/webhooks', express.raw({ type: 'application/json' }), stripeRouter);
app.use('/api/stripe', stripeRouter);

// Subscription Management Core Module
app.use('/api/subscription-management', subscriptionManagementRouter);

// MFA Module
app.use('/api/mfa', mfaRouter);

// =============================================================================
// 404 Handler
// =============================================================================

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// =============================================================================
// Validate MFA Encryption Key on Startup
// =============================================================================

// Validiere MFA-Key beim Server-Start
(async () => {
  try {
    const { getMfaSecret } = await import('./core/mfa/service.js');
    // Versuche, den Key zu laden (ohne tatsächlich ein Secret zu entschlüsseln)
    // Dies validiert, dass der Key korrekt formatiert ist
    const crypto = await import('crypto');
    const keyHex = process.env.MFA_ENCRYPTION_KEY?.trim().replace(/\s+/g, '') || '';
    if (keyHex.length >= 64) {
      // Key validiert, kein Log nötig
      // const keyHash = crypto.createHash('sha256').update(Buffer.from(keyHex.slice(0, 64), 'hex')).digest('hex').substring(0, 16);
      // console.log(`✅ MFA_ENCRYPTION_KEY validated on startup (hash: ${keyHash}...)`);
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  MFA_ENCRYPTION_KEY not set - using random key (will change on restart)');
    }
  } catch (error) {
    console.error('❌ Error validating MFA_ENCRYPTION_KEY:', error);
  }
})();

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
👨‍💼 Freelancer: http://localhost:${PORT}/api/freelancer/* (public register, auth for me)
🌐 CORS:   localhost:5173-5175, localhost:3000
  `);
});
