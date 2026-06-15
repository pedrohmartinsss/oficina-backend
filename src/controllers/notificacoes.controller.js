import { pool } from "../config/db.js";

// Função para listar notificações
export async function listarNotificacoes(req, res) {
    try {
        const [rows] = await pool.execute(`
            SELECT
                n.id,
                n.titulo,
                n.mensagem,
                n.tipo,
                n.lida,
                n.usuario_id,
                u.nome as usuario_nome,
                n.data_criacao
            FROM notificacoes n
            LEFT JOIN usuarios u ON u.id = n.usuario_id
            ORDER BY n.data_criacao DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao listar notificações:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para criar notificação
export async function criarNotificacao(req, res) {
    const { titulo, mensagem, tipo, usuario_id } = req.body;

    try {
        const [result] = await pool.execute(
            "INSERT INTO notificacoes (titulo, mensagem, tipo, lida, usuario_id, data_criacao) VALUES (?, ?, ?, 0, ?, NOW())",
            [titulo, mensagem, tipo, usuario_id]
        );

        res.status(201).json({
            id: result.insertId,
            titulo,
            mensagem,
            tipo,
            lida: false,
            usuario_id
        });
    } catch (err) {
        console.error("Erro ao criar notificação:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para marcar notificação como lida
export async function marcarComoLida(req, res) {
    const { id } = req.params;

    try {
        const [result] = await pool.execute(
            "UPDATE notificacoes SET lida = 1 WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Notificação não encontrada" });
        }

        res.json({ message: "Notificação marcada como lida" });
    } catch (err) {
        console.error("Erro ao marcar notificação como lida:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para excluir notificação
export async function excluirNotificacao(req, res) {
    const { id } = req.params;

    try {
        const [result] = await pool.execute(
            "DELETE FROM notificacoes WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Notificação não encontrada" });
        }

        res.json({ message: "Notificação excluída com sucesso" });
    } catch (err) {
        console.error("Erro ao excluir notificação:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para buscar notificações por usuário
export async function listarNotificacoesPorUsuario(req, res) {
    const { usuario_id } = req.params;

    try {
        const [rows] = await pool.execute(`
            SELECT
                id,
                titulo,
                mensagem,
                tipo,
                lida,
                data_criacao
            FROM notificacoes
            WHERE usuario_id = ?
            ORDER BY data_criacao DESC
        `, [usuario_id]);

        res.json(rows);
    } catch (err) {
        console.error("Erro ao listar notificações do usuário:", err);
        res.status(500).json({ error: err.message });
    }
}