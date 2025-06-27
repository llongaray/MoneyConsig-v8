from django.db import models
from django.contrib.auth.models import User
from apps.funcionarios.models import Loja # Importa Loja do app funcionarios
from django.utils import timezone

# Modelo para dados do cliente que será agendado
class ClienteAgendamento(models.Model):
    nome_completo = models.CharField(max_length=255, verbose_name="Nome Completo")
    cpf = models.CharField(max_length=14, unique=True, verbose_name="CPF") # Considerar validação/máscara
    numero = models.CharField(max_length=20, verbose_name="Número de Contato") # Celular/Telefone
    flg_whatsapp = models.BooleanField(default=True, verbose_name="Possui WhatsApp")
    status = models.BooleanField(default=True, verbose_name="Ativo")

    def __str__(self):
        return f"{self.nome_completo} ({self.cpf})"

    class Meta:
        verbose_name = "Cliente para Agendamento"
        verbose_name_plural = "Clientes para Agendamento"
        ordering = ['nome_completo']

# Modelo para o agendamento em si
class Agendamento(models.Model):
    class StatusAtendimentoChoices(models.TextChoices):
        EM_ATENDIMENTO = 'EM_ATENDIMENTO', 'EM ATENDIMENTO'
        FINALIZADO = 'FINALIZADO', 'FINALIZADO'
        AGUARDANDO = 'AGUARDANDO', 'AGUARDANDO'
    
    cliente_agendamento = models.ForeignKey(
        ClienteAgendamento, 
        on_delete=models.CASCADE, # Se excluir o cliente, exclui o agendamento
        related_name='agendamentos',
        verbose_name="Cliente"
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    dia_agendado = models.DateTimeField(verbose_name="Data e Hora Agendada")
    loja = models.ForeignKey(
        Loja, 
        on_delete=models.PROTECT, # Protege contra exclusão da Loja se houver agendamentos
        related_name='agendamentos_loja',
        verbose_name="Loja Agendada"
    )
    atendente_agendou = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='inss_agendamentos_criados', 
        verbose_name="Atendente que Agendou"
    )
    tabulacao_agendamento = models.TextField(blank=True, null=True, verbose_name="Tabulação do Agendamento")
    status_atendimento = models.CharField(
        max_length=20, 
        choices=StatusAtendimentoChoices.choices,
        default=StatusAtendimentoChoices.AGUARDANDO,
        verbose_name="Status do Atendimento"
    )

    def __str__(self):
        return f"Agendamento de {self.cliente_agendamento.nome_completo} para {self.dia_agendado.strftime('%d/%m/%Y %H:%M')} na loja {self.loja.nome}"

    class Meta:
        verbose_name = "Agendamento"
        verbose_name_plural = "Agendamentos"
        ordering = ['-dia_agendado']

class PresencaLoja(models.Model):

    class TabulacaoVendaChoices(models.TextChoices):
        NEGOCIO_FECHADO = 'NEGOCIO_FECHADO', 'NEGÓCIO FECHADO'
        INELEGIVEL      = 'INELEGIVEL',      'INELEGÍVEL'
        NAO_ACEITOU     = 'NAO_ACEITOU',     'NÃO ACEITOU'
        NAO_QUIS_OUVIR  = 'NAO_QUIS_OUVIR',  'NÃO QUIS OUVIR'
        PENDENTE        = 'PENDENTE',        'PENDENTE'

    class StatusPagamentoChoices(models.TextChoices):
        EM_ESPERA = 'EM_ESPERA', 'EM ESPERA'
        NAO_PAGO  = 'NAO_PAGO',  'NÃO PAGO'
        PAGO      = 'PAGO',      'PAGO'

    agendamento = models.ForeignKey(
        'inss.Agendamento',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='presencas',
        verbose_name="Agendamento Associado"
    )
    cliente_agendamento = models.ForeignKey(
        'inss.ClienteAgendamento',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='presencas',
        verbose_name="Cliente (Rua / Sem Agendamento)"
    )
    loja_comp = models.ForeignKey(
        'funcionarios.Loja',
        on_delete=models.PROTECT,
        related_name='presencas_loja',
        verbose_name="Loja de Comparecimento"
    )
    vendedor = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='vendas_realizadas',
        verbose_name="Vendedor"
    )
    tabulacao_venda = models.CharField(
        max_length=20,
        choices=TabulacaoVendaChoices.choices,
        blank=True, null=True,
        verbose_name="Tabulação da Venda"
    )

    # Campos adicionais para NEGÓCIO FECHADO
    tipo_negociacao = models.CharField(max_length=100, blank=True, null=True, verbose_name="Tipo de Negociação")
    banco           = models.CharField(max_length=100, blank=True, null=True, verbose_name="Banco")
    subsidio        = models.BooleanField(default=False, verbose_name="Subsídio")
    valor_tac       = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Valor TAC")
    acao            = models.BooleanField(default=False, verbose_name="Com Ação Judicial")
    associacao      = models.BooleanField(default=False, verbose_name="Com Associação")
    aumento         = models.BooleanField(default=False, verbose_name="Com Aumento de Margem")

    status_pagamento = models.CharField(
        max_length=20,
        choices=StatusPagamentoChoices.choices,
        default=StatusPagamentoChoices.EM_ESPERA,
        verbose_name="Status Pagamento TAC"
    )
    data_pagamento   = models.DateTimeField(null=True, blank=True, verbose_name="Data Pagamento TAC")

    cliente_rua      = models.BooleanField(default=False, verbose_name="Cliente Veio Direto da Rua")
    data_presenca    = models.DateTimeField(default=timezone.now, verbose_name="Data/Hora da Presença/Registro")

    def __str__(self):
        cliente = (
            self.agendamento.cliente_agendamento.nome_completo
            if self.agendamento and self.agendamento.cliente_agendamento
            else self.cliente_agendamento.nome_completo
            if self.cliente_agendamento else "Desconhecido"
        )
        loja = self.loja_comp.nome if self.loja_comp else "Loja não especificada"
        hora = self.data_presenca.strftime('%d/%m/%Y %H:%M')
        return f"Presença de {cliente} em {hora} na loja {loja}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if not (self.agendamento or self.cliente_agendamento):
            raise ValidationError('Associe um Agendamento ou um Cliente (rua).')
        if self.agendamento and self.cliente_rua:
            raise ValidationError('Não marque "Cliente Veio Direto da Rua" se houver agendamento.')
        if not self.loja_comp:
            raise ValidationError('A loja de comparecimento é obrigatória.')

    def save(self, *args, **kwargs):
        # Ajustes automáticos
        if self.agendamento:
            self.cliente_rua = False
            if not self.loja_comp and self.agendamento.loja:
                self.loja_comp = self.agendamento.loja
        elif self.cliente_agendamento:
            self.cliente_rua = True

        if self.status_pagamento == self.StatusPagamentoChoices.PAGO and not self.data_pagamento:
            self.data_pagamento = timezone.now()
        elif self.status_pagamento != self.StatusPagamentoChoices.PAGO:
            self.data_pagamento = None

        self.full_clean()
        super().save(*args, **kwargs)

    class Meta:
        verbose_name        = "Presença/Resultado em Loja"
        verbose_name_plural = "Presenças/Resultados em Loja"
        ordering            = ['-data_presenca']