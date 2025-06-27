$(document).ready(function() {

    // --- Máscaras ---
    $('#cpfCliente').mask('000.000.000-00');
    $('#valor').mask('000.000.000.000.000,00', { reverse: true });

    // --- Funções Auxiliares ---
    function formatCurrency(value) {
        // CORREÇÃO: O valor da API já vem como string "12345.67", basta converter.
        const numberValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numberValue)) {
            return "R$ 0,00"; // Ou algum valor padrão/indicador de erro
        }
        return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatDate(dateString) {
        if (!dateString) return '--';
        // Assume que a string já vem formatada do backend (dd/mm/yyyy HH:MM:SS)
        // Se precisar formatar de um objeto Date: new Date(dateString).toLocaleString('pt-BR')
        return dateString;
    }

    // Função para obter o token CSRF (necessário para requisições POST no Django)
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    const csrftoken = getCookie('csrftoken');

    // Configuração global do AJAX para incluir o token CSRF
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
        }
    });

    function atualizarTimestamp() {
        $('#last-update-time').text(new Date().toLocaleString('pt-BR'));
    }

    // --- Lógica de Filtros ---

    // Função para aplicar os filtros e recarregar a tabela
    function applyFilters() {
        const filterData = {
            vendedor_id: $('#filtroVendedor').val(),
            cpf: $('#filtroCpfCliente').val(), // Envia com máscara, backend limpa
            data_inicio: $('#filtroDataInicio').val(),
            data_fim: $('#filtroDataFim').val(),
            tipo: $('#filtroTipo').val()
        };
        console.log("Aplicando filtros:", filterData); // Debug
        loadTableData(filterData); // Passa os dados do filtro para a função de carregar tabela
    }

    // Event listeners para os campos de filtro
    $('#filtroVendedor, #filtroTipo, #filtroDataInicio, #filtroDataFim').on('change', function() {
        applyFilters();
    });
    // Usar keyup e paste para CPF, com debounce
    let cpfTimeout;
    $('#filtroCpfCliente').on('keyup paste', function() {
        clearTimeout(cpfTimeout);
        cpfTimeout = setTimeout(applyFilters, 500); // Espera 500ms após parar de digitar/colar
    });

    // Botão Limpar Filtros
    $('#limparFiltros').on('click', function() {
        $('#formFiltrosTAC')[0].reset(); // Reseta o formulário de filtros
        applyFilters(); // Recarrega a tabela com filtros limpos
    });

    // --- Carregamento de Dados ---

    // 1. Carregar dados dos Cards
    function loadCardsData() {
        $.ajax({
            url: '/siape/api/get/cards-tac/', // URL da API corrigida
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                $('#totalTACPeriodo').text(formatCurrency(data.total_tac_periodo));
                $('#totalTACMes').text(formatCurrency(data.total_tac_mes));
                $('#totalTACDia').text(formatCurrency(data.total_tac_dia));
                // Se houver um card de meta, poderia ser atualizado aqui também
                // $('#metaMes').text(formatCurrency(data.meta_mes));
            },
            error: function(xhr, status, error) {
                console.error("Erro ao buscar dados dos cards:", status, error);
                // Adicionar feedback visual para o usuário, se necessário
                $('#totalTACPeriodo, #totalTACMes, #totalTACDia').text("Erro");
            }
        });
    }

    // 2. Carregar dados da Tabela de Registros (MODIFICADO para aceitar filtros)
    function loadTableData(filters = {}) { // Aceita um objeto de filtros
        const tableBody = $('#tabelaRegistrosTAC tbody');
        const nenhumResultado = $('#nenhumResultado');

        // Adiciona indicador de carregamento
        tableBody.html('<tr><td colspan="5" class="text-center"><i class="bx bx-loader-alt bx-spin"></i> Carregando...</td></tr>');
        nenhumResultado.hide();

        $.ajax({
            url: '/siape/api/get/registros-tac/', // URL da API
            method: 'GET',
            data: filters, // Envia os filtros como parâmetros GET
            dataType: 'json',
            success: function(data) {
                tableBody.empty(); // Limpa a tabela antes de popular

                if (data.registros && data.registros.length > 0) {
                    nenhumResultado.hide();
                    data.registros.forEach(function(reg) {
                        // Aplica a máscara de CPF antes de exibir
                        // Usar um elemento temporário para aplicar a máscara corretamente
                        const cpfMascarado = reg.cpf_cliente ? $('<input>').mask('000.000.000-00').val(reg.cpf_cliente).val() : 'N/A';
                        const row = `<tr>
                            <td class="text-center">${reg.nome_funcionario || 'N/A'}</td>
                            <td class="text-center">${cpfMascarado}</td>
                            <td class="text-center">${formatCurrency(reg.valor_tac)}</td>
                            <td class="text-center">${formatDate(reg.data)}</td>
                            <td class="text-center">${reg.tipo || 'N/A'}</td> <!-- Nova célula para o Tipo -->
                            <!-- Adicionar mais colunas se necessário -->
                        </tr>`;
                        tableBody.append(row);
                    });
                    atualizarTimestamp(); // Atualiza o timestamp após carregar os dados
                } else {
                    tableBody.empty();
                    nenhumResultado.text('Nenhum registro encontrado com os filtros aplicados.').show(); // Mensagem ajustada
                }
                // Implementar lógica de paginação aqui se necessário (precisaria da API suportar)
            },
            error: function(xhr, status, error) {
                console.error("Erro ao buscar registros de TAC:", status, error);
                tableBody.empty();
                nenhumResultado.text('Erro ao carregar registros. Tente novamente.').show();
            }
        });
    }

    // 3. Carregar dados dos Selectors (Produtos e Funcionários - MODIFICADO para incluir filtro)
    function loadSelectorsData() {
        $.ajax({
            url: '/siape/api/get/info/', // URL da API
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                // Popula o select de Produtos (formulário de adição)
                const produtoSelect = $('#produto');
                produtoSelect.empty().append('<option value="" selected disabled>Selecione um produto...</option>');
                if (data.produtos && data.produtos.length > 0) {
                    data.produtos.forEach(function(produto) {
                        produtoSelect.append(`<option value="${produto.id}">${produto.nome}</option>`);
                    });
                } else {
                     produtoSelect.append('<option value="" disabled>Nenhum produto encontrado</option>');
                }

                // Popula o select de Analista/Consultor (formulário de adição)
                const analistaSelect = $('#analistaConsultor');
                analistaSelect.empty().append('<option value="" selected disabled>Selecione um analista...</option>');
                // Popula o select de Vendedor (filtro)
                const filtroVendedorSelect = $('#filtroVendedor');
                filtroVendedorSelect.empty().append('<option value="">Todos</option>'); // Opção "Todos" para o filtro

                if (data.funcionarios && data.funcionarios.length > 0) {
                    // Ordena funcionários alfabeticamente para os selects
                    data.funcionarios.sort((a, b) => a.nome_funcionario.localeCompare(b.nome_funcionario));

                    data.funcionarios.forEach(function(func) {
                        analistaSelect.append(`<option value="${func.user_id}">${func.nome_funcionario}</option>`);
                        // Adiciona também ao filtro
                        filtroVendedorSelect.append(`<option value="${func.user_id}">${func.nome_funcionario}</option>`);
                    });
                } else {
                    analistaSelect.append('<option value="" disabled>Nenhum funcionário encontrado</option>');
                     filtroVendedorSelect.append('<option value="" disabled>Nenhum vendedor encontrado</option>');
                }
            },
            error: function(xhr, status, error) {
                console.error("Erro ao buscar informações para os seletores:", status, error);
                $('#produto').empty().append('<option value="" selected disabled>Erro ao carregar produtos</option>');
                $('#analistaConsultor').empty().append('<option value="" selected disabled>Erro ao carregar analistas</option>');
                $('#filtroVendedor').empty().append('<option value="" selected disabled>Erro ao carregar vendedores</option>');
            }
        });
    }

    // 4. Buscar Nome do Cliente ao sair do campo CPF (formulário de adição)
    $('#cpfCliente').on('blur', function() {
        const cpfInput = $(this);
        const nomeClienteInput = $('#nomeCliente');
        const cpf = cpfInput.val().replace(/\D/g, ''); // Remove máscara

        nomeClienteInput.val('Buscando...'); // Feedback para o usuário

        if (cpf.length === 11) {
            $.ajax({
                url: '/siape/api/get/nome-cliente/', // URL da API
                method: 'GET',
                data: { cpf: cpf },
                dataType: 'json',
                success: function(data) {
                    if (data.nome && data.nome !== 'Não registrado') {
                        nomeClienteInput.val(data.nome);
                    } else {
                        nomeClienteInput.val(''); // Limpa se não encontrado
                        nomeClienteInput.attr('placeholder', 'Cliente não encontrado'); // Informa que não achou
                    }
                },
                error: function(xhr, status, error) {
                    console.error("Erro ao buscar nome do cliente:", status, error);
                    nomeClienteInput.val('');
                    nomeClienteInput.attr('placeholder', 'Erro ao buscar cliente');
                }
            });
        } else if (cpf.length === 0) {
             nomeClienteInput.val(''); // Limpa se o CPF for apagado
             nomeClienteInput.attr('placeholder', 'Será preenchido após digitar o CPF');
        } else {
            nomeClienteInput.val(''); // Limpa se o CPF for inválido
            nomeClienteInput.attr('placeholder', 'CPF inválido');
        }
    });

    // 5. Submissão do Formulário de Novo Registro
    $('#formAdicionarTAC').on('submit', function(event) {
        event.preventDefault(); // Impede a submissão padrão do formulário

        // Coleta e valida os dados do formulário
        const cpfClienteRaw = $('#cpfCliente').val();
        const cpfCliente = cpfClienteRaw.replace(/\D/g, '');
        const produtoId = $('#produto').val();
        const valorTacRaw = $('#valor').val();
        // Remove formatação para enviar número puro ou com ponto decimal
        const valorTac = valorTacRaw.replace(/\./g, '').replace(',', '.');
        const dataPagoRaw = $('#dataPago').val(); // Formato YYYY-MM-DD
        const userId = $('#analistaConsultor').val();

        // Validação básica (pode ser mais robusta)
        if (!cpfCliente || cpfCliente.length !== 11) {
            alert('Por favor, insira um CPF válido.');
            return;
        }
        if (!produtoId) {
            alert('Por favor, selecione um produto.');
            return;
        }
        if (!valorTac || parseFloat(valorTac) <= 0) {
            alert('Por favor, insira um valor válido.');
            return;
        }
        if (!dataPagoRaw) {
            alert('Por favor, selecione a data de pagamento.');
            return;
        }
        if (!userId) {
            alert('Por favor, selecione o analista/consultor.');
            return;
        }

        const formData = {
            cpf_cliente: cpfCliente, // Envia sem máscara
            produto_id: produtoId,
            valor_tac: valorTac, // Envia como número (string com ponto decimal)
            data_pago: dataPagoRaw, // Envia no formato YYYY-MM-DD (padrão HTML5 date input)
            user_id: userId
        };

        // Desabilita o botão de submit e mostra indicador de carregamento
        const submitButton = $(this).find('button[type="submit"]');
        const originalButtonText = submitButton.html();
        submitButton.prop('disabled', true).html('<i class="bx bx-loader-alt bx-spin"></i> Processando...');

        // Envia os dados para a API via POST
        $.ajax({
            url: '/siape/api/post/novo-tac/', // URL da API
            method: 'POST',
            contentType: 'application/json', // Indica que estamos enviando JSON
            data: JSON.stringify(formData), // Converte o objeto JS em string JSON
            dataType: 'json', // Espera uma resposta JSON
            success: function(response) {
                // Exibe mensagem de sucesso em um modal ou toast mais amigável
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: response.message || 'Registro TAC criado com sucesso!',
                    confirmButtonText: 'OK'
                });

                // Limpa o formulário
                $('#formAdicionarTAC')[0].reset();
                $('#nomeCliente').val('').attr('placeholder', 'Será preenchido após digitar o CPF');

                // Recarrega os dados
                applyFilters(); // Recarrega a tabela (já aplicando filtros se houver)
                loadCardsData(); // Recarrega os cards
            },
            error: function(xhr, status, error) {
                console.error("Erro ao criar registro TAC:", status, error, xhr.responseText);
                let errorMessage = 'Ocorreu um erro ao salvar o registro.';
                
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    if (typeof errorData === 'object' && errorData !== null) {
                        if (errorData.error) {
                            errorMessage = errorData.error;
                        } else if (errorData.detail) {
                            errorMessage = errorData.detail;
                        } else {
                            // Tenta extrair mensagens de erro específicas
                            const detailedErrors = [];
                            for (const key in errorData) {
                                if (Array.isArray(errorData[key])) {
                                    detailedErrors.push(`${key}: ${errorData[key].join(', ')}`);
                                } else {
                                    detailedErrors.push(`${key}: ${errorData[key]}`);
                                }
                            }
                            if (detailedErrors.length > 0) {
                                errorMessage = detailedErrors.join('\n');
                            }
                        }
                    }
                } catch (e) {
                    console.error("Não foi possível parsear a resposta de erro JSON:", e);
                }

                // Exibe mensagem de erro em um modal mais amigável
                Swal.fire({
                    icon: 'error',
                    title: 'Erro!',
                    text: errorMessage,
                    confirmButtonText: 'OK'
                });
            },
            complete: function() {
                // Reabilita o botão de submit e restaura o texto original
                submitButton.prop('disabled', false).html(originalButtonText);
            }
        });
    });


    // --- Inicialização ---
    loadCardsData();
    loadSelectorsData(); // Carrega os dados para os selects (incluindo o filtro de vendedor)
    loadTableData(); // Carga inicial da tabela (sem filtros)
    atualizarTimestamp(); // Define o timestamp inicial

});
