
async function carregarPerfil() {
    try {
        const resposta = await fetch('http://127.0.0.1:3000/meu-perfil', {
            credentials: 'include'
        });

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            throw new Error('Não foi possível carregar o perfil.');
        }

        const usuario = await resposta.json();
        
        // Carrega a foto de perfil salva no banco
        const imagemPerfil = document.querySelector('.foto-perfil');

        if (imagemPerfil) {
            imagemPerfil.src = usuario.foto
                ? `http://127.0.0.1:3000/${usuario.foto}`
                : 'imagens/Perfil.png';
        }


        // Nome, nome de usuário e biografia
        document.getElementById('nome-perfil').textContent =
            usuario.nome || 'Usuário';

        document.getElementById('nome-usuario-perfil').textContent =
            '@' + (usuario.nome_usuario || 'usuario');

        document.getElementById('descricao-perfil').textContent =
            usuario.biografia || 'Nenhuma biografia cadastrada.';

        // Atividades
        const atividades = usuario.atividades || [];

        const nomesAtividades = {
            corrida: 'Corrida',
            caminhada: 'Caminhada',
            ciclismo: 'Ciclismo',
            academia: 'Academia',
            outros: 'Outros'
        };

        const atividadesExibidas = atividades.map(atividade => {
            return nomesAtividades[atividade] || atividade;
        });

        document.getElementById('atividades-perfil').textContent =
            atividadesExibidas.length > 0
                ? atividadesExibidas.join(', ')
                : 'Nenhuma atividade cadastrada.';

        // Nível de atividade
        const niveis = {
            iniciante: 'Iniciante',
            intermediario: 'Intermediário',
            avancado: 'Avançado'
        };

        document.getElementById('nivel-perfil').textContent =
            niveis[usuario.nivel_atividade] || 'Não informado';

        // Privacidade
        document.getElementById('privacidade-perfil').textContent =
            Number(usuario.perfil_privado) === 1
                ? 'Privado'
                : 'Público';

    } catch (erro) {
        console.error('Erro ao carregar perfil:', erro);
        alert('Não foi possível carregar os dados do perfil.');
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



carregarPerfil();
