console.log("apis_get.js - Conteúdo movido.");

$(document).ready(function(){
    console.log("Iniciando requisição para obter informações gerais...");
    
    $.ajax({
        url: '/inss/api/get/infogeral/',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            console.log("Resposta recebida da API:", response);

            // Preenche o select de lojas
            var $selectLoja = $('#loja_agendada');
            $selectLoja.empty().append('<option value="">Selecione uma loja</option>');
            $.each(response.lojas, function(index, loja) {
                console.log("Adicionando loja:", loja);
                $selectLoja.append('<option value="'+ loja.id +'">'+ loja.nome +'</option>');
            });
            
            // Preenche o select de funcionários (atendente)
            var $selectFuncionario = $('select[name="atendente_agendou"]');
            $selectFuncionario.empty().append('<option value="">Selecione um funcionário</option>');
            $.each(response.funcionarios, function(index, funcionario) {
                console.log("Adicionando funcionário:", funcionario);
                $selectFuncionario.append('<option value="'+ funcionario.id +'">'+ funcionario.apelido +'</option>');
            });

            console.log("Campos de seleção atualizados com sucesso.");
        },
        error: function(xhr, status, error) {
            console.error("Erro ao obter informações gerais:", error);
        }
    });
});

$(document).ready(function(){
    // Função auxiliar para handleTabulacaoVendedorChange (atualizada)
    function handleTabulacaoVendedorChange() {
        var valor = $("#tabulacaoVendedor").val();
        console.log("Valor selecionado no tabulacaoVendedor:", valor);
        
        if (valor === "FECHOU NEGOCIO") {
            $("#fechouNegocioContainer").show();
            $("#observacaoVendedorContainer").hide();
        } else {
            $("#fechouNegocioContainer").hide();
            $("#observacaoVendedorContainer").show();
        }
    }
    window.handleTabulacaoVendedorChange = handleTabulacaoVendedorChange; // torna global
    
    // Ajusta o fechamento dos modais ao clicar em botões com a classe .btn-close
    document.querySelectorAll('.btn-close').forEach(button => {
        button.addEventListener('click', function() {
            const modalElement = this.closest('.modal, .modal-sec');
            if (modalElement) {
                fecharModal('#' + modalElement.id);
            } else {
                console.error("Nenhum modal encontrado para fechar.");
            }
        });
    });
    
    // Garante que openSubModal exista (caso modal-core.js não esteja carregado)
    if (typeof openSubModal !== 'function') {
        function openSubModal(modalSelector) {
            var modal = $(modalSelector);
            if(modal.length) {
                modal.addClass('active');
                console.log("Submodal aberto:", modalSelector);
            } else {
                console.error("Submodal não encontrado:", modalSelector);
            }
        }
    }
    
    // Variável global para armazenar os agendamentos carregados via API
    window.todosAgendamentos = [];
    
    /**
     * Função para buscar os agendamentos via API GET e popular a tabela.
     * Exibe um spinner de loading enquanto aguarda a resposta.
     * Essa função é global para ser utilizada em outros contextos.
     */
    function carregarTodosAgendamentos(){
        console.log("Carregando todos os agendamentos...");
        var tbody = $("#tabelaTodosAgendamentos tbody");
        tbody.empty();
        // Exibe o spinner de loading
        tbody.append('<tr class="loading"><td colspan="8" class="text-center"><div class="spinner"></div> Carregando...</td></tr>');
        
        $.ajax({
            url: '/inss/api/get/all-agendamentos/',
            method: 'GET',
            dataType: 'json',
            success: function(response){
                console.log("Dados recebidos da API:", response);
                window.todosAgendamentos = response.todos_agend_table || [];
                tbody.empty();
    
                if(window.todosAgendamentos.length > 0){
                    $.each(window.todosAgendamentos, function(index, agendamento){
                        var linha = $("<tr></tr>");
                        
                        var btnNome;
                        // Se o status for FINALIZADO, não permite abrir o submodal
                        if(agendamento.status === 'FINALIZADO'){
                            btnNome = $('<span class="disabled"></span>').text(agendamento.nome_cliente);
                        } else {
                            btnNome = $('<button type="button" class="btn-link abrir-sub-modal"></button>')
                                .text(agendamento.nome_cliente)
                                .attr("data-cpf", agendamento.cpf_cliente)
                                .attr("data-agendamento-id", agendamento.id)
                                .click(function(){
                                    abrirSubModalPorID($(this));
                                });
                        }
                        
                        linha.append($("<td></td>").append(btnNome));
                        linha.append($("<td></td>").text(agendamento.cpf_cliente));
                        linha.append($("<td></td>").text(agendamento.numero_cliente));
                        linha.append($("<td></td>").attr("data-date", agendamento.dia_agendado).text(agendamento.dia_agendado));
                        linha.append($("<td></td>").text(agendamento.atendente_agendou));
                        linha.append($("<td></td>").text(agendamento.loja_agendada));
                        linha.append($("<td></td>").text(agendamento.status));
                        linha.append($("<td></td>").text(agendamento.total_agendamentos));
                        
                        tbody.append(linha);
                    });
                } else {
                    tbody.append('<tr><td colspan="8" class="text-center">Nenhum agendamento encontrado</td></tr>');
                }
            },
            error: function(xhr, status, error){
                console.error("Erro ao carregar os agendamentos:", error);
                tbody.empty();
                tbody.append('<tr><td colspan="8" class="text-center">Erro ao carregar agendamentos</td></tr>');
            }
        });
    }
    // Torna a função global
    window.carregarTodosAgendamentos = carregarTodosAgendamentos;
    
    /**
     * Função para converter data do formato YYYY-MM-DD para dd/MM/YYYY.
     */
    function converterData(dataStr) {
        if(!dataStr) return '';
        var partes = dataStr.split('-');
        if(partes.length !== 3) return dataStr;
        var formatada = partes[2] + '/' + partes[1] + '/' + partes[0];
        console.log("Data convertida:", formatada);
        return formatada;
    }
    
    /**
     * Preenche os campos do submodal de edição com os dados do agendamento.
     */
    function preencherSubmodalEdicao(agendamento) {
        console.log("Preenchendo submodal com os dados:", agendamento);
        
        $("#agendamentoId").val(agendamento.id);
        $("#nomeCliente").val(agendamento.nome_cliente);
        $("#cpfCliente").val(agendamento.cpf_cliente);
        $("#numeroCliente").val(agendamento.numero_cliente);
        $("#diaAgendado").val(converterData(agendamento.dia_agendado));
        
        var tabStatus = agendamento.tabulacao_atendente || agendamento.tabulacaoAtendente || '';
        console.log("Valor de tabulacao_atendente:", tabStatus);
        $("#tabulacaoAtendente").val(tabStatus);
        
        $("#atendenteAgendou").val(agendamento.atendente_agendou);
        $("#lojaAgendada").val(agendamento.loja_agendada);
        
        // Preenche o select de vendedores usando a API infogeral
        if(window.infogeral && window.infogeral.funcionarios) {
            preencherSelectVendedores(window.infogeral.funcionarios);
        } else {
            $.ajax({
                url: '/inss/api/get/infogeral/',
                method: 'GET',
                dataType: 'json',
                success: function(response){
                    console.log("Dados da API infogeral:", response);
                    window.infogeral = response;
                    preencherSelectVendedores(response.funcionarios);
                },
                error: function(xhr, status, error){
                    console.error("Erro ao carregar infogeral:", error);
                }
            });
        }
    }
    
    /**
     * Preenche o select de vendedores com base nos dados recebidos.
     */
    function preencherSelectVendedores(funcionarios) {
        var $vendedorSelect = $("#vendedorLoja");
        $vendedorSelect.empty().append('<option value="">Selecione um vendedor</option>');
        $.each(funcionarios, function(index, funcionario){
            $vendedorSelect.append('<option value="'+ funcionario.id +'">'+ funcionario.apelido +'</option>');
        });
    }
    
    /**
     * Abre o submodal de edição fazendo uma requisição para a API que retorna os dados do agendamento.
     * Usa o atributo data-agendamento-id para enviar o parâmetro.
     */
    function abrirSubModalPorID($botao) {
        var agendamentoId = $botao.data("agendamento-id");
        console.log("Abrindo submodal para agendamento ID:", agendamentoId);
        $.ajax({
            url: '/inss/api/get/submodal-cliente/',
            method: 'GET',
            dataType: 'json',
            data: { agendamento_id: agendamentoId },
            success: function(response){
                console.log("Dados do agendamento recebidos:", response);
                preencherSubmodalEdicao(response);
                openSubmodal('#modalEdicaoCliente');
            },
            error: function(xhr, status, error){
                console.error("Erro ao buscar dados do agendamento:", error);
            }
        });
    }
    
    // Função auxiliar para abrir submodal (usa openSubModal se definida)
    function openSubmodal(modalSelector) {
        if (typeof openSubModal === 'function') {
            openSubModal(modalSelector);
        } else {
            $(modalSelector).addClass('active');
            console.log("Submodal aberto (via fallback):", modalSelector);
        }
    }
    
    // Carrega os agendamentos assim que a página ou o modal é aberto.
    carregarTodosAgendamentos();
});

