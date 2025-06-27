// siape_prompter.js

$(document).ready(function(){
  console.log('🚀 Iniciando requisição AJAX para obter dados da API...');
  
  // Funcionalidade para abrir/fechar calculadoras
  setupCalculadoras();
  
  // Inicialmente esconde todas as versões de fichas até ter dados
  $('#siape-version, #inss-version, #fgts-version').hide();
  // Inicialmente esconde também a coluna 2 até termos dados
  $('#col2').hide();
  // Inicialmente também oculta a coluna 3 (agendamentos) até termos dados
  $('#col3').hide();
  
  $.ajax({
    url: '/moneyplus/api/get/baseclientes/',
    method: 'GET',
    dataType: 'json',
    success: function(data){
      console.log('✅ Dados recebidos da API:', data);

      // Verifica se há dados válidos (cliente e campanha)
      if (data && data.cliente) {
        const cliente    = data.cliente;
        const debitos    = data.debitos;
        const campanhaId = data.campanha_id;  // captura o campanha_id aqui!

        // Atualiza o cabeçalho com o produto
        $('#ficha-cliente-produto').text(cliente.produto);
        console.log('Produto definido:', cliente.produto);
 
        // Mostra a coluna 2 quando temos dados
        $('#col2').show();
        // Mostra também a coluna 3 (agendamentos)
        $('#col3').show();

        // Atualiza as fichas conforme produto
        if (cliente.produto === 'SIAPE') {
            $('#siape-version').show();
            $('#inss-version, #fgts-version').hide();
            updateSiapeData(cliente, debitos);
        } else if (cliente.produto === 'INSS') {
            $('#inss-version').show();
            $('#siape-version, #fgts-version').hide();
            updateInssInfoData(cliente);
            updateInssDebitosData(debitos);
        } else if (cliente.produto === 'FGTS') {
            $('#fgts-version').show();
            $('#siape-version, #inss-version').hide();
            updateFgtsData(cliente);
        } else {
            console.warn('⚠️ Produto desconhecido:', cliente.produto);
            // Se produto desconhecido, não mostra nenhuma ficha
            $('#siape-version, #inss-version, #fgts-version').hide();
            // E também esconde a coluna 2
            $('#col2').hide();
            // E esconde a coluna 3 (agendamentos)
            $('#col3').hide();
        }

        // Chama funções de layout
        ocultarCamposVazios();
        ocultarColunasVazias('.table-beneficios');
        ocultarColunasVazias('#table-emprestimos');
        ocultarCardsVazios();
        atualizarVisibilidadeColunas('.table-beneficios');
        atualizarVisibilidadeColunas('#table-emprestimos');

        // Popula os hidden inputs
        $('#cpf_cliente_tabulacao').val(cliente.cpf);
        $('#id_cliente_tabulacao').val(cliente.id);
        $('#cliente_id_tabulacao').val(cliente.id);
        $('#campanha_id_tabulacao').val(campanhaId);
        $('#produto_tabulacao').val(cliente.produto);

        $('#campanha_id_agendamentos').val(campanhaId);
        $('#cliente_id_agendamentos').val(cliente.id);
        $('#produto_cliente_agendamentos').val(cliente.produto);
      } else {
        console.log('⚠️ Nenhum dado de cliente encontrado ou usuário sem campanha ativa');
        // Nenhum dado de cliente/campanha, esconde todas as fichas
        $('#siape-version, #inss-version, #fgts-version').hide();
        // Esconde também a coluna 2
        $('#col2').hide();
        // E esconde a coluna 3 (agendamentos)
        $('#col3').hide();
        
        // Exibe uma mensagem para o usuário
        mostrarMensagemSemDados();
      }
    },
    error: function(xhr, status, error){
      console.error('❌ Erro ao obter dados da API:', error);
      // Em caso de erro, também esconde todas as fichas
      $('#siape-version, #inss-version, #fgts-version').hide();
      // Esconde também a coluna 2
      $('#col2').hide();
      // E esconde a coluna 3 (agendamentos)
      $('#col3').hide();
      mostrarMensagemErro(error);
    }
  });
});
  
  
  function updateFgtsData(cliente) {
    console.log("🔄 Atualizando dados para FGTS...");
    
    // 0) Exibe a versão FGTS e esconde as outras
    $('#fgts-version').show();
    $('#siape-version, #inss-version').hide();
  
    // 1) Informações Pessoais
    $("#fgts-info-card span[data-field='cpf']               .value").text(cliente.cpf);
    $("#fgts-info-card span[data-field='nome']              .value").text(cliente.nome_completo);
    $("#fgts-info-card span[data-field='data_nascimento']   .value").text(cliente.data_nasc);
    $("#fgts-info-card span[data-field='idade']             .value").text(cliente.idade);
  
    // 2) Endereço
    $("#fgts-enderecos-card span[data-field='tipo'] .value").text(cliente.tipo);
    $("#fgts-enderecos-card span[data-field='logradouro']   .value").text(cliente.logradouro);
    $("#fgts-enderecos-card span[data-field='numero']       .value").text(cliente.numero);
    $("#fgts-enderecos-card span[data-field='complemento']  .value").text(cliente.complemento);
    $("#fgts-enderecos-card span[data-field='bairro']       .value").text(cliente.bairro);
    $("#fgts-enderecos-card span[data-field='cidade']       .value").text(cliente.cidade);
    $("#fgts-enderecos-card span[data-field='uf']           .value").text(cliente.uf);
    $("#fgts-enderecos-card span[data-field='cep']          .value").text(cliente.cep);
  
    // 3) Financeiro
    $("#fgts-financeiro-card span[data-field='salario']          .value").text(cliente.salario);
    $("#fgts-financeiro-card span[data-field='saldo_aproximado'] .value").text(cliente.saldo_aproximado);
    $("#fgts-financeiro-card span[data-field='flag_fgts']        .value")
      .text(cliente.flag_fgts ? "Sim" : "Não");
  
    // 4) Profissional
    $("#fgts-profissional-card span[data-field='data_admissao']        .value").text(cliente.data_admissao);
    $("#fgts-profissional-card span[data-field='razao_social']         .value").text(cliente.razao_social);
    $("#fgts-profissional-card span[data-field='tempo_contribuicao']   .value").text(cliente.tempo_contribuicao);
    $("#fgts-profissional-card span[data-field='demografica']          .value").text(cliente.demografica);
    $("#fgts-profissional-card span[data-field='possivel_profissao']   .value").text(cliente.possivel_profissao);
    $("#fgts-profissional-card span[data-field='score']                .value").text(cliente.score);
  
    // 5) Contato
    $("#fgts-contato-card span[data-field='cel1'] .value").text(cliente.cel1);

    if (cliente.cel1 && cliente.cel1.trim() !== "") {
      $("#fgts-contato-card span[data-field='procon_cel1']").show();
      $("#fgts-contato-card span[data-field='fl_whatsapp_cel1']").show();
      $("#fgts-contato-card span[data-field='procon_cel1'] .value").text(cliente.procon_cel1);
      $("#fgts-contato-card span[data-field='fl_whatsapp_cel1'] .value")
        .text(cliente.fl_whatsapp_cel1 ? "Sim" : "Não");
    } else {
      $("#fgts-contato-card span[data-field='procon_cel1']").hide();
      $("#fgts-contato-card span[data-field='fl_whatsapp_cel1']").hide();
    }

    $("#fgts-contato-card span[data-field='cel2'] .value").text(cliente.cel2);

    if (cliente.cel2 && cliente.cel2.trim() !== "") {
      $("#fgts-contato-card span[data-field='procon_cel2']").show();
      $("#fgts-contato-card span[data-field='fl_whatsapp_cel2']").show();
      $("#fgts-contato-card span[data-field='procon_cel2'] .value").text(cliente.procon_cel2);
      $("#fgts-contato-card span[data-field='fl_whatsapp_cel2'] .value")
        .text(cliente.fl_whatsapp_cel2 ? "Sim" : "Não");
    } else {
      $("#fgts-contato-card span[data-field='procon_cel2']").hide();
      $("#fgts-contato-card span[data-field='fl_whatsapp_cel2']").hide();
    }

    $("#fgts-contato-card span[data-field='email1'] .value").text(cliente.email1);
  
    // 6) Helpers de layout
    ocultarCamposVazios();
    ocultarCardsVazios();
  }
  
  
  // ===========================
  // Atualiza ficha SIAPE
  // ===========================
  function updateSiapeData(cliente, debitos) {
    console.log("🔄 Atualizando dados para SIAPE...");
    // Atualiza informações pessoais
    $("#siape-info-card span[data-field='nome'] .value").text(cliente.nome_completo);
    $("#siape-info-card span[data-field='cpf'] .value").text(cliente.cpf);
    $("#siape-info-card span[data-field='data_nasc'] .value").text(cliente.data_nasc);
    $("#siape-info-card span[data-field='idade'] .value").text(cliente.idade);
    $("#siape-info-card span[data-field='rjur'] .value").text(cliente.rjur);
    
    // Atualiza dados complementares
    $("#siape-dados-card span[data-field='celular_1'] .value").text(cliente.celular_1);
    $("#siape-dados-card span[data-field='flg_wts_1'] .value").text(cliente.flg_wts_1 ? "Sim" : "Não");
    $("#siape-dados-card span[data-field='celular_2'] .value").text(cliente.celular_2);
    $("#siape-dados-card span[data-field='flg_wts_2'] .value").text(cliente.flg_wts_2 ? "Sim" : "Não");
    $("#siape-dados-card span[data-field='celular_3'] .value").text(cliente.celular_3);
    $("#siape-dados-card span[data-field='flg_wts_3'] .value").text(cliente.flg_wts_3 ? "Sim" : "Não");
    
    // Situação financeira
    $("#siape-situacao-card span[data-field='situacao_funcional'] .value").text(cliente.situacao_funcional);
    $("#siape-situacao-card span[data-field='margem_saldo'] .value").text(cliente.margem_disponivel_geral);
    
    // Margens Cartões
    $("#siape-margens-card span[data-field='rmc_bruta'] .value").text(cliente.rmc_bruta);
    $("#siape-margens-card span[data-field='rmc_util'] .value").text(cliente.rmc_util);
    $("#siape-margens-card span[data-field='rcc_bruta'] .value").text(cliente.rcc_bruta);
    $("#siape-margens-card span[data-field='rcc_util'] .value").text(cliente.rcc_util);
    
    // Margem 35%
    $("#siape-margem35-card span[data-field='trinta_cinco_bruta'] .value").text(cliente.trinta_cinco_bruta);
    $("#siape-margem35-card span[data-field='trinta_cinco_util'] .value").text(cliente.trinta_cinco_util);
    $("#siape-margem35-card span[data-field='trinta_cinco_saldo'] .value").text(cliente.trinta_cinco_saldo);
    
    // Empréstimos (SIAPE) - Tabela de débitos
    var tbodyHtml = "";
    if(debitos && debitos.length > 0){
      $.each(debitos, function(index, debito){
        tbodyHtml += "<tr>" +
                        "<td>" + (debito.matricula || "") + "</td>" +
                        "<td>" + (debito.banco || "") + "</td>" +
                        "<td>" + (debito.orgao || "") + "</td>" +
                        "<td>" + (debito.upag || "") + "</td>" +
                        "<td>" + (debito.pmt || "") + "</td>" +
                        "<td>" + (debito.prazo ? debito.prazo + " meses" : "") + "</td>" +
                        "<td>" + (debito.saldo_devedor || "") + "</td>" +
                      "</tr>";
      });
    } else {
      tbodyHtml = "<tr><td colspan='7'>Nenhum débito encontrado</td></tr>";
    }
    $("#siape-emprestimos-card .table-emprestimos tbody").html(tbodyHtml);
    
    // Executa os helpers de layout para esconder campos e cards vazios
    ocultarCamposVazios();
    ocultarCardsVazios();
  }
  
  // ===========================
  // Atualiza ficha INSS: Informações (card separado)
  // ===========================
  function updateInssInfoData(cliente) {
    console.log("🔄 Atualizando informações INSS...");
    // Informações Pessoais
    $("#inss-info-card span[data-field='nome'] .value").text(cliente.nome_completo);
    $("#inss-info-card span[data-field='cpf'] .value").text(cliente.cpf);
    $("#inss-info-card span[data-field='data_nasc'] .value").text(cliente.data_nasc);
    $("#inss-info-card span[data-field='idade'] .value").text(cliente.idade);
    $("#inss-info-card span[data-field='rg'] .value").text(cliente.rg);
    $("#inss-info-card span[data-field='nome_mae'] .value").text(cliente.nome_mae);
    $("#inss-info-card span[data-field='qtd_emprestimos'] .value").text(cliente.qtd_emprestimos);
    $("#inss-info-card span[data-field='possui_representante'] .value").text(cliente.possui_representante);
    
    // Endereços
    $("#inss-enderecos-card span[data-field='cep'] .value").text(cliente.cep);
    $("#inss-enderecos-card span[data-field='uf'] .value").text(cliente.uf);
    $("#inss-enderecos-card span[data-field='cidade'] .value").text(cliente.cidade);
    $("#inss-enderecos-card span[data-field='bairro'] .value").text(cliente.bairro);
    $("#inss-enderecos-card span[data-field='endereco'] .value").text(cliente.endereco);
    
    // Dados Complementares
    $("#inss-dados-card span[data-field='celular_1'] .value").text(cliente.celular_1);
    $("#inss-dados-card span[data-field='flg_wts_1'] .value").text(cliente.flg_wts_1 ? "Sim" : "Não");
    $("#inss-dados-card span[data-field='celular_2'] .value").text(cliente.celular_2);
    $("#inss-dados-card span[data-field='flg_wts_2'] .value").text(cliente.flg_wts_2 ? "Sim" : "Não");
    $("#inss-dados-card span[data-field='celular_3'] .value").text(cliente.celular_3);
    $("#inss-dados-card span[data-field='flg_wts_3'] .value").text(cliente.flg_wts_3 ? "Sim" : "Não");
    
    // Situação Financeira
    $("#inss-situacao-card span[data-field='liberacao_emprestimo'] .value").text(cliente.liberacao_emprestimo ? "Sim" : "Não");
    
    // Desconto Associação
    $("#inss-desconto-card span[data-field='desconto'] .value").text(cliente.flg_desconto ? "Sim" : "Não");
    $("#inss-desconto-card span[data-field='taxa_associativa'] .value").text(cliente.taxa_associativa);
    $("#inss-desconto-card span[data-field='valor_parcela_associacao'] .value").text(cliente.parcela);
    
    // Margens Cartões
    $("#inss-margens-card span[data-field='rmc_saldo'] .value").text(cliente.rmc_saldo);
    $("#inss-margens-card span[data-field='rcc_saldo'] .value").text(cliente.rcc_saldo);
    
    // Executa os helpers de layout para esconder campos e cards vazios
    ocultarCamposVazios();
    ocultarCardsVazios();
  }
  
  // ===========================
  // Atualiza ficha INSS: Tabela de Débitos (card separado)
  // ===========================
  function updateInssDebitosData(debitos) {
    console.log("🔄 Atualizando débitos INSS...");
    let tbodyHtml = "";
  
    if (debitos && debitos.length) {
      $.each(debitos, function(_, debito) {
        // Cálculo do saldo devedor
        const vp = parseFloat(debito.valor_parcela) || 0;
        const rest = parseInt(debito.restantes, 10) || 0;
        const saldoDevedor = (vp * rest).toFixed(2);
  
        tbodyHtml += "<tr>" +
                        "<td>" + (debito.matricula       || "") + "</td>" + // matrícula
                        "<td>" + (debito.cod_banco       || "") + "</td>" + // código do banco
                        "<td>" + (debito.cod_contrato    || "") + "</td>" + // contrato
                        "<td>" + (debito.tipo_emprestimo || "") + "</td>" + // tipo empréstimo
                        "<td>" + (debito.valor_parcela   || "") + "</td>" + // valor da parcela
                        "<td>" + (debito.prazo 
                                    ? debito.prazo + " meses" 
                                    : "") + "</td>" +                // prazo total
                        "<td>" + (debito.restantes 
                                    ? debito.restantes + " meses restantes" 
                                    : "") + "</td>" +                // parcelas restantes
                        "<td>" + (debito.taxa            || "") + "</td>" + // taxa
                        "<td>" + saldoDevedor             + "</td>" +      // saldo devedor calculado
                      "</tr>";
      });
    } else {
      tbodyHtml = "<tr><td colspan='9'>Nenhum débito encontrado</td></tr>";
    }
  
    $("#inss-emprestimos-card .table-emprestimos tbody")
      .html(tbodyHtml);
      
    // Oculta colunas vazias nas tabelas após atualizar os dados
    ocultarColunasVazias("#inss-emprestimos-card .table-emprestimos");
  }
  
  // Funções auxiliares para ocultar campos e colunas vazias
  
  function ocultarCamposVazios() {
    console.log("🔍 Verificando campos vazios na ficha do cliente...");
    $("#col2 .ficha-cliente-row span[data-field], #col2 span[data-field]").each(function() {
      var valorCampo = $(this).find(".value").text().trim();
      if (valorCampo === "" || valorCampo === "null" || valorCampo === "undefined") {
        console.log("Campo vazio encontrado, ocultando:", $(this).attr("data-field"));
        $(this).hide();
      } else {
        console.log("Campo preenchido (" + $(this).attr("data-field") + "):", valorCampo);
        $(this).show();
      }
    });
  }
  
  function ocultarCardsVazios() {
    console.log("🔍 Verificando cards vazios...");
    $("#col2 .card").each(function() {
      var card = $(this);
      var elementosVisiveis = card.find("span[data-field]:visible, table tbody tr:not(:contains('Nenhum débito encontrado')):visible").length;
      
      console.log("Card", card.attr("id"), "possui", elementosVisiveis, "elementos visíveis.");
      
      // Se o card tiver uma tabela, verifica se há linhas visíveis além da mensagem de 'nenhum débito'
      var temTabela = card.find("table").length > 0;
      var tabelaVazia = true;
      
      if (temTabela) {
        var tabelaComDados = card.find("table tbody tr").not(":contains('Nenhum débito encontrado')").length > 0;
        tabelaVazia = !tabelaComDados;
      }
      
      if (elementosVisiveis === 0 && (tabelaVazia || !temTabela)) {
        console.log("Nenhum elemento visível encontrado. Ocultando card:", card.attr("id"));
        card.hide();
      } else {
        console.log("Card", card.attr("id"), "com elementos visíveis. Mantendo-o exibido.");
        card.show();
      }
    });
  }
  
  function ocultarColunasVazias(tableSelector) {
    console.log("🔍 Verificando colunas vazias para:", tableSelector);
    $("#col2 " + tableSelector).each(function() {
      var table = $(this);
      var colCount = table.find("thead tr th").length;
      for (var i = 0; i < colCount; i++) {
        var colunaVazia = true;
        table.find("tbody tr").each(function() {
          // Ignora linhas com mensagens de "Nenhum débito encontrado"
          if ($(this).text().includes("Nenhum débito encontrado")) {
            return true;
          }
          
          var cellText = $(this).find("td").eq(i).text().trim();
          if (cellText !== "" && cellText !== "null" && cellText !== "undefined") {
            colunaVazia = false;
            return false;
          }
        });
        if (colunaVazia) {
          table.find("thead tr th").eq(i).hide();
          table.find("tbody tr").each(function() {
            $(this).find("td").eq(i).hide();
          });
          console.log("Coluna " + i + " oculta em " + tableSelector);
        } else {
          console.log("Coluna " + i + " possui dados em " + tableSelector);
        }
      }
    });
  }
  
  function atualizarVisibilidadeColunas(tableSelector) {
    console.log("🔄 Atualizando visibilidade de colunas para:", tableSelector);
    $("#col2 " + tableSelector).each(function() {
      var table = $(this);
      var colCount = table.find("thead tr th").length;
      for (var i = 0; i < colCount; i++) {
        var colunaVazia = true;
        table.find("tbody tr").each(function() {
          // Ignora linhas com mensagens de "Nenhum débito encontrado"
          if ($(this).text().includes("Nenhum débito encontrado")) {
            return true;
          }
          
          var cellText = $(this).find("td").eq(i).text().trim();
          if (cellText !== "" && cellText !== "null" && cellText !== "undefined") {
            colunaVazia = false;
            return false;
          }
        });
        if (colunaVazia) {
          table.find("thead tr th").eq(i).hide();
          table.find("tbody tr").each(function() {
            $(this).find("td").eq(i).hide();
          });
          console.log("Coluna " + i + " oculta em " + tableSelector);
        } else {
          table.find("thead tr th").eq(i).show();
          table.find("tbody tr").each(function() {
            $(this).find("td").eq(i).show();
          });
          console.log("Coluna " + i + " exibida em " + tableSelector);
        }
      }
    });
  }
  
