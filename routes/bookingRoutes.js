const express = require("express");
const {
  updateBookingStatus
} = require("../controllers/paymentController"); // Using the existing payment controller function

// Create a pool parameter that will be injected by the server
const createBookingRoutes = (pool) => {
  const router = express.Router();

  // UPDATE BOOKING STATUS (for admin use)
  // This route handles status updates from admin panel
  router.post("/update-status", (req, res) => {
    // Call the existing updateBookingStatus function from paymentController
    // which handles the logic of updating booking status
    updateBookingStatus(pool, req, res);
  });

  return router;
};

module.exports = createBookingRoutes;