
const formulario = document.querySelector('.formulario-postagem');

formulario.addEventListener('submit', async function (evento) {
    evento.preventDefault();

    const atividade = {
        titulo: document.getElementById('titulo').value.trim(),
        descricao: document.getElementById('descricao').value.trim(),
        tipo: document.getElementById('atividade').value,
        local: document.getElementById('local').value.trim(),
        data: document.getElementById('data').value,
        horario: document.getElementById('horario').value,
        nivel: document.getElementById('nivel').value,
        vagas: Number(document.getElementById('vagas').value),
        idade_minima: Number(document.getElementById('idade-minima').value),
        idade_maxima: Number(document.getElementById('idade-maxima').value)
    };

    // Validação do número de vagas
    if (!Number.isInteger(atividade.vagas) || atividade.vagas < 1) {
        alert('Informe um número válido de vagas.');
        return;
    }

    // Validação da faixa etária
    if (
        !Number.isInteger(atividade.idade_minima) ||
        !Number.isInteger(atividade.idade_maxima) ||
        atividade.idade_minima < 0 ||
        atividade.idade_maxima > 120 ||
        atividade.idade_minima > atividade.idade_maxima
    ) {
        alert('Informe uma faixa etária válida. A idade mínima não pode ser maior que a máxima.');
        return;
    }

    const niveis = {
        iniciante: 'Iniciante',
        intermediario: 'Intermediário',
        avancado: 'Avançado'
    };

    atividade.nivel = niveis[atividade.nivel];

    try {
        const resposta = await fetch(
            'http://127.0.0.1:3000/atividades',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(atividade)
            }
        );

        const resultado = await resposta.json();

        if (resposta.status === 401) {
            alert('Você precisa fazer login para publicar uma atividade.');
            window.location.href = 'Login.html';
            return;
        }

        if (!resposta.ok) {
            throw new Error(
                resultado.mensagem || 'Não foi possível publicar a atividade.'
            );
        }

        alert('Atividade publicada com sucesso!');
        window.location.href = 'feed.html';

    } catch (erro) {
        console.error('Erro ao publicar atividade:', erro);
        alert(erro.message || 'Erro ao conectar com o servidor.');
    }
});
