import { pool } from "../config/db.js";

const DEFAULT_PAGINAS = ['menu', 'agenda', 'notificacoes', 'orcamento', 'usuarios', 'excluidas', 'finalizadas', 'auditoria'];

function normalizePaginasAcesso(paginas) {
    if (!paginas) return [];

    if (typeof paginas === 'string') {
        try {
            paginas = JSON.parse(paginas);
        } catch {
            paginas = paginas
                .split(',')
                .map(p => p.trim())
                .filter(Boolean);
        }
    }

    if (!Array.isArray(paginas)) {
        return [];
    }

    return [...new Set(paginas
        .filter(p => typeof p === 'string')
        .map(p => p.trim().toLowerCase())
        .filter(Boolean)
    )];
}

function parsePaginasAcessoField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try {
        return JSON.parse(value);
    } catch {
        return typeof value === 'string' ? value.split(',').map(p => p.trim()).filter(Boolean) : [];
    }
}

function ensurePaginasAcesso(usuario) {
    const paginas = parsePaginasAcessoField(usuario.paginas_acesso);
    if (paginas.length > 0) {
        return paginas;
    }
    if (usuario.acesso === 'admin') {
        return DEFAULT_PAGINAS;
    }
    return [];
}

function validateUsuarioInput(body) {
    const nome = (body.nome || '').toString().trim();
    const login = (body.login || '').toString().trim();
    const senha = (body.senha || '').toString().trim();
    const paginas_acesso = normalizePaginasAcesso(body.paginas_acesso);

    if (!nome || !login || !senha) {
        return { valid: false, error: 'Nome, login e senha são obrigatórios', data: null };
    }

    return { valid: true, data: { nome, login, senha, paginas_acesso } };
}

// Função para login
export async function login(req, res) {
    const { login, senha } = req.body;

    try {
        const [rows] = await pool.execute(
            "SELECT id, nome, login, ativo, paginas_acesso FROM usuarios WHERE login = ? AND senha = ? AND ativo = 1",
            [login, senha]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        const usuario = rows[0];
        res.json({
            id: usuario.id,
            nome: usuario.nome,
            login: usuario.login,
            paginas_acesso: ensurePaginasAcesso(usuario)
        });
    } catch (err) {
        console.error("Erro no login:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para listar usuários
export async function listarUsuarios(req, res) {
    try {
        const [rows] = await pool.execute(
            "SELECT id, nome, login, celular, ativo, data_criacao, paginas_acesso FROM usuarios ORDER BY data_criacao DESC"
        );
        res.json(rows.map(usuario => ({
            ...usuario,
            paginas_acesso: ensurePaginasAcesso(usuario)
        })));
    } catch (err) {
        console.error("Erro ao listar usuários:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para criar usuário
export async function criarUsuario(req, res) {
    const validation = validateUsuarioInput(req.body);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    const { nome, login, senha, paginas_acesso } = validation.data;
    const celular = (req.body.celular || '').toString().trim();

    try {
        const [result] = await pool.execute(
            "INSERT INTO usuarios (nome, login, senha, celular, ativo, paginas_acesso, data_criacao) VALUES (?, ?, ?, ?, 1, ?, NOW())",
            [nome, login, senha, celular, JSON.stringify(paginas_acesso)]
        );

        res.status(201).json({
            id: result.insertId,
            nome,
            login,
            celular,
            ativo: true,
            paginas_acesso
        });
    } catch (err) {
        console.error("Erro ao criar usuário:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: "Login já existe" });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
}

// Função para atualizar usuário
export async function atualizarUsuario(req, res) {
    const { id } = req.params;
    const nome = (req.body.nome || '').toString().trim();
    const login = (req.body.login || '').toString().trim();
    const celular = (req.body.celular || '').toString().trim();
    const senha = req.body.senha ? req.body.senha.toString() : null;
    const ativo = req.body.ativo === 0 || req.body.ativo === '0' ? 0 : 1;
    const paginas_acesso = normalizePaginasAcesso(req.body.paginas_acesso);

    try {
        let query = "UPDATE usuarios SET nome = ?, login = ?, celular = ?, ativo = ?, paginas_acesso = ?";
        let params = [nome, login, celular, ativo, JSON.stringify(paginas_acesso)];

        if (senha) {
            query += ", senha = ?";
            params.push(senha);
        }

        query += " WHERE id = ?";
        params.push(id);

        const [result] = await pool.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        res.json({ message: "Usuário atualizado com sucesso" });
    } catch (err) {
        console.error("Erro ao atualizar usuário:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: "Login já existe" });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
}

// Função para excluir usuário
export async function excluirUsuario(req, res) {
    const { id } = req.params;

    try {
        const [result] = await pool.execute(
            "DELETE FROM usuarios WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        res.json({ message: "Usuário excluído com sucesso" });
    } catch (err) {
        console.error("Erro ao excluir usuário:", err);
        res.status(500).json({ error: err.message });
    }
}

// Função para buscar usuário por ID
export async function buscarUsuarioPorId(req, res) {
    const { id } = req.params;

    try {
        const [rows] = await pool.execute(
            "SELECT id, nome, login, celular, ativo, data_criacao, paginas_acesso FROM usuarios WHERE id = ?",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado" });
        }

        const usuario = rows[0];
        res.json({
            ...usuario,
            paginas_acesso: ensurePaginasAcesso(usuario)
        });
    } catch (err) {
        console.error("Erro ao buscar usuário:", err);
        res.status(500).json({ error: err.message });
    }
}