require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");

const app = express();

// ================== ENV CHECK ==================
console.log("OpenAI Key Loaded:", process.env.OPENAI_API_KEY ? "YES" : "NO");

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// ================== OPENAI ==================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ================== DATABASE ==================
const db = mysql.createConnection({
  host: process.env.DB_HOST || "metro.proxy.rlwy.net",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "railway",
  port: process.env.DB_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.log("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL");
  }
});

// ================== ROUTES ==================

app.get("/", (req, res) => {
  res.send("GameHub Backend Running");
});

// -------- RECOMMEND --------
app.post("/api/recommend", async (req, res) => {
  try {
    const { userMessage } = req.body;

    if (!userMessage) {
      return res.status(400).json({ error: "User message required" });
    }

    db.query("SELECT name, genre, price FROM games", async (err, results) => {
      if (err) {
        console.error("DB error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (results.length === 0) {
        return res.json({ reply: "No games available currently." });
      }

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

      } catch (aiError) {
        console.error("OpenAI error:", aiError);
        res.status(500).json({ error: "AI processing failed" });
      }
    });

  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// -------- SUPPORT --------
app.post("/api/support", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are GameHub support assistant. Help users with login, payment, refund, and download issues."
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 250
    });

    res.json({ reply: response.choices[0].message.content });

  } catch (error) {
    console.error("Support AI error:", error);
    res.status(500).json({ error: "Support AI failed" });
  }
});

// ================== SERVER START ==================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
