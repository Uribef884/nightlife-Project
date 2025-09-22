import { Router } from 'express';
import { sseController } from '../controllers/sse.controller';

const router = Router();

// SSE endpoint for transaction status updates
router.get('/transaction/:transactionId', sseController.getTransactionStatusStream);

export default router;
