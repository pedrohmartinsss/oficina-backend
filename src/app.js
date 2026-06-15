import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import orcamentosRoutes from "./routes/orcamentos.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import agendaRoutes from "./routes/agenda.routes.js";
import notificacoesRoutes from "./routes/notificacoes.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: [
    "https://seudominio.com.br",
    "https://www.seudominio.com.br"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "../../")));

app.use("/api/orcamentos", orcamentosRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/agenda", agendaRoutes);
app.use("/api/notificacoes", notificacoesRoutes);

app.get("/", (req, res) => {
    res.status(200).json({
        status: "online",
        sistema: "Oficina Backend",
        versao: "1.0.0"
    });
});

export default app;
