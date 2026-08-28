# Port2Port Backend API

A robust backend API for a vehicle freight and RORO (Roll-on/Roll-off) shipping platform built with Node.js, TypeScript, Express, and MongoDB.

## 🚀 Features

- **Quote Request Management** - Customer quote submission and admin processing
- **Payment Processing** - Secure online payments via Stripe/PayPal
- **Shipment Tracking** - Real-time tracking from booking to delivery
- **Document Management** - Secure upload and storage of shipping documents
- **Admin Dashboard** - Role-based access control (Admin & SuperAdmin)
- **Content Management** - CMS for managing informational pages
- **Email Notifications** - Automated emails for quotes, payments, and shipments
- **Financial Reporting** - Revenue tracking and analytics (SuperAdmin only)

## 📋 Prerequisites

- **Node.js** >= 18.x
- **MongoDB** >= 5.x (local or Atlas)
- **npm** or **yarn**
- **Stripe Account** (for payments)
- **SendGrid Account** (for emails)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/sasomtech-Nig/port-Backend
cd p2p-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/p2p

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRE=7d

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# SendGrid
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@p2p.com

# AWS S3 (Optional - for file storage)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=p2p-documents

# SuperAdmin Credentials
SUPERADMIN_EMAIL=admin@p2p.com
SUPERADMIN_PASSWORD=ChangeThisPassword123!
```

### 4. Create SuperAdmin Account

```bash
npm run seed:superadmin
```

### 5. Start Development Server

```bash
npm run dev
```

The server will start at `http://localhost:5000`

## 📁 Project Structure

```
p2p-backend/
├── src/
│   ├── config/              # Configuration files (database, constants)
│   ├── controllers/         # Route controllers
│   ├── middleware/          # Custom middleware (auth, validation, error handling)
│   ├── models/              # Mongoose models
│   ├── routes/              # API routes
│   ├── services/            # Business logic (email, payment, storage)
│   ├── utils/               # Utility functions and helpers
│   ├── validators/          # Request validation schemas
│   ├── types/               # TypeScript type definitions
│   ├── scripts/             # Database seed scripts
│   ├── app.ts               # Express app configuration
│   └── server.ts            # Server entry point
├── uploads/                 # Temporary file uploads
├── logs/                    # Application logs
├── .env                     # Environment variables
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Admin Management (SuperAdmin Only)
- `POST /api/admin/invite` - Invite new admin
- `GET /api/admin/users` - List all admins
- `PUT /api/admin/users/:id` - Update admin
- `DELETE /api/admin/users/:id` - Delete admin

### Quote Requests (Public)
- `POST /api/quotes/request` - Submit quote request
- `GET /api/quotes/track/:referenceId` - Track quote status

### Quote Management (Admin)
- `GET /api/admin/quotes/requests` - List all requests
- `GET /api/admin/quotes/requests/:id` - Get request details
- `POST /api/admin/quotes/:requestId/generate` - Generate quote
- `POST /api/admin/quotes/:id/send` - Send quote to customer

### Payments (Public)
- `POST /api/payments/create-session` - Initialize payment
- `GET /api/payments/verify/:sessionId` - Verify payment
- `GET /api/payments/:id/receipt` - Download receipt

### Payments (Admin)
- `GET /api/admin/payments` - List all payments
- `POST /api/admin/payments/:id/refund` - Process refund

### Shipment Tracking (Public)
- `GET /api/shipments/track/:trackingNumber` - Track shipment
- `GET /api/shipments/:trackingNumber/history` - Get status history

### Shipment Management (Admin)
- `POST /api/admin/shipments` - Create shipment
- `PUT /api/admin/shipments/:id/status` - Update status
- `GET /api/admin/shipments` - List all shipments

### Documents
- `POST /api/documents/upload` - Upload document (public with quote reference)
- `GET /api/documents/:id/download` - Download document
- `GET /api/admin/documents` - List all documents (admin)

### Content Management (Admin)
- `GET /api/admin/content/pages` - List all pages
- `POST /api/admin/content/pages` - Create page
- `PUT /api/admin/content/pages/:id` - Update page

### Content (Public)
- `GET /api/content/pages` - List published pages
- `GET /api/content/pages/:slug` - Get page by slug

### Reporting (SuperAdmin Only)
- `GET /api/admin/reports/financial` - Financial reports
- `GET /api/admin/reports/quotes` - Quote statistics
- `GET /api/admin/reports/dashboard` - Dashboard overview

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

## 👥 User Roles

### SuperAdmin
- Full system access
- Can invite and manage other admins
- Access to financial reports
- All admin capabilities

### Admin
- Manage quotes and shipments
- Process payments
- Upload and verify documents
- Manage content pages
- Cannot access financial reports
- Cannot invite other admins

### Public (No Authentication)
- Submit quote requests
- Track shipments
- Make payments
- Upload documents (with quote reference)
- View published content

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 🏗️ Building for Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## 📧 Email Templates

Email notifications are sent for:
- Quote request confirmation (customer)
- New quote request notification (admin)
- Quote sent to customer
- Payment confirmation
- Shipment status updates

Configure email templates in SendGrid dashboard.

## 💳 Payment Integration

### Stripe Setup
1. Create a Stripe account at https://stripe.com
2. Get your API keys from the dashboard
3. Configure webhook endpoint: `https://yourdomain.com/stripe/webhook`
4. Add webhook secret to `.env`

