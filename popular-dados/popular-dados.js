const axios = require('axios');

const apiClient = axios.create({
    baseURL: 'http://localhost:8000',
});

const usuariosParaCriar = [
    { nome: 'Ana Silva', email: 'ana.silva@email.com', telefone: '48999990001' },
    { nome: 'Bruno Costa', email: 'bruno.costa@email.com', telefone: '48999990002' },
    { nome: 'Carla Dias', email: 'carla.dias@email.com', telefone: '48999990003' }
];

const atracoesParaCriar = [
    { nome: 'Montanha Russa Solar', descricao: 'Rápida e emocionante.', status: 'OPERANDO', capacidade_minuto: 10 },
    { nome: 'Roda Gigante Crepúsculo', descricao: 'Vista panorâmica.', status: 'OPERANDO', capacidade_minuto: 15 },
    { nome: 'Carrossel Encantado', descricao: 'Para toda a família.', status: 'MANUTENCAO', capacidade_minuto: 20 },
    { nome: 'Barco Viking', descricao: 'Sinta a gravidade zero.', status: 'OPERANDO', capacidade_minuto: 8 }
];

const ingressosParaCriar = [
    { email_usuario: 'ana.silva@email.com', tipo: 'DIARIO' },
    { email_usuario: 'bruno.costa@email.com', tipo: 'ANUAL' },
    { email_usuario: 'carla.dias@email.com', tipo: 'PREDETERMINADO', acessos: 5 }
];

async function adicionarNaFila(atracao_id, quantidade) {
    if (!atracao_id) {
        return;
    }
    for (let i = 0; i < quantidade; i++) {
        try {
            await apiClient.post('/filas/entrar', { atracao_id: atracao_id });
        } catch (error) {
            break; 
        }
    }
}

async function popularDados() {
    const atracoesCriadas = []; 

    for (const user of usuariosParaCriar) {
        try {
            await apiClient.post('/usuarios', user);
        } catch (error) {
            // Ignora erros
        }
    }

    for (const atracao of atracoesParaCriar) {
        try {
            const res = await apiClient.post('/atracoes', atracao);
            const idCriado = res.data.id;
            atracoesCriadas.push({ ...atracao, id: idCriado }); 
        } catch (error) {
            // Ignora erros
        }
    }

    for (const ingresso of ingressosParaCriar) {
        try {
            await apiClient.post('/ingressos', ingresso);
        } catch (error) {
            // Ignora erros
        }
    }

    const montanha = atracoesCriadas.find(a => a.nome.includes('Montanha'));
    const rodaGigante = atracoesCriadas.find(a => a.nome.includes('Roda Gigante'));
    const barco = atracoesCriadas.find(a => a.nome.includes('Barco'));

    if (montanha) await adicionarNaFila(montanha.id, 25);
    if (rodaGigante) await adicionarNaFila(rodaGigante.id, 30);
    if (barco) await adicionarNaFila(barco.id, 12);
    
    const atracoesOperando = atracoesCriadas.filter(a => a.status === 'OPERANDO');

    for (const atracao of atracoesOperando) {
        try {
            await apiClient.get(`/estimativa/${atracao.id}`);
        } catch (error) {
            // Ignora erros
        }
    }
}

popularDados();