// USO UNIVERSAL: Salva o estado do modal ativo na sessão
function saveActiveModalState(modalId) {
    if (modalId) {
        sessionStorage.setItem('activeModal', modalId.replace('#', ''));
        console.log(`Estado do modal salvo: ${modalId}`);
    } else {
        sessionStorage.removeItem('activeModal');
        console.log('Estado do modal removido');
    }
}

// USO UNIVERSAL: Restaura o estado do último modal ativo
function restoreActiveModalState() {
    const activeModalId = sessionStorage.getItem('activeModal');
    if (activeModalId) {
        const modal = document.getElementById(activeModalId);
        if (modal) {
            modal.classList.add('active');
            console.log(`Modal restaurado: ${activeModalId}`);
        }
    }
}

// USO UNIVERSAL: Abre um modal e gerencia o estado
function openModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    console.log(`Tentando abrir o modal com ID: ${cleanedModalId}`);

    document.querySelectorAll('.modal.active').forEach(modal => {
        if (modal.id !== cleanedModalId) {
            modal.classList.remove('active');
            console.log(`Fechando modal: ${modal.id}`);
        }
    });

    const modal = document.getElementById(cleanedModalId);
    if (modal) {
        modal.classList.add('active');
        saveActiveModalState(cleanedModalId);
        
        if (cleanedModalId === 'modalListaClientes') {
            console.log('Chamando preencherTabelaClientes');
            preencherTabelaClientes();
        }
        else if (cleanedModalId === 'modalAgendamentosAtrasados') {
            console.log('Chamando preencherTabelaAtrasados');
            preencherTabelaAtrasados();
        }
        
        console.log(`Modal com ID: ${cleanedModalId} aberto com sucesso`);
    } else {
        console.error(`Modal com ID: ${cleanedModalId} não encontrado`);
    }
}

// USO UNIVERSAL: Abre um sub-modal
function openSubModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    console.log(`Tentando abrir o sub-modal com ID: ${cleanedModalId}`);

    document.querySelectorAll('.modal-sec.active').forEach(modalSec => {
        if (modalSec.id !== cleanedModalId) {
            modalSec.classList.remove('active');
            console.log(`Fechando sub-modal: ${modalSec.id}`);
        }
    });

    const subModal = document.getElementById(cleanedModalId);
    if (subModal) {
        subModal.classList.add('active');
        console.log(`Sub-modal com ID: ${cleanedModalId} aberto com sucesso`);
    } else {
        console.error(`Sub-modal com ID: ${cleanedModalId} não encontrado`);
    }
}

// USO UNIVERSAL: Fecha todos os modais ativos
function closeAllModals(forceClose = false) {
    if (!forceClose) {
        return;
    }
    
    document.querySelectorAll('.modal.active').forEach(modal => {
        console.log(`Fechando modal com ID: ${modal.id}`);
        modal.classList.remove('active');
    });
    saveActiveModalState(null);
}

// USO UNIVERSAL: Fecha um modal específico
function fecharModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    const modal = document.getElementById(cleanedModalId);
    
    if (modal) {
        modal.classList.remove('active');
        console.log(`Modal com ID: ${cleanedModalId} fechado com sucesso`);
        saveActiveModalState(null);
    } else {
        console.error(`Modal com ID: ${cleanedModalId} não encontrado`);
    }
}

// USO UNIVERSAL: Abre modal com opções
function abrirModalOptions(modalId) {
    console.log(`Tentando abrir modal via options: ${modalId}`);
    
    document.querySelectorAll('.modal.active, .modal-sec.active').forEach(modal => {
        if (modal.id !== modalId.replace('#', '')) {
            modal.classList.remove('active');
            console.log(`Fechando modal: ${modal.id}`);
        }
    });

    openModal(modalId);
}

// USO UNIVERSAL: Abre sub-modal com dados específicos
function abrirSubModal(modalId, tipoModal, id) {
    console.log(`Abrindo sub-modal com ID: ${modalId}, tipo: ${tipoModal}, ID do agendamento: ${id}`);

    openSubModal(modalId);
    const subModal = document.getElementById(modalId.replace('#', ''));
    
    if (tipoModal === 'importcsv') {
        preencherDadosImportCSV(subModal, id);
    } else if (subModal) {
        preencherDadosSubModal(subModal, tipoModal, id);
    } else {
        console.error(`Sub-modal com ID: ${modalId} não encontrado`);
    }
}
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

