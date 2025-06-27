// =======================
// Banner Slider com Fade (duração maior) + fechar
// =======================
function initBannerSlider() {
    const $wrapper = $('#ranking-banner-wrapper');
    if (!$wrapper.length) {
        console.log('DEBUG: Elemento #ranking-banner-wrapper não encontrado');
        return;
    }

    // fecha ao clicar no X
    $wrapper.find('.banner-close-btn').on('click', () => {
        $wrapper.fadeOut(300, () => $wrapper.remove());
    });

    const MAX_WIDTH  = 1000; // px
    const MAX_HEIGHT = 220;  // px
    const apiUrl     = '/api/campanhas/banners/';  // URL absoluta
    let $slides, currentIndex = 0, total = 0, intervalId;

    function resizeTo($img) {
        const natW = $img[0].naturalWidth,
              natH = $img[0].naturalHeight;
        const scale = Math.min(MAX_WIDTH/natW, MAX_HEIGHT/natH, 1),
              w     = Math.round(natW * scale),
              h     = Math.round(natH * scale);

        $wrapper.stop(true).animate({ width: w, height: h }, 300);
        $slides.css({ width: w, height: h });
    }

    function showSlide(idx) {
        const $next = $slides.eq(idx % total);
        if (!$next.length) return;

        resizeTo($next);
        $slides.eq(currentIndex).stop(true).fadeOut(1000);
        $next.stop(true).fadeIn(1000);

        currentIndex = idx % total;
    }

    function startAutoplay() {
        intervalId = setInterval(() => showSlide(currentIndex + 1), 10000);
    }

    function cleanup() {
        clearInterval(intervalId);
        $(window).off('resize.dynamic');
    }

    console.log('DEBUG: Iniciando carregamento de banners...');
    $.getJSON(apiUrl)
        .done(data => {
            console.log('DEBUG: Resposta recebida:', data);
            const banners = data.banners || [];
            if (!banners.length) {
                console.log('DEBUG: Nenhum banner encontrado');
                return $wrapper.remove();
            }

            console.log(`DEBUG: ${banners.length} banners encontrados`);
            $wrapper.css({ position: 'relative', overflow: 'hidden' }).empty();

            // botão de fechar
            $('<button type="button" class="banner-close-btn" aria-label="Fechar">&times;</button>')
                .appendTo($wrapper)
                .on('click', () => $wrapper.fadeOut(300, () => $wrapper.remove()));

            banners.forEach((b, i) => {
                console.log(`DEBUG: Adicionando banner ${b.id} - ${b.titulo}`);
                const $img = $('<img>')
                    .addClass('banner-item')
                    .attr('alt', `Banner ${b.id}`)
                    .css({ position: 'absolute', top:0, left:0, display: i===0 ? 'block' : 'none' });

                // Função para tentar carregar a imagem
                const tryLoadImage = (url) => {
                    $img.attr('src', url);
                };

                // Tenta primeiro HTTPS, se falhar tenta HTTP
                const url = new URL(b.banner_url);
                const httpsUrl = url.href;
                const httpUrl = url.href.replace('https://', 'http://');

                $img.on('error', function() {
                    if (this.src.startsWith('https://')) {
                        console.log(`DEBUG: Falha ao carregar via HTTPS, tentando HTTP para banner ${b.id}`);
                        tryLoadImage(httpUrl);
                    } else {
                        console.error(`DEBUG: Erro ao carregar imagem do banner ${b.id} - removendo do slider`);
                        $(this).remove();
                        total--;
                        if (total === 0) {
                            console.log('DEBUG: Nenhum banner válido restante - removendo wrapper');
                            $wrapper.remove();
                        }
                    }
                });

                // Tenta primeiro HTTPS
                tryLoadImage(httpsUrl);
                $img.appendTo($wrapper);
            });

            $slides = $wrapper.find('img');
            total   = $slides.length;

            if (total === 0) {
                console.log('DEBUG: Nenhum banner válido - removendo wrapper');
                return $wrapper.remove();
            }

            const $first = $slides.eq(0);
            if ($first.prop('complete')) {
                resizeTo($first);
                if (total > 1) startAutoplay();
            } else {
                $first.one('load', () => {
                    resizeTo($first);
                    if (total > 1) startAutoplay();
                });
            }

            $(window).on('resize.dynamic', () => resizeTo($slides.eq(currentIndex)));
            $(window).on('unload', cleanup);
        })
        .fail((jqXHR, textStatus, errorThrown) => {
            console.error('❌ Erro ao carregar banners:', {
                status: jqXHR.status,
                statusText: jqXHR.statusText,
                responseText: jqXHR.responseText,
                textStatus: textStatus,
                errorThrown: errorThrown
            });
            $wrapper.remove();
        });
}

$(document).ready(initBannerSlider);


