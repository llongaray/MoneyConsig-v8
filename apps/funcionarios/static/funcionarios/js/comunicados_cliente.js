// Set para armazenar IDs dos comunicados já notificados
let comunicadosNotificados = new Set();
// Array para armazenar comunicados novos que precisam ser notificados
let comunicadosPendentes = [];
// Variável para controlar o debounce
let debounceTimer;
// Variável para controlar se o usuário já interagiu com a página
let usuarioInteragiu = false;

// Função de debounce para otimizar chamadas
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(debounceTimer);
            func(...args);
        };
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(later, wait);
    };
}

// Função para carregar IDs notificados do localStorage
function carregarComunicadosNotificados() {
    const idsSalvos = localStorage.getItem('comunicadosNotificados');
    if (idsSalvos) {
        comunicadosNotificados = new Set(JSON.parse(idsSalvos));
    }
}

// Função para salvar IDs notificados no localStorage
function salvarComunicadosNotificados() {
    localStorage.setItem('comunicadosNotificados', JSON.stringify([...comunicadosNotificados]));
}

// Função para tocar o som de alerta
async function tocarSomAlerta() {
    try {
        // Se o usuário ainda não interagiu com a página, não tenta tocar o som
        if (!usuarioInteragiu) {
            // console.log('Usuário ainda não interagiu com a página, som será tocado na próxima interação');
            return false;
        }

        const audio = new Audio('/static/sounds/notification.mp3');
        audio.volume = 0.5; // Volume em 50%
        
        // Tenta reproduzir o áudio
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            await playPromise;
            // console.log('Som reproduzido com sucesso');
        }
    } catch (error) {
        // console.log('Erro ao tocar som:', error);
        return false;
    }
    return true;
}

// Função para verificar e tocar sons pendentes
async function verificarSonsPendentes() {
    if (comunicadosPendentes.length > 0) {
        const sucesso = await tocarSomAlerta();
        if (sucesso) {
            comunicadosPendentes = []; // Limpa a lista se o som tocou com sucesso
        }
    }
}

// Função para atualizar o contador de comunicados não lidos
async function atualizarContadorComunicados() {
    // console.log('Iniciando atualização do contador de comunicados...');
    $.ajax({
        url: '/rh/api/comunicados/list/',
        method: 'GET',
        success: async function(response) {
            // console.log('Resposta recebida:', response);
            const naoLidos = response.filter(c => !c.lido);
            // console.log(`Total de comunicados não lidos: ${naoLidos.length}`);
            
            // Verifica se há comunicados novos (não notificados)
            const comunicadosNovos = naoLidos.filter(c => !comunicadosNotificados.has(c.id));
            
            // Se houver comunicados novos
            if (comunicadosNovos.length > 0) {
                // Adiciona ao Set de notificados
                comunicadosNovos.forEach(c => comunicadosNotificados.add(c.id));
                // Salva no localStorage
                salvarComunicadosNotificados();
                
                // Tenta tocar o som
                await tocarSomAlerta();
            }
            
            $('#contador-comunicados').text(naoLidos.length);
            
            // Adiciona ou remove a classe tem-notificacao
            if (naoLidos.length > 0) {
                $('#btn-comunicados').addClass('tem-notificacao');
            } else {
                $('#btn-comunicados').removeClass('tem-notificacao');
            }
            
            // Atualiza o modal se estiver aberto
            if ($('.comunicados-popup').hasClass('active')) {
                // console.log('Modal está aberto, atualizando conteúdo...');
                atualizarModalComunicados(response);
            }
        },
        error: function(error) {
            // console.error('Erro ao buscar comunicados:', error);
        }
    });
}

// Função para atualizar o conteúdo do modal
function atualizarModalComunicados(comunicados) {
    // console.log('Atualizando modal de comunicados...');
    const naoLidos = comunicados.filter(c => !c.lido);
    const lidos = comunicados.filter(c => c.lido);
    // console.log(`Comunicados não lidos: ${naoLidos.length}, Comunicados lidos: ${lidos.length}`);
    
    // Limpa os containers
    // console.log('Limpando containers de comunicados...');
    $('#submodal-nao-lidos').empty();
    $('#submodal-lidos').empty();
    
    // Adiciona comunicados não lidos
    if (naoLidos.length === 0) {
        // console.log('Nenhum comunicado não lido encontrado');
        $('#submodal-nao-lidos').html('<p class="text-center">Nenhum comunicado não lido</p>');
    } else {
        // console.log('Adicionando comunicados não lidos...');
        naoLidos.forEach(comunicado => {
            // console.log(`Adicionando comunicado não lido ID: ${comunicado.id}`);
            $('#submodal-nao-lidos').append(criarHTMLComunicado(comunicado));
        });
    }
    
    // Adiciona comunicados lidos
    if (lidos.length === 0) {
        // console.log('Nenhum comunicado lido encontrado');
        $('#submodal-lidos').html('<p class="text-center">Nenhum comunicado lido</p>');
    } else {
        // console.log('Adicionando comunicados lidos...');
        lidos.forEach(comunicado => {
            // console.log(`Adicionando comunicado lido ID: ${comunicado.id}`);
            $('#submodal-lidos').append(criarHTMLComunicado(comunicado));
        });
    }
}

