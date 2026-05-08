import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getStripe, createCheckoutSession } from "./server/stripe.ts";

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'studio-8169038053-73336'
  });
}

const db = admin.firestore();

// Setup Firestore Listener for Checkout Sessions
// This mimics the Stripe Firebase Extension behavior using our consolidated server
function setupFirestoreListeners() {
  console.log("Setting up Firestore listeners for Stripe Checkout Sessions...");
  
  db.collectionGroup('checkout_sessions').onSnapshot(async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        const docRef = change.doc.ref;
        
        // Only process if it doesn't have a URL or error yet
        if (!data.url && !data.error) {
          console.log(`Processing checkout session request: ${change.doc.id}`);
          
          try {
            const userId = docRef.parent.parent?.id;
            if (!userId) throw new Error("Could not determine userId from path");

            // Get user email from Firestore
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            const userEmail = userData?.email;

            if (!userEmail) throw new Error(`User email not found for ID: ${userId}`);

            const planType = data.metadata?.planType || 'monthly';
            const isTrial = data.metadata?.isTrial === 'true';
            
            // User provided specific price IDs
            const priceId = planType === 'monthly' 
              ? 'price_1TG0mBBMbxh6jv0CIkwSRj7u' 
              : 'price_1TG0muBMbxh6jv0CVCc9KOPP';

            const session = await createCheckoutSession({
              userId,
              userEmail,
              priceId,
              planType,
              isTrial,
            });

            await docRef.update({
              url: session.url,
              sessionId: session.id,
              created: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`Successfully generated Stripe URL for session: ${change.doc.id}`);
          } catch (error: any) {
            console.error(`Error generating checkout session: ${error.message}`);
            await docRef.update({
              error: {
                message: error.message
              }
            });
          }
        }
      }
    }
  }, (error) => {
    console.error("Firestore listener error:", error);
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security & Performance Middleware
  app.use(cors());
  app.use(compression());

  // Stripe Webhook needs raw body for signature verification
  app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as any;

          // Validate that the client_reference_id exists to avoid crashes
          if (!session.client_reference_id) {
            console.error('Missing client_reference_id in session:', session.id);
            return res.status(400).send('Missing client_reference_id');
          }

          try {
            // Update user record with merge: true as requested
            await admin.firestore().collection('users').doc(session.client_reference_id).set({
              isPremium: true,
              subscriptionStatus: 'active',
              stripeCustomerId: session.customer,
              planType: session.metadata?.plan || 'monthly',
              updatedAt: new Date()
            }, { merge: true });

            console.log(`User ${session.client_reference_id} upgraded.`);
          } catch (err: any) {
            console.error('Firestore Error:', err.message);
            // Return a 500 so Stripe retries
            return res.status(500).send(`Firestore Error: ${err.message}`);
          }
          break;
        }
        case 'invoice.paid': {
          const invoice = event.data.object as any;
          const customerId = invoice.customer;
          
          // Find user by customerId
          const usersSnapshot = await admin.firestore().collection('users')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();
          
          if (!usersSnapshot.empty) {
            const userId = usersSnapshot.docs[0].id;
            await admin.firestore().collection('users').doc(userId).update({
              isPremium: true,
              subscriptionStatus: 'active',
              lastPaymentDate: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Invoice paid for user: ${userId}`);
          }
          break;
        }
        case 'customer.subscription.updated': {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;
          const status = subscription.status; // e.g., 'active', 'trialing', 'past_due', 'canceled'
          
          // Find user by customerId
          const usersSnapshot = await admin.firestore().collection('users')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();
          
          if (!usersSnapshot.empty) {
            const userId = usersSnapshot.docs[0].id;
            await admin.firestore().collection('users').doc(userId).update({
              isPremium: status === 'active' || status === 'trialing',
              subscriptionStatus: status,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Subscription updated for user: ${userId} - Status: ${status}`);
          }
          break;
        }
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as any;
          const customerId = subscription.customer;
          
          // Find user by customerId
          const usersSnapshot = await admin.firestore().collection('users')
            .where('stripeCustomerId', '==', customerId)
            .limit(1)
            .get();
          
          if (!usersSnapshot.empty) {
            const userId = usersSnapshot.docs[0].id;
            await admin.firestore().collection('users').doc(userId).update({
              isPremium: false,
              subscriptionStatus: 'expired',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`Subscription expired for user: ${userId}`);
          }
          break;
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error('Error processing webhook:', err);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Stripe Checkout Session Endpoint
  app.post('/api/create-checkout-session', async (req, res) => {
    const { userId, userEmail, planType, isTrial } = req.body;

    if (!userId || !userEmail || !planType) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      // User provided specific price IDs
      const priceId = planType === 'monthly' 
        ? 'price_1TG0mBBMbxh6jv0CIkwSRj7u' 
        : 'price_1TG0muBMbxh6jv0CVCc9KOPP';

      const session = await createCheckoutSession({
        userId,
        userEmail,
        priceId,
        planType,
        isTrial: !!isTrial,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Checkout Session Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Subscription Plans (Products/Prices)
  app.get('/api/subscription-plans', async (req, res) => {
    const stripe = getStripe();
    try {
      const monthlyPriceId = 'price_1TG0mBBMbxh6jv0CIkwSRj7u';
      const yearlyPriceId = 'price_1TG0muBMbxh6jv0CVCc9KOPP';

      // Fetch prices from Stripe to get the most up-to-date info
      const [monthlyPrice, yearlyPrice] = await Promise.all([
        stripe.prices.retrieve(monthlyPriceId, { expand: ['product'] }),
        stripe.prices.retrieve(yearlyPriceId, { expand: ['product'] })
      ]);

      const plans = [
        {
          id: 'monthly',
          priceId: monthlyPrice.id,
          name: (monthlyPrice.product as any).name || 'Monthly Pulse',
          price: monthlyPrice.unit_amount ? monthlyPrice.unit_amount / 100 : 9.99,
          currency: monthlyPrice.currency,
          interval: 'month',
          description: (monthlyPrice.product as any).description || 'Perfect for short-term health tracking.',
          features: [
            'Full AI Clinical Insights',
            'Unlimited Lab Registry',
            'Secure PHI Communications',
            '24/7 AI Health Consultant'
          ]
        },
        {
          id: 'yearly',
          priceId: yearlyPrice.id,
          name: (yearlyPrice.product as any).name || 'Annual Wellness',
          price: yearlyPrice.unit_amount ? yearlyPrice.unit_amount / 100 : 99.99,
          currency: yearlyPrice.currency,
          interval: 'year',
          description: (yearlyPrice.product as any).description || 'The best value for long-term health optimization.',
          features: [
            'Everything in Monthly',
            'Save 20% Annually',
            'Priority AI Processing',
            'Advanced Risk Assessment'
          ]
        }
      ];

      res.json(plans);
    } catch (error: any) {
      console.error("Fetch Plans Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Request Logging (Filtered for API and important routes)
  app.use((req, res, next) => {
    // Skip logging for static assets and Vite internal requests to reduce noise
    const isStaticAsset = /\.(tsx?|jsx?|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|otf)$/.test(req.url);
    const isViteRequest = req.url.startsWith('/@vite') || req.url.startsWith('/node_modules');
    
    if (isStaticAsset || isViteRequest) {
      return next();
    }

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${new Date().toISOString()} | ${req.method} ${req.url} | ${res.statusCode} | ${duration}ms`);
    });
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development'
    });
  });

  // Telehealth recording metadata endpoint
  app.post("/api/telehealth/recordings", (req, res) => {
    const { callId, recordingUrl, duration } = req.body;
    if (!callId || !recordingUrl) {
      return res.status(400).json({ error: "Missing required recording metadata" });
    }
    console.log(`Recording received for call ${callId}: ${recordingUrl}`);
    res.json({ success: true, message: "Recording metadata saved" });
  });

  // AI Service Endpoint (Stub for client-side migration)
  app.post("/api/ai/analyze", async (req, res) => {
    res.status(501).json({ error: "Gemini AI analysis is now handled client-side for better security and performance." });
  });

  // Custom Stripe Checkout Session Endpoint (as requested)
  app.post('/createCheckoutSession', async (req, res) => {
    const { plan, userId, userEmail, isTrial } = req.body;

    let priceId: string;
    if (plan === 'monthly') {
      priceId = 'price_1TG0mBBMbxh6jv0CIkwSRj7u';
    } else if (plan === 'yearly') {
      priceId = 'price_1TG0muBMbxh6jv0CVCc9KOPP';
    } else {
      // Fallback or error
      priceId = 'price_1TG0mBBMbxh6jv0CIkwSRj7u';
    }

    try {
      const session = await createCheckoutSession({
        userId,
        userEmail,
        priceId,
        planType: plan as 'monthly' | 'yearly',
        isTrial: !!isTrial,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Custom Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      maxAge: '1d',
      etag: true
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[Server Error] ${new Date().toISOString()}:`, err);
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
      timestamp: new Date().toISOString()
    });
  });

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pulse Health Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });

  // Graceful Shutdown
  const shutdown = () => {
    console.log('Shutting down server...');
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start Firestore listeners
  setupFirestoreListeners();
}

startServer().catch((err) => {
  console.error("CRITICAL: Failed to start server:", err);
  process.exit(1);
});
