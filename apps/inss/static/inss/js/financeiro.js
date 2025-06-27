/**
 * Funções para gerenciamento de TACs na página financeira do INSS
 * 
 * Este módulo contém funções para:
 * 1. Carregar TACs pendentes da API
 * 2. Exibir os TACs na tabela
 * 3. Processar o pagamento de TACs
 * 4. Atualizar o valor do TAC
 */

/**
 * Lê um cookie pelo nome
 */
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        document.cookie.split(';').forEach(function(cookie) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
            }
        });
    }
    return cookieValue;
}
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
      if (!/^(GET|HEAD|OPTIONS|TRACE)$/.test(settings.type)) {
        xhr.setRequestHeader('X-CSRFToken', getCookie('csrftoken'));
      }
    }
  });

$(document).ready(function() {
    // 1) Pega o token do cookie
    const csrftoken = getCookie('csrftoken');
    console.log('CSRF token obtido no setup:', csrftoken);

    // 2) Configura o jQuery para enviar X-CSRFToken em todas as requisições não-GET
    $.ajaxSetup({
        beforeSend: function(xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/.test(settings.type) && csrftoken) {
                xhr.setRequestHeader('X-CSRFToken', csrftoken);
            }
        }
    });
    console.log('Documento pronto, inicializando módulo financeiro INSS');
    // Carrega os TACs pendentes ao iniciar a página
    carregarTACs();
    
    // Configura a atualização automática a cada 5 minutos
    console.log('Configurando atualização automática a cada 5 minutos');
    setInterval(carregarTACs, 300000);

    // Carrega os dados dos cards financeiros
    carregarCardsFinanceiro();

    // Carrega o histórico de pagamentos
    carregarHistoricoPagamentos();

    // Inicializa os tooltips
    console.log('Inicializando tooltips');
    $('[data-bs-toggle="tooltip"]').tooltip();
    
    // Adiciona evento de submit ao formulário de filtro
    $('#formFiltroFinanceiro').on('submit', function(e) {
        e.preventDefault(); // Impede o envio do formulário
        aplicarFiltros();
    });
    
    // Preenchimento do select de lojas
    carregarLojas();
});

/**
 * Carrega os TACs pendentes da API e atualiza a tabela
 */
function carregarTACs() {
    console.log('Iniciando carregamento de TACs pendentes');
    $.ajax({
        url: '/inss/api/get/tac/',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            console.log('Resposta da API recebida:', response);
            if (response.success) {
                const presencas = Array.isArray(response.presencas)
                    ? response.presencas
                    : (response.presencas ? [response.presencas] : []);
                console.log('Sucesso ao carregar TACs, registros:', presencas.length);
                atualizarTabelaTACs(presencas);
            } else {
                console.error('Erro retornado pela API:', response.error);
                exibirMensagemErro('Erro ao carregar TACs: ' + response.error);
            }
        },
        error: function(xhr, status, error) {
            console.error('Erro na requisição AJAX:', status, error);
            console.error('Detalhes do XHR:', xhr);
            exibirMensagemErro('Erro na requisição: ' + error);
        }
    });
}

/**
 * Atualiza a tabela de TACs com os dados recebidos da API
 * @param {Array} presencas - Lista de presenças com TACs pendentes
 */
