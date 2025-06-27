$(document).ready(function() {    // Constantes para os IDs e URLs
    const API_URL = '/inss/api/dashboard';
    
    // Elementos do DOM
    const $periodoSelect = $('#periodo-select');
    const $periodoDisplay = $('#periodo-display');
    
    // Cards de métricas principais
    const $totalAgendamentos = $('#valor-total-agendamentos');
    const $confirmados = $('#valor-confirmados');
    const $finalizados = $('#valor-finalizados');
    const $atrasados = $('#valor-atrasados');
    const $clientesUnicos = $('#valor-clientes-unicos');
    
    // Elementos financeiros
    const $tacMedio = $('#valor-tac-medio');
    const $tacMenor = $('#valor-tac-menor');
    const $tacMaior = $('#valor-tac-maior');
    const $efetividadeGeral = $('#valor-efetividade');
    const $totalVendas = $('#valor-total-vendas');
    const $valorTotalVendas = $('#valor-total-vendas-valor');
    
    // Métricas detalhadas
    const $presencasAgendadas = $('#valor-presencas-agendadas');
    const $presencasRua = $('#valor-presencas-rua');
    const $comAcao = $('#valor-com-acao');
    const $comAssociacao = $('#valor-com-associacao');
    const $comAumento = $('#valor-com-aumento');
    const $comSubsidio = $('#valor-com-subsidio');
    
    // Sessões de cards
    const $sessaoBodyVendedores = $('#sessao-body-vendedores');
    const $sessaoBodyLojas = $('#sessao-body-lojas');
    const $sessaoBodyEfetividade = $('#sessao-body-efetividade');
    
    // Tabela TAC
    const $corpoTabelaTacs = $('#corpo-tabela-tacs');
    
    // Insights
    const $insightsContent = $('#insights-content');
    
    // Timestamp
    const $lastUpdateTime = $('#last-update-time');
    
    // Período atual, inicialmente 'mes'
    let periodoAtual = $periodoSelect.val() || 'mes';
    
    // Inicialização: carrega os dados pela primeira vez
    carregarDadosDashboard();
    
    // Event listener para mudança no seletor de período
    $periodoSelect.on('change', function() {
        periodoAtual = $(this).val();
        carregarDadosDashboard();
    });
    
    /**
     * Função principal que carrega dados do dashboard da API
     */
    function carregarDadosDashboard() {
        // Mostra indicadores de carregamento
        mostrarCarregando();
        
        // Faz a chamada AJAX para a API
        let url = API_URL + '/' + periodoAtual;
        $.ajax({
            url: url,
            method: 'GET',
            dataType: 'json',
            success: function(data) {
                // Processa os dados retornados
                atualizarDashboard(data);
                // Atualiza timestamp
                $lastUpdateTime.text(new Date().toLocaleString('pt-BR'));
            },
            error: function(xhr, status, error) {
                console.error('Erro ao carregar dados do dashboard:', xhr.responseText || error);
                mostrarErro('Não foi possível carregar os dados do dashboard. Tente novamente mais tarde.');
            }
        });
    }
    
    /**
     * Atualiza todos os elementos do dashboard com os dados da API
     * @param {Object} data - O objeto JSON retornado pela API
     */
    function atualizarDashboard(data) {
        if (!data) return;
        
        // 1. Atualiza informações do período
        atualizarInfoPeriodo(data.periodo);
        
        // 2. Atualiza métricas de agendamentos
        atualizarMetricasAgendamentos(data.metricas_agendamentos);
        
        // 3. Atualiza métricas financeiras
        atualizarMetricasFinanceiras(data.metricas_financeiras);
        
        // 4. Atualiza métricas detalhadas
        atualizarMetricasDetalhadas(data.metricas_detalhadas);
        
        // 5. Atualiza tabelas
        atualizarTabelaVendedores(data.vendas_por_vendedor);
        atualizarTabelaLojas(data.vendas_por_loja);
        atualizarTabelaEfetividade(data.efetividade_loja);
        atualizarSituacaoTAC(data.situacao_tac);
        
        // 6. Atualiza insights
        if (data.insights) {
            atualizarInsights(data.insights);
        } else {
            $insightsContent.html('<p class="text-center text-muted">Nenhuma análise disponível para o período selecionado.</p>');
        }
    }
    
    /**
     * Atualiza informações do período no topo do dashboard
     */
    function atualizarInfoPeriodo(periodo) {
        if (!periodo) return;
        
        // Atualiza a exibição do período
        $periodoDisplay.text(periodo.inicio + ' a ' + periodo.fim);
        
        // Garante que o select esteja na opção correta
        $periodoSelect.val(periodo.tipo);
    }
    
    /**
     * Atualiza os contadores de métricas de agendamentos
     */
    function atualizarMetricasAgendamentos(metricas) {
        if (!metricas) return;
        
        // Atualiza os valores nos elementos HTML
        $totalAgendamentos.text(metricas.total || 0);
        $confirmados.text(metricas.confirmados || 0);
        $finalizados.text(metricas.finalizados || 0);
        $atrasados.text(metricas.atrasados || 0);
        $clientesUnicos.text(metricas.clientes_unicos || 0);
    }
    
    /**
     * Atualiza os contadores de métricas financeiras
     */
    function atualizarMetricasFinanceiras(metricas) {
        if (!metricas) return;
        
        // Atualiza os valores nos elementos HTML
        $tacMedio.text(metricas.tac_medio || 'R$ 0,00');
        $tacMenor.text(metricas.tac_menor || 'R$ 0,00');
        $tacMaior.text(metricas.tac_maior || 'R$ 0,00');
        $efetividadeGeral.text(metricas.efetividade_geral || '0%');
        $totalVendas.text(metricas.total_vendas || 0);
        $valorTotalVendas.text(metricas.valor_total_vendas || 'R$ 0,00');
    }
    
    /**
     * Atualiza as métricas detalhadas
     */
    function atualizarMetricasDetalhadas(metricas) {
        if (!metricas) return;
        
        $presencasAgendadas.text(metricas.presencas_agendadas || 0);
        $presencasRua.text(metricas.presencas_rua || 0);
        $comAcao.text(metricas.com_acao || 0);
        $comAssociacao.text(metricas.com_associacao || 0);
        $comAumento.text(metricas.com_aumento || 0);
        $comSubsidio.text(metricas.com_subsidio || 0);
    }
    
    /**
     * Atualiza a tabela de vendedores
     */
    function atualizarTabelaVendedores(vendedoresData) {
        if (!vendedoresData || !vendedoresData.length) {
            $sessaoBodyVendedores.html('<div class="sessao-card"><span class="titulo">Nenhum dado</span></div>');
            return;
        }
        
        // Limpa o conteúdo atual da sessão
        $sessaoBodyVendedores.empty();
        
        // Adiciona uma linha para cada vendedor
        vendedoresData.forEach(function(vendedor) {
            $sessaoBodyVendedores.append(`
                <div class="sessao-card">
                    <span class="titulo">${vendedor.user__username || 'Vendedor'}</span>
                    <span class="valor">${vendedor.total_vendas || 0}</span>
                    <span class="subinfo">${vendedor.valor_total ? 'Total: ' + vendedor.valor_total : ''}</span>
                </div>
            `);
        });
    }
    
    /**
     * Atualiza a tabela de lojas
     */
    function atualizarTabelaLojas(lojasData) {
        if (!lojasData || !lojasData.length) {
            $sessaoBodyLojas.html('<div class="sessao-card"><span class="titulo">Nenhum dado</span></div>');
            return;
        }
        
        // Limpa o conteúdo atual da sessão
        $sessaoBodyLojas.empty();
        
        // Adiciona uma linha para cada loja
        lojasData.forEach(function(loja) {
            $sessaoBodyLojas.append(`
                <div class="sessao-card">
                    <span class="titulo">${loja.loja__nome || 'Loja'}</span>
                    <span class="valor">${loja.total_vendas || 0}</span>
                    <span class="subinfo">${loja.valor_total ? 'Total: ' + loja.valor_total : ''}</span>
                </div>
            `);
        });
    }
    
    /**
     * Atualiza a tabela de efetividade por loja
     */
    function atualizarTabelaEfetividade(efetividadeData) {
        if (!efetividadeData || !efetividadeData.length) {
            $sessaoBodyEfetividade.html('<div class="sessao-card"><span class="titulo">Nenhum dado</span></div>');
            return;
        }
        
        // Limpa o conteúdo atual da sessão
        $sessaoBodyEfetividade.empty();
        
        // Adiciona uma linha para cada loja na lista
        efetividadeData.forEach(function(loja) {
            $sessaoBodyEfetividade.append(`
                <div class="sessao-card">
                    <span class="titulo">${loja.loja_nome || 'Loja'}</span>
                    <span class="valor">${loja.comparecimento || '0%'}</span>
                    <span class="subinfo">Fechamento: ${loja.fechamento || '0%'}</span>
                </div>
            `);
        });
    }
    
    /**
     * Atualiza a tabela de situação TAC
     */
    function atualizarSituacaoTAC(tacData) {
        if (!tacData || !tacData.length) {
            $corpoTabelaTacs.html('<tr><td colspan="4" class="text-center text-muted">Nenhum TAC registrado no período.</td></tr>');
            return;
        }
        
        // Limpa o conteúdo atual da tabela
        $corpoTabelaTacs.empty();
        
        // Situação TAC - separar por status
        const $corpoTabelaTacsEmEspera = $('#corpo-tabela-tacs-em-espera');
        const $corpoTabelaTacsPago = $('#corpo-tabela-tacs-pago');
        const $corpoTabelaTacsNaoPago = $('#corpo-tabela-tacs-nao-pago');
        $corpoTabelaTacsEmEspera.empty();
        $corpoTabelaTacsPago.empty();
        $corpoTabelaTacsNaoPago.empty();
        if (tacData.length > 0) {
            let emEspera = tacData.filter(t => (t.status || '').toLowerCase().includes('espera'));
            let pago = tacData.filter(t => (t.status || '').toLowerCase().includes('pago') && !(t.status || '').toLowerCase().includes('não pago') && !(t.status || '').toLowerCase().includes('nao pago'));
            let naoPago = tacData.filter(t => (t.status || '').toLowerCase().includes('não pago') || (t.status || '').toLowerCase().includes('nao pago'));
            // Em Espera
            if (emEspera.length > 0) {
                emEspera.forEach(function(t) {
                    $corpoTabelaTacsEmEspera.append(`
                        <tr>
                            <td>${t.loja || ''}</td>
                            <td>${t.tipo || ''}</td>
                            <td>${t.valor || ''}</td>
                            <td>${t.status || ''}</td>
                        </tr>
                    `);
                });
            } else {
                $corpoTabelaTacsEmEspera.append('<tr><td colspan="4" class="text-center text-muted">Nenhum dado</td></tr>');
            }
            // Pago
            if (pago.length > 0) {
                pago.forEach(function(t) {
                    $corpoTabelaTacsPago.append(`
                        <tr>
                            <td>${t.loja || ''}</td>
                            <td>${t.tipo || ''}</td>
                            <td>${t.valor || ''}</td>
                            <td>${t.status || ''}</td>
                        </tr>
                    `);
                });
            } else {
                $corpoTabelaTacsPago.append('<tr><td colspan="4" class="text-center text-muted">Nenhum dado</td></tr>');
            }
            // Não Pago
            if (naoPago.length > 0) {
                naoPago.forEach(function(t) {
                    $corpoTabelaTacsNaoPago.append(`
                        <tr>
                            <td>${t.loja || ''}</td>
                            <td>${t.tipo || ''}</td>
                            <td>${t.valor || ''}</td>
                            <td>${t.status || ''}</td>
                        </tr>
                    `);
                });
            } else {
                $corpoTabelaTacsNaoPago.append('<tr><td colspan="4" class="text-center text-muted">Nenhum dado</td></tr>');
            }
        } else {
            $corpoTabelaTacsEmEspera.append('<tr><td colspan="4" class="text-center text-muted">Nenhum dado</td></tr>');
            $corpoTabelaTacsPago.append('<tr><td colspan="4" class="text-center text-muted">Nenhum dado</td></tr>');
            $corpoTabelaTacsNaoPago.append('<tr><td colspan="4" class="text-center text-muted">Nenhum dado</td></tr>');
        }
    }
    
    /**
     * Atualiza o card de insights de desempenho
     */
    function atualizarInsights(insights) {
        if (!insights || Object.keys(insights).length === 0) {
            $insightsContent.html('<p class="text-center text-muted">Nenhuma análise disponível para o período.</p>');
            return;
        }
        
        // Limpa o conteúdo atual
        $insightsContent.empty();
        
        // Estrutura para os insights
        const insightSections = [
            { key: 'agendamentos', icon: 'bx-line-chart', title: 'Agendamentos', color: 'primary' },
            { key: 'vendas', icon: 'bx-dollar-circle', title: 'Vendas/Conversão', color: 'success' },
            { key: 'efetividade', icon: 'bx-bar-chart-alt-2', title: 'Efetividade', color: 'info' },
            { key: 'tac', icon: 'bx-receipt', title: 'TAC', color: 'warning' },
            { key: 'origem', icon: 'bx-user-check', title: 'Origem dos Clientes', color: 'secondary' },
            { key: 'recomendacoes', icon: 'bx-trending-up', title: 'Recomendações', color: 'danger' }
        ];
        
        // Adiciona cada seção de insight se estiver disponível
        insightSections.forEach(function(section) {
            if (insights[section.key]) {
                const $section = $(`
                    <div class="analise-section mb-3">
                        <h6 class="text-${section.color}"><i class='bx ${section.icon} me-1'></i>${section.title}</h6>
                        <p class="card-text">${insights[section.key].replace(/\\n/g, '<br>')}</p>
                    </div>
                `);
                $insightsContent.append($section);
            }
        });
        
        // Se não houver nenhum insight, mostra mensagem padrão
        if ($insightsContent.children().length === 0) {
            $insightsContent.html('<p class="text-center text-muted">Nenhuma análise disponível para o período.</p>');
        }
    }
    
    /**
     * Mostra indicadores de carregamento
     */
    function mostrarCarregando() {
        // Indicadores de carregamento para todas as sessões
        $sessaoBodyVendedores.html('<div class="sessao-card"><span class="titulo">Carregando...</span></div>');
        $sessaoBodyLojas.html('<div class="sessao-card"><span class="titulo">Carregando...</span></div>');
        $sessaoBodyEfetividade.html('<div class="sessao-card"><span class="titulo">Carregando...</span></div>');
        $corpoTabelaTacs.html('<tr><td colspan="4" class="text-center text-muted">Carregando...</td></tr>');
        
        // Indicador de carregamento para insights
        $insightsContent.html('<p class="text-center text-muted">Carregando insights...</p>');
    }
    
    /**
     * Mostra mensagem de erro
     */
    function mostrarErro(mensagem) {
        // Mostra erro em todas as sessões
        $sessaoBodyVendedores.html(`<div class="sessao-card"><span class="titulo" style="color:#dc3545">${mensagem}</span></div>`);
        $sessaoBodyLojas.html(`<div class="sessao-card"><span class="titulo" style="color:#dc3545">${mensagem}</span></div>`);
        $sessaoBodyEfetividade.html(`<div class="sessao-card"><span class="titulo" style="color:#dc3545">${mensagem}</span></div>`);
        $corpoTabelaTacs.html(`<tr><td colspan="4" class="text-center text-danger">${mensagem}</td></tr>`);
        
        // Mostra erro nos insights
        $insightsContent.html(`<p class="text-center text-danger">${mensagem}</p>`);
    }
    
    // Atualizar dados a cada 5 minutos
    setInterval(carregarDadosDashboard, 5 * 60 * 1000);
});
