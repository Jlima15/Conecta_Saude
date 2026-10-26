
async function sairDaConta(evento) {
    evento.preventDefault();

    try {
        const resposta = await fetch('http://127.0.0.1:3000/logout', {
            method: 'POST',
            credentials: 'include'
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            alert(resultado.mensagem);
            return;
        }

        window.location.href = 'Login.html';

    } catch (erro) {
        console.error('Erro ao sair:', erro);
        alert('Não foi possível conectar ao servidor.');
    }
}

const botaoSair = document.querySelector('.botao-sair');

if (botaoSair) {
    botaoSair.addEventListener('click', sairDaConta);
}
