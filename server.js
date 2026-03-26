import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import fs from "fs";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfParse = require("pdf-parse-debugging-disabled");





dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ⚙️ __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 👉 servir HTML
app.use(express.static(__dirname));

// 🔥 MULTER (subida de archivos)
const upload = multer({ dest: "uploads/" });

// 🔥 "BASE DE DATOS" temporal
let candidatos = [];

// 🔥 GEMINI CONFIG
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-latest",

  systemInstruction: `
  Eres el asistente de soporte de la plataforma de Alejandro.
  También puedes analizar CVs y evaluar candidatos.

  Si analizas un CV debes dar:
  - Nombre del candidato
  - Puntuación (1-10)
  - Habilidades clave
  - Experiencia
  - Veredicto

  Responde en español, claro y profesional.
  `,
});


// =========================
// 🤖 CHAT
// =========================
app.post("/chat", async (req, res) => {
  const { messages } = req.body;

  try {
    const history = messages
  .filter(m => m.role === "user" || m.role === "assistant")
  .map(m => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }]
  }));

// 🔥 FORZAR que el primero sea user
if (history.length === 0 || history[0].role !== "user") {
  history.unshift({
    role: "user",
    parts: [{ text: "Hola" }]
  });
}

const chat = model.startChat({ history });

const result = await chat.sendMessage(messages[messages.length - 1].content);
const text = result.response.text();


    res.json({
      reply: {
        role: "assistant",
        content: text,
      },
    });

  } catch (err) {
    console.error("❌ Error Gemini:", err);
    res.status(500).json({ error: "Error al generar respuesta" });
  }
});


// =========================
// 📄 ANALIZAR CV
// =========================
app.post("/analizar-cv", upload.single("cv"), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);

    const textoCV = pdfData.text;

    const prompt = `
    Analiza este CV y genera:

    Nombre del candidato:
    Puntuación (1-10):
    Habilidades clave:
    Experiencia:
    Veredicto:

    CV:
    ${textoCV}
    `;

    const result = await model.generateContent(prompt);
    const texto = result.response.text();


    // 🔥 guardar candidato
    const candidato = {
      id: Date.now(),
      archivo: req.file.originalname,
      analisis: texto,
      fecha: new Date()
    };

    candidatos.push(candidato);

    // eliminar archivo temporal
    fs.unlinkSync(req.file.path);

    res.json({ analisis: texto });

  } catch (err) {
    console.error("❌ Error al analizar CV:", err);
    res.status(500).json({ error: "Error al analizar CV" });
  }
});


// =========================
// 📊 VER CANDIDATOS
// =========================
app.get("/candidatos", (req, res) => {
  res.json(candidatos);
});


// =========================
// 🌐 ROOT
// =========================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// =========================
// 🚀 SERVER
// =========================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor Gemini en http://localhost:${PORT}`);
});
