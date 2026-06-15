import { Router } from "express";
import {
    listarNotificacoes,
    criarNotificacao,
    marcarComoLida,
    excluirNotificacao,
    listarNotificacoesPorUsuario,
} from "../controllers/notificacoes.controller.js";

const router = Router();

router.get("/", listarNotificacoes);
router.post("/", criarNotificacao);
router.put("/:id/lida", marcarComoLida);
router.delete("/:id", excluirNotificacao);
router.get("/usuario/:usuario_id", listarNotificacoesPorUsuario);

export default router;