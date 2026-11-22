import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { restrictToAdmin } from '../middleware/roleCheck.middleware';
import { upload } from '../middleware/upload.middleware';
import { uploadDocumentController } from '../controllers/document/upload-document';
import { listUserDocumentsController } from '../controllers/document/list-user-documents';
import { getAdminDocumentMetricsController } from '../controllers/admin/documents/get-metrics';
import { listAdminDocumentsController } from '../controllers/admin/documents/list-documents';
import { getAdminDocumentByIdController } from '../controllers/admin/documents/get-document';
import { updateDocumentStatusController } from '../controllers/admin/documents/update-status';

const router = Router();

router.use(protect);

/**
 * @route   GET /api/documents/admin/metrics
 * @desc    Get document metrics for admin (all, approved, pending, rejected)
 * @access  Admin / SuperAdmin
 */
router.get('/admin/metrics', restrictToAdmin, getAdminDocumentMetricsController);

/**
 * @route   GET /api/documents/admin
 * @desc    List all documents for admin with pagination, search, and status filter
 * @access  Admin / SuperAdmin
 */
router.get('/admin', restrictToAdmin, listAdminDocumentsController);

/**
 * @route   GET /api/documents/admin/:id
 * @desc    Get single document details with related customer & shipment info for admin review
 * @access  Admin / SuperAdmin
 */
router.get('/admin/:id', restrictToAdmin, getAdminDocumentByIdController);

/**
 * @route   PATCH /api/documents/admin/:id/status
 * @desc    Approve or reject a document (Admin / SuperAdmin)
 * @access  Admin / SuperAdmin
 */
router.patch('/admin/:id/status', restrictToAdmin, updateDocumentStatusController);

/**
 * @route   GET /api/documents/user/:userId
 * @desc    List documents uploaded by a user (search by type/shipment ID, filter by status)
 * @access  Protected (Customer)
 */
router.get('/user/:userId', listUserDocumentsController);

/**
 * @route   POST /api/documents/upload
 * @desc    Upload a document file to Bunny Storage and save record in DB
 * @access  Protected (Customer / Admin)
 */
router.post('/upload', upload.single('file'), uploadDocumentController);

/**
 * @route   POST /api/documents
 * @desc    Upload a document file to Bunny Storage and save record in DB
 * @access  Protected (Customer / Admin)
 */
router.post('/', upload.single('file'), uploadDocumentController);

export default router;
