import mysql from "mysql2/promise";

console.log("🔌 Iniciando conexão com MySQL...");

export const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Ph07052002",
    database: "orcamento",
    waitForConnections: true,
    connectionLimit: 10
});

console.log("✅ Pool de conexão criado");

async function ensureAuditTableExists() {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS auditoria_ordens_servico (
                id INT AUTO_INCREMENT PRIMARY KEY,
                os_id INT NULL,
                numero_os VARCHAR(100) NULL,
                acao ENUM('criar', 'editar', 'restaurar', 'aprovar', 'cancelar', 'finalizar') NOT NULL,
                usuario_nome VARCHAR(255) NOT NULL,
                descricao TEXT NULL,
                dados_antes LONGTEXT NULL,
                dados_depois LONGTEXT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.execute(`
            ALTER TABLE auditoria_ordens_servico
            MODIFY COLUMN acao ENUM('criar', 'editar', 'restaurar', 'aprovar', 'cancelar', 'finalizar') NOT NULL
        `);
        console.log("✅ Tabela de auditoria garantida");
    } catch (err) {
        console.error("❌ Erro ao garantir tabela de auditoria:", err.message);
    }
}

pool.getConnection()
    .then(() => {
        console.log("✅ Conexão com banco de dados bem-sucedida");
        ensureAuditTableExists();
    })
    .catch(err => console.error("❌ Erro ao conectar ao banco:", err.message));
