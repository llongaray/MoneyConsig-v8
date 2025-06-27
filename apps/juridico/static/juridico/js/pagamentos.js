// Variável global para controlar o filtro de período
let filtroMensal = false;

// Event listener para o select de filtro
$(document).ready(function() {
    $('#filtroPeriodo').on('change', function() {
        filtroMensal = $(this).val() === 'mensal';
        console.log('[DEBUG] Filtro alterado para:', $(this).val(), 'Mensal:', filtroMensal);
        carregarTabelaPagamentos();
    });
});

// Função para obter o token CSRF do cookie
function getCookie(name) {
    console.log('[DEBUG] Buscando cookie:', name);
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                console.log('[DEBUG] Cookie encontrado:', name, cookieValue);
                break;
            }
        }
    }
    return cookieValue;
}

// Função para formatar valores monetários
function formatarValor(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor);
}

// Função para obter a classe CSS do status do pagamento
function getStatusPagamentoClass(status) {
    switch (status) {
        case 'Quitado':
            return 'text-success';
        case 'Em Andamento':
            return 'text-warning';
        case 'Cancelado':
            return 'text-danger';
        default:
            return 'text-secondary';
    }
}

// Função para template dos botões de ação
function templateBotoesPagamento(pagamento) {
    console.log('[DEBUG] Gerando template de botões para pagamento:', pagamento);
    return `
        <div class="btn-group" role="group">
            <button type="button" class="btn btn-sm btn-success" 
                    onclick="registrarPagamento(${pagamento.id_pagamento})" 
                    data-tooltip="Registrar Pagamento">
                <i class='bx bx-plus'></i>
            </button>
            <button type="button" class="btn btn-sm btn-info" 
                    onclick="visualizarDetalhes(${pagamento.id_pagamento})" 
                    data-tooltip="Ver Detalhes">
                <i class='bx bx-show'></i>
            </button>
        </div>
    `;
}

// Função para atualizar o mini-dashboard
function atualizarDashboard(pagamentos) {
    console.log('[DEBUG] Atualizando dashboard com', pagamentos.length, 'pagamentos');
    console.log('[DEBUG] Filtro mensal ativo:', filtroMensal);
    
    let totalQuitados = 0;
    let totalEmAndamento = 0;
    let countQuitados = 0;
    let countEmAndamento = 0;
    let countAtrasados = 0;
    let acoesAtrasadas = new Set();

    // Obtém o mês atual para filtro
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    pagamentos.forEach(pagamento => {
        // Aplica filtro mensal se ativo
        if (filtroMensal) {
            // Verifica se o pagamento foi criado no mês atual
            const dataPagamento = new Date(pagamento.data_criacao || pagamento.data_criacao_pagamento);
            if (dataPagamento.getMonth() !== mesAtual || dataPagamento.getFullYear() !== anoAtual) {
                return; // Pula este pagamento se não for do mês atual
            }
        }

        const valorTotal = parseFloat(pagamento.valor_total.replace(/[^\d,.-]/g, '').replace(',', '.'));
        
        // Quitados e Em Andamento continuam igual
        switch (pagamento.status_pagamento) {
            case 'Quitado':
                totalQuitados += valorTotal;
                countQuitados++;
                break;
            case 'Em Andamento':
                totalEmAndamento += valorTotal;
                countEmAndamento++;
                break;
        }
        
        // Novo: contar atrasados
        if ((pagamento.tipo_pagamento === 'Parcelado' || pagamento.tipo_pagamento === 'PARCELADO') && 
            pagamento.status_pagamento === 'Em Andamento' && 
            Array.isArray(pagamento.pagamentos_feitos)) {
            if (pagamento.pagamentos_feitos.some(pf => pf.flg_atrasado)) {
                acoesAtrasadas.add(pagamento.id_acao || pagamento.id_pagamento || pagamento.id);
            }
        }
    });
    countAtrasados = acoesAtrasadas.size;

    // Atualiza os elementos do dashboard
    $('#totalQuitados').text(formatarValor(totalQuitados));
    $('#totalEmAndamento').text(formatarValor(totalEmAndamento));
    $('#totalAtrasados').text(countAtrasados);

    $('#countQuitados').text(`${countQuitados} pagamento${countQuitados !== 1 ? 's' : ''}`);
    $('#countEmAndamento').text(`${countEmAndamento} pagamento${countEmAndamento !== 1 ? 's' : ''}`);
    $('#countAtrasados').text(`${countAtrasados} ação${countAtrasados !== 1 ? 's' : ''}`);

    console.log('[DEBUG] Dashboard atualizado:', {
        filtro: filtroMensal ? 'Mensal' : 'Total',
        quitados: { valor: totalQuitados, count: countQuitados },
        emAndamento: { valor: totalEmAndamento, count: countEmAndamento },
        atrasados: { count: countAtrasados }
    });
}

