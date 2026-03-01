require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

// ================== MIDDLEWARE ==================
app.use(cors({
  origin: [
    "https://gamehub-frontend-a9ma.onrender.com",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// ================== DATABASE POOL ==================
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ================== OPENAI ==================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================== AUTH MIDDLEWARE ==================
function authenticateToken(req, res, next) {

  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Access denied" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// ================== ROUTES ==================
app.get("/", (req, res) => {
  res.send("GameHub Backend Running");
});

// -------- REGISTER --------
app.post("/api/register", async (req, res) => {

  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All required fields missing" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)",
      [name, email, phone, hashedPassword],
      (err) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Email already registered" });
          }
          return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "User registered successfully" });
      }
    );

  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// -------- LOGIN --------
app.post("/api/login", (req, res) => {

  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {

      if (err) return res.status(500).json({ error: "Database error" });
      if (results.length === 0)
        return res.status(400).json({ error: "Invalid email or password" });

      const user = results[0];

      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword)
        return res.status(400).json({ error: "Invalid email or password" });

      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
      );

      res.json({ token });
    }
  );
});

// -------- PROFILE (Protected) --------
app.get("/api/profile", authenticateToken, (req, res) => {

  db.query(
    "SELECT name, email, phone FROM users WHERE id = ?",
    [req.user.id],
    (err, results) => {

      if (err) return res.status(500).json({ error: "Database error" });
      if (results.length === 0)
        return res.status(404).json({ error: "User not found" });

      res.json(results[0]);
    }
  );
});

// -------- RECOMMEND --------
app.post("/api/recommend", async (req, res) => {

  const { userMessage } = req.body;

  db.query("SELECT name, genre, price FROM games", async (err, results) => {

    if (err) return res.status(500).json({ error: "Database error" });
    if (results.length === 0)
      return res.json({ reply: "No games available currently." });

    const gameList = results.map(game =>
      `${game.name} (Genre: ${game.genre}, Price: ₹${game.price})`
    ).join("\n");

    try {
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a GameHub AI assistant. Recommend games ONLY from the given list."
          },
          {
            role: "user",
            content: `User preference: ${userMessage}

Available Games:
${gameList}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      res.json({
        reply: aiResponse.choices[0].message.content
      });

    } catch {
      res.status(500).json({ error: "AI processing failed" });
    }
  });
});

// -------- SUPPORT --------
app.post("/api/support", async (req, res) => {

  const { message } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are GameHub support assistant." },
        { role: "user", content: message }
      ],
      max_tokens: 250
    });

    res.json({ reply: response.choices[0].message.content });

  } catch {
    res.status(500).json({ error: "Support AI failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
