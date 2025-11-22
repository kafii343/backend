// server.js (versi lengkap - FIXED with HTTPS support)
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const http = require("http");
const https = require("https");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const midtransClient = require("midtrans-client");
const fsPromises = require("fs").promises;
require("dotenv").config();




// Ensure uploads folder
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Configure CORS to allow Midtrans
// const corsOptions = {
//   origin: [
//     "http://localhost:8080",
//     "https://localhost:8080",
//     "http://localhost:5000",
//     "https://localhost:5000",
//     "http://localhost:3000",
//     "https://app.sandbox.midtrans.com",
//     "https://simulator.sandbox.midtrans.com"
//   ],
//   credentials: true,
//   optionsSuccessStatus: 200
// };

// CONFIG CORS AND CONVERT DATA TO JSON
const app = express();

// CORS configuration allowing both development and production origins
const corsOptions = {
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
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadsDir));

const PORT = process.env.API_PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";


// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const upload = multer({ storage });

// Postgres pool CONFIG DB
const isProduction = process.env.NODE_ENV === "production";

const pool = isProduction
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ DB Connection Failed:", err.stack);
  } else {
    console.log("✅ DB Connected");
    release();
  }
});


// const pool = new Pool({

//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false
//   },
//   host: process.env.DB_HOST || "localhost",
//   port: process.env.DB_PORT || 5432,
//   database: process.env.DB_NAME || "cartenz_db",
//   user: process.env.DB_USER || "cartenz_admin",
//   password: process.env.DB_PASSWORD || "cartenz_secure_2024",
// });
// pool.connect((err, client, release) => {
//   if (err) console.error("DB connection failed:", err.stack);
//   else {
//     console.log("✅ DB connected");
//     release();
//   }
// });

// HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  // chat rooms: room = `trip_${tripId}` or `booking_${bookingId}`
  socket.on("joinRoom", (room) => socket.join(room));
  socket.on("leaveRoom", (room) => socket.leave(room));
  socket.on("message", ({ room, user, text }) => {
    io.to(room).emit("message", { user, text, ts: Date.now() });
  });
  socket.on("disconnect", () => console.log("socket disconnect", socket.id));
});