### Supported Events
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.payment_failed`

## 📦 File Storage

### Option 1: AWS S3 (Recommended for Production)
- Configure AWS credentials in `.env`
- Files are stored in S3 bucket
- Presigned URLs for secure downloads

### Option 2: GridFS (MongoDB)
- Files stored in MongoDB
- Good for development
- No additional configuration needed

## 🔒 Security Features

- **Password Hashing** - bcrypt with salt rounds
- **JWT Authentication** - Secure token-based auth
- **Rate Limiting** - Prevent abuse and DDoS
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing
- **Input Validation** - express-validator
- **SQL Injection Prevention** - Mongoose parameterized queries
- **XSS Protection** - Input sanitization

## 📊 Database Indexes

Key indexes for performance:
- `adminUsers.email`
- `quoteRequests.referenceId`
- `quotes.quoteNumber`
- `payments.paymentReference`
- `shipments.trackingNumber`

## 🐛 Debugging

View logs in the `logs/` directory:
- `error.log` - Error logs only
- `combined.log` - All logs

## 🚀 Deployment

### Deploy to Heroku

```bash
# Login to Heroku
heroku login

# Create new app
heroku create p2p-backend

# Add MongoDB addon
heroku addons:create mongolab

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret

# Deploy
git push heroku main
```

### Deploy to DigitalOcean/AWS/Azure

1. Build the application: `npm run build`
2. Upload `dist/` folder to your server
3. Install dependencies: `npm install --production`
4. Set environment variables
5. Run with PM2: `pm2 start dist/server.js`

## 📝 Environment Variables Reference

| Variable                  |    Description                       | Required |
|---------------------------|--------------------------------------|----------|
| `NODE_ENV`                | Environment (development/production) | Yes      |
| `PORT`                    | Server port                          | Yes      |
| `MONGODB_URI`             | MongoDB connection string            | Yes      |
| `JWT_SECRET`              | JWT signing secret                   | Yes      |
| `JWT_EXPIRE`              | JWT expiration time                  | Yes      |
| `FRONTEND_URL`            |  Frontend application URL            | Yes      |
| `STRIPE_SECRET_KEY`       | Stripe API key                       | Yes      |
| `STRIPE_WEBHOOK_SECRET`   | Stripe webhook secret                | Yes      |
| `SENDGRID_API_KEY`        | SendGrid API key                     | Yes      |
| `SENDGRID_FROM_EMAIL`     | Sender email address                 | Yes      |
| `AWS_REGION`              | AWS region                           | No*.     |
| `AWS_ACCESS_KEY_ID`       | AWS access key                       | No*.     |
| `AWS_SECRET_ACCESS_KEY`   | AWS secret key                       | No*.     |
| `AWS_S3_BUCKET`           | S3 bucket name                       | No*.     |

*Required if using AWS S3 for file storage

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

Toluwani Oluwaranti - [@ti_toolu_](https://x.com/ti_toolu_)

## 🆘 Support

For support, email ranti@gmail.com.