function atualizarTabelaTACs(presencas) {
    console.log('Iniciando atualização da tabela de TACs');
    presencas = Array.isArray(presencas) ? presencas : (presencas ? [presencas] : []);
    const $tabela = $('#tabelaAgendamentosTAC tbody');
    $tabela.empty();

    if (presencas.length === 0) {
        $('#nenhumResultadoTAC').show();
        return;
    }
    $('#nenhumResultadoTAC').hide();

    // Tenta obter CSRF do cookie
    let csrftoken = getCookie('csrftoken');
    if (!csrftoken) {
        // fallback: lê do form escondido no HTML
        csrftoken = $('#dummy-csrf input[name="csrfmiddlewaretoken"]').val();
        console.warn('CSRF via cookie não encontrado, usando dummy form.');
    }

    presencas.forEach(function(presenca) {
        const valorTacNumerico = presenca.valor_tac
            .replace('R$', '').replace(/\./g, '').replace(',', '.').trim();

        // Formulário para atualizar valor
        const formValor = `
            <form class="form-valor-tac">
              <input type="hidden" name="csrfmiddlewaretoken" value="${csrftoken}">
              <input type="hidden" name="presenca_id" value="${presenca.id}">
              <input type="text"
                     class="form-control form-control-sm input-valor-tac"
                     name="valor_tac"
                     value="${valorTacNumerico}"
                     data-valor-original="${valorTacNumerico}">
            </form>`;

        // Formulário para confirmar pagamento
        const formConfirmar = `
            <form class="form-confirmar-tac">
              <input type="hidden" name="csrfmiddlewaretoken" value="${csrftoken}">
              <input type="hidden" name="presenca_id" value="${presenca.id}">
              <button type="submit" class="btn btn-sm btn-success">
                <i class="bx bx-check"></i> Confirmar
              </button>
            </form>`;

        // Monta a linha da tabela
        const $tr = $(`
            <tr>
              <td>${presenca.nome_cliente}</td>
              <td>${presenca.cpf_cliente}</td>
              <td>${presenca.loja}</td>
              <td>${presenca.data}</td>
              <td class="text-end">${formValor}</td>
              <td class="text-center">${formConfirmar}</td>
            </tr>
        `);

        $tabela.append($tr);
    });

    // Bind blur no input de valor TAC
    $('.form-valor-tac').off('blur', '.input-valor-tac').on('blur', '.input-valor-tac', function() {
        const $form = $(this).closest('form');
        const id    = $form.find('input[name="presenca_id"]').val();
        const novo  = $(this).val();
        const orig  = $(this).data('valor-original');
        if (novo !== orig) {
            atualizarValorTAC($form);
        }
    });

    // Bind submit no form de confirmação
    $('.form-confirmar-tac').off('submit').on('submit', function(e) {
        e.preventDefault();
        const $form = $(this);
        const id    = $form.find('input[name="presenca_id"]').val();
        confirmarPagamentoTAC(id);
    });

    // Reinicia tooltips
    $('[data-bs-toggle="tooltip"]').tooltip();
}


/**
 * Faz o POST para atualizar o valor do TAC
 * @param {jQuery} $form - o form .form-valor-tac onde veio o input
 */
function atualizarValorTAC($form) {
    // Lê o ID e o novo valor diretamente do form
    const presencaId = $form.find('input[name="presenca_id"]').val();
    const $input     = $form.find('input[name="valor_tac"]');
    const novoValor  = $input.val();
    const original   = $input.data('valor-original');

    // Se não houve alteração, sai
    if (novoValor === original) {
        return;
    }

    console.log('Iniciando atualização de valor TAC para presença ID:', presencaId);

    // Tenta CSRF via cookie
    let csrftoken = getCookie('csrftoken');
    if (!csrftoken) {
        // fallback: lê do dummy form
        csrftoken = $('#dummy-csrf input[name="csrfmiddlewaretoken"]').val();
        if (!csrftoken) {
            exibirMensagemErro('Erro: Token CSRF não encontrado. Recarregue a página.');
            return;
        }
    }

    // Desabilita o input enquanto atualiza
    $input.prop('disabled', true);

    $.ajax({
        url: '/inss/api/post/attvalortac/',
        type: 'POST',
        dataType: 'json',
        data: {
            id: presencaId,
            valor_tac: novoValor
        },
        headers: {
            'X-CSRFToken': csrftoken
        },
        success: function(response) {
            if (response.success) {
                // atualiza o valor original e mostra sucesso
                $input.data('valor-original', novoValor);
                exibirMensagemSucesso(response.message);
            } else {
                // mostra erro e restaura valor
                exibirMensagemErro(response.message);
                $input.val(original);
            }
        },
        error: function(xhr, status, error) {
            let msg = 'Erro ao atualizar valor TAC';
            try {
                const r = JSON.parse(xhr.responseText);
                if (r.message) msg = r.message;
            } catch(_) {}
            exibirMensagemErro(msg + ': ' + error);
            $input.val(original);
        },
        complete: function() {
            // reabilita o input
            $input.prop('disabled', false);
        }
    });
}



/**
 * Envia requisição para confirmar o pagamento de um TAC
 * 
 * @param {number} presencaId - ID da presença a ser confirmada
 */
