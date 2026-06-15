import mysql from "mysql2/promise";

async function verificarMudancasBanco() {
    try {
        const pool = mysql.createPool({
            host: "localhost",
            user: "root",
            password: "Ph07052002",
            database: "orcamento",
            waitForConnections: true,
            connectionLimit: 1
        });

        const conn = await pool.getConnection();

        console.log("🔍 VERIFICAÇÃO DE MUDANÇAS NO BANCO DE DADOS\n");

        // Verificar usuários
        const [usuarios] = await conn.execute(`SELECT COUNT(*) as total FROM usuarios`);
        console.log(`👥 Usuários: ${usuarios[0].total} registros`);

        // Verificar agendamentos
        const [agendamentos] = await conn.execute(`SELECT COUNT(*) as total FROM agendamentos`);
        console.log(`📅 Agendamentos: ${agendamentos[0].total} registros`);

        // Verificar notificações
        const [notificacoes] = await conn.execute(`SELECT COUNT(*) as total FROM notificacoes`);
        console.log(`🔔 Notificações: ${notificacoes[0].total} registros`);

        // Verificar ordens de serviço
        const [ordens] = await conn.execute(`SELECT COUNT(*) as total FROM ordens_servico`);
        console.log(`📋 Ordens de Serviço: ${ordens[0].total} registros`);

        console.log("\n📊 ÚLTIMOS REGISTROS POR TABELA:\n");

        // Últimos usuários
        const [ultimosUsuarios] = await conn.execute(`
            SELECT id, nome, login, data_criacao, paginas_acesso
            FROM usuarios
            ORDER BY data_criacao DESC
            LIMIT 3
        `);
        if (ultimosUsuarios.length > 0) {
            console.log("👥 ÚLTIMOS USUÁRIOS:");
            ultimosUsuarios.forEach(u => {
                console.log(`   ID: ${u.id} | ${u.nome} (${u.login}) | Páginas: ${u.paginas_acesso || 'Nenhuma'} | ${u.data_criacao}`);
            });
        }

        // Últimos agendamentos
        const [ultimosAgendamentos] = await conn.execute(`
            SELECT id, nome, tipo, data, hora, status, created_at
            FROM agendamentos
            ORDER BY created_at DESC
            LIMIT 3
        `);
        if (ultimosAgendamentos.length > 0) {
            console.log("\n📅 ÚLTIMOS AGENDAMENTOS:");
            ultimosAgendamentos.forEach(a => {
                console.log(`   ID: ${a.id} | ${a.nome} | ${a.tipo} | ${a.data} ${a.hora} | ${a.status}`);
            });
        }

        // Últimas notificações
        const [ultimasNotificacoes] = await conn.execute(`
            SELECT id, titulo, tipo, lida, data_criacao
            FROM notificacoes
            ORDER BY data_criacao DESC
            LIMIT 3
        `);
        if (ultimasNotificacoes.length > 0) {
            console.log("\n🔔 ÚLTIMAS NOTIFICAÇÕES:");
            ultimasNotificacoes.forEach(n => {
                console.log(`   ID: ${n.id} | ${n.titulo} | ${n.tipo} | Lida: ${n.lida ? 'Sim' : 'Não'}`);
            });
        }

        conn.release();
        process.exit(0);
    } catch (err) {
        console.error("❌ Erro:", err.message);
        process.exit(1);
    }
}

verificarMudancasBanco();