// Função para criar o HTML de um comunicado
function criarHTMLComunicado(comunicado) {
    // console.log(`Criando HTML para comunicado ID: ${comunicado.id}`);
    // Formata a data corretamente
    const data = formatarDataBR(comunicado.data_criacao);
    // console.log(`Data do comunicado: ${data}`);
    
    return `
        <div class="submodal-comunicado-item ${!comunicado.lido ? 'submodal-nao-lido' : ''}" data-id="${comunicado.id}">
            <a href="/#comunicado-${comunicado.id}" class="submodal-comunicado-link">
                <div class="submodal-comunicado-header">
                    <h3>${comunicado.assunto}</h3>
                    <span class="submodal-data">${data}</span>
                </div>
            </a>
        </div>
    `;
}

// Adiciona função formatarDataBR
function formatarDataBR(dataString) {
    if (!dataString) return 'Data não disponível';
    
    // Se já estiver no formato DD/MM/YYYY, retorna como está
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dataString)) {
        return dataString;
    }
    
    try {
        // Tenta converter a string para data
        const data = new Date(dataString);
        
        // Verifica se a data é válida
        if (isNaN(data.getTime())) {
            // console.error('Data inválida:', dataString);
            return 'Data inválida';
        }
        
        // Formata para DD/MM/YYYY
        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        
        return `${dia}/${mes}/${ano}`;
    } catch (error) {
        // console.error('Erro ao formatar data:', error);
        return 'Data inválida';
    }
}

// Função para obter o token CSRF do cookie
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

// Função para marcar um comunicado como lido
function marcarComoLido(event, comunicadoId) {
    event.preventDefault();
    // console.log(`Marcando comunicado ID: ${comunicadoId} como lido...`);
    
    const form = event.target;
    const formData = new FormData(form);
    
    $.ajax({
        url: '/rh/api/comunicados/marcar-lido/',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            // console.log('Resposta do servidor:', response);
            if (response.status === 'success') {
                // console.log('Comunicado marcado como lido com sucesso');
                // Atualiza o contador e o modal
                atualizarContadorComunicados();
            }
        },
        error: function(xhr, status, error) {
            // console.error('Erro ao marcar comunicado como lido:', error);
            // console.error('Status:', status);
            // console.error('Resposta:', xhr.responseText);
        }
    });
}

// Função para marcar que o usuário interagiu com a página
function marcarInteracaoUsuario() {
    if (!usuarioInteragiu) {
        // console.log('Primeira interação do usuário detectada');
        usuarioInteragiu = true;
        // Tenta tocar sons pendentes quando o usuário interagir pela primeira vez
        verificarSonsPendentes();
    }
}

// Função para monitorar interações do usuário
function monitorarInteracoesUsuario() {
    // Cria uma versão com debounce da função verificarSonsPendentes
    const verificarSonsPendentesDebounced = debounce(verificarSonsPendentes, 1000);
    
    // Função que combina a marcação de interação com a verificação de sons
    const interacaoCompleta = () => {
        marcarInteracaoUsuario();
        verificarSonsPendentesDebounced();
    };
    
    // Eventos de mouse
    document.addEventListener('click', interacaoCompleta);
    document.addEventListener('mousemove', interacaoCompleta);
    
    // Eventos de teclado
    document.addEventListener('keydown', interacaoCompleta);
    document.addEventListener('keyup', interacaoCompleta);
    
    // Eventos de formulário
    document.addEventListener('submit', interacaoCompleta);
    document.addEventListener('change', interacaoCompleta);
    
    // Eventos de scroll
    document.addEventListener('scroll', interacaoCompleta);
    
    // Eventos de touch (para dispositivos móveis)
    document.addEventListener('touchstart', interacaoCompleta);
    document.addEventListener('touchmove', interacaoCompleta);
}

// Inicialização
$(document).ready(function() {
    // console.log('Documento pronto, inicializando...');
    
    // Carrega os IDs notificados do localStorage
    carregarComunicadosNotificados();
    
    // Inicia o monitoramento de interações
    monitorarInteracoesUsuario();
    
    // Configuração do botão de comunicados
    $('#btn-comunicados').on('click', function(e) {
        e.stopPropagation();
        $('.comunicados-popup').toggleClass('active');
        // console.log(`Modal agora está: ${$('.comunicados-popup').hasClass('active') ? 'ativo' : 'inativo'}`);
        
        // Se o modal estiver aberto, atualiza os comunicados
        if ($('.comunicados-popup').hasClass('active')) {
            atualizarContadorComunicados();
        }
    });
    
    // Fecha o modal ao clicar fora
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.comunicados-popup, #btn-comunicados').length) {
            $('.comunicados-popup').removeClass('active');
        }
    });
    
    // Alterna entre as abas
    $('.comunicados-popup__tab').on('click', function() {
        const tab = $(this).data('tab');
        $('.comunicados-popup__tab').removeClass('comunicados-popup__tab--active');
        $(this).addClass('comunicados-popup__tab--active');
        
        if (tab === 'nao-lidos') {
            $('#submodal-nao-lidos').show();
            $('#submodal-lidos').hide();
        } else {
            $('#submodal-nao-lidos').hide();
            $('#submodal-lidos').show();
        }
    });
    
    // Atualiza o contador inicialmente
    atualizarContadorComunicados();
    
    // Atualiza o contador a cada 10 segundos
    setInterval(atualizarContadorComunicados, 10000);
});
