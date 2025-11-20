const express = require("express");
const {
  createTransaction,
  getTransactionStatus,
  updateBookingStatus,
  handleMidtransNotification
} = require("../controllers/paymentController");

// Function to create payment routes with pool dependency injection
const createPaymentRoutes = (pool) => {
  const router = express.Router();

  // 🧾 CREATE TRANSACTION
  router.post("/create-transaction", (req, res) => createTransaction(pool, req, res));

  // 💳 GET TRANSACTION STATUS
  router.get("/transaction-status/:id", (req, res) => getTransactionStatus(pool, req, res));

  // UPDATE BOOKING STATUS
  router.post("/update-status", (req, res) => updateBookingStatus(pool, req, res));

  // Midtrans webhook notification endpoint (for payment status updates)
  router.post("/webhook", (req, res) => handleMidtransNotification(pool, req, res));

  return router;
};

module.exports = createPaymentRoutes;