// USO UNIVERSAL: Preenche dados em sub-modais
function preencherDadosSubModal(subModal, tipoModal, id) {
    console.log("Iniciando preenchimento do sub-modal para ID:", id);

    // Declaramos agendamentosEdicao como objeto vazio
    let agendamentosEdicao = null;

    if (tipoModal === 'listaClientes') {
        const dados = todosAgendamentos.find(c => c.id === id);

        if (!id || id === 'undefined' || !dados) {
            console.error(`ID inválido ou cliente com ID ${id} não encontrado em todosAgendamentos`);
            return;
        }

        console.log("Dados do cliente:", dados);

        try {
            const agendamentoId = subModal.querySelector('#agendamentoId');
            if (agendamentoId) {
                agendamentoId.value = dados.id;
                console.log(`Agendamento ID preenchido com: ${dados.id}`);
            }

            const campos = {
                '#nomeCliente': dados.nome_cliente,
                '#cpfCliente': dados.cpf_cliente,
                '#numeroCliente': dados.numero_cliente,
                '#diaAgendado': dados.dia_agendado,
                '#tabulacaoAtendente': dados.tabulacao_atendente,
                '#atendenteAgendou': dados.atendente_nome,
                '#lojaAgendada': dados.loja_nome
            };

            Object.entries(campos).forEach(([selector, valor]) => {
                const elemento = subModal.querySelector(selector);
                if (elemento) {
                    elemento.value = valor || '';
                    console.log(`Campo ${selector} preenchido com: ${valor}`);
                } else {
                    console.warn(`Elemento ${selector} não encontrado no modal`);
                }
            });

            const vendedorSelect = subModal.querySelector('#vendedorLoja');
            if (vendedorSelect) {
                vendedorSelect.innerHTML = '<option value="">Selecione um vendedor</option>';
                preencherSelectVendedores(vendedorSelect);
                
                if (dados.vendedorLoja) {
                    vendedorSelect.value = dados.vendedorLoja;
                    console.log(`Vendedor selecionado: ${dados.vendedorLoja}`);
                }
            } else {
                console.warn('Select de vendedores não encontrado');
            }

            const tabulacaoVendedor = subModal.querySelector('#tabulacaoVendedor');
            const observacaoVendedor = subModal.querySelector('#observacaoVendedor');
            const observacaoContainer = subModal.querySelector('#observacaoVendedorContainer');
            const fechouNegocioContainer = subModal.querySelector('#fechouNegocioContainer');

            if (tabulacaoVendedor && dados.tabulacaoVendedor) {
                tabulacaoVendedor.value = dados.tabulacaoVendedor;
                console.log(`Tabulação do vendedor: ${dados.tabulacaoVendedor}`);

                if (dados.tabulacaoVendedor === 'FECHOU NEGOCIO') {
                    fechouNegocioContainer.style.display = 'block';
                    observacaoContainer.style.display = 'block';
                } else if (dados.tabulacaoVendedor) {
                    observacaoContainer.style.display = 'block';
                }

                if (observacaoVendedor && dados.observacaoVendedor) {
                    observacaoVendedor.value = dados.observacaoVendedor;
                }
            }

        } catch (error) {
            console.error('Erro ao preencher dados do sub-modal:', error);
        }
    } else if (tipoModal === 'confirmacao') {
        // Verifica se todosAgendamentos está carregado
        if (!todosAgendamentos || todosAgendamentos.length === 0) {
            console.error("todosAgendamentos ainda não foi carregado.");
            return;
        }
    
        // Convertendo o ID para string para garantir a comparação correta
        const idExistente = todosAgendamentos.find(agendamento => agendamento.id === String(id));
    
        if (idExistente) {
            console.log('Dados do agendamento encontrados:', idExistente);
            agendamentosEdicao = idExistente;
    
            subModal.querySelector('#idAgendamentoConfirmacao').value = id;
            subModal.querySelector('#nomeClienteConfirmacao').value = agendamentosEdicao.nome_cliente;
            subModal.querySelector('#diaAgendadoConfirmacao').value = agendamentosEdicao.dia_agendado;
            subModal.querySelector('#numeroClienteConfirmacao').value = agendamentosEdicao.numero_cliente;
            subModal.querySelector('#lojaAgendadaConfirmacao').value = agendamentosEdicao.loja_nome;
            subModal.querySelector('#tabulacaoAtendente').value = agendamentosEdicao.tabulacao_atendente;
    
            console.log('ID do agendamento definido:', id);
        } else {
            console.error(`ID inválido ou agendamento com ID ${id} não encontrado`);
            return;
        }
    }
    
}