$(document).ready(function(){
    function carregarAgendamentosTAC(){
        console.log("Carregando agendamentos com TAC...");
        var tbody = $(".tac-table tbody");
        tbody.empty();
        // Exibe o spinner de loading
        tbody.append('<tr class="loading"><td colspan="6" class="text-center"><div class="spinner"></div> Carregando...</td></tr>');
        
        $.ajax({
            url: '/inss/api/get/tacs/',
            method: 'GET',
            dataType: 'json',
            success: function(response){
                console.log("Dados da API get tacs recebidos:", response);
                var agendamentos = response.agendamentos || [];
                tbody.empty();
                if(agendamentos.length > 0){
                    $.each(agendamentos, function(index, agendamento){
                        // Cria a classe baseada no status para aplicar o fundo via CSS
                        var statusClass = "status-" + agendamento.status.toLowerCase().replace(/\s+/g, '_');
                        var linha = $("<tr></tr>")
                            .attr("data-agendamento-id", agendamento.agendamento_id)
                            .addClass("tac-row " + statusClass);
                        
                        // Coluna Nome (apenas texto, pois não precisa de submodal aqui)
                        linha.append($("<td class='td-nome'></td>").text(agendamento.nome_cliente));
                        linha.append($("<td class='td-cpf'></td>").text(agendamento.cpf_cliente));
                        linha.append($("<td class='td-loja'></td>").text(agendamento.loja_agendada));
                        linha.append($("<td class='td-data'></td>").text(agendamento.dia_agendado));
                        
                        // Input para valor TAC: ao perder o foco, chama a função atualizarTac
                        var inputTac = $('<input type="text" class="tac-valor-input money">')
                                        .val("R$ " + parseFloat(agendamento.tac).toFixed(2))
                                        .attr("data-agendamento-id", agendamento.agendamento_id)
                                        .on("blur", function(){
                                            atualizarTac($(this));
                                        });
                        linha.append($("<td class='td-valor'></td>").append(inputTac));
                        
                        // Dropdown para status TAC: ao mudar, chama a função atualizarStatus.
                        // O valor default será o status retornado pela API.
                        var selectStatus = $('<select class="status-select"></select>')
                                        .attr("data-agendamento-id", agendamento.agendamento_id)
                                        .on("change", function(){
                                            atualizarStatus($(this));
                                        });
                        // Adiciona opção padrão
                        selectStatus.append('<option value="">Alterar status...</option>');
                        // Adiciona as opções com o atributo selected conforme o status da API
                        selectStatus.append('<option value="PAGO"' + (agendamento.status === "PAGO" ? " selected" : "") + '>PAGO</option>');
                        selectStatus.append('<option value="NAO_PAGO"' + (agendamento.status === "NAO_PAGO" ? " selected" : "") + '>NÃO PAGO</option>');
                        selectStatus.append('<option value="EM_ESPERA"' + (agendamento.status === "EM_ESPERA" ? " selected" : "") + '>EM ESPERA</option>');
                        console.log("Status TAC para agendamento ID", agendamento.agendamento_id, ":", agendamento.status);
                        linha.append($("<td class='td-acao'></td>").append(selectStatus));
                        
                        tbody.append(linha);
                    });
                } else {
                    tbody.append('<tr><td colspan="6" class="no-records">Nenhum agendamento com TAC encontrado</td></tr>');
                }
            },
            error: function(xhr, status, error){
                console.error("Erro ao carregar agendamentos TAC:", error);
                var tbody = $(".tac-table tbody");
                tbody.empty();
                tbody.append('<tr><td colspan="6" class="no-records">Erro ao carregar agendamentos com TAC</td></tr>');
            }
        });
    }
    // Torna a função global para ser reutilizada
    window.carregarAgendamentosTAC = carregarAgendamentosTAC;
    carregarAgendamentosTAC();
});



