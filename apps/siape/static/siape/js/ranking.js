$(document).ready(function() {
    // Variável para armazenar o identificador do top1 anterior
    var previousTop1 = null;

    // Adicione esta variável no topo do arquivo ranking.js (logo após o document.ready)
    var podiumData = [];

    // Função para exibir o gif de comemoração
    function showCelebrationGif() {
        // Cria o overlay com o gif
        var $celebration = $('<div id="celebration-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">' +
            '<img src="/static/img/novo_top1.gif" alt="Celebration" style="max-width: 80%; max-height: 80%;">' +
            '</div>');
        // Cria o elemento de áudio (substitua o caminho pelo seu arquivo de áudio)
        var $audio = $('<audio id="celebration-audio" src="/static/files/audio_celebration.mp3" autoplay></audio>');
        
        // Adiciona o áudio ao overlay (pode ser fora do overlay, se preferir)
        $celebration.append($audio);
        
        // Adiciona o overlay à página
        $('body').append($celebration);
        
        // Remove o overlay e pausa o áudio após 5 segundos
        setTimeout(function() {
            // Pausa o áudio
            $audio[0].pause();
            // Remove o overlay com fade-out
            $celebration.fadeOut(1000, function() {
                $(this).remove();
            });
        }, 5000);
    }
    

    // Função para atualizar os dados dos cards
    function updateMetaData() {
        $.getJSON("/siape/api/get/cards/", function(data) {
            // Verifica se os dados existem antes de tentar acessá-los
            if (data.meta_empresa && data.meta_empresa.valor_total !== undefined) {
                $('.dashboard-card.meta-empresa .card-value').text(data.meta_empresa.valor_total);
                $('.dashboard-card.meta-empresa .percentage-value').text((data.meta_empresa.percentual || 0) + '%');
            } else {
                $('.dashboard-card.meta-empresa .card-value').text('R$ 0,00');
                $('.dashboard-card.meta-empresa .percentage-value').text('0%');
            }
            
            // Atualiza Falta Meta Empresa (não conta franquia)
            if (data.falta_meta_empresa && data.falta_meta_empresa.valor_total !== undefined) {
                $('.dashboard-card.falta-meta-empresa .card-value').text(data.falta_meta_empresa.valor_total);
            } else {
                $('.dashboard-card.falta-meta-empresa .card-value').text('R$ 0,00');
            }
            
            // Atualiza Meta SIAPE
            if (data.meta_siape && data.meta_siape.valor_total !== undefined) {
                $('.dashboard-card.meta-siape .card-value').text(data.meta_siape.valor_total);
                $('.dashboard-card.meta-siape .percentage-value').text((data.meta_siape.percentual || 0) + '%');
            } else {
                $('.dashboard-card.meta-siape .card-value').text('R$ 0,00');
                $('.dashboard-card.meta-siape .percentage-value').text('0%');
            }
            
            // Atualiza Falta Meta SIAPE
            if (data.falta_meta_siape && data.falta_meta_siape.valor_total !== undefined) {
                $('.dashboard-card.falta-meta-siape .card-value').text(data.falta_meta_siape.valor_total);
            } else {
                $('.dashboard-card.falta-meta-siape .card-value').text('R$ 0,00');
            }
            
            console.log("Cards de meta atualizados com sucesso 😊");
        }).fail(function(xhr, status, error) {
            console.error("Erro ao carregar dados dos cards:", error);
            // Define valores padrão em caso de erro
            $('.dashboard-card .card-value').text('R$ 0,00');
            $('.dashboard-card .percentage-value').text('0%');
        });
    }

    // Função modificada para colocar a tag BLACK em um box junto com o nome
    // Função comentada para remover a tag BLACK do pódio
    function checkForBlackStatus(element, valor) {
        /* 
        // console.log('Iniciando checkForBlackStatus');
        
        // Remove tag anterior se existir
        element.find('.black-tag').remove();
        
        // Tratamento para formato monetário brasileiro
        let valorLimpo = valor.replace(/R\$\s?/g, '');
        valorLimpo = valorLimpo.replace(/\./g, '');
        valorLimpo = valorLimpo.replace(/,/g, '.');
        
        // Converte para número
        const valorNumerico = parseFloat(valorLimpo);
        
        // Verifica se o valor é maior ou igual a 50000
        if (valorNumerico >= 50000) {
            // console.log('Adicionando tag BLACK');
            
            // Obter o nome atual
            const nomeAtual = element.find('.bar .nome').text();
            
            // Modificar a estrutura HTML para incluir um contêiner
            element.find('.bar .nome').html(`
                <div class="nome-container">
                    <div class="nome-text">${nomeAtual}</div>
                    <div class="black-tag">BLACK</div>
                </div>
            `);
            
            // console.log('Tag BLACK adicionada com sucesso');
        }
        
        // console.log('Finalizando checkForBlackStatus');
        */
    }

    // Função para atualizar os dados do pódium
    function updatePodiumData() {
        $.getJSON("/siape/api/get/podium/", function(data) {
            // Verifica se os dados existem e são válidos
            if (!data || !data.podium || !Array.isArray(data.podium)) {
                console.error("Dados do pódium inválidos ou vazios");
                return;
            }
            
            var podium = data.podium;
            
            // Atualiza a variável global podiumData para uso em ranking_data.js
            podiumData = podium;
            
            // Verifica se há um top1 retornado pela API
            if (podium[0]) {
                // Se previousTop1 já estiver definido e for diferente do atual, exibe o gif
                if (previousTop1 !== null && previousTop1 !== podium[0].id) {
                    showCelebrationGif();
                }
                // Atualiza o previousTop1 com o id do top1 atual
                previousTop1 = podium[0].id;
            }
            
            // Atualiza Top 1
            if (podium[0]) {
                var top1 = podium[0];
                $('.top1.box__ranking .foto__pos img').attr('src', top1.logo);
                $('.top1.box__ranking .foto__pos img').attr('alt', top1.nome);
                $('.top1.box__ranking .circle__position').text(top1.posicao);
                $('.top1.box__ranking .valor').text(top1.total_fechamentos);
                $('.top1.box__ranking .bar .nome').text(top1.nome);
                
                // Verifica se atingiu status Black
                checkForBlackStatus($('.top1.box__ranking'), top1.total_fechamentos);
            }
            
            // Atualiza Top 2
            if (podium[1]) {
                var top2 = podium[1];
                $('.top2.box__ranking .foto__pos img').attr('src', top2.logo);
                $('.top2.box__ranking .foto__pos img').attr('alt', top2.nome);
                $('.top2.box__ranking .circle__position').text(top2.posicao);
                $('.top2.box__ranking .valor').text(top2.total_fechamentos);
                $('.top2.box__ranking .bar .nome').text(top2.nome);
                
                // Verifica se atingiu status Black
                checkForBlackStatus($('.top2.box__ranking'), top2.total_fechamentos);
            }
            
            // Atualiza Top 3
            if (podium[2]) {
                var top3 = podium[2];
                $('.top3.box__ranking .foto__pos img').attr('src', top3.logo);
                $('.top3.box__ranking .foto__pos img').attr('alt', top3.nome);
                $('.top3.box__ranking .circle__position').text(top3.posicao);
                $('.top3.box__ranking .valor').text(top3.total_fechamentos);
                $('.top3.box__ranking .bar .nome').text(top3.nome);
                
                // Verifica se atingiu status Black
                checkForBlackStatus($('.top3.box__ranking'), top3.total_fechamentos);
            }
            
            // Atualiza Top 4
            if (podium[3]) {
                var top4 = podium[3];
                $('.top4.box__ranking .foto__pos img').attr('src', top4.logo);
                $('.top4.box__ranking .foto__pos img').attr('alt', top4.nome);
                $('.top4.box__ranking .circle__position').text(top4.posicao);
                $('.top4.box__ranking .valor').text(top4.total_fechamentos);
                $('.top4.box__ranking .bar .nome').text(top4.nome);
                
                // Verifica se atingiu status Black
                checkForBlackStatus($('.top4.box__ranking'), top4.total_fechamentos);
            }
            
            // Atualiza Top 5
            if (podium[4]) {
                var top5 = podium[4];
                $('.top5.box__ranking .foto__pos img').attr('src', top5.logo);
                $('.top5.box__ranking .foto__pos img').attr('alt', top5.nome);
                $('.top5.box__ranking .circle__position').text(top5.posicao);
                $('.top5.box__ranking .valor').text(top5.total_fechamentos);
                $('.top5.box__ranking .bar .nome').text(top5.nome);
                
                // Verifica se atingiu status Black
                checkForBlackStatus($('.top5.box__ranking'), top5.total_fechamentos);
            }
            console.log("Pódium atualizado com sucesso 🚀");
        }).fail(function(xhr, status, error) {
            console.error("Erro ao carregar dados do pódium:", error);
        });
    }

    // Função para atualizar todos os dados (cards e pódium)
    function updateRankingData() {
        updateMetaData();
        updatePodiumData();
    }

    // Atualiza os dados assim que o ranking é carregado
    updateRankingData();

    // Atualiza os dados a cada 10 segundos (10000 milissegundos)
    setInterval(updateRankingData, 10000);
});