------------
// USO INSS: Preenche tabela de clientes
function preencherTabelaClientes() {
    console.log('Iniciando preenchimento da tabela de clientes');
    
    const $tabela = $('#modalListaClientes #tabelaClientesLoja tbody');
    
    if (!$tabela.length) {
        console.error('Tabela não encontrada!');
        return;
    }
    
    $tabela.empty();
    console.log('Tabela limpa');

    clientesLoja.forEach(cliente => {
        const nomeElement = `<button type="button" class="btn-link abrir-sub-modal" 
            onclick="abrirSubModal('#modalEdicaoCliente', 'listaClientes', '${cliente.id}')">
            ${cliente.nome_cliente}
        </button>`;

        const row = `
            <tr>
                <td>${nomeElement}</td>
                <td>${cliente.cpf_cliente}</td>
                <td>${cliente.numero_cliente}</td>
                <td>${cliente.dia_agendado}</td>
                <td>${cliente.atendente_nome}</td>
                <td>${cliente.loja_nome}</td>
                <td>${cliente.status || 'N/A'}</td>
            </tr>
        `;
        
        $tabela.append(row);
    });
    
    console.log('Preenchimento da tabela concluído');
}

let sortDirection = 'desc';

// USO UNIVERSAL: Converte dados para formato cliente loja
function converterParaFormatoClienteLoja(agendamento) {
    return {
        id: agendamento.id,
        nome: agendamento.nome_cliente,
        cpf: agendamento.cpf_cliente,
        numero: agendamento.numero_cliente,
        diaAgendado: agendamento.dia_agendado,
        diaAgendadoFormatado: agendamento.diaAgendadoFormatado,
        tabulacaoAtendente: agendamento.tabulacao_atendente,
        atendenteAgendou: agendamento.atendente_nome,
        lojaAgendada: agendamento.loja_nome
    };
}
-------------
// USO INSS: Gerencia mudança de tabulação
function handleTabulacaoChange() {
    const modal = document.getElementById('modalConfirmacaoAgendamento');
    const tabulacaoSelect = modal.querySelector('#tabulacaoAtendente');
    const selectedValue = tabulacaoSelect.value;
    
    console.log('Select dropdown:', tabulacaoSelect); 
    console.log('Valor selecionado no dropdown:', selectedValue);
    
    const novaDataContainer = modal.querySelector('#novaDataContainer');
    const observacaoContainer = modal.querySelector('#observacaoContainer');
    
    novaDataContainer.style.display = 'none';
    observacaoContainer.style.display = 'none';
    
    if (selectedValue === 'REAGENDADO') {
        console.log('Campo REAGENDADO selecionado, mostrando campo de nova data.');
        novaDataContainer.style.display = 'block';
    } else if (selectedValue === 'DESISTIU') {
        console.log('Campo DESISTIU selecionado, mostrando campo de observao.');
        observacaoContainer.style.display = 'block';
    } else {
        console.log('Nenhum campo específico foi selecionado.');
    }
}

// USO INSS: Gerencia mudança de tabulação do vendedor
function handleTabulacaoVendedorChange() {
    const modal = document.getElementById('modalEdicaoCliente');
    const tabulacaoSelect = modal.querySelector('#tabulacaoVendedor');
    const selectedValue = tabulacaoSelect.value;
    
    const observacaoContainer = modal.querySelector('#observacaoVendedorContainer');
    const fechouNegocioContainer = modal.querySelector('#fechouNegocioContainer');
    
    observacaoContainer.style.display = 'none';
    fechouNegocioContainer.style.display = 'none';
    
    if (selectedValue === 'FECHOU NEGOCIO') {
        observacaoContainer.style.display = 'block';
        fechouNegocioContainer.style.display = 'block';
    } else if (selectedValue && selectedValue !== '') {
        observacaoContainer.style.display = 'block';
    }
}

