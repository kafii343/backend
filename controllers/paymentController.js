// paymentController.js - Updated with pool injection
const midtransClient = require("midtrans-client");
const { snap, coreApi } = require("../utils/midtransConfig");

// Helper function to sanitize numeric values for database insertion
const sanitizeNumericValue = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  // Handle string representations of numbers that may include decimal points
  // e.g., "865000.00" from Midtrans should be converted properly
  let numValue;

  if (typeof value === 'string') {
    // Remove any potential formatting characters but preserve decimal point
    const cleanedValue = value.replace(/[^\d.-]/g, '');
    numValue = parseFloat(cleanedValue);
  } else {
    numValue = parseFloat(value);
  }

  // Check if the conversion results in a valid number
  if (isNaN(numValue)) {
    console.warn(`Invalid numeric value provided: ${value}, defaulting to 0`);
    return 0;
  }

  // Round to 2 decimal places to match DECIMAL(12,2) format
  return Math.round(numValue * 100) / 100;
};

// CREATE TRANSACTION
const createTransaction = async (pool, req, res) => {
  try {
    // DEBUG LOGGING - START (remove after fixing the issue)
    console.log("=== CREATE TRANSACTION DEBUG START ===");
    console.log("Request method:", req.method);
    console.log("Request path:", req.path);
    console.log("Request headers:", req.headers);
    console.log("Request body:", req.body);
    console.log("Environment check:", {
      hasMidtransServerKey: !!process.env.MIDTRANS_SERVER_KEY,
      nodeEnv: process.env.NODE_ENV === 'production', 
      midtransServerKeyLength: process.env.MIDTRANS_SERVER_KEY ? process.env.MIDTRANS_SERVER_KEY.length : 0
    });
    // DEBUG LOGGING - END

    const { booking_id, order_id, amount, customer_email, customer_name, item_details } = req.body;

    // Validate required fields
    if (!amount || !customer_email || !customer_name) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: amount, customer_email, or customer_name",
      });
    }

    // Use booking_id as order_id if provided, else use order_id parameter or generate new one
    const orderId = booking_id || order_id || `ORDER-${Date.now()}`;

    // Validate amount is a number and convert to float to handle decimal values properly
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number",
      });
    }

    console.log("Looking for booking with ID:", orderId);

    // Verify the booking exists before creating transaction
    let bookingResult = null;

    try {
      // First check by booking_code
      bookingResult = await pool.query(
        "SELECT id, booking_code, customer_email FROM bookings WHERE booking_code = $1",
        [orderId]
      );
    } catch (e) {
      console.log("Error checking booking_code:", e.message);
    }

    // If not found by booking_code, try to find by id (UUID)
    if (!bookingResult || bookingResult.rows.length === 0) {
      try {
        bookingResult = await pool.query(
          "SELECT id, booking_code, customer_email FROM bookings WHERE id = $1::uuid",
          [orderId]
        );
      } catch (e) {
        // If it's not a valid UUID, continue with other checks
        console.log("Order ID is not a valid UUID format, checking as booking_code:", orderId);
      }
    }

    // If still not found, return error
    if (!bookingResult || bookingResult.rows.length === 0) {
      console.log(`Booking not found with ID: ${orderId}`);
      return res.status(404).json({
        success: false,
        message: `Booking with ID ${orderId} not found in database`
      });
    }

    const booking = bookingResult.rows[0];
    console.log("Found booking to create transaction for:", booking);

    // Ensure the customer email matches the one in the booking
    if (customer_email !== booking.customer_email) {
      console.log("Customer email mismatch. Expected:", booking.customer_email, "Got:", customer_email);
      return res.status(400).json({
        success: false,
        message: "Customer email does not match the booking record"
      });
    }

    const parameter = {
      transaction_details: {
        order_id: orderId,  // This should match the booking_id from the database
        gross_amount: Math.round(numericAmount), // Round to nearest integer as required by Midtrans
      },
      customer_details: {
        first_name: customer_name,
        email: customer_email,
      },
      item_details: item_details || undefined, // Include item details if provided
      enabled_payments: ["gopay", "shopeepay", "dana", "ovo", "bri_va", "bca_va", "permata_va", "credit_card"],
    };

    console.log("Sending parameter to Midtrans:", JSON.stringify(parameter, null, 2));

    // Validate that the order_id is properly formatted before sending to Midtrans
    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      throw new Error("Invalid order_id provided: " + orderId);
    }

    // DEBUG LOGGING - Midtrans request preparation (remove after fixing)
    console.log("Midtrans client config:", {
      isProduction: process.env.NODE_ENV === 'production',
      hasServerKey: !!process.env.MIDTRANS_SERVER_KEY,
      serverKeyLength: process.env.MIDTRANS_SERVER_KEY ? process.env.MIDTRANS_SERVER_KEY.length : 0
    });
    // DEBUG LOGGING - END

    // Create transaction
    const transaction = await snap.createTransaction(parameter);

    if (!transaction?.token || !transaction?.redirect_url) {
      console.error("Invalid response from Midtrans API:", transaction);
      throw new Error("Invalid response from Midtrans API");
    }

    console.log("Transaction created successfully. Token:", transaction.token);
    console.log("Transaction ID:", transaction.transaction_id);
    console.log("Redirect URL:", transaction.redirect_url);
    console.log("Order ID sent to Midtrans:", orderId);

    // Update booking to pending status immediately after creating transaction
    try {
      // First try to update by booking_code (for ORDER-XXXX format)
      const bookingUpdateResult = await pool.query(
        "UPDATE bookings SET payment_status = 'pending', payment_external_id = $2, updated_at = CURRENT_TIMESTAMP WHERE booking_code = $1 RETURNING id",
        [orderId, transaction.token]  // Store the transaction token for reference
      );

      // If not found by booking_code, try to update by id (UUID format)
      if (bookingUpdateResult.rowCount === 0) {
        await pool.query(
          "UPDATE bookings SET payment_status = 'pending', payment_external_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid",
          [orderId, transaction.token]  // Store the transaction token for reference
        );
        console.log(`Booking with UUID ${orderId} status updated to pending`);
      } else {
        console.log(`Booking with code ${orderId} status updated to pending`);
      }
    } catch (updateError) {
      console.error("Error updating booking status to pending:", updateError);
      // Don't fail the entire transaction just because we couldn't update booking status
    }

    // DEBUG LOGGING - Response preparation (remove after fixing)
    console.log("Sending response to client:", {
      success: true,
      token: transaction.token ? 'TOKEN_EXISTS' : 'NO_TOKEN',
      redirect_url: transaction.redirect_url ? 'URL_EXISTS' : 'NO_URL',
      order_id: orderId
    });
    console.log("=== CREATE TRANSACTION DEBUG END ===");
    // DEBUG LOGGING - END

    res.status(200).json({
      success: true,
      token: transaction.token,
      redirect_url: transaction.redirect_url,
      order_id: orderId  // Return the order_id for verification
    });

  } catch (error) {
    // DEBUG LOGGING - Error (remove after fixing)
    console.error("=== CREATE TRANSACTION ERROR DEBUG START ===");
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
      type: typeof error,
      isMidtransError: error.name && error.name.includes('MidtransError')
    });
    console.error("=== CREATE TRANSACTION ERROR DEBUG END ===");
    // DEBUG LOGGING - END

    if (error.message.toLowerCase().includes("access denied") || error.message.toLowerCase().includes("unauthorized")) {
      return res.status(401).json({
        success: false,
        message: "Midtrans authentication failed — check your server key.",
      });
    }

    // Check if it's a Midtrans-specific error
    if (error.name && error.name.includes('MidtransError')) {
      return res.status(400).json({
        success: false,
        message: `Midtrans API Error: ${error.message}`,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to create payment transaction",
    });
  }
};

