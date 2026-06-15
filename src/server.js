import app from "./app.js";
import dotenv from "dotenv";

dotenv.config();

const server = app.listen(3000, () => {
    console.log("🚀 API rodando em http://localhost:3000");
});

// Log de conexões
server.on("error", (err) => {
    console.error("❌ Erro no servidor:", err);
});
