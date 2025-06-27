$(document).ready(function() {
    // Inicialização do dashboard
    carregarDashboard();
    
    // Atualizar dashboard a cada 5 minutos
    setInterval(carregarDashboard, 300000);
});

// ================================
// VARIÁVEIS GLOBAIS
// ================================
let chartHistorico = null;
let dadosDashboard = null;

// ================================
// FUNÇÕES DE CARREGAMENTO
// ================================

function carregarDashboard() {
    mostrarLoadingCards();
    
    $.get('/marketing/api/get/dashboard/')
        .done(function(response) {
            if (response.success) {
                dadosDashboard = response;
                
                // Preencher todas as seções
                preencherEstatisticasGerais(response.estatisticas_gerais);
                preencherStatusMateriais(response.materiais_status);
                preencherCrescimento(response.crescimento);
                preencherMateriaisPorOrgao(response.materiais_por_orgao);
                preencherProdutosMaisAtivos(response.produtos_mais_ativos);
                preencherMateriaisMaisBaixados(response.materiais_mais_baixados);
                preencherDownloadsRecentes(response.downloads_recentes);
                criarGraficoHistorico(response.historico_materiais);
                
                // Atualizar timestamp
                $('#last-update-time').text(response.timestamp);
                
                esconderLoadingCards();
            } else {
                mostrarErro('Erro ao carregar dados do dashboard: ' + response.error);
            }
        })
        .fail(function() {
            mostrarErro('Erro ao conectar com o servidor');
        });
}

// ================================
// FUNÇÕES DE PREENCHIMENTO
// ================================

function preencherEstatisticasGerais(stats) {
    $('#valor-total-orgaos').text(stats.total_orgaos);
    $('#valor-total-produtos').text(stats.total_produtos);
    $('#valor-total-materiais').text(stats.total_materiais);
    $('#valor-total-downloads').text(stats.total_downloads);
    
    // Animar números
    animarContadores();
}

function preencherStatusMateriais(status) {
    $('#valor-materiais-ativos').text(status.ativos);
    $('#valor-materiais-inativos').text(status.inativos);
}

function preencherCrescimento(crescimento) {
    $('#valor-materiais-este-mes').text(crescimento.materiais_este_mes);
    $('#valor-downloads-este-mes').text(crescimento.downloads_este_mes);
    
    // Configurar percentuais com cores
    configurarPercentual('#percentual-materiais', crescimento.percentual_materiais);
    configurarPercentual('#percentual-downloads', crescimento.percentual_downloads);
}

function preencherMateriaisPorOrgao(orgaos) {
    const container = $('#box-materiais-orgao');
    container.empty();
    
    if (orgaos.length === 0) {
        container.html('<div class="loading-card">Nenhum órgão com materiais</div>');
        return;
    }
    
    orgaos.forEach(orgao => {
        const cardHtml = `
            <div class="card">
                <span class="icon"><i class='bx bx-building'></i></span>
                <span class="container-info">
                    <span class="title">${orgao.titulo}</span>
                    <span class="value">${orgao.total_materiais}</span>
                    <small class="text-muted">${orgao.total_produtos} produtos</small>
                </span>
            </div>
        `;
        container.append(cardHtml);
    });
}

function preencherProdutosMaisAtivos(produtos) {
    const container = $('#box-produtos-ativos');
    container.empty();
    
    if (produtos.length === 0) {
        container.html('<div class="loading-card">Nenhum produto com materiais</div>');
        return;
    }
    
    produtos.forEach(produto => {
        const cardHtml = `
            <div class="card">
                <span class="icon"><i class='bx bx-package'></i></span>
                <span class="container-info">
                    <span class="title">${produto.titulo}</span>
                    <span class="value">${produto.total_materiais}</span>
                    <small class="text-muted">${produto.orgao}</small>
                </span>
            </div>
        `;
        container.append(cardHtml);
    });
}

function preencherMateriaisMaisBaixados(materiais) {
    const container = $('#box-materiais-populares');
    container.empty();
    
    if (materiais.length === 0) {
        container.html('<div class="loading-card">Nenhum material baixado ainda</div>');
        return;
    }
    
    materiais.forEach(material => {
        const cardHtml = `
            <div class="card">
                <span class="icon"><i class='bx bx-star'></i></span>
                <span class="container-info">
                    <span class="title">${material.titulo}</span>
                    <span class="value">${material.total_downloads}</span>
                    <small class="text-muted">${material.produto} - ${material.orgao}</small>
                </span>
            </div>
        `;
        container.append(cardHtml);
    });
}

function preencherDownloadsRecentes(downloads) {
    const container = $('#lista-downloads-recentes');
    container.empty();
    
    if (downloads.length === 0) {
        container.html(`
            <div class="loading-card">
                <i class='bx bx-download bx-lg'></i>
                <p class="mt-2 mb-0">Nenhum download recente</p>
            </div>
        `);
        return;
    }
    
    downloads.forEach(download => {
        const itemHtml = `
            <div class="download-item">
                <div class="download-info">
                    <div class="download-material">${download.material_titulo}</div>
                    <div class="download-meta">
                        ${download.produto_titulo} - ${download.orgao_titulo} • ${download.usuario}
                    </div>
                </div>
                <div class="download-date">${download.data}</div>
            </div>
        `;
        container.append(itemHtml);
    });
}

// ================================
// GRÁFICO DE HISTÓRICO
// ================================

