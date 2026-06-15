import { Router } from "express";
import {
    criarOrcamento,
    listarOrcamentos,
    atualizarStatus,
    buscarOrcamentoPorId,
    excluirOrcamento,
    listarOrcamentosFinalizados,
    listarOrcamentosExcluidos,
    restaurarOrcamento,
    excluirOrcamentoDefinitivo,
    atualizarOrcamento, listarAuditoria,
} from "../controllers/orcamentos.controller.js";


const router = Router();


router.post("/", criarOrcamento);
router.get("/", listarOrcamentos); router.get("/auditoria", listarAuditoria);
router.get("/finalizadas", listarOrcamentosFinalizados);
router.get("/excluidas", listarOrcamentosExcluidos);

router.post("/excluidas/:id/restaurar", restaurarOrcamento);
router.delete("/excluidas/:id", excluirOrcamentoDefinitivo);

router.put("/:id/status", atualizarStatus);
router.put("/:id", atualizarOrcamento);
router.get("/:id", buscarOrcamentoPorId);
router.delete("/:id", excluirOrcamento);





export default router;
