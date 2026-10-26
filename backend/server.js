
require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const conexao = require('./database');
const session = require('express-session');

const app = express();
const PORTA = 3000;

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60
    }
}));

app.use(cors({
    origin: 'http://127.0.0.1:5500',
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/teste-banco', async (req, res) => {
    try {
        const [resultado] = await conexao.query(
            'SELECT DATABASE() AS banco'
        );

        res.json({
            mensagem: 'Conexão com o banco funcionando!',
            banco: resultado[0].banco
        });
    } catch (erro) {
        console.error('Erro ao consultar o banco:', erro.message);

        res.status(500).json({
            mensagem: 'Não foi possível consultar o banco de dados.'
        });
    }
});

app.post('/cadastro', async (req, res) => {
    try {
        const { nome, idade, email, senha } = req.body;

        if (!nome || !idade || !email || !senha) {
            return res.status(400).json({
                mensagem: 'Preencha todos os campos.'
            });
        }

        const idadeNumero = Number(idade);

        if (!Number.isInteger(idadeNumero) || idadeNumero < 1 || idadeNumero > 120) {
            return res.status(400).json({
                mensagem: 'Informe uma idade válida.'
            });
        }

        if (senha.length < 8) {
            return res.status(400).json({
                mensagem: 'A senha deve ter pelo menos 8 caracteres.'
            });
        }

        const nomeUsuario = nome
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '')
            .slice(0, 50);

        if (!nomeUsuario) {
            return res.status(400).json({
                mensagem: 'Não foi possível gerar seu nome de usuário.'
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        await conexao.execute(
            `INSERT INTO usuarios
            (nome, idade, nome_usuario, email, senha_hash)
            VALUES (?, ?, ?, ?, ?)`,
            [nome.trim(), idadeNumero, nomeUsuario, email.trim().toLowerCase(), senhaHash]
        );

        return res.status(201).json({
            mensagem: 'Cadastro realizado com sucesso!'
        });

    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                mensagem: 'Este e-mail ou nome de usuário já está cadastrado.'
            });
        }

        console.error('Erro no cadastro:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao realizar o cadastro.'
        });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                mensagem: 'Informe o e-mail e a senha.'
            });
        }

        const [usuarios] = await conexao.execute(
            'SELECT id_usuario, nome, nome_usuario, email, senha_hash FROM usuarios WHERE email = ?',
            [email.trim().toLowerCase()]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({
                mensagem: 'E-mail ou senha incorretos.'
            });
        }

        const usuario = usuarios[0];
        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.senha_hash
        );

        if (!senhaCorreta) {
            return res.status(401).json({
                mensagem: 'E-mail ou senha incorretos.'
            });
        }

        req.session.usuario = {
            id: usuario.id_usuario,
            nome: usuario.nome,
            nomeUsuario: usuario.nome_usuario,
            email: usuario.email
        };

        return res.json({
            mensagem: 'Login realizado com sucesso!'
        });

    } catch (erro) {
        console.error('Erro no login:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao realizar o login.'
        });
    }
});

app.get('/sessao', (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({
            autenticado: false
        });
    }

    return res.json({
        autenticado: true,
        usuario: req.session.usuario
    });
});



app.get('/meu-perfil', async (req, res) => {
    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const idUsuario = req.session.usuario.id;

        const [usuarios] = await conexao.execute(
            `SELECT nome, nome_usuario, biografia, nivel_atividade,
                    perfil_privado
             FROM usuarios
             WHERE id_usuario = ?`,
            [idUsuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                mensagem: 'Usuário não encontrado.'
            });
        }

        const [atividades] = await conexao.execute(
            `SELECT atividade
             FROM usuario_atividades
             WHERE id_usuario = ?`,
            [idUsuario]
        );

        return res.json({
            ...usuarios[0],
            atividades: atividades.map(item => item.atividade)
        });

    } catch (erro) {
        console.error('Erro ao buscar perfil:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao carregar o perfil.'
        });
    }
});



app.post('/logout', (req, res) => {
    req.session.destroy((erro) => {
        if (erro) {
            console.error('Erro ao encerrar sessão:', erro.message);

            return res.status(500).json({
                mensagem: 'Não foi possível sair da conta.'
            });
        }

        res.clearCookie('connect.sid');

        return res.json({
            mensagem: 'Você saiu da sua conta.'
        });
    });
});



