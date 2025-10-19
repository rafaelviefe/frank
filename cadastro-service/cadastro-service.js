const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sqlite3 = require('sqlite3');

var db = new sqlite3.Database('./dados.db', (err) => {
    if (err) {
        console.log('ERRO: não foi possível conectar ao SQLite.');
        throw err;
    }
    console.log('Conectado ao SQLite!');
});

db.run(`CREATE TABLE IF NOT EXISTS usuarios 
        (nome TEXT NOT NULL, 
         email TEXT PRIMARY KEY NOT NULL UNIQUE, 
         telefone TEXT NOT NULL)`,
    [], (err) => {
        if (err) {
            console.log('ERRO: não foi possível criar tabela usuarios.');
            throw err;
        }
    });

app.post('/usuarios', (req, res, next) => {
    const { nome, email, telefone } = req.body;

    if (!nome || !email || !telefone) {
        return res.status(400).send('Campos nome, email e telefone são obrigatórios.');
    }

    db.run(`INSERT INTO usuarios(nome, email, telefone) VALUES(?,?,?)`,
        [nome, email, telefone], function (err) {
            if (err) {
                if (err.errno === 19 /* SQLITE_CONSTRAINT */) {
                    return res.status(409).send('Email já cadastrado.');
                }
                console.log("Error: " + err.message);
                return res.status(500).send('Erro ao cadastrar usuário.');
            } else {
                console.log('Usuário cadastrado com sucesso!');
                res.status(201).json({ message: 'Usuário cadastrado com sucesso!', email: email });
            }
        });
});

app.get('/usuarios', (req, res, next) => {
    db.all(`SELECT * FROM usuarios`, [], (err, result) => {
        if (err) {
            console.log("Erro: " + err);
            res.status(500).send('Erro ao obter dados.');
        } else {
            res.status(200).json(result);
        }
    });
});

app.get('/usuarios/:email', (req, res, next) => {
    db.get(`SELECT * FROM usuarios WHERE email = ?`,
        req.params.email, (err, result) => {
            if (err) {
                console.log("Erro: " + err);
                res.status(500).send('Erro ao obter dados.');
            } else if (result == null) {
                console.log("Usuário não encontrado.");
                res.status(404).send('Usuário não encontrado.');
            } else {
                res.status(200).json(result);
            }
        });
});

app.patch('/usuarios/:email', (req, res, next) => {
    const { nome, telefone } = req.body;

    if (nome === undefined && telefone === undefined) {
        return res.status(400).send('Nenhum campo válido (nome, telefone) fornecido para atualização.');
    }

    db.run(`UPDATE usuarios SET nome = COALESCE(?,nome), telefone = COALESCE(?,telefone) WHERE email = ?`,
        [nome, telefone, req.params.email], function (err) {
            if (err) {
                res.status(500).send('Erro ao alterar dados.');
            } else if (this.changes == 0) {
                console.log("Usuário não encontrado.");
                res.status(404).send('Usuário não encontrado.');
            } else {
                res.status(200).send('Usuário alterado com sucesso!');
            }
        });
});

let porta = 8080;
app.listen(porta, () => {
    console.log('Serviço de cadastro em execução na porta: ' + porta);
});