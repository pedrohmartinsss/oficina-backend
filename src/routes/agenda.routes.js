import { Router } from "express";
import {
    listarAgendamentos,
    criarAgendamento,
    atualizarAgendamento,
    excluirAgendamento,
    buscarAgendamentoPorId,
} from "../controllers/agenda.controller.js";

const router = Router();

router.get("/", listarAgendamentos);
router.post("/", criarAgendamento);
router.get("/:id", buscarAgendamentoPorId);
router.put("/:id", atualizarAgendamento);
router.delete("/:id", excluirAgendamento);

export default router;