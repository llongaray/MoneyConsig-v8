// agendamentos.js
$(document).ready(function () {
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
        const umDiaEmMs = 24 * 60 * 60 * 1000;

        return agendamento.id === agendamentoMaisRecente.id && 
               (dataAgendamento > dataAtual || 
                (dataAtual - dataAgendamento) <= umDiaEmMs);
    }

    const tbody = document.querySelector('#tabelaTodosAgendamentos tbody');
    const filtroCPF = document.getElementById('filtroCPF');

    function preencherTabela(agendamentos) {
        tbody.innerHTML = '';
        agendamentos.forEach(agendamento => {
            const tr = document.createElement('tr');
            const isEditable = podeEditarAgendamento(agendamento);
            tr.innerHTML = `
                <td>
                    ${isEditable ? `<a href="#">${agendamento.nome}</a>` : agendamento.nome}
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
