import { Router } from 'express';
import { protect } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { uploadDocumentController } from '../controllers/document/upload-document';
import { listUserDocumentsController } from '../controllers/document/list-user-documents';

const router = Router();

router.use(protect);

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