// Função para carregar a tabela de pagamentos
async function carregarTabelaPagamentos() {
    console.log('[DEBUG] Iniciando carregamento da tabela de pagamentos');
    try {
        const nome = $('#filtroNomePagamento').val();
        const cpf = $('#filtroCPFPagamento').val();
        const vendedor = $('#filtroVendedorPagamento').val();
        const status = $('#filtroStatusPagamento').val();
        const tipoAcao = $('#filtroTipoAcaoPagamento').val();

        console.log('[DEBUG] Filtros aplicados:', { nome, cpf, vendedor, status, tipoAcao });

        const response = await fetch(`/juridico/api/pagamentosacoes/?nome=${nome}&cpf=${cpf}&vendedor=${vendedor}&status=${status}&tipo_acao=${tipoAcao}`);
        const data = await response.json();

        console.log('[DEBUG] Resposta da API:', data);

        const tbody = $('#tabelaPagamentos tbody');
        tbody.empty();

        if (data.status === 'success' && data.data.length > 0) {
            console.log('[DEBUG] Total de pagamentos encontrados:', data.data.length);
            
            // Atualiza o dashboard com os dados
            atualizarDashboard(data.data);
            
            data.data.forEach(pagamento => {
                console.log('[DEBUG] Processando pagamento:', pagamento);
                const tr = `
                    <tr>
                        <td>${pagamento.nome_cliente}</td>
                        <td>${pagamento.cpf_cliente}</td>
                        <td>${pagamento.vendedor_nome}</td>
                        <td>${pagamento.tipo_acao}</td>
                        <td>${pagamento.tipo_pagamento}</td>
                        <td class="text-end">${formatarValor(pagamento.valor_total)}</td>
                        <td class="text-end">${formatarValor(pagamento.valor_restante)}</td>
                        <td class="text-center">
                            <span class="${getStatusPagamentoClass(pagamento.status_pagamento)}">
                                ${pagamento.status_pagamento}
                            </span>
                        </td>
                        <td class="text-center">${templateBotoesPagamento(pagamento)}</td>
                    </tr>
                `;
                tbody.append(tr);
            });
            $('#nenhumResultadoPagamentos').hide();
        } else {
            console.log('[DEBUG] Nenhum pagamento encontrado');
            // Atualiza o dashboard com array vazio
            atualizarDashboard([]);
            $('#nenhumResultadoPagamentos').show();
        }
    } catch (error) {
        console.error('[ERROR] Erro ao carregar pagamentos:', error);
        alert('Erro ao carregar pagamentos. Por favor, tente novamente.');
    }
}

