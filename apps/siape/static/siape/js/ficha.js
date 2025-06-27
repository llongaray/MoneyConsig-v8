function validarFormato(valor) {
    if (valor.includes(',')) {
        alert("Por favor, use ponto (.) ao invés de vírgula (,) para separar a parte decimal.");
        return false;
    }
    return true;
}

function calcularSaldoDevedor(capitalId, parcelasId, saldoId) {
    var capital = parseFloat(document.getElementById(capitalId).value);
    var parcelas = parseInt(document.getElementById(parcelasId).value);

    if (!isNaN(capital) && !isNaN(parcelas)) {
        var valorBruto = capital * parcelas;
        var porcentagem;
        if (parcelas < 10) {
            porcentagem = 0;
        } else if (10 <= parcelas && parcelas <= 39) {
            porcentagem = 0.1;
        } else if (40 <= parcelas && parcelas <= 59) {
            porcentagem = 0.2;
        } else if (60 <= parcelas && parcelas <= 71) {
            porcentagem = 0.25;
        } else if (72 <= parcelas && parcelas <= 83) {
            porcentagem = 0.3;
        } else if (84 <= parcelas && parcelas <= 96) {
            porcentagem = 0.35;
        } else {
            porcentagem = 0;
        }

        var desconto = valorBruto * porcentagem;
        var saldoDevedor = valorBruto - desconto;
        console.log(desconto)
        console.log(saldoDevedor)
        document.getElementById(saldoId).value = 'R$ ' + saldoDevedor.toFixed(2);
    } else {
        alert('Por favor, preencha os campos corretamente.');
    }
}

function limparSaldoDevedor(capitalId, parcelasId, saldoId) {
    document.getElementById(capitalId).value = "";
    document.getElementById(parcelasId).value = "";
    document.getElementById(saldoId).value = "";
}

function calcularMargem(margemId, coeficienteId, valorLiberadoId) {
    var margem = parseFloat(document.getElementById(margemId).value);
    var coeficiente = parseFloat(document.getElementById(coeficienteId).value);
    if (!isNaN(margem) && !isNaN(coeficiente)) {
        var valorLiberado = margem / coeficiente;
        document.getElementById(valorLiberadoId).value = 'R$ ' + valorLiberado.toFixed(2);
    } else {
        alert('Por favor, preencha os campos corretamente.');
    }
}

function calculateNumberOfMonths(q0, p, j) {
    j = j / 100; // Converte taxa de juros para decimal
    let n = Math.log(p / (p - j * q0)) / Math.log(1 + j);
    return Math.ceil(n); // Arredonda para cima
}

function calculateMonthlyInterestRate(q0, p, n, tolerance = 0.000001) {
    let jLow = 0.000001;
    let jHigh = 1000; // Ajuste para suportar taxas de juros maiores
    let jMid = (jLow + jHigh) / 2;

    while ((jHigh - jLow) > tolerance) {
        let calculatedP = (jMid * q0) / (1 - Math.pow(1 + jMid, -n));
        if (calculatedP > p) {
            jHigh = jMid;
        } else {
            jLow = jMid;
        }
        jMid = (jLow + jHigh) / 2;
    }

    return jMid * 100; // Converte de decimal para porcentagem
}

function calculateInstallment(q0, n, j) {
    j = j / 100; // Converte taxa de juros para decimal
    let p = (j * q0) / (1 - Math.pow(1 + j, -n));
    return p;
}

function calculateFinancedAmount(p, n, j) {
    j = j / 100; // Converte taxa de juros para decimal
    let q0 = (1 - Math.pow(1 + j, -n)) / j * p;
    return q0;
}

function calcularBancoCentral(mesesId, taxaJurosId, prestacaoId, financiadoId) {
    let numMeses = document.getElementById(mesesId).value;
    let taxaJuros = document.getElementById(taxaJurosId).value;
    let valorPrestacao = document.getElementById(prestacaoId).value;
    let valorFinanciado = document.getElementById(financiadoId).value;

    if (!validarFormato(numMeses) || !validarFormato(taxaJuros) || !validarFormato(valorPrestacao) || !validarFormato(valorFinanciado)) {
        return;
    }

    try {
        numMeses = numMeses ? parseFloat(numMeses) : null;
        valorPrestacao = valorPrestacao ? parseFloat(valorPrestacao) : null;
        valorFinanciado = valorFinanciado ? parseFloat(valorFinanciado) : null;
        taxaJuros = taxaJuros ? parseFloat(taxaJuros) : null;

        if (numMeses === null) {
            if (taxaJuros === null || valorPrestacao === null || valorFinanciado === null) {
                throw new Error("Por favor, insira a taxa de juros, o valor da prestação e o valor financiado.");
            }
            numMeses = calculateNumberOfMonths(valorFinanciado, valorPrestacao, taxaJuros);
            document.getElementById(mesesId).value = numMeses;
        } else if (taxaJuros === null) {
            if (numMeses === null || valorPrestacao === null || valorFinanciado === null) {
                throw new Error("Por favor, insira o número de meses, o valor da prestação e o valor financiado.");
            }
            taxaJuros = calculateMonthlyInterestRate(valorFinanciado, valorPrestacao, numMeses);
            document.getElementById(taxaJurosId).value = taxaJuros.toFixed(6); // Ajuste para 6 casas decimais
        } else if (valorPrestacao === null) {
            if (numMeses === null || taxaJuros === null || valorFinanciado === null) {
                throw new Error("Por favor, insira o número de meses, a taxa de juros e o valor financiado.");
            }
            valorPrestacao = calculateInstallment(valorFinanciado, numMeses, taxaJuros);
            document.getElementById(prestacaoId).value = 'R$ ' + valorPrestacao.toFixed(2);
        } else if (valorFinanciado === null) {
            if (numMeses === null || taxaJuros === null || valorPrestacao === null) {
                throw new Error("Por favor, insira o número de meses, a taxa de juros e o valor da prestação.");
            }
            valorFinanciado = calculateFinancedAmount(valorPrestacao, numMeses, taxaJuros);
            document.getElementById(financiadoId).value = 'R$ ' + valorFinanciado.toFixed(2);
        } else {
            throw new Error("Por favor, preencha apenas três dos quatro campos para realizar o cálculo.");
        }
    } catch (error) {
        alert(error.message);
    }
}

function limparBancoCentral(mesesId, taxaJurosId, prestacaoId, financiadoId) {
    document.getElementById(mesesId).value = "";
    document.getElementById(taxaJurosId).value = "";
    document.getElementById(prestacaoId).value = "";
    document.getElementById(financiadoId).value = "";
}

function imprimirBancoCentral() {
    window.print();
}
