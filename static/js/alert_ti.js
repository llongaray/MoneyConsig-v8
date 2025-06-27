// Variáveis globais
let alertaAtual = null;
let audioElement = null;
let audioPendente = null;
let alertaPendente = null;
let paginaEmFoco = true;

// Função para verificar novos alertas
function verificarNovosAlertas() {
    // console.log('🔍 Verificando novos alertas...');
    $.ajax({
        url: '/autenticacao/api/alertas/verificar/',
        method: 'GET',
        success: function(response) {
            // console.log('📥 Resposta recebida:', response);
            if (response.tem_alerta && !response.ja_visto) {
                // console.log('⚠️ Novo alerta encontrado!');
                if (paginaEmFoco) {
                    exibirAlerta(response);
                } else {
                    // console.log('📱 Página não está em foco, armazenando alerta pendente');
                    alertaPendente = response;
                }
            } else {
                // console.log('✅ Nenhum alerta novo encontrado');
            }
        },
        error: function(error) {
            // console.error('❌ Erro ao verificar alertas:', error);
        }
    });
}

// Função para exibir o alerta
function exibirAlerta(dados) {
    // console.log('🎯 Iniciando exibição do alerta...');
    
    // Se já houver um alerta sendo exibido, não exibe outro
    if (alertaAtual) {
        // console.log('⚠️ Já existe um alerta sendo exibido');
        return;
    }

    // console.log('📝 Criando elemento do alerta...');
    // Cria o elemento do alerta
    const alertaHTML = `
        <div id="alert-ti-floating" class="alert-ti-floating" style="display: none;">
            <div class="alert-ti-content">
                <div class="alert-ti-header">
                    <h3>
                        <i class='bx bx-bell-ring'></i>
                        Alerta Importante
                    </h3>
                    <button class="close-alert" aria-label="Fechar alerta">&times;</button>
                </div>
                <div class="alert-ti-message">
                    ${dados.mensagem}
                </div>
                <audio id="alertAudio" src="${dados.audio_url}" preload="auto"></audio>
            </div>
        </div>
    `;

    // console.log('📌 Adicionando alerta ao DOM...');
    // Adiciona o alerta ao DOM
    $('body').append(alertaHTML);
    alertaAtual = dados.alerta_id;
    audioElement = document.getElementById('alertAudio');
    audioPendente = dados.audio_url;

    // Configura os eventos
    configurarEventosAlerta();

    // Mostra o alerta e tenta reproduzir o áudio
    if (paginaEmFoco) {
        // console.log('👁️ Página em foco, exibindo alerta...');
        $('#alert-ti-floating').fadeIn(300);
        tocarAudio();
    } else {
        // console.log('👁️ Página não está em foco, alerta será exibido quando voltar ao foco');
    }
}

// Função para tocar o áudio
function tocarAudio() {
    // console.log('🎵 Iniciando reprodução do áudio...');
    if (audioElement) {
        // Tenta reproduzir o áudio
        const playPromise = audioElement.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // console.log('✅ Áudio reproduzido com sucesso');
                audioPendente = null;
            }).catch(error => {
                // console.error('❌ Erro ao tocar áudio:', error);
                // Se falhar, armazena o áudio como pendente
                audioPendente = audioElement.src;
            });
        }
    } else {
        // console.warn('⚠️ Elemento de áudio não encontrado');
    }
}

// Função para marcar o alerta como visto
function marcarAlertaVisto(alertaId) {
    // console.log(`📌 Marcando alerta ${alertaId} como visto...`);
    $.ajax({
        url: `/autenticacao/api/alertas/marcar-visto/${alertaId}/`,
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        success: function(response) {
            // console.log('✅ Alerta marcado como visto com sucesso');
        },
        error: function(error) {
            // console.error('❌ Erro ao marcar alerta como visto:', error);
        }
    });
}

// Função para configurar os eventos do alerta
function configurarEventosAlerta() {
    // console.log('⚙️ Configurando eventos do alerta...');
    
    // Evento de fechar o alerta
    $('.close-alert').on('click', function() {
        // console.log('🔔 Botão de fechar clicado');
        if (alertaAtual) {
            // console.log(`📌 Fechando alerta ${alertaAtual}...`);
            marcarAlertaVisto(alertaAtual);
            $('#alert-ti-floating').fadeOut(300, function() {
                $(this).remove();
            });
            alertaAtual = null;
            audioElement = null;
            audioPendente = null;
            // console.log('✅ Alerta removido com sucesso');
        }
    });

    // Adiciona eventos de interação para tentar reproduzir o áudio pendente
    const eventos = ['click', 'keydown', 'touchstart', 'mousemove'];
    eventos.forEach(evento => {
        document.addEventListener(evento, function tentarReproduzirPendente() {
            if (audioPendente && audioElement) {
                // console.log('🔄 Tentando reproduzir áudio pendente após interação...');
                audioElement.play().then(() => {
                    // console.log('✅ Áudio pendente reproduzido com sucesso');
                    audioPendente = null;
                    // Remove o evento após reproduzir com sucesso
                    eventos.forEach(e => document.removeEventListener(e, tentarReproduzirPendente));
                }).catch(error => {
                    // console.error('❌ Falha ao reproduzir áudio pendente:', error);
                });
            }
        }, { once: true });
    });
}

// Função para obter o token CSRF
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Função para verificar se a página está em foco
function verificarFocoPagina() {
    paginaEmFoco = document.hasFocus();
    // console.log(`👁️ Página ${paginaEmFoco ? 'em foco' : 'sem foco'}`);
    
    if (paginaEmFoco && alertaPendente) {
        // console.log('📱 Página voltou ao foco, exibindo alerta pendente');
        exibirAlerta(alertaPendente);
        alertaPendente = null;
    }
}

// Inicialização
$(document).ready(function() {
    // console.log('🚀 Inicializando sistema de alertas...');
    
    // Configura eventos de foco
    $(window).on('focus blur', verificarFocoPagina);
    $(document).on('visibilitychange', function() {
        paginaEmFoco = !document.hidden;
        verificarFocoPagina();
    });
    
    // Verifica novos alertas a cada 3 segundos
    setInterval(verificarNovosAlertas, 3000);
    // console.log('⏰ Verificação periódica configurada (3 segundos)');
    
    // Verifica alertas imediatamente ao carregar a página
    verificarNovosAlertas();
    // console.log('✅ Sistema de alertas inicializado');
});
