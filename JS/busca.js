
const formularioBusca = document.querySelector('.formulario-busca');
const formularioFiltros = document.querySelector('.formulario-filtros');
const listaResultados = document.getElementById('lista-resultados-busca');

async function buscarAtividades() {
    const parametros = new URLSearchParams();

    const pesquisa = document.getElementById('pesquisa').value.trim();
    const local = document.getElementById('local-busca').value.trim();
    const data = document.getElementById('data-busca').value;
    const nivel = document.getElementById('nivel-busca').value;
    const idade = document.getElementById('idade').value.trim();

    if (pesquisa) parametros.set('pesquisa', pesquisa);
    if (local) parametros.set('local', local);
    if (data) parametros.set('data', data);
    if (nivel) parametros.set('nivel', nivel);
    if (idade !== '') {
        parametros.set('idade', idade);
    }

    listaResultados.textContent = 'Buscando atividades...';

    try {
        const resposta = await fetch(
            `/buscar-atividades?${parametros.toString()}`,
            { credentials: 'include' }
        );

        const resultado = await resposta.json();

        if (resposta.status === 401) {
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            throw new Error(
                resultado.mensagem || 'Erro ao buscar atividades.'
            );
        }

        listaResultados.replaceChildren();

        if (resultado.length === 0) {
            listaResultados.textContent =
                'Nenhuma atividade encontrada com esses critérios.';
            return;
        }

        resultado.forEach(atividade => {
            const cartao = document.createElement('article');
            cartao.className = 'cartao-evento';

            const titulo = document.createElement('h3');
            titulo.textContent = atividade.titulo;

            const descricao = document.createElement('p');
            descricao.textContent =
                atividade.descricao || 'Sem descrição informada.';

            const data = document.createElement('p');
            const dataFormatada = String(atividade.data).slice(0, 10);
            const partesData = dataFormatada.split('-');
            const dataBrasileira = partesData.length === 3
                ? `${partesData[2]}/${partesData[1]}/${partesData[0]}`
                : dataFormatada;

            data.textContent = `Data: ${dataBrasileira}`;

            const horario = document.createElement('p');
            horario.textContent =
                `Horário: ${String(atividade.horario).slice(0, 5)}`;

            const local = document.createElement('p');
            local.textContent = `Local: ${atividade.local}`;

            const nivel = document.createElement('p');
            nivel.textContent = `Nível: ${atividade.nivel || 'Não informado'}`;

            const tipo = document.createElement('p');
            tipo.textContent = `Tipo: ${atividade.tipo}`;

            const vagas = document.createElement('p');
            vagas.textContent =
                `Inscritos: ${atividade.total_inscritos} de ${atividade.vagas}`;

            const organizador = document.createElement('p');
            organizador.textContent =
                `Organizador: ${atividade.nome_organizador}`;

            cartao.append(
                titulo,
                descricao,
                tipo,
                local,
                data,
                horario,
                nivel,
                vagas,
                organizador
            );

            listaResultados.append(cartao);
        });

    } catch (erro) {
        console.error('Erro na busca:', erro);
        listaResultados.textContent =
            'Não foi possível buscar atividades. Verifique se o servidor está funcionando.';
    }
}

formularioBusca.addEventListener('submit', evento => {
    evento.preventDefault();
    buscarAtividades();
});

formularioFiltros.addEventListener('submit', evento => {
    evento.preventDefault();
    buscarAtividades();
});

formularioFiltros.addEventListener('reset', () => {
    setTimeout(buscarAtividades, 0);
});

// Carrega todas as atividades ao abrir a página.
buscarAtividades();