// GET TRANSACTION STATUS
const getTransactionStatus = async (pool, req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Transaction ID is required." });
    }

    console.log(`Checking transaction status for ID: ${id}`);
    const statusResponse = await coreApi.transaction.status(id);

    // Update the booking status based on the response
    const bookingId = statusResponse.order_id;
    let bookingResult;

    // Try to find booking by various methods
    // First try booking_code
    try {
      bookingResult = await pool.query(
        "SELECT id, booking_code FROM bookings WHERE booking_code = $1",
        [bookingId]
      );
    } catch (e) {
      console.log("Status check - error querying by booking_code:", bookingId);
    }

    // If not found by booking_code, try with UUID
    if (!bookingResult || bookingResult.rows.length === 0) {
      try {
        bookingResult = await pool.query(
          "SELECT id, booking_code FROM bookings WHERE id = $1::uuid",
          [bookingId]
        );
      } catch (e) {
        console.log("Status check - booking ID is not a valid UUID format:", bookingId);
      }
    }

    // If still not found, try by transaction token (payment_external_id)
    if (!bookingResult || bookingResult.rows.length === 0) {
      try {
        bookingResult = await pool.query(
          "SELECT id, booking_code FROM bookings WHERE payment_external_id = $1",
          [id]  // Use the transaction ID itself to match payment_external_id
        );
      } catch (e) {
        console.log("Status check - error querying by payment_external_id:", id);
      }
    }

    if (bookingResult && bookingResult.rows.length > 0) {
      const booking = bookingResult.rows[0];
      const paymentStatus =
        statusResponse.transaction_status === 'settlement' || statusResponse.transaction_status === 'capture'
          ? 'paid'
          : statusResponse.transaction_status === 'pending'
            ? 'pending'
            : statusResponse.transaction_status === 'cancel' || statusResponse.transaction_status === 'expire' || statusResponse.transaction_status === 'deny'
              ? 'failed'
              : statusResponse.transaction_status;

      // Update booking status - use the actual booking id from the found record
      await pool.query(
        "UPDATE bookings SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid",
        [paymentStatus, booking.id]
      );
      console.log(`Booking ${booking.id} status updated to ${paymentStatus} based on Midtrans status`);
    }

    res.status(200).json({
      success: true,
      order_id: statusResponse.order_id,
      transaction_id: statusResponse.transaction_id,
      status_code: statusResponse.status_code,
      transaction_status: statusResponse.transaction_status,
      fraud_status: statusResponse.fraud_status,
      payment_type: statusResponse.payment_type,
      gross_amount: statusResponse.gross_amount,
    });
  } catch (error) {
    console.error("Midtrans status error:", {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });

    if (error.message.toLowerCase().includes("not found")) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found in Midtrans system."
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Failed to get transaction status.",
    });
  }
};

