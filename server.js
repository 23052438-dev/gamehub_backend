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

app.listen(PORT, () => {
    console.log("Server running");
});
