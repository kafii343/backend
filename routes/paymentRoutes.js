const express = require("express");
const cors = require("cors");
const {
  createTransaction,
  getTransactionStatus,
  updateBookingStatus,
  handleMidtransNotification
} = require("../controllers/paymentController");

// Define CORS options specifically for payment routes to handle Authorization header
const paymentCorsOptions = {
  origin: [
    "http://localhost:8080",    // Vite default port
    "http://localhost:5173",    // Vite default port
    "http://localhost:3000",    // React dev server
    "https://app.sandbox.midtrans.com",
    "https://simulator.sandbox.midtrans.com",
    "https://frontend-navy-xi-92.vercel.app",  // Vercel production
    "https://backend-rho-ten-82.vercel.app"   // Backend URL if needed
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
  credentials: true,
  optionsSuccessStatus: 200
};

// Function to create payment routes with pool dependency injection
const createPaymentRoutes = (pool) => {
  const router = express.Router();

  // Apply CORS specifically to payment routes to ensure Authorization header is allowed
  router.use(cors(paymentCorsOptions));

  // Add a preflight OPTIONS route for all payment endpoints
  router.options("*", cors(paymentCorsOptions));

  // 🧾 CREATE TRANSACTION - NO AUTH REQUIRED for public payment creation
  router.post("/create-transaction", (req, res) => {
    console.log("Processing create-transaction request", {
      body: req.body,
      headers: req.headers,
      origin: req.get('origin')
    });
    createTransaction(pool, req, res);
  });

  // 💳 GET TRANSACTION STATUS - NO AUTH REQUIRED for public status checks
  router.get("/transaction-status/:id", (req, res) => {
    console.log("Processing transaction-status request", {
      params: req.params,
      headers: req.headers,
      origin: req.get('origin')
    });
    getTransactionStatus(pool, req, res);
  });

  // UPDATE BOOKING STATUS - NO AUTH REQUIRED for webhook updates
  router.post("/update-status", (req, res) => {
    console.log("Processing update-status request", {
      body: req.body,
      headers: req.headers,
      origin: req.get('origin')
    });
    updateBookingStatus(pool, req, res);
  });

  // Midtrans webhook notification endpoint (for payment status updates)
  // NO AUTH REQUIRED - Midtrans needs to call this
  router.post("/webhook", (req, res) => {
    console.log("Processing Midtrans webhook", {
      body: req.body,
      headers: req.headers,
      origin: req.get('origin')
    });
    handleMidtransNotification(pool, req, res);
  });

  return router;
};

module.exports = createPaymentRoutes;