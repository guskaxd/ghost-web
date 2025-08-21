const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
require('dotenv').config();
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 8080;

const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
    console.error('Erro: MONGO_URI não está definido no arquivo .env');
    process.exit(1);
}

const client = new MongoClient(mongoUri);

async function connectDB() {
    try {
        await client.connect();
        console.log('Conectado ao MongoDB com sucesso');
        const db = client.db('ghostdelay');
        console.log('Banco de dados selecionado:', db.databaseName);
        return db;
    } catch (err) {
        console.error('Erro ao conectar ao MongoDB:', err.message);
        process.exit(1);
    }
}

let db;

async function ensureDBConnection() {
    if (!db) {
        db = await connectDB();
    }
    return db;
}

// Configurar middleware
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    exposedHeaders: ['Set-Cookie']
}));
app.use(express.static(path.join(__dirname, '.')));
app.use(express.json());
app.use(cookieParser());

// Rota para a raiz (/) que serve o login.html como página inicial
app.get('/', (req, res) => {
    console.log('Rota / acessada, servindo login.html');
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Rota para servir index.html apenas para usuários autenticados
app.get('/index.html', (req, res, next) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true') {
        console.log('Usuário não autenticado, redirecionando para login');
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota de teste para verificar se o servidor está funcionando
app.get('/health', (req, res) => {
    console.log('Rota /health acessada');
    res.json({ status: 'Servidor está rodando' });
});

// Rota para buscar todos os usuários
app.get('/users', async (req, res) => {
    try {
        console.log('Rota /users acessada');
        db = await ensureDBConnection();
        const users = await db.collection('registeredUsers').find().toArray();
        console.log(`Encontrados ${users.length} usuários`);

        const usersData = await Promise.all(users.map(async (user) => {
            console.log(`Processando usuário: ${user.userId}`);
            const paymentHistory = user.paymentHistory || [];
            const expirationDoc = await db.collection('expirationDates').findOne({ userId: user.userId }) || { expirationDate: null };

            return {
                userId: user.userId,
                name: user.name,
                whatsapp: user.whatsapp,
                registeredAt: user.registeredAt,
                paymentHistory: paymentHistory,
                balance: 0,
                expirationDate: expirationDoc ? expirationDoc.expirationDate : null,
                indication: user.indication || null
            };
        }));

        const totalBalanceFromHistory = users.reduce((sum, user) => {
            const paymentHistory = user.paymentHistory || [];
            return sum + paymentHistory.reduce((total, payment) => total + (parseFloat(payment.amount) || 0), 0);
        }, 0);

        console.log('Enviando resposta com os dados dos usuários:', usersData);
        res.setHeader('Content-Type', 'application/json');
        res.json({
            users: usersData,
            totalBalanceFromHistory: totalBalanceFromHistory.toFixed(2)
        });
    } catch (err) {
        console.error('Erro na rota /users:', err.message);
        res.status(500).json({ error: 'Erro ao buscar usuários', details: err.message });
    }
});

// Rota para buscar dados de um único usuário
app.get('/user/:userId', async (req, res) => {
    try {
        console.log(`Rota /user/${req.params.userId} acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();

        const user = await db.collection('registeredUsers').findOne({ userId }) || {};
        const paymentHistory = user.paymentHistory || [];
        const expirationDoc = await db.collection('expirationDates').findOne({ userId }) || { expirationDate: null };

        res.setHeader('Content-Type', 'application/json');
        res.json({
            userId: user.userId,
            name: user.name,
            whatsapp: user.whatsapp,
            paymentHistory: paymentHistory,
            balance: 0,
            expirationDate: expirationDoc.expirationDate,
            indication: user.indication || null
        });
    } catch (err) {
        console.error('Erro na rota /user/:userId:', err.message);
        res.status(500).json({ error: 'Erro ao buscar dados', details: err.message });
    }
});

// Rota para atualizar dados do usuário
app.put('/user/:userId', async (req, res) => {
    try {
        console.log(`Rota PUT /user/${req.params.userId} acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();
        const { name, balance, expirationDate, indication } = req.body;

        console.log('Dados recebidos:', { name, balance, expirationDate, indication });

        if (balance !== undefined && (isNaN(parseFloat(balance)) || parseFloat(balance) < 0)) {
            console.warn('Validação falhou: Saldo deve ser um número positivo');
            return res.status(400).json({ error: 'Saldo deve ser um número positivo' });
        }

        let parsedExpirationDate = null;
        if (expirationDate !== undefined && expirationDate !== null) {
            try {
                parsedExpirationDate = new Date(expirationDate);
                if (isNaN(parsedExpirationDate.getTime())) {
                    console.warn('Validação falhou: Data de expiração inválida', { expirationDate });
                    return res.status(400).json({ error: 'Data de expiração inválida' });
                }
            } catch (err) {
                console.warn('Erro ao parsear expirationDate:', err.message, { expirationDate });
                return res.status(400).json({ error: 'Formato de data inválido' });
            }
        }

        if (name) {
            console.log(`Atualizando nome do usuário ${userId} para ${name}`);
            const result = await db.collection('registeredUsers').updateOne(
                { userId },
                { $set: { name, indication: indication || null } },
                { upsert: true }
            );
            console.log('Resultado da atualização de nome e indicação:', result);
        }

        if (balance !== undefined) {
            console.warn('Atualização de saldo ignorada, mantendo saldo zerado');
        }

        if (expirationDate !== undefined) {
            console.log(`Atualizando data de expiração do usuário ${userId} para ${expirationDate}`);
            if (expirationDate === null) {
                const result = await db.collection('expirationDates').deleteOne({ userId });
                console.log('Resultado da exclusão de data de expiração:', result);
            } else {
                const result = await db.collection('expirationDates').updateOne(
                    { userId },
                    { $set: { expirationDate: parsedExpirationDate.toISOString() } },
                    { upsert: true }
                );
                console.log('Resultado da atualização de data de expiração:', result);
            }
        }

        const updatedUser = await db.collection('registeredUsers').findOne({ userId }) || {};
        const updatedExpiration = await db.collection('expirationDates').findOne({ userId }) || { expirationDate: null };
        res.setHeader('Content-Type', 'application/json');
        res.json({
            message: 'Dados atualizados com sucesso',
            updatedData: {
                userId,
                name: updatedUser.name,
                paymentHistory: updatedUser.paymentHistory || [],
                balance: 0,
                expirationDate: updatedExpiration.expirationDate,
                indication: updatedUser.indication || null
            }
        });
    } catch (err) {
        console.error('Erro na rota PUT /user/:userId:', err.message, err.stack);
        res.status(500).json({ error: 'Erro ao atualizar dados', details: err.message });
    }
});

// Rota para deletar/cancelar assinatura de um usuário
app.delete('/user/:userId', async (req, res) => {
    try {
        console.log(`Rota DELETE /user/${req.params.userId} acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();

        if (!userId) {
            console.error('Erro: userId inválido ou vazio');
            return res.status(400).json({ error: 'ID do usuário inválido ou vazio' });
        }

        // Verificar se o usuário existe em registeredUsers
        const userDoc = await db.collection('registeredUsers').findOne({ userId });
        if (!userDoc) {
            console.warn(`Usuário com userId ${userId} não encontrado em registeredUsers`);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log(`Cancelando assinatura do usuário ${userId}`);

        // Deletar apenas o documento de expirationDates
        const result = await db.collection('expirationDates').deleteOne({ userId });
        console.log('Resultado da exclusão de expirationDates:', { deletedCount: result.deletedCount });

        if (result.deletedCount === 0) {
            console.warn(`Nenhum documento encontrado para userId ${userId} em expirationDates`);
            return res.status(404).json({ message: 'Nenhuma assinatura encontrada para cancelar' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.json({ message: 'Assinatura cancelada com sucesso', deletedCount: result.deletedCount });
    } catch (err) {
        console.error('Erro na rota DELETE /user/:userId:', err.message, err.stack);
        res.status(500).json({ error: 'Erro ao cancelar assinatura', details: err.message });
    }
});

// Rota para deletar todos os dados de um usuário
app.delete('/user/:userId/all', async (req, res) => {
    try {
        console.log(`Rota DELETE /user/${req.params.userId}/all acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();

        if (!userId) {
            console.error('Erro: userId inválido ou vazio');
            return res.status(400).json({ error: 'ID do usuário inválido ou vazio' });
        }

        // Verificar se o usuário existe em registeredUsers
        const userDoc = await db.collection('registeredUsers').findOne({ userId });
        if (!userDoc) {
            console.warn(`Usuário com userId ${userId} não encontrado em registeredUsers`);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        console.log(`Excluindo todos os dados do usuário ${userId}`);

        // Deletar documentos de todas as coleções relevantes
        const expirationResult = await db.collection('expirationDates').deleteOne({ userId });
        const balanceResult = await db.collection('userBalances').deleteOne({ userId });
        const registeredResult = await db.collection('registeredUsers').deleteOne({ userId });
        const couponResult = await db.collection('couponUsage').deleteOne({ userId });

        console.log('Resultado da exclusão de expirationDates:', { deletedCount: expirationResult.deletedCount });
        console.log('Resultado da exclusão de userBalances:', { deletedCount: balanceResult.deletedCount });
        console.log('Resultado da exclusão de registeredUsers:', { deletedCount: registeredResult.deletedCount });
        console.log('Resultado da exclusão de couponUsage:', { deletedCount: couponResult.deletedCount });

        const totalDeleted = expirationResult.deletedCount + balanceResult.deletedCount + registeredResult.deletedCount + couponResult.deletedCount;

        if (totalDeleted === 0) {
            console.warn(`Nenhum dado excluído para userId ${userId}`);
            return res.status(404).json({ message: 'Nenhum dado encontrado para excluir' });
        }

        res.setHeader('Content-Type', 'application/json');
        res.json({ message: 'Todos os dados do usuário foram excluídos com sucesso', totalDeleted });
    } catch (err) {
        console.error('Erro na rota DELETE /user/:userId/all:', err.message, err.stack);
        res.status(500).json({ error: 'Erro ao excluir todos os dados', details: err.message });
    }
});

// Rota para login
app.post('/login', (req, res) => {
    console.log('Rota /login acessada');
    const { username, password } = req.body;

    if (username === 'admin' && password === '123') {
        res.cookie('auth', 'true', { maxAge: 3600000, httpOnly: true });
        console.log('Login bem-sucedido, cookie definido');
        res.json({ success: true, message: 'Login bem-sucedido' });
    } else {
        console.log('Credenciais inválidas');
        res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
});

// Rota para verificar autenticação
app.get('/check-auth', (req, res) => {
    console.log('Rota /check-auth acessada');
    const isAuthenticated = req.cookies.auth === 'true';
    res.json({ isAuthenticated });
});

// Rota para logout
app.post('/logout', (req, res) => {
    console.log('Rota /logout acessada');
    res.clearCookie('auth');
    res.json({ success: true, message: 'Logout bem-sucedido' });
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});