

async function carregarPerfil() {
    const parametros = new URLSearchParams(window.location.search);
    const idPerfil = parametros.get('id');

    const botaoEditar = document.getElementById('botao-editar-perfil');
    const areaRelacionamento = document.getElementById('area-relacionamento');
    const contagem = document.getElementById('contagem-relacionamento');

    try {
        const respostaSessao = await fetch(
            'http://127.0.0.1:3000/sessao',
            { credentials: 'include' }
        );

        if (!respostaSessao.ok) {
            window.location.href = 'Login.html';
            return;
        }

        const sessao = await respostaSessao.json();

        const proprioPerfil = !idPerfil ||
            Number(idPerfil) === Number(sessao.usuario.id);
        

        const url = proprioPerfil
            ? 'http://127.0.0.1:3000/meu-perfil'
            : `http://127.0.0.1:3000/usuarios/${encodeURIComponent(idPerfil)}/perfil`;

        const resposta = await fetch(url, {
            credentials: 'include'
        });

        const usuario = await resposta.json();

        if (!resposta.ok) {
            throw new Error(usuario.mensagem || 'Erro ao carregar perfil.');
        }

        document.getElementById('nome-perfil').textContent =
            usuario.nome || 'Usuário';

        document.getElementById('nome-usuario-perfil').textContent =
            '@' + (usuario.nome_usuario || 'usuario');

        document.getElementById('descricao-perfil').textContent =
            usuario.biografia || 'Nenhuma biografia cadastrada.';

        const imagemPerfil = document.querySelector('.foto-perfil');

        if (imagemPerfil) {
            imagemPerfil.src = usuario.foto
                ? `http://127.0.0.1:3000/${usuario.foto}`
                : 'imagens/Perfil.png';
        }

        const nomesAtividades = {
            corrida: 'Corrida',
            caminhada: 'Caminhada',
            ciclismo: 'Ciclismo',
            academia: 'Academia',
            outros: 'Outros'
        };

        const atividades = usuario.atividades || [];

        document.getElementById('atividades-perfil').textContent =
            usuario.pode_ver_detalhes === false
                ? 'Siga este perfil para ver as atividades.'
                : atividades.length
                    ? atividades.map(a => nomesAtividades[a] || a).join(', ')
                    : 'Nenhuma atividade cadastrada.';

        const niveis = {
            iniciante: 'Iniciante',
            intermediario: 'Intermediário',
            avancado: 'Avançado'
        };

        document.getElementById('nivel-perfil').textContent =
            usuario.pode_ver_detalhes === false
                ? 'Disponível para seguidores aceitos'
                : niveis[usuario.nivel_atividade] || 'Não informado';

        document.getElementById('privacidade-perfil').textContent =
            Number(usuario.perfil_privado) === 1 ? 'Privado' : 'Público';

        if (botaoEditar) {
            botaoEditar.hidden = !proprioPerfil;
        }

        const eventos = document.querySelector('.secao-eventos');
        const areaSair = document.querySelector('.area-sair');

        if (eventos) {
            eventos.style.display = proprioPerfil ? '' : 'none';
        }

        if (areaSair) {
            areaSair.style.display = proprioPerfil ? '' : 'none';
        }

        if (botaoEditar) {
            botaoEditar.style.display = proprioPerfil ? '' : 'none';
        }

        areaRelacionamento.replaceChildren();
        areaRelacionamento.hidden = proprioPerfil;

        if (proprioPerfil) {
            contagem.textContent = '';
            return;
        }

        const respostaRelacao = await fetch(
            `http://127.0.0.1:3000/usuarios/${encodeURIComponent(idPerfil)}/relacionamento`,
            { credentials: 'include' }
        );

        const relacao = await respostaRelacao.json();
        
        if (!respostaRelacao.ok) {
            throw new Error(relacao.mensagem || 'Erro ao consultar relacionamento.');
        }

        if (relacao.bloqueado) {
            throw new Error('Não é possível visualizar este perfil.');
        }

        contagem.textContent =
            `Seguidores: ${relacao.total_seguidores} | Seguindo: ${relacao.total_seguindo}`;

        const botao = document.createElement('button');
        botao.type = 'button';
        botao.className = 'botao';

        const segue = Number(relacao.segue) === 1;
        const solicitacaoPendente = Number(relacao.solicitacao_pendente) === 1;

        if (segue) {
            botao.textContent = 'Deixar de seguir';
        } else if (solicitacaoPendente) {
            botao.textContent = 'Solicitação enviada';
            botao.disabled = true;
        } else {
            botao.textContent = relacao.perfil_privado
                ? 'Solicitar para seguir'
                : 'Seguir';
        }
        
        botao.addEventListener('click', async () => {
            


            if (segue) {

                

                botao.disabled = true;

                try {
                    

                    const respostaDeixarDeSeguir = await fetch(
                        `http://127.0.0.1:3000/usuarios/${encodeURIComponent(idPerfil)}/deixar-de-seguir`,
                        {
                            method: 'DELETE',
                            credentials: 'include'
                        }
                    );

                    

                    const resultado = await respostaDeixarDeSeguir.json();
                    

                    if (!respostaDeixarDeSeguir.ok) {
                        throw new Error(
                            resultado.mensagem || 'Não foi possível deixar de seguir.'
                        );
                    }

                    alert(resultado.mensagem);
                    await carregarPerfil();

                } catch (erro) {
                    alert(erro.message);
                    botao.disabled = false;
                }

                return;
            }


            botao.disabled = true;

            try {
                const respostaSeguir = await fetch(
                    `http://127.0.0.1:3000/usuarios/${encodeURIComponent(idPerfil)}/seguir`,
                    {
                        method: 'POST',
                        credentials: 'include'
                    }
                );

                const resultado = await respostaSeguir.json();

                if (!respostaSeguir.ok) {
                    throw new Error(resultado.mensagem || 'Não foi possível seguir.');
                }

                alert(resultado.mensagem);
                await carregarPerfil();

            } catch (erro) {
                alert(erro.message);
                botao.disabled = false;
            }
        });


        areaRelacionamento.appendChild(botao);

    } catch (erro) {
        console.error('Erro ao carregar perfil:', erro);
        alert(erro.message || 'Não foi possível carregar o perfil.');
    }
}



