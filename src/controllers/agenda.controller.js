import { pool } from "../config/db.js";

function parseObservacoes(observacoes) {
    if (!observacoes) {
        return { obs: "", modelo: "", os: "" };
    }

    if (typeof observacoes !== "string") {
        return { obs: String(observacoes), modelo: "", os: "" };
    }

    try {
        const parsed = JSON.parse(observacoes);
        if (parsed && typeof parsed === "object") {
            return {
                obs: parsed.obs || "",
                modelo: parsed.modelo || "",
                os: parsed.os || ""
            };
        }
    } catch (err) {
        // não é JSON válido, tratar como texto simples
    }

    return { obs: observacoes, modelo: "", os: "" };
}

function formatDataHora(dataHora) {
    if (!dataHora || typeof dataHora !== "string") {
        return { data: null, hora: null };
    }

    const trimmed = dataHora.trim();
    const normalized = trimmed.replace("T", " ");
    const [data, horaRaw] = normalized.split(" ");
    if (!data) {
        return { data: null, hora: null };
    }

    let hora = horaRaw ? horaRaw.split(".")[0].replace(/Z|[+-]\d{2}:?\d{2}$/, "") : null;
    if (hora && hora.length === 5) {
        hora = `${hora}:00`;
    }

    return {
        data: data || null,
        hora: hora || null
    };
}

function parseDataField(dataValue) {
    if (!dataValue || typeof dataValue !== "string") {
        return { data: null, hora: null };
    }

    const trimmed = dataValue.trim();
    const dateTimeMatch = trimmed.match(/^([0-9]{4}-[0-9]{2}-[0-9]{2})(?:[T ]([0-9]{2}:[0-9]{2})(?::[0-9]{2})?(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?$/);
    if (!dateTimeMatch) {
        return { data: trimmed, hora: null };
    }

    const date = dateTimeMatch[1];
    let hora = dateTimeMatch[2] || null;
    if (hora && hora.length === 5) {
        hora = `${hora}:00`;
    }

    return { data: date, hora };
}

function buildAgendamentoPayload(body) {
    const nome = (body?.nome || body?.titulo || "").toString().trim();
    const telefone = (body?.telefone || "").toString().trim();
    const tipo = (body?.tipo || "").toString().trim();
    const placa = (body?.placa || "").toString().trim();
    // Preserva status vazio para 'Sem classificação'; não substitui por 'Pendente'
    const status = body?.status != null ? body.status.toString().trim() : "";
    let observacoes = body?.observacoes ?? body?.descricao ?? "";

    if (typeof observacoes !== "string") {
        observacoes = JSON.stringify(observacoes);
    }

    observacoes = observacoes.toString();

    let data = body?.data ?? null;
    let hora = body?.hora ?? null;

    if (data && typeof data === "string") {
        const parsed = parseDataField(data);
        if (parsed.data) {
            data = parsed.data;
            hora = hora || parsed.hora;
        }
    }

    if ((!data || !hora) && body?.data_hora) {
        const parsed = formatDataHora(body.data_hora);
        data = data || parsed.data;
        hora = hora || parsed.hora;
    }

    return {
        nome: nome || null,
        telefone,
        tipo,
        placa,
        status,
        observacoes,
        data: data || null,
        hora: hora || null
    };
}

function formatResponseRow(row) {
    const observacoesParsed = parseObservacoes(row.observacoes);
    return {
        id: row.id,
        nome: row.nome,
        telefone: row.telefone,
        tipo: row.tipo,
        placa: row.placa || "",
        data: row.data
            ? row.data.toISOString().split("T")[0]
            : null,
        hora: row.hora,
        observacoes: row.observacoes,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        titulo: row.nome,
        descricao: observacoesParsed.obs,
        data_hora: row.data && row.hora ? `${row.data} ${row.hora}` : null,
        modelo: observacoesParsed.modelo,
        os: observacoesParsed.os
    };
}

function validateAgendamentoPayload(payload) {
    if (!payload.nome) {
        return { valid: false, error: 'O campo nome é obrigatório.' };
    }
    if (!payload.tipo) {
        return { valid: false, error: 'O campo tipo de serviço é obrigatório.' };
    }
    if (!payload.data) {
        return { valid: false, error: 'O campo data é obrigatório.' };
    }
    if (!payload.hora) {
        return { valid: false, error: 'O campo hora é obrigatório.' };
    }

    return { valid: true };
}

// Função para listar agendamentos
export async function listarAgendamentos(req, res) {
    try {
        const [rows] = await pool.execute(
            `SELECT id, nome, telefone, tipo, placa, data, hora, observacoes, status, created_at, updated_at FROM agendamentos ORDER BY data ASC, hora ASC`
        );
        res.json(rows.map(formatResponseRow));
    } catch (err) {
        console.error("Erro ao listar agendamentos:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para criar agendamento
export async function criarAgendamento(req, res) {
    const payload = buildAgendamentoPayload(req.body);
    const validation = validateAgendamentoPayload(payload);

    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const [result] = await pool.execute(
            "INSERT INTO agendamentos (nome, telefone, tipo, placa, data, hora, observacoes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())",
            [
                payload.nome,
                payload.telefone,
                payload.tipo,
                payload.placa,
                payload.data,
                payload.hora,
                payload.observacoes,
                payload.status
            ]
        );

        res.status(201).json({
            id: result.insertId,
            ...payload,
            titulo: payload.nome,
            descricao: parseObservacoes(payload.observacoes).obs,
            data_hora: payload.data && payload.hora ? `${payload.data} ${payload.hora}` : null
        });
    } catch (err) {
        console.error("Erro ao criar agendamento:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para atualizar agendamento
export async function atualizarAgendamento(req, res) {
    const { id } = req.params;
    const payload = buildAgendamentoPayload(req.body);
    const validation = validateAgendamentoPayload(payload);

    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const [result] = await pool.execute(
            "UPDATE agendamentos SET nome = ?, telefone = ?, tipo = ?, placa = ?, data = ?, hora = ?, observacoes = ?, status = ?, updated_at = NOW() WHERE id = ?",
            [
                payload.nome,
                payload.telefone,
                payload.tipo,
                payload.placa,
                payload.data,
                payload.hora,
                payload.observacoes,
                payload.status,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Agendamento não encontrado" });
        }

        res.json({ message: "Agendamento atualizado com sucesso" });
    } catch (err) {
        console.error("Erro ao atualizar agendamento:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para excluir agendamento
export async function excluirAgendamento(req, res) {
    const { id } = req.params;

    try {
        const [result] = await pool.execute(
            "DELETE FROM agendamentos WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Agendamento não encontrado" });
        }

        res.json({ message: "Agendamento excluído com sucesso" });
    } catch (err) {
        console.error("Erro ao excluir agendamento:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para buscar agendamento por ID
export async function buscarAgendamentoPorId(req, res) {
    const { id } = req.params;

    try {
        const [rows] = await pool.execute(
            `SELECT id, nome, telefone, tipo, placa, data, hora, observacoes, status, created_at, updated_at FROM agendamentos WHERE id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Agendamento não encontrado" });
        }

        res.json(formatResponseRow(rows[0]));
    } catch (err) {
        console.error("Erro ao buscar agendamento:", err);
        res.status(500).json({ error: err.message });
    }
}
