import { Router } from "express";
import {
    login,
    listarUsuarios,
    criarUsuario,
    atualizarUsuario,
    excluirUsuario,
    buscarUsuarioPorId,
} from "../controllers/usuarios.controller.js";

const router = Router();

// Rota de login
router.post("/login", login);

// Rotas para usuários
router.get("/", listarUsuarios);
router.post("/", criarUsuario);
router.get("/:id", buscarUsuarioPorId);
router.put("/:id", atualizarUsuario);
router.delete("/:id", excluirUsuario);

export default router;