console.log('MODAL-SPECIFIC INSS EM EXECUÇÃO!!');

$(document).ready(function() {
    // Função para filtrar a tabela de Clientes Em Loja
    function filtrarTabelaClientesEmLoja() {
        console.log("Iniciando filtro da tabela de Clientes Em Loja");
        
        var nome = $("#filtroNomeClientesEmLoja").val().toLowerCase();
        var loja = $("#filtroLojaClientesEmLoja").val().toLowerCase();
        var data = $("#filtroDataClientesEmLoja").val();
        var atendente = $("#filtroAtendenteClientesEmLoja").val().toLowerCase();

        console.log("Valores dos filtros:", {
            nome: nome,
            loja: loja, 
            data: data,
            atendente: atendente
        });

        $("#tabelaClientesEmLoja tbody tr").each(function() {
            var row = $(this);
            var nomeCliente = row.find("td:nth-child(1)").text().toLowerCase();
            var lojaTexto = row.find("td:nth-child(2)").text().toLowerCase();
            var dataAgendada = row.find("td:nth-child(3)").text();
            var atendenteTexto = row.find("td:nth-child(4)").text().toLowerCase();

            console.log("Valores da linha atual:", {
                nomeCliente: nomeCliente,
                lojaTexto: lojaTexto,
                dataAgendada: dataAgendada,
                atendenteTexto: atendenteTexto
            });

            var matchNome = nomeCliente.includes(nome);
            var matchLoja = lojaTexto.includes(loja);
            var matchData = !data || (dataAgendada && dataAgendada.includes(data));
            var matchAtendente = atendenteTexto.includes(atendente);

            console.log("Resultados dos matches:", {
                matchNome: matchNome,
                matchLoja: matchLoja,
                matchData: matchData,
                matchAtendente: matchAtendente
            });

            if (matchNome && matchLoja && matchData && matchAtendente) {
                row.show();
                console.log("Linha exibida:", nomeCliente);
            } else {
                row.hide();
                console.log("Linha ocultada:", nomeCliente);
            }
        });

        // Mostrar mensagem quando não houver resultados
        var temResultados = $("#tabelaClientesEmLoja tbody tr:visible").length > 0;
        var mensagemSemResultados = $("#tabelaClientesEmLoja tbody tr.sem-resultados");
        
        console.log("Total de resultados visíveis:", $("#tabelaClientesEmLoja tbody tr:visible").length);

        if (!temResultados) {
            console.log("Nenhum resultado encontrado, exibindo mensagem");
            if (mensagemSemResultados.length === 0) {
                $("#tabelaClientesEmLoja tbody").append(
                    '<tr class="sem-resultados"><td colspan="5" class="text-center">Nenhum cliente encontrado</td></tr>'
                );
                console.log("Mensagem 'Nenhum cliente encontrado' adicionada");
            } else {
                mensagemSemResultados.show();
                console.log("Mensagem 'Nenhum cliente encontrado' exibida");
            }
        } else {
            mensagemSemResultados.remove();
            console.log("Mensagem 'Nenhum cliente encontrado' removida");
        }
    }

    // Event listeners para os campos de filtro
    $("#filtroNomeClientesEmLoja, #filtroLojaClientesEmLoja, #filtroAtendenteClientesEmLoja")
        .on("keyup change", filtrarTabelaClientesEmLoja);
    $("#filtroDataClientesEmLoja").on("change", filtrarTabelaClientesEmLoja);

    // Limpar filtros ao fechar o modal
    $("#modalClientesEmLoja").on("hidden.bs.modal", function() {
        console.log("Modal fechado, limpando filtros");
        $("#filtroNomeClientesEmLoja, #filtroLojaClientesEmLoja, #filtroDataClientesEmLoja, #filtroAtendenteClientesEmLoja")
            .val("");
        filtrarTabelaClientesEmLoja();
    });
});

// USO INSS: Gerencia mudança de tabulação
function handleTabulacaoChange() {
    const modal = document.getElementById('modalConfirmacaoAgendamento');
    const tabulacaoSelect = modal.querySelector('#tabulacaoAtendente');
    const selectedValue = tabulacaoSelect.value;
    
    console.log('Select dropdown:', tabulacaoSelect); 
    console.log('Valor selecionado no dropdown:', selectedValue);
    
    const novaDataContainer = modal.querySelector('#novaDataContainer');
    const observacaoContainer = modal.querySelector('#observacaoContainer');
    
    novaDataContainer.style.display = 'none';
    observacaoContainer.style.display = 'none';
    
    if (selectedValue === 'REAGENDADO') {
        console.log('Campo REAGENDADO selecionado, mostrando campo de nova data.');
        novaDataContainer.style.display = 'block';
    } else if (selectedValue === 'DESISTIU') {
        console.log('Campo DESISTIU selecionado, mostrando campo de observao.');
        observacaoContainer.style.display = 'block';
    } else {
        console.log('Nenhum campo específico foi selecionado.');
    }
}

// USO INSS: Gerencia mudança de tabulação do vendedor
function handleTabulacaoVendedorChange() {
    const modal = document.getElementById('modalEdicaoCliente');
    const tabulacaoSelect = modal.querySelector('#tabulacaoVendedor');
    const selectedValue = tabulacaoSelect.value;
    
    const observacaoContainer = modal.querySelector('#observacaoVendedorContainer');
    const fechouNegocioContainer = modal.querySelector('#fechouNegocioContainer');
    
    observacaoContainer.style.display = 'none';
    fechouNegocioContainer.style.display = 'none';
    
    if (selectedValue === 'FECHOU NEGOCIO') {
        observacaoContainer.style.display = 'block';
        fechouNegocioContainer.style.display = 'block';
    } else if (selectedValue && selectedValue !== '') {
        observacaoContainer.style.display = 'block';
    }
}

// USO INSS: Atualiza status do TAC
function atualizarStatusTAC(selectElement, agendamentoId) {
    const novoStatus = selectElement.value;
    if (!novoStatus) return;

    const row = $(selectElement).closest('tr');
    const statusCell = row.find('.status-tac');

    $.ajax({
        url: '/inss/atualizar_status_tac/',
        method: 'POST',
        data: {
            agendamento_id: agendamentoId,
            status: novoStatus,
            csrfmiddlewaretoken: $('[name=csrfmiddlewaretoken]').val()
        },
        success: function(response) {
            if (response.success) {
                statusCell.text(novoStatus);
                
                mostrarMensagem('Status atualizado com sucesso!', 'success');
                
                if (novoStatus === 'PAGO') {
                    row.addClass('tac-pago');
                } else {
                    row.removeClass('tac-pago');
                }
            } else {
                mostrarMensagem('Erro ao atualizar status: ' + response.error, 'error');
                $(selectElement).val(statusCell.text());
            }
        },
        error: function() {
            mostrarMensagem('Erro ao comunicar com o servidor', 'error');
            $(selectElement).val(statusCell.text());
        }
    });
}

function handleTabulacaoVendedorRua() {
    const tabulacao = document.getElementById('tabulacao_vendedor').value;
    const fechouNegocioContainer = document.getElementById('fechouNegocioRuaContainer');
    const observacaoContainer = document.getElementById('observacaoVendedorRuaContainer');

    if (tabulacao === 'FECHOU NEGOCIO') {
        fechouNegocioContainer.style.display = 'block';
        observacaoContainer.style.display = 'block';
    } else {
        fechouNegocioContainer.style.display = 'none';
        observacaoContainer.style.display = 'block';
    }
}