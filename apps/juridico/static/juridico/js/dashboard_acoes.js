$(document).ready(function() {
    console.log("Dashboard Jurídico Ações JS Carregado!");

    function carregarDadosDashboard() {
        console.log("Tentando carregar dados do dashboard jurídico...");
        $.ajax({
            url: "/juridico/api/get_dashboardacoes/", // Verifique se esta URL está correta
            type: "GET",
            dataType: "json",
            success: function(response) {
                console.log("Dados recebidos:", response);
                if (response.success && response.dados_dashboard) {
                    atualizarCards(response.dados_dashboard);
                    renderizarGraficoHistorico(response.dados_dashboard.historico_acoes);
                    atualizarTimestamp();
                } else {
                    console.error("Erro ao carregar dados do dashboard:", response.message);
                    mostrarErro("Não foi possível carregar os dados do dashboard.");
                }
            },
            error: function(xhr, status, error) {
                console.error("Erro na requisição AJAX:", status, error, xhr.responseText);
                mostrarErro("Erro de comunicação ao carregar dados do dashboard.");
            }
        });
    }

    function atualizarCards(dados) {
        console.log("Atualizando cards com os dados:", dados);
        // Visão Geral
        $("#valor-total-acoes").text(dados.total_acoes || 0);
        $("#valor-acoes-com-recursos").text(dados.recursos.total_com_recursos || 0);

        // Status das Ações
        $("#valor-status-em-espera").text(dados.status_acoes.em_espera || 0);
        $("#valor-status-incompleto").text(dados.status_acoes.incompleto || 0);
        $("#valor-status-em-despacho").text(dados.status_acoes.em_despacho || 0);
        $("#valor-status-protocolado").text(dados.status_acoes.protocolado || 0);
        $("#valor-status-finalizado").text(dados.status_acoes.finalizado || 0);

        // Sentenças
        $("#valor-sentencas-favoraveis").text(dados.sentencas.favoraveis || 0);
        $("#valor-sentencas-nao-favoraveis").text(dados.sentencas.nao_favoraveis || 0);
        $("#valor-sentencas-pendentes").text(dados.sentencas.pendentes || 0);

        // Tipos de Ação
        $("#valor-tipo-associacao").text(dados.tipos_acoes.associacao || 0);
        $("#valor-tipo-cartao").text(dados.tipos_acoes.cartao || 0);
        $("#valor-tipo-debito-conta").text(dados.tipos_acoes.debito_conta || 0);
        $("#valor-tipo-limpa-nome").text(dados.tipos_acoes.limpa_nome || 0);
        $("#valor-tipo-revisional").text(dados.tipos_acoes.revisional || 0);

        // Recursos 1º Grau
        $("#valor-recurso-1-apelacao").text(dados.recursos.primeiro_grau.apelacao || 0);
        $("#valor-recurso-1-agravo").text(dados.recursos.primeiro_grau.agravo || 0);
        $("#valor-recurso-1-embargos").text(dados.recursos.primeiro_grau.embargos || 0);

        // Recursos 2º Grau
        $("#valor-recurso-2-apelacao").text(dados.recursos.segundo_grau.apelacao || 0);
        $("#valor-recurso-2-agravo").text(dados.recursos.segundo_grau.agravo || 0);
        $("#valor-recurso-2-embargos").text(dados.recursos.segundo_grau.embargos || 0);
    }

    let graficoHistoricoAcoesInstance = null; // Variável para armazenar a instância do gráfico

    function renderizarGraficoHistorico(historicoData) {
        console.log("Renderizando gráfico com dados:", historicoData);
        const ctx = document.getElementById('graficoHistoricoAcoes').getContext('2d');
        
        if (!historicoData || historicoData.length === 0) {
            console.warn("Dados do histórico de ações estão vazios. O gráfico não será renderizado.");
            // Você pode exibir uma mensagem no canvas se desejar
            ctx.font = "16px Arial";
            ctx.fillStyle = "#888";
            ctx.textAlign = "center";
            ctx.fillText("Nenhum dado disponível para o histórico.", ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        const labels = historicoData.map(item => item.mes);
        const dataPoints = historicoData.map(item => item.total);

        // Destruir o gráfico anterior, se existir
        if (graficoHistoricoAcoesInstance) {
            graficoHistoricoAcoesInstance.destroy();
        }

        graficoHistoricoAcoesInstance = new Chart(ctx, {
            type: 'line', // Tipo de gráfico (linha)
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nº de Ações Criadas',
                    data: dataPoints,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Quantidade de Ações'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mês/Ano'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                }
            }
        });
    }

    function atualizarTimestamp() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateString = now.toLocaleDateString('pt-BR');
        $("#last-update-time").text(`${dateString} ${timeString}`);
    }

    function mostrarErro(mensagem) {
        // Exemplo: Adicionar uma mensagem de erro ao contêiner principal
        // Você pode adaptar isso para usar um modal ou um sistema de notificação mais robusto
        $("#dashboard-juridico-container").prepend(
            `<div class="alert alert-danger" role="alert" style="margin-bottom: 20px;">
                ${mensagem}
            </div>`
        );
        $("#last-update-time").text("Falha ao carregar");
    }

    // Carregar dados ao iniciar a página
    carregarDadosDashboard();

    // Opcional: Atualizar dados periodicamente (exemplo: a cada 5 minutos)
    // setInterval(carregarDadosDashboard, 300000); 
}); 