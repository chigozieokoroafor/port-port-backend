import  express, { Request, Response, NextFunction, Router } from "express";
import { webhook } from "../controllers/payment.controller";

const router = Router();

router.post('/webhook',
    express.raw({ type: 'application/json' }),
    webhook);

export default router;