// USO UNIVERSAL: Preenche select de vendedores
function preencherSelectVendedores(selectElement) {
    Object.values(vendedoresListaClientes).forEach(vendedor => {
        const option = document.createElement('option');
        option.value = vendedor.id;
        option.textContent = vendedor.nome;
        selectElement.appendChild(option);
    });
}

// USO UNIVERSAL: Event Listeners após carregamento do DOM
document.addEventListener('DOMContentLoaded', function() {
    const mensagensContainer = document.getElementById('mensagens');
    const temMensagemSucesso = mensagensContainer && 
                              mensagensContainer.querySelector('.success');

    document.querySelectorAll('.btn-close').forEach(button => {
        button.addEventListener('click', function() {
            const modalId = this.closest('.modal').id;
            fecharModal(modalId);
        });
    });

    const modalEdicaoCliente = document.getElementById('modalEdicaoCliente');
    if (modalEdicaoCliente) {
        const tabulacaoVendedor = modalEdicaoCliente.querySelector('#tabulacaoVendedor');
        if (tabulacaoVendedor) {
            tabulacaoVendedor.addEventListener('change', handleTabulacaoVendedorChange);
            console.log('Listener adicionado ao select de tabulação do vendedor');
        } else {
            console.error('Select de tabulação do vendedor não encontrado');
        }
    } else {
        console.error('Modal de edição cliente não encontrado');
    }

    document.querySelectorAll('.modal-sec form').forEach(form => {
        form.addEventListener('submit', handleSubModalFormSubmit);
    });

    document.querySelectorAll('.modal-sec .btn-close').forEach(button => {
        button.addEventListener('click', function() {
            const modalId = this.closest('.modal-sec').id;
            closeSubModal(modalId);
        });
    });

    document.querySelectorAll('.modal-sec').forEach(modalSec => {
        modalSec.addEventListener('click', function(event) {
            if (event.target === this) {
                closeSubModal(this.id);
            }
        });
    });

    document.addEventListener('click', function(event) {
        // Verifica se o clique foi fora de um modal-sec
        if (event.target.classList.contains('modal-sec')) {
            return;
        }

        // Se o clique foi fora de um modal, fecha o modal
        if (event.target.classList.contains('modal-sec')) {
            fecharModal(event.target.id);
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            document.querySelectorAll('.modal.active, .modal-sec.active').forEach(modal => {
                fecharModal(modal.id);
            });
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const keepModalId = urlParams.get('keepModal');
    const lastActiveModal = sessionStorage.getItem('lastActiveModal');

    if (keepModalId) {
        console.log(`Restaurando modal específico: ${keepModalId}`);
        openModal(keepModalId);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (lastActiveModal) {
        console.log(`Restaurando último modal ativo: ${lastActiveModal}`);
        openModal(lastActiveModal);
        sessionStorage.removeItem('lastActiveModal');
    }

    // Verifica se deve abrir o modal padrão após reload
    const defaultModal = sessionStorage.getItem('defaultModal');
    if (defaultModal) {
        console.log(`Abrindo modal padrão após reload: ${defaultModal}`);
        openModal(defaultModal);
        sessionStorage.removeItem('defaultModal');
    }

    // Adiciona listener específico para o form de meta
    const formMeta = document.querySelector('form[name="form_type"][value="adicionar_meta"]');
    if (formMeta) {
        formMeta.addEventListener('submit', function(event) {
            event.preventDefault();
            const metaModal = document.getElementById('modalAdicionarMeta');
            if (metaModal) {
                metaModal.classList.remove('active');
                console.log('Modal de meta fechado antes do submit');
            }
            handleSubModalFormSubmit(event);
        });
    }

    // Adiciona listener específico para formulários em modais
    document.querySelectorAll('.modal form, .modal-sec form').forEach(form => {
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            
            // Fecha todos os modais antes do submit
            document.querySelectorAll('.modal.active, .modal-sec.active').forEach(modal => {
                modal.classList.remove('active');
                console.log(`Fechando modal: ${modal.id}`);
            });
            
            handleSubModalFormSubmit(event);
        });
    });
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', handleModalClick);
});

document.getElementById('modalConfirmacaoAgendamento')
    .querySelector('#tabulacaoAtendente')
    .addEventListener('change', handleTabulacaoChange);

// USO UNIVERSAL: Fecha um sub-modal específico
function closeSubModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    const modal = document.getElementById(cleanedModalId);
    
    if (modal && modal.classList.contains('modal-sec')) {
        modal.classList.remove('active');
        console.log(`Sub-modal com ID: ${cleanedModalId} fechado com sucesso`);
    } else {
        console.error(`Sub-modal com ID: ${cleanedModalId} não encontrado ou não é um modal secundário`);
    }
}

// USO UNIVERSAL: Gerencia cliques em modais
function handleModalClick(event) {
    if (event.target.classList.contains('modal-sec')) {
        closeSubModal(event.target.id);
        event.stopPropagation();
    }
}

// USO UNIVERSAL: Gerencia submissão de formulários em sub-modais
function handleSubModalFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formType = form.querySelector('input[name="form_type"]').value;

    console.log(`Processando submit do formulário tipo: ${formType}`);

    // Adicionando os novos tipos de formulário permitidos
    const tiposPermitidos = [
        'criar_campanha', 
        'consulta_cliente', 
        'importar_csv', 
        'adicionar_registro', 
        'adicionar_meta', 
        'alterar_status_meta', 
        'excluir_registro', 
        'agendamento', 
        'status_tac', 
        'lista_clientes', 
        'confirmacao_agendamento',
        'delete_funcionario', 
        'criar_horario', 
        'excluir_cargo', 
        'criar_cargo', 
        'criar_departamento', 
        'delete_loja', 
        'criar_loja', 
        'criar_empresa', 
        'associar_grupos', 
        'cadastrar_usuario', 
        'cadastro_funcionario',
        'importar_csv_money',
        'importar_situacao',
        'cliente_rua'
    ];

    // Se o tipo de formulário estiver na lista permitida, permite o submit normal
    if (tiposPermitidos.includes(formType)) {
        console.log(`Submetendo formulário de ${formType} normalmente.`);
        form.submit(); // Permite o submit padrão
        return; // Sai da função
    }

    // Fecha todos os modais antes do submit
    document.querySelectorAll('.modal.active, .modal-sec.active').forEach(modal => {
        modal.classList.remove('active');
        console.log(`Fechando modal: ${modal.id}`);
    });

    // Limpa todos os estados salvos
    sessionStorage.removeItem('activeModal');
    sessionStorage.removeItem('lastActiveModal');
    sessionStorage.removeItem('defaultModal');

    // Define a URL correta com base no tipo de formulário
    let url;
    if (formType === 'update_funcionario' || formType === 'update_user') {
        url = form.action; // A URL já está definida no action do formulário
    } else {
        console.error('Tipo de formulário não reconhecido:', formType);
        return; // Sai da função se o tipo não for reconhecido
    }

    $.ajax({
        url: url,
        method: form.method,
        data: new FormData(form),
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('Formulário enviado com sucesso');
            // Lógica de sucesso
        },
        error: function(xhr, status, error) {
            console.error('Erro ao enviar formulário:', error);
            mostrarMensagem('Erro ao processar formulário', 'error');
        }
    });
}
---------
// USO INSS: Atualiza status do TAC
function atualizarStatusTAC(selectElement, agendamentoId) {
    const novoStatus = selectElement.value;
    if (!novoStatus) return;

    const row = $(selectElement).closest('tr');
    const statusCell = row.find('.status-tac');

    $.ajax({
        url: '/inss/atualizar_status_tac/',
        method: 'POST',
        data: {
            agendamento_id: agendamentoId,
            status: novoStatus,
            csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
        },
        success: function(response) {
            if (response.success) {
                statusCell.text(novoStatus);
                
                mostrarMensagem('Status atualizado com sucesso!', 'success');
                
                if (novoStatus === 'PAGO') {
                    row.addClass('tac-pago');
                } else {
                    row.removeClass('tac-pago');
                }
            } else {
                mostrarMensagem('Erro ao atualizar status: ' + response.error, 'error');
                $(selectElement).val(statusCell.text());
            }
        },
        error: function() {
            mostrarMensagem('Erro ao comunicar com o servidor', 'error');
            $(selectElement).val(statusCell.text());
        }
    });
}

