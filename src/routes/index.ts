import { Router } from 'express';
import authRoutes from './auth.routes';
import adminRoutes from './admin.routes';
import quoteRequestRoutes from './quoteRequest.routes';
import quoteRoutes from './quote.routes';
// import quoteRequestRoutes from './quoteRequest';
// import quoteRoutes from './quote';
// import paymentRoutes from './payment';
// import shipmentRoutes from './shipment';
// import documentRoutes from './document';
// import contentRoutes from './content';
// import routeRoutes from './route';
// import reportRoutes from './report';
// import notificationRoutes from './notification';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/quotes', quoteRequestRoutes);
router.use('/quotes/admin', quoteRoutes);
// router.use('/payments', paymentRoutes);
// router.use('/shipments', shipmentRoutes);
// router.use('/documents', documentRoutes);
// router.use('/content', contentRoutes);
// router.use('/routes', routeRoutes);
// router.use('/admin/reports', reportRoutes);
// router.use('/admin/notifications', notificationRoutes);

// API documentation route
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Port2Port API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      quotes: '/api/quotes',
      payments: '/api/payments',
      shipments: '/api/shipments',
      documents: '/api/documents',
      content: '/api/content',
      routes: '/api/routes',
      reports: '/api/admin/reports',
      notifications: '/api/admin/notifications',
    },
  });
});

export default router;