$(document).ready(function(){
    /**
     * Função para carregar os agendamentos confirmados para hoje
     * e preencher a tabela no modal de clientes.
     */
    function carregarAgendamentosConfirmados(){
        console.log("Carregando agendamentos confirmados para hoje...");
        var tbody = $("#tabelaClientesLoja tbody");
        tbody.empty();
        // Exibe spinner de loading enquanto aguarda a resposta
        tbody.append('<tr class="loading"><td colspan="7" class="text-center"><div class="spinner"></div> Carregando...</td></tr>');
        
        $.ajax({
            url: '/inss/api/get/confirmados/',  // Verifique se a URL está de acordo com suas rotas
            method: 'GET',
            dataType: 'json',
            success: function(response){
                console.log("Dados recebidos da API confirmados:", response);
                tbody.empty();
                var agendamentos = response.agendamentos || [];
                if(agendamentos.length > 0){
                    $.each(agendamentos, function(index, agendamento){
                        var linha = $("<tr></tr>");
                        
                        // Botão para o nome que chama o submodal (função abrirSubModalPorID deve estar definida globalmente)
                        var btnNome = $('<button type="button" class="btn-link abrir-sub-modal"></button>')
                            .text(agendamento.nome_cliente)
                            .attr("data-cpf", agendamento.cpf_cliente)
                            .attr("data-agendamento-id", agendamento.id)
                            .click(function(){
                                abrirSubModalPorID($(this));
                            });
                        
                        linha.append($("<td></td>").append(btnNome));
                        linha.append($("<td></td>").text(agendamento.cpf_cliente));
                        linha.append($("<td></td>").text(agendamento.numero_cliente));
                        linha.append($("<td></td>").attr("data-date", agendamento.dia_agendado).text(agendamento.dia_agendado));
                        linha.append($("<td></td>").text(agendamento.atendente_agendou));
                        linha.append($("<td></td>").text(agendamento.loja_agendada));
                        linha.append($("<td></td>").text(agendamento.status));
                        
                        tbody.append(linha);
                    });
                } else {
                    tbody.append('<tr><td colspan="7" class="text-center">Nenhum agendamento para hoje encontrado.</td></tr>');
                }
            },
            error: function(xhr, status, error){
                console.error("Erro ao carregar agendamentos confirmados:", error);
                tbody.empty();
                tbody.append('<tr><td colspan="7" class="text-center">Erro ao carregar agendamentos</td></tr>');
            }
        });
    }
    
    // Torna a função global se necessário em outros scripts
    window.carregarAgendamentosConfirmados = carregarAgendamentosConfirmados;
    
    // Chama a função assim que o documento estiver pronto
    carregarAgendamentosConfirmados();
});



