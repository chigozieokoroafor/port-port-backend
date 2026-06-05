import { Router } from "express";
import { protect } from "../middleware/auth.middleware";
import { create } from "../controllers/shipment.controller";

const router = Router();
router.use(protect);

router.post('/create', create);