function confirmarPagamentoTAC(presencaId) {
    // tenta CSRF via cookie
    let csrftoken = getCookie('csrftoken');
    if (!csrftoken) {
        // fallback: lê do dummy form escondido no HTML
        csrftoken = $('#dummy-csrf input[name="csrfmiddlewaretoken"]').val();
        console.warn('CSRF token não encontrado no cookie; usando dummy form.');
    }
    if (!csrftoken) {
        console.error('Token CSRF não encontrado.');
        return exibirMensagemErro('Erro: Token CSRF não encontrado. Recarregue a página.');
    }

    if (!confirm('Confirmar o pagamento deste TAC?')) {
        console.log('Confirmação cancelada pelo usuário');
        return;
    }

    $.ajax({
        url: '/inss/api/post/tac/',
        type: 'POST',
        dataType: 'json',
        data: { presenca_id: presencaId },
        headers: { 'X-CSRFToken': csrftoken },
        success: function(response) {
            console.log('Resposta da API recebida:', response);
            if (response.success) {
                exibirMensagemSucesso(response.message);
                carregarTACs();
            } else {
                exibirMensagemErro(response.message);
            }
        },
        error: function(xhr, status, error) {
            console.error('Erro na requisição AJAX:', status, error);
            let msg = 'Erro ao processar pagamento';
            try {
                const r = JSON.parse(xhr.responseText);
                if (r.message) msg = r.message;
            } catch(_) {}
            exibirMensagemErro(msg + ': ' + error);
        }
    });
}

/**
 * Exibe uma mensagem de sucesso temporária
 * 
 * @param {string} mensagem - Mensagem a ser exibida
 */
function exibirMensagemSucesso(mensagem) {
    console.log('Exibindo mensagem de sucesso:', mensagem);
    alert('Sucesso!\n' + mensagem);
}

/**
 * Exibe uma mensagem de erro usando alert
 * 
 * @param {string} mensagem - Mensagem de erro a ser exibida
 */
function exibirMensagemErro(mensagem) {
    console.error('Exibindo mensagem de erro:', mensagem);
    alert('Erro:\n' + mensagem);
}

/**
 * Obtém o valor de um cookie pelo nome
 * 
 * @param {string} name - Nome do cookie
 * @return {string} Valor do cookie ou string vazia
 */
function getCookie(name) {
    console.log('Buscando cookie com nome:', name);
    let cookieValue = '';
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        console.log('Cookies encontrados:', cookies.length);
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                console.log('Cookie encontrado, valor:', cookieValue);
                break;
            }
        }
    }
    if (!cookieValue) {
        console.log('Cookie não encontrado');
    }
    return cookieValue;
}

function carregarCardsFinanceiro() {
    $.ajax({
        url: '/inss/api/get/cardsfinanceiro/',
        type: 'GET',
        dataType: 'json',
        beforeSend: function(xhr) {
            xhr.setRequestHeader("X-CSRFToken", getCookie("csrftoken"));
        },
        success: function(response) {
            console.log('Resposta da API cardsfinanceiro:', response);
            
            // Verificamos se a resposta existe e não tem erro
            if (response && !response.error) {
                // Atualizamos com os dados retornados pela API usando os IDs corretos do HTML
                $('#totalTCAno').text(response.totalTCAno || 'R$ 0,00');
                $('#totalTCAnoPendente').text(response.totalTCAnoPendente || 'R$ 0,00');
                $('#totalTCMes').text(response.totalTCMes || 'R$ 0,00');
                $('#totalTCMesPendente').text(response.totalTCMesPendente || 'R$ 0,00');
                $('#qtdTCAno').text(response.qtdTCAno || '0');
                $('#qtdTCMes').text(response.qtdTCMes || '0');
            } else {
                let errorMsg = 'Erro ao processar dados dos cards financeiros';
                if (response && response.error) {
                    errorMsg += ': ' + response.error;
                }
                exibirMensagemErro(errorMsg);
                console.error('Resposta da API inválida:', response);
            }
        },
        error: function(xhr, status, error) {
            exibirMensagemErro('Erro ao carregar dados dos cards financeiros');
            console.error('Erro na requisição AJAX:', status, error);
            console.error('Resposta do servidor:', xhr.responseText);
        }
    });
}

