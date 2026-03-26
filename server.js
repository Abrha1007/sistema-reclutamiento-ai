import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
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

// 🔥 GEMINI CONFIG (CORRECTO)
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY
});



// =========================
// 🤖 CHAT
// =========================
app.post("/chat", async (req, res) => {
  const { messages } = req.body;

  try {
    const prompt = `
    Eres el asistente de soporte de la plataforma de Alejandro.
    Solo respondes cosas relacionadas con:
    - escaneo de documentos
    - registro de clientes
    - cámaras IP
    - portal wifi
    - tickets

    Responde claro y profesional.

    Usuario: ${messages[messages.length - 1].content}
    `;

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt
    });

    res.json({
      reply: {
        role: "assistant",
        content: result.text
      }
    });

  } catch (err) {
    console.error("❌ Error Gemini:", err);
    res.status(500).json({ error: "Error en IA" });
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
Eres un reclutador experto.

Analiza este CV y genera:

- Nombre del candidato
- Puntuación (1-10)
- Habilidades clave
- Experiencia
- Veredicto

CV:
${textoCV}
`;

const result = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: prompt
});

const texto = result.text;




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