// Função para configurar o comportamento das calculadoras
function setupCalculadoras() {
  console.log('🧮 Configurando comportamento das calculadoras...');
  
  // Esconde inicialmente o corpo das calculadoras colapsadas
  $('.calculadora-card.collapsed .card-body, .calculadora-coeficiente-card.collapsed .card-body, .calculadora-beneficio-card.collapsed .card-body').hide();
  
  // Adiciona comportamento para abrir/fechar as calculadoras
  $('.calculadora-card .card-header, .calculadora-coeficiente-card .card-header, .calculadora-beneficio-card .card-header').on('click', function() {
    const $card = $(this).closest('.card');
    const $cardBody = $card.find('.card-body');
    
    // Toggle do corpo da calculadora
    $cardBody.slideToggle(300);
    
    // Toggle da classe collapsed
    $card.toggleClass('collapsed');
    
    console.log('Calculadora toggled:', $card.attr('id') || 'sem id');
  });
  
  // Força a visibilidade das calculadoras quando fechadas (para garantir que o CSS não as mantenha ocultas)
  $('.card-body').css('display', '');  // Remove qualquer 'display: none' inline
  $('.calculadora-card.collapsed .card-body, .calculadora-coeficiente-card.collapsed .card-body, .calculadora-beneficio-card.collapsed .card-body').hide();
  
  // Configuração do botão de limpar para calculadora de saldo
  $('#limpar_calculadora').on('click', function() {
    // Limpa os campos de entrada
    $('#calc_parcela').val('');
    $('#calc_prazo').val('');
    
    // Reseta os valores exibidos
    $('#calc_saldo_total').text('0.00');
    $('#calc_percentual').text('0');
    $('#calc_desconto').text('0.00');
    $('#calc_saldo_final').text('0.00');
    
    // Esconde a seção de resultados
    $('.resultado-calculo').slideUp();
    
    // Foca no primeiro campo
    $('#calc_parcela').focus();
  });
  
  // Configuração do botão de limpar para calculadora de coeficiente
  $('#limpar_coeficiente').on('click', function() {
    $('#coef_parcela').val('');
    $('#coef_coeficiente').val('');
    $('.resultado-coeficiente').slideUp();
    $('#coef_parcela').focus();
  });
  
  // Configuração do botão de limpar para calculadora de benefício
  $('#limpar_beneficio').on('click', function() {
    $('#beneficio_margemLiq').val('');
    $('.resultado-beneficio').slideUp();
    $('#beneficio_margemLiq').focus();
  });
  
  // Configuração dos botões de calcular
  $('#calcular_saldo').on('click', function() {
    calcularSaldoDevedor();
  });
  
  $('#calcular_coeficiente').on('click', function() {
    calcularCoeficiente();
  });
  
  $('#calcular_beneficio').on('click', function() {
    calcularBeneficio();
  });
}