app.put('/meu-perfil', async (req, res) => {
    let conexaoAtual;

    try {
        if (!req.session.usuario) {
            return res.status(401).json({
                mensagem: 'Você precisa fazer login.'
            });
        }

        const {
            nome,
            nome_usuario,
            biografia,
            atividades,
            outra_atividade,
            nivel_atividade,
            perfil_privado
        } = req.body;

        // Verifica nome e nome de usuário
        if (
            typeof nome !== 'string' ||
            !nome.trim() ||
            typeof nome_usuario !== 'string' ||
            !nome_usuario.trim()
        ) {
            return res.status(400).json({
                mensagem: 'Nome e nome de usuário são obrigatórios.'
            });
        }

        const nomeFinal = nome.trim();
        const usuarioFinal = nome_usuario.trim().replace(/^@/, '');
        const bioFinal = typeof biografia === 'string'
            ? biografia.trim()
            : '';

        if (nomeFinal.length > 100 || usuarioFinal.length > 50) {
            return res.status(400).json({
                mensagem: 'O nome ou nome de usuário é muito longo.'
            });
        }

        if (bioFinal.length > 500) {
            return res.status(400).json({
                mensagem: 'A biografia deve ter no máximo 500 caracteres.'
            });
        }

        if (!/^[a-zA-Z0-9_.]+$/.test(usuarioFinal)) {
            return res.status(400).json({
                mensagem: 'O nome de usuário só pode conter letras, números, ponto e underline.'
            });
        }

        // Lista dos níveis permitidos
        const niveisValidos = [
            'iniciante',
            'intermediario',
            'avancado'
        ];

        if (!niveisValidos.includes(nivel_atividade)) {
            return res.status(400).json({
                mensagem: 'Selecione um nível de atividade válido.'
            });
        }

        // Verifica a privacidade
        if (![0, 1, false, true].includes(perfil_privado)) {
            return res.status(400).json({
                mensagem: 'Selecione uma opção de privacidade válida.'
            });
        }

        // Lista das atividades fixas permitidas
        const atividadesValidas = [
            'corrida',
            'caminhada',
            'ciclismo',
            'academia',
            'outros'
        ];

        if (
            !Array.isArray(atividades) ||
            !atividades.every(
                atividade => atividadesValidas.includes(atividade)
            )
        ) {
            return res.status(400).json({
                mensagem: 'Confira as atividades selecionadas.'
            });
        }

        // Verifica a atividade personalizada
        const outraAtividade = typeof outra_atividade === 'string'
            ? outra_atividade.trim()
            : '';

        if (outraAtividade.length > 50) {
            return res.status(400).json({
                mensagem: 'A atividade personalizada deve ter no máximo 50 caracteres.'
            });
        }

        if (outraAtividade && !atividades.includes('outros')) {
            return res.status(400).json({
                mensagem: 'Marque "Outros" para informar outra atividade.'
            });
        }

        // Obtém uma conexão e inicia a transação
        conexaoAtual = await conexao.getConnection();
        await conexaoAtual.beginTransaction();

        // Atualiza os dados do usuário
        await conexaoAtual.execute(
            `UPDATE usuarios
             SET nome = ?, nome_usuario = ?, biografia = ?,
                 nivel_atividade = ?, perfil_privado = ?
             WHERE id_usuario = ?`,
            [
                nomeFinal,
                usuarioFinal,
                bioFinal || null,
                nivel_atividade,
                Number(perfil_privado),
                req.session.usuario.id
            ]
        );

        // Remove as atividades antigas para salvar as atuais
        await conexaoAtual.execute(
            `DELETE FROM usuario_atividades
             WHERE id_usuario = ?`,
            [req.session.usuario.id]
        );

        const atividadesParaSalvar = [...new Set(atividades)];

        // Adiciona o texto personalizado, se foi preenchido
        if (atividadesParaSalvar.includes('outros') && outraAtividade) {
            atividadesParaSalvar.push(outraAtividade);
        }

        // Salva as atividades selecionadas
        for (const atividade of atividadesParaSalvar) {
            await conexaoAtual.execute(
                `INSERT INTO usuario_atividades
                 (id_usuario, atividade)
                 VALUES (?, ?)`,
                [req.session.usuario.id, atividade]
            );
        }

        await conexaoAtual.commit();

        // Atualiza os dados da sessão
        req.session.usuario.nome = nomeFinal;
        req.session.usuario.nomeUsuario = usuarioFinal;

        return res.json({
            mensagem: 'Perfil atualizado com sucesso!'
        });

    } catch (erro) {
        if (conexaoAtual) {
            await conexaoAtual.rollback();
        }

        if (erro.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                mensagem: 'Esse nome de usuário já está em uso.'
            });
        }

        console.error('Erro ao atualizar perfil:', erro.message);

        return res.status(500).json({
            mensagem: 'Erro ao atualizar o perfil.'
        });

    } finally {
        if (conexaoAtual) {
            conexaoAtual.release();
        }
    }
});



app.listen(PORTA, () => {
    console.log(`Servidor iniciado em http://localhost:${PORTA}`);
});