function carregarHistoricoPagamentos() {
    console.log('Iniciando carregamento do histórico de pagamentos');
    $.ajax({
        url: '/inss/api/get/historicopagamentos/',
        type: 'GET',
        dataType: 'json',
        beforeSend: function(xhr) {
            xhr.setRequestHeader("X-CSRFToken", getCookie("csrftoken"));
        },
        success: function(response) {
            console.log('Resposta da API de histórico:', response);
            if (response.historico) {
                const historico = Array.isArray(response.historico)
                    ? response.historico
                    : [response.historico];
                atualizarTabelaHistorico(historico);
            } else if (response.error) {
                console.error('Erro retornado pela API de histórico:', response.error);
                exibirMensagemErro('Erro ao carregar histórico: ' + response.error);
            } else {
                console.error('Resposta inválida da API de histórico:', response);
                exibirMensagemErro('Erro: resposta inválida da API de histórico');
            }
        },
        error: function(xhr, status, error) {
            console.error('Erro na requisição AJAX de histórico:', status, error);
            exibirMensagemErro('Erro ao carregar histórico: ' + error);
        }
    });
}

function atualizarTabelaHistorico(historico) {
    console.log('Atualizando tabela de histórico com', historico.length, 'registros');
    historico = Array.isArray(historico) ? historico : [];
    const tabela = $('#tabelaHistoricoPagamentos tbody');
    tabela.empty();
    
    if (historico.length > 0) {
        $('#nenhumResultadoHistorico').hide();
        historico.forEach(function(pagamento) {
            const btnAcao = pagamento.status_pagamento === 'PAGO'
                ? `<button class="btn btn-sm btn-info" disabled>Pago</button>`
                : `<button class="btn btn-sm btn-success btn-confirmar-tac"
                          data-id="${pagamento.id}"
                          data-bs-toggle="tooltip"
                          title="Confirmar Pagamento">
                       <i class="bx bx-check"></i> Confirmar
                   </button>`;
            tabela.append(`
                <tr>
                    <td>${pagamento.cliente_nome}</td>
                    <td>${pagamento.cliente_cpf}</td>
                    <td>${pagamento.loja_nome}</td>
                    <td>${pagamento.data_pagamento}</td>
                    <td class="text-end">${pagamento.valor_tac}</td>
                    <td class="text-center">
                        <span class="badge ${pagamento.status_pagamento === 'PAGO' ? 'bg-success' : 'bg-warning'}">
                            ${pagamento.status_pagamento}
                        </span>
                    </td>
                    <td class="text-center">
                        ${btnAcao}
                    </td>
                </tr>
            `);
        });
        $('[data-bs-toggle="tooltip"]').tooltip();
        $('.btn-confirmar-tac').off('click').on('click', function() {
            const presencaId = $(this).data('id');
            confirmarPagamentoTAC(presencaId);
        });
    } else {
        $('#nenhumResultadoHistorico').show();
    }
}

// Função para carregar lojas no select de filtro
function carregarLojas() {
    $.ajax({
        url: '/inss/api/get/info-loja-funcionario/',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            console.log('Resposta da API lojas:', response.lojas);
            // Garante que temos um array (mesmo que venha objeto ou undefined)
            const lojas = Array.isArray(response.lojas) 
                ? response.lojas 
                : (response.lojas ? [response.lojas] : []);
            
            const selectLoja = $('#filtro_loja');
            lojas.forEach(function(loja) {
                selectLoja.append(`<option value="${loja.nome}">${loja.nome}</option>`);
            });
        },
        error: function(xhr, status, error) {
            console.error('Erro ao carregar lojas:', error);
        }
    });
}

