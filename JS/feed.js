
const listaFeed = document.getElementById('lista-feed');

async function carregarAtividades() {
    try {
        const resposta = await fetch(
            'http://127.0.0.1:3000/atividades',
            {
                credentials: 'include'
            }
        );

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar as atividades.');
        }

        const atividades = await resposta.json();

        listaFeed.replaceChildren();

        if (atividades.length === 0) {
            listaFeed.textContent =
                'Ainda não existem atividades cadastradas.';
            return;
        }

        atividades.forEach(atividade => {
            const cartao = document.createElement('article');
            cartao.className = 'cartao-feed';

            const autor = document.createElement('header');
            autor.className = 'autor-publicacao';

            const identificacao = document.createElement('div');
            identificacao.className = 'identificacao-autor';

            const avatar = document.createElement('div');
            avatar.className = 'avatar-autor';
            avatar.textContent =
                atividade.nome ? atividade.nome.charAt(0).toUpperCase() : '?';

            const dadosAutor = document.createElement('div');

            const nome = document.createElement('h2');
            nome.textContent = atividade.nome || 'Usuário';

            const usuario = document.createElement('p');
            usuario.textContent = atividade.nome_usuario
                ? '@' + atividade.nome_usuario
                : '';

            dadosAutor.append(nome, usuario);
            identificacao.append(avatar, dadosAutor);
            autor.append(identificacao);

            const conteudo = document.createElement('div');
            conteudo.className = 'conteudo-publicacao';

            const titulo = document.createElement('h3');
            titulo.textContent = atividade.titulo;

            const descricao = document.createElement('p');
            descricao.className = 'descricao-evento';
            descricao.textContent =
                atividade.descricao || 'Sem descrição informada.';

            const informacoes = document.createElement('div');
            informacoes.className = 'informacoes-evento';

            const data = atividade.data
                ? new Date(atividade.data).toLocaleDateString('pt-BR')
                : 'Não informada';

            const horario = String(atividade.horario || '')
                .slice(0, 5);

            const campos = [
                ['Local', atividade.local],
                ['Data', data],
                ['Horário', horario],
                ['Tipo', atividade.tipo],
                ['Nível', atividade.nivel],
                ['Vagas', atividade.vagas],
                ['Participantes', atividade.total_inscritos],
                ['Curtidas', atividade.total_curtidas],
                ['Comentários', atividade.total_comentarios]
            ];

            campos.forEach(([rotulo, valor]) => {
                if (valor === null || valor === undefined || valor === '') {
                    return;
                }

                const paragrafo = document.createElement('p');
                const destaque = document.createElement('strong');

                destaque.textContent = rotulo + ': ';
                paragrafo.append(destaque, document.createTextNode(valor));
                informacoes.append(paragrafo);
            });

            conteudo.append(titulo, descricao, informacoes);

            const acoes = document.createElement('footer');
            acoes.className = 'acoes-publicacao';

            if (Number(atividade.usuario_proprietario) === 1) {
                const botaoExcluir = document.createElement('button');

                botaoExcluir.type = 'button';
                botaoExcluir.className = 'botao-acao';
                botaoExcluir.textContent = 'Excluir publicação';

                botaoExcluir.addEventListener('click', async () => {
                    const confirmou = confirm(
                        `Tem certeza que deseja excluir "${atividade.titulo}"?\n\n` +
                        'Essa ação não poderá ser desfeita.'
                    );

                    if (!confirmou) {
                        return;
                    }

                    botaoExcluir.disabled = true;

                    try {
                        const resposta = await fetch(
                            `http://127.0.0.1:3000/atividades/${atividade.id_atividade}`,
                            {
                                method: 'DELETE',
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
                                resultado.mensagem ||
                                'Não foi possível excluir a publicação.'
                            );
                        }

                        cartao.remove();

                        alert(resultado.mensagem);

                    } catch (erro) {
                        console.error('Erro ao excluir publicação:', erro);

                        alert(
                            erro.message ||
                            'Erro ao conectar com o servidor.'
                        );

                    } finally {
                        botaoExcluir.disabled = false;
                    }
                });

                acoes.append(botaoExcluir);
            }



            const botaoCurtir = document.createElement('button');
            botaoCurtir.type = 'button';
            botaoCurtir.className = 'botao-acao';

            const atualizarBotaoCurtir = (curtiu, total) => {
                botaoCurtir.textContent = curtiu
                    ? `♥ Curtido (${total})`
                    : `♡ Curtir (${total})`;
            };

            atualizarBotaoCurtir(
                Number(atividade.usuario_curtiu) === 1,
                Number(atividade.total_curtidas) || 0
            );

            botaoCurtir.addEventListener('click', async () => {
                botaoCurtir.disabled = true;

                try {
                    const resposta = await fetch(
                        `http://127.0.0.1:3000/atividades/${atividade.id_atividade}/curtir`,
                        {
                            method: 'POST',
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
                            resultado.mensagem || 'Não foi possível curtir a atividade.'
                        );
                    }

                    atividade.usuario_curtiu = resultado.curtiu ? 1 : 0;
                    atividade.total_curtidas = resultado.total_curtidas;

                    atualizarBotaoCurtir(
                        resultado.curtiu,
                        resultado.total_curtidas
                    );

                } catch (erro) {
                    console.error('Erro ao curtir:', erro);
                    alert(erro.message || 'Erro ao conectar com o servidor.');
                } finally {
                    botaoCurtir.disabled = false;
                }
            });



            const botaoComentar = document.createElement('button');
            botaoComentar.type = 'button';
            botaoComentar.className = 'botao-acao';
            botaoComentar.textContent =
                `Comentar (${Number(atividade.total_comentarios) || 0})`;

            const areaComentarios = document.createElement('div');
            areaComentarios.className = 'area-comentarios';
            areaComentarios.hidden = true;

            const listaComentarios = document.createElement('div');
            listaComentarios.className = 'lista-comentarios';

            const formularioComentario = document.createElement('form');
            formularioComentario.className = 'formulario-comentario';

            const campoComentario = document.createElement('textarea');
            campoComentario.placeholder = 'Escreva seu comentário...';
            campoComentario.maxLength = 1000;
            campoComentario.required = true;
            campoComentario.rows = 2;

            const botaoEnviarComentario = document.createElement('button');
            botaoEnviarComentario.type = 'submit';
            botaoEnviarComentario.className = 'botao-acao';
            botaoEnviarComentario.textContent = 'Enviar';

            formularioComentario.append(campoComentario, botaoEnviarComentario);
            areaComentarios.append(listaComentarios, formularioComentario);

            let comentariosCarregados = false;

            function mostrarComentario(comentario) {
                const cartaoComentario = document.createElement('div');
                cartaoComentario.className = 'comentario';

                const autorComentario = document.createElement('strong');
                autorComentario.textContent =
                    comentario.nome || comentario.nome_usuario || 'Usuário';

                const textoComentario = document.createElement('p');
                textoComentario.textContent = comentario.texto;

                cartaoComentario.append(autorComentario, textoComentario);
                listaComentarios.append(cartaoComentario);
            }

            async function carregarComentarios() {
                listaComentarios.replaceChildren();

                const resposta = await fetch(
                    `http://127.0.0.1:3000/atividades/${atividade.id_atividade}/comentarios`,
                    { credentials: 'include' }
                );

                const dados = await resposta.json();

                if (resposta.status === 401) {
                    window.location.href = 'Login.html';
                    return false;
                }

                if (!resposta.ok) {
                    throw new Error(dados.mensagem || 'Erro ao carregar comentários.');
                }

                if (dados.length === 0) {
                    listaComentarios.textContent = 'Ainda não há comentários.';
                } else {
                    dados.forEach(mostrarComentario);
                }

                comentariosCarregados = true;
                return true;
            }

            botaoComentar.addEventListener('click', async () => {
                areaComentarios.hidden = !areaComentarios.hidden;

                if (!areaComentarios.hidden && !comentariosCarregados) {
                    try {
                        await carregarComentarios();
                    } catch (erro) {
                        console.error(erro);
                        alert(erro.message);
                    }
                }
            });

            formularioComentario.addEventListener('submit', async (evento) => {
                evento.preventDefault();

                const texto = campoComentario.value.trim();

                if (!texto) {
                    return;
                }

                botaoEnviarComentario.disabled = true;

                try {
                    const resposta = await fetch(
                        `http://127.0.0.1:3000/atividades/${atividade.id_atividade}/comentarios`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            credentials: 'include',
                            body: JSON.stringify({ texto })
                        }
                    );

                    const dados = await resposta.json();

                    if (resposta.status === 401) {
                        window.location.href = 'Login.html';
                        return;
                    }

                    if (!resposta.ok) {
                        throw new Error(
                            dados.mensagem || 'Erro ao publicar comentário.'
                        );
                    }

                    await carregarComentarios();
                    campoComentario.value = '';

                    atividade.total_comentarios =
                        Number(atividade.total_comentarios || 0) + 1;

                    botaoComentar.textContent =
                        `Comentar (${atividade.total_comentarios})`;

                } catch (erro) {
                    console.error(erro);
                    alert(erro.message || 'Erro ao enviar comentário.');
                } finally {
                    botaoEnviarComentario.disabled = false;
                }
            });



            const botaoParticipar = document.createElement('button');
            botaoParticipar.type = 'button';
            botaoParticipar.className = 'botao-acao botao-participar';

            function atualizarBotaoParticipar(inscrito) {
                botaoParticipar.textContent = inscrito
                    ? 'Cancelar inscrição'
                    : 'Participar';
            }

            atualizarBotaoParticipar(
                Number(atividade.usuario_inscrito) === 1
            );

            botaoParticipar.addEventListener('click', async () => {
                botaoParticipar.disabled = true;

                try {
                    const resposta = await fetch(
                        `http://127.0.0.1:3000/atividades/${atividade.id_atividade}/participar`,
                        {
                            method: 'POST',
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
                            resultado.mensagem || 'Não foi possível realizar a inscrição.'
                        );
                    }

                    atividade.usuario_inscrito = resultado.inscrito ? 1 : 0;
                    atividade.total_inscritos = resultado.total_inscritos;

                    atualizarBotaoParticipar(resultado.inscrito);

                    // Atualiza a quantidade de participantes exibida no cartão.
                    const informacoes = botaoParticipar
                        .closest('.cartao-feed')
                        .querySelector('.informacoes-evento');

                    const campoParticipantes = Array.from(
                        informacoes.querySelectorAll('p')
                    ).find(p => p.querySelector('strong')?.textContent === 'Participantes: ');

                    if (campoParticipantes) {
                        campoParticipantes.lastChild.textContent =
                            String(resultado.total_inscritos);
                    }

                    alert(resultado.mensagem);

                } catch (erro) {
                    console.error('Erro na inscrição:', erro);
                    alert(erro.message || 'Erro ao conectar com o servidor.');
                } finally {
                    botaoParticipar.disabled = false;
                }
            });


            // Botão visual de denunciar
            const botaoDenunciar = document.createElement('button');
            botaoDenunciar.type = 'button';
            botaoDenunciar.className = 'botao-acao botao-denunciar';
            botaoDenunciar.textContent = 'Denunciar';

            // Adiciona os botões à publicação
            acoes.append(
                botaoCurtir,
                botaoComentar,
                botaoParticipar,
                botaoDenunciar
            );

            cartao.append(areaComentarios);
            cartao.append(autor, conteudo, acoes);
            listaFeed.append(cartao);
        });

    } catch (erro) {
        console.error('Erro ao carregar o feed:', erro);

        listaFeed.textContent =
            'Não foi possível carregar as atividades. Verifique se o servidor está funcionando e tente novamente.';
    }
}

carregarAtividades();
