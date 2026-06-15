import mysql from "mysql2/promise";

async function limparDadosTeste() {
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

        console.log("🧹 LIMPANDO DADOS DE TESTE...\n");

        // Contar antes da limpeza
        const [antesUsuarios] = await conn.execute(`SELECT COUNT(*) as total FROM usuarios`);
        const [antesAgendamentos] = await conn.execute(`SELECT COUNT(*) as total FROM agendamentos`);
        const [antesNotificacoes] = await conn.execute(`SELECT COUNT(*) as total FROM notificacoes`);

        console.log("📊 ANTES DA LIMPEZA:");
        console.log(`   Usuários: ${antesUsuarios[0].total}`);
        console.log(`   Agendamentos: ${antesAgendamentos[0].total}`);
        console.log(`   Notificações: ${antesNotificacoes[0].total}`);

        // Limpar dados de teste (manter apenas o usuário original)
        await conn.execute(`DELETE FROM usuarios WHERE login = 'teste123'`);
        console.log("✅ Usuário de teste removido");

        await conn.execute(`DELETE FROM agendamentos WHERE nome = 'Cliente Teste'`);
        console.log("✅ Agendamento de teste removido");

        await conn.execute(`DELETE FROM notificacoes WHERE titulo = 'Notificação Teste'`);
        console.log("✅ Notificação de teste removida");

        // Contar depois da limpeza
        const [depoisUsuarios] = await conn.execute(`SELECT COUNT(*) as total FROM usuarios`);
        const [depoisAgendamentos] = await conn.execute(`SELECT COUNT(*) as total FROM agendamentos`);
        const [depoisNotificacoes] = await conn.execute(`SELECT COUNT(*) as total FROM notificacoes`);

        console.log("\n📊 DEPOIS DA LIMPEZA:");
        console.log(`   Usuários: ${depoisUsuarios[0].total}`);
        console.log(`   Agendamentos: ${depoisAgendamentos[0].total}`);
        console.log(`   Notificações: ${depoisNotificacoes[0].total}`);

        console.log("\n✅ LIMPEZA CONCLUÍDA! Banco pronto para novos testes.");

        conn.release();
        process.exit(0);
    } catch (err) {
        console.error("❌ Erro:", err.message);
        process.exit(1);
    }
}

limparDadosTeste();