$(document).ready(function() {
    console.log("Documento pronto. Iniciando agendamento.js."); // Log 1

    // Função auxiliar para formatar CPF
    function formatarCPF(cpf) {
        if (!cpf) return 'N/A';
        const cpfLimpo = cpf.replace(/\D/g, ''); // Remove caracteres não numéricos
        if (cpfLimpo.length === 11) {
            return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        }
        return cpf; // Retorna o original se não tiver 11 dígitos após limpar
    }

    // Função auxiliar para formatar Data (YYYY-MM-DD HH:mm -> DD/MM/YYYY HH:mm)
    function formatarData(data) {
        if (!data) return 'N/A';
        
        // Verifica se a data tem o formato esperado (YYYY-MM-DD HH:mm)
        const partes = data.split(' ');
        if (partes.length !== 2) return 'N/A';
        
        const [dataPart, horaPart] = partes;
        const dataPartes = dataPart.split('-');
        if (dataPartes.length !== 3) return 'N/A';
        
        return `${dataPartes[2]}/${dataPartes[1]}/${dataPartes[0]} ${horaPart}`;
    }

    // Função para carregar e popular a tabela de Clientes em Loja
    function carregarClientesEmLoja() {
        const tabelaBody = $('#tabelaClientesEmLojaBody');
        const nenhumResultadoDiv = $('#nenhumResultadoEmLoja');
        const urlApi = '/inss/api/get/emloja/';

        console.log("Chamando carregarClientesEmLoja...");

        $.ajax({
            url: urlApi,
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                console.log("AJAX Success! Dados recebidos:", response);
                tabelaBody.empty();
                nenhumResultadoDiv.hide();

                if (response.agendamentos && response.agendamentos.length > 0) {
                    console.log("Clientes encontrados:", response.agendamentos.length);
                    response.agendamentos.forEach(function(cliente, index) {
                        console.log(`Processando cliente ${index + 1}:`, cliente);
                        const cpfFormatado = formatarCPF(cliente.cpf);
                        const dataFormatada = formatarData(cliente.data_presenca);
                        const nomeClienteUpper = cliente.nome ? cliente.nome.toUpperCase() : 'N/A';
                        const linha = `
                            <tr>
                                <td class="text-center">${nomeClienteUpper}</td>
                                <td class="text-center">${cpfFormatado}</td>
                                <td class="text-center">${cliente.loja || 'N/A'}</td>
                                <td class="text-center">${dataFormatada}</td>
                                <td class="text-center"><span class="badge bg-info">${cliente.tabulacao || 'N/A'}</span></td>
                            </tr>
                        `;
                        console.log("Adicionando linha:", linha);
                        tabelaBody.append(linha);
                    });
                } else {
                    console.log("Nenhum cliente em loja encontrado na resposta.");
                    nenhumResultadoDiv.text("Nenhum cliente encontrado em loja.").show();
                }
                console.log("População da tabela (clientes em loja) concluída.");
            },
            error: function(xhr, status, error) {
                console.error("AJAX Error! Status:", status, "Erro:", error, "XHR:", xhr);
                tabelaBody.empty();
                nenhumResultadoDiv.text(`Erro ao carregar dados (${status}): ${error}`).show();
            }
        });
    }

    // Carrega os dados da tabela de clientes em loja quando a página carregar
    carregarClientesEmLoja();

    // Adiciona um listener para recarregar os dados quando o card for expandido (opcional)
    // Útil se os dados puderem mudar enquanto a página está aberta
    $('#collapseClientesEmLoja').on('shown.bs.collapse', function () {
        console.log("Card Clientes em Loja expandido, recarregando dados..."); // Log 10
        carregarClientesEmLoja();
    });

    // ------ FUNÇÕES PARA TABELA DE CLIENTES QUE NÃO COMPARECERAM (ATRASADOS) ------

    // Função para carregar e popular a tabela de Agendamentos Atrasados
    function carregarAgendamentosAtrasados() {
        const tabelaBody = $('#tabelaAgendamentosAtrasados tbody'); // Seleciona o tbody correto
        const nenhumResultadoDiv = $('#nenhumResultadoAtrasados');
        const urlApi = '/inss/api/get/atrasados/'; // URL da API de atrasados

        console.log("Carregando agendamentos atrasados..."); // Log

        $.ajax({
            url: urlApi,
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                console.log("Agendamentos Atrasados - Dados recebidos:", response); // Log
                tabelaBody.empty();
                nenhumResultadoDiv.hide();

                if (response.agendamentos && response.agendamentos.length > 0) {
                    console.log("Agendamentos Atrasados encontrados:", response.agendamentos.length); // Log
                    response.agendamentos.forEach(function(agendamento, index) {
                        console.log(`Processando agendamento atrasado ${index + 1}:`, agendamento); // Log
                        const nomeClienteUpper = agendamento.nome ? agendamento.nome.toUpperCase() : 'N/A';
                        const cpfFormatado = formatarCPF(agendamento.cpf);
                        const dataFormatada = formatarData(agendamento.dia_agendado);

                        const linha = `
                            <tr data-id="${agendamento.id}">
                                <td class="text-center">${nomeClienteUpper}</td>
                                <td class="text-center">${cpfFormatado}</td>
                                <td class="text-center">${agendamento.numero || 'N/A'}</td>
                                <td class="text-center">${dataFormatada}</td>
                                <td class="text-center">${agendamento.atendente || 'N/A'}</td>
                                <td class="text-center">${agendamento.loja || 'N/A'}</td>
                            </tr>
                        `;
                        console.log("Adicionando linha (atrasados):", linha); // Log
                        tabelaBody.append(linha);
                    });
                } else {
                    console.log("Nenhum agendamento atrasado encontrado."); // Log
                    nenhumResultadoDiv.text("Nenhum cliente que não compareceu encontrado.").show();
                }
                console.log("População da tabela (atrasados) concluída."); // Log
            },
            error: function(xhr, status, error) {
                console.error("Erro ao buscar agendamentos atrasados:", status, error, xhr); // Log
                tabelaBody.empty();
                nenhumResultadoDiv.text(`Erro ao carregar dados (${status}): ${error}`).show();
            }
        });
    }

    // Carrega os dados da tabela de atrasados quando a página carregar
    carregarAgendamentosAtrasados();

    // Adiciona um listener para recarregar os dados quando o card for expandido
    $('#collapseAtrasados').on('shown.bs.collapse', function () {
        console.log("Card Atrasados expandido, recarregando dados..."); // Log
        carregarAgendamentosAtrasados();
    });

    // ------ FUNÇÕES PARA TABELA DE CONFIRMAÇÃO DE AGENDAMENTOS ------

    // Função para carregar e popular a tabela de Confirmação de Agendamentos
    function carregarAgendamentosConfirmacao() {
        const tabelaBody = $('#tabelaAgendamentosConfirma tbody');
        const nenhumResultadoDiv = $('#nenhumResultadoConfirma');
        const urlApi = '/inss/api/get/agendados/'; // API para agendamentos pendentes de confirmação

        console.log("Carregando agendamentos para confirmação...");

        $.ajax({
            url: urlApi,
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                console.log("Confirmação Agendamentos - Dados recebidos:", response);
                tabelaBody.empty();
                nenhumResultadoDiv.hide();

                if (response.agendamentos && response.agendamentos.length > 0) {
                    console.log("Agendamentos para confirmação encontrados:", response.agendamentos.length);
                    response.agendamentos.forEach(function(agendamento) {
                        const nomeClienteUpper = agendamento.nome_cliente ? agendamento.nome_cliente.toUpperCase() : 'N/A';
                        const cpfFormatado = formatarCPF(agendamento.cpf_cliente);
                        const dataFormatada = formatarData(agendamento.dia_agendado);
                        const statusBadge = '<span class="badge bg-warning text-dark">EM ESPERA</span>';
                        const cpfOriginal = agendamento.cpf_cliente || ''; // Pega o CPF original para o data attribute

                        const linha = `
                            <tr data-id="${agendamento.id}" data-cliente-id="${agendamento.cliente_agendamento_id}" data-loja-id="${agendamento.loja_id}" data-cpf="${cpfOriginal}">
                                <td class="text-center nome-cliente-link">${nomeClienteUpper}</td>
                                <td class="text-center">${cpfFormatado}</td>
                                <td class="text-center">${agendamento.numero_cliente || 'N/A'}</td>
                                <td class="text-center">${dataFormatada}</td>
                                <td class="text-center">${agendamento.atendente_agendou || 'N/A'}</td>
                                <td class="text-center">${agendamento.loja_agendada || 'N/A'}</td>
                                <td class="text-center">${statusBadge}</td>
                            </tr>
                        `;
                        tabelaBody.append(linha);
                    });
                } else {
                    console.log("Nenhum agendamento para confirmação encontrado.");
                    nenhumResultadoDiv.text("Nenhum agendamento para confirmação encontrado.").show();
                }
                console.log("População da tabela (confirmação) concluída.");
            },
            error: function(xhr, status, error) {
                console.error("Erro ao buscar agendamentos para confirmação:", status, error, xhr);
                tabelaBody.empty();
                nenhumResultadoDiv.text(`Erro ao carregar dados (${status}): ${error}`).show();
            }
        });
    }

    // ------ FUNÇÕES PARA TABELA DE REAGENDAMENTOS ------

    // Função para carregar e popular a tabela de Reagendamentos
    function carregarReagendamentos() {
        const tabelaBody = $('#tabelaReagendamentos tbody');
        const nenhumResultadoDiv = $('#nenhumResultadoReag');
        const urlApi = '/inss/api/get/reagendados/';

        console.log("Carregando reagendamentos...");

        $.ajax({
            url: urlApi,
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                console.log("Reagendamentos - Dados recebidos:", response);
                tabelaBody.empty();
                nenhumResultadoDiv.hide();

                if (response.agendamentos && response.agendamentos.length > 0) {
                    console.log("Reagendamentos encontrados:", response.agendamentos.length);
                    response.agendamentos.forEach(function(agendamento) {
                        const nomeClienteUpper = agendamento.nome_cliente ? agendamento.nome_cliente.toUpperCase() : 'N/A';
                        const cpfFormatado = formatarCPF(agendamento.cpf_cliente);
                        const dataFormatada = formatarData(agendamento.dia_agendado);
                        const statusBadge = '<span class="badge bg-secondary">REAGENDADO</span>';
                        const cpfOriginal = agendamento.cpf_cliente || ''; // Pega o CPF original

                        const linha = `
                            <tr data-id="${agendamento.id}" data-cliente-id="${agendamento.cliente_agendamento_id}" data-loja-id="${agendamento.loja_id}" data-cpf="${cpfOriginal}">
                                <td class="text-center nome-cliente-link">${nomeClienteUpper}</td>
                                <td class="text-center">${cpfFormatado}</td>
                                <td class="text-center">${agendamento.numero_cliente || 'N/A'}</td>
                                <td class="text-center">${dataFormatada}</td>
                                <td class="text-center">${agendamento.atendente_agendou || 'N/A'}</td>
                                <td class="text-center">${agendamento.loja_agendada || 'N/A'}</td>
                                <td class="text-center">${statusBadge}</td>
                            </tr>
                        `;
                        tabelaBody.append(linha);
                    });
                } else {
                    console.log("Nenhum reagendamento encontrado.");
                    nenhumResultadoDiv.text("Nenhum reagendamento encontrado.").show();
                }
                console.log("População da tabela (reagendamentos) concluída.");
            },
            error: function(xhr, status, error) {
                console.error("Erro ao buscar reagendamentos:", status, error, xhr);
                tabelaBody.empty();
                nenhumResultadoDiv.text(`Erro ao carregar dados (${status}): ${error}`).show();
            }
        });
    }

    // ------ FUNÇÕES DO MODAL ------

    // Função para fechar qualquer modal com a classe .modal-sec
    window.fecharModal = function(modalSelector) {
        $(modalSelector).hide();
         // Limpar campos do formulário ao fechar
         $(modalSelector).find('form').trigger('reset');
         $('#novaDataContainer').hide();
         $('#observacaoContainer').hide();
         $(modalSelector).find('.modal-body').removeClass('loading').find('.alert').remove();
    }

    // Função para abrir e popular o modal por ID do Agendamento
    window.abrirModalConfirmacao = function(agendamentoId) {
        if (!agendamentoId) {
            console.error("ID do agendamento não fornecido para abrir modal.");
            alert("Erro: ID do agendamento não encontrado.");
            return;
        }
        console.log(`Abrindo modal para agendamento ID: ${agendamentoId}`);
        const urlApi = `/inss/api/get/submodal-cliente/?agendamento_id=${agendamentoId}`; // Usa agendamento_id
        const modal = $('#modalConfirmacaoAgendamento');
        const form = modal.find('form');
        const modalBody = modal.find('.modal-body');

        // Limpa o form, campos condicionais, e mostra modal com loading
        form.trigger('reset');
        $('#novaDataContainer').hide();
        $('#observacaoContainer').hide();
        modalBody.addClass('loading');
        modalBody.find('.alert-danger').remove();
        modal.show();

        $.ajax({
            url: urlApi,
            type: 'GET',
            dataType: 'json',
            success: function(data) {
                modalBody.removeClass('loading');
                console.log("Dados do submodal (por ID) recebidos:", data);
                if (data) {
                    $('#idAgendamentoConfirmacao').val(data.id);
                    $('#nomeClienteConfirmacao').val(data.nome_cliente ? data.nome_cliente.toUpperCase() : '');
                    $('#numeroClienteConfirmacao').val(data.numero_cliente || '');
                    $('#diaAgendadoConfirmacao').val(data.dia_agendado || '');
                    $('#lojaAgendadaConfirmacao').val(data.loja_agendada || '');

                    // Reseta o select de status
                    $('#tabulacaoAtendente').val('');
                    handleTabulacaoChange();
                } else {
                    console.error("Nenhum dado retornado para o submodal (por ID).");
                    modalBody.append('<div class="alert alert-danger">Erro inesperado ao carregar detalhes.</div>');
                }
            },
            error: function(xhr, status, error) {
                modalBody.removeClass('loading');
                console.error("Erro ao buscar dados do submodal (por ID):", status, error, xhr);
                let errorMsg = `Erro ao carregar detalhes (${status}).`;
                if (xhr.responseJSON && xhr.responseJSON.texto) {
                    errorMsg = xhr.responseJSON.texto;
                }
                form.trigger('reset');
                modalBody.prepend(`<div class="alert alert-danger">${errorMsg}</div>`);
            }
        });
    }

    // Função para mostrar/esconder campos baseado na tabulação
    window.handleTabulacaoChange = function() {
        const statusSelecionado = $('#tabulacaoAtendente').val();
        const novaDataContainer = $('#novaDataContainer');
        const observacaoContainer = $('#observacaoContainer');

        if (statusSelecionado === 'REAGENDADO') {
            novaDataContainer.slideDown('fast');
            novaDataContainer.find('input').prop('required', true); // Torna obrigatório
            observacaoContainer.slideDown('fast'); // Mostra obs para reagendamento também
            observacaoContainer.find('textarea').prop('required', false); // Obs não obrigatória
        } else if (statusSelecionado === 'DESISTIU') {
            novaDataContainer.slideUp('fast');
            novaDataContainer.find('input').prop('required', false);
            observacaoContainer.slideDown('fast');
            observacaoContainer.find('textarea').prop('required', true); // Torna obrigatório para desistência
        } else { // Para CONFIRMADO ou vazio
            novaDataContainer.slideUp('fast');
            novaDataContainer.find('input').prop('required', false);
            observacaoContainer.slideUp('fast');
            observacaoContainer.find('textarea').prop('required', false);
        }
    }

    // ------ FUNÇÕES DE FILTRAGEM FRONTEND ------

    // Função auxiliar para formatar data da tabela (DD/MM/YYYY) para comparação (YYYY-MM-DD)
    function formatarDataParaComparacao(dataTexto) {
        if (!dataTexto || !dataTexto.includes('/')) return '';
        const partes = dataTexto.split('/');
        if (partes.length === 3) {
            // Garante que dia e mês tenham dois dígitos
            const dia = partes[0].padStart(2, '0');
            const mes = partes[1].padStart(2, '0');
            return `${partes[2]}-${mes}-${dia}`; // YYYY-MM-DD
        }
        return '';
    }

    // Função genérica para aplicar filtros a uma tabela HTML
    function aplicarFiltroTabela(formId, tabelaBodyId, nenhumResultadoId) {
        const form = $(formId);
        const tabelaBody = $(tabelaBodyId);
        const nenhumResultadoDiv = $(nenhumResultadoId);

        // Mapeamento de nome do filtro para índice da coluna (ajuste conforme cada tabela)
        let colunasIndices;
        if (tabelaBodyId.includes('Confirma')) {
            colunasIndices = { nomeCliente: 0, cpfCliente: 1, diaAgendado: 3, atendente: 4, lojaAgendada: 5, status: 6 };
        } else if (tabelaBodyId.includes('Reagendamentos')) {
            colunasIndices = { nomeCliente: 0, cpfCliente: 1, diaAgendado: 3, atendente: 4, lojaAgendada: 5, status: 6 };
        } else if (tabelaBodyId.includes('Atrasados')) {
            colunasIndices = { nomeCliente: 0, cpfCliente: 1, numero_cliente: 2, diaAgendado: 3, atendente: 4, lojaAgendada: 5 };
        } else if (tabelaBodyId.includes('EmLoja')) {
            colunasIndices = { nomeCliente: 0, cpfCliente: 1, lojaAgendada: 2, diaAgendado: 3, status: 4 }; // 'status' aqui é a tabulação do vendedor
        } else {
            colunasIndices = {}; // Padrão vazio ou pode logar um erro
            console.error("Índices de coluna não definidos para:", tabelaBodyId);
        }


        const executarFiltro = () => {
            const filtros = {};
            form.find(':input[name]').each(function() {
                filtros[this.name] = $(this).val().trim().toUpperCase();
            });

            console.log(`Filtrando ${tabelaBodyId} com:`, filtros); // Log

            let linhasVisiveis = 0;
            tabelaBody.find('tr').each(function() {
                const linha = $(this);
                let corresponde = true;

                for (const nomeFiltro in filtros) {
                    if (filtros[nomeFiltro] !== '') {
                        const indiceColuna = colunasIndices[nomeFiltro];
                        if (indiceColuna !== undefined) {
                            const celula = linha.find('td').eq(indiceColuna);
                            let valorCelula = '';

                            // Trata status/tabulação que podem estar em badges
                            if (nomeFiltro === 'status' || nomeFiltro === 'tabulacao_vendedor') {
                                const badge = celula.find('.badge');
                                if (badge.length > 0) {
                                    valorCelula = badge.text().trim().toUpperCase();
                                } else {
                                    valorCelula = celula.text().trim().toUpperCase();
                                }
                            } else if (nomeFiltro === 'diaAgendado') {
                                valorCelula = formatarDataParaComparacao(celula.text().trim()); // Formato YYYY-MM-DD
                                // Compara exatamente a data
                                if (valorCelula !== filtros[nomeFiltro] && filtros[nomeFiltro]) {
                                    corresponde = false;
                                    break; // Sai do loop de filtros para esta linha
                                }
                                continue; // Pula para o próximo filtro se a data correspondeu (ou se filtro de data está vazio)
                            } else if (nomeFiltro === 'cpfCliente') {
                                valorCelula = celula.text().trim().replace(/\D/g, ''); // Limpa formatação do CPF da célula
                                const filtroCpfLimpo = filtros[nomeFiltro].replace(/\D/g, '');
                                if (!valorCelula.includes(filtroCpfLimpo)) {
                                     corresponde = false;
                                     break;
                                 }
                                 continue; // Pula para o próximo filtro
                            }
                            else {
                                valorCelula = celula.text().trim().toUpperCase();
                            }

                            // Comparação padrão (contains)
                            if (!valorCelula.includes(filtros[nomeFiltro])) {
                                corresponde = false;
                                break; // Sai do loop de filtros para esta linha
                            }
                        }
                    }
                }


                if (corresponde) {
                    linha.show();
                    linhasVisiveis++;
                } else {
                    linha.hide();
                }
            });

            // Mostrar/Esconder mensagem de "Nenhum resultado"
            if (linhasVisiveis === 0) {
                nenhumResultadoDiv.show();
            } else {
                nenhumResultadoDiv.hide();
            }
             console.log(`Filtragem de ${tabelaBodyId} concluída. Linhas visíveis: ${linhasVisiveis}`); // Log
        };

        // Dispara o filtro em submit, keyup (para texto), input (geral), e change (para date/select)
        form.on('submit', function(event) {
            event.preventDefault(); // Previne o envio real do formulário
            executarFiltro();
        });
        form.find('input[type="text"], input[type="date"], select').on('keyup input change', executarFiltro);

        // Adiciona botão/lógica para limpar filtros (opcional, mas recomendado)
        // Exemplo: $(formId + ' .btn-limpar-filtro').on('click', function() { ... });
    }

    // ------ EVENT LISTENERS ------

    // Validação em tempo real do CPF no formulário de agendamento
    $('#cpf_cliente').on('blur', function() {
        const inputCPF = $(this);
        const valorCPF = inputCPF.val();
        const cpfLimpo = valorCPF.replace(/\D/g, ''); // Remove não-dígitos

        // Limpa validações anteriores se o campo estiver vazio
        if (cpfLimpo.length === 0) {
            inputCPF.css('box-shadow', 'none'); // Remove box-shadow
            return;
        }

        // Verifica se tem 11 dígitos após remover a formatação
        if (cpfLimpo.length !== 11) {
            inputCPF.css('box-shadow', '0 0 0 0.25rem rgba(220, 53, 69, 0.5)'); // Box-shadow vermelho (inválido por tamanho)
            return;
        }

        // Executa a validação com a função TestaCPF
        if (TestaCPF(cpfLimpo)) {
            inputCPF.css('box-shadow', '0 0 0 0.25rem rgba(25, 135, 84, 0.5)'); // Box-shadow verde (válido)
        } else {
            inputCPF.css('box-shadow', '0 0 0 0.25rem rgba(220, 53, 69, 0.5)'); // Box-shadow vermelho (inválido pelo cálculo)
        }
    });

    // Limpa validação visual (box-shadow) do CPF quando o formulário é resetado
    $('#formAgendamento').on('reset', function() {
         $('#cpf_cliente').css('box-shadow', 'none');
    });

    // Delegação de evento para cliques nos nomes
    $('#tabelaAgendamentosConfirma tbody, #tabelaReagendamentos tbody').on('click', '.nome-cliente-link', function() {
        const linha = $(this).closest('tr');
        const agendamentoId = linha.data('id'); // Pega o ID do atributo data-id

        if (agendamentoId) {
            abrirModalConfirmacao(agendamentoId); // Chama a função por ID
        } else {
            console.error("Não foi possível encontrar o ID do agendamento na linha clicada.");
            alert("Erro ao obter ID do agendamento.")
        }
    });

    // ------ SUBMISSÃO DO FORMULÁRIO DO MODAL ------
    $("#formConfirmacaoAgendamento").submit(function(e){
        e.preventDefault(); // Previne o comportamento padrão do formulário

        const $form = $(this);
        const $submitButton = $form.find('.btn-submit');
        const originalButtonText = $submitButton.html(); // Salva o texto original do botão


        // Captura os valores *essenciais* dos campos do formulário
        var agendamento_id = $("#idAgendamentoConfirmacao").val();
        var tabulacao_atendente = $("#tabulacaoAtendente").val();
        var nova_dia_agendado = $("#novaDiaAgendado").val();
        var observacao = $("#observacao").val();

        // Cria o objeto de dados base
        var dataObj = {
            agendamento_id: agendamento_id,
            tabulacao_atendente: tabulacao_atendente,
            funcionario_atendente: $('#atendente_agendou').val()
        };

        // Adiciona dados condicionais
        if (tabulacao_atendente === "REAGENDADO" && nova_dia_agendado) {
            dataObj.nova_dia_agendado = nova_dia_agendado;
        } else if (tabulacao_atendente === "REAGENDADO" && !nova_dia_agendado) {
             alert("Por favor, forneça a nova data para reagendamento.");
             // Reabilita o botão
            $submitButton.prop('disabled', false).html(originalButtonText);
            return; // Impede o envio do AJAX
        }

        if (tabulacao_atendente === "DESISTIU" && observacao) {
            dataObj.observacao = observacao;
        } else if (tabulacao_atendente === "DESISTIU" && !observacao) {
             alert("Por favor, forneça uma observação para desistência.");
              // Reabilita o botão
            $submitButton.prop('disabled', false).html(originalButtonText);
            return; // Impede o envio do AJAX
        }


        console.log("Enviando dados para /inss/api/post/confirmagem/:", dataObj); // Log

        // Envia os dados em formato JSON para a API
        $.ajax({
            url: "/inss/api/post/confirmagem/", // Endpoint correto
            type: "POST",
            data: JSON.stringify(dataObj),
            contentType: "application/json",
            headers: {
                // Certifique-se que o token CSRF está disponível globalmente ou no formulário
                'X-CSRFToken': $('input[name="csrfmiddlewaretoken"]').first().val()
            },
            dataType: "json",
            success: function(response) {
                console.log("Resposta da API (confirmagem):", response); // Log
                alert(response.texto || "Agendamento atualizado com sucesso!");

                // Fecha o modal
                fecharModal("#modalConfirmacaoAgendamento");

                // Recarrega as tabelas relevantes para refletir a mudança
                console.log("Recarregando tabelas após atualização..."); // Log
                carregarAgendamentosConfirmacao();
                carregarReagendamentos();
                carregarAgendamentosAtrasados(); // Recarrega atrasados também, pois um 'DESISTIU' pode resolver um atrasado
                // carregarClientesEmLoja(); // Descomentar se necessário

            },
            error: function(xhr, status, error) {
                console.error("Erro ao atualizar o agendamento:", status, error, xhr); // Log
                var mensagem = (xhr.responseJSON && xhr.responseJSON.texto) ? xhr.responseJSON.texto : "Erro ao atualizar o agendamento.";
                alert("Erro: " + mensagem);
            },
            complete: function() {
                 // Reabilita o botão e restaura o texto original, independentemente do resultado
                 $submitButton.prop('disabled', false).html(originalButtonText);
            }
        });
    });

    // ------ CHAMADAS INICIAIS ------
    carregarClientesEmLoja();
    carregarAgendamentosAtrasados();
    carregarAgendamentosConfirmacao(); // Chama a nova função
    carregarReagendamentos(); // Chama a nova função

    // Inicializar filtros frontend após o carregamento inicial dos dados
    // Espera um pouco para garantir que as tabelas foram populadas pelo AJAX
    setTimeout(() => {
        console.log("Inicializando filtros frontend..."); // Log
        aplicarFiltroTabela('#formFiltroAgendamentosConfirma', '#tabelaAgendamentosConfirma tbody', '#nenhumResultadoConfirma');
        aplicarFiltroTabela('#formFiltroReagendamento', '#tabelaReagendamentos tbody', '#nenhumResultadoReag');
        aplicarFiltroTabela('#formFiltroAtrasados', '#tabelaAgendamentosAtrasados tbody', '#nenhumResultadoAtrasados');
        // Se/quando filtros forem adicionados para "Clientes em Loja":
        // aplicarFiltroTabela('#formFiltroClientesEmLoja', '#tabelaClientesEmLoja tbody', '#nenhumResultadoEmLoja');
         console.log("Filtros frontend inicializados."); // Log
    }, 1500); // Atraso pequeno (ajuste se necessário)

    // Recarregar ao expandir os cards
    $('#collapseClientesEmLoja').on('shown.bs.collapse', carregarClientesEmLoja);
    $('#collapseAtrasados').on('shown.bs.collapse', carregarAgendamentosAtrasados);
    $('#collapseReagendamentos').on('shown.bs.collapse', carregarReagendamentos);
    // Para o card de confirmação (que não começa collapsed)
    // Se precisar recarregar dinamicamente, adicione um botão ou outro gatilho.
    // Ou recarregue quando o card principal for mostrado (se ele for colapsável)

    // NOVA FUNÇÃO: Carrega dados de lojas e funcionários para o formulário de agendamento
    function carregarLojasEFuncionarios() {
        console.log("Carregando lojas e funcionários..."); // Log

        $.ajax({
            url: '/inss/api/get/info-loja-funcionario/',
            type: 'GET',
            dataType: 'json',
            success: function(response) {
                console.log("Dados de lojas e funcionários recebidos:", response); // Log
                
                // Preenche o select de lojas
                const selectLoja = $('#loja_agendada');
                selectLoja.empty().append('<option value="">Selecione uma loja</option>');
                
                // Ordena as lojas pelo nome (opcional)
                const lojasArray = Object.values(response.lojas || {});
                lojasArray.sort((a, b) => a.nome.localeCompare(b.nome));
                
                lojasArray.forEach(function(loja) {
                    selectLoja.append(`<option value="${loja.id}">${loja.nome}</option>`);
                });
                
                // Preenche o select de funcionários
                const selectFuncionario = $('#atendente_agendou');
                selectFuncionario.empty().append('<option value="">Selecione um funcionário</option>');
                
                // Ordena os funcionários pelo nome (opcional)
                const funcionariosArray = Object.values(response.funcionarios || {});
                funcionariosArray.sort((a, b) => a.nome.localeCompare(b.nome));
                
                funcionariosArray.forEach(function(funcionario) {
                    selectFuncionario.append(`<option value="${funcionario.id}">${funcionario.nome}</option>`);
                });
                
                console.log("Selects de lojas e funcionários preenchidos com sucesso.");
            },
            error: function(xhr, status, error) {
                console.error("Erro ao carregar lojas e funcionários:", status, error, xhr); // Log
                alert("Erro ao carregar dados de lojas e funcionários. Por favor, recarregue a página.");
            }
        });
    }

    // NOVA LÓGICA: Envio do formulário de agendamento via AJAX
    $('#formAgendamento').submit(function(e) {
        e.preventDefault(); // Previne o comportamento padrão do formulário
        
        const $form = $(this);
        const $submitButton = $form.find('button[type="submit"]');
        const originalButtonText = $submitButton.html(); // Salva o texto original do botão
        
        // Captura os valores do formulário
        const nome_cliente = $('#nome_cliente').val().trim();
        const cpf_cliente = $('#cpf_cliente').val().trim();
        const numero_cliente = $('#numero_cliente').val().trim();
        const dia_agendado = $('#dia_agendado').val().trim();
        const loja_agendada = $('#loja_agendada').val();
        const funcionario_atendente = $('#atendente_agendou').val();
        
        // Validação manual antes de prosseguir - verifica se algum campo está vazio
        if (!nome_cliente || !cpf_cliente || !numero_cliente || !dia_agendado || !loja_agendada || !funcionario_atendente) {
            // Mostra um alerta se algum campo obrigatório estiver vazio
            alert("Por favor, preencha todos os campos obrigatórios antes de enviar.");
            return; // Impede o envio do formulário
        }
        
        // Desabilita o botão e mostra um indicador de loading
        $submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Agendando...');
        
        // Monta o objeto com os dados validados
        const formData = {
            nome_cliente: nome_cliente,
            cpf_cliente: cpf_cliente,
            numero_cliente: numero_cliente,
            dia_agendado: dia_agendado,
            loja_agendada: loja_agendada,
            funcionario_atendente: funcionario_atendente
        };
        
        console.log("Enviando dados para agendamento:", formData); // Log
        
        $.ajax({
            url: '/inss/api/post/agendamento/',
            type: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': $('input[name="csrfmiddlewaretoken"]').val()
            },
            dataType: 'json',
            success: function(response) {
                console.log("Resposta da API (agendamento):", response); // Log
                
                // Exibe a mensagem de sucesso
                alert(response.texto || "Agendamento realizado com sucesso!");
                
                // Limpa o formulário
                $form.trigger('reset');
                
                // Recarrega as tabelas relevantes
                carregarAgendamentosConfirmacao();
                carregarReagendamentos();
            },
            error: function(xhr, status, error) {
                console.error("Erro ao criar agendamento:", status, error, xhr); // Log
                const mensagem = (xhr.responseJSON && xhr.responseJSON.texto) 
                    ? xhr.responseJSON.texto 
                    : "Erro ao realizar agendamento. Tente novamente.";
                alert("Erro: " + mensagem);
            },
            complete: function() {
                // Reabilita o botão e restaura o texto original
                $submitButton.prop('disabled', false).html(originalButtonText);
            }
        });
    });

    // Chama a função para carregar lojas e funcionários quando a página carrega
    carregarLojasEFuncionarios();

    // Função de validação de CPF (Receita Federal)
    function TestaCPF(strCPF) {
        var Soma;
        var Resto;
        Soma = 0;
        // Remove caracteres não numéricos - Garantindo que só dígitos sejam processados
        strCPF = String(strCPF).replace(/\D/g, '');

        if (strCPF.length !== 11) return false; // Deve ter 11 dígitos

        // Verifica CPFs inválidos conhecidos (todos os dígitos iguais)
        if (/^(\d)\1{10}$/.test(strCPF)) return false;

        for (let i=1; i<=9; i++) Soma = Soma + parseInt(strCPF.substring(i-1, i)) * (11 - i);
        Resto = (Soma * 10) % 11;

        if ((Resto == 10) || (Resto == 11))  Resto = 0;
        if (Resto != parseInt(strCPF.substring(9, 10)) ) return false;

        Soma = 0;
        for (let i = 1; i <= 10; i++) Soma = Soma + parseInt(strCPF.substring(i-1, i)) * (12 - i);
        Resto = (Soma * 10) % 11;

        if ((Resto == 10) || (Resto == 11))  Resto = 0;
        if (Resto != parseInt(strCPF.substring(10, 11) ) ) return false;
        return true;
    }

}); // Fim do $(document).ready

