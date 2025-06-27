console.log("apis_post.js - Conteúdo movido.");

$(document).ready(function(){
    // Função auxiliar para atualizar a tabela de agendamentos
    function atualizarTabelaTodosAgendamentos(){
        console.log("Atualizando tabela de agendamentos...");
        // Limpa o tbody e então chama a função existente para carregar os agendamentos
        var tbody = $("#tabelaTodosAgendamentos tbody");
        tbody.empty();
        carregarTodosAgendamentos();
    }

    // Função auxiliar para formatar data do formato dd/MM/yyyy para yyyy-MM-dd
    function formatDateForApi(dateStr) {
        var parts = dateStr.split('/');
        if(parts.length !== 3) {
            console.log("Formato de data inesperado:", dateStr);
            return dateStr;
        }
        var formatted = parts[2] + '-' + parts[1] + '-' + parts[0];
        console.log("Data formatada:", formatted);
        return formatted;
    }
    
    // Submissão do formulário de agendamento
    $("#formAgendamento").on("submit", function(e){
        e.preventDefault(); // Impede o envio padrão

        // Converte os dados do formulário para um objeto JSON
        var formDataArray = $(this).serializeArray();
        var formData = {};
        $.each(formDataArray, function(index, field){
            formData[field.name] = field.value;
        });

        var url = '/inss/api/post/agendamento/';
        console.log("Enviando requisição POST para:", url);
        console.log("Dados do formulário:", formData);

        $.ajax({
            url: url,
            type: 'POST',
            data: JSON.stringify(formData),
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': $("input[name='csrfmiddlewaretoken']").val()
            },
            success: function(response){
                console.log("Resposta da API (agendamento):", response);
                alert("Agendamento realizado com sucesso!");
                $('#formAgendamento')[0].reset();
                atualizarTabelaTodosAgendamentos();
            },
            error: function(xhr, status, error) {
                console.error("Erro na requisição (agendamento):", error);
                var mensagem = (xhr.responseJSON && xhr.responseJSON.texto) ? xhr.responseJSON.texto : "Ocorreu um erro no agendamento.";
                alert("Erro: " + mensagem);
            }
        });
    });

    // Submissão do formulário de tabulação de vendas (submodal de edição)
    $("#formEdicaoCliente").on("submit", function(e){
        e.preventDefault(); // Impede o envio padrão

        // Serializa os dados do formulário para um objeto
        var formDataArray = $(this).serializeArray();
        var dataObj = {};
        $.each(formDataArray, function(index, field){
            dataObj[field.name] = field.value;
        });

        // Se o campo 'dia_agendado' existir, formata a data
        if(dataObj['dia_agendado']) {
            dataObj['dia_agendado'] = formatDateForApi(dataObj['dia_agendado']);
        }

        var jsonData = JSON.stringify(dataObj);
        console.log("Enviando dados para a API de tabulação:", jsonData);
        
        $.ajax({
            url: '/inss/api/post/vendatabulacao/',
            type: 'POST',
            data: jsonData,
            contentType: 'application/json',
            headers: {
                'X-CSRFToken': $("input[name='csrfmiddlewaretoken']").val()
            },
            success: function(response){
                console.log("Resposta da API (tabulação):", response);
                alert("Tabulação de vendas atualizada com sucesso!");
                fecharModal('#modalEdicaoCliente');
                atualizarTabelaTodosAgendamentos();
            },
            error: function(xhr, status, error){
                console.error("Erro ao enviar formulário (tabulação):", error);
                var mensagem = (xhr.responseJSON && xhr.responseJSON.texto) ? xhr.responseJSON.texto : "Erro ao enviar formulário.";
                alert("Erro: " + mensagem);
            }
        });
    });
});


function atualizarTac($input) {
    var agendamentoId = $input.data("agendamento-id");
    // Remove o prefixo "R$" e converte para número
    var valorTac = $input.val().replace("R$", "").trim();
    console.log("Atualizando TAC para agendamento ID:", agendamentoId, "Valor:", valorTac);
    
    var data = {
         agendamento_id: agendamentoId,
         tac: valorTac  // Envia o novo valor de TAC
    };
    
    console.log("Dados enviados para API post tac:", JSON.stringify(data));
    
    $.ajax({
         url: '/inss/api/post/tac/',
         type: 'POST',
         data: JSON.stringify(data),
         contentType: 'application/json',
         headers: {
             'X-CSRFToken': $("input[name='csrfmiddlewaretoken']").val()
         },
         success: function(response) {
             console.log("Resposta da API post tac:", response);
             alert("Valor TAC atualizado com sucesso!");
             // Atualiza a tabela de agendamentos TAC
             if (typeof window.carregarAgendamentosTAC === 'function') {
                window.carregarAgendamentosTAC();
             }
         },
         error: function(xhr, status, error) {
             console.error("Erro ao atualizar TAC:", error);
             alert("Erro ao atualizar valor TAC.");
         }
    });
}


