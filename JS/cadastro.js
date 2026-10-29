
const formulario = document.getElementById('formulario-cadastro');

formulario.addEventListener('submit', async function (evento) {
    evento.preventDefault();

    const nome = document.getElementById('nome').value;
    const idade = document.getElementById('idade').value;
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;

    try {
        const resposta = await fetch('/cadastro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome: nome,
                idade: idade,
                email: email,
                senha: senha
            })
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            alert(resultado.mensagem);
            return;
        }

        alert(resultado.mensagem);
        window.location.href = 'Login.html';

    } catch (erro) {
        alert('Não foi possível conectar ao servidor. Verifique se ele está iniciado.');
        console.error('Erro ao cadastrar:', erro);
    }
});