// 1) Ao sair do campo de CPF, tenta buscar o nome no back-end
$('#cpf_cliente').on('blur', function() {
    const $cpfInput = $(this);
    const raw = $cpfInput.val() || '';
    const digits = raw.replace(/\D/g, '');          // remove máscara
    // só faz a busca se tiver 11 dígitos
    if (digits.length === 11) {
        // limpa o nome antes de buscar
        $('#nome_cliente').val('');
        $.ajax({
            url: '/inss/api/get/cpfclientenome/',
            type: 'GET',
            dataType: 'json',
            data: { cpf: raw },                      // envia com ou sem pontuação
            success: function(resp) {
                if (resp.nome) {
                    // preenche o nome retornado
                    $('#nome_cliente').val(resp.nome);
                } else {
                    // não encontrado (só cairá aqui se, por algum motivo, o servidor
                    // devolver 200 mas sem o campo `nome`)
                    $('#nome_cliente').val('');
                    console.warn('Cliente não encontrado para CPF', raw);
                }
            },
            error: function(xhr, status, err) {
                // falha na chamada: limpa e loga
                $('#nome_cliente').val('');
                console.error('Erro ao buscar nome por CPF:', status, err);
            }
        });
    } else {
        // se CPF não estiver completo, não faz nada (ou opcionalmente limpa)
        // $('#nome_cliente').val('');
    }
});