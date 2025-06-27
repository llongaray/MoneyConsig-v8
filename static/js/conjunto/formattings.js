// formattings.js
$(document).ready(function () {
    console.log("formattings.js carregado e pronto para uso.");

    // Função para formatar o número de telefone
    function formatarTelefone(telefone) {
        console.log("Formatando telefone:", telefone); // Log do telefone recebido
        const numeroLimpo = telefone.replace(/\D/g, ''); // Remove caracteres não numéricos
        let numeroFormatado = '';

        if (numeroLimpo.length <= 10) {
            // Formato: (00) 0000-0000
            numeroFormatado = numeroLimpo.replace(/^(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        } else {
            // Formato: (00) 0 0000-0000
            numeroFormatado = numeroLimpo.replace(/^(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4');
        }

        console.log("Telefone formatado:", numeroFormatado); // Log do telefone formatado
        return numeroFormatado;
    }

    // Função para formatar o CPF
    function formatarCPF(cpf) {
        console.log("Formatando CPF:", cpf); // Log do CPF recebido
        const cpfLimpo = cpf.replace(/\D/g, ''); // Remove caracteres não numéricos
        const cpfFormatado = cpfLimpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

        console.log("CPF formatado:", cpfFormatado); // Log do CPF formatado
        return cpfFormatado;
    }

    // Seleciona os inputs pelos IDs corretos
    const numeroClienteInput = document.getElementById('numero_cliente'); // Corrigido o ID
    const cpfClienteInput = document.getElementById('cpf_cliente'); // Corrigido o ID

    // Adiciona o evento de formatação em tempo real para o número de telefone
    if (numeroClienteInput) {
        numeroClienteInput.addEventListener('input', function () {
            console.log("Entrada no campo de número de celular:", this.value); // Log da entrada do número
            let inicio = this.selectionStart;
            let fim = this.selectionEnd;
            const tamanhoAnterior = this.value.length;
            
            this.value = formatarTelefone(this.value); // Formata o valor do input

            const tamanhoNovo = this.value.length;
            inicio += tamanhoNovo - tamanhoAnterior;
            fim += tamanhoNovo - tamanhoAnterior;

            this.setSelectionRange(inicio, fim); // Ajusta a posição do cursor
        });
    }

    // Adiciona o evento de formatação em tempo real para o CPF
    if (cpfClienteInput) {
        cpfClienteInput.addEventListener('input', function () {
            console.log("Entrada no campo de CPF:", this.value); // Log da entrada do CPF
            let inicio = this.selectionStart;
            let fim = this.selectionEnd;
            const tamanhoAnterior = this.value.length;
            
            this.value = formatarCPF(this.value); // Formata o valor do input

            const tamanhoNovo = this.value.length;
            inicio += tamanhoNovo - tamanhoAnterior;
            fim += tamanhoNovo - tamanhoAnterior;

            this.setSelectionRange(inicio, fim); // Ajusta a posição do cursor
        });
    }
});
