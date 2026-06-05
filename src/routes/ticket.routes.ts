import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { validateAddConversation, validateTicketById } from "../validators/ticket.validator";
import { validate } from '../middleware/validate.middleware';
import { addConversation, create, getTicketById, getTicketByReference, getTickets } from "../controllers/ticket.controller";

const router = Router();
router.use(protect);

router.post('/create', create);

router.post('/send-message', validateAddConversation, validate, addConversation);

router.get('/:id', validateTicketById, validate, getTicketById);

router.get('/', getTickets);

router.get('/ref', getTicketByReference);

export default router;

