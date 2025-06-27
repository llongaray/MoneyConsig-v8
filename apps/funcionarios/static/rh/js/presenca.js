// Sistema de Presença - JavaScript

// gCanViewFullCalendar será definida no template HTML antes deste script ser carregado.

$(document).ready(function() {
    let dataAtualGlobal = new Date(); // Renomeado para evitar conflito de escopo
    let mesAtualCalendario = dataAtualGlobal.getMonth();
    let anoAtualCalendario = dataAtualGlobal.getFullYear();

    // Carregar calendário inicial
    carregarCalendario(mesAtualCalendario, anoAtualCalendario);

    // Só adiciona listeners se os botões existirem (visão completa)
    if (gCanViewFullCalendar) {
        $('#btn-mes-anterior').click(function() {
            mesAtualCalendario--;
            if (mesAtualCalendario < 0) {
                mesAtualCalendario = 11;
                anoAtualCalendario--;
            }
            carregarCalendario(mesAtualCalendario, anoAtualCalendario);
        });

        $('#btn-mes-proximo').click(function() {
            mesAtualCalendario++;
            if (mesAtualCalendario > 11) {
                mesAtualCalendario = 0;
                anoAtualCalendario++;
            }
            carregarCalendario(mesAtualCalendario, anoAtualCalendario);
        });
    }

    // Configurar botão de registro
    $('#btn-registrar-presenca').click(function() {
        registrarPresenca();
    });
});

// Função para carregar o calendário
function carregarCalendario(mes, ano) {
    const grid = document.getElementById('grid-calendario');
    grid.innerHTML = '';
    
    const hoje = new Date();
    const diaAtualNum = hoje.getDate();
    const mesAtualNum = hoje.getMonth();
    const anoAtualNum = hoje.getFullYear();

    if (gCanViewFullCalendar) {
        const primeiroDiaDoMes = new Date(ano, mes, 1);
        const ultimoDiaDoMes = new Date(ano, mes + 1, 0);
        const diasNoMes = ultimoDiaDoMes.getDate();
        const diaDaSemanaDoPrimeiroDia = primeiroDiaDoMes.getDay();
        
        // Atualiza o título do mês
        const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        document.getElementById('mes-atual').textContent = `${mesesNomes[mes]} ${ano}`;
        
        // Adiciona espaços vazios para os dias antes do primeiro dia do mês
        for (let i = 0; i < diaDaSemanaDoPrimeiroDia; i++) {
            const diaVazio = document.createElement('div');
            diaVazio.className = 'dia-card dia-vazio';
            grid.appendChild(diaVazio);
        }
    }
    
    const ultimoDiaDoMes = new Date(ano, mes + 1, 0);
    const diasNoMes = ultimoDiaDoMes.getDate();

    for (let dia = 1; dia <= diasNoMes; dia++) {
        if (!gCanViewFullCalendar && (dia !== diaAtualNum || mes !== mesAtualNum || ano !== anoAtualNum)) {
            continue; // Pula dias que não são o dia atual se a visão for restrita
        }

        const diaCard = document.createElement('div');
        diaCard.className = 'dia-card';
        
        const dataCorrenteDoLoop = new Date(ano, mes, dia);
        const diaSemana = dataCorrenteDoLoop.getDay(); // 0 (Dom) - 6 (Sab)

        let ehDiaAtual = false;
        let ehDiaFuturo = false;

        if (ano > anoAtualNum || 
           (ano === anoAtualNum && mes > mesAtualNum) || 
           (ano === anoAtualNum && mes === mesAtualNum && dia > diaAtualNum)) {
            diaCard.classList.add('dia-futuro');
            ehDiaFuturo = true;
        } else if (dia === diaAtualNum && mes === mesAtualNum && ano === anoAtualNum) {
            diaCard.classList.add('dia-atual');
            ehDiaAtual = true;
        } else {
            diaCard.classList.add('dia-passado');
        }
        
        // Número do dia
        const numeroDiaEl = document.createElement('div');
        numeroDiaEl.className = 'numero-dia';
        numeroDiaEl.textContent = dia;
        diaCard.appendChild(numeroDiaEl);
        
        // Status do registro (placeholder)
        const statusRegistroEl = document.createElement('div');
        statusRegistroEl.className = 'status-registro';
        diaCard.appendChild(statusRegistroEl);
        
        const dataParaApi = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

        // Botão de registro é sempre criado para o dia atual, independentemente da visão completa/restrita
        if (ehDiaAtual) {
            const btnRegistrar = document.createElement('button');
            btnRegistrar.className = 'btn btn-registrar btn-primary';
            btnRegistrar.onclick = function(event) {
                event.stopPropagation(); // Evita que o clique no botão dispare o onclick do diaCard
                const tipoRegistro = this.getAttribute('data-tipo-registro');
                if (tipoRegistro) {
                    registrarPresenca(tipoRegistro);
                }
            };
            diaCard.appendChild(btnRegistrar);
        }
        
        // Carrega o status inicial do dia (Presente, Falta, Ausente)
        carregarStatusInicialDia(dataParaApi, diaCard, diaSemana, ehDiaAtual, ehDiaFuturo);

        grid.appendChild(diaCard);
    }
}