// Update booking status from payment
const updateBookingStatus = async (pool, req, res) => {
  try {
    const { booking_id, status, total_price, payment_data } = req.body;

    // Validate required fields
    if (!booking_id || !status) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: booking_id, status"
      });
    }

    console.log(`Updating booking status for ID: ${booking_id}, new status: ${status}`, {total_price});

    // Check if booking_id is UUID format (contains hyphens) vs booking code format
    const isUUID = typeof booking_id === 'string' && booking_id.includes('-');

    let bookingResult;
    let rowsAffected = 0;

    // Build the SET clause dynamically based on provided fields
    let setClause = "payment_status = $1";
    let queryValues = [status];
    let paramIndex = 2;

    // Add total_price to update if provided
    if (total_price !== undefined && total_price !== null) {
      setClause += `, total_price = $${paramIndex}`;
      queryValues.push(sanitizeNumericValue(total_price));
      paramIndex++;
    }

    // Add updated_at timestamp
    setClause += `, updated_at = CURRENT_TIMESTAMP`;

    if (isUUID) {
      // If it's UUID format, update directly by ID
      const updateByUUIDQuery = `
        UPDATE bookings
        SET ${setClause}
        WHERE id = $${paramIndex}::uuid
        RETURNING id, booking_code, payment_status, total_price, status
      `;

      const result = await pool.query(updateByUUIDQuery, [...queryValues, booking_id]);
      bookingResult = result;
      rowsAffected = result.rowCount;

      console.log(`Update by UUID - Rows affected: ${rowsAffected}`);
    } else {
      // If it's not UUID, try booking_code first
      const updateByCodeQuery = `
        UPDATE bookings
        SET ${setClause}
        WHERE booking_code = $${paramIndex}
        RETURNING id, booking_code, payment_status, total_price, status
      `;

      const result = await pool.query(updateByCodeQuery, [...queryValues, booking_id]);
      bookingResult = result;
      rowsAffected = result.rowCount;

      console.log(`Update by booking_code - Rows affected: ${rowsAffected}`);

      // If no rows affected with booking_code, try UUID format as fallback
      if (rowsAffected === 0) {
        const updateByUUIDQuery = `
          UPDATE bookings
          SET ${setClause}
          WHERE id = $${paramIndex}::uuid
          RETURNING id, booking_code, payment_status, total_price, status
        `;

        const uuidResult = await pool.query(updateByUUIDQuery, [...queryValues, booking_id]);
        bookingResult = uuidResult;
        rowsAffected = uuidResult.rowCount;

        console.log(`Fallback update by UUID - Rows affected: ${rowsAffected}`);
      }
    }

    if (rowsAffected === 0) {
      console.log(`No booking found with ID: ${booking_id} (tried both UUID and booking_code)`);
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    const booking = bookingResult.rows[0];
    console.log(`Successfully updated booking ${booking.id} (code: ${booking.booking_code}) status to ${booking.payment_status}`, {
      total_price: booking.total_price,
      payment_data
    });

    // If payment_data is provided, also update payment related fields
    if (payment_data) {
      // Determine the external transaction ID from payment_data
      const externalId = payment_data.transaction_id || payment_data.order_id || payment_data.snap_token;

      // Insert or update payment record
      const checkPaymentQuery = `SELECT id FROM payments WHERE booking_id = $1 OR external_id = $2`;
      const checkResult = await pool.query(checkPaymentQuery, [booking.id, externalId]);

      if (checkResult.rows.length === 0) {
        // Insert new payment record
        const insertPaymentQuery = `
          INSERT INTO payments (booking_id, external_id, status, amount, payment_method, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        // Log the amount values for debugging
        console.log(`Inserting payment with amount:`, {
          raw_gross_amount: payment_data.gross_amount,
          raw_amount: payment_data.amount,
          sanitized_amount: sanitizeNumericValue(payment_data.gross_amount || payment_data.amount || 0)
        });

        await pool.query(insertPaymentQuery, [
          booking.id, // Use the actual booking UUID from the updated record
          externalId,
          payment_data.transaction_status || status,
          sanitizeNumericValue(payment_data.gross_amount || payment_data.amount || 0),
          payment_data.payment_type || payment_data.payment_method || 'unknown',
          payment_data
        ]);

        console.log(`Created new payment record for booking ${booking.id}, external_id: ${externalId}`);
      } else {
        // Update existing payment record
        const paymentUpdateQuery = `
          UPDATE payments
          SET status = $1, metadata = $2, updated_at = CURRENT_TIMESTAMP
          WHERE booking_id = $3 OR external_id = $4
        `;

        await pool.query(paymentUpdateQuery, [
          status,
          payment_data,
          booking.id,
          externalId
        ]);

        console.log(`Updated payment record for booking ${booking.id} or external_id: ${externalId}`);
      }
    }

    res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      booking: {
        id: booking.id,
        booking_code: booking.booking_code,
        payment_status: booking.payment_status,
        status: booking.status, // Include the booking status field
        total_price: booking.total_price
      }
    });

  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update booking status"
    });
  }
};

// Midtrans webhook handler
const handleMidtransNotification = async (pool, req, res) => {
  try {
    console.log("Midtrans notification received:", req.body);

    // Get notification data from Midtrans
    const notificationJson = req.body;

    // Create Midtrans notification object
    const notification = new midtransClient.Notification(notificationJson);

    // Validate notification authenticity with Midtrans
    let notificationData;
    try {
      notificationData = await notification.validate();
      console.log("Validated notification data:", {
        order_id: notificationData.order_id,
        transaction_status: notificationData.transaction_status,
        fraud_status: notificationData.fraud_status,
        status_code: notificationData.status_code
      });
    } catch (validationError) {
      console.error("Failed to validate Midtrans notification:", validationError);
      return res.status(400).json({
        success: false,
        message: "Invalid Midtrans notification",
        error: validationError.message
      });
    }

    // Extract important data
    const { order_id, transaction_status, fraud_status, payment_type } = notificationData;

    // Determine the status to save based on Midtrans response
    let status;
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      status = 'paid';
    } else if (transaction_status === 'pending') {
      status = 'pending';
    } else if (transaction_status === 'cancel' || transaction_status === 'expire' || transaction_status === 'deny') {
      status = 'failed';
    } else {
      status = transaction_status; // fallback to the original status
    }

    // Update booking status - Try booking_code first, then UUID
    let bookingResult;

    // First try to update by booking_code
    const updateByCodeQuery = `
      UPDATE bookings
      SET payment_status = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE booking_code = $2
      RETURNING id, booking_code, payment_status, user_id
    `;
    bookingResult = await pool.query(updateByCodeQuery, [status, order_id]);

    // If not found by booking_code, try by UUID
    if (bookingResult.rows.length === 0) {
      try {
        const updateByUUIDQuery = `
          UPDATE bookings
          SET payment_status = $1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2::uuid
          RETURNING id, booking_code, payment_status, user_id
        `;
        bookingResult = await pool.query(updateByUUIDQuery, [status, order_id]);
      } catch (uuidError) {
        // If it's not a valid UUID, continue to try other formats
        console.log(`Order ID ${order_id} is not a valid UUID`);
      }
    }

    if (bookingResult.rows.length === 0) {
      console.log(`Booking not found for order_id: ${order_id}`);
      // Try to find with just the order_id (in case it's an ORDER-XXXX format)
      const bookingResult2 = await pool.query(updateByCodeQuery, [status, `ORDER-${order_id}`]);
      if (bookingResult2.rows.length === 0) {
        console.log(`Booking not found for order_id: ${order_id} or ORDER-${order_id}`);
      } else {
        console.log(`Booking updated for ORDER-${order_id} (status: ${status})`);
      }
    } else {
      console.log(`Booking updated for ${order_id} (status: ${status})`);
    }

    // Create/update payment record with full notification data
    let actualBookingId = null;

    // First, try to find the booking by booking_code
    try {
      const bookingByCode = await pool.query("SELECT id FROM bookings WHERE booking_code = $1", [order_id]);
      if (bookingByCode.rows.length > 0) {
        actualBookingId = bookingByCode.rows[0].id;
      }
    } catch (e) {
      // If it fails as booking_code, try as UUID
      try {
        const bookingByUUID = await pool.query("SELECT id FROM bookings WHERE id = $1::uuid", [order_id]);
        if (bookingByUUID.rows.length > 0) {
          actualBookingId = bookingByUUID.rows[0].id;
        }
      } catch (uuidError) {
        // If UUID also fails, try with external payment ID
        const bookingByExternalId = await pool.query("SELECT id FROM bookings WHERE payment_external_id = $1", [order_id]);
        if (bookingByExternalId.rows.length > 0) {
          actualBookingId = bookingByExternalId.rows[0].id;
        }
      }
    }

    // If we found the booking, create/update payment record
    if (actualBookingId) {
      const checkPaymentQuery = `SELECT id FROM payments WHERE booking_id = $1`;
      const checkResult = await pool.query(checkPaymentQuery, [actualBookingId]);

      if (checkResult.rows.length === 0) {
        const insertPaymentQuery = `
          INSERT INTO payments (booking_id, external_id, status, amount, payment_method, metadata)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        // Log the amount values for debugging
        console.log(`Inserting payment from webhook with amount:`, {
          raw_gross_amount: notificationData.gross_amount,
          sanitized_amount: sanitizeNumericValue(notificationData.gross_amount || 0)
        });

        await pool.query(insertPaymentQuery, [
          actualBookingId,
          notificationData.transaction_id || notificationData.order_id,
          notificationData.transaction_status || status,
          sanitizeNumericValue(notificationData.gross_amount || 0),
          notificationData.payment_type || 'unknown',
          notificationData
        ]);
        console.log(`Created new payment record for booking ${actualBookingId} with external ID: ${notificationData.transaction_id || notificationData.order_id}`);
      } else {
        // Update existing payment record
        const paymentUpdateQuery = `
          UPDATE payments
          SET status = $1, metadata = $2, updated_at = CURRENT_TIMESTAMP
          WHERE booking_id = $3
        `;

        await pool.query(paymentUpdateQuery, [status, notificationData, actualBookingId]);
        console.log(`Updated payment record for booking ${actualBookingId}`);
      }
    } else {
      console.log(`Could not find booking for order_id: ${order_id}`);
      // If we can't find the booking, try with the transaction ID as external_id
      const insertPaymentQuery = `
        INSERT INTO payments (booking_id, external_id, status, amount, payment_method, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

      // Log the amount values for debugging
      console.log(`Inserting payment from webhook (no booking) with amount:`, {
        raw_gross_amount: notificationData.gross_amount,
        sanitized_amount: sanitizeNumericValue(notificationData.gross_amount || 0)
      });

      await pool.query(insertPaymentQuery, [
        null, // No booking_id found
        notificationData.transaction_id || notificationData.order_id,
        notificationData.transaction_status || status,
        sanitizeNumericValue(notificationData.gross_amount || 0),
        notificationData.payment_type || 'unknown',
        notificationData
      ]);
      console.log(`Created payment record with no associated booking for external ID: ${notificationData.transaction_id || notificationData.order_id}`);
    }

    // Handle different transaction statuses
    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      console.log(`Payment successful for order ${order_id}`);
      res.status(200).json({
        success: true,
        message: `Payment for order ${order_id} successful`,
        status: 'success'
      });
    } else if (transaction_status === 'cancel' || transaction_status === 'expire' || transaction_status === 'deny') {
      console.log(`Payment failed for order ${order_id}`);
      res.status(200).json({
        success: true,
        message: `Payment for order ${order_id} failed`,
        status: 'failed'
      });
    } else {
      console.log(`Payment status changed for order ${order_id}: ${transaction_status}`);
      res.status(200).json({
        success: true,
        message: `Payment status updated for order ${order_id}`,
        status: transaction_status
      });
    }

  } catch (error) {
    console.error("Error handling Midtrans notification:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process Midtrans notification"
    });
  }
};

module.exports = {
  createTransaction,
  getTransactionStatus,
  updateBookingStatus,
  handleMidtransNotification
};