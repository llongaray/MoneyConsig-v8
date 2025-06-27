$(document).ready(function() {
    // --- Configuração ---
    const apiUrlGeral = '/rh/api/get/infogeral/';
    // URLs das APIs POST (ajuste conforme suas urls.py)
    const apiPostEmpresa = '/rh/api/post/empresa/';
    const apiPostLoja = '/rh/api/post/loja/';
    const apiPostDepartamento = '/rh/api/post/departamento/';
    const apiPostSetor = '/rh/api/post/setor/';
    const apiPostEquipe = '/rh/api/post/equipe/';
    const apiPostCargo = '/rh/api/post/cargo/';
    const apiPostHorario = '/rh/api/post/horario/';
    const apiPostProduto = '/rh/api/post/produto/';
    const apiGetComissao = '/rh/api/get/comissao/';
    const apiPostComissao = '/rh/api/post/novaregracomissao/';

    // --- Elementos do DOM ---
    // Formulários
    const $formEmpresa = $('#form-empresa');
    const $formLoja = $('#form-loja');
    const $formDepartamento = $('#form-departamento');
    const $formSetor = $('#form-setor');
    const $formEquipe = $('#form-equipe');
    const $formCargo = $('#form-cargo');
    const $formHorario = $('#form-horario');
    const $formComissao = $('#form-comissao'); // Novo formulário de comissão
    const $formProduto = $('#form-produto'); // <<< ADICIONAR FORM PRODUTO

    // Selects de Empresa (precisam ser atualizados dinamicamente)
    const $selectsEmpresa = $('#loja_empresa, #departamento_empresa, #cargo_empresa, #setor_empresa_filtro');

    // Selects de Departamento (precisam ser atualizados dinamicamente)
    const $selectSetorDepartamento = $('#setor_departamento');
    const $selectSetorEmpresaFiltro = $('#setor_empresa_filtro');

    // Elementos de Comissionamento
    const $selectComissaoEscopo = $('#comissao_escopo');
    const $comissaoEntidadesContainer = $('#comissao_entidades_container');
    const $comissaoContainers = {
        'EMPRESA': $('#comissao_empresas_container'),
        'DEPARTAMENTO': $('#comissao_departamentos_container'),
        'SETOR': $('#comissao_setores_container'),
        'EQUIPE': $('#comissao_equipes_container'),
        'LOJA': $('#comissao_lojas_container')
    };
    const $comissaoCheckboxes = {
        'EMPRESA': $('#comissao_empresas_checkboxes'),
        'DEPARTAMENTO': $('#comissao_departamentos_checkboxes'),
        'SETOR': $('#comissao_setores_checkboxes'),
        'EQUIPE': $('#comissao_equipes_checkboxes'),
        'LOJA': $('#comissao_lojas_checkboxes')
    };

    // Outros elementos
    const $inputCnpj = $('#empresa_cnpj');
    const $selectCargoHierarquia = $('#cargo_hierarquia'); // Cache do select de hierarquia

    // --- Cache de Dados ---
    let todosEmpresas = [];
    let todosDepartamentos = [];
    let todosHierarquias = []; // Cache para hierarquias
    // Cache para comissionamento
    let dadosComissao = {
        empresas: [],
        lojas: [],
        departamentos: [],
        setores: [],
        equipes: []
    };
    // Outros dados (lojas, setores, etc.) não precisam ser cacheados globalmente aqui,
    // pois são apenas para referência ou populados estaticamente/via contexto.

    // --- Inicialização Imediata ---
    // Esconder todos os containers de entidades comissão imediatamente
    atualizarVisibilidadeEntidadesComissao('');

    // --- Funções Auxiliares ---
    function getCsrfToken() {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function showMessage(type, message, duration = 5000) {
        const alertClass = type === 'success' ? 'alert-success' : 'alert-danger';
        const iconClass = type === 'success' ? 'bxs-check-circle' : 'bxs-x-circle';

        // Cria o elemento de alerta (toast)
        const $alert = $(`
            <div class="alert ${alertClass} alert-dismissible fade" role="alert">
                <i class='bx ${iconClass}'></i>
                <div>${message}</div>
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `);

        // Cria o container de toasts se ainda não existir
        let $toastContainer = $('#toast-container-fixed');
        if ($toastContainer.length === 0) {
            $toastContainer = $('<div id="toast-container-fixed" style="position: fixed; top: 20px; right: 20px; z-index: 1056; width: auto; max-width: 400px;"></div>');
            $('body').append($toastContainer);
        }

        // Adiciona o novo toast ao container
        $toastContainer.append($alert);

        // Força reflow para garantir que a animação funcione
        $alert.width();

        // Adiciona a classe 'show' para iniciar a animação de entrada
        $alert.addClass('show');

        // Define timeout para remover o toast
        const timer = setTimeout(() => {
            $alert.removeClass('show'); // Inicia animação de saída
            // Espera a animação de saída terminar antes de remover o elemento
            $alert.on('transitionend webkitTransitionEnd oTransitionEnd', function () {
                $(this).remove();
            });
            // Fallback caso a transição não dispare (ex: elemento já removido)
            setTimeout(() => $alert.remove(), 600); // Tempo ligeiramente maior que a transição CSS

        }, duration);

        // Permite fechar manualmente
        $alert.find('.btn-close').on('click', function() {
            clearTimeout(timer); // Cancela o timer se fechar manualmente
             $(this).closest('.alert').removeClass('show');
             // Espera a animação de saída terminar antes de remover o elemento
             $(this).closest('.alert').on('transitionend webkitTransitionEnd oTransitionEnd', function () {
                 $(this).remove();
             });
             setTimeout(() => $(this).closest('.alert').remove(), 600);
        });

        // Scroll não é mais necessário para toasts fixos
        // $('html, body').animate({ scrollTop: $messageContainer.offset().top - 70 }, 300);
    }

    // --- Funções de Carregamento e População ---

    // Carrega dados iniciais e popula selects
    function carregarDadosIniciaisEPopularSelects() {
        console.log("Carregando dados gerais...");
        $.getJSON(apiUrlGeral)
            .done(function(data) {
                console.log("Dados gerais recebidos:", data);
                todosEmpresas = data.empresas || [];
                todosDepartamentos = data.departamentos || [];
                todosHierarquias = data.hierarquia_choices || []; // Armazena as hierarquias recebidas

                popularSelectsEmpresa();

                // --- Correção: Resetar filtro de empresa ANTES de popular deptos ---
                $selectSetorEmpresaFiltro.val(''); // Reseta para '-- Selecione para Filtrar --'
                // -----------------------------------------------------------------

                popularSelectSetorDepartamento(); // Popula com todos inicialmente
                popularSelectHierarquiaCargo(todosHierarquias); // Popula o select de hierarquia

                // Habilitar filtro de setor se houver empresas (já feito em popularSelectsEmpresa)
                // $selectSetorEmpresaFiltro.prop('disabled', todosEmpresas.length === 0);
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                console.error("Erro ao carregar dados gerais:", textStatus, errorThrown, jqXHR.responseText);
                showMessage('error', 'Falha ao carregar dados necessários para os formulários. Verifique a conexão ou contate o suporte.');
            });
            
        // Carrega dados para o formulário de comissionamento
        carregarDadosComissao();
    }

    // Popula todos os selects de Empresa
    function popularSelectsEmpresa() {
        $selectsEmpresa.each(function() {
            const $select = $(this);
            const currentValue = $select.val(); // Guarda valor atual se houver
            const defaultOption = $select.find('option:first').text(); // Pega texto da primeira opção

            $select.empty().append(`<option value="">${defaultOption}</option>`);
            todosEmpresas.forEach(empresa => {
                $select.append(`<option value="${empresa.id}">${empresa.nome}</option>`);
            });

            // Restaura valor selecionado anteriormente, se possível
            if (todosEmpresas.some(e => e.id == currentValue)) {
                 $select.val(currentValue);
            }

            // Habilita/desabilita o select se for filtro
            if ($select.is($selectSetorEmpresaFiltro)) {
                $select.prop('disabled', todosEmpresas.length === 0);
            }
        });
    }

    // Popula o select de Departamentos no form de Setor
    function popularSelectSetorDepartamento() {
        const $select = $selectSetorDepartamento;
        const currentValue = $select.val(); // Guarda valor atual
        const defaultOption = $select.find('option:first').text(); // Pega texto da primeira opção

        $select.empty().append(`<option value="">${defaultOption}</option>`);
        todosDepartamentos.forEach(depto => {
            // Adiciona data-empresa para permitir filtragem posterior
            $select.append(`<option value="${depto.id}" data-empresa="${depto.empresa_id}">${depto.nome} (${depto.empresa__nome})</option>`);
        });

         // Restaura valor selecionado anteriormente, se possível
        if (todosDepartamentos.some(d => d.id == currentValue)) {
             $select.val(currentValue);
        }

        // Aplica filtro inicial se uma empresa já estiver selecionada no filtro
        filtrarDepartamentosPorEmpresa();
    }

    // Filtra as opções no select de Departamento do form Setor
    function filtrarDepartamentosPorEmpresa() {
        const empresaIdFiltro = $selectSetorEmpresaFiltro.val();
        const $options = $selectSetorDepartamento.find('option');
        let visibleOptionsCount = 0;

        // 1. Conta quantas opções são válidas para o filtro atual
        $options.each(function() {
            const $option = $(this);
            const optionValue = $option.val();
            if (!optionValue) return; // Ignora a opção default "-- Selecione --"

            const optionEmpresaId = $option.data('empresa');
            // Conta se não há filtro ou se a empresa da opção bate com o filtro
            if (!empresaIdFiltro || String(optionEmpresaId) === String(empresaIdFiltro)) {
                visibleOptionsCount++;
            }
        });

        // 2. Define o estado 'disabled' ANTES de mostrar/esconder
        $selectSetorDepartamento.prop('disabled', visibleOptionsCount === 0);
        console.log(`Filtrando por Empresa ID: ${empresaIdFiltro}. Opções visíveis: ${visibleOptionsCount}. Select de Depto desabilitado: ${visibleOptionsCount === 0}`);

        // 3. Aplica show/hide nas opções
        $options.each(function() {
            const $option = $(this);
            const optionValue = $option.val();
            if (!optionValue) return; // Ignora default

            const optionEmpresaId = $option.data('empresa');
            // Mostra se não há filtro de empresa ou se a empresa do depto bate com o filtro
            if (!empresaIdFiltro || String(optionEmpresaId) === String(empresaIdFiltro)) {
                $option.show();
            } else {
                $option.hide();
            }
        });

        // 4. Se o valor selecionado foi escondido, reseta a seleção
        if (empresaIdFiltro && $selectSetorDepartamento.find('option:selected').is(':hidden')) {
            $selectSetorDepartamento.val('');
        }
    }

    // Popula o select de Hierarquia no form de Cargo
    function popularSelectHierarquiaCargo(hierarquias) {
        const $select = $selectCargoHierarquia;
        const currentValue = $select.val(); // Guarda valor atual se houver
        const defaultOptionText = "--- Selecione o Nível ---"; // Texto da opção padrão

        $select.empty().append(`<option value="">${defaultOptionText}</option>`); // Adiciona opção padrão
        console.log("Populando hierarquia com:", hierarquias);
        hierarquias.forEach(hierarquia => {
            $select.append(`<option value="${hierarquia.value}">${hierarquia.display} (ID: ${hierarquia.value})</option>`);
        });

        // Restaura valor selecionado anteriormente, se possível
        if (hierarquias.some(h => h.value == currentValue)) {
             $select.val(currentValue);
        }

        // Habilita o select (caso estivesse desabilitado)
        $select.prop('disabled', hierarquias.length === 0);
    }

    // --- Funções de Comissionamento ---

    // Carrega dados para o formulário de comissionamento
    function carregarDadosComissao() {
        console.log("Carregando dados para comissionamento...");
        $.getJSON(apiGetComissao)
            .done(function(data) {
                console.log("Dados de comissionamento recebidos:", data);
                // Armazena dados no cache local
                dadosComissao.empresas = data.empresas || [];
                dadosComissao.departamentos = data.departamentos || [];
                dadosComissao.setores = data.setores || [];
                dadosComissao.equipes = data.equipes || [];
                dadosComissao.lojas = data.lojas || [];
                
                // Prepara os elementos para quando o usuário selecionar um escopo
                prepararCheckboxesComissao();
                
                // Garante que os containers estejam ocultos por padrão
                atualizarVisibilidadeEntidadesComissao('');
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                console.error("Erro ao carregar dados para comissionamento:", textStatus, errorThrown, jqXHR.responseText);
                showMessage('error', 'Falha ao carregar dados para o formulário de comissionamento. Verifique a conexão ou contate o suporte.');
            });
    }

    // Prepara os containers de checkboxes para cada tipo de entidade
    function prepararCheckboxesComissao() {
        // Empresas
        $comissaoCheckboxes.EMPRESA.empty();
        dadosComissao.empresas.forEach(empresa => {
            const checkboxHtml = `
                <div class="form-check form-check-inline me-3 mb-2">
                    <input class="form-check-input" type="checkbox" name="empresas" id="empresa_${empresa.id}" value="${empresa.id}">
                    <label class="form-check-label small" for="empresa_${empresa.id}">${empresa.nome}</label>
                </div>
            `;
            $comissaoCheckboxes.EMPRESA.append(checkboxHtml);
        });

        // Departamentos
        $comissaoCheckboxes.DEPARTAMENTO.empty();
        dadosComissao.departamentos.forEach(depto => {
            // Tenta encontrar o nome da empresa para o rótulo
            const empresaNome = dadosComissao.empresas.find(e => e.id === depto.empresa_id)?.nome || 'Empresa';
            const checkboxHtml = `
                <div class="form-check form-check-inline me-3 mb-2" data-empresa-id="${depto.empresa_id}">
                    <input class="form-check-input" type="checkbox" name="departamentos" id="depto_${depto.id}" value="${depto.id}">
                    <label class="form-check-label small" for="depto_${depto.id}">${depto.nome} (${empresaNome})</label>
                </div>
            `;
            $comissaoCheckboxes.DEPARTAMENTO.append(checkboxHtml);
        });

        // Setores
        $comissaoCheckboxes.SETOR.empty();
        dadosComissao.setores.forEach(setor => {
            // Tenta encontrar o nome do departamento para o rótulo
            const deptoNome = dadosComissao.departamentos.find(d => d.id === setor.departamento_id)?.nome || 'Depto';
            const checkboxHtml = `
                <div class="form-check form-check-inline me-3 mb-2" data-depto-id="${setor.departamento_id}">
                    <input class="form-check-input" type="checkbox" name="setores" id="setor_${setor.id}" value="${setor.id}">
                    <label class="form-check-label small" for="setor_${setor.id}">${setor.nome} (${deptoNome})</label>
                </div>
            `;
            $comissaoCheckboxes.SETOR.append(checkboxHtml);
        });

        // Equipes
        $comissaoCheckboxes.EQUIPE.empty();
        dadosComissao.equipes.forEach(equipe => {
            const checkboxHtml = `
                <div class="form-check form-check-inline me-3 mb-2">
                    <input class="form-check-input" type="checkbox" name="equipes" id="equipe_${equipe.id}" value="${equipe.id}">
                    <label class="form-check-label small" for="equipe_${equipe.id}">${equipe.nome}</label>
                </div>
            `;
            $comissaoCheckboxes.EQUIPE.append(checkboxHtml);
        });

        // Lojas
        $comissaoCheckboxes.LOJA.empty();
        dadosComissao.lojas.forEach(loja => {
            const empresaNome = dadosComissao.empresas.find(e => e.id === loja.empresa_id)?.nome || 'Empresa';
            const checkboxHtml = `
                <div class="form-check form-check-inline me-3 mb-2" data-empresa-id="${loja.empresa_id}">
                    <input class="form-check-input" type="checkbox" name="lojas" id="loja_comissao_${loja.id}" value="${loja.id}">
                    <label class="form-check-label small" for="loja_comissao_${loja.id}">${loja.nome} (${empresaNome})</label>
                </div>
            `;
            $comissaoCheckboxes.LOJA.append(checkboxHtml);
        });
        
        // Garante que todos os containers estejam ocultos por padrão
        setTimeout(() => atualizarVisibilidadeEntidadesComissao(''), 50);
    }

    // Atualiza a visibilidade dos containers de checkboxes baseado no escopo selecionado
    function atualizarVisibilidadeEntidadesComissao(escopoSelecionado) {
        console.log('Atualizando visibilidade de entidades para escopo:', escopoSelecionado);
        
        // Primeiro, forçar a aplicação do estilo display: none em todos os containers
        $comissaoEntidadesContainer.css('display', 'none');
        Object.values($comissaoContainers).forEach($container => {
            $container.css('display', 'none');
            $container.addClass('d-none'); // Garante classe d-none
        });
        
        // Se o escopo for GERAL ou PESSOAL, ou vazio, não precisa mostrar entidades
        if (!escopoSelecionado || escopoSelecionado === 'GERAL' || escopoSelecionado === 'PESSOAL') {
             $comissaoEntidadesContainer.addClass('d-none');
             $comissaoEntidadesContainer.css('display', 'none');
            return;
        }

        // Mostra o container principal de entidades
        $comissaoEntidadesContainer.removeClass('d-none');
        $comissaoEntidadesContainer.css('display', 'block');
        
        // Mostra APENAS o container específico para o escopo selecionado
        if ($comissaoContainers[escopoSelecionado]) {
            $comissaoContainers[escopoSelecionado].removeClass('d-none');
            $comissaoContainers[escopoSelecionado].css('display', 'block');
        } else {
             console.warn('Container de comissão não encontrado para o escopo:', escopoSelecionado);
        }
    }

    // --- Funções de Submissão AJAX ---

    function submeterFormularioAjax(formElement, apiUrl, useFormData = false) {
        const $form = $(formElement);
        const $submitButton = $form.find('button[type="submit"]');
        const submitButtonText = $submitButton.html();

        // Validação HTML5 básica
        if (!$form[0].checkValidity()) {
            $form[0].reportValidity();
            return;
        }

        let formData;
        let ajaxOptions = {
            url: apiUrl,
            type: 'POST',
            headers: {
                'X-CSRFToken': getCsrfToken()
            },
            beforeSend: function() {
                $submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...');
            },
            success: function(response) {
                console.log("Sucesso:", response);
                showMessage('success', response.message || 'Operação realizada com sucesso!');
                $form[0].reset(); // Limpa o formulário específico

                // Verifica se uma Empresa ou Departamento foi criado para recarregar selects
                if (apiUrl === apiPostEmpresa || apiUrl === apiPostDepartamento) {
                     console.log("Empresa ou Departamento criado, recarregando dados gerais...");
                     carregarDadosIniciaisEPopularSelects(); // Recarrega tudo
                } else {
                    // Para outros forms, apenas limpa se necessário (já feito pelo reset)
                }
                
                // Para o form de comissão, reseta os campos adicionais
                if (apiUrl === apiPostComissao) {
                    atualizarVisibilidadeEntidadesComissao(''); // Esconde os containers de entidades
                }
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error("Erro AJAX:", textStatus, errorThrown, jqXHR.responseText);
                let errorMessage = 'Erro ao realizar a operação.';
                if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
                    errorMessage = jqXHR.responseJSON.error;
                    // Adiciona detalhes se existirem (ex: erros de validação do Django)
                    if (jqXHR.responseJSON.details) {
                         let details = Object.entries(jqXHR.responseJSON.details)
                             .map(([field, errors]) => `<li>${field}: ${errors.join(', ')}</li>`)
                             .join('');
                         errorMessage += `<br><ul class="text-start small mt-2">${details}</ul>`;
                    }
                } else if (jqXHR.responseText) {
                     try { // Tenta extrair erro de texto puro
                        let response = JSON.parse(jqXHR.responseText);
                        errorMessage = response.error || errorMessage;
                    } catch(e) { /* Ignora se não for JSON */ }
                }
                showMessage('error', errorMessage);
            },
            complete: function() {
                $submitButton.prop('disabled', false).html(submitButtonText);
            }
        };

        if (useFormData) {
            formData = new FormData($form[0]);
            ajaxOptions.data = formData;
            ajaxOptions.processData = false;
            ajaxOptions.contentType = false;
        } else {
            formData = $form.serialize();
            ajaxOptions.data = formData;
        }

        console.log(`Enviando para ${apiUrl}:`, useFormData ? Object.fromEntries(formData) : formData);
        $.ajax(ajaxOptions);
    }

    // Submete o formulário de comissionamento
    function submeterFormularioComissao(e) {
        e.preventDefault();
        
        // Validação do campo de percentual - apenas valores inteiros
        const percentualInput = $('#comissao_percentual');
        const percentualValue = percentualInput.val();
        
        // Verifica se o valor contém casas decimais
        if (percentualValue && percentualValue.includes('.')) {
            showMessage('error', 'O percentual da comissão deve ser um número inteiro (sem casas decimais).');
            percentualInput.focus();
            return false;
        }
        
        // Cria um objeto com os dados do formulário
        const formData = {
            titulo: $('#comissao_titulo').val(),
            escopo_base: $('#comissao_escopo').val(),
            percentual: parseInt(percentualValue, 10), // Converte explicitamente para inteiro
            valor_de: $('#comissao_valor_de').val() || null,
            valor_ate: $('#comissao_valor_ate').val() || null,
            status: $('#comissao_status').is(':checked')
        };
        
        // Adiciona os arrays de entidades selecionadas (se aplicável)
        if (formData.escopo_base === 'EMPRESA') {
            formData.empresas = [];
            $('input[name="empresas"]:checked').each(function() {
                formData.empresas.push(parseInt($(this).val()));
            });
        } else if (formData.escopo_base === 'DEPARTAMENTO') {
            formData.departamentos = [];
            $('input[name="departamentos"]:checked').each(function() {
                formData.departamentos.push(parseInt($(this).val()));
            });
        } else if (formData.escopo_base === 'SETOR') {
            formData.setores = [];
            $('input[name="setores"]:checked').each(function() {
                formData.setores.push(parseInt($(this).val()));
            });
        } else if (formData.escopo_base === 'EQUIPE') {
            formData.equipes = [];
            $('input[name="equipes"]:checked').each(function() {
                formData.equipes.push(parseInt($(this).val()));
            });
        }
        
        // Coleta Lojas selecionadas (sempre, pois é um filtro adicional)
        formData.lojas = [];
        $('input[name="lojas"]:checked').each(function() {
            formData.lojas.push(parseInt($(this).val()));
        });
        
        // Envia para a API
        const $submitButton = $(this).find('button[type="submit"]');
        const submitButtonText = $submitButton.html();
        
        $.ajax({
            url: apiPostComissao,
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            headers: {
                'X-CSRFToken': getCsrfToken()
            },
            beforeSend: function() {
                $submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...');
            },
            success: function(response) {
                console.log("Regra de comissionamento criada com sucesso:", response);
                showMessage('success', 'Regra de comissionamento criada com sucesso!');
                $('#form-comissao')[0].reset();
                atualizarVisibilidadeEntidadesComissao(''); // Esconde os containers de entidades
                
                // Opcional: recarregar dados para comissão para atualizar listas
                carregarDadosComissao();
            },
            error: function(jqXHR, textStatus, errorThrown) {
                console.error("Erro ao criar regra de comissionamento:", textStatus, errorThrown, jqXHR.responseText);
                let errorMessage = 'Erro ao criar regra de comissionamento.';
                if (jqXHR.responseJSON && jqXHR.responseJSON.error) {
                    errorMessage = jqXHR.responseJSON.error;
                    // Adiciona detalhes se existirem
                    if (jqXHR.responseJSON.details) {
                        let details = Object.entries(jqXHR.responseJSON.details)
                            .map(([field, errors]) => `<li>${field}: ${errors.join(', ')}</li>`)
                            .join('');
                        errorMessage += `<br><ul class="text-start small mt-2">${details}</ul>`;
                    }
                } else if (jqXHR.responseText) {
                    try {
                        let response = JSON.parse(jqXHR.responseText);
                        errorMessage = response.error || errorMessage;
                    } catch(e) { /* Ignora se não for JSON */ }
                }
                showMessage('error', errorMessage);
            },
            complete: function() {
                $submitButton.prop('disabled', false).html(submitButtonText);
            }
        });
    }

    // --- Event Listeners ---

    // Listener para o filtro de empresa no card Setor
    $selectSetorEmpresaFiltro.change(filtrarDepartamentosPorEmpresa);

    // Listeners para submissão de cada formulário
    $formEmpresa.submit(function(e) {
        e.preventDefault();
        submeterFormularioAjax(this, apiPostEmpresa);
    });

    $formLoja.submit(function(e) {
        e.preventDefault();
        submeterFormularioAjax(this, apiPostLoja, true); // true para usar FormData
    });

    $formDepartamento.submit(function(e) {
        e.preventDefault();
        submeterFormularioAjax(this, apiPostDepartamento);
    });

    $formSetor.submit(function(e) {
        e.preventDefault();
        submeterFormularioAjax(this, apiPostSetor);
    });

    $formEquipe.submit(function(e) {
        e.preventDefault();
        submeterFormularioAjax(this, apiPostEquipe);
    });

    $formCargo.submit(function(e) {
        e.preventDefault();
        submeterFormularioAjax(this, apiPostCargo);
    });

    $formHorario.submit(function(e) {
        e.preventDefault();
        submeterFormularioAjax(this, apiPostHorario);
    });

    // Listener para o escopo de comissionamento
    $selectComissaoEscopo.change(function() {
        const escopoSelecionado = $(this).val();
        atualizarVisibilidadeEntidadesComissao(escopoSelecionado);
    });

    // Listener para submissão do formulário de comissionamento
    $formComissao.submit(submeterFormularioComissao);

    // Listener para submissão do formulário de produto
    $formProduto.submit(function(e) {
        e.preventDefault();
        submeterFormularioAjax(this, apiPostProduto);
    });

    // --- Inicialização ---
    carregarDadosIniciaisEPopularSelects();

    // Aplica máscara de CNPJ
    if ($inputCnpj.inputmask) {
        $inputCnpj.inputmask('99.999.999/9999-99');
    } else {
        console.warn('jQuery InputMask não encontrado. Máscara de CNPJ não aplicada.');
    }

});