// ---------- Auth helpers ----------
const hashPassword = (pwd) => bcrypt.hashSync(pwd, 10);
const comparePassword = (pwd, hash) => bcrypt.compareSync(pwd, hash);
const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ success: false, message: "Missing token" });
  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ---------- Auth routes ----------
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password, phone } = req.body;

  // Validation
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Username, email, and password are required"
    });
  }

  // Additional validation for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  // Check if user already exists
  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    const hashed = hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, created_at`,
      [username, email, hashed, phone || '', 'user']
    );

    const user = result.rows[0];
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, username: user.full_name, email: user.email, role: user.role },
        token
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  console.log('User login attempt for email:', email); // Debug logging

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    console.log('Found users:', result.rows.length); // Debug logging

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const user = result.rows[0];
    console.log('User role:', user.role); // Debug logging

    const isPasswordValid = comparePassword(password, user.password_hash);
    console.log('Password valid:', isPasswordValid); // Debug logging

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.full_name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin-only middleware
const adminOnly = [authMiddleware, (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}];

// ---------- Admin Auth Routes ----------
// Endpoint for creating new admin accounts (requires admin code verification)
app.post("/api/auth/register/admin", async (req, res) => {
  const { username, email, password, admin_code } = req.body;
  console.log('Admin registration attempt for email:', email); // Debug logging

  // Validation
  if (!username || !email || !password || !admin_code) {
    return res.status(400).json({
      success: false,
      message: "Username, email, password, and admin code are required"
    });
  }

  // Check admin code
  const ADMIN_CODE = process.env.ADMIN_CODE || "CARTENZ2024"; // Default admin code, can be set in env
  if (admin_code !== ADMIN_CODE) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin code"
    });
  }

  // Additional validation for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  // Check if user already exists
  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    const hashed = hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, created_at`,
      [username, email, hashed, '', 'admin']
    );

    const user = result.rows[0];
    console.log('Created new admin user with id:', user.id); // Debug logging

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, username: user.full_name, email: user.email, role: user.role }
      }
    });
  } catch (err) {
    console.error('Admin registration error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint for creating the first admin (no authentication required)
app.post("/api/auth/admin/first", async (req, res) => {
  const { username, email, password, phone } = req.body;
  console.log('First admin register attempt for email:', email); // Debug logging

  // Validation
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Username, email, and password are required"
    });
  }

  // Additional validation for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  try {
    // Check if any admin user already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE role = $1 LIMIT 1',
      ['admin']
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An admin user already exists. Use the regular admin registration endpoint."
      });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    const hashed = hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, created_at`,
      [username, email, hashed, phone || '', 'admin']
    );

    const user = result.rows[0];
    console.log('Created first admin user with id:', user.id); // Debug logging
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, username: user.full_name, email: user.email, role: user.role },
        token
      }
    });
  } catch (err) {
    console.error('First admin registration error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Special endpoint to create admin with specific email (for setup only)
app.post("/api/auth/admin/create-specific", async (req, res) => {
  const { email, password, username } = req.body;
  console.log('Creating specific admin user for email:', email); // Debug logging

  // For security, this endpoint should only be used during initial setup
  // In production, you should remove or secure this endpoint

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    const hashed = hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, created_at`,
      [username || 'Admin User', email, hashed, '', 'admin']
    );

    const user = result.rows[0];
    console.log('Created specific admin user with id:', user.id); // Debug logging

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, username: user.full_name, email: user.email, role: user.role }
      }
    });
  } catch (err) {
    console.error('Specific admin creation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint to create the initial admin user (for first-time setup)
app.post("/api/auth/admin/init", async (req, res) => {
  const { admin_code } = req.body;
  const defaultEmail = 'admin@cartenz.com';
  const defaultPassword = 'admin123';
  const defaultUsername = 'admin';

  // Check admin code
  const ADMIN_CODE = process.env.ADMIN_CODE || "CARTENZ2024";
  if (admin_code !== ADMIN_CODE) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin code"
    });
  }

  try {
    // Check if any admin already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM users WHERE role = $1 LIMIT 1',
      ['admin']
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An admin user already exists. Cannot create initial admin."
      });
    }

    // Check if the default admin email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [defaultEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Admin user with default email already exists"
      });
    }

    const hashed = hashPassword(defaultPassword);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, role, created_at`,
      [defaultUsername, defaultEmail, hashed, '', 'admin']
    );

    const user = result.rows[0];
    console.log('Created initial admin user with id:', user.id); // Debug logging

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, username: user.full_name, email: user.email, role: user.role }
      }
    });
  } catch (err) {
    console.error('Initial admin creation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/auth/admin/login", async (req, res) => {
  const { email, password } = req.body;
  console.log('Admin login attempt - Received email:', email); // Debug logging
  console.log('Admin login attempt - Received password:', password ? '***' : 'null/undefined'); // Debug logging - don't log actual password

  if (!email || !password) {
    console.log('Admin login validation failed - missing email or password');
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  try {
    console.log('Querying database for admin user with email:', email); // Debug logging
    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1 AND role = 'admin' LIMIT 1`,
      [email]
    );

    console.log('Database query result count:', result.rows.length); // Debug logging

    if (result.rows.length === 0) {
      console.log('No admin user found with email:', email); // Debug logging
      return res.status(401).json({
        success: false,
        message: "Invalid credentials or not an admin account"
      });
    }

    const user = result.rows[0];
    console.log('User found in database - ID:', user.id, 'Email:', user.email, 'Role:', user.role); // Debug logging

    console.log('Comparing provided password with stored hash...'); // Debug logging

    const isPasswordValid = comparePassword(password, user.password_hash);
    console.log('Password comparison result:', isPasswordValid); // Debug logging

    if (!isPasswordValid) {
      console.log('Password validation failed for user:', user.email); // Debug logging
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    console.log('Password validation successful, generating token for admin user:', user.email); // Debug logging
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    console.log('Login successful for admin user:', user.email); // Debug logging
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.full_name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- Guides CRUD ----------
app.get("/api/guides", async (req, res) => {
  try {
    // Query with alias to map 'avatar_url' to 'photo_url' for frontend compatibility
    const r = await pool.query(`
      SELECT
        id, name, title, experience_years, rating, total_reviews, total_trips,
        languages, specialties, price_per_day,
        avatar_url as photo_url, description, achievements,
        is_verified, is_available, created_at, updated_at
      FROM guides
      ORDER BY id DESC
    `);
    // Convert relative image paths to absolute URLs
    const guidesWithAbsoluteImageUrls = r.rows.map(guide => ({
      ...guide,
      photo_url: guide.photo_url ? `${req.protocol}://${req.get('host')}${guide.photo_url}` : null
    }));
    console.log('Guides API Response:', guidesWithAbsoluteImageUrls); // Debug logging
    res.json({ success: true, data: guidesWithAbsoluteImageUrls });
  } catch (err) {
    console.error('Error in /api/guides:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/guides", upload.single("photo"), async (req, res) => {
  const { name, title, experience_years, languages, specialties, price_per_day, description } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  console.log('Photo file path:', photo); // Debug logging
  try {
    const languagesArr = typeof languages === "string" ? languages.split(",").map((s) => s.trim()).filter(Boolean) : languages;
    const specialtiesArr = typeof specialties === "string" ? specialties.split(",").map((s) => s.trim()).filter(Boolean) : specialties;
    const q = await pool.query(
      `INSERT INTO guides (name,title,experience_years,languages,specialties,price_per_day,description,avatar_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, title, experience_years, languagesArr, specialtiesArr, price_per_day, description, photo]
    );
    console.log('New guide saved:', q.rows[0]); // Debug logging
    io.emit("guideAdded", q.rows[0]);
    res.status(201).json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error('Error in /api/guides POST:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/guides/:id", upload.single("photo"), async (req, res) => {
  const id = req.params.id;
  const { name, title, experience_years, languages, specialties, price_per_day, description } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  console.log('PUT - Photo file path:', photo); // Debug logging
  try {
    const languagesArr = typeof languages === "string" ? languages.split(",").map((s) => s.trim()).filter(Boolean) : languages;
    const specialtiesArr = typeof specialties === "string" ? specialties.split(",").map((s) => s.trim()).filter(Boolean) : specialties;
    const q = await pool.query(
      `UPDATE guides SET name=$1,title=$2,experience_years=$3,languages=$4,specialties=$5,price_per_day=$6,description=$7,avatar_url=COALESCE($8,avatar_url) WHERE id=$9 RETURNING *`,
      [name, title, experience_years, languagesArr, specialtiesArr, price_per_day, description, photo, id]
    );
    console.log('Updated guide:', q.rows[0]); // Debug logging
    res.json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error('Error in /api/guides PUT:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/guides/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await pool.query("DELETE FROM guides WHERE id=$1", [id]);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- Porters CRUD ----------
app.get("/api/porters", async (req, res) => {
  try {
    // Query with alias to map 'avatar_url' to 'photo_url' for frontend compatibility
    const r = await pool.query(`
      SELECT
        id, name, experience_years, rating, total_reviews, total_trips,
        max_capacity_kg, specialties, price_per_day,
        avatar_url as photo_url, description, achievements,
        is_available, created_at, updated_at
      FROM porters
      ORDER BY id DESC
    `);
    // Convert relative image paths to absolute URLs
    const portersWithAbsoluteImageUrls = r.rows.map(porter => ({
      ...porter,
      photo_url: porter.photo_url ? `${req.protocol}://${req.get('host')}${porter.photo_url}` : null
    }));
    res.json({ success: true, data: portersWithAbsoluteImageUrls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/porters", upload.single("photo"), async (req, res) => {
  const { name, experience_years, max_capacity_kg, specialties, price_per_day, description } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const specialtiesArr = typeof specialties === "string" ? specialties.split(",").map((s) => s.trim()).filter(Boolean) : specialties;
    const q = await pool.query(
      `INSERT INTO porters (name,experience_years,max_capacity_kg,specialties,price_per_day,description,avatar_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, experience_years, max_capacity_kg, specialtiesArr, price_per_day, description, photo]
    );
    io.emit("porterAdded", q.rows[0]);
    res.status(201).json({ success: true, data: q.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/porters/:id", upload.single("photo"), async (req, res) => {
  const id = req.params.id;
  const { name, experience_years, max_capacity_kg, specialties, price_per_day, description } = req.body;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  console.log('PUT Porter - Photo file path:', photo); // Debug logging
  try {
    const specialtiesArr = typeof specialties === "string" ? specialties.split(",").map((s) => s.trim()).filter(Boolean) : specialties;
    const q = await pool.query(
      `UPDATE porters SET name=$1,experience_years=$2,max_capacity_kg=$3,specialties=$4,price_per_day=$5,description=$6,avatar_url=COALESCE($7,avatar_url) WHERE id=$8 RETURNING *`,
      [name, experience_years, max_capacity_kg, specialtiesArr, price_per_day, description, photo, id]
    );
    console.log('Updated porter:', q.rows[0]); // Debug logging
    res.json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error('Error in /api/porters PUT:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/porters/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM porters WHERE id=$1", [id]);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- Mountains CRUD ----------
app.get("/api/mountains", async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM mountains ORDER BY id DESC");
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/mountains", upload.single("image_url"), async (req, res) => {
  const { name, location, altitude, difficulty, description } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const q = await pool.query(
      `INSERT INTO mountains (name,location,altitude,difficulty,description,image_url) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, location, altitude, difficulty, description, image_url]
    );
    io.emit("mountainAdded", q.rows[0]);
    res.status(201).json({ success: true, data: q.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/mountains/:id", upload.single("image_url"), async (req, res) => {
  const id = req.params.id;
  const { name, location, altitude, difficulty, description } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const q = await pool.query(
      `UPDATE mountains SET name=$1,location=$2,altitude=$3,difficulty=$4,description=$5,image_url=COALESCE($6,image_url) WHERE id=$7 RETURNING *`,
      [name, location, altitude, difficulty, description, image_url, id]
    );
    res.json({ success: true, data: q.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/mountains/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM mountains WHERE id=$1", [id]);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- Open Trips CRUD ----------
app.get("/api/open-trips", async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        id,
        title,
        mountain_id,
        duration_days,
        duration_nights,
        difficulty,
        base_price,
        original_price,
        min_participants,
        max_participants,
        description,
        image_url,
        includes,
        highlights,
        quota_remaining,
        is_closed,
        rating,
        total_reviews,
        is_active,
        created_at,
        updated_at
      FROM open_trips
      WHERE is_active = TRUE AND is_closed = FALSE
      ORDER BY id DESC
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/open-trips", upload.single("image_url"), async (req, res) => {
  const { title, mountain_id, duration_days, duration_nights, difficulty, base_price, original_price, min_participants, max_participants, description, includes, highlights } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    console.log("POST /api/open-trips received:", { title, mountain_id, duration_days, duration_nights, difficulty, base_price });

    const includesArr = typeof includes === "string" ? includes.split(",").map((s) => s.trim()).filter(Boolean) : includes;
    const highlightsArr = typeof highlights === "string" ? highlights.split(",").map((s) => s.trim()).filter(Boolean) : highlights;

    const q = await pool.query(
      `INSERT INTO open_trips (title, mountain_id, duration_days, duration_nights, difficulty, base_price, original_price, min_participants, max_participants, description, image_url, includes, highlights, quota_remaining)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $9) RETURNING *`,
      [title, mountain_id || null, duration_days || null, duration_nights || null, difficulty || null, base_price || 0, original_price || 0, min_participants || 1, max_participants || 1, description || '', image_url, includesArr || [], highlightsArr || [], max_participants || 1]
    );
    console.log("Open Trip created successfully:", q.rows[0]);
    io.emit("openTripAdded", q.rows[0]);
    res.status(201).json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error("Open Trip POST error:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/open-trips/:id", upload.single("image_url"), async (req, res) => {
  const id = req.params.id;
  const { title, mountain_id, duration_days, duration_nights, difficulty, base_price, original_price, min_participants, max_participants, description, includes, highlights } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    console.log("PUT /api/open-trips/:id received:", { id, title, mountain_id });

    const includesArr = typeof includes === "string" ? includes.split(",").map((s) => s.trim()).filter(Boolean) : includes;
    const highlightsArr = typeof highlights === "string" ? highlights.split(",").map((s) => s.trim()).filter(Boolean) : highlights;

    const q = await pool.query(
      `UPDATE open_trips SET title=$1, mountain_id=$2, duration_days=$3, duration_nights=$4, difficulty=$5, base_price=$6, original_price=$7, min_participants=$8, max_participants=$9, description=$10, includes=$11, highlights=$12, image_url=COALESCE($13, image_url) WHERE id=$14 RETURNING *`,
      [title, mountain_id || null, duration_days || null, duration_nights || null, difficulty || null, base_price || 0, original_price || 0, min_participants || 1, max_participants || 1, description || '', includesArr || [], highlightsArr || [], image_url, id]
    );
    console.log("Open Trip updated successfully:", q.rows[0]);
    res.json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error("Open Trip PUT error:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/open-trips/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM open_trips WHERE id=$1", [id]);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- Admin Open Trips CRUD ----------
app.get("/api/admin/open-trips", adminOnly, async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM open_trips ORDER BY id DESC");
    res.json({ success: true, data: r.rows });
  } catch (err) {
    console.error('Error in /api/admin/open-trips GET:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/admin/open-trips", adminOnly, upload.single("image_url"), async (req, res) => {
  const { title, mountain_id, duration_days, duration_nights, difficulty, base_price, original_price, min_participants, max_participants, description, includes, highlights } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    console.log("POST /api/admin/open-trips received:", { title, mountain_id, duration_days, duration_nights, difficulty, base_price });

    const includesArr = typeof includes === "string" ? includes.split(",").map((s) => s.trim()).filter(Boolean) : includes;
    const highlightsArr = typeof highlights === "string" ? highlights.split(",").map((s) => s.trim()).filter(Boolean) : highlights;

    const q = await pool.query(
      `INSERT INTO open_trips (title, mountain_id, duration_days, duration_nights, difficulty, base_price, original_price, min_participants, max_participants, description, image_url, includes, highlights)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [title, mountain_id || null, duration_days || null, duration_nights || null, difficulty || null, base_price || 0, original_price || 0, min_participants || 1, max_participants || 1, description || '', image_url, includesArr || [], highlightsArr || []]
    );
    console.log("Admin Open Trip created successfully:", q.rows[0]);
    io.emit("openTripAdded", q.rows[0]);
    res.status(201).json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error("Admin Open Trip POST error:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put("/api/admin/open-trips/:id", adminOnly, upload.single("image_url"), async (req, res) => {
  const id = req.params.id;
  const { title, mountain_id, duration_days, duration_nights, difficulty, base_price, original_price, min_participants, max_participants, description, includes, highlights } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    console.log("PUT /api/admin/open-trips/:id received:", { id, title, mountain_id });

    const includesArr = typeof includes === "string" ? includes.split(",").map((s) => s.trim()).filter(Boolean) : includes;
    const highlightsArr = typeof highlights === "string" ? highlights.split(",").map((s) => s.trim()).filter(Boolean) : highlights;

    const q = await pool.query(
      `UPDATE open_trips SET title=$1, mountain_id=$2, duration_days=$3, duration_nights=$4, difficulty=$5, base_price=$6, original_price=$7, min_participants=$8, max_participants=$9, description=$10, includes=$11, highlights=$12, image_url=COALESCE($13, image_url) WHERE id=$14 RETURNING *`,
      [title, mountain_id || null, duration_days || null, duration_nights || null, difficulty || null, base_price || 0, original_price || 0, min_participants || 1, max_participants || 1, description || '', includesArr || [], highlightsArr || [], image_url, id]
    );
    console.log("Admin Open Trip updated successfully:", q.rows[0]);
    res.json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error("Admin Open Trip PUT error:", err.message);
    console.error("Stack:", err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/api/admin/open-trips/:id", adminOnly, async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM open_trips WHERE id=$1", [id]);
    res.json({ success: true, message: "Deleted" });
  } catch (err) {
    console.error("Admin Open Trip DELETE error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- Bookings CRUD ----------
// GET all bookings for admin
app.get("/api/bookings", authMiddleware, async (req, res) => {
  try {
    // Only allow admin access to all bookings, regular users can only see their own bookings
    if (req.user.role === 'admin') {
      const r = await pool.query(`
        SELECT
          b.*,
          ot.title as open_trip_title,
          ot.mountain_id,
          ot.max_participants,
          ot.quota_remaining,
          ot.is_closed
        FROM bookings b
        LEFT JOIN open_trips ot ON b.open_trip_id = ot.id
        ORDER BY b.id DESC
      `);
      res.json({ success: true, data: r.rows });
    } else {
      // Regular user can only see their own bookings
      const r = await pool.query(`
        SELECT
          b.*,
          ot.title as open_trip_title,
          ot.mountain_id
        FROM bookings b
        LEFT JOIN open_trips ot ON b.open_trip_id = ot.id
        WHERE b.user_id = $1
        ORDER BY b.id DESC
      `, [req.user.id]);
      res.json({ success: true, data: r.rows });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/admin/bookings - Admin only route to get all bookings
app.get('/api/admin/bookings', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admins only.'
      });
    }

    const result = await pool.query(`
      SELECT
        b.*,
        ot.title as open_trip_title,
        ot.mountain_id,
        ot.max_participants,
        ot.quota_remaining,
        ot.is_closed,
        u.full_name as customer_name,
        u.email as customer_email
      FROM bookings b
      LEFT JOIN open_trips ot ON b.open_trip_id = ot.id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
});

// GET bookings for a specific trip (admin only)
app.get('/api/admin/open-trips/:id/bookings', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admins only.'
      });
    }

    const tripId = req.params.id;
    const result = await pool.query(`
      SELECT
        b.*,
        u.full_name as customer_name,
        u.email as customer_email
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      WHERE b.open_trip_id = $1
      ORDER BY b.created_at DESC
    `, [tripId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching trip bookings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trip bookings' });
  }
});

// Endpoint for creating booking with authentication (for logged-in users)
app.post("/api/bookings", authMiddleware, async (req, res) => {
  const { open_trip_id, customer_name, customer_email, customer_phone, customer_emergency_contact, total_participants, payment_status, service_type, start_date } = req.body;
  try {
    // Get open trip details to check availability
    const tripResult = await pool.query(
      `SELECT max_participants, quota_remaining, is_closed FROM open_trips WHERE id = $1`,
      [open_trip_id]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Open trip not found" });
    }

    const trip = tripResult.rows[0];

    // Check if trip is closed
    if (trip.is_closed) {
      return res.status(400).json({ success: false, message: "This trip is closed for bookings" });
    }

    // Check if there's enough quota remaining
    if (trip.quota_remaining < total_participants) {
      return res.status(400).json({ success: false, message: `Not enough quota available. Only ${trip.quota_remaining} spots remaining` });
    }

    // Generate booking code
    const code = "BK" + Date.now();

    // Insert booking
    const bookingResult = await pool.query(
      `INSERT INTO bookings (
         booking_code, user_id, open_trip_id,
         customer_name, customer_email, customer_phone, emergency_contact,
         total_participants, payment_status, service_type, start_date
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [code, req.user.id, open_trip_id, customer_name, customer_email, customer_phone, customer_emergency_contact, total_participants, payment_status || "pending", service_type || 'open-trip', start_date || null]
    );

    // Update quota remaining
    await pool.query(
      `UPDATE open_trips SET quota_remaining = quota_remaining - $1 WHERE id = $2`,
      [total_participants, open_trip_id]
    );

    // Check if trip is now full and close it if necessary
    const updatedTripResult = await pool.query(
      `SELECT quota_remaining FROM open_trips WHERE id = $1`,
      [open_trip_id]
    );

    if (updatedTripResult.rows.length > 0 && updatedTripResult.rows[0].quota_remaining <= 0) {
      await pool.query(`UPDATE open_trips SET is_closed = TRUE WHERE id = $1`, [open_trip_id]);
    }

    const booking = bookingResult.rows[0];
    io.emit("bookingAdded", booking);

    res.status(201).json({ success: true, data: booking });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Endpoint to close an open trip
app.put('/api/admin/open-trips/:id/close', adminOnly, async (req, res) => {
  try {
    const tripId = req.params.id;

    const result = await pool.query(
      `UPDATE open_trips SET is_closed = TRUE WHERE id = $1 RETURNING *`,
      [tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Open trip not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error closing open trip:', error);
    res.status(500).json({ success: false, message: 'Failed to close open trip' });
  }
});

// Endpoint to reopen an open trip
app.put('/api/admin/open-trips/:id/open', adminOnly, async (req, res) => {
  try {
    const tripId = req.params.id;

    const result = await pool.query(
      `UPDATE open_trips SET is_closed = FALSE WHERE id = $1 RETURNING *`,
      [tripId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Open trip not found" });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error opening open trip:', error);
    res.status(500).json({ success: false, message: 'Failed to open open trip' });
  }
});

// ---------- Admin User Management ----------
// GET /api/admin/users - fetch all users with pagination
app.get("/api/admin/users", adminOnly, async (req, res) => {
  try {
    // Parse query parameters for pagination
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;

    // Ensure limit is within reasonable bounds
    const safeLimit = Math.min(Math.max(limit, 1), 100); // between 1 and 100
    const safeOffset = Math.max(offset, 0);

    // Build search condition if search parameter is provided
    const search = req.query.search || '';
    let searchCondition = '';
    let queryParams = [];

    if (search) {
      searchCondition = 'WHERE full_name ILIKE $3 OR email ILIKE $3';
      queryParams = [safeLimit, safeOffset, `%${search}%`];
    } else {
      queryParams = [safeLimit, safeOffset];
    }

    // Count total users matching search criteria
    const countQuery = `SELECT COUNT(*) FROM users ${searchCondition}`;
    const countResult = await pool.query(countQuery, search ? [`%${search}%`] : []);
    const totalUsers = parseInt(countResult.rows[0].count);

    // Fetch users with pagination and search
    const usersQuery = `
      SELECT id, full_name, email, phone, role, is_verified, created_at, updated_at
      FROM users
      ${searchCondition}
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(usersQuery, queryParams);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          limit: safeLimit,
          offset: safeOffset,
          total: totalUsers,
          hasMore: (safeOffset + safeLimit) < totalUsers
        }
      }
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/users - create new user by admin
app.post("/api/admin/users", adminOnly, async (req, res) => {
  const { email, username, password, role = 'user' } = req.body;

  // Validation
  if (!email || !username || !password) {
    return res.status(400).json({
      success: false,
      message: "Email, username, and password are required"
    });
  }

  // Additional validation for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  // Check if user already exists
  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    const hashed = hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, created_at`,
      [username, email, hashed, role]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Admin user creation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/admin/create-admin - create new admin user with admin code
app.post("/api/admin/create-admin", adminOnly, async (req, res) => {
  const { email, username, password, admin_code } = req.body;

  // Validation
  if (!email || !username || !password || !admin_code) {
    return res.status(400).json({
      success: false,
      message: "Email, username, password, and admin code are required"
    });
  }

  // Check admin code
  const ADMIN_CODE = process.env.ADMIN_CODE || "CARTENZ2024";
  if (admin_code !== ADMIN_CODE) {
    return res.status(401).json({
      success: false,
      message: "Invalid admin code"
    });
  }

  // Additional validation for email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  // Check if user already exists
  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }

    const hashed = hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, role, created_at`,
      [username, email, hashed, 'admin']
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Admin admin creation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /api/admin/users/:id - update user (role, etc.)
app.put("/api/admin/users/:id", adminOnly, async (req, res) => {
  const userId = req.params.id;
  const { role, full_name } = req.body;

  try {
    // Build update query based on provided fields
    const updates = [];
    const params = [];

    if (role !== undefined) {
      updates.push(`role = $${updates.length + 1}`);
      params.push(role);
    }
    if (full_name !== undefined) {
      updates.push(`full_name = $${updates.length + 1}`);
      params.push(full_name);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update"
      });
    }

    params.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('User update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/admin/users/:id - delete user
app.delete("/api/admin/users/:id", adminOnly, async (req, res) => {
  const userId = req.params.id;

  try {
    // Prevent admin from deleting themselves
    if (req.user.id === userId) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete your own account"
      });
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (err) {
    console.error('User deletion error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---------- Dashboard Stats ----------
app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const stats = {
      confirmed_bookings: 0,
      paid_bookings: 0,
      total_revenue: 0,
      available_guides: 0,
      available_porters: 0,
      active_trips: 0,
    };

    const bookings = await pool.query("SELECT * FROM bookings");
    stats.confirmed_bookings = bookings.rowCount;
    stats.paid_bookings = bookings.rows.filter(b => b.payment_status === "paid").length;
    stats.total_revenue = bookings.rows.reduce((sum, b) => sum + (b.total_price || 0), 0);

    const guides = await pool.query("SELECT * FROM guides");
    stats.available_guides = guides.rowCount;

    const porters = await pool.query("SELECT * FROM porters");
    stats.available_porters = porters.rowCount;

    const trips = await pool.query("SELECT * FROM open_trips");
    stats.active_trips = trips.rowCount;

    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Payment routes - We need to handle raw JSON for Midtrans webhook
const createPaymentRoutes = require('./routes/paymentRoutes');

// Middleware to handle raw body for webhook
app.use('/api/payment/webhook', express.raw({type: 'application/json'}), (req, res, next) => {
  console.log('Received Midtrans webhook request');
  // Parse the raw body as JSON only for webhook endpoint
  if (req.headers['content-type'] === 'application/json') {
    try {
      req.body = JSON.parse(req.body.toString());
      console.log('Parsed webhook body:', JSON.stringify(req.body, null, 2));
    } catch (e) {
      console.error('Error parsing webhook JSON:', e);
      return res.status(400).json({ success: false, message: 'Invalid JSON in webhook' });
    }
  }
  next();
});

app.use('/api/payment', createPaymentRoutes(pool));
console.log('✅ Payment routes loaded');

// Booking routes
const createBookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', createBookingRoutes(pool));
console.log('✅ Booking routes loaded');

// POST /api/bookings - Create a new booking (from payment integration) - Requires authentication
app.post("/api/bookings/payment", authMiddleware, async (req, res) => {
  try {
    const {
      booking_id,
      customer_name,
      customer_email,
      customer_phone,
      emergency_contact,
      service_type,
      open_trip_id,
      guide_id,
      porter_id,
      start_date,
      end_date,
      total_participants,
      total_price,
      special_requests,
      dietary_requirements,
      medical_conditions,
      need_porter,
      need_documentation,
      need_equipment,
      need_transport,
      base_price,
      additional_services_price,
      insurance_price,
      admin_fee
    } = req.body;

    // Validate required fields - open_trip_id is optional for non-open-trip bookings
    if (!booking_id || !customer_name || !customer_email || !customer_phone || !total_participants || !total_price) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: booking_id, customer_name, customer_email, customer_phone, total_participants, total_price"
      });
    }

    // Validate that open_trip_id exists in the open_trips table (only if it's provided and not null/undefined)
    if (open_trip_id !== undefined && open_trip_id !== null && open_trip_id !== '') {
      const tripCheckQuery = `SELECT id FROM open_trips WHERE id = $1`;
      const tripCheckResult = await pool.query(tripCheckQuery, [open_trip_id]);

      if (tripCheckResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Open trip with id ${open_trip_id} does not exist`
        });
      }
    }

    // Generate booking code
    const bookingCode = booking_id.startsWith('ORDER-') ? booking_id : `ORDER-${Date.now()}`;

    // Insert booking into database - Include user_id from authenticated user
    const insertQuery = `
      INSERT INTO bookings (
        booking_code,
        customer_name,
        customer_email,
        customer_phone,
        emergency_contact,
        service_type,
        open_trip_id,
        guide_id,
        porter_id,
        start_date,
        end_date,
        total_participants,
        total_price,
        special_requests,
        dietary_requirements,
        medical_conditions,
        need_porter,
        need_documentation,
        need_equipment,
        need_transport,
        base_price,
        additional_services_price,
        insurance_price,
        admin_fee,
        user_id,
        status,
        payment_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, 'pending', 'pending')
      RETURNING id, booking_code, customer_name, customer_email, created_at
    `;

    const values = [
      bookingCode,
      customer_name,
      customer_email,
      customer_phone,
      emergency_contact || '',
      service_type || 'open-trip',
      (open_trip_id !== undefined && open_trip_id !== null && open_trip_id !== '') ? open_trip_id : null, // Allow null for open_trip_id for non-open-trip bookings
      guide_id || null,
      porter_id || null,
      start_date || null,
      end_date || null,
      total_participants,
      total_price,
      special_requests || '',
      dietary_requirements || '',
      medical_conditions || '',
      need_porter || false,
      need_documentation || false,
      need_equipment || false,
      need_transport || false,
      base_price || 0,
      additional_services_price || 0,
      insurance_price || 0,
      admin_fee || 0,
      req.user.id // Add the authenticated user ID
    ];

    const result = await pool.query(insertQuery, values);

    res.json({
      success: true,
      message: "Booking created successfully",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create booking"
    });
  }
});

// GET /api/bookings/:id - Get specific booking by ID or booking code
app.get("/api/bookings/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        b.*,
        to_char(b.created_at, 'YYYY-MM-DD') as booking_date,
        to_char(b.start_date, 'YYYY-MM-DD') as trip_date,
        ot.title as open_trip_title,
        ot.duration_days,
        ot.duration_nights,
        ot.mountain_id,
        m.name as mountain_name,
        g.name as guide_name,
        p.name as porter_name
      FROM bookings b
      LEFT JOIN open_trips ot ON b.open_trip_id = ot.id
      LEFT JOIN mountains m ON ot.mountain_id = m.id
      LEFT JOIN guides g ON b.guide_id = g.id
      LEFT JOIN porters p ON b.porter_id = p.id
      WHERE b.id = $1::uuid OR b.booking_code = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch booking"
    });
  }
});

// DELETE /api/admin/bookings/:id - Delete specific booking by ID (admin only)
app.delete("/api/admin/bookings/:id", adminOnly, async (req, res) => {
  try {
    const bookingId = req.params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID format. Must be a valid UUID."
      });
    }

    // Check if booking exists
    const existingBooking = await pool.query(
      'SELECT id, booking_code FROM bookings WHERE id = $1',
      [bookingId]
    );

    if (existingBooking.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    // If booking is related to an open trip, we might want to increment the quota back
    // Get the booking details to check if it was for an open trip
    const booking = existingBooking.rows[0];

    // Delete the booking
    const result = await pool.query(
      'DELETE FROM bookings WHERE id = $1 RETURNING *',
      [bookingId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found or could not be deleted"
      });
    }

    console.log(`Booking ${booking.booking_code} (ID: ${bookingId}) deleted by admin ${req.user.id}`);

    res.json({
      success: true,
      message: "Booking deleted successfully",
      data: {
        deleted_booking_id: bookingId,
        deleted_booking_code: booking.booking_code
      }
    });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete booking"
    });
  }
});

// ---------- Start Server ----------
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));