function criarGraficoHistorico(historico) {
    const ctx = document.getElementById('graficoHistoricoMateriais');
    
    // Destruir gráfico anterior se existir
    if (chartHistorico) {
        chartHistorico.destroy();
    }
    
    const labels = historico.map(item => `${item.mes}/${item.ano}`);
    const materiais = historico.map(item => item.materiais);
    const downloads = historico.map(item => item.downloads);
    
    chartHistorico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Materiais Criados',
                data: materiais,
                borderColor: '#70f611',
                backgroundColor: 'rgba(112, 246, 17, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#70f611',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }, {
                label: 'Downloads Realizados',
                data: downloads,
                borderColor: '#0bd5f0',
                backgroundColor: 'rgba(11, 213, 240, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0bd5f0',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#142650',
                    bodyColor: '#333',
                    borderColor: '#70f611',
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        title: function(context) {
                            return `Mês: ${context[0].label}`;
                        },
                        label: function(context) {
                            const label = context.dataset.label;
                            const value = context.parsed.y;
                            return `${label}: ${value}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                        drawBorder: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#666'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        },
                        color: '#666'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                line: {
                    borderJoinStyle: 'round'
                }
            }
        }
    });
}

// ================================
// FUNÇÕES UTILITÁRIAS
// ================================

function configurarPercentual(seletor, valor) {
    const elemento = $(seletor);
    const textoPercentual = valor > 0 ? `+${valor}%` : `${valor}%`;
    
    elemento.text(textoPercentual);
    
    // Remover classes anteriores
    elemento.removeClass('positive negative neutral');
    
    // Adicionar classe baseada no valor
    if (valor > 0) {
        elemento.addClass('positive');
    } else if (valor < 0) {
        elemento.addClass('negative');
    } else {
        elemento.addClass('neutral');
    }
}

function animarContadores() {
    $('.card .value').each(function() {
        const $this = $(this);
        const countTo = parseInt($this.text()) || 0;
        
        $({ countNum: 0 }).animate({
            countNum: countTo
        }, {
            duration: 1500,
            easing: 'swing',
            step: function() {
                $this.text(Math.floor(this.countNum));
            },
            complete: function() {
                $this.text(countTo);
            }
        });
    });
}

function mostrarLoadingCards() {
    // Mostrar loading nos cards principais
    $('.card .value').html('<div class="loading-spinner"></div>');
    
    // Mostrar loading nos containers dinâmicos
    $('#box-materiais-orgao').html('<div class="loading-card"><div class="loading-spinner"></div><p class="mt-2 mb-0">Carregando órgãos...</p></div>');
    $('#box-produtos-ativos').html('<div class="loading-card"><div class="loading-spinner"></div><p class="mt-2 mb-0">Carregando produtos...</p></div>');
    $('#box-materiais-populares').html('<div class="loading-card"><div class="loading-spinner"></div><p class="mt-2 mb-0">Carregando materiais...</p></div>');
    $('#lista-downloads-recentes').html('<div class="loading-card"><div class="loading-spinner"></div><p class="mt-2 mb-0">Carregando downloads...</p></div>');
}

function esconderLoadingCards() {
    // Os valores já foram preenchidos pelas funções específicas
    // Adicionar animação de fade in
    $('.card').css('opacity', '0').animate({opacity: 1}, 600);
}

function mostrarErro(mensagem) {
    console.error('Erro no dashboard:', mensagem);
    
    // Substituir loading por mensagem de erro
    $('.loading-card').html(`
        <i class='bx bx-error-circle bx-lg text-danger'></i>
        <p class="mt-2 mb-0 text-danger">${mensagem}</p>
        <button class="btn btn-sm btn-outline-primary mt-2" onclick="carregarDashboard()">
            <i class='bx bx-refresh'></i> Tentar novamente
        </button>
    `);
    
    $('#last-update-time').text('Erro ao carregar');
}

// ================================
// FUNÇÕES DE ATUALIZAÇÃO
// ================================

function atualizarDashboard() {
    carregarDashboard();
}

function exportarDados() {
    if (!dadosDashboard) {
        alert('Nenhum dado disponível para exportar');
        return;
    }
    
    // Criar CSV simples dos dados principais
    let csv = 'Métrica,Valor\n';
    csv += `Total de Órgãos,${dadosDashboard.estatisticas_gerais.total_orgaos}\n`;
    csv += `Total de Produtos,${dadosDashboard.estatisticas_gerais.total_produtos}\n`;
    csv += `Total de Materiais,${dadosDashboard.estatisticas_gerais.total_materiais}\n`;
    csv += `Total de Downloads,${dadosDashboard.estatisticas_gerais.total_downloads}\n`;
    csv += `Materiais Ativos,${dadosDashboard.materiais_status.ativos}\n`;
    csv += `Materiais Inativos,${dadosDashboard.materiais_status.inativos}\n`;
    
    // Download do arquivo
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard_materiais_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// ================================
// EVENT LISTENERS ADICIONAIS
// ================================

// Atualizar dashboard quando a janela ganha foco
$(window).on('focus', function() {
    // Só atualizar se passou mais de 1 minuto desde a última atualização
    const agora = new Date();
    const ultimaAtualizacao = new Date($('#last-update-time').text().split(' ').slice(0, 2).join(' '));
    const diferencaMinutos = Math.abs(agora - ultimaAtualizacao) / (1000 * 60);
    
    if (diferencaMinutos > 1) {
        carregarDashboard();
    }
});

// Teclas de atalho
$(document).on('keydown', function(e) {
    // F5 ou Ctrl+R para atualizar
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
        e.preventDefault();
        carregarDashboard();
    }
    
    // Ctrl+E para exportar
    if (e.ctrlKey && e.key === 'e') {
        e.preventDefault();
        exportarDados();
    }
});

// Responsive chart resize
$(window).on('resize', function() {
    if (chartHistorico) {
        chartHistorico.resize();
    }
});
