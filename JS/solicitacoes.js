
const API = window.location.origin;

const listaSolicitacoes = document.getElementById('lista-solicitacoes');

// Carrega as solicitações recebidas
async function carregarSolicitacoes() {
    listaSolicitacoes.innerHTML = `
        <p class="mensagem-solicitacoes">
            Carregando solicitações...
        </p>
    `;

    try {
        const resposta = await fetch(`${API}/solicitacoes-seguir`, {
            method: 'GET',
            credentials: 'include'
        });

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar as solicitações.');
        }

        const solicitacoes = await resposta.json();

        if (solicitacoes.length === 0) {
            listaSolicitacoes.innerHTML = `
                <p class="mensagem-solicitacoes">
                    Você não tem solicitações pendentes no momento.
                </p>
            `;
            return;
        }

        listaSolicitacoes.innerHTML = '';

        solicitacoes.forEach(solicitacao => {
            const item = document.createElement('article');
            item.className = 'item-solicitacao';

            const foto = document.createElement('img');
            foto.className = 'foto-solicitacao';
            foto.alt = 'Foto de perfil';

            if (solicitacao.foto) {
                foto.src = `${API}/${solicitacao.foto.replace(/^\/+/, '')}`;
            } else {
                foto.src = 'imagens/Perfil.png';
            }

            foto.onerror = () => {
                foto.onerror = null;
                foto.src = 'imagens/Perfil.png';
            };

            const informacoes = document.createElement('div');
            informacoes.className = 'informacoes-solicitacao';

            const nome = document.createElement('h3');
            nome.textContent = solicitacao.nome;

            const usuario = document.createElement('p');
            usuario.textContent = `@${solicitacao.nome_usuario}`;

            informacoes.appendChild(nome);
            informacoes.appendChild(usuario);

            const acoes = document.createElement('div');
            acoes.className = 'acoes-solicitacao';

            const botaoAceitar = document.createElement('button');
            botaoAceitar.type = 'button';
            botaoAceitar.className = 'botao-aceitar-solicitacao';
            botaoAceitar.textContent = 'Aceitar';

            const botaoRecusar = document.createElement('button');
            botaoRecusar.type = 'button';
            botaoRecusar.className = 'botao-recusar-solicitacao';
            botaoRecusar.textContent = 'Recusar';

            botaoAceitar.addEventListener('click', () => {
                processarSolicitacao(
                    solicitacao.id_seguir,
                    'aceitar',
                    item,
                    botaoAceitar,
                    botaoRecusar
                );
            });

            botaoRecusar.addEventListener('click', () => {
                processarSolicitacao(
                    solicitacao.id_seguir,
                    'recusar',
                    item,
                    botaoAceitar,
                    botaoRecusar
                );
            });

            acoes.appendChild(botaoAceitar);
            acoes.appendChild(botaoRecusar);

            item.appendChild(foto);
            item.appendChild(informacoes);
            item.appendChild(acoes);

            listaSolicitacoes.appendChild(item);
        });

    } catch (erro) {
        console.error('Erro ao carregar solicitações:', erro);

        listaSolicitacoes.innerHTML = `
            <p class="mensagem-solicitacoes">
                Não foi possível carregar as solicitações.
                Verifique se o servidor está funcionando e tente novamente.
            </p>
        `;
    }
}


// Aceita ou recusa uma solicitação
async function processarSolicitacao(
    idSolicitacao,
    acao,
    item,
    botaoAceitar,
    botaoRecusar
) {
    const mensagemOriginal = acao === 'aceitar'
        ? botaoAceitar.textContent
        : botaoRecusar.textContent;

    botaoAceitar.disabled = true;
    botaoRecusar.disabled = true;

    if (acao === 'aceitar') {
        botaoAceitar.textContent = 'Aceitando...';
    } else {
        botaoRecusar.textContent = 'Recusando...';
    }

    try {
        const metodo = acao === 'aceitar' ? 'PUT' : 'DELETE';

        const resposta = await fetch(
            `${API}/solicitacoes-seguir/${idSolicitacao}/${acao}`,
            {
                method: metodo,
                credentials: 'include'
            }
        );

        const resultado = await resposta.json();

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            throw new Error(
                resultado.mensagem || 'Não foi possível processar a solicitação.'
            );
        }

        // Remove o cartão após a confirmação do servidor.
        item.remove();

        if (listaSolicitacoes.children.length === 0) {
            listaSolicitacoes.innerHTML = `
                <p class="mensagem-solicitacoes">
                    Você não tem solicitações pendentes no momento.
                </p>
            `;
        }

    } catch (erro) {
        console.error('Erro ao processar solicitação:', erro);

        alert(erro.message || 'Ocorreu um erro ao processar a solicitação.');

        botaoAceitar.disabled = false;
        botaoRecusar.disabled = false;

        if (acao === 'aceitar') {
            botaoAceitar.textContent = mensagemOriginal;
        } else {
            botaoRecusar.textContent = mensagemOriginal;
        }
    }
}


// Inicia a página
carregarSolicitacoes();
