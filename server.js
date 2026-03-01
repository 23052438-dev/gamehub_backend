require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const app = express();

app.use(cors());
app.use(express.json());
app.use(limiter);
app.listen(PORT, () => {
    console.log("Server running");
});

const db = mysql.createConnection({
  host: "metro.proxy.rlwy.net",
  user: "root",
  password: "DrfMLhQyZIkTXGDPRCynqzmSSjIjcgyX",
  database: "railway",
  port: 3306
});

db.connect((err) => {
    if (err) {
        console.log("Database connection failed:", err);
    } else {
        console.log("Connected to MySQL");
    }
});

app.get("/", (req, res) => {
    res.send("GameHub Backend Running");
});

const PORT = process.env.PORT || 5000;

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
    res.status(500).json({ error: "Support AI failed" });
  }
});

const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
