// Função para abrir modal de adicionar ação
window.abrirModalAdicionarAcao = function(cliente) {
    console.log('[LOJA] Abrindo modal adicionar ação com dados:', cliente);
    
    // Garantir que o ID do agendamento seja passado corretamente
    const agendamentoId = cliente.id_agendamento;
    if (!agendamentoId) {
        console.error('[LOJA] ID do agendamento não encontrado');
        return;
    }

    // Preencher campos do formulário
    $('#agendamentoIdAcao').val(agendamentoId);
    $('#nomeClienteAcao').val(cliente.nome || '');
    $('#cpfClienteAcao').val(cliente.cpf || '');
    $('#numeroClienteAcao').val(cliente.numero || '');
    $('#diaAgendadoAcao').val(cliente.dia_agendado || '');
    $('#lojaAgendadaAcao').val(cliente.loja || '');
    $('#atendenteAgendouAcao').val(cliente.atendente || '');
    
    // Carregar vendedores para o select
    carregarVendedoresParaAcao(cliente.loja_id || cliente.loja);

    // Abrir o modal
    const modalElement = document.getElementById('modalAdicionarAcao');
    if (modalElement) {
        const modalInstance = new bootstrap.Modal(modalElement);
        modalInstance.show();
    } else {
        console.error('[LOJA] Modal não encontrado');
    }
};