function atualizarStatus($select) {
    var agendamentoId = $select.data("agendamento-id");
    var novoStatus = $select.val();
    console.log("Atualizando status TAC para agendamento ID:", agendamentoId, "Novo status:", novoStatus);
    
    var data = {
        agendamento_id: agendamentoId,
        status: novoStatus
    };
    console.log("Dados enviados para API post statustac:", JSON.stringify(data));
    
    $.ajax({
         url: '/inss/api/post/statustac/',
         type: 'POST',
         data: JSON.stringify(data),
         contentType: 'application/json',
         headers: {
             'X-CSRFToken': $("input[name='csrfmiddlewaretoken']").val()
         },
         success: function(response) {
             console.log("Resposta da API post statustac:", response);
             alert("Status TAC atualizado com sucesso!");
             if (typeof window.carregarAgendamentosTAC === 'function') {
                window.carregarAgendamentosTAC();
             }
         },
         error: function(xhr, status, error) {
             console.error("Erro ao atualizar status TAC:", error);
             console.log("Resposta completa:", xhr.responseText);
             var mensagem = (xhr.responseJSON && xhr.responseJSON.texto) ? xhr.responseJSON.texto : "Erro ao atualizar status TAC.";
             alert("Erro: " + mensagem);
         }
    });
}

$(document).ready(function(){
    $("#formConfirmacaoAgendamento").submit(function(e){
        e.preventDefault();

        // Captura os valores dos campos do formulário
        var agendamento_id = $("#idAgendamentoConfirmacao").val();
        var nome_cliente = $("#nomeClienteConfirmacao").val();
        var dia_agendado = $("#diaAgendadoConfirmacao").val();
        var numero_cliente = $("#numeroClienteConfirmacao").val();
        var loja_agendada = $("#lojaAgendadaConfirmacao").val();
        var tabulacao_atendente = $("#tabulacaoAtendente").val();
        var nova_dia_agendado = $("#novaDiaAgendado").val();
        var observacao = $("#observacao").val();

        // Cria o objeto de dados a ser enviado via API POST
        var dataObj = {
            agendamento_id: agendamento_id,
            nome_cliente: nome_cliente,
            dia_agendado: dia_agendado,
            numero_cliente: numero_cliente,
            loja_agendada: loja_agendada,
            tabulacao_atendente: tabulacao_atendente
        };

        // Se a tabulação for "REAGENDADO", adiciona a nova data (se fornecida)
        if(tabulacao_atendente === "REAGENDADO" && nova_dia_agendado){
            dataObj.nova_dia_agendado = nova_dia_agendado;
        }

        // Se a tabulação for "DESISTIU", adiciona a observação
        if(tabulacao_atendente === "DESISTIU"){
            dataObj.observacao = observacao;
        }

        console.log("Enviando os dados via API POST:", dataObj);

        // Envia os dados em formato JSON para a API de confirmação
        $.ajax({
            url: "/inss/api/post/confirmagem/",
            type: "POST",
            data: JSON.stringify(dataObj),
            contentType: "application/json",
            headers: {
                'X-CSRFToken': $("input[name='csrfmiddlewaretoken']").val()
            },
            dataType: "json",
            success: function(response) {
                console.log("Resposta da API:", response);
                alert(response.texto || "Agendamento atualizado com sucesso!");
                // Fecha o modal de confirmação
                fecharModal("#modalConfirmacaoAgendamento");
                // Chama a função GET para atualizar a lista de agendamentos a confirmar
                if (typeof window.carregarAgendamentosConfirmados === 'function') {
                    window.carregarAgendamentosConfirmados();
                    console.error("Função carregarAgendamentosConfirmados carregada....");
                } else {
                    console.error("Função carregarAgendamentosConfirmados não encontrada.");
                }
            },
            error: function(xhr, status, error) {
                console.error("Erro ao atualizar o agendamento:", error);
                var mensagem = (xhr.responseJSON && xhr.responseJSON.texto) ? xhr.responseJSON.texto : "Erro ao atualizar o agendamento.";
                alert("Erro: " + mensagem);
            }
        });
    });
});