// USO UNIVERSAL: Exibe mensagens temporárias
function mostrarMensagem(texto, tipo) {
    const mensagem = $(`<div class="alert alert-${tipo}">${texto}</div>`);
    $('#mensagens').append(mensagem);
    setTimeout(() => mensagem.fadeOut('slow', function() { $(this).remove(); }), 3000);
}

// USO UNIVERSAL: Fecha um sub-modal
function fecharSubModal(modalId) {
    const cleanedModalId = modalId.replace('#', '');
    const subModal = document.getElementById(cleanedModalId);
    
    if (subModal) {
        subModal.classList.remove('active');
        console.log(`Sub-modal com ID: ${cleanedModalId} fechado com sucesso`);
    } else {
        console.error(`Sub-modal com ID: ${cleanedModalId} não encontrado`);
    }
}
---------------
// USO INSS: Preenche tabela de agendamentos atrasados
function preencherTabelaAtrasados() {
    console.log('Iniciando preenchimento da tabela de agendamentos atrasados');
    
    // Corrigir o seletor da tabela para incluir o ID correto
    const $tabela = $('#modalAgendamentosAtrasados .wp-style-table tbody');
    
    if (!$tabela.length) {
        console.error('Tabela de atrasados não encontrada!');
        return;
    }
    
    $tabela.empty();
    console.log('Tabela de atrasados limpa');

    if (!agendamentosAtrasados || agendamentosAtrasados.length === 0) {
        $tabela.append(`
            <tr>
                <td colspan="6" class="text-center">Nenhum cliente atrasado encontrado</td>
            </tr>
        `);
        return;
    }

    agendamentosAtrasados.forEach(agendamento => {
        // Garantir que os campos correspondam exatamente aos do dicionário
        const row = `
            <tr>
                <td>${agendamento.nome_cliente || ''}</td>
                <td>${agendamento.cpf_cliente || ''}</td>
                <td>${agendamento.numero_cliente || ''}</td>
                <td data-date="${agendamento.dia_agendado || ''}">${agendamento.dia_agendado || ''}</td>
                <td>${agendamento.atendente_nome || ''}</td>
                <td>${agendamento.loja_nome || ''}</td>
            </tr>
        `;
        
        $tabela.append(row);
    });
    
    console.log('Preenchimento da tabela de atrasados concluído');
}

