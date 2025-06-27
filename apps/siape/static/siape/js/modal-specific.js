console.log('MODAL-SPECIFIC SIAPE EM EXECUÇÃO!!');


// USO SIAPE: Preenche dados para importação de CSV
function preencherDadosImportCSV(subModal, idCampanha) {
    console.log("Preenchendo dados para importação de CSV. ID da Campanha:", idCampanha);

    const campanha = campanhasEdicao[idCampanha];

    if (campanha) {
        subModal.querySelector('#nome_campanha').value = campanha.nome;  
        subModal.querySelector('#campanha_id').value = idCampanha;  
    } else {
        console.warn(`Dados para a campanha com ID ${idCampanha} não encontrados.`);
    }
}

// Função para alternar entre as seções de edição e importação
function toggleCampanhaAction() {
    const acaoCampanha = document.getElementById('acaoCampanha').value;
    document.getElementById('editCampanhaSection').style.display = acaoCampanha === 'edit' ? 'block' : 'none';
    document.getElementById('importCampanhaSection').style.display = acaoCampanha === 'import' ? 'block' : 'none';
}

// Função para buscar informações da campanha
function autocompleteCampanha(value) {
    const campanhas = Object.keys(debitosPorCampanha).map(id => ({
        id: id,
        nome: document.querySelector(`option[value="${id}"]`).text,
        debitos: debitosPorCampanha[id]
    }));

    const campanha = campanhas.find(c => c.nome.toLowerCase().includes(value.toLowerCase()));
    const infoDiv = document.getElementById('campanhaInfo');

    if (campanha) {
        infoDiv.innerHTML = `
            <p>Status: ${campanha.status ? 'Ativo' : 'Inativo'}</p>
            <p>Débitos associados: ${campanha.debitos}</p>
            <label for="statusCampanha">Alterar Status:</label>
            <select id="statusCampanha">
                <option value="true" ${campanha.status ? 'selected' : ''}>Ativo</option>
                <option value="false" ${!campanha.status ? 'selected' : ''}>Inativo</option>
            </select>
        `;
    } else {
        infoDiv.innerHTML = '';
    }
}

// Função para atualizar a campanha
function updateCampanha() {
    const statusCampanha = document.getElementById('statusCampanha').value;
    console.log(`Atualizando campanha para status: ${statusCampanha}`);
}

// Função para controlar a visibilidade do campo setor
function toggleSetorField() {
    const tipoMeta = document.getElementById('tipo').value;
    const setorContainer = document.getElementById('setorContainer');
    const setorSelect = document.getElementById('setor');
    const lojaContainer = document.getElementById('lojaContainer');
    const lojaSelect = document.getElementById('loja');
    
    if (tipoMeta === 'EQUIPE') {
        setorContainer.style.display = 'block';
        setorSelect.required = true;
        
        // Verifica se o setor selecionado é INSS
        if (setorSelect.value === 'INSS') {
            lojaContainer.style.display = 'block';
            lojaSelect.required = true;
        } else {
            lojaContainer.style.display = 'none';
            lojaSelect.required = false;
            lojaSelect.value = '';
        }
    } else {
        setorContainer.style.display = 'none';
        lojaContainer.style.display = 'none';
        setorSelect.required = false;
        lojaSelect.required = false;
        setorSelect.value = '';
        lojaSelect.value = '';
    }
}

// Event Listeners
document.getElementById('setor').addEventListener('change', function() {
    if (this.value === 'INSS') {
        document.getElementById('lojaContainer').style.display = 'block';
        document.getElementById('loja').required = true;
    } else {
        document.getElementById('lojaContainer').style.display = 'none';
        document.getElementById('loja').required = false;
        document.getElementById('loja').value = '';
    }
});

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    toggleSetorField();
});