// modelosTemplates.js

/**
 * Retorna o cabeçalho do CSV para o produto informado.
 * @param {string} product - "SIAPE", "INSS" ou "FGTS"
 * @returns {string} Cabeçalho do CSV com os campos separados por ponto e vírgula.
 */
function getCsvTemplate(product) {
    console.log(">>> getCsvTemplate() chamado com product:", product);
  
    if (product === "SIAPE") {
      console.log(">>> Gerando template CSV para SIAPE.");
      // Campos SIAPE:
      // Informações pessoais: nome_completo, cpf, data_nasc, idade, rjur;
      // Dados complementares: celular_1, flg_wts_1, celular_2, flg_wts_2, celular_3, flg_wts_3;
      // Situação Financeira: situacao_funcional, margem_disponivel_geral;
      // Margens Cartões: saldo5_bruta, saldo5_util, saldo5_saldo, benf_bruta, benf_util, benf_saldo;
      // Margem 35%: trinta_cinco_bruta, trinta_cinco_util, trinta_cinco_saldo;
      // Empréstimos: matricula, banco, orgao, upag, valor_parcela, prazo;
      var template = 
        "nome_completo;cpf;data_nasc;idade;rjur;" +
        "celular_1;flg_wts_1;celular_2;flg_wts_2;celular_3;flg_wts_3;" +
        "situacao_funcional;margem_disponivel_geral;" +
        "saldo5_bruta;saldo5_util;saldo5_saldo;benf_bruta;benf_util;benf_saldo;" +
        "trinta_cinco_bruta;trinta_cinco_util;trinta_cinco_saldo;" +
        "matricula;banco;orgao;upag;valor_parcela;prazo";
      console.log(">>> Template SIAPE gerado:", template);
      return template;
  
    } else if (product === "INSS") {
      console.log(">>> Gerando template CSV para INSS.");
      // Campos INSS:
      // Informações pessoais: nome_completo, cpf, data_nasc, idade, rg, nome_mae, qtd_emprestimos, possui_representante;
      // Endereços: cep, uf, cidade, bairro, endereco;
      // Dados complementares: celular_1, flg_wts_1, celular_2, flg_wts_2, celular_3, flg_wts_3;
      // Situação Financeira: liberacao_emprestimo;
      // Desconto Associação: desconto, taxa_associativa, valor_parcela_associacao;
      // Benefícios: matricula, codigo_especie, meio_pagamento, banco, agencia, conta, valor_beneficio;
      // Margens Cartões: rmc_saldo, rcc_saldo;
      // Empréstimos: cod_banco, contrato, tipo_emprestimo, valor_parcela, prazo, taxa, parcelas_restantes;
      var template = 
        "nome_completo;cpf;data_nasc;idade;rg;nome_mae;qtd_emprestimos;possui_representante;" +
        "cep;uf;cidade;bairro;endereco;" +
        "celular_1;flg_wts_1;celular_2;flg_wts_2;celular_3;flg_wts_3;" +
        "liberacao_emprestimo;" +
        "desconto;taxa_associativa;valor_parcela_associacao;" +
        "matricula;codigo_especie;meio_pagamento;banco;agencia;conta;valor_beneficio;" +
        "rmc_saldo;rcc_saldo;" +
        "cod_banco;contrato;tipo_emprestimo;valor_parcela;prazo;taxa;parcelas_restantes";
      console.log(">>> Template INSS gerado:", template);
      return template;
  
    } else if (product === "FGTS") {
      console.log(">>> Gerando template CSV para FGTS.");
      // Campos FGTS:
      // CPF;Nome;Data_de_Nascimento;IDADE;TIPO;
      // Endereço: LOGRADOURO, NUMERO, COMPLEMENTO, BAIRRO, CIDADE, UF, CEP;
      // Financeiro: Salario, Saldo_Aproximado;
      // Profissional: Data_de_Admissao, Razao_Social, Tempo_de_Contribuicao, DEMOGRAFICA, POSSIVEL_PROFISSAO, SCORE;
      // Flag e Contato: FLAG_FGTS, CEL1, PROCONCEL1, FLWHATSAPPCEL1, CEL2, PROCONCEL2, FLWHATSAPPCEL2, EMAIL1;
      var template = 
        "CPF;Nome;Data_de_Nascimento;IDADE;TIPO;" +
        "LOGRADOURO;NUMERO;COMPLEMENTO;BAIRRO;CIDADE;UF;CEP;" +
        "Salario;Saldo_Aproximado;" +
        "Data_de_Admissao;Razao_Social;Tempo_de_Contribuicao;DEMOGRAFICA;POSSIVEL_PROFISSAO;SCORE;" +
        "FLAG_FGTS;" +
        "CEL1;PROCONCEL1;FLWHATSAPPCEL1;" +
        "CEL2;PROCONCEL2;FLWHATSAPPCEL2;EMAIL1";
      console.log(">>> Template FGTS gerado:", template);
      return template;
  
    } else {
      console.warn(">>> getCsvTemplate(): Produto não reconhecido para CSV:", product);
      return "";
    }
  }
  
  /**
   * Cria e inicia o download do arquivo CSV com o cabeçalho definido para o produto.
   * @param {string} product - "SIAPE", "INSS" ou "FGTS"
   */
  function downloadCsvTemplate(product) {
    console.log(">>> downloadCsvTemplate() chamado com product:", product);
    var csvContent = getCsvTemplate(product);
    if (!csvContent) {
      alert("Produto inválido para gerar modelo CSV.");
      return;
    }
  
    var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    var url  = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = product === "SIAPE"
      ? "modelo_siape.csv"
      : product === "INSS"
        ? "modelo_inss.csv"
        : "modelo_fgts.csv";
  
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  /**
   * Atualiza a visibilidade dos botões de download de CSV conforme o produto selecionado.
   */
  function updateTemplateButtons() {
    // Pega, normaliza e loga o valor selecionado
    var product = $("#select-produto").val() || "";
    product = product.trim().toUpperCase();
    console.log(">>> updateTemplateButtons() chamado. Produto selecionado:", product);
  
    // 1) Esconde todos
    $("#btn-download-siape, #btn-download-inss, #btn-download-fgts").hide();
  
    // 2) Exibe só o botão certo
    switch (product) {
      case "SIAPE":
        console.log(">>> Produto SIAPE detectado. Exibindo botão SIAPE.");
        $("#btn-download-siape").show();
        break;
  
      case "INSS":
        console.log(">>> Produto INSS detectado. Exibindo botão INSS.");
        $("#btn-download-inss").show();
        break;
  
      case "FGTS":
        console.log(">>> Produto FGTS detectado. Exibindo botão FGTS.");
        $("#btn-download-fgts").show();
        break;
  
      default:
        console.log(">>> Produto não reconhecido. Ocultando todos os botões.");
    }
  }
  
  
  
  $(document).ready(function() {
    console.log(">>> Documento pronto. Iniciando atualização de botões de CSV.");
    updateTemplateButtons();
  
    // Atualiza os botões quando o select de produto mudar
    $(document).on("change", "#select-produto", updateTemplateButtons);
  
    // Associa o clique de cada botão ao download correspondente
    $("#btn-download-siape").on("click", function() { downloadCsvTemplate("SIAPE"); });
    $("#btn-download-inss").on("click", function() { downloadCsvTemplate("INSS"); });
    $("#btn-download-fgts").on("click", function() { downloadCsvTemplate("FGTS"); });
  });
  