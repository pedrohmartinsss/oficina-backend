import mysql from "mysql2/promise";

async function testarCriacaoRegistros() {
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

        console.log("🧪 TESTE DE CRIAÇÃO DE REGISTROS VIA API\n");

        // Contar registros antes
        const [antesUsuarios] = await conn.execute(`SELECT COUNT(*) as total FROM usuarios`);
        const [antesAgendamentos] = await conn.execute(`SELECT COUNT(*) as total FROM agendamentos`);
        const [antesNotificacoes] = await conn.execute(`SELECT COUNT(*) as total FROM notificacoes`);

        console.log("📊 ANTES DA CRIAÇÃO:");
        console.log(`   Usuários: ${antesUsuarios[0].total}`);
        console.log(`   Agendamentos: ${antesAgendamentos[0].total}`);
        console.log(`   Notificações: ${antesNotificacoes[0].total}`);

        // Simular criação via API (INSERT direto para teste)
        console.log("\n🔧 CRIANDO REGISTROS DE TESTE...");

        // Criar usuário de teste
        await conn.execute(`
            INSERT INTO usuarios (nome, login, senha, acesso, ativo, data_criacao)
            VALUES ('Usuário Teste', 'teste123', 'senha123', 'usuario', 1, NOW())
        `);
        console.log("✅ Usuário criado: 'Usuário Teste'");

        // Criar agendamento de teste
        await conn.execute(`
            INSERT INTO agendamentos (nome, telefone, tipo, data, hora, observacoes, status, created_at, updated_at)
            VALUES ('Cliente Teste', '11999999999', 'Manutenção', '2026-05-10', '14:00:00', 'Agendamento de teste', 'Pendente', NOW(), NOW())
        `);
        console.log("✅ Agendamento criado: 'Cliente Teste'");

        // Criar notificação de teste
        await conn.execute(`
            INSERT INTO notificacoes (titulo, mensagem, tipo, lida, usuario_id, data_criacao)
            VALUES ('Notificação Teste', 'Esta é uma notificação de teste', 'info', 0, 1, NOW())
        `);
        console.log("✅ Notificação criada: 'Notificação Teste'");

        // Contar registros depois
        const [depoisUsuarios] = await conn.execute(`SELECT COUNT(*) as total FROM usuarios`);
        const [depoisAgendamentos] = await conn.execute(`SELECT COUNT(*) as total FROM agendamentos`);
        const [depoisNotificacoes] = await conn.execute(`SELECT COUNT(*) as total FROM notificacoes`);

        console.log("\n📊 DEPOIS DA CRIAÇÃO:");
        console.log(`   Usuários: ${depoisUsuarios[0].total} (+${depoisUsuarios[0].total - antesUsuarios[0].total})`);
        console.log(`   Agendamentos: ${depoisAgendamentos[0].total} (+${depoisAgendamentos[0].total - antesAgendamentos[0].total})`);
        console.log(`   Notificações: ${depoisNotificacoes[0].total} (+${depoisNotificacoes[0].total - antesNotificacoes[0].total})`);

        // Mostrar os registros criados
        console.log("\n📋 REGISTROS CRIADOS:");

        const [novoUsuario] = await conn.execute(`
            SELECT id, nome, login, acesso FROM usuarios WHERE login = 'teste123'
        `);
        if (novoUsuario.length > 0) {
            console.log(`👥 Usuário: ID ${novoUsuario[0].id} - ${novoUsuario[0].nome} (${novoUsuario[0].login})`);
        }

        const [novoAgendamento] = await conn.execute(`
            SELECT id, nome, tipo, data, hora FROM agendamentos WHERE nome = 'Cliente Teste'
        `);
        if (novoAgendamento.length > 0) {
            console.log(`📅 Agendamento: ID ${novoAgendamento[0].id} - ${novoAgendamento[0].nome} (${novoAgendamento[0].tipo})`);
        }

        const [novaNotificacao] = await conn.execute(`
            SELECT id, titulo, tipo FROM notificacoes WHERE titulo = 'Notificação Teste'
        `);
        if (novaNotificacao.length > 0) {
            console.log(`🔔 Notificação: ID ${novaNotificacao[0].id} - ${novaNotificacao[0].titulo} (${novaNotificacao[0].tipo})`);
        }

        console.log("\n✅ TESTE CONCLUÍDO! Os registros foram criados nas tabelas corretas.");

        conn.release();
        process.exit(0);
    } catch (err) {
        console.error("❌ Erro:", err.message);
        process.exit(1);
    }
}

testarCriacaoRegistros();