// Função para calcular saldo devedor
function calcularSaldoDevedor() {
  const parcela = parseFloat($('#calc_parcela').val()) || 0;
  const prazo = parseInt($('#calc_prazo').val()) || 0;
  
  if (parcela <= 0 || prazo <= 0) {
    alert('Por favor, informe valores válidos para parcela e prazo.');
    return;
  }
  
  // Calcula o saldo total
  const saldoTotal = parcela * prazo;
  
  // Define o percentual de desconto (exemplo: 20%)
  const percentualDesconto = 20;
  
  // Calcula o desconto
  const desconto = saldoTotal * (percentualDesconto / 100);
  
  // Calcula o saldo final
  const saldoFinal = saldoTotal - desconto;
  
  // Exibe os resultados
  $('#calc_saldo_total').text(saldoTotal.toFixed(2));
  $('#calc_percentual').text(percentualDesconto);
  $('#calc_desconto').text(desconto.toFixed(2));
  $('#calc_saldo_final').text(saldoFinal.toFixed(2));
  
  // Mostra a seção de resultados
  $('.resultado-calculo').slideDown();
}

// Função para calcular coeficiente
function calcularCoeficiente() {
  const parcela = parseFloat($('#coef_parcela').val()) || 0;
  const coeficiente = parseFloat($('#coef_coeficiente').val()) || 0;
  
  if (parcela <= 0 || coeficiente <= 0) {
    alert('Por favor, informe valores válidos para parcela e coeficiente.');
    return;
  }
  
  // Calcula o valor
  const resultado = parcela / coeficiente;
  
  // Exibe o resultado
  $('#resultado_coeficiente').text('R$ ' + resultado.toFixed(2));
  
  // Mostra a seção de resultados
  $('.resultado-coeficiente').slideDown();
}

