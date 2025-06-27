$(document).ready(function () {
    // ==========================
    // CONFIGURAÇÃO INICIAL
    // ==========================
    const userGroups = window.userGroups; // Obtém os grupos de usuários da variável global definida no template

    // Ajusta a altura do container ao carregar a página
    adjustContainerHeight();

    // Adiciona um listener para redimensionamento da janela
    $(window).on('resize', adjustContainerHeight);

    // ==========================
    // FUNÇÕES DE FORMATAÇÃO
    // ==========================
    // Função para formatar o número de telefone
    function formatarTelefone(telefone) {
        const numeroLimpo = telefone.replace(/\D/g, '');
        let numeroFormatado = '';
        if (numeroLimpo.length <= 10) {
            // Formato: (00) 0000-0000
            numeroFormatado = numeroLimpo.replace(/^(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        } else {
            // Formato: (00) 0 0000-0000
            numeroFormatado = numeroLimpo.replace(/^(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4');
        }
        return numeroFormatado;
    }

    // Função para formatar o CPF
    function formatarCPF(cpf) {
        const cpfLimpo = cpf.replace(/\D/g, '');
        return cpfLimpo.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    // ==========================
    // EVENTOS DE FORMATAÇÃO EM TEMPO REAL
    // ==========================
    const numeroClienteInput = document.getElementById('numeroCliente'); // Certifique-se de que o ID esteja correto
    const cpfClienteInput = document.getElementById('cpfCliente'); // Certifique-se de que o ID esteja correto

    if (numeroClienteInput) {
        // Evento para formatar o número de telefone em tempo real
        numeroClienteInput.addEventListener('input', function(e) {
            let inicio = this.selectionStart;
            let fim = this.selectionEnd;
            let tamanhoAnterior = this.value.length;
            
            this.value = formatarTelefone(this.value);
            
            let tamanhoNovo = this.value.length;
            inicio += tamanhoNovo - tamanhoAnterior;
            fim += tamanhoNovo - tamanhoAnterior;
            
            this.setSelectionRange(inicio, fim);
        });
    }

    if (cpfClienteInput) {
        // Evento para formatar o CPF em tempo real
        cpfClienteInput.addEventListener('input', function(e) {
            let inicio = this.selectionStart;
            let fim = this.selectionEnd;
            let tamanhoAnterior = this.value.length;
            
            this.value = formatarCPF(this.value);
            
            let tamanhoNovo = this.value.length;
            inicio += tamanhoNovo - tamanhoAnterior;
            fim += tamanhoNovo - tamanhoAnterior;
            
            this.setSelectionRange(inicio, fim);
        });
    }

    // ==========================
    // FUNÇÕES DE ATUALIZAÇÃO DE GRUPOS
    // ==========================
    function updateGroups() {
        const userId = document.getElementById('user-select').value;
        console.log("Usuário selecionado:", userId);
        console.log("Grupos do usuário:", userGroups[userId]);

        // Desmarca todos os checkboxes de grupos
        document.querySelectorAll('.group-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

        // Se um usuário foi selecionado e ele tem grupos associados
        if (userId && userGroups[userId]) {
            const userGroupsList = userGroups[userId];
            console.log("Listando grupos para marcar:", userGroupsList);

            // Marca os checkboxes correspondentes aos grupos do usuário
            userGroupsList.forEach(groupId => {
                const checkbox = document.getElementById('group-' + groupId);
                if (checkbox) {
                    checkbox.checked = true;
                    console.log("Marcando grupo:", groupId);
                } else {
                    console.warn("Checkbox não encontrado para o grupo:", groupId);
                }
            });
        }
    }

    // Exporta a função updateGroups para que possa ser chamada no template
    window.updateGroups = updateGroups;

    // Atualiza os checkboxes dos grupos com base no usuário selecionado
    const userSelect = document.getElementById('user-select');
    const groupCheckboxes = document.querySelectorAll('.group-checkbox');

    userSelect.addEventListener('change', function() {
        const selectedUserId = this.value;
        const selectedUserGroups = userGroups[selectedUserId] || [];

        groupCheckboxes.forEach(checkbox => {
            checkbox.checked = selectedUserGroups.includes(parseInt(checkbox.value));
        });
    });

    // ==========================
    // FUNÇÕES DE VERIFICAÇÃO DE CARGO
    // ==========================
    const inputDepartamento = document.getElementById('nome_departamento');
    const inputCargo = document.getElementById('nome_cargo');
    const inputNivel = document.getElementById('nivel_cargo');
    const feedback = document.getElementById('cargoFeedback');
    const btnCadastrar = document.getElementById('btnCadastrarCargo');

    function verificarCargo() {
        const nomeCargo = inputCargo.value.trim().toLowerCase();
        const nivelCargo = inputNivel.value.trim().toLowerCase();
        const cargos = Array.from(document.getElementById('listaCargos').getElementsByTagName('li'));

        const cargoExistente = cargos.some(cargo => {
            const cargoInfo = cargo.textContent.split('(');
            const cargoNome = cargoInfo[0].trim().toLowerCase();
            const cargoNivel = cargoInfo[1].replace(')', '').trim().toLowerCase();
            return cargoNome === nomeCargo && cargoNivel === nivelCargo;
        });

        if (cargoExistente) {
            feedback.textContent = 'Este cargo com este nível já existe.';
            btnCadastrar.disabled = true;
            btnCadastrar.classList.add('btn-danger');
            btnCadastrar.classList.remove('btn-primary');
        } else {
            feedback.textContent = '';
            btnCadastrar.disabled = false;
            btnCadastrar.classList.remove('btn-danger');
            btnCadastrar.classList.add('btn-primary');
        }
    }

    inputCargo.addEventListener('input', verificarCargo);
    inputNivel.addEventListener('input', verificarCargo);

    document.getElementById('formCargo').addEventListener('submit', function(e) {
        e.preventDefault();
        this.submit();
    });

    // ==========================
    // FUNÇÕES DE MANIPULAÇÃO DE AGENDAMENTOS
    // ==========================
    function ordenarAgendamentosPorDataHora(agendamentos) {
        return Object.values(agendamentos).sort((a, b) => {
            return new Date(b.diaAgendado) - new Date(a.diaAgendado);
        });
    }

    function obterAgendamentosMaisRecentes(agendamentos) {
        const agendamentosPorCPF = {};
        const agendamentosOrdenados = ordenarAgendamentosPorDataHora(agendamentos);

        agendamentosOrdenados.forEach(agendamento => {
            if (!agendamentosPorCPF[agendamento.cpf] || 
                new Date(agendamento.diaAgendado) > new Date(agendamentosPorCPF[agendamento.cpf].diaAgendado)) {
                agendamentosPorCPF[agendamento.cpf] = agendamento;
            }
        });

        return agendamentosPorCPF;
    }

    const agendamentosMaisRecentes = obterAgendamentosMaisRecentes(todosAgendamentos);

    function podeEditarAgendamento(agendamento) {
        const agendamentoMaisRecente = agendamentosMaisRecentes[agendamento.cpf];
        const dataAgendamento = new Date(agendamento.diaAgendado);
        const dataAtual = new Date();
        const umDiaEmMs = 24 * 60 * 60 * 1000; // 1 dia em milissegundos

        return agendamento.id === agendamentoMaisRecente.id && 
               (dataAgendamento > dataAtual || 
                (dataAtual - dataAgendamento) <= umDiaEmMs);
    }

    // ==========================
    // FUNÇÕES DE FILTRAGEM E PREENCHIMENTO DE TABELA
    // ==========================
    document.addEventListener('DOMContentLoaded', function() {
        const tbody = document.querySelector('#tabelaTodosAgendamentos tbody');
        const filtroCPF = document.getElementById('filtroCPF');

        function preencherTabela(agendamentos) {
            tbody.innerHTML = ''; // Limpa o conteúdo existente
            agendamentos.forEach(agendamento => {
                const tr = document.createElement('tr');
                const isEditable = podeEditarAgendamento(agendamento);
                tr.innerHTML = `
                    <td>
                        ${isEditable 
                            ? `<a href="#">${agendamento.nome}</a>`
                            : agendamento.nome}
                    </td>
                    <td>${agendamento.cpf}</td>
                    <td>${agendamento.numero}</td>
                    <td>${formatarDataHora(agendamento.diaAgendado)}</td>
                    <td>${agendamento.atendenteNome}</td>
                    <td>${agendamento.statusDias}</td>
                    <td>${agendamento.tabulacaoAtendente}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        filtroCPF.addEventListener('input', function() {
            const cpfFiltro = filtroCPF.value.trim().toLowerCase();
            const agendamentosFiltrados = todosAgendamentos.filter(agendamento => 
                agendamento.cpf.toLowerCase().includes(cpfFiltro)
            );
            preencherTabela(agendamentosFiltrados);
        });

        preencherTabela(todosAgendamentos);
    });
});
