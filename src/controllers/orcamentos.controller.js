import { pool } from "../config/db.js";

function getAuditInfo(req) {
    const usuarioNome = req.body?.usuarioNome || req.body?.usuario?.nome || req.body?.usuario_nome || 'Desconhecido';
    const timestamp = new Date().toISOString();
    return { usuarioNome, timestamp };
}

function formatAuditData(data) {
    try {
        return JSON.stringify(data);
    } catch (err) {
        return String(data);
    }
}

async function registrarAuditoria(conn, { osId = null, numeroOS = null, acao, usuarioNome, descricao = null, dadosAntes = null, dadosDepois = null }) {
    await conn.execute(
        `INSERT INTO auditoria_ordens_servico 
            (os_id, numero_os, acao, usuario_nome, descricao, dados_antes, dados_depois)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            osId,
            numeroOS,
            acao,
            usuarioNome,
            descricao,
            dadosAntes ? formatAuditData(dadosAntes) : null,
            dadosDepois ? formatAuditData(dadosDepois) : null
        ]
    );
}

export async function criarOrcamento(req, res) {
    const audit = getAuditInfo(req);
    console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] 📨 Requisição POST recebida:`, req.body);
    const { numeroOS, cliente, itens, total, status } = req.body;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Cliente
        console.log("👤 Inserindo cliente:", cliente);
        const [clienteResult] = await conn.execute(
            "INSERT INTO clientes (nome, telefone, email) VALUES (?, ?, ?)",
            [cliente.nome, cliente.telefone, cliente.email]
        );
        console.log("✅ Cliente inserido com ID:", clienteResult.insertId);

        const clienteId = clienteResult.insertId;

        // OS
        console.log("📋 Inserindo ordem de serviço");
        const [osResult] = await conn.execute(
            `INSERT INTO ordens_servico 
   (numero_os, cliente_id, total, status, data_criacao)
   VALUES (?, ?, ?, ?, NOW())`,
            [numeroOS, clienteId, total, status]
        );
        console.log("✅ OS inserida com ID:", osResult.insertId);

        const osId = osResult.insertId;

        // Itens
        console.log("📦 Inserindo itens...");
        for (const item of itens) {
            console.log("  - Inserindo item:", item.descricao);
            await conn.execute(
                `INSERT INTO itens_ordem_servico 
         (ordem_servico_id, descricao, quantidade, valor_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
                [osId, item.descricao, item.quantidade, item.valorUnitario, item.subtotal]
            );
        }
        console.log("✅ Todos os itens inseridos");

        await registrarAuditoria(conn, {
            osId,
            numeroOS,
            acao: "criar",
            usuarioNome: audit.usuarioNome,
            descricao: `OS criada pelo usuário ${audit.usuarioNome}`,
            dadosAntes: null,
            dadosDepois: {
                numeroOS,
                status,
                total,
                cliente,
                itens
            }
        });

        await conn.commit();
        console.log(`✅ Transação finalizada com sucesso`);
        console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] 🟢 OS criada: id=${osId}, numero_os=${numeroOS}, cliente=${cliente.nome}, total=${total}, status=${status}`);
        res.status(201).json({ message: "Orçamento criado com sucesso" });

    } catch (err) {
        console.error("❌ ERRO ao salvar orçamento:", err.message);
        console.error("Stack:", err.stack);
        await conn.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
}
export async function listarOrcamentos(req, res) {
    try {
        const [rows] = await pool.execute(`
      SELECT 
  os.id,
  os.numero_os AS numeroOS,
  os.total,
  os.status,
  c.nome AS cliente,
  os.data_criacao,
  os.data_finalizacao
FROM ordens_servico os
JOIN clientes c ON c.id = os.cliente_id
ORDER BY os.data_criacao DESC
    `);
        res.json(rows);
    } catch (err) {
        console.error("Erro ao listar:", err);
        res.status(500).json({ error: err.message });
    }
}

function userHasAuditoriaAccess(usuario) {
    if (!usuario) return false;
    const paginas = usuario.paginas_acesso || [];
    return Array.isArray(paginas) && paginas.includes("auditoria");
}

export async function listarAuditoria(req, res) {
    const usuarioId = req.query.usuarioId;

    if (!usuarioId) {
        return res.status(403).json({ error: "Acesso negado: usuário não informado" });
    }

    try {
        const [users] = await pool.execute(
            "SELECT paginas_acesso FROM usuarios WHERE id = ? AND ativo = 1",
            [usuarioId]
        );

        if (users.length === 0) {
            return res.status(403).json({ error: "Acesso negado: usuário inválido" });
        }

        const usuario = users[0];
        let paginasAcesso = usuario.paginas_acesso;
        if (typeof paginasAcesso === 'string') {
            try {
                paginasAcesso = JSON.parse(paginasAcesso);
            } catch {
                paginasAcesso = [];
            }
        }

        if (!userHasAuditoriaAccess({ paginas_acesso: paginasAcesso })) {
            return res.status(403).json({ error: "Acesso negado: página de auditoria restrita" });
        }

        const [rows] = await pool.execute(
            `SELECT id, os_id, numero_os AS numeroOS, acao, usuario_nome AS usuarioNome, descricao, dados_antes, dados_depois, data_hora AS dataHora
             FROM auditoria_ordens_servico
             ORDER BY data_hora DESC`
        );

        const parsed = rows.map(row => ({
            ...row,
            dadosAntes: row.dados_antes ? JSON.parse(row.dados_antes) : null,
            dadosDepois: row.dados_depois ? JSON.parse(row.dados_depois) : null
        }));

        res.json(parsed);
    } catch (err) {
        console.error("Erro ao listar auditoria:", err);
        res.status(500).json({ error: err.message });
    }
}
export async function atualizarStatus(req, res) {
    const { id } = req.params;
    const { status } = req.body;
    const audit = getAuditInfo(req);

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [[osAtual]] = await conn.execute(
            `SELECT 
                os.id, os.numero_os, os.total, os.status,
                c.nome AS cliente_nome
            FROM ordens_servico os
            JOIN clientes c ON c.id = os.cliente_id
            WHERE os.id = ?`,
            [id]
        );

        if (!osAtual) {
            await conn.rollback();
            return res.status(404).json({ error: "OS não encontrada" });
        }

        // Se status é "Cancelada", mover para tabela de excluídas
        if (status === "Cancelada") {
            // Inserir na tabela de excluídas
            await conn.execute(
                `INSERT INTO ordens_servico_excluidas
                (ordem_servico_id, numero_os, cliente_nome, total, motivo, data_exclusao)
                VALUES (?, ?, ?, ?, 'Cancelada pelo usuário', NOW())`,
                [osAtual.id, osAtual.numero_os, osAtual.cliente_nome, osAtual.total]
            );

            // Copiar itens para tabela de excluídos
            const [itens] = await conn.execute(
                "SELECT * FROM itens_ordem_servico WHERE ordem_servico_id = ?",
                [id]
            );

            for (const item of itens) {
                await conn.execute(
                    `INSERT INTO itens_ordem_servico_excluidos
                    (ordem_servico_id, descricao, quantidade, valor_unitario, subtotal)
                    VALUES (?, ?, ?, ?, ?)`,
                    [item.ordem_servico_id, item.descricao, item.quantidade, item.valor_unitario, item.subtotal]
                );
            }

            // Deletar itens da OS original
            await conn.execute(
                "DELETE FROM itens_ordem_servico WHERE ordem_servico_id = ?",
                [id]
            );

            // Deletar a OS original
            await conn.execute(
                "DELETE FROM ordens_servico WHERE id = ?",
                [id]
            );

            await registrarAuditoria(conn, {
                osId: osAtual.id,
                numeroOS: osAtual.numero_os,
                acao: "cancelar",
                usuarioNome: audit.usuarioNome,
                descricao: `OS cancelada pelo usuário ${audit.usuarioNome}`,
                dadosAntes: { status: osAtual.status, total: osAtual.total, cliente: osAtual.cliente_nome },
                dadosDepois: { status: "Cancelada" }
            });

            console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] ⚠️ OS cancelada: id=${id}, numero_os=${osAtual.numero_os}, cliente=${osAtual.cliente_nome}, total=${osAtual.total}`);
        } else if (status === "Aprovada") {
            await conn.execute(
                "UPDATE ordens_servico SET status = ? WHERE id = ?",
                [status, id]
            );

            await registrarAuditoria(conn, {
                osId: osAtual.id,
                numeroOS: osAtual.numero_os,
                acao: "aprovar",
                usuarioNome: audit.usuarioNome,
                descricao: `OS aprovada pelo usuário ${audit.usuarioNome}`,
                dadosAntes: { status: osAtual.status },
                dadosDepois: { status }
            });

            console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] ✅ OS aprovada: id=${id}, status=${status}`);
        } else if (status === "Finalizada") {
            await conn.execute(
                "UPDATE ordens_servico SET status = ?, data_finalizacao = NOW() WHERE id = ?",
                [status, id]
            );

            await registrarAuditoria(conn, {
                osId: osAtual.id,
                numeroOS: osAtual.numero_os,
                acao: "finalizar",
                usuarioNome: audit.usuarioNome,
                descricao: `OS finalizada pelo usuário ${audit.usuarioNome}`,
                dadosAntes: { status: osAtual.status },
                dadosDepois: { status }
            });

            console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] ✅ Status alterado para Finalizada: id=${id}, status=${status}`);
        } else {
            await conn.execute(
                "UPDATE ordens_servico SET status = ? WHERE id = ?",
                [status, id]
            );

            await registrarAuditoria(conn, {
                osId: osAtual.id,
                numeroOS: osAtual.numero_os,
                acao: "editar",
                usuarioNome: audit.usuarioNome,
                descricao: `Status alterado pelo usuário ${audit.usuarioNome}`,
                dadosAntes: { status: osAtual.status },
                dadosDepois: { status }
            });

            console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] ✅ Status alterado: id=${id}, status=${status}`);
        }

        await conn.commit();
        res.sendStatus(204);

    } catch (err) {
        await conn.rollback();
        console.error("Erro ao atualizar status:", err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
}
export async function buscarOrcamentoPorId(req, res) {
    const { id } = req.params;

    try {
        // 🔹 Busca OS + cliente
        const [[os]] = await pool.execute(`
      SELECT 
  os.id,
  os.numero_os AS numeroOS,
  os.total,
  os.status,
  os.data_criacao,
  os.data_finalizacao,
  c.id AS cliente_id,
  c.nome AS cliente_nome,
  c.telefone AS cliente_telefone,
  c.email AS cliente_email
FROM ordens_servico os
JOIN clientes c ON c.id = os.cliente_id
WHERE os.id = ?
    `, [id]);

        if (!os) {
            return res.status(404).json({ error: "OS não encontrada" });
        }

        // 🔹 Busca itens da OS
        const [itens] = await pool.execute(`
      SELECT 
        descricao,
        quantidade,
        valor_unitario,
        subtotal
      FROM itens_ordem_servico
      WHERE ordem_servico_id = ?
    `, [id]);

        // 🔹 Monta objeto cliente
        const cliente = {
            id: os.cliente_id,
            nome: os.cliente_nome,
            telefone: os.cliente_telefone,
            email: os.cliente_email
        };

        // 🔹 Junta tudo
        const resposta = {
            id: os.id,
            numeroOS: os.numeroOS,
            total: os.total,
            status: os.status,
            data_criacao: os.data_criacao,
            data_finalizacao: os.data_finalizacao,
            cliente: cliente,
            itens: itens
        };

        res.json(resposta);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}

export async function atualizarOrcamento(req, res) {
    const { id } = req.params;
    const { cliente, itens } = req.body;
    const audit = getAuditInfo(req);

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // Buscar a OS para verificar se existe e se está aberta
        const [[osAntes]] = await conn.execute(
            `SELECT 
                os.numero_os,
                os.total,
                os.status,
                c.id AS cliente_id,
                c.nome AS cliente_nome,
                c.telefone AS cliente_telefone,
                c.email AS cliente_email
            FROM ordens_servico os
            JOIN clientes c ON c.id = os.cliente_id
            WHERE os.id = ?`,
            [id]
        );

        if (!osAntes) {
            await conn.rollback();
            return res.status(404).json({ error: "OS não encontrada" });
        }

        if (osAntes.status !== "Aberta") {
            await conn.rollback();
            return res.status(400).json({ error: "Apenas OS aberta pode ser editada" });
        }

        const [itensAntes] = await conn.execute(
            `SELECT descricao, quantidade, valor_unitario, subtotal
            FROM itens_ordem_servico
            WHERE ordem_servico_id = ?`,
            [id]
        );

        const snapshotAntes = {
            numeroOS: osAntes.numero_os,
            total: osAntes.total,
            status: osAntes.status,
            cliente: {
                nome: osAntes.cliente_nome,
                telefone: osAntes.cliente_telefone,
                email: osAntes.cliente_email
            },
            itens: itensAntes
        };

        // Atualizar dados do cliente
        if (cliente) {
            await conn.execute(
                "UPDATE clientes SET nome = ?, telefone = ?, email = ? WHERE id = ?",
                [cliente.nome || null, cliente.telefone || null, cliente.email || null, osAntes.cliente_id]
            );
            console.log(`✏️ Atualizando cliente da OS aberta id=${id}, cliente_id=${osAntes.cliente_id}`);
        }

        // Atualizar itens se fornecidos
        if (itens && Array.isArray(itens)) {
            console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] ✏️ Atualizando itens da OS aberta id=${id}, itens=${itens.length}`);
            // Deletar todos os itens antigos
            await conn.execute(
                "DELETE FROM itens_ordem_servico WHERE ordem_servico_id = ?",
                [id]
            );

            // Inserir novos itens
            for (const item of itens) {
                const subtotal = Number(item.quantidade) * Number(item.valorUnitario || item.valor_unitario);

                await conn.execute(
                    `INSERT INTO itens_ordem_servico 
                    (ordem_servico_id, descricao, quantidade, valor_unitario, subtotal)
                    VALUES (?, ?, ?, ?, ?)`,
                    [id, item.descricao, item.quantidade, item.valorUnitario || item.valor_unitario, subtotal]
                );
            }

            // Atualizar total da OS
            const totalItens = itens.reduce((sum, item) => {
                return sum + (Number(item.quantidade) * Number(item.valorUnitario || item.valor_unitario));
            }, 0);

            await conn.execute(
                "UPDATE ordens_servico SET total = ? WHERE id = ?",
                [totalItens, id]
            );
        }

        const [[osDepois]] = await conn.execute(
            `SELECT 
                os.numero_os,
                os.total,
                os.status,
                c.nome AS cliente_nome,
                c.telefone AS cliente_telefone,
                c.email AS cliente_email
            FROM ordens_servico os
            JOIN clientes c ON c.id = os.cliente_id
            WHERE os.id = ?`,
            [id]
        );

        const [itensDepois] = await conn.execute(
            `SELECT descricao, quantidade, valor_unitario, subtotal
            FROM itens_ordem_servico
            WHERE ordem_servico_id = ?`,
            [id]
        );

        const snapshotDepois = {
            numeroOS: osDepois.numero_os,
            total: osDepois.total,
            status: osDepois.status,
            cliente: {
                nome: osDepois.cliente_nome,
                telefone: osDepois.cliente_telefone,
                email: osDepois.cliente_email
            },
            itens: itensDepois
        };

        await registrarAuditoria(conn, {
            osId: id,
            numeroOS: snapshotDepois.numeroOS,
            acao: "editar",
            usuarioNome: audit.usuarioNome,
            descricao: `OS editada pelo usuário ${audit.usuarioNome}`,
            dadosAntes: snapshotAntes,
            dadosDepois: snapshotDepois
        });

        await conn.commit();
        console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] ✏️ OS atualizada com sucesso: id=${id}, cliente_id=${osAntes.cliente_id}, atualizouCliente=${!!cliente}, atualizouItens=${Array.isArray(itens)}`);
        res.json({ sucesso: true });

    } catch (err) {
        await conn.rollback();
        console.error("Erro ao atualizar OS:", err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
}

export async function excluirOrcamento(req, res) {
    const { id } = req.params;
    const { motivo } = req.body;

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        // 1️⃣ Buscar dados completos da OS
        const [[os]] = await conn.execute(`
      SELECT 
        os.id,
        os.numero_os,
        c.nome AS cliente_nome,
        os.total
      FROM ordens_servico os
      JOIN clientes c ON c.id = os.cliente_id
      WHERE os.id = ?
    `, [id]);

        if (!os) {
            await conn.rollback();
            return res.status(404).json({ error: "OS não encontrada" });
        }

        // 2️⃣ Inserir no histórico de excluídas
        await conn.execute(`
      INSERT INTO ordens_servico_excluidas
      (ordem_servico_id, numero_os, cliente_nome, total, motivo, data_exclusao)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [
            os.id,
            os.numero_os,
            os.cliente_nome,
            os.total,
            motivo
        ]);

        // 2.5️⃣ Salvar itens no histórico
        const [itens] = await conn.execute(
            "SELECT * FROM itens_ordem_servico WHERE ordem_servico_id = ?",
            [id]
        );

        for (const item of itens) {
            await conn.execute(`
    INSERT INTO itens_ordem_servico_excluidos
    (ordem_servico_id, descricao, quantidade, valor_unitario, subtotal)
    VALUES (?, ?, ?, ?, ?)
  `, [
                item.ordem_servico_id,
                item.descricao,
                item.quantidade,
                item.valor_unitario,
                item.subtotal
            ]);
        }


        // 3️⃣ Excluir itens da OS (garantia)
        await conn.execute(
            "DELETE FROM itens_ordem_servico WHERE ordem_servico_id = ?",
            [id]
        );

        // 4️⃣ Excluir a OS
        await conn.execute(
            "DELETE FROM ordens_servico WHERE id = ?",
            [id]
        );

        await conn.commit();

        res.json({ sucesso: true });

    } catch (error) {
        await conn.rollback();
        console.error("Erro ao excluir OS:", error);
        res.status(500).json({ error: error.message });
    } finally {
        conn.release();
    }
}

export async function listarOrcamentosFinalizados(req, res) {
    try {
        const [rows] = await pool.execute(`
      SELECT 
        os.id,
        os.numero_os AS numeroOS,
        os.total,
        c.nome AS cliente,
        os.data_finalizacao
      FROM ordens_servico os
      JOIN clientes c ON c.id = os.cliente_id
      WHERE os.status = 'Finalizada'
      ORDER BY os.data_finalizacao DESC
    `);

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
export async function listarOrcamentosExcluidos(req, res) {
    try {
        const [rows] = await pool.execute(`
      SELECT 
  id,
  ordem_servico_id,
  numero_os AS numeroOS,
  cliente_nome AS cliente,
  total,
  motivo,
  data_exclusao
FROM ordens_servico_excluidas
ORDER BY data_exclusao DESC

    `);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}
export async function restaurarOrcamento(req, res) {
    const { id } = req.params;
    const audit = getAuditInfo(req);

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [[osExcluida]] = await conn.execute(`
      SELECT *
      FROM ordens_servico_excluidas
      WHERE id = ?
    `, [id]);

        if (!osExcluida) {
            await conn.rollback();
            return res.status(404).json({ error: "OS excluída não encontrada" });
        }

        const antesSnapshot = {
            id: osExcluida.id,
            ordem_servico_id: osExcluida.ordem_servico_id,
            numeroOS: osExcluida.numero_os,
            cliente: {
                nome: osExcluida.cliente_nome
            },
            total: osExcluida.total,
            motivo: osExcluida.motivo,
            data_exclusao: osExcluida.data_exclusao
        };

        const [clienteResult] = await conn.execute(
            "INSERT INTO clientes (nome) VALUES (?)",
            [osExcluida.cliente_nome]
        );

        const clienteId = clienteResult.insertId;

        const [osResult] = await conn.execute(`
      INSERT INTO ordens_servico (numero_os, cliente_id, total, status)
      VALUES (?, ?, ?, 'Aberta')
    `, [
            osExcluida.numero_os,
            clienteId,
            osExcluida.total
        ]);

        const restauradaOsId = osResult.insertId;

        const [[osRestaurada]] = await conn.execute(`
      SELECT 
        os.id,
        os.numero_os,
        os.total,
        os.status,
        c.nome AS cliente_nome
      FROM ordens_servico os
      JOIN clientes c ON c.id = os.cliente_id
      WHERE os.id = ?
    `, [restauradaOsId]);

        const depoisSnapshot = {
            id: osRestaurada.id,
            numeroOS: osRestaurada.numero_os,
            total: osRestaurada.total,
            status: osRestaurada.status,
            cliente: {
                nome: osRestaurada.cliente_nome
            }
        };

        await registrarAuditoria(conn, {
            osId: restauradaOsId,
            numeroOS: osRestaurada.numero_os,
            acao: "restaurar",
            usuarioNome: audit.usuarioNome,
            descricao: `OS restaurada pelo usuário ${audit.usuarioNome}`,
            dadosAntes: antesSnapshot,
            dadosDepois: depoisSnapshot
        });

        await conn.execute(
            "DELETE FROM ordens_servico_excluidas WHERE id = ?",
            [id]
        );

        await conn.commit();
        console.log(`[${audit.timestamp}] [usuario=${audit.usuarioNome}] ♻️ OS restaurada: id_excluida=${id}, numero_os=${osExcluida.numero_os}, cliente=${osExcluida.cliente_nome}, total=${osExcluida.total}`);
        res.json({ sucesso: true });

    } catch (error) {
        await conn.rollback();
        console.error("Erro ao restaurar OS:", error);
        res.status(500).json({ error: error.message });
    } finally {
        conn.release();
    }
}
export async function excluirOrcamentoDefinitivo(req, res) {
    const { id } = req.params;

    console.log("🗑️ Excluindo OS excluída ID:", id);

    try {
        const [result] = await pool.execute(
            "DELETE FROM ordens_servico_excluidas WHERE id = ?",
            [id]
        );

        console.log("🧾 affectedRows:", result.affectedRows);

        res.json({ sucesso: true });

    } catch (error) {
        console.error("Erro ao excluir definitivamente:", error);
        res.status(500).json({ error: error.message });
    }
}