// USO UNIVERSAL: Event Listeners jQuery
$(document).ready(function() {

    // Função para filtrar a tabela de todos os agendamentos
    function filtrarTabelaTodosAgendamentos() {
        var nome = $("#modalTodosAgendamentos #filtroNome").val().toLowerCase();
        var cpf = $("#modalTodosAgendamentos #filtroCPF").val().toLowerCase();
        var dia = $("#modalTodosAgendamentos #filtroData").val();
        var atendente = $("#modalTodosAgendamentos #filtroAtendente").val().toLowerCase();
        var loja = $("#modalTodosAgendamentos #filtroLoja").val().toLowerCase();

        $("#tabelaTodosAgendamentos tbody tr").each(function() {
            var row = $(this);
            var nomeCliente = row.find("button").text().toLowerCase();
            var cpfCliente = row.find("td:nth-child(2)").text().toLowerCase();
            var diaAgendado = row.find("td[data-date]").attr("data-date");
            var atendenteTexto = row.find("td:nth-child(5)").text().toLowerCase();
            var lojaTexto = row.find("td:nth-child(6)").text().toLowerCase();

            var matchNome = nomeCliente.includes(nome);
            var matchCPF = cpfCliente.includes(cpf);
            var matchDia = !dia || diaAgendado === dia;
            var matchAtendente = atendenteTexto.includes(atendente);
            var matchLoja = lojaTexto.includes(loja);

            if (matchNome && matchCPF && matchDia && matchAtendente && matchLoja) {
                row.show();
            } else {
                row.hide();
            }
        });

        var temResultados = $("#tabelaTodosAgendamentos tbody tr:visible").length > 0;
        if (!temResultados) {
            if (!$("#tabelaTodosAgendamentos tbody tr.sem-resultados").length) {
                $("#tabelaTodosAgendamentos tbody").append(
                    '<tr class="sem-resultados"><td colspan="8" class="text-center">Nenhum agendamento encontrado</td></tr>'
                );
            }
            $("#tabelaTodosAgendamentos tbody tr.sem-resultados").show();
        } else {
            $("#tabelaTodosAgendamentos tbody tr.sem-resultados").remove();
        }
    }

    // Função para filtrar a tabela de agendamentos
    function filtrarTabelaAgendamentos() {
        var nome = $("#filtroNome").val().toLowerCase();
        var dia = $("#filtroDia").val();
        var atendente = $("#filtroAtendente").val().toLowerCase();
        var loja = $("#filtroLoja").val().toLowerCase();
        var status = $("#filtroStatus").val().toLowerCase();

        $("#tabelaAgendamentos tr.linha-agendamento").each(function() {
            var row = $(this);
            var nomeCliente = row.find("button").text().toLowerCase();
            var diaAgendado = row.find("td[data-dia]").text().trim();
            var atendenteTexto = row.find("td:nth-child(4)").text().toLowerCase();
            var lojaTexto = row.find("td:nth-child(5)").text().toLowerCase();
            var statusTexto = row.find("td:nth-child(6)").text().toLowerCase();

            var matchNome = nomeCliente.includes(nome);
            var matchDia = !dia || (diaAgendado && diaAgendado.includes(dia));
            var matchAtendente = atendenteTexto.includes(atendente);
            var matchLoja = lojaTexto.includes(loja);
            var matchStatus = statusTexto.includes(status);

            if (matchNome && matchDia && matchAtendente && matchLoja && matchStatus) {
                row.show();
            } else {
                row.hide();
            }
        });

        var temResultados = $("#tabelaAgendamentos tr.linha-agendamento:visible").length > 0;
        $("#nenhumResultado").toggle(!temResultados);
    }

    // Função para filtrar a tabela TAC
    function filtrarTabelaTAC() {
        var nome = $("#filtroNomeTAC").val().toLowerCase();
        var cpf = $("#filtroCPFTAC").val().toLowerCase();
        var status = $("#filtroStatusTAC").val().toLowerCase();

        $("#modalAgendamentosTAC .tac-row").each(function() {
            var row = $(this);
            var nomeCliente = row.find(".td-nome").text().toLowerCase();
            var cpfCliente = row.find(".td-cpf").text().toLowerCase();
            var statusCliente = row.find(".td-status .status-badge").text().toLowerCase();

            var matchNome = nomeCliente.includes(nome);
            var matchCPF = cpfCliente.includes(cpf);
            var matchStatus = status === "" || statusCliente === status;

            if (matchNome && matchCPF && matchStatus) {
                row.show();
            } else {
                row.hide();
            }
        });
    }

    // Event listeners para todos os agendamentos
    $("#modalTodosAgendamentos #filtroNome, #modalTodosAgendamentos #filtroCPF, #modalTodosAgendamentos #filtroAtendente, #modalTodosAgendamentos #filtroLoja").on("keyup change", filtrarTabelaTodosAgendamentos);
    $("#modalTodosAgendamentos #filtroData").on("change", filtrarTabelaTodosAgendamentos);

    // Event listeners para agendamentos
    $("#filtroNome, #filtroAtendente, #filtroLoja, #filtroStatus").on("keyup change", filtrarTabelaAgendamentos);
    $("#filtroDia").on("change", filtrarTabelaAgendamentos);

    // Event listeners para TAC
    $("#filtroNomeTAC, #filtroCPFTAC, #filtroStatusTAC").on("keyup change", filtrarTabelaTAC);

    // Limpar filtros ao fechar modais
    $("#modalTodosAgendamentos").on("hidden.bs.modal", function() {
        $("#modalTodosAgendamentos #filtroNome, #modalTodosAgendamentos #filtroCPF, #modalTodosAgendamentos #filtroData, #modalTodosAgendamentos #filtroAtendente, #modalTodosAgendamentos #filtroLoja").val("");
        filtrarTabelaTodosAgendamentos();
    });

    $("#modalConfiAgendamentoTabela").on("hidden.bs.modal", function() {
        $("#filtroNome, #filtroDia, #filtroAtendente, #filtroLoja, #filtroStatus").val("");
        filtrarTabelaAgendamentos();
    });

    
});