// Função para aplicar filtros na tabela
function aplicarFiltros() {
    const periodo = $('#filtro_periodo').val();
    const dataEspecifica = $('#filtro_data_especifica').val();
    const loja = $('#filtro_loja').val();
    const status = $('#filtro_status').val();
    
    console.log('Aplicando filtros:', { periodo, dataEspecifica, loja, status });
    
    // --- Funções auxiliares para validação de datas ---
    
    // Verifica se uma data está no período selecionado
    function estaNoPerioido(dataStr, periodo) {
        if (!periodo || periodo === '') return true;
        if (!dataStr || dataStr === '-') return false;
        
        // Converte data formato DD/MM/YYYY para Date
        const partes = dataStr.split('/');
        if (partes.length !== 3) return false;
        
        const data = new Date(partes[2], partes[1] - 1, partes[0]);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        if (periodo === 'HOJE') {
            return data.getDate() === hoje.getDate() && 
                   data.getMonth() === hoje.getMonth() && 
                   data.getFullYear() === hoje.getFullYear();
        }
        
        if (periodo === 'SEMANA') {
            const inicioSemana = new Date(hoje);
            inicioSemana.setDate(hoje.getDate() - hoje.getDay()); // Domingo
            
            const fimSemana = new Date(inicioSemana);
            fimSemana.setDate(inicioSemana.getDate() + 6); // Sábado
            
            return data >= inicioSemana && data <= fimSemana;
        }
        
        if (periodo === 'MES') {
            return data.getMonth() === hoje.getMonth() && 
                   data.getFullYear() === hoje.getFullYear();
        }
        
        return true;
    }
    
    // Verifica se bate com a data específica
    function correspondeDataEspecifica(dataStr, dataEspecifica) {
        if (!dataEspecifica || dataEspecifica === '') return true;
        if (!dataStr || dataStr === '-') return false;
        
        // Converte data formato DD/MM/YYYY para comparar com dataEspecifica (YYYY-MM-DD)
        const partes = dataStr.split('/');
        if (partes.length !== 3) return false;
        
        const dataFormatada = `${partes[2]}-${partes[1]}-${partes[0]}`;
        return dataFormatada === dataEspecifica;
    }
    
    // --- Filtro da Tabela de Histórico de Pagamentos ---
    let totalHistoricoVisiveis = 0;
    
    $('#tabelaHistoricoPagamentos tbody tr').each(function() {
        const $row = $(this);
        const rowLoja = $row.find('td:eq(2)').text().trim();
        const rowData = $row.find('td:eq(3)').text().trim();
        const rowStatus = $row.find('td:eq(5)').text().trim();
        
        // Verifica se a linha atende a todos os critérios
        const atendeLoja = !loja || loja === '' || rowLoja === loja;
        const atendePeriodo = estaNoPerioido(rowData, periodo);
        const atendeDataEspecifica = correspondeDataEspecifica(rowData, dataEspecifica);
        const atendeStatus = !status || status === '' || rowStatus.includes(status);
        
        const deveExibir = atendeLoja && atendePeriodo && atendeDataEspecifica && atendeStatus;
        
        if (deveExibir) {
            $row.show();
            totalHistoricoVisiveis++;
        } else {
            $row.hide();
        }
    });
    
    // Exibe mensagem se não houver resultados na tabela de histórico
    if (totalHistoricoVisiveis === 0) {
        $('#nenhumResultadoHistorico').show();
    } else {
        $('#nenhumResultadoHistorico').hide();
    }
    
    // --- Filtro da Tabela de TACs Pendentes ---
    let totalTacVisiveis = 0;
    
    $('#tabelaAgendamentosTAC tbody tr').each(function() {
        const $row = $(this);
        const rowNome = $row.find('td:eq(0)').text().trim();
        const rowCpf = $row.find('td:eq(1)').text().trim();
        const rowLoja = $row.find('td:eq(2)').text().trim();
        const rowData = $row.find('td:eq(3)').text().trim();
        
        // Verifica se a linha atende aos critérios aplicáveis (TACs não têm status)
        const atendeLoja = !loja || loja === '' || rowLoja === loja;
        const atendePeriodo = estaNoPerioido(rowData, periodo);
        const atendeDataEspecifica = correspondeDataEspecifica(rowData, dataEspecifica);
        // O filtro de status não se aplica à tabela de TACs pendentes, pois eles ainda não foram pagos
        
        const deveExibir = atendeLoja && atendePeriodo && atendeDataEspecifica;
        
        if (deveExibir) {
            $row.show();
            totalTacVisiveis++;
        } else {
            $row.hide();
        }
    });
    
    // Exibe mensagem se não houver resultados na tabela de TACs
    if (totalTacVisiveis === 0) {
        $('#nenhumResultadoTAC').show();
    } else {
        $('#nenhumResultadoTAC').hide();
    }
    
    // Exibe uma mensagem no console
    console.log(`Filtros aplicados. Exibindo ${totalHistoricoVisiveis} registros de histórico e ${totalTacVisiveis} TACs pendentes.`);
}