// =======================
// Campanhas CRUD + Scope Options
// =======================
$(document).ready(function() {
    console.log('Documento pronto, inicializando script de campanhas...');

    const listUrl    = '/api/campanhas/';           // GET → lista campanhas + opções
    const createUrl  = '/api/campanhas/criar/';     // POST → cria campanha
    const statusUrl  = '/api/campanhas/atualizar-status/'; // POST → ativa/inativa
    console.log('URLs configuradas:', { listUrl, createUrl, statusUrl });

    const $table      = $('#lista-campanhas');
    const $no         = $('#sem-campanhas');
    const $form       = $('#form-nova-campanha');
    const $categoria  = $('#campanha-categoria');
    const $scopeOpts  = $('#scope-options');
    const panels      = {
        'EMPRESA':      $('#options-EMPRESA'),
        'DEPARTAMENTO': $('#options-DEPARTAMENTO'),
        'SETOR':        $('#options-SETOR'),
        'LOJA':         $('#options-LOJA'),
        'EQUIPE':       $('#options-EQUIPE'),
        'CARGO':        $('#options-CARGO'),
    };

    let opcoes = {};

    // Lê cookie CSRF
    function getCookie(name) {
        let value = null;
        if (document.cookie && document.cookie !== '') {
            document.cookie.split(';').forEach(c => {
                c = c.trim();
                if (c.startsWith(name + '=')) {
                    value = decodeURIComponent(c.slice(name.length + 1));
                }
            });
        }
        return value;
    }
    const csrftoken = getCookie('csrftoken');

    // Configura CSRF nos AJAX
    $.ajaxSetup({
        beforeSend(xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
                xhr.setRequestHeader('X-CSRFToken', csrftoken);
            }
        }
    });

    // ─── Carrega campanhas e opções ────────────────────
    function loadCampanhas() {
        $table.empty();
        $no.hide();

        $.getJSON(listUrl)
            .done(resp => {
                const campanhas = resp.campanhas || [];
                opcoes = resp.opcoes || {};

                if (!campanhas.length) {
                    $no.show();
                    return;
                }

                campanhas.forEach(c => {
                    const di = new Date(c.data_inicio).toLocaleDateString('pt-BR');
                    const df = new Date(c.data_final).toLocaleDateString('pt-BR');
                    const statusText  = c.status ? 'Ativa' : 'Inativa';
                    const statusClass = c.status ? 'btn-success' : 'btn-secondary';

                    const statusForm = `
                        <form class="form-status" method="post" style="display:inline">
                          <input type="hidden" name="id" value="${c.id}">
                          <input type="hidden" name="status" value="${!c.status}">
                          <button type="button" class="btn-status btn btn-sm ${statusClass}">
                            ${statusText}
                          </button>
                        </form>`;

                    const row = `
                        <tr>
                          <td>${c.titulo}</td>
                          <td>${c.categoria}</td>
                          <td>${di} ${c.hora_inicio}</td>
                          <td>${df} ${c.hora_final}</td>
                          <td>${statusForm}</td>
                        </tr>`;
                    $table.append(row);
                });

                // listener dos botões de status
                $('.btn-status').on('click', function() {
                    const $btn  = $(this);
                    const $form = $btn.closest('.form-status');
                    const novoStatus = $form.find('input[name="status"]').val() === 'true';

                    $btn.prop('disabled', true);
                    $.ajax({
                        url: statusUrl,
                        type: 'POST',
                        data: $form.serialize(),
                        success: function(res) {
                            $btn
                              .toggleClass('btn-success btn-secondary')
                              .text(novoStatus ? 'Ativa' : 'Inativa');
                            $form.find('input[name="status"]').val(!novoStatus);
                            alert('✅ ' + res.message);
                        },
                        error: function(xhr) {
                            const err = xhr.responseJSON?.error || 'Erro ao atualizar status.';
                            alert('❌ ' + err);
                        },
                        complete: function() {
                            $btn.prop('disabled', false);
                        }
                    });
                });
            })
            .fail(() => {
                $no.text('Erro ao carregar campanhas.').show();
            });
    }

    // ─── Quando muda a categoria, exibe o painel correto ───
    $categoria.on('change', function() {
        const cat = this.value;
        $scopeOpts.hide();
        Object.values(panels).forEach($p => $p.hide().empty().removeClass('active'));

        if (cat === 'GERAL') return;

        const lista = opcoes[cat] || [];
        const grid  = $('<div class="checkbox-grid"></div>');
        lista.forEach(o => {
            grid.append(`
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" value="${o.id}" id="scope-${cat}-${o.id}">
                  <label class="form-check-label" for="scope-${cat}-${o.id}">${o.nome}</label>
                </div>`);
        });

        panels[cat].append(grid).addClass('active').show();
        $scopeOpts.show();
    });

    // ─── Auto-preenche horas mínimas/máximas ─────────────
    $('#campanha-data-inicio').on('change', () => $('#campanha-hora-inicio').val('00:01'));
    $('#campanha-data-final').on('change',  () => $('#campanha-hora-final').val('23:59'));

    // ─── Submissão do formulário ─────────────────────────
    $form.on('submit', function(e) {
        e.preventDefault();

        const titulo      = $('#campanha-titulo').val();
        const bannerFile  = $('#campanha-banner')[0].files[0];
        const di          = $('#campanha-data-inicio').val();
        const hi          = $('#campanha-hora-inicio').val();
        const df          = $('#campanha-data-final').val();
        const hf          = $('#campanha-hora-final').val();
        const categoria   = $('#campanha-categoria').val();

        if (!titulo || !bannerFile || !di || !hi || !df || !hf) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        const formData = new FormData();
        formData.append('titulo',      titulo);
        formData.append('banner',      bannerFile);
        formData.append('data_inicio', di);
        formData.append('hora_inicio', hi);
        formData.append('data_final',  df);
        formData.append('hora_final',  hf);
        formData.append('categoria',   categoria);
        formData.append('status',      'true');

        // coleta IDs do M2M
        $(`#options-${categoria} input:checked`).each(function() {
            formData.append(categoria.toLowerCase()+'s', $(this).val());
        });

        $.ajax({
            url: createUrl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function() {
                alert('Campanha criada com sucesso!');
                location.reload();
            },
            error: function(xhr) {
                alert('❌ Erro: ' + (xhr.responseJSON?.error || 'Tente novamente.'));
            }
        });
    });

    // ─── Inicialização ────────────────────────────────────
    loadCampanhas();
});
