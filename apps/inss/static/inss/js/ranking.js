$(document).ready(function() {
    // Período fixo para as chamadas da API
    var periodoAtual = 'meta';

    // FUNÇÃO: Atualiza os dados dos cards
    function updateCards() {
        $.getJSON("/inss/api/inss/cards/" + periodoAtual + "/", function(data) {
            console.log("Dados da API cards:", data);

            if (data.meta_empresa) {
                $(".dashboard-card.meta-empresa .card-value")
                    .text(data.meta_empresa.valor || 'R$ 0,00');
                $(".dashboard-card.meta-empresa .percentage-value")
                    .text((data.meta_empresa.percentual || 0) + "%");
            }
            if (data.falta_meta_empresa) {
                $(".dashboard-card.falta-meta-empresa .card-value")
                    .text(data.falta_meta_empresa.valor || 'R$ 0,00');
            }
            if (data.meta_inss) {
                $(".dashboard-card.meta-inss .card-value")
                    .text(data.meta_inss.valor || 'R$ 0,00');
                $(".dashboard-card.meta-inss .percentage-value")
                    .text((data.meta_inss.percentual || 0) + "%");
            }
            if (data.falta_meta_inss) {
                $(".dashboard-card.falta-meta-inss .card-value")
                    .text(data.falta_meta_inss.valor || 'R$ 0,00');
            }
        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Erro ao carregar dados dos cards:", textStatus, errorThrown);
        });
    }

    // FUNÇÃO: Atualiza os dados do pódium (top 3 lojas)
    function updatePodium() {
        $.getJSON("/inss/api/inss/podium/" + periodoAtual + "/", function(data) {
            console.log("Dados do pódio:", data);
            var podium = data.podium || [];

            function renderSlot(idx, selector) {
                var slot = podium[idx];
                var $box = $(selector);
                if (!slot) {
                    $box.find(".foto__pos img")
                        .attr("src", "/static/img/default-store.png")
                        .attr("alt", "Posição Disponível");
                    $box.find(".circle__position").text(idx+1);
                    $box.find(".valor").text("R$ 0,00");
                    $box.find(".bar .nome").text("Posição Disponível");
                    return;
                }
                var logoUrl = slot.logo && slot.logo.startsWith("/") 
                              ? slot.logo 
                              : "/static/img/default-store.png";
                $box.find(".foto__pos img")
                    .attr("src", logoUrl)
                    .attr("alt", slot.nome);
                $box.find(".circle__position").text(idx+1);
                $box.find(".valor").text(slot.valor);
                $box.find(".bar .nome").text(slot.nome);
            }

            renderSlot(1, ".top2.box__ranking");
            renderSlot(0, ".top1.box__ranking");
            renderSlot(2, ".top3.box__ranking");

        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Erro ao carregar dados do pódio:", textStatus, errorThrown);
        });
    }

    // Variável para animação de reordenação
    var previousOrder = [];

    // FUNÇÃO: Atualiza a tabela, agora ordenando por qtd_emloja desc, depois qtd_agendados desc
    function updateTabela() {
        $.getJSON("/inss/api/inss/tabela/" + periodoAtual + "/", function(data) {
            var ranking = data.ranking_data || [];
            var tbody   = $("table tbody");
            var newOrder = [];
            var newRows  = [];

            // 1) Ordena: primeiro por qtd_emloja (desc), depois por qtd_agendados (desc)
            ranking.sort(function(a, b) {
                if (b.qtd_emloja !== a.qtd_emloja) {
                    return b.qtd_emloja - a.qtd_emloja;
                }
                return b.qtd_agendados - a.qtd_agendados;
            });

            // 2) Atualiza posição sequencial
            ranking.forEach(function(item, idx) {
                item.posicao = idx + 1;
            });

            // 3) Monta linhas
            if (ranking.length) {
                ranking.forEach(function(item) {
                    newOrder.push(item.nome);
                    var $tr = $("<tr>").attr("data-nome", item.nome);
                    $tr.append("<td>" + item.posicao + "</td>");
                    var fotoSrc = item.foto || "/static/img/geral/default_image.png";
                    $tr.append("<td><img src='" + fotoSrc + "' alt='" + 
                               item.nome + "' class='ranking-foto'></td>");
                    $tr.append("<td>" + item.nome + "</td>");
                    $tr.append("<td>" + item.qtd_agendados + "</td>");
                    $tr.append("<td>" + item.qtd_emloja + "</td>");
                    newRows.push($tr);
                });
            } else {
                var $empty = $("<tr>")
                    .append("<td colspan='5' class='text-center'>Nenhum dado disponível para o período</td>");
                newRows.push($empty);
            }

            // 4) Anima reordenação (opcional)
            var rowHeight = $("table tbody tr").outerHeight() || 50;
            if (previousOrder.length) {
                newRows.forEach(function($row, newIdx) {
                    var nome = $row.data("nome");
                    var oldIdx = previousOrder.indexOf(nome);
                    if (oldIdx !== -1 && oldIdx !== newIdx) {
                        var diff = (oldIdx - newIdx) * rowHeight;
                        $row.css({ position: "relative", top: diff + "px" })
                            .animate({ top: "0px" }, 500);
                    }
                });
            }

            // 5) Substitui o conteúdo da tabela
            tbody.empty();
            newRows.forEach(function($r) {
                tbody.append($r);
            });

            // 6) Atualiza a ordem anterior
            previousOrder = newOrder;

        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.error("Erro ao carregar dados da tabela:", textStatus, errorThrown);
            $("table tbody").html(
                "<tr><td colspan='5' class='text-center text-danger'>" +
                "Erro ao carregar dados. Tente novamente mais tarde.</td></tr>"
            );
        });
    }

    // FUNÇÃO: Atualiza handlers de ordenação manual
    function atualizarHandlersOrdenacao() {
        $('.sort-icon').off('click').on('click', function() {
            var column = $(this).data('column');
            var tbody   = $('table tbody');
            var rows    = Array.from(tbody.find('tr'));
            var icon    = $(this).find('i');
            var asc     = icon.hasClass('fa-sort') || icon.hasClass('fa-sort-down');

            // reset icons
            $('.sort-icon i').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
            icon.removeClass('fa-sort').addClass(asc ? 'fa-sort-up' : 'fa-sort-down');

            rows.sort(function(a, b) {
                var va, vb;
                if (column === 'rank') {
                    va = parseInt($(a).find('td').eq(0).text(),10);
                    vb = parseInt($(b).find('td').eq(0).text(),10);
                } else if (column === 'nome') {
                    va = $(a).find('td').eq(2).text().toLowerCase();
                    vb = $(b).find('td').eq(2).text().toLowerCase();
                } else if (column === 'agendados') {
                    va = parseInt($(a).find('td').eq(3).text(),10);
                    vb = parseInt($(b).find('td').eq(3).text(),10);
                } else if (column === 'taxa') {
                    va = parseInt($(a).find('td').eq(4).text(),10);
                    vb = parseInt($(b).find('td').eq(4).text(),10);
                }
                return asc
                    ? (va > vb ? 1 : va < vb ? -1 : 0)
                    : (va < vb ? 1 : va > vb ? -1 : 0);
            });

            rows.forEach(function(r) {
                tbody.append(r);
            });
        });
    }

    // Inicialização
    function inicializar() {
        console.log("Inicializando ranking INSS...");
        atualizarHandlersOrdenacao();
        updateCards();
        updatePodium();
        updateTabela();
        setInterval(function() {
            updateCards();
            updatePodium();
            updateTabela();
        }, 30000);
    }

    inicializar();
});