// Função para carregar vendedores no select do modal de adicionar ação
function carregarVendedoresParaAcao(lojaId) {
    console.log('[LOJA] Carregando vendedores para ação, loja:', lojaId);
    const vendedorSelect = $('#vendedor_acao');
    
    if (vendedorSelect.length === 0) {
        console.warn('[LOJA] Select de vendedor não encontrado');
        return;
    }
    
    vendedorSelect.empty().append('<option value="">Carregando vendedores...</option>');
    
    // Parâmetros para a API
    const params = lojaId ? { loja_id: lojaId } : {};
    
    $.ajax({
        url: '/inss/api/get/info-loja-funcionario/',
        type: 'GET',
        dataType: 'json',
        data: params,
        success: function(response) {
            console.log('[LOJA] Resposta vendedores:', response);
            vendedorSelect.empty().append('<option value="">Selecione um vendedor</option>');
            
            if (response.funcionarios) {
                const funcionariosArray = Object.values(response.funcionarios);
                funcionariosArray.sort((a, b) => a.nome.localeCompare(b.nome));
                
                funcionariosArray.forEach(function(funcionario) {
                    vendedorSelect.append(`<option value="${funcionario.id}">${funcionario.nome}</option>`);
                });
                console.log('[LOJA] Vendedores carregados com sucesso');
            } else {
                console.warn('[LOJA] Nenhum funcionário retornado pela API');
            }
        },
        error: function(xhr, status, error) {
            console.error('[LOJA] Erro ao carregar vendedores:', error);
            vendedorSelect.empty().append('<option value="">Erro ao carregar vendedores</option>');
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Mapeamento label → key conforme TextChoices do model
    const tabMap = {
        'NEGÓCIO FECHADO': 'NEGOCIO_FECHADO',
        'INELEGÍVEL': 'INELEGIVEL',
        'NÃO ACEITOU': 'NAO_ACEITOU', 
        'NÃO QUIS OUVIR': 'NAO_QUIS_OUVIR',
        'PENDENTE': 'PENDENTE'
    };

    // --- INICIALIZAÇÃO DE MODAIS ---
    if (typeof bootstrap !== 'undefined') {
        const modais = document.querySelectorAll('.modal-sec');
        modais.forEach(modalEl => {
            const modalOptions = {
                backdrop: 'static',
                keyboard: false
            };
            new bootstrap.Modal(modalEl, modalOptions);
        });
        console.log('[LOJA] Modais inicializados com Bootstrap');
    } else {
        console.log('[LOJA] Bootstrap não detectado, usando inicialização manual para modais');
        document.querySelectorAll('.modal-sec').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    window.fecharModal('#' + this.id);
                }
            });
        });
    }

    // --- MÁSCARAS ---
    $('#cpf_cliente_rua_inline').mask('000.000.000-00');
    $('#numero_cliente_rua_inline').mask('(00) 0 0000-0000');

    // --- FUNÇÃO AUXILIAR PARA FORMATAR NÚMERO DE TELEFONE ---
    function formatarNumeroTelefone(numero) {
        if (!numero) return '';
        const numeroLimpo = numero.toString().replace(/\D/g, '');
        const tamanho = numeroLimpo.length;

        if (tamanho === 11) {
            return `(${numeroLimpo.substring(0, 2)}) ${numeroLimpo.substring(2, 3)} ${numeroLimpo.substring(3, 7)}-${numeroLimpo.substring(7)}`;
        } else if (tamanho === 10) {
            return `(${numeroLimpo.substring(0, 2)}) ${numeroLimpo.substring(2, 6)}-${numeroLimpo.substring(6)}`;
        } else {
            return numero;
        }
    }

    // --- FUNÇÕES PARA CARREGAR TABELAS ---
    window.carregarAgendadosHoje = function() {
        console.log('[LOJA] Carregando agendados para hoje...');
        $.ajax({
            url: '/inss/api/get/agendadosHoje/',
            type: 'GET',
            success: function(response) {
                console.log('[LOJA] Resposta agendados hoje:', response);
                const tbody = $('#tabelaClientesHoje tbody');
                tbody.empty();
                
                const agendamentos = response.agendamentos || [];
                
                if (agendamentos.length === 0) {
                    $('#nenhumResultadoClientesHoje').show();
                    return;
                }
                
                $('#nenhumResultadoClientesHoje').hide();
                agendamentos.forEach(function(cliente) {
                    const row = `
                        <tr>
                            <td>${cliente.nome || ''}</td>
                            <td>${cliente.cpf || ''}</td>
                            <td>${formatarNumeroTelefone(cliente.numero || '')}</td>
                            <td>${cliente.dia_agendado || ''}</td>
                            <td>${cliente.atendente || ''}</td>
                            <td>${cliente.status || ''}</td>
                            <td>${cliente.loja || ''}</td>
                            <td class="text-center">
                                <button class="btn btn-primary btn-sm me-1" title="Editar Atendimento" onclick="abrirModalEdicao(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
                                    <i class='bx bx-edit'></i>
                                </button>
                                <button class="btn btn-info btn-sm me-1" title="Adicionar Ação Judicial" onclick="abrirModalAdicionarAcao(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
                                    <i class='bx bx-file'></i>
                                </button>
                                <button class="btn btn-success btn-sm" title="Finalizar Atendimento" onclick="finalizarAtendimentoCliente(${cliente.id_agendamento})">
                                    <i class='bx bx-check-circle'></i>
                                </button>
                            </td>
                        </tr>
                        `;
                    tbody.append(row);
                });
            },
            error: function(xhr, status, error) {
                console.error('[LOJA] Erro ao carregar agendados para hoje:', error);
                $('#nenhumResultadoClientesHoje').show();
            }
        });
    }
    
    window.carregarAgendamentosPendentes = function() {
        console.log('[LOJA] Carregando agendamentos pendentes...');
        $.ajax({
            url: '/inss/api/get/agendPendentes/',
            type: 'GET',
            success: function(response) {
                console.log('[LOJA] Resposta agendamentos pendentes:', response);
                const tbody = $('#tabelaAgendamentosPendentes tbody');
                tbody.empty();
                
                const agendamentos = response.agendamentos || [];
                
                if (agendamentos.length === 0) {
                    $('#nenhumResultadoAgendPendentes').show();
                    return;
                }
                
                $('#nenhumResultadoAgendPendentes').hide();
                agendamentos.forEach(function(cliente) {
                    const row = `
                        <tr>
                            <td>${cliente.cliente_agendamento_nome || ''}</td>
                            <td>${cliente.cliente_agendamento_cpf || ''}</td>
                            <td>${formatarNumeroTelefone(cliente.cliente_agendamento_numero || '')}</td>
                            <td>${cliente.agendamento_dia || ''}</td>
                            <td>${cliente.agendamento_atendente_nome || ''}</td>
                            <td>${cliente.agendamento_tabulacao || ''}</td>
                            <td>${cliente.agendamento_loja_nome || ''}</td>
                            <td class="text-center">
                                <button class="btn btn-primary btn-sm me-1" title="Editar Atendimento" onclick="abrirModalEdicao(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
                                    <i class='bx bx-edit'></i>
                                </button>
                                <button class="btn btn-info btn-sm me-1" title="Adicionar Ação Judicial" onclick="abrirModalAdicionarAcao(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
                                    <i class='bx bx-file'></i>
                                </button>
                                <button class="btn btn-success btn-sm" title="Finalizar Atendimento" onclick="finalizarAtendimentoCliente(${cliente.agendamento_id})">
                                    <i class='bx bx-check-circle'></i>
                                </button>
                            </td>
                        </tr>
                        `;
                    tbody.append(row);
                });
            },
            error: function(xhr, status, error) {
                console.error('[LOJA] Erro ao carregar agendamentos pendentes:', error);
                $('#nenhumResultadoAgendPendentes').show();
            }
        });
    }
    
    window.carregarClientesNaoPresentes = function() {
        console.log('[LOJA] Carregando clientes não presentes...');
        $.ajax({
            url: '/inss/api/get/clientesAtrasadoLoja/',
            type: 'GET',
            success: function(response) {
                console.log('[LOJA] Resposta clientes não presentes:', response);
                const tbody = $('#tabelaClientesNaoPresentes tbody');
                tbody.empty();
                
                const agendamentos = response.agendamentos || [];
                
                if (agendamentos.length === 0) {
                    $('#nenhumResultadoClientesNaoPresentes').show();
                    return;
                }
                
                $('#nenhumResultadoClientesNaoPresentes').hide();
                agendamentos.forEach(function(cliente) {
                    const row = `
                        <tr>
                            <td>${cliente.nome || ''}</td>
                            <td>${cliente.cpf || ''}</td>
                            <td>${formatarNumeroTelefone(cliente.numero || '')}</td>
                            <td>${cliente.dia_agendado || ''}</td>
                            <td>${cliente.atendente || ''}</td>
                            <td>${cliente.status || ''}</td>
                            <td>${cliente.loja || ''}</td>
                            <td class="text-center">
                                <button class="btn btn-primary btn-sm me-1" title="Editar Atendimento" onclick="abrirModalEdicao(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
                                    <i class='bx bx-edit'></i>
                                </button>
                                <button class="btn btn-info btn-sm me-1" title="Adicionar Ação Judicial" onclick="abrirModalAdicionarAcao(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">
                                    <i class='bx bx-file'></i>
                                </button>
                                <button class="btn btn-success btn-sm" title="Finalizar Atendimento" onclick="finalizarAtendimentoCliente(${cliente.id_agendamento})">
                                    <i class='bx bx-check-circle'></i>
                                </button>
                            </td>
                        </tr>
                        `;
                    tbody.append(row);
                });
            },
            error: function(xhr, status, error) {
                console.error('[LOJA] Erro ao carregar clientes não presentes:', error);
                $('#nenhumResultadoClientesNaoPresentes').show();
            }
        });
    }

    // --- INICIALIZAÇÃO DAS TABELAS ---
    carregarAgendadosHoje();
    carregarAgendamentosPendentes();
    carregarClientesNaoPresentes();

    // --- FILTROS DAS TABELAS ---
    $('#filtroNomeClientesHoje, #filtroCPFClientesHoje, #filtroAtendenteClientesHoje, #filtroStatusClientesHoje').on('input', function() {
        const filtroNome = $('#filtroNomeClientesHoje').val().toLowerCase();
        const filtroCPF = $('#filtroCPFClientesHoje').val().toLowerCase();
        const filtroAtendente = $('#filtroAtendenteClientesHoje').val().toLowerCase();
        const filtroStatus = $('#filtroStatusClientesHoje').val().toLowerCase();

        $('#tabelaClientesHoje tbody tr').each(function() {
            const nome = $(this).find('td:eq(0)').text().toLowerCase();
            const cpf = $(this).find('td:eq(1)').text().toLowerCase();
            const atendente = $(this).find('td:eq(4)').text().toLowerCase();
            const status = $(this).find('td:eq(5)').text().toLowerCase();

            const nomeMatch = nome.includes(filtroNome);
            const cpfMatch = cpf.includes(filtroCPF);
            const atendenteMatch = atendente.includes(filtroAtendente);
            const statusMatch = status.includes(filtroStatus);

            if (nomeMatch && cpfMatch && atendenteMatch && statusMatch) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        const temResultados = $('#tabelaClientesHoje tbody tr:visible').length > 0;
        $('#nenhumResultadoClientesHoje').toggle(!temResultados);
    });

    // Filtros para Agendamentos Pendentes
    $('#filtroNomeAgendPendentes, #filtroCPFAgendPendentes, #filtroAtendenteAgendPendentes, #filtroStatusAgendPendentes').on('input', function() {
        const filtroNome = $('#filtroNomeAgendPendentes').val().toLowerCase();
        const filtroCPF = $('#filtroCPFAgendPendentes').val().toLowerCase();
        const filtroAtendente = $('#filtroAtendenteAgendPendentes').val().toLowerCase();
        const filtroStatus = $('#filtroStatusAgendPendentes').val().toLowerCase();

        $('#tabelaAgendamentosPendentes tbody tr').each(function() {
            const nome = $(this).find('td:eq(0)').text().toLowerCase();
            const cpf = $(this).find('td:eq(1)').text().toLowerCase();
            const atendente = $(this).find('td:eq(4)').text().toLowerCase();
            const status = $(this).find('td:eq(5)').text().toLowerCase();

            const nomeMatch = nome.includes(filtroNome);
            const cpfMatch = cpf.includes(filtroCPF);
            const atendenteMatch = atendente.includes(filtroAtendente);
            const statusMatch = status.includes(filtroStatus);

            if (nomeMatch && cpfMatch && atendenteMatch && statusMatch) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        const temResultados = $('#tabelaAgendamentosPendentes tbody tr:visible').length > 0;
        $('#nenhumResultadoAgendPendentes').toggle(!temResultados);
    });

    // Filtros para Clientes Que Não Compareceram
    $('#filtroNomeClientesNaoPresentes, #filtroCPFClientesNaoPresentes, #filtroAtendenteClientesNaoPresentes, #filtroStatusClientesNaoPresentes').on('input', function() {
        const filtroNome = $('#filtroNomeClientesNaoPresentes').val().toLowerCase();
        const filtroCPF = $('#filtroCPFClientesNaoPresentes').val().toLowerCase();
        const filtroAtendente = $('#filtroAtendenteClientesNaoPresentes').val().toLowerCase();
        const filtroStatus = $('#filtroStatusClientesNaoPresentes').val().toLowerCase();

        $('#tabelaClientesNaoPresentes tbody tr').each(function() {
            const nome = $(this).find('td:eq(0)').text().toLowerCase();
            const cpf = $(this).find('td:eq(1)').text().toLowerCase();
            const atendente = $(this).find('td:eq(4)').text().toLowerCase();
            const status = $(this).find('td:eq(5)').text().toLowerCase();

            const nomeMatch = nome.includes(filtroNome);
            const cpfMatch = cpf.includes(filtroCPF);
            const atendenteMatch = atendente.includes(filtroAtendente);
            const statusMatch = status.includes(filtroStatus);

            if (nomeMatch && cpfMatch && atendenteMatch && statusMatch) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });

        const temResultados = $('#tabelaClientesNaoPresentes tbody tr:visible').length > 0;
        $('#nenhumResultadoClientesNaoPresentes').toggle(!temResultados);
    });

    // Repita o mesmo padrão para as outras tabelas...
});

// Função para finalizar o atendimento do cliente
function finalizarAtendimentoCliente(agendamentoId) {
    if (!agendamentoId) {
        Swal.fire('Erro!', 'ID do agendamento não fornecido', 'error');
        return;
    }

    Swal.fire({
        title: 'Finalizar Atendimento',
        text: 'Tem certeza que deseja finalizar este atendimento?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sim, finalizar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33'
    }).then((result) => {
        if (result.isConfirmed) {
            // Mostrar loading
            Swal.fire({
                title: 'Processando...',
                text: 'Finalizando o atendimento',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Enviar requisição para finalizar o atendimento
            const formData = new FormData();
            formData.append('agendamento_id', agendamentoId);

            $.ajax({
                url: '/inss/api/post/finalizaratendimento/',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function(response) {
                    if (response.status === 'success') {
                        Swal.fire({
                            icon: 'success',
                            title: 'Sucesso!',
                            text: response.message || 'Atendimento finalizado com sucesso!',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        
                        // Recarregar as tabelas para atualizar os dados
                        carregarAgendadosHoje();
                        carregarAgendamentosPendentes();
                        carregarClientesNaoPresentes();
                    } else {
                        Swal.fire('Erro!', response.message || 'Não foi possível finalizar o atendimento.', 'error');
                    }
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.message || xhr.responseJSON?.error || 'Erro ao processar a solicitação.';
                    Swal.fire('Erro de Servidor!', errorMsg, 'error');
                }
            });
        }
    });
}

$(document).ready(function() {
    // Comentário para indicar que a funcionalidade foi movida
    // A funcionalidade de adicionar ação foi movida para loja-edicao.js
    
    // Manter inicialização de máscaras e outros elementos não relacionados ao modal
    $('#acao_cpf_cliente').mask('000.000.000-00');
    $('#acao_numero_cliente').mask('(00) 00000-0000');
    
    // Inicialização de elementos que ainda são necessários
    const documentosContainer = $('#acao_documentos_container');
    let docIndexAcao = 0;

    // Adicionar bloco de documento
    $('#acao_btn_add_documento').on('click', function() {
        const template = $('#acaoDocumentoTemplate').html();
        const novoDocumentoHtml = template.replace(/__DOC_INDEX__/g, docIndexAcao);
        documentosContainer.append(novoDocumentoHtml);
        // Reaplicar máscaras se necessário para campos futuros no template de documento
        docIndexAcao++;
    });

    // Remover bloco de documento
    documentosContainer.on('click', '.acao_btn_remove_documento', function() {
        $(this).closest('.documento-item-acao').remove();
        // Re-indexar não é estritamente necessário se o backend processa os índices como vêm
    });

    // Mostrar/ocultar campos de pagamento
    $('#acao_tipo_pagamento').on('change', function() {
        const tipo = $(this).val();
        const detalhesContainer = $('#acao_detalhes_pagamento_container');
        const valorTotalContainer = $('#acao_valor_total_container');
        const parceladoContainer = $('#acao_parcelado_container');

        // Resetar required e visibilidade
        valorTotalContainer.find('input').prop('required', false);
        parceladoContainer.find('input').prop('required', false);
        valorTotalContainer.hide();
        parceladoContainer.hide();
        detalhesContainer.hide();

        if (tipo === 'A_VISTA') {
            valorTotalContainer.show();
            valorTotalContainer.find('input').prop('required', true);
            detalhesContainer.show();
        } else if (tipo === 'PARCELADO') {
            parceladoContainer.show();
            parceladoContainer.find('input').prop('required', true);
            detalhesContainer.show();
        }
    });

    // Submissão do formulário
    $('#formAdicionarAcao').on('submit', function(e) {
        e.preventDefault();
        const $thisForm = $(this);
        const $submitButton = $thisForm.find('button[type="submit"]');
        const originalButtonText = $submitButton.html();

        $submitButton.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin me-1"></i> Salvando...');

        const formData = new FormData(this);

        $.ajax({
            url: '/inss/api/post/adicionaracao/', // Sua API para adicionar ação
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Sucesso!',
                        text: response.message || 'Ação adicionada com sucesso!',
                        timer: 2500,
                        showConfirmButton: false
                    });
                    // Fechar modal usando a instância do Bootstrap
                    const modalElement = document.getElementById('modalAdicionarAcao');
                    if (modalElement) {
                        const modalInstance = bootstrap.Modal.getInstance(modalElement);
                        if (modalInstance) modalInstance.hide();
                    }
                    // Recarregar tabelas da loja se a ação afetar a listagem
                    if (typeof carregarAgendadosHoje === 'function') carregarAgendadosHoje();
                    if (typeof carregarAgendamentosPendentes === 'function') carregarAgendamentosPendentes();
                    if (typeof carregarClientesNaoPresentes === 'function') carregarClientesNaoPresentes();
                } else {
                    Swal.fire('Erro!', response.message || 'Não foi possível adicionar a ação.', 'error');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON?.message || xhr.responseJSON?.error || 'Erro ao processar a solicitação.';
                Swal.fire('Erro de Servidor!', errorMsg, 'error');
            },
            complete: function() {
                $submitButton.prop('disabled', false).html(originalButtonText);
            }
        });
    });
});