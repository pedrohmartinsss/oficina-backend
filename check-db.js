import mysql from "mysql2/promise";

async function checkDatabase() {
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

        // Check tables
        const [tables] = await conn.execute(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = 'orcamento'
        `);

        console.log("\n📋 Tabelas existentes:");
        tables.forEach(t => console.log(`  - ${t.TABLE_NAME}`));

        // Check clientes table structure
        const [clientesSchema] = await conn.execute(`DESCRIBE clientes`);
        console.log("\n👤 Estrutura da tabela clientes:");
        clientesSchema.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));

        // Check clientes data
        const [clientesData] = await conn.execute(`SELECT * FROM clientes LIMIT 5`);
        console.log("\n👤 Dados da tabela clientes:");
        if (clientesData.length === 0) {
            console.log("  - Nenhum cliente cadastrado");
        } else {
            clientesData.forEach(cliente => console.log(`  - ID: ${cliente.id}, Nome: ${cliente.nome}, Telefone: ${cliente.telefone}, Email: ${cliente.email}`));
        }

        // Check ordens_servico table structure
        const [osSchema] = await conn.execute(`DESCRIBE ordens_servico`);
        console.log("\n📋 Estrutura da tabela ordens_servico:");
        osSchema.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));

        // Check ordens_servico data
        const [osData] = await conn.execute(`SELECT * FROM ordens_servico LIMIT 5`);
        console.log("\n📋 Dados da tabela ordens_servico:");
        if (osData.length === 0) {
            console.log("  - Nenhuma ordem de serviço cadastrada");
        } else {
            osData.forEach(os => console.log(`  - ID: ${os.id}, Número: ${os.numero_os}, Cliente: ${os.cliente_id}, Status: ${os.status}, Total: R$ ${os.total}`));
        }

        // Check itens_ordem_servico table structure
        const [itensSchema] = await conn.execute(`DESCRIBE itens_ordem_servico`);
        console.log("\n📦 Estrutura da tabela itens_ordem_servico:");
        itensSchema.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));

        // Check itens_ordem_servico data
        const [itensData] = await conn.execute(`SELECT * FROM itens_ordem_servico LIMIT 5`);
        console.log("\n📦 Dados da tabela itens_ordem_servico:");
        if (itensData.length === 0) {
            console.log("  - Nenhum item de ordem de serviço cadastrado");
        } else {
            itensData.forEach(item => console.log(`  - ID: ${item.id}, OS: ${item.ordem_servico_id}, Descrição: ${item.descricao}, Qtd: ${item.quantidade}, Valor: R$ ${item.valor_unitario}`));
        }

        // Check usuarios table
        const [usuariosSchema] = await conn.execute(`DESCRIBE usuarios`);
        console.log("\n👥 Estrutura da tabela usuarios:");
        usuariosSchema.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));

        const [usuariosData] = await conn.execute(`SELECT id, nome, login, ativo, data_criacao, paginas_acesso FROM usuarios LIMIT 5`);
        console.log("\n👥 Dados da tabela usuarios:");
        if (usuariosData.length === 0) {
            console.log("  - Nenhum usuário cadastrado");
        } else {
            usuariosData.forEach(user => console.log(`  - ID: ${user.id}, Nome: ${user.nome}, Login: ${user.login}, Páginas: ${user.paginas_acesso || 'Nenhuma'}, Ativo: ${user.ativo}`));
        }

        // Check agendamentos table
        const [agendaSchema] = await conn.execute(`DESCRIBE agendamentos`);
        console.log("\n📅 Estrutura da tabela agendamentos:");
        agendaSchema.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));

        const [agendaData] = await conn.execute(`SELECT * FROM agendamentos LIMIT 5`);
        console.log("\n📅 Dados da tabela agendamentos:");
        if (agendaData.length === 0) {
            console.log("  - Nenhum agendamento cadastrado");
        } else {
            agendaData.forEach(ag => console.log(`  - ID: ${ag.id}, Cliente: ${ag.cliente}, Data: ${ag.data}, Hora: ${ag.hora}, Status: ${ag.status}`));
        }

        // Check notificacoes table
        const [notifSchema] = await conn.execute(`DESCRIBE notificacoes`);
        console.log("\n🔔 Estrutura da tabela notificacoes:");
        notifSchema.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));

        const [notifData] = await conn.execute(`SELECT * FROM notificacoes LIMIT 5`);
        console.log("\n🔔 Dados da tabela notificacoes:");
        if (notifData.length === 0) {
            console.log("  - Nenhuma notificação cadastrada");
        } else {
            notifData.forEach(notif => console.log(`  - ID: ${notif.id}, Título: ${notif.titulo}, Mensagem: ${notif.mensagem}, Lida: ${notif.lida}`));
        }

        conn.release();
        process.exit(0);
    } catch (err) {
        console.error("❌ Erro:", err.message);
        process.exit(1);
    }
}

checkDatabase();
