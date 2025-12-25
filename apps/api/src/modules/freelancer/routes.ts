/**
 * Freelancer Routes
 *
 * Express Router für Freelancer-Endpoints.
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth, type AuthenticatedRequest } from '../../core/auth/index.js';
import { getAdminFirestore } from '../../core/firebase/index.js';
import {
  registerFreelancer,
  getFreelancer,
  uploadVerificationDocument,
  getVerificationDocumentUrl,
  updateFreelancerProfile,
} from './service.js';
import { createDeletionRequest } from '../support/service.js';
import {
  getFreelancerEntitlements,
  setFreelancerEntitlement,
} from '../../core/tenancy/index.js';
import type { RegisterFreelancerRequest } from './types.js';

const router = Router();

// Multer für File-Uploads (Memory Storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// =============================================================================
// Public Routes
// =============================================================================

/**
 * POST /api/freelancer/register
 * Registriert einen neuen Freelancer.
 */
router.post('/register', async (req, res) => {
  const body = req.body as RegisterFreelancerRequest;

  try {
    const freelancer = await registerFreelancer(body);

    res.status(201).json({
      freelancer,
      message: 'Freelancer registered successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register freelancer';

    if (message.includes('required') || message.includes('Valid') || message.includes('must be')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }
    if (message.includes('already exists')) {
      res.status(409).json({ error: message, code: 'DUPLICATE' });
      return;
    }
    if (message.includes('Failed to create user account')) {
      res.status(500).json({ error: message, code: 'AUTH_ERROR' });
      return;
    }

    console.error('Error in POST /freelancer/register:', error);
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Protected Routes
// =============================================================================

/**
 * GET /api/freelancer/me
 * Lädt das eigene Freelancer-Profil.
 */
router.get('/me', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isFreelancer) {
      res.status(403).json({ error: 'Only freelancers can access this endpoint' });
      return;
    }

    const freelancer = await getFreelancer(user.uid);

    if (!freelancer) {
      res.status(404).json({ error: 'Freelancer profile not found' });
      return;
    }

    res.json({ freelancer });
  } catch (error) {
    console.error('Error in GET /freelancer/me:', error);
    const message = error instanceof Error ? error.message : 'Failed to get freelancer';
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/freelancer/me
 * Aktualisiert das eigene Freelancer-Profil.
 */
router.patch('/me', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isFreelancer) {
      res.status(403).json({ error: 'Only freelancers can update their profile' });
      return;
    }

    const { displayName, firstName, lastName, email, phone, address, companyName } = req.body;

    const updatedFreelancer = await updateFreelancerProfile(user.uid, {
      displayName,
      firstName,
      lastName,
      email,
      phone,
      address,
      companyName,
    });

    res.json({ 
      freelancer: updatedFreelancer,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /freelancer/me:', error);
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    
    if (message.includes('must be at least')) {
      res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
      return;
    }
    if (message === 'Freelancer not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }
    
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/freelancer/me
 * Erstellt einen Löschauftrag für das eigene Freelancer-Konto (DSGVO-konform).
 * Das Konto wird nicht sofort gelöscht, sondern ein Antrag wird an das Support-Team gesendet.
 */
router.delete('/me', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isFreelancer) {
      res.status(403).json({ error: 'Only freelancers can request account deletion' });
      return;
    }

    // Bestätigung erforderlich
    const { confirmation, reason } = req.body;
    if (confirmation !== 'DELETE_MY_ACCOUNT') {
      res.status(422).json({ 
        error: 'Confirmation required. Send { "confirmation": "DELETE_MY_ACCOUNT" }',
        code: 'CONFIRMATION_REQUIRED',
      });
      return;
    }

    // Freelancer-Daten laden
    const freelancer = await getFreelancer(user.uid);
    if (!freelancer) {
      res.status(404).json({ error: 'Freelancer profile not found', code: 'NOT_FOUND' });
      return;
    }

    // Löschauftrag erstellen
    const deletionRequest = await createDeletionRequest(
      user.uid,
      user.email || freelancer.email,
      freelancer.displayName || user.email || '',
      'freelancer',
      reason
    );

    res.json({ 
      message: 'Deletion request submitted successfully. Your account will be reviewed by our support team. Data will be retained for 30 days after approval before permanent deletion.',
      requestId: deletionRequest.uid,
      status: deletionRequest.status,
    });
  } catch (error) {
    console.error('Error in DELETE /freelancer/me:', error);
    const message = error instanceof Error ? error.message : 'Failed to create deletion request';
    
    if (message.includes('already exists')) {
      res.status(409).json({ error: message, code: 'DUPLICATE_REQUEST' });
      return;
    }
    
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/freelancer/entitlements
 * Lädt alle Entitlements für den eingeloggten Freelancer.
 */
router.get('/entitlements', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isFreelancer) {
      res.status(403).json({ error: 'Only freelancers can access this endpoint' });
      return;
    }

    const entitlements = await getFreelancerEntitlements(user.uid);

    res.json({ entitlements });
  } catch (error) {
    console.error('Error in GET /freelancer/entitlements:', error);
    const message = error instanceof Error ? error.message : 'Failed to get entitlements';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/freelancer/entitlements
 * Setzt Entitlements für einen Freelancer (nur SuperAdmin/Dev).
 */
router.post('/entitlements', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { freelancerUid, key, value } = req.body;

  try {
    // Prüfen ob User SuperAdmin ist (TODO: SuperAdmin-Check implementieren)
    // Für jetzt: Nur wenn user.uid === freelancerUid (Freelancer kann eigene Entitlements nicht setzen)
    // Oder SuperAdmin-Check hier einbauen
    
    // Prüfen ob Freelancer existiert
    const db = getAdminFirestore();
    const freelancerDoc = await db.collection('freelancers').doc(freelancerUid).get();
    if (!freelancerDoc.exists) {
      res.status(404).json({ error: 'Freelancer not found' });
      return;
    }

    if (!key || value === undefined) {
      res.status(422).json({ error: 'key and value are required' });
      return;
    }

    await setFreelancerEntitlement(freelancerUid, key, value);

    res.json({
      message: 'Entitlement set successfully',
      freelancerUid,
      key,
      value,
    });
  } catch (error) {
    console.error('Error in POST /freelancer/entitlements:', error);
    const message = error instanceof Error ? error.message : 'Failed to set entitlement';
    res.status(500).json({ error: message });
  }
});

// =============================================================================
// Verifizierung
// =============================================================================

/**
 * POST /api/freelancer/verification/upload
 * Lädt einen Gewerbeschein hoch.
 */
router.post(
  '/verification/upload',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    const { user } = req as AuthenticatedRequest;

    try {
      // Prüfen ob User ein Freelancer ist
      const db = getAdminFirestore();
      const userDoc = await db.collection('users').doc(user.uid).get();
      const userData = userDoc.data();
      
      if (!userData?.isFreelancer) {
        res.status(403).json({ error: 'Only freelancers can upload verification documents' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded', code: 'MISSING_FILE' });
        return;
      }

      const result = await uploadVerificationDocument(user.uid, {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      res.status(201).json({
        documentPath: result.documentPath,
        message: 'Verification document uploaded successfully',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload document';

      if (message === 'Freelancer not found') {
        res.status(404).json({ error: message, code: 'NOT_FOUND' });
        return;
      }
      if (message.includes('Invalid file type') || message.includes('File size exceeds')) {
        res.status(422).json({ error: message, code: 'VALIDATION_ERROR' });
        return;
      }

      console.error('Error in POST /freelancer/verification/upload:', error);
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /api/freelancer/verification/status
 * Lädt den Verifizierungsstatus.
 */
router.get('/verification/status', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isFreelancer) {
      res.status(403).json({ error: 'Only freelancers can access verification status' });
      return;
    }

    const freelancer = await getFreelancer(user.uid);

    if (!freelancer) {
      res.status(404).json({ error: 'Freelancer profile not found' });
      return;
    }

    res.json({
      verificationStatus: freelancer.verificationStatus || null,
      verificationSubmittedAt: freelancer.verificationSubmittedAt,
      verificationReviewedAt: freelancer.verificationReviewedAt,
      verificationRejectionReason: freelancer.verificationRejectionReason,
    });
  } catch (error) {
    console.error('Error in GET /freelancer/verification/status:', error);
    const message = error instanceof Error ? error.message : 'Failed to get verification status';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/freelancer/verification/document
 * Lädt die Download-URL für das Verifizierungs-Dokument.
 */
router.get('/verification/document', requireAuth, async (req, res) => {
  const { user } = req as AuthenticatedRequest;

  try {
    // Prüfen ob User ein Freelancer ist
    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data();
    
    if (!userData?.isFreelancer) {
      res.status(403).json({ error: 'Only freelancers can access verification documents' });
      return;
    }

    const url = await getVerificationDocumentUrl(user.uid, user.uid);

    res.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get document URL';

    if (message === 'Freelancer not found' || message === 'Verification document not found') {
      res.status(404).json({ error: message, code: 'NOT_FOUND' });
      return;
    }

    console.error('Error in GET /freelancer/verification/document:', error);
    res.status(500).json({ error: message });
  }
});

export { router as freelancerRouter };