$(document).ready(function(){
    /**
     * Abre o modal de confirmação de agendamento e preenche os campos com os dados do agendamento.
     * @param {Object} agendamento - Objeto contendo os dados do agendamento.
     */
    function abrirModalConfirmacao(agendamento) {
        // Preenche os campos do modal com os dados do agendamento
        $("#idAgendamentoConfirmacao").val(agendamento.id);
        $("#nomeClienteConfirmacao").val(agendamento.nome_cliente);
        $("#diaAgendadoConfirmacao").val(agendamento.dia_agendado);
        $("#lojaAgendadaConfirmacao").val(agendamento.loja_agendada);
        $("#numeroClienteConfirmacao").val(agendamento.numero_cliente);
        
        // Exibe o modal (ajuste a forma de abertura conforme sua estratégia de modais)
        $("#modalConfirmacaoAgendamento").addClass("active");
        console.log("Modal de confirmação aberto para o agendamento ID:", agendamento.id);
    }
    
    /**
     * Carrega os agendamentos com a tabulação "AGENDADO" e atualiza a tabela do modal de Confirmação Agendamento.
     * Os filtros do formulário são enviados via GET para a API.
     */
    function carregarAgendamentosConfirma(){
        console.log("Carregando agendamentos AGENDADOS...");
        var tbody = $("#tabelaAgendamentos tbody");
        tbody.empty();
        // Exibe spinner de loading enquanto aguarda a resposta
        tbody.append('<tr class="loading"><td colspan="6" class="text-center"><div class="spinner"></div> Carregando...</td></tr>');
        
        // Serializa os dados dos filtros do formulário
        var filtros = $("#formFiltroAgendamentosConfirma").serialize();
        console.log("Filtros aplicados:", filtros);
        
        $.ajax({
            url: '/inss/api/get/agendados/',  // Verifique se essa URL está de acordo com suas rotas
            method: 'GET',
            dataType: 'json',
            data: filtros,
            success: function(response) {
                console.log("Resposta da API (agendados):", response);
                tbody.empty();
                var agendamentos = response.agendamentos || [];
                
                if(agendamentos.length > 0){
                    $.each(agendamentos, function(index, agendamento){
                        var linha = $("<tr></tr>");
                        
                        // Cria um botão para o nome do cliente, que ao clicar abre o modal de confirmação
                        var btnNome = $('<button type="button" class="btn-link abrir-modal-confirmacao"></button>')
                            .text(agendamento.nome_cliente)
                            .click(function(){
                                abrirModalConfirmacao(agendamento);
                            });
                        
                        linha.append($("<td></td>").append(btnNome));
                        linha.append($("<td></td>").text(agendamento.numero_cliente));
                        linha.append($("<td></td>").text(agendamento.dia_agendado));
                        linha.append($("<td></td>").text(agendamento.atendente_agendou));
                        linha.append($("<td></td>").text(agendamento.loja_agendada));
                        linha.append($("<td></td>").text(agendamento.status));
                        
                        tbody.append(linha);
                    });
                } else {
                    tbody.append('<tr><td colspan="6" class="text-center">Nenhum agendamento encontrado.</td></tr>');
                }
            },
            error: function(xhr, status, error) {
                console.error("Erro ao carregar agendamentos:", error);
                tbody.empty();
                tbody.append('<tr><td colspan="6" class="text-center">Erro ao carregar agendamentos</td></tr>');
            }
        });
    }
    
    // Carrega os agendamentos assim que a página for carregada
    carregarAgendamentosConfirma();
    
    // Evento do formulário de filtros: ao enviar, evita o comportamento padrão e recarrega os dados
    $("#formFiltroAgendamentosConfirma").on("submit", function(e) {
        e.preventDefault();
        carregarAgendamentosConfirma();
    });
});



