// Função para carregar o status inicial de um dia no card do calendário
function carregarStatusInicialDia(dataApi, cardElement, diaSemana, ehDiaAtual, ehDiaFuturo) {
    const statusDiv = cardElement.querySelector('.status-registro');
    const btnRegistrar = cardElement.querySelector('.btn-registrar'); // Pode não existir se não for dia atual

    if (ehDiaFuturo) {
        statusDiv.innerHTML = ''; 
        if (btnRegistrar) btnRegistrar.style.display = 'none'; 
        return;
    }

    const url = `/rh/api/presenca/registros/?data=${dataApi}`;
    fetch(url)
        .then(response => response.json())
        .then(data => {
            const registrosDoUsuario = data.registros_usuario_logado || [];
            let primeiraEntradaUsuario = null;
            let ultimaSaidaUsuario = null;

            registrosDoUsuario.forEach(reg => {
                if (reg.tipo === 'ENTRADA') {
                    if (!primeiraEntradaUsuario || new Date(`1970/01/01 ${reg.datahora}`) < new Date(`1970/01/01 ${primeiraEntradaUsuario.datahora}`)) {
                        primeiraEntradaUsuario = reg;
                    }
                }
                if (reg.tipo === 'SAIDA') {
                    if (!ultimaSaidaUsuario || new Date(`1970/01/01 ${reg.datahora}`) > new Date(`1970/01/01 ${ultimaSaidaUsuario.datahora}`)) {
                        ultimaSaidaUsuario = reg;
                    }
                }
            });

            if (gCanViewFullCalendar) {
                // Visão de Gestor/Superuser: Mostrar contagem total de entradas/saídas do dia
                const totalEntradas = data.resumo_dia ? data.resumo_dia.total_entradas : 0;
                const totalSaidas = data.resumo_dia ? data.resumo_dia.total_saidas : 0;
                
                let gestorStatusHtml = `<div class="text-center small" style="line-height: 1.3; font-size: 0.7rem;">`;
                gestorStatusHtml += `<div><span class="fw-bold">${totalEntradas}</span> <i class='bx bxs-log-in-circle text-primary'></i></div>`;
                gestorStatusHtml += `<div><span class="fw-bold">${totalSaidas}</span> <i class='bx bxs-log-out-circle text-danger'></i></div>`;
                
                // Adiciona status de Falta Geral ou Sem Movimentação para dias passados
                const dataAtualDate = new Date();
                const diaCardDate = new Date(dataApi + "T00:00:00"); // Adiciona T00:00:00 para evitar problemas de fuso

                if (diaCardDate < dataAtualDate && !(diaCardDate.getDate() === dataAtualDate.getDate() && diaCardDate.getMonth() === dataAtualDate.getMonth() && diaCardDate.getFullYear() === dataAtualDate.getFullYear())) {
                    if (totalEntradas === 0 && diaSemana >= 1 && diaSemana <= 5) { // Dias úteis (Segunda a Sexta)
                        gestorStatusHtml += `<div class="badge bg-falta mt-1" style="font-size: 0.65rem; padding: .2em .4em;"><i class="bx bx-error-circle me-1"></i>FALTA</div>`;
                    } else if (totalEntradas === 0 && (diaSemana === 0 || diaSemana === 6)) { // Fins de semana
                        gestorStatusHtml += `<div class="badge bg-secondary mt-1" style="font-size: 0.65rem; padding: .2em .4em;"><i class="bx bx-info-circle me-1"></i>S/MOV</div>`;
                    }
                }
                gestorStatusHtml += `</div>`;
                statusDiv.innerHTML = gestorStatusHtml;

                // Lógica do botão para o dia ATUAL (baseado nos registros DO USUÁRIO LOGADO)
                if (ehDiaAtual && btnRegistrar) {
                    if (primeiraEntradaUsuario) {
                        if (ultimaSaidaUsuario) {
                            btnRegistrar.style.display = 'none';
                        } else {
                            btnRegistrar.innerHTML = '<i class="bx bx-log-out-circle me-1"></i>Sair';
                            btnRegistrar.setAttribute('data-tipo-registro', 'SAIDA');
                            btnRegistrar.classList.remove('btn-primary');
                            btnRegistrar.classList.add('btn-danger');
                            btnRegistrar.style.display = 'block';
                        }
                    } else {
                        btnRegistrar.innerHTML = '<i class="bx bx-log-in-circle me-1"></i>Entrar';
                        btnRegistrar.setAttribute('data-tipo-registro', 'ENTRADA');
                        btnRegistrar.classList.remove('btn-danger');
                        btnRegistrar.classList.add('btn-primary');
                        btnRegistrar.style.display = 'block';
                    }
                } else if (btnRegistrar) { 
                     btnRegistrar.style.display = 'none';
                }

            } else {
                // Visão Normal do Usuário
                if (primeiraEntradaUsuario) {
                    let statusHtml = `<span class="badge bg-info text-dark"><i class='bx bxs-log-in-circle'></i> E: ${primeiraEntradaUsuario.datahora}</span>`;
                    if (ultimaSaidaUsuario) {
                        statusHtml += `<br><span class="badge bg-secondary text-dark mt-1"><i class='bx bxs-log-out-circle'></i> S: ${ultimaSaidaUsuario.datahora}</span>`;
                    }
                    statusDiv.innerHTML = statusHtml;

                    if (btnRegistrar) { 
                        if (ultimaSaidaUsuario) {
                            btnRegistrar.style.display = 'none'; 
                        } else {
                            btnRegistrar.innerHTML = '<i class="bx bx-log-out-circle me-1"></i>Sair';
                            btnRegistrar.setAttribute('data-tipo-registro', 'SAIDA');
                            btnRegistrar.classList.remove('btn-primary');
                            btnRegistrar.classList.add('btn-danger');
                            btnRegistrar.style.display = 'block';
                        }
                    }
                } else {
                    if (btnRegistrar) { 
                        btnRegistrar.innerHTML = '<i class="bx bx-log-in-circle me-1"></i>Entrar';
                        btnRegistrar.setAttribute('data-tipo-registro', 'ENTRADA');
                        btnRegistrar.classList.remove('btn-danger');
                        btnRegistrar.classList.add('btn-primary');
                        btnRegistrar.style.display = 'block';
                    }

                    if (diaSemana >= 1 && diaSemana <= 5) { 
                        statusDiv.innerHTML = `<div class="badge bg-falta"><i class="bx bx-error-circle me-1"></i> Dia Com Falta</div>`;
                    } else { 
                        statusDiv.innerHTML = `<div class="badge bg-secondary"><i class="bx bx-info-circle me-1"></i> Ausente</div>`;
                    }
                }
            }
        })
        .catch(error => {
            console.error(`[GINCANA] Erro ao carregar status para ${dataApi}:`, error);
            statusDiv.innerHTML = `<div class="badge bg-danger"><i class="bx bx-error me-1"></i> Erro status</div>`;
            if (btnRegistrar) {
                 btnRegistrar.innerHTML = '<i class="bx bx-error me-1"></i> Erro';
                 btnRegistrar.setAttribute('data-tipo-registro', 'ENTRADA'); // Default em caso de erro
                 btnRegistrar.style.display = 'block';
            }
        });
}