// Função para registrar pagamento
async function registrarPagamento(pagamentoId) {
    console.log('[DEBUG] Iniciando registro de pagamento para ID:', pagamentoId);
    
    if (!pagamentoId) {
        console.error('[ERROR] ID do pagamento não fornecido');
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'ID do pagamento não fornecido'
        });
        return;
    }
    
    try {
        // Busca os detalhes do pagamento
        const response = await fetch(`/juridico/api/detalhes-pagamento/${pagamentoId}/`);
        if (!response.ok) {
            throw new Error(`Erro ao buscar detalhes do pagamento: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(data.message || 'Erro ao buscar detalhes do pagamento');
        }
        
        console.log('[DEBUG] Detalhes do pagamento:', data.data);
        
        // Limpa o formulário
        document.getElementById('formRegistrarPagamento').reset();
        
        // Define o ID do registro de pagamento
        document.getElementById('pagamentoId').value = pagamentoId;
        
        // Configura as máscaras
        $('#valorPago').mask('#.##0,00', {reverse: true});
        $('#jurosAtrasadoMensal').mask('#0,00', {reverse: true});
        
        // Configura o seletor de parcelas
        const divParcela = $('#divParcela');
        const selectParcela = $('#numeroParcela');
        selectParcela.empty();
        
        if (data.data.tipo_pagamento === 'PARCELADO' || data.data.tipo_pagamento === 'ENTRADA_PARCELAS') {
            divParcela.show();
            selectParcela.prop('required', true);
            
            // Adiciona as opções de parcelas disponíveis
            data.data.parcelas_disponiveis.forEach(parcela => {
                selectParcela.append(`<option value="${parcela.value}">${parcela.label}</option>`);
            });
        } else {
            divParcela.hide();
            selectParcela.prop('required', false);
        }
        
        // Configura os eventos dos checkboxes
        $('#flgAtrasado').on('change', function() {
            console.log('[DEBUG] Status do checkbox atrasado alterado:', this.checked);
            $('#divJurosAtrasado').toggle(this.checked);
            if (this.checked) {
                $('#jurosAtrasadoMensal').prop('required', true);
            } else {
                $('#jurosAtrasado').prop('required', false);
                $('#jurosAtrasadoMensal').val('');
            }
        });
        
        $('#flgAcordo').on('change', function() {
            console.log('[DEBUG] Status do checkbox acordo alterado:', this.checked);
            $('#divTipoAcordo').toggle(this.checked);
        });
        
        // Abre o modal
        const modal = new bootstrap.Modal(document.getElementById('modalRegistrarPagamento'));
        modal.show();
        
    } catch (error) {
        console.error('[ERROR] Erro ao carregar detalhes do pagamento:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message
        });
    }
}

// Função para visualizar detalhes do pagamento
async function visualizarDetalhes(pagamentoId) {
    console.log('[DEBUG] Iniciando visualização de detalhes para ID:', pagamentoId);
    
    if (!pagamentoId) {
        console.error('[ERROR] ID do pagamento não fornecido');
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: 'ID do pagamento não fornecido'
        });
        return;
    }
    
    try {
        // Busca os detalhes do pagamento
        const response = await fetch(`/juridico/api/detalhes-pagamento/${pagamentoId}/`);
        if (!response.ok) {
            throw new Error(`Erro ao buscar detalhes do pagamento: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status !== 'success') {
            throw new Error(data.message || 'Erro ao buscar detalhes do pagamento');
        }
        
        console.log('[DEBUG] Detalhes do pagamento:', data.data);
        
        // Prepara o conteúdo do modal
        let modalContent = `
            <div class="table-responsive">
                <table class="table table-bordered">
                    <tr>
                        <th>Tipo de Pagamento:</th>
                        <td>${data.data.tipo_pagamento}</td>
                    </tr>
                    <tr>
                        <th>Valor Total:</th>
                        <td>${formatarValor(data.data.valor_total)}</td>
                    </tr>
                    <tr>
                        <th>Valor de Entrada:</th>
                        <td>${formatarValor(data.data.valor_entrada)}</td>
                    </tr>
                    <tr>
                        <th>Status:</th>
                        <td>${data.data.status}</td>
                    </tr>
                    <tr>
                        <th>Responsável:</th>
                        <td>${data.data.responsavel_nome}</td>
                    </tr>
                    <tr>
                        <th>Contato do Cliente:</th>
                        <td>${data.data.contato_cliente}</td>
                    </tr>
                </table>
            </div>
        `;

        // Adiciona informações de parcelas se for pagamento parcelado
        if (data.data.tipo_pagamento === 'PARCELADO' || data.data.tipo_pagamento === 'ENTRADA_PARCELAS') {
            modalContent += `
                <div class="mt-3">
                    <h5>Informações de Parcelas</h5>
                    <table class="table table-bordered">
                        <tr>
                            <th>Total de Parcelas:</th>
                            <td>${data.data.parcelas_totais}</td>
                        </tr>
                        <tr>
                            <th>Parcelas Pagas:</th>
                            <td>${data.data.parcelas_pagas}</td>
                        </tr>
                        <tr>
                            <th>Parcelas Restantes:</th>
                            <td>${data.data.parcelas_restantes}</td>
                        </tr>
                    </table>
                </div>
            `;
        }

        // Adiciona histórico de pagamentos
        if (data.data.pagamentos_feitos && data.data.pagamentos_feitos.length > 0) {
            modalContent += `
                <div class="mt-3">
                    <h5>Histórico de Pagamentos</h5>
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Valor</th>
                                <th>Parcela</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            data.data.pagamentos_feitos.forEach(pagamento => {
                modalContent += `
                    <tr>
                        <td>${pagamento.data_pagamento}</td>
                        <td>${formatarValor(pagamento.valor_pago)}</td>
                        <td>${pagamento.parcela_paga || '-'}</td>
                        <td>
                            ${pagamento.flg_atrasado ? '<span class="text-danger">Atrasado</span>' : 
                              pagamento.flg_acordo ? '<span class="text-warning">Acordo</span>' : 
                              '<span class="text-success">Normal</span>'}
                        </td>
                    </tr>
                `;
            });

            modalContent += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Exibe o modal com os detalhes
        Swal.fire({
            title: 'Detalhes do Pagamento',
            html: modalContent,
            width: '800px',
            confirmButtonText: 'Fechar',
            confirmButtonColor: '#28a745'
        });
        
    } catch (error) {
        console.error('[ERROR] Erro ao carregar detalhes do pagamento:', error);
        Swal.fire({
            icon: 'error',
            title: 'Erro!',
            text: error.message
        });
    }
}

// Event Listeners
$(document).ready(function() {
    console.log('[DEBUG] Inicializando eventos do documento');
    
    // Máscara para o campo de valor
    $('#valorPago').mask('#.##0,00', {reverse: true});
    
    // Máscara para o campo de juros
    $('#jurosAtrasadoMensal').mask('##0,00', {reverse: true});
    
    // Controle de exibição do campo de juros
    $('#flgAtrasado').change(function() {
        console.log('[DEBUG] Evento change no checkbox atrasado:', $(this).is(':checked'));
        if ($(this).is(':checked')) {
            $('#divJurosAtrasado').slideDown();
            $('#jurosAtrasadoMensal').prop('required', true);
        } else {
            $('#divJurosAtrasado').slideUp();
            $('#jurosAtrasadoMensal').prop('required', false);
            $('#jurosAtrasadoMensal').val('');
        }
    });

    // Controle de exibição do campo de tipo de acordo
    $('#flgAcordo').change(function() {
        console.log('[DEBUG] Evento change no checkbox acordo:', $(this).is(':checked'));
        if ($(this).is(':checked')) {
            $('#divTipoAcordo').slideDown();
            $('#tipoAcordo').prop('required', true);
        } else {
            $('#divTipoAcordo').slideUp();
            $('#tipoAcordo').prop('required', false);
            $('#tipoAcordo').val('NENHUM');
        }
    });

    // Carregar tabela inicialmente
    carregarTabelaPagamentos();

    // Configurar eventos dos filtros
    $('#formFiltroPagamentos input, #formFiltroPagamentos select').on('change', function() {
        console.log('[DEBUG] Filtro alterado:', $(this).attr('id'), $(this).val());
        carregarTabelaPagamentos();
    });

    // Adiciona o evento de submit do formulário
    document.getElementById('formRegistrarPagamento').addEventListener('submit', async function(e) {
        e.preventDefault();
        console.log('[DEBUG] Formulário de pagamento submetido');
        
        const registroPagamentoId = document.getElementById('registroPagamentoId').value;
        if (!registroPagamentoId) {
            console.error('[ERROR] ID do registro de pagamento não encontrado');
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'ID do registro de pagamento não encontrado.'
            });
            return;
        }
        
        const valorPago = document.getElementById('valorPago').value.replace('.', '').replace(',', '.');
        const dataPagamento = document.getElementById('dataPagamento').value;
        
        console.log('[DEBUG] Dados do pagamento:', {
            registroPagamentoId,
            valorPago,
            dataPagamento
        });
        
        if (!valorPago || !dataPagamento) {
            console.error('[ERROR] Campos obrigatórios não preenchidos');
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: 'Por favor, preencha todos os campos obrigatórios.'
            });
            return;
        }
        
        const dados = {
            pagamento_id: parseInt(registroPagamentoId),
            valor_pago: valorPago,
            data_pagamento: dataPagamento,
            parcela_paga: document.getElementById('numeroParcela').value || null,
            flg_atrasado: document.getElementById('flgAtrasado').checked,
            flg_acordo: document.getElementById('flgAcordo').checked,
            juros_atrasado: document.getElementById('jurosAtrasadoMensal').value.replace(',', '.') || '0',
            tipo_acordo: document.getElementById('tipoAcordo').value,
            observacao: document.getElementById('observacaoPagamento').value
        };
        
        console.log('[DEBUG] Dados completos do pagamento:', dados);
        
        try {
            console.log('[DEBUG] Enviando requisição para registrar pagamento');
            const response = await fetch('/juridico/api/registrar-pagamento/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify(dados)
            });
            
            const data = await response.json();
            console.log('[DEBUG] Resposta da API:', data);
            
            if (response.ok) {
                console.log('[DEBUG] Pagamento registrado com sucesso');
                Swal.fire({
                    icon: 'success',
                    title: 'Sucesso!',
                    text: 'Pagamento registrado com sucesso!'
                }).then(() => {
                    // Fecha o modal
                    bootstrap.Modal.getInstance(document.getElementById('modalRegistrarPagamento')).hide();
                    // Recarrega a tabela
                    carregarTabelaPagamentos();
                });
            } else {
                throw new Error(data.message || 'Erro ao registrar pagamento');
            }
        } catch (error) {
            console.error('[ERROR] Erro ao registrar pagamento:', error);
            Swal.fire({
                icon: 'error',
                title: 'Erro!',
                text: error.message
            });
        }
    });
}); 