/* FILTROS */
$(document).ready(function(){
    $("#formFiltroAgendamentos").on("submit", function(e){
        e.preventDefault(); // Impede o envio padrão

        // Serializa os dados do formulário
        var filtros = $(this).serialize();
        console.log("Enviando filtros para a API:", filtros);
        
        // Exibe o spinner de loading no tbody
        var tbody = $("#tabelaTodosAgendamentos tbody");
        tbody.empty();
        tbody.append('<tr class="loading"><td colspan="8" class="text-center"><div class="spinner"></div> Carregando...</td></tr>');
        
        $.ajax({
            url: '/inss/api/get/filter-all-agendamentos/',
            method: 'GET',
            data: filtros,  // os parâmetros são enviados na URL
            dataType: 'json',
            success: function(response) {
                console.log("Dados filtrados recebidos da API:", response);
                
                // Atualiza a tabela com os dados recebidos
                tbody.empty();
                
                var dadosFiltrados = response.todos_agend_table || [];
                if (dadosFiltrados.length > 0) {
                    $.each(dadosFiltrados, function(index, agendamento) {
                        var linha = $("<tr></tr>");
                        
                        // Se o status for FINALIZADO, exibe o nome sem ação
                        var btnNome;
                        if(agendamento.status === "FINALIZADO") {
                            btnNome = $('<span class="btn-link disabled"></span>').text(agendamento.nome_cliente);
                        } else {
                            btnNome = $('<button type="button" class="btn-link abrir-sub-modal"></button>')
                                .text(agendamento.nome_cliente)
                                .attr("data-cpf", agendamento.cpf_cliente)
                                .attr("data-agendamento-id", agendamento.id)
                                .click(function(){
                                    abrirSubModalPorID($(this));
                                });
                        }
                        linha.append($("<td></td>").append(btnNome));
                        linha.append($("<td></td>").text(agendamento.cpf_cliente));
                        linha.append($("<td></td>").text(agendamento.numero_cliente));
                        linha.append($("<td></td>").attr("data-date", agendamento.dia_agendado).text(agendamento.dia_agendado));
                        linha.append($("<td></td>").text(agendamento.atendente_agendou));
                        linha.append($("<td></td>").text(agendamento.loja_agendada));
                        linha.append($("<td></td>").text(agendamento.status));
                        linha.append($("<td></td>").text(agendamento.total_agendamentos));
                        
                        tbody.append(linha);
                    });
                } else {
                    tbody.append('<tr><td colspan="8" class="text-center">Nenhum agendamento encontrado</td></tr>');
                }
            },
            error: function(xhr, status, error) {
                console.error("Erro ao filtrar os agendamentos:", error);
                tbody.empty();
                tbody.append('<tr><td colspan="8" class="text-center">Erro ao aplicar filtros</td></tr>');
                alert("Erro ao aplicar filtros.");
            }
        });
    });
});