// Função para registrar presença
function registrarPresenca(tipoRegistro) {
    console.log(`[GINCANA] Iniciando registro de ${tipoRegistro} na gincana`);
    const url = `/rh/api/presenca/registrar/`;
    const csrfToken = getCsrfToken();

    if (!csrfToken) {
        mostrarErro('Erro crítico: Token CSRF não encontrado. Não é possível registrar participação.');
        console.error('[GINCANA] Token CSRF nulo ou indefinido antes do fetch.');
        return;
    }

    console.log('[GINCANA] CSRF Token para envio:', csrfToken);

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            tipo: tipoRegistro
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                console.error('[GINCANA] Resposta não OK do servidor:', response.status, response.statusText, text);
                throw new Error(`Erro do servidor: ${response.status} ${response.statusText}. Detalhes: ${text.substring(0, 300)}`);
            });
        }
        return response.json();
    })
    .then(data => {
        console.log('[GINCANA] Resposta do registro:', data);
        if (data.success) {
            mostrarSucesso(data.message);
            const dataAtual = new Date();
            carregarCalendario(dataAtual.getMonth(), dataAtual.getFullYear());
        } else {
            mostrarErro(data.error || `Erro ao registrar ${tipoRegistro.toLowerCase()} na gincana`);
        }
    })
    .catch(error => {
        console.error(`[GINCANA] Erro ao registrar ${tipoRegistro.toLowerCase()} na gincana:`, error);
        if (error.message && error.message.startsWith('Erro do servidor:')) {
            mostrarErro(error.message);
        } else {
            mostrarErro(`Erro ao registrar ${tipoRegistro.toLowerCase()} na gincana. Verifique o console para detalhes.`);
        }
    });
}

