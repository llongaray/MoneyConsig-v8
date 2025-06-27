// Variável global para armazenar os dados do pódium
var podiumData = []; 

$(document).ready(function() {
    // Função para salvar dados do top1 no localStorage
    function saveTop1Data(nome, valor) {
        const top1Data = {
            nome: nome,
            valor: valor
        };
        localStorage.setItem('siapeTop1', JSON.stringify(top1Data));
    }

    // Função para obter dados do top1 do localStorage
    function getTop1Data() {
        const data = localStorage.getItem('siapeTop1');
        return data ? JSON.parse(data) : null;
    }

    // Função para mostrar animação de novo top1
    function showTop1Celebration() {
        // Remove celebração anterior se existir
        $('#top1Celebration').remove();
        
        const celebrationHtml = `
            <div id="top1Celebration">
                <div class="celebration-content">
                    <img src="/static/img/novo_top1.gif" class="celebration-gif" alt="Novo Top 1!">
                    <audio id="celebrationAudio" autoplay>
                        <source src="/static/files/audio_celebration.mp3" type="audio/mpeg">
                    </audio>
                </div>
            </div>
        `;

        $('body').append(celebrationHtml);
        
        // Mostra a celebração com fade e inicia o áudio
        $('#top1Celebration').fadeIn('fast', function() {
            const audio = document.getElementById('celebrationAudio');
            audio.volume = 1.0; // Volume máximo (100%)
            audio.play().catch(function(error) {
                console.log("Erro ao tocar áudio:", error);
            });

            confetti({
                particleCount: 100,
                spread: 160,
                origin: { y: 0.6 },
                disableForReducedMotion: true
            });
        });

        // Remove a celebração após 6 segundos
        setTimeout(() => {
            const audio = document.getElementById('celebrationAudio');
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
            $('#top1Celebration').fadeOut('slow', function() {
                $(this).remove();
            });
        }, 6000);
    }

    // Verificar se houve mudança no top1
    function checkTop1Change(newPodiumData) {
        // Verificar se temos dados válidos
        if (!newPodiumData || !Array.isArray(newPodiumData) || newPodiumData.length === 0) {
            console.log("Dados do pódium inválidos ou vazios");
            return;
        }
        
        // Atualizar a variável global com os novos dados
        podiumData = newPodiumData;
        
        const storedTop1 = getTop1Data();
        // Verifica se o primeiro elemento do array existe
        const currentTop1 = podiumData[0];

        if (!currentTop1) {
            console.log("Nenhum top1 encontrado nos dados do pódium");
            return;
        }

        if (!storedTop1) {
            // Primeiro acesso, apenas salva os dados
            saveTop1Data(currentTop1.nome, currentTop1.total_fechamentos || currentTop1.valor);
        } else if (storedTop1.nome !== currentTop1.nome) {
            // Novo top1 detectado - sempre mostra a celebração se não for "Posição Disponível"
            if (currentTop1.nome !== 'Posição Disponível') {
                showTop1Celebration();
            }
            // Atualiza o storage com o novo top1
            saveTop1Data(currentTop1.nome, currentTop1.total_fechamentos || currentTop1.valor);
        }
    }

    // Executar verificação inicial
    checkTop1Change();

    // Inicializar podiumData como array vazio
    podiumData = [];
});
