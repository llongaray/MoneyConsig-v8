$(document).ready(function() {
    // Variáveis globais
    let documentosCount = 0;
    let infoGeral = null;

    // Inicialização
    initMasks();
    loadInfoGeral();
    initEventListeners();

    // Funções de Inicialização
    function initMasks() {
        // Máscara para CPF
        $('#cpf_cliente').mask('000.000.000-00');
        // Máscara para Contato
        $('#contato').mask('(00) 00000-0000');
        
        // Máscara para campos monetários
        $('.money').mask('0.000.000.000.000,00', {
            reverse: true,
            placeholder: "0,00"
        });
    }

    function initEventListeners() {
        // Evento de mudança no tipo de pagamento
        $('#tipo_pagamento').on('change', handleTipoPagamentoChange);

        // Evento de busca de CPF
        $('#cpf_cliente').on('blur', handleCpfBlur);

        // Evento de adicionar documento
        $('#btnAddDocumento').on('click', addDocumento);

        // Evento de remover documento
        $(document).on('click', '.btn-remove-documento', removeDocumento);

        // Evento de submit do formulário
        $('#formNovaAcao').on('submit', handleFormSubmit);
    }

    // Funções de Carregamento de Dados
    function loadInfoGeral() {
        $.ajax({
            url: '/juridico/api/info-geral/',
            method: 'GET',
            success: function(response) {
                if (response.status === 'success') {
                    infoGeral = response.data;
                    populateSelects();
                } else {
                    showError('Erro ao carregar informações gerais');
                }
            },
            error: function() {
                showError('Erro ao carregar informações gerais');
            }
        });
    }

    function populateSelects() {
        // Popula select de funcionários
        const funcionarioSelect = $('#funcionario');
        funcionarioSelect.empty().append('<option value="">Selecione um funcionário</option>');
        console.log('[ADDACAO] Populando select de funcionários:', infoGeral.funcionarios);
        infoGeral.funcionarios.forEach(funcionario => {
            console.log(`[ADDACAO] Adicionando funcionário: ${funcionario.nome} (ID: ${funcionario.value}, Usuário ID: ${funcionario.usuario_id})`);
            funcionarioSelect.append(`<option value="${funcionario.value}">${funcionario.nome}</option>`);
        });
    }

    // Funções de Manipulação de Eventos
    function handleTipoPagamentoChange() {
        const tipoPagamento = $(this).val();
        const camposPagamento = $('#camposPagamento');
        const camposAVista = $('#camposAVista');
        const camposParcelado = $('#camposParcelado');

        // Esconde todos os campos primeiro
        camposPagamento.removeClass('show');
        camposAVista.removeClass('show');
        camposParcelado.removeClass('show');

        // Remove a classe required de todos os campos de pagamento
        $('#valor_total, #valor_entrada, #qtd_parcelas, #valor_parcela').removeAttr('required');
        $('#valor_total, #valor_entrada, #qtd_parcelas, #valor_parcela').closest('.col-md-4').find('.form-label').removeClass('required');

        // Mostra os campos apropriados
        if (tipoPagamento !== 'SEM_PAGAMENTO' && tipoPagamento) {
            camposPagamento.addClass('show');
            if (tipoPagamento === 'A_VISTA') {
                camposAVista.addClass('show');
                // Aplica máscara nos campos monetários
                $('#valor_total').mask('0.000.000.000.000,00', { reverse: true, placeholder: "0,00" });
                // Adiciona required ao campo valor_total
                $('#valor_total').attr('required', 'required');
                $('#valor_total').closest('.col-md-4').find('.form-label').addClass('required');
            } else if (tipoPagamento === 'PARCELADO') {
                camposParcelado.addClass('show');
                $('#valor_entrada, #valor_parcela').mask('0.000.000.000.000,00', { reverse: true, placeholder: "0,00" });
                // Adiciona required aos campos de pagamento parcelado
                $('#valor_entrada, #qtd_parcelas, #valor_parcela').attr('required', 'required');
                $('#valor_entrada, #qtd_parcelas, #valor_parcela').closest('.col-md-4').find('.form-label').addClass('required');
            }
        }
    }

    function handleCpfBlur() {
        const cpf = $(this).val().replace(/\D/g, '');
        if (cpf.length === 11) {
            $.ajax({
                url: '/juridico/api/cpf-cliente/',
                method: 'GET',
                data: { cpf: cpf },
                success: function(response) {
                    if (response.status === 'success') {
                        // Se encontrou o cliente, preenche o nome
                        const clienteInfo = response.data;
                        if (clienteInfo.siape) {
                            $('#nome_cliente').val(clienteInfo.siape.nome);
                        } else if (clienteInfo.agendamento) {
                            $('#nome_cliente').val(clienteInfo.agendamento.nome);
                        }
                    }
                }
            });
        }
    }

    function addDocumento() {
        const template = document.getElementById('documentoTemplate');
        const documentosList = document.getElementById('documentosList');
        
        // Clona o template
        const clone = template.content.cloneNode(true);
        
        // Atualiza os IDs e names com o índice atual
        const documentoItem = clone.querySelector('.documento-item');
        documentoItem.innerHTML = documentoItem.innerHTML.replace(/__INDEX__/g, documentosCount);
        
        // Adiciona ao DOM
        documentosList.appendChild(clone);
        
        // Incrementa o contador
        documentosCount++;
    }

    function removeDocumento() {
        $(this).closest('.documento-item').remove();
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        console.log('[ADDACAO] Submit iniciado');
        
        // Validação básica
        if (!validateForm()) {
            console.log('[ADDACAO] Validação falhou');
            return;
        }
        console.log('[ADDACAO] Validação passou');

        // Cria o FormData
        const formData = new FormData(this);

        // Debug: logar o ID do funcionário selecionado
        const funcionarioSelecionado = $('#funcionario').val();
        const funcionarioNome = $('#funcionario option:selected').text();
        console.log(`[ADDACAO] Funcionário selecionado: ${funcionarioNome} (ID: ${funcionarioSelecionado})`);

        // Adiciona os documentos
        $('.documento-item').each(function(index) {
            const titulo = $(this).find(`input[name^="documentos[${index}]"][name$="[titulo]"]`).val();
            const file = $(this).find(`input[name^="documentos[${index}]"][name$="[file]"]`)[0].files[0];
            if (file) {
                formData.append(`documento_${index}`, file);
                formData.append(`titulo_documento_${index}`, titulo);
            }
        });

        // Debug: logar todos os campos do FormData
        for (let pair of formData.entries()) {
            console.log('[ADDACAO] FormData:', pair[0], pair[1]);
        }

        // Envia o formulário
        $.ajax({
            url: '/juridico/api/acoes/adicionar/',
            method: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                console.log('[ADDACAO] Sucesso:', response);
                showSuccess('Ação criada com sucesso!');
                setTimeout(() => {
                    window.location.href = '/juridico/acoes/';
                }, 2000);
            },
            error: function(xhr) {
                const response = xhr.responseJSON;
                console.log('[ADDACAO] Erro:', response);
                showError(response?.message || 'Erro ao criar ação', response?.errors);
            }
        });
    }

    // Funções de Validação
    function validateForm() {
        let isValid = true;
        const requiredFields = [
            'nome_cliente',
            'cpf_cliente',
            'contato',
            'funcionario',
            'data_acao',
            'tipo_acao',
            'tipo_pagamento'
        ];

        // Valida campos obrigatórios
        requiredFields.forEach(field => {
            const value = $(`#${field}`).val();
            if (!value) {
                showError(`O campo ${field} é obrigatório`);
                isValid = false;
            }
        });

        // Valida campos de pagamento
        const tipoPagamento = $('#tipo_pagamento').val();
        if (tipoPagamento !== 'SEM_PAGAMENTO') {
            if (tipoPagamento === 'A_VISTA') {
                if (!$('#valor_total').val()) {
                    showError('O valor total é obrigatório para pagamento à vista');
                    isValid = false;
                }
            } else if (tipoPagamento === 'PARCELADO') {
                if (!$('#valor_entrada').val() || !$('#qtd_parcelas').val() || !$('#valor_parcela').val()) {
                    showError('Todos os campos de pagamento parcelado são obrigatórios');
                    isValid = false;
                }
            }
        }

        // Removida a validação de documentos obrigatórios
        // Agora o usuário pode criar ações sem arquivos

        return isValid;
    }

    // Funções de UI
    function showError(message, details) {
        console.error('[SHOW_ERROR] Mensagem:', message);
        if (details) {
            console.error('[SHOW_ERROR] Detalhes:', details);
        }
        let displayMessage = message;
        if (details && typeof details === 'object') {
            const errorMessages = Object.values(details).flat().join('\n');
            if (errorMessages) {
                displayMessage += '\n\nDetalhes:\n' + errorMessages;
            }
        }
        alert(displayMessage); 
    }

    function showSuccess(message) {
        alert(message);
    }
});