// Função para mostrar mensagem de sucesso
function mostrarSucesso(mensagem) {
    console.log('[GINCANA] Sucesso:', mensagem);
    alert(`Sucesso: ${mensagem}`);
}

// Função para mostrar mensagem de erro
function mostrarErro(mensagem) {
    console.error('[GINCANA] Erro:', mensagem);
    alert(`Erro: ${mensagem}`);
}

// Função para obter o token CSRF (prioriza input, fallback para cookie)
function getCsrfToken() {
    const csrfTokenInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (csrfTokenInput && csrfTokenInput.value) {
        console.log('[GINCANA_CSRF] Token obtido do input DOM.');
        return csrfTokenInput.value;
    }

    // Fallback para o método do cookie
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Procura pelo cookie 'csrftoken'
            if (cookie.substring(0, 'csrftoken'.length + 1) === ('csrftoken' + '=')) {
                cookieValue = decodeURIComponent(cookie.substring('csrftoken'.length + 1));
                break;
            }
        }
    }
    if (cookieValue) {
        console.log('[GINCANA_CSRF] Token obtido do cookie.');
    } else {
        console.warn('[GINCANA_CSRF] Token CSRF não encontrado no DOM input, tentará cookie ou falhará no envio.');
    }
    return cookieValue;
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('[GINCANA] Inicializando módulo de presença da gincana');
    const dataAtual = new Date();
    carregarCalendario(dataAtual.getMonth(), dataAtual.getFullYear());
    
    // Eventos dos botões de navegação
    if (gCanViewFullCalendar) {
        document.getElementById('btn-mes-anterior').addEventListener('click', function() {
            const dataAtualElement = document.getElementById('mes-atual').textContent;
            const partesData = dataAtualElement.split(' ');
            const nomeMes = partesData[0];
            const ano = parseInt(partsData[1]);
            const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            let mesNum = mesesNomes.indexOf(nomeMes);

            mesNum--;
            let novoAno = ano;
            if (mesNum < 0) {
                mesNum = 11;
                novoAno--;
            }
            carregarCalendario(mesNum, novoAno);
        });
        
        document.getElementById('btn-mes-proximo').addEventListener('click', function() {
            const dataAtualElement = document.getElementById('mes-atual').textContent;
            const partesData = dataAtualElement.split(' ');
            const nomeMes = partesData[0];
            const ano = parseInt(partsData[1]);
            const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            let mesNum = mesesNomes.indexOf(nomeMes);

            mesNum++;
            let novoAno = ano;
            if (mesNum > 11) {
                mesNum = 0;
                novoAno++;
            }
            carregarCalendario(mesNum, novoAno);
        });
    }
}); 