async function carregarMeusEventos() {
    const lista = document.getElementById('lista-meus-eventos');

    try {
        const resposta = await fetch(
            'http://127.0.0.1:3000/meus-eventos',
            {
                credentials: 'include'
            }
        );

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar seus eventos.');
        }

        const eventos = await resposta.json();

        lista.replaceChildren();

        if (eventos.length === 0) {
            lista.textContent = 'Você ainda não está inscrito em nenhum evento.';
            return;
        }

        eventos.forEach(evento => {
            const cartao = document.createElement('article');
            cartao.className = 'cartao-evento';

            const titulo = document.createElement('h3');
            titulo.textContent = evento.titulo;

            const data = document.createElement('p');
            const dataFormatada = String(evento.data).slice(0, 10);

            const dataPartes = dataFormatada.split('-');
            const dataBrasileira = dataPartes.length === 3
                ? `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]}`
                : dataFormatada;

            const destaqueData = document.createElement('strong');
            destaqueData.textContent = 'Data: ';
            data.append(destaqueData, document.createTextNode(dataBrasileira));

            const horario = document.createElement('p');
            const destaqueHorario = document.createElement('strong');
            destaqueHorario.textContent = 'Horário: ';
            horario.append(
                destaqueHorario,
                document.createTextNode(String(evento.horario).slice(0, 5))
            );

            const local = document.createElement('p');
            const destaqueLocal = document.createElement('strong');
            destaqueLocal.textContent = 'Local: ';
            local.append(
                destaqueLocal,
                document.createTextNode(evento.local)
            );

            const organizador = document.createElement('p');
            const destaqueOrganizador = document.createElement('strong');
            destaqueOrganizador.textContent = 'Organizador: ';
            organizador.append(
                destaqueOrganizador,
                document.createTextNode(evento.nome_organizador)
            );

            cartao.append(titulo, data, horario, local, organizador);
            lista.append(cartao);
        });

    } catch (erro) {
        console.error('Erro ao carregar meus eventos:', erro);
        lista.textContent = 'Não foi possível carregar seus eventos.';
    }
}




carregarPerfil();
carregarMeusEventos();

