function formatFloat(value) {
    // Verifica se value é uma string ou número e converte para string
    if (typeof value !== 'string') {
        value = value.toString();
    }
    return parseFloat(value.replace(',', '.')).toFixed(2);
}

function renderRanking(metaGeral, metaEquipe) {
    const metaGeralContainer = document.getElementById('metaGeral');
    const metaEquipeContainer = document.getElementById('metaEquipe');
    metaGeralContainer.innerHTML = '';
    metaEquipeContainer.innerHTML = '';

    if (metaGeral) {
        const metaTitulo = metaGeral.titulo;
        const metaValue = metaGeral.valor;
        const metaValueTotal = metaGeral.valor_total;
        const metaPercentage = metaGeral.percentual_height;

        console.log('metaValue:', metaValue, 'metaPercentage:', metaPercentage);

        const metaHtml = `
            <h3 class="title">${metaTitulo}</h3>
            <p>${metaValue}</p>
            <div class="container">
                <span class="value-box"><p class="value">R$ ${metaValueTotal}</p></span>
                <div class="progress-bar" style="height: ${metaPercentage}%">
                    <div class="scene">
                        <div class="rocket">
                            <img src="/static/img/apps/siape/rocket.png" />
                        </div>
                    </div>
                </div>
            </div>
        `;
        metaGeralContainer.innerHTML = metaHtml;
    }
    if (metaEquipe) {
        const metaTitulo = metaEquipe.titulo;
        const metaValue = metaEquipe.valor;
        const metaValueTotal = metaEquipe.valor_total;
        const metaPercentage = metaEquipe.percentual_height;

        console.log('metaValue:', metaValue, 'metaPercentage:', metaPercentage);

        const metaHtml = `
            <h3 class="title">${metaTitulo}</h3>
            <p>${metaValue}</p>
            <div class="container">
                <span class="value-box"><p class="value">R$ ${metaValueTotal}</p></span>
                <div class="progress-bar" style="height: ${metaPercentage}%">
                    <div class="scene">
                        <div class="rocket">
                            <img src="/static/img/apps/siape/rocket.png" />
                        </div>
                    </div>
                </div>
            </div>
        `;
        metaEquipeContainer.innerHTML = metaHtml;
    }
}

function fetchRankingData() {
    fetch(rankingUrl)
        .then(response => response.json())
        .then(data => {
            console.log('Data fetched:', data);

            // Verifique o formato dos dados
            if (data.metaGeral && typeof data.metaGeral.valor === 'string' && typeof data.metaGeral.percentual_height === 'number') {
                renderRanking(data.metaGeral, data.metaEquipe);
            } else {
                console.error('Invalid data format:', data);
            }
        })
        .catch(error => console.error('Error fetching ranking data:', error));
}

fetchRankingData();
setInterval(fetchRankingData, 10000);
