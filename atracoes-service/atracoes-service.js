const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = 8082;

var db = new sqlite3.Database('./dados.db', (err) => {
    if (err) {
        console.log('ERRO: não foi possível conectar ao SQLite.');
        throw err;
    }
    console.log('Conectado ao SQLite (Atracoes)!');
});

db.run(`CREATE TABLE IF NOT EXISTS atracoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            descricao TEXT,
            status TEXT NOT NULL CHECK(status IN ('OPERANDO', 'FECHADA', 'MANUTENCAO')),
            capacidade_minuto INTEGER NOT NULL 
        )`,
    [], (err) => {
        if (err) {
            console.log('ERRO: não foi possível criar tabela atracoes.');
            throw err;
        }
    });

app.post('/atracoes', (req, res, next) => {
    const { nome, descricao, status, capacidade_minuto } = req.body;

    if (!nome || !status || capacidade_minuto === undefined) {
        return res.status(400).send('Campos nome, status e capacidade_minuto são obrigatórios.');
    }

    if (typeof capacidade_minuto !== 'number' || capacidade_minuto <= 0) {
        return res.status(400).send('capacidade_minuto deve ser um número positivo.');
    }

    if (!['OPERANDO', 'FECHADA', 'MANUTENCAO'].includes(status)) {
        return res.status(400).send('Status inválido. Use OPERANDO, FECHADA ou MANUTENCAO.');
    }

    db.run(`INSERT INTO atracoes(nome, descricao, status, capacidade_minuto) VALUES(?,?,?,?)`,
        [nome, descricao, status, capacidade_minuto], function (err) {
            if (err) {
                if (err.errno === 19) {
                    return res.status(409).send('Atração com este nome já existe.');
                }
                console.log("Error: " + err.message);
                return res.status(500).send('Erro ao cadastrar atração.');
            } else {
                res.status(201).json({ message: 'Atração cadastrada com sucesso!', id: this.lastID });
            }
        });
});

app.get('/atracoes', (req, res, next) => {
    db.all(`SELECT * FROM atracoes`, [], (err, result) => {
        if (err) {
            console.log("Erro: " + err);
            res.status(500).send('Erro ao obter dados.');
        } else {
            res.status(200).json(result);
        }
    });
});

app.get('/atracoes/:id', (req, res, next) => {
    db.get(`SELECT * FROM atracoes WHERE id = ?`,
        req.params.id, (err, result) => {
            if (err) {
                console.log("Erro: " + err);
                res.status(500).send('Erro ao obter dados.');
            } else if (result == null) {
                console.log("Atração não encontrada.");
                res.status(404).send('Atração não encontrada.');
            } else {
                res.status(200).json(result);
            }
        });
});

app.patch('/atracoes/:id', (req, res, next) => {
    const { nome, descricao, status, capacidade_minuto } = req.body;

    if (status && !['OPERANDO', 'FECHADA', 'MANUTENCAO'].includes(status)) {
        return res.status(400).send('Status inválido. Use OPERANDO, FECHADA ou MANUTENCAO.');
    }

    if (capacidade_minuto !== undefined && (typeof capacidade_minuto !== 'number' || capacidade_minuto <= 0)) {
        return res.status(400).send('capacidade_minuto deve ser um número positivo.');
    }

    if (nome === undefined && descricao === undefined && status === undefined && capacidade_minuto === undefined) {
        return res.status(400).send('Nenhum campo válido (nome, descricao, status, capacidade_minuto) fornecido para atualização.');
    }

    db.run(`UPDATE atracoes SET 
                nome = COALESCE(?,nome), 
                descricao = COALESCE(?,descricao), 
                status = COALESCE(?,status), 
                capacidade_minuto = COALESCE(?,capacidade_minuto) 
            WHERE id = ?`,
        [nome, descricao, status, capacidade_minuto, req.params.id], function (err) {
            if (err) {
                if (err.errno === 19) {
                    return res.status(409).send('Atração com este nome já existe.');
                }
                res.status(500).send('Erro ao alterar dados.');
            } else if (this.changes == 0) {
                console.log("Atração não encontrada.");
                res.status(404).send('Atração não encontrada.');
            } else {
                res.status(200).send('Atração alterada com sucesso!');
            }
        });
});

app.delete('/atracoes/:id', (req, res, next) => {
    db.run(`DELETE FROM atracoes WHERE id = ?`, req.params.id, function (err) {
        if (err) {
            res.status(500).send('Erro ao remover atração.');
        } else if (this.changes == 0) {
            console.log("Atração não encontrada.");
            res.status(404).send('Atração não encontrada.');
        } else {
            res.status(200).send('Atração removida com sucesso!');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Serviço de atrações em execução na porta: ${PORT}`);
});