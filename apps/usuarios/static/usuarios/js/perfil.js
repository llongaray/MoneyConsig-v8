$(document).ready(function () {
    console.log("🚀 Carregando dados do perfil do funcionário...");

    const apiPerfilGet = "/autenticacao/api/perfil/get/";

    function carregarPerfilFuncionario() {
        $.getJSON(apiPerfilGet, function (data) {
            if (data.error) {
                console.error("❌ Erro ao carregar perfil: ", data.error);
                return;
            }

            console.log("✅ Dados do funcionário carregados: ", data);

            const funcionario = data.funcionario;
            const dashboard = data.dashboard;

            // Atualiza os dados do funcionário
            $("#nome-funcionario").text(funcionario.nome);
            $("#data-nascimento").text(funcionario.data_nascimento || "Não informado");
            $("#genero").text(funcionario.genero || "Não informado");
            $("#empresa").text(funcionario.empresa || "Não informado");
            $("#departamento").text(funcionario.departamento || "Não informado");
            $("#cargo").text(funcionario.cargo || "Não informado");

            if (funcionario.loja) {
                $("#loja").text(funcionario.loja).parent().show();
            } else {
                $("#loja").parent().hide();
            }

            if (funcionario.foto) {
                $("#foto-perfil").attr("src", funcionario.foto);
            }

            // Define se é SIAPE ou INSS
            const setor = funcionario.departamento || "DESCONHECIDO";

            if (setor.toUpperCase() === "SIAPE") {
                $(".dashboard-cards").html(`
                    <div class="card">
                        <h3>Faturamento Total</h3>
                        <p id="faturamento-total">R$ ${dashboard.faturamento_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div class="card">
                        <h3>Faturamento Mensal</h3>
                        <p id="faturamento-mensal">R$ ${dashboard.faturamento_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div class="card">
                        <h3>Posição no Ranking</h3>
                        <p id="ranking-posicao">#${dashboard.ranking_posicao} no Setor</p>
                    </div>
                `);
            } else if (setor.toUpperCase() === "INSS") {
                $(".dashboard-cards").html(`
                    <div class="card">
                        <h3>Em Loja Totais</h3>
                        <p id="em-loja-total">${dashboard.faturamento_total}</p>
                    </div>
                    <div class="card">
                        <h3>Em Loja Mensal</h3>
                        <p id="em-loja-mensal">${dashboard.faturamento_mensal}</p>
                    </div>
                    <div class="card">
                        <h3>Posição no Ranking</h3>
                        <h4>Mensal</h4>
                        <p id="ranking-posicao">#${dashboard.ranking_posicao} no Setor</p>
                    </div>
                `);
            } else {
                console.warn("⚠️ Setor do funcionário desconhecido. Exibindo valores padrão.");
                $(".dashboard-cards").html(`
                    <div class="card">
                        <h3>Faturamento Total</h3>
                        <p id="faturamento-total">N/A</p>
                    </div>
                    <div class="card">
                        <h3>Faturamento Mensal</h3>
                        <p id="faturamento-mensal">N/A</p>
                    </div>
                    <div class="card">
                        <h3>Posição no Ranking</h3>
                        <p id="ranking-posicao">N/A</p>
                    </div>
                `);
            }
        })
        .fail(function (xhr) {
            console.error("❌ Erro ao carregar os dados do perfil:", xhr);
        });
    }

    carregarPerfilFuncionario();
});
