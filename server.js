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

// Rota para a raiz (/)
app.get('/', (req, res) => {
    console.log('Rota / acessada, servindo login.html');
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Rota index.html protegida
app.get('/index.html', (req, res, next) => {
    if (!req.cookies.auth || req.cookies.auth !== 'true') {
        console.log('Usuário não autenticado, redirecionando para login');
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota health
app.get('/health', (req, res) => {
    res.json({ status: 'Servidor está rodando' });
});

// Rota users
app.get('/users', async (req, res) => {
    try {
        console.log('Rota /users acessada');
        db = await ensureDBConnection();
        const users = await db.collection('registeredUsers').find().toArray();

        const usersData = await Promise.all(users.map(async (user) => {
            const paymentHistory = user.paymentHistory || [];
            const expirationDoc = await db.collection('expirationDates').findOne({ userId: user.userId });
            const balanceDoc = await db.collection('userBalances').findOne({ userId: user.userId });
            const bonusBalance = balanceDoc ? balanceDoc.balance : 0;

            return {
                userId: user.userId,
                name: user.name,
                whatsapp: user.whatsapp,
                registeredAt: user.registeredAt,
                paymentHistory: paymentHistory,
                balance: bonusBalance,
                expirationDate: expirationDoc ? expirationDoc.expirationDate : null,
                indication: user.indication || null
            };
        }));

        const totalBalanceFromHistory = users.reduce((sum, user) => {
            const paymentHistory = user.paymentHistory || [];
            return sum + paymentHistory.reduce((total, payment) => total + (parseFloat(payment.amount) || 0), 0);
        }, 0);

        res.json({
            users: usersData,
            totalBalanceFromHistory: totalBalanceFromHistory.toFixed(2)
        });
    } catch (err) {
        console.error('Erro na rota /users:', err.message);
        res.status(500).json({ error: 'Erro ao buscar usuários', details: err.message });
    }
});

// Rota user/:userId
app.get('/user/:userId', async (req, res) => {
    try {
        console.log(`Rota /user/${req.params.userId} acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();

        const user = await db.collection('registeredUsers').findOne({ userId }) || {};
        const paymentHistory = user.paymentHistory || [];
        const expirationDoc = await db.collection('expirationDates').findOne({ userId }) || { expirationDate: null };
        const balanceDoc = await db.collection('userBalances').findOne({ userId }) || { balance: 0 };

        res.json({
            userId: user.userId,
            name: user.name,
            whatsapp: user.whatsapp,
            paymentHistory: paymentHistory,
            balance: balanceDoc.balance,
            expirationDate: expirationDoc.expirationDate,
            indication: user.indication || null
        });
    } catch (err) {
        console.error('Erro na rota /user/:userId:', err.message);
        res.status(500).json({ error: 'Erro ao buscar dados', details: err.message });
    }
});

// Rota PUT (AQUI ESTAVA O PROBLEMA DE DATA)
app.put('/user/:userId', async (req, res) => {
    try {
        console.log(`[PUT] Rota /user/${req.params.userId} acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();
        const { name, balance, expirationDate, indication } = req.body;

        console.log(`[PUT] Dados recebidos para ${userId}:`, { name, balance, expirationDate });

        // 1. Atualização de Saldo
        if (balance !== undefined) {
            const newBalance = parseFloat(balance);
            if (!isNaN(newBalance) && newBalance >= 0) {
                await db.collection('userBalances').updateOne(
                    { userId },
                    { $set: { balance: newBalance } },
                    { upsert: true }
                );
            }
        }

        // 2. Atualização de Nome/Indicação
        const updateFields = {};
        if (name) updateFields.name = name;
        if (indication !== undefined) updateFields.indication = indication || null;
        
        if (Object.keys(updateFields).length > 0) {
            await db.collection('registeredUsers').updateOne(
                { userId },
                { $set: updateFields }
            );
        }

        // 3. ATUALIZAÇÃO DA DATA (CORREÇÃO DE FUSO - BRASIL UTC-3)
        if (expirationDate && typeof expirationDate === 'string' && expirationDate.trim() !== '') {
            try {
                // Input esperado do frontend: "YYYY-MM-DD"
                const parts = expirationDate.split('-'); 
                
                if (parts.length === 3) {
                    const year = parseInt(parts[0]);
                    const month = parseInt(parts[1]) - 1; // Mês 0-indexed
                    const day = parseInt(parts[2]);

                    // Queremos que expire no FINAL DO DIA no Brasil (23:59:59 BRT)
                    // BRT é UTC-3. Então 23:59 BRT = 02:59 do DIA SEGUINTE em UTC.
                    
                    // Criamos a data base UTC no dia selecionado
                    const dateObj = new Date(Date.UTC(year, month, day));
                    
                    // Adicionamos 1 dia + 2 horas + 59 min + 59 seg (Total: 26h 59m 59s a partir da 00:00 do dia)
                    // Isso garante que pule para o dia seguinte às 02:59 UTC
                    dateObj.setUTCDate(dateObj.getUTCDate() + 1);
                    dateObj.setUTCHours(2, 59, 59, 999);

                    const isoDate = dateObj.toISOString();
                    
                    console.log(`[DATA] Input: ${expirationDate} -> Salvo no Banco (UTC): ${isoDate}`);

                    await db.collection('expirationDates').updateOne(
                        { userId },
                        { $set: { expirationDate: isoDate } },
                        { upsert: true }
                    );
                }
            } catch (err) {
                console.error(`[ERRO CRÍTICO] Falha ao processar data: ${err.message}`);
            }
        }

        // Retorna dados atualizados
        const updatedUser = await db.collection('registeredUsers').findOne({ userId }) || {};
        const updatedExpiration = await db.collection('expirationDates').findOne({ userId }) || { expirationDate: null };
        const updatedBalance = await db.collection('userBalances').findOne({ userId }) || { balance: 0 };

        res.json({
            message: 'Dados atualizados com sucesso',
            updatedData: {
                userId,
                name: updatedUser.name,
                balance: updatedBalance.balance,
                expirationDate: updatedExpiration.expirationDate,
                indication: updatedUser.indication
            }
        });

    } catch (err) {
        console.error(`[ERRO GERAL] Rota PUT: ${err.message}`);
        res.status(500).json({ error: 'Erro interno ao atualizar dados' });
    }
});

// Rota POST user
app.post('/user', async (req, res) => {
    try {
        console.log(`Rota POST /user acessada`);
        db = await ensureDBConnection();
        const { userId, name, whatsapp, expirationDate } = req.body;

        if (!userId || !name || !whatsapp) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
        }

        const existingUser = await db.collection('registeredUsers').findOne({ userId });
        if (existingUser) {
            return res.status(409).json({ error: 'Usuário já existe.' });
        }

        await db.collection('registeredUsers').insertOne({
            userId, name, whatsapp, registeredAt: new Date(), paymentHistory: []
        });

        if (expirationDate) {
            // Aplica a mesma lógica de data da rota PUT
            const parts = expirationDate.split('-');
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1;
            const day = parseInt(parts[2]);
            
            const dateObj = new Date(Date.UTC(year, month, day));
            dateObj.setUTCDate(dateObj.getUTCDate() + 1);
            dateObj.setUTCHours(2, 59, 59, 999);

            await db.collection('expirationDates').insertOne({
                userId,
                expirationDate: dateObj.toISOString()
            });
        }

        res.status(201).json({ message: 'Usuário criado com sucesso!' });
    } catch (err) {
        console.error('Erro na rota POST /user:', err.message);
        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

// Rota DELETE all
app.delete('/user/:userId/all', async (req, res) => {
    try {
        console.log(`Rota DELETE /user/${req.params.userId}/all acessada`);
        db = await ensureDBConnection();
        const userId = req.params.userId.toString().trim();

        const expirationResult = await db.collection('expirationDates').deleteOne({ userId });
        const balanceResult = await db.collection('userBalances').deleteOne({ userId });
        const registeredResult = await db.collection('registeredUsers').deleteOne({ userId });
        const couponResult = await db.collection('couponUsage').deleteOne({ userId });

        const totalDeleted = expirationResult.deletedCount + balanceResult.deletedCount + registeredResult.deletedCount + couponResult.deletedCount;

        res.json({ message: 'Dados excluídos com sucesso', totalDeleted });
    } catch (err) {
        console.error('Erro na rota DELETE:', err.message);
        res.status(500).json({ error: 'Erro ao excluir dados' });
    }
});

// Rotas Auth
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === '123') {
        res.cookie('auth', 'true', { maxAge: 3600000, httpOnly: true });
        res.json({ success: true, message: 'Login bem-sucedido' });
    } else {
        res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
});

app.get('/check-auth', (req, res) => {
    res.json({ isAuthenticated: req.cookies.auth === 'true' });
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