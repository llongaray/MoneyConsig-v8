// static/js/apps/usuarios/permissionacess.js

$(function() {
    console.log('Script de Permissões iniciado.');
  
    // --- Pega o CSRF token ---
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
    const csrftoken = getCookie('csrftoken');
  
    // Configuração global do AJAX para incluir o CSRF token
    $.ajaxSetup({
      beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
          xhr.setRequestHeader("X-CSRFToken", csrftoken);
        }
      }
    });
  
    // --- Genérico AJAX POST ---
    function sendPost(url, data, onSuccess) {
      $.ajax({
        url,
        method: 'POST',
        contentType: 'application/json',
        headers: { 'X-CSRFToken': csrftoken },
        data: JSON.stringify(data),
        success(resp) {
          alert('✅ Operação bem-sucedida!');
          if (onSuccess) onSuccess(resp);
          loadAll();
        },
        error(xhr) {
          console.error(xhr.responseText);
          alert('❌ Erro ao salvar. Veja console.');
        }
      });
    }
  
    // --- Carrega todos os dados ---
    function loadAcessos() {
      $.getJSON('/autenticacao/api/acessos/')
        .done(res => {
          const grp = $('#grupo_acesso_acessos_container').empty();
          const mnl = $('#controle_acesso_acessos_container').empty();
          if (!res.acessos.length) {
            grp.html('<p class="text-muted text-center">Nenhum acesso.</p>');
            mnl.html('<p class="text-muted text-center">Nenhum acesso.</p>');
            return;
          }
          res.acessos.forEach(a => {
            const item = `
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="acesso_${a.id}" value="${a.id}">
                <label class="form-check-label" for="acesso_${a.id}">
                  ${a.nome} <small class="text-muted">(${a.tipo})</small>
                </label>
              </div>`;
            grp.append(item);
            mnl.append(item);
          });
        })
        .fail(() => {
          $('#grupo_acesso_acessos_container, #controle_acesso_acessos_container')
            .html('<p class="text-danger text-center">Erro ao carregar acessos.</p>');
        });
    }
  
    function loadGroups() {
      const sel = $('#controle_acesso_grupo_favorito')
        .empty()
        .append('<option value="">--- Selecione um Grupo ---</option>');
      $.getJSON('/autenticacao/api/grupos-acessos/')
        .done(res => {
          res.groups_acessos.forEach(g => {
            sel.append(
              `<option value="${g.id}" data-acessos='${JSON.stringify(g.acessos)}'>
                 ${g.titulo}
               </option>`
            );
          });
        })
        .fail(() => {
          sel.html('<option value="">Erro ao carregar grupos</option>');
        });
    }
  
    // --- Atualizado: Carrega e popula o container de Usuários via API ---
    function loadUsers() {
      const container = $('#controle_acesso_usuarios_container').empty();
      $.getJSON('/autenticacao/api/users-info/')
        .done(res => {
          if (!res.infousers.length) {
            container.html('<p class="text-muted text-center">Nenhum usuário encontrado.</p>');
            return;
          }
          
          // Adiciona checkbox para cada usuário
          res.infousers.forEach(u => {
            container.append(`
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="user_${u.user_id}" value="${u.user_id}">
                <label class="form-check-label" for="user_${u.user_id}">
                  ${u.nome_completo}
                </label>
              </div>`);
          });
        })
        .fail(() => {
          container.html('<p class="text-danger text-center">Erro ao carregar usuários</p>');
        });
    }
  
    function loadAll() {
      loadAcessos();
      loadGroups();
      loadUsers();
      loadUsersAdicionar();
      loadGroupsAdicionar();
    }
  
    // --- Funções específicas para a seção "Adicionar Acessos" ---
    function loadUsersAdicionar() {
      const container = $('#adicionar_acesso_usuarios_container').empty();
      // Reset do checkbox "Selecionar Todos"
      $('#adicionar_select_all_users').prop('checked', false).prop('indeterminate', false);
      
      $.getJSON('/autenticacao/api/users-info/')
        .done(res => {
          if (!res.infousers.length) {
            container.html('<p class="text-muted text-center">Nenhum usuário encontrado.</p>');
            return;
          }
          
          // Adiciona checkbox para cada usuário
          res.infousers.forEach(u => {
            container.append(`
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="add_user_${u.user_id}" value="${u.user_id}">
                <label class="form-check-label" for="add_user_${u.user_id}">
                  ${u.nome_completo}
                </label>
              </div>`);
          });
        })
        .fail(() => {
          container.html('<p class="text-danger text-center">Erro ao carregar usuários</p>');
        });
    }

    function loadGroupsAdicionar() {
      const sel = $('#adicionar_acesso_grupo_favorito')
        .empty()
        .append('<option value="">--- Selecione um Grupo ---</option>');
      $.getJSON('/autenticacao/api/grupos-acessos/')
        .done(res => {
          res.groups_acessos.forEach(g => {
            sel.append(
              `<option value="${g.id}" data-acessos='${JSON.stringify(g.acessos)}'>
                 ${g.titulo}
               </option>`
            );
          });
        })
        .fail(() => {
          sel.html('<option value="">Erro ao carregar grupos</option>');
        });
    }

    function loadAcessosAdicionar() {
      // Reset do checkbox "Selecionar Todos"
      $('#adicionar_select_all_acessos').prop('checked', false).prop('indeterminate', false);
      
      $.getJSON('/autenticacao/api/acessos/')
        .done(res => {
          const mnl = $('#adicionar_acesso_acessos_container').empty();
          if (!res.acessos.length) {
            mnl.html('<p class="text-muted text-center">Nenhum acesso.</p>');
            return;
          }
          res.acessos.forEach(a => {
            const item = `
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="add_acesso_${a.id}" value="${a.id}">
                <label class="form-check-label" for="add_acesso_${a.id}">
                  ${a.nome} <small class="text-muted">(${a.tipo})</small>
                </label>
              </div>`;
            mnl.append(item);
          });
        })
        .fail(() => {
          $('#adicionar_acesso_acessos_container')
            .html('<p class="text-danger text-center">Erro ao carregar acessos.</p>');
        });
    }

    function toggleContainersAdicionar() {
      const metodo = $('#adicionar_acesso_metodo').val();
      $('#adicionar_acesso_manual_container, #adicionar_acesso_favoritos_container').hide();
      if (metodo === 'manual') {
        $('#adicionar_acesso_manual_container').show();
        loadAcessosAdicionar();
      } else if (metodo === 'favoritos') {
        $('#adicionar_acesso_favoritos_container').show();
      }
    }
  
    // --- Oculta/Exibe containers conforme método ---
    function toggleContainers() {
      const metodo = $('#controle_acesso_metodo').val();
      $('#controle_acesso_manual_container, #controle_acesso_favoritos_container').hide();
      if (metodo === 'manual') {
        $('#controle_acesso_manual_container').show();
      } else if (metodo === 'favoritos') {
        $('#controle_acesso_favoritos_container').show();
      }
    }
  
    // --- Submissões de formulários ---
    $('#form-acesso').submit(function(e) {
      e.preventDefault();
      const nome   = $('#acesso_nome').val().trim();
      const tipo   = $('#acesso_tipo').val();
      const status = $('#acesso_status').is(':checked');
      if (!nome || !tipo) return alert('Preencha nome e tipo.');
      sendPost('/autenticacao/api/acessos/new/', { titulo: nome, tipo, status }, () => this.reset());
    });
  
    $('#form-grupo-acesso').submit(function(e) {
      e.preventDefault();
      const titulo = $('#grupo_acesso_titulo').val().trim();
      const status = $('#grupo_acesso_status').is(':checked');
      const acessos = $('#grupo_acesso_acessos_container input:checked').map((_,c) => c.value).get();
      if (!titulo || !acessos.length) return alert('Título e ao menos 1 acesso.');
      sendPost('/autenticacao/api/grupos-acessos/new/', { titulo, acessos, status }, () => this.reset());
    });
  
    $('#form-controle-acesso').submit(function(e) {
      e.preventDefault();
      const userIds = $('#controle_acesso_usuarios_container input:checked').map((_,c) => c.value).get();
      const metodo = $('#controle_acesso_metodo').val();
      const status = $('#controle_acesso_status').is(':checked');
      
      if (!userIds.length || !metodo) {
        return alert('Selecione pelo menos um usuário e o método.');
      }

      let acessos = [];
      if (metodo === 'manual') {
        acessos = $('#controle_acesso_acessos_container input:checked').map((_,c) => c.value).get();
      } else {
        acessos = $('#controle_acesso_favoritos_acessos_container input:checked').map((_,c) => c.value).get();
      }

      // Envia para a nova API de múltiplos usuários
      $.ajax({
        url: '/autenticacao/api/users-acessos/register-multiple/',
        method: 'POST',
        contentType: 'application/json',
        headers: { 'X-CSRFToken': csrftoken },
        data: JSON.stringify({ 
          user_ids: userIds,
          acessos: acessos,
          status: status
        }),
        success: function(resp) {
          if (resp.status === 'success') {
            let message = `✅ Acessos registrados com sucesso!\n`;
            message += `Total processado: ${resp.total_processed}\n`;
            message += `Sucesso: ${resp.successful}\n`;
            if (resp.failed > 0) {
              message += `Falhas: ${resp.failed}\n`;
              message += `Verifique o console para detalhes.`;
              console.error('Falhas no registro:', resp.errors);
            }
            alert(message);
            
            // Limpa o formulário
            this.reset();
            toggleContainers();
            $('#controle_acesso_favoritos_acessos_container')
              .html('<p class="text-muted text-center">Selecione um grupo para ver os acessos.</p>');
          } else {
            alert('❌ Erro ao registrar acessos: ' + resp.message);
          }
        }.bind(this),
        error: function(xhr) {
          console.error('Erro na requisição:', xhr.responseText);
          alert('❌ Erro ao registrar acessos. Verifique o console para detalhes.');
        }
      });
    });

    // Formulário para adicionar acessos (sem substituir)
    $('#form-adicionar-acesso').submit(function(e) {
      e.preventDefault();
      const userIds = $('#adicionar_acesso_usuarios_container input:checked').map((_,c) => c.value).get();
      const metodo = $('#adicionar_acesso_metodo').val();
      const status = $('#adicionar_acesso_status').is(':checked');
      
      if (!userIds.length || !metodo) {
        return alert('Selecione pelo menos um usuário e o método.');
      }

      let acessos = [];
      if (metodo === 'manual') {
        acessos = $('#adicionar_acesso_acessos_container input:checked').map((_,c) => c.value).get();
      } else {
        acessos = $('#adicionar_acesso_favoritos_acessos_container input:checked').map((_,c) => c.value).get();
      }

      if (!acessos.length) {
        return alert('Selecione pelo menos um acesso para adicionar.');
      }

      // Envia para a nova API de adicionar acessos múltiplos
      $.ajax({
        url: '/autenticacao/api/users-acessos/add-multiple/',
        method: 'POST',
        contentType: 'application/json',
        headers: { 'X-CSRFToken': csrftoken },
        data: JSON.stringify({ 
          user_ids: userIds,
          acessos: acessos,
          status: status
        }),
        success: function(resp) {
          if (resp.status === 'success') {
            let message = `✅ Acessos adicionados com sucesso!\n`;
            message += `Total processado: ${resp.total_processed}\n`;
            message += `Sucesso: ${resp.successful}\n`;
            
            // Mostra detalhes dos resultados
            if (resp.results && resp.results.length > 0) {
              let detalhes = resp.results.map(r => 
                `• Usuário ${r.user_id}: +${r.acessos_adicionados} novos acessos (total: ${r.total_acessos})`
              ).join('\n');
              message += `\nDetalhes:\n${detalhes}`;
            }
            
            if (resp.failed > 0) {
              message += `\nFalhas: ${resp.failed}\n`;
              message += `Verifique o console para detalhes.`;
              console.error('Falhas na adição:', resp.errors);
            }
            alert(message);
            
            // Limpa o formulário
            this.reset();
            toggleContainersAdicionar();
            $('#adicionar_acesso_favoritos_acessos_container')
              .html('<p class="text-muted text-center">Selecione um grupo para ver os acessos.</p>');
          } else {
            alert('❌ Erro ao adicionar acessos: ' + resp.message);
          }
        }.bind(this),
        error: function(xhr) {
          console.error('Erro na requisição:', xhr.responseText);
          alert('❌ Erro ao adicionar acessos. Verifique o console para detalhes.');
        }
      });
    });
  
    // --- Eventos ---
    $('#controle_acesso_metodo').on('change', toggleContainers);

    $('#controle_acesso_grupo_favorito').on('change', function() {
      const ids = $(this).find(':selected').data('acessos') || [];
      const box = $('#controle_acesso_favoritos_acessos_container').empty();
      if (!ids.length) {
        return box.html('<p class="text-muted text-center">Este grupo não possui acessos.</p>');
      }
      $.getJSON('/autenticacao/api/acessos/')
        .done(res => {
          res.acessos.forEach(a => {
            const checked = ids.includes(a.id) ? 'checked' : '';
            box.append(`
              <div class="form-check">
                <input class="form-check-input" type="checkbox"
                       id="fav_acesso_${a.id}" value="${a.id}" disabled ${checked}>
                <label class="form-check-label" for="fav_acesso_${a.id}">
                  ${a.nome} <small class="text-muted">(${a.tipo})</small>
                </label>
              </div>`);
          });
        })
        .fail(() => {
          box.html('<p class="text-danger text-center">Erro ao carregar acessos do grupo.</p>');
        });
    });

    // Eventos para a seção "Adicionar Acessos"
    $('#adicionar_acesso_metodo').on('change', toggleContainersAdicionar);

    // Evento para selecionar/desselecionar todos os usuários na seção adicionar
    $('#adicionar_select_all_users').on('change', function() {
      const isChecked = $(this).is(':checked');
      $('#adicionar_acesso_usuarios_container input[type="checkbox"]').prop('checked', isChecked);
    });

    // Evento para selecionar/desselecionar todos os acessos na seção adicionar
    $('#adicionar_select_all_acessos').on('change', function() {
      const isChecked = $(this).is(':checked');
      $('#adicionar_acesso_acessos_container input[type="checkbox"]').prop('checked', isChecked);
    });

    // Atualiza o estado do "selecionar todos usuários" quando checkboxes individuais mudam
    $('#adicionar_acesso_usuarios_container').on('change', 'input[type="checkbox"]', function() {
      const totalCheckboxes = $('#adicionar_acesso_usuarios_container input[type="checkbox"]').length;
      const checkedCheckboxes = $('#adicionar_acesso_usuarios_container input[type="checkbox"]:checked').length;
      
      if (checkedCheckboxes === 0) {
        $('#adicionar_select_all_users').prop('indeterminate', false).prop('checked', false);
      } else if (checkedCheckboxes === totalCheckboxes) {
        $('#adicionar_select_all_users').prop('indeterminate', false).prop('checked', true);
      } else {
        $('#adicionar_select_all_users').prop('indeterminate', true);
      }
    });

    // Atualiza o estado do "selecionar todos acessos" quando checkboxes individuais mudam
    $('#adicionar_acesso_acessos_container').on('change', 'input[type="checkbox"]', function() {
      const totalCheckboxes = $('#adicionar_acesso_acessos_container input[type="checkbox"]').length;
      const checkedCheckboxes = $('#adicionar_acesso_acessos_container input[type="checkbox"]:checked').length;
      
      if (checkedCheckboxes === 0) {
        $('#adicionar_select_all_acessos').prop('indeterminate', false).prop('checked', false);
      } else if (checkedCheckboxes === totalCheckboxes) {
        $('#adicionar_select_all_acessos').prop('indeterminate', false).prop('checked', true);
      } else {
        $('#adicionar_select_all_acessos').prop('indeterminate', true);
      }
    });

    $('#adicionar_acesso_grupo_favorito').on('change', function() {
      const ids = $(this).find(':selected').data('acessos') || [];
      const box = $('#adicionar_acesso_favoritos_acessos_container').empty();
      if (!ids.length) {
        return box.html('<p class="text-muted text-center">Este grupo não possui acessos.</p>');
      }
      $.getJSON('/autenticacao/api/acessos/')
        .done(res => {
          res.acessos.forEach(a => {
            const checked = ids.includes(a.id) ? 'checked' : '';
            box.append(`
              <div class="form-check">
                <input class="form-check-input" type="checkbox"
                       id="add_fav_acesso_${a.id}" value="${a.id}" disabled ${checked}>
                <label class="form-check-label" for="add_fav_acesso_${a.id}">
                  ${a.nome} <small class="text-muted">(${a.tipo})</small>
                </label>
              </div>`);
          });
        })
        .fail(() => {
          box.html('<p class="text-danger text-center">Erro ao carregar acessos do grupo.</p>');
        });
    });
    
    // ⭐️ Ao mudar usuário ou método, marcar os acessos já cadastrados (só em manual)
    $('#controle_acesso_metodo').on('change', function() {
        console.log('DEBUG: Evento change acionado para método');
        
        const userIds = $('#controle_acesso_usuarios_container input:checked').map((_,c) => c.value).get();
        const metodo = $('#controle_acesso_metodo').val();
        console.log(`DEBUG: Usuários selecionados: ${userIds}, Método selecionado: ${metodo}`);

        // só continua se for manual e users selecionados
        if (!userIds.length || metodo !== 'manual') {
            console.log('DEBUG: Abortando pré-seleção (não é manual ou users vazios)');
            // limpa checkboxes manual
            $('#controle_acesso_acessos_container input[type=checkbox]').prop('checked', false);
            return;
        }

        // Se for manual e tiver apenas um usuário selecionado, busca os acessos dele
        if (userIds.length === 1) {
            console.log('DEBUG: Buscando acessos para um único usuário');
            $.getJSON('/autenticacao/api/users-acessos/')
            .done(res => {
                const controle = res.user_acessos.find(u => String(u.user_id) === userIds[0]);
                if (controle) {
                    const acessosIds = controle.acessos || [];
                    console.log(`DEBUG: Acessos encontrados para o usuário: ${acessosIds.join(', ')}`);
                    
                    // Marca os checkboxes correspondentes
                    acessosIds.forEach(id => {
                        $(`#controle_acesso_acessos_container input[value="${id}"]`)
                        .prop('checked', true);
                    });
                }
            })
            .fail(() => {
                console.error('ERRO: Falha ao carregar os acessos do usuário');
            });
        } else {
            // Se tiver mais de um usuário, mantém os checkboxes como estão
            console.log('DEBUG: Múltiplos usuários selecionados, mantendo checkboxes atuais');
        }
    });

    // Adiciona evento para atualizar acessos quando usuários são selecionados/deselecionados
    $('#controle_acesso_usuarios_container').on('change', 'input[type="checkbox"]', function() {
        const userIds = $('#controle_acesso_usuarios_container input:checked').map((_,c) => c.value).get();
        const metodo = $('#controle_acesso_metodo').val();
        
        // Se o método for manual
        if (metodo === 'manual') {
            // Se tiver apenas um usuário selecionado, busca os acessos dele
            if (userIds.length === 1) {
                console.log('DEBUG: Buscando acessos para novo usuário único');
                $.getJSON('/autenticacao/api/users-acessos/')
                .done(res => {
                    const controle = res.user_acessos.find(u => String(u.user_id) === userIds[0]);
                    if (controle) {
                        const acessosIds = controle.acessos || [];
                        console.log(`DEBUG: Acessos encontrados para o usuário: ${acessosIds.join(', ')}`);
                        
                        // Marca os checkboxes correspondentes
                        acessosIds.forEach(id => {
                            $(`#controle_acesso_acessos_container input[value="${id}"]`)
                            .prop('checked', true);
                        });
                    }
                })
                .fail(() => {
                    console.error('ERRO: Falha ao carregar os acessos do usuário');
                });
            } else if (userIds.length === 0) {
                // Se não tiver nenhum usuário selecionado, limpa os checkboxes
                $('#controle_acesso_acessos_container input[type=checkbox]').prop('checked', false);
            }
            // Se tiver mais de um usuário, mantém os checkboxes como estão
        }
    });

    // --- Inicialização ---
    loadAll();
    toggleContainers();
    toggleContainersAdicionar();
    console.log('Script de Permissões carregado.');
  });
  