// Função para calcular benefício
function calcularBeneficio() {
  const margemLiq = parseFloat($('#beneficio_margemLiq').val()) || 0;
  
  if (margemLiq <= 0) {
    alert('Por favor, informe um valor válido para margem líquida.');
    return;
  }
  
  // Exemplo de cálculos para Cartão Benefício (ajuste conforme necessário)
  const parcelaCartao = margemLiq * 0.95;
  const limiteCartao = parcelaCartao * 7;
  const saqueDisponivel = limiteCartao * 0.70;
  
  // Exibe os resultados
  $('#beneficio_parcela').text(parcelaCartao.toFixed(2));
  $('#beneficio_limite').text(limiteCartao.toFixed(2));
  $('#beneficio_saque').text(saqueDisponivel.toFixed(2));
  
  // Mostra a seção de resultados
  $('.resultado-beneficio').slideDown();
}

/**
 * Exibe uma mensagem quando não há dados de cliente
 */
function mostrarMensagemSemDados() {
  const mensagem = `
    <div class="alert alert-info text-center" role="alert">
      <i class='bx bx-info-circle fs-2 mb-2'></i>
      <h4>Sem dados disponíveis</h4>
      <p>Você não está associado como participante de nenhuma equipe ativa com campanha e cliente.</p>
      <p>É necessário que um administrador adicione você como participante em uma equipe.</p>
      <p class="small text-muted">Relacionamento: User ↔ Equipe (campo: 'participantes', related_name: 'equipes_moneyplus')</p>
    </div>
  `;
  
  // Insere a mensagem no container da ficha
  $('.container-ficha_cliente').html(mensagem);
}

/**
 * Exibe uma mensagem de erro na API
 */
function mostrarMensagemErro(error) {
  const mensagem = `
    <div class="alert alert-danger text-center" role="alert">
      <i class='bx bx-error-circle fs-2 mb-2'></i>
      <h4>Erro ao carregar dados</h4>
      <p>Ocorreu um erro ao tentar carregar os dados do cliente.</p>
      <p class="small text-muted">Detalhes técnicos: ${error}</p>
    </div>
  `;
  
  // Insere a mensagem no container da ficha
  $('.container-ficha_cliente').html(mensagem);
}
  