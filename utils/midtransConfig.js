const midtransClient = require("midtrans-client");

// Initialize Midtrans client with better error handling
console.log("MIDTRANS_SERVER_KEY:", process.env.MIDTRANS_SERVER_KEY);
console.log("MIDTRANS_CLIENT_KEY:", process.env.MIDTRANS_CLIENT_KEY);
console.log("LENGTH server:", process.env.MIDTRANS_SERVER_KEY?.length);
console.log("LENGTH client:", process.env.MIDTRANS_CLIENT_KEY?.length);

const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

const coreApi = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
});

// Verify that required environment variables are set
if (!process.env.MIDTRANS_SERVER_KEY || !process.env.MIDTRANS_CLIENT_KEY) {
  console.error("❌ Midtrans configuration error: Missing environment variables!");
  console.error("Please set MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY in your .env file");
} else {
  console.log("✅ Midtrans configuration loaded successfully");
}

module.exports = {
  snap,
  coreApi
};