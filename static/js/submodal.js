document.addEventListener('DOMContentLoaded', function() {
    console.log("aberto!!!!!!!!!!!")
    // Delegação de eventos para os links que abrem sub-módulos
    document.querySelector('.options_modais').addEventListener('click', function(event) {
        const link = event.target.closest('a.abrir-sub-modal');
        if (link) {
            const targetSubModal = link.getAttribute('data-target');
            const tipoModal = link.getAttribute('data-tipo');
            const idAgendamento = link.getAttribute('data-id'); // Obtém o ID do agendamento

            console.log(`Abrindo sub-modal: ${targetSubModal} do tipo: ${tipoModal} com ID: ${idAgendamento}`);
            abrirSubModal(targetSubModal, tipoModal, idAgendamento); // Chama a função para abrir o sub-modal
        }
    });
});

// Função para abrir o sub-modal
function abrirSubModal(subModalId, tipoModal, idAgendamento) {
    console.log("Submodal abrindo........")
    const subModal = document.getElementById(subModalId.replace('#', ''));
    if (subModal) {
        subModal.classList.add('active'); // Adiciona a classe active para mostrar o modal
        preencherDadosSubModal(subModal, tipoModal, idAgendamento); // Preenche os dados no sub-modal
    } else {
        console.error(`Sub-modal com ID: ${subModalId} não encontrado`);
    }
}

// Função para preencher os dados no sub-modal
function preencherDadosSubModal(subModal, tipoModal, idAgendamento) {
    console.log("Preenchendo dados no sub-modal para ID:", idAgendamento);
    
    // Acessa o dicionário global agendamentosEdicao
    const dados = agendamentosEdicao[idAgendamento];
    
    if (dados) {
        if (tipoModal === 'confirmacao') {
            // Preenche os campos específicos para o modal de confirmação
            subModal.querySelector('#nomeClienteConfirmacao').value = dados.nome;
            subModal.querySelector('#diaAgendadoConfirmacao').value = dados.diaAgendado;
            subModal.querySelector('#numeroClienteConfirmacao').value = dados.numero;
            subModal.querySelector('#lojaAgendadaConfirmacao').value = dados.lojaNome;
        } else if (tipoModal === 'reagendamento') {
            // Adicione lógica para preencher campos para o modal de reagendamento, se necessário
        }
    } else {
        console.warn(`Dados para o ID ${idAgendamento} não encontrados no dicionário.`);
    }
}
