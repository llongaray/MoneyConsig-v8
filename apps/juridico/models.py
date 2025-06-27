from django.db import models
from django.conf import settings
from django.utils import timezone


def _upload_to_arquivo_acoes(instance, filename):
    return f"acoes_inss/{instance.acao_inss.id}/arquivos/{filename}"


def _upload_to_documento_acoes(instance, filename):
    return f"acoes_inss/{instance.acao_inss.id}/documentos/{filename}"


def _upload_to_arquivo_processo(instance, filename):
    return f"processos/{instance.processo.id}/arquivos/{filename}"


class ClienteAcao(models.Model):
    nome = models.CharField(max_length=255, verbose_name='Nome Completo')
    cpf = models.CharField(max_length=14, unique=True, db_index=True, verbose_name='CPF') 
    contato = models.CharField(max_length=100, blank=True, null=True, verbose_name='Contato')
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name='Data de Criação')
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name='Data de Atualização')

    class Meta:
        verbose_name = 'Cliente da Ação'
        verbose_name_plural = 'Clientes das Ações'
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} ({self.cpf})"


class Acoes(models.Model):
    class StatusChoices(models.TextChoices):
        EM_ESPERA = 'EM_ESPERA', 'Em Espera'
        INCOMPLETO = 'INCOMPLETO', 'Incompleto'
        EM_DESPACHO = 'EM_DESPACHO', 'Em Despacho'
        PROTOCOLADO = 'PROTOCOLADO', 'Protocolado'
        FINALIZADO = 'FINALIZADO', 'Finalizado'

    class TipoAcaoChoices(models.TextChoices):
        ASSOCIACAO = 'ASSOCIACAO', 'Associação'
        CARTAO = 'CARTAO', 'Cartão'
        DEBITO_CONTA = 'DEBITO_CONTA', 'Débito em Conta'
        LIMPA_NOME = 'LIMPANOME', 'Limpanome'
        REVISIONAL = 'REVISIONAL', 'Revisional'

    class SentencaChoices(models.TextChoices):
        FAVORAVEL = 'FAVORAVEL', 'Favorável'
        NAO_FAVORAVEL = 'NAO_FAVORAVEL', 'Não Favorável'
        PENDENTE = 'PENDENTE', 'Pendente'

    class GrauSentencaChoices(models.TextChoices):
        PRIMEIRO_GRAU = 'PRIMEIRO_GRAU', 'Primeiro Grau'
        SEGUNDO_GRAU = 'SEGUNDO_GRAU', 'Segundo Grau'

    class RecursoChoices(models.TextChoices):
        NENHUM = 'NENHUM', 'Nenhum'
        APELACAO = 'APELACAO', 'Apelação'
        AGRAVO = 'AGRAVO', 'Agravo'
        EMBARGOS = 'EMBARGOS', 'Embargos'
        NOMINADO = 'NOMINADO', 'Nominado'

    cliente = models.ForeignKey(ClienteAcao, on_delete=models.CASCADE, verbose_name='Cliente')
    tipo_acao = models.CharField(max_length=50, choices=TipoAcaoChoices.choices, verbose_name='Tipo de Ação')
    status_emcaminhamento = models.CharField(max_length=50, choices=StatusChoices.choices, default=StatusChoices.EM_ESPERA, verbose_name='Status em Caminhamento')
    data_criacao = models.DateTimeField(default=timezone.now, verbose_name='Data de Criação')
    data_atualizacao = models.DateTimeField(default=timezone.now, verbose_name='Data de Atualização')
    data_cancelamento = models.DateTimeField(null=True, blank=True, verbose_name='Data de Cancelamento')
    motivo_cancelamento = models.TextField(null=True, blank=True, verbose_name='Motivo do Cancelamento')
    numero_protocolo = models.CharField(max_length=50, null=True, blank=True, verbose_name='Número do Protocolo')
    motivo_incompleto = models.TextField(null=True, blank=True, verbose_name='Motivo da Incompletude')
    status = models.BooleanField(default=True, verbose_name='Status Ativo')
    motivo_inatividade = models.TextField(null=True, blank=True, verbose_name='Motivo da Inatividade')
    vendedor_responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='acoes_vendedor', verbose_name='Vendedor Responsável')
    loja = models.ForeignKey('funcionarios.Loja', on_delete=models.SET_NULL, null=True, blank=True, related_name='acoes_loja', verbose_name='Loja')
    advogado_responsavel = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='acoes_advogado', verbose_name='Advogado Responsável')
    senha_inss = models.CharField(max_length=100, null=True, blank=True, verbose_name='Senha INSS')

    # Campos relacionados à sentença
    sentenca = models.CharField(max_length=20, choices=SentencaChoices.choices, null=True, blank=True, verbose_name='Sentença')
    grau_sentenca = models.CharField(max_length=20, choices=GrauSentencaChoices.choices, null=True, blank=True, verbose_name='Grau da Sentença')
    valor_sentenca = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='Valor da Sentença')
    data_sentenca = models.DateField(null=True, blank=True, verbose_name='Data da Sentença')
    
    # Campos relacionados aos recursos
    recurso_primeiro_grau = models.CharField(max_length=20, choices=RecursoChoices.choices, default=RecursoChoices.NENHUM, null=True, blank=True, verbose_name='Recurso 1º Grau')
    data_recurso_primeiro_grau = models.DateField(null=True, blank=True, verbose_name='Data do Recurso 1º Grau')
    resultado_recurso_primeiro_grau = models.CharField(max_length=20, choices=SentencaChoices.choices, null=True, blank=True, verbose_name='Resultado do Recurso 1º Grau')
    
    recurso_segundo_grau = models.CharField(max_length=20, choices=RecursoChoices.choices, default=RecursoChoices.NENHUM, null=True, blank=True, verbose_name='Recurso 2º Grau')
    data_recurso_segundo_grau = models.DateField(null=True, blank=True, verbose_name='Data do Recurso 2º Grau')
    resultado_recurso_segundo_grau = models.CharField(max_length=20, choices=SentencaChoices.choices, null=True, blank=True, verbose_name='Resultado do Recurso 2º Grau')

    def __str__(self):
        return f"{self.get_tipo_acao_display()} - {self.cliente.nome}"

    class Meta:
        verbose_name = 'Ação'
        verbose_name_plural = 'Ações'
        ordering = ['-data_criacao']


class RegistroPagamentos(models.Model):
    class StatusPagamentoChoices(models.TextChoices):
        EM_ANDAMENTO = 'EM_ANDAMENTO', 'Em Andamento'
        QUITADO      = 'QUITADO', 'Quitado'
        CANCELADO    = 'CANCELADO', 'Cancelado'

    class TipoPagamentoChoices(models.TextChoices):
        A_VISTA = 'A_VISTA', 'À Vista'
        PARCELADO = 'PARCELADO', 'Parcelado'
        ENTRADA_PARCELAS = 'ENTRADA_PARCELAS', 'Entrada + Parcelas'

    acao_inss            = models.ForeignKey(
        Acoes,
        on_delete=models.CASCADE,
        related_name='registros_pagamento',
        verbose_name='Ação INSS',
        db_index=True
    )
    tipo_pagamento       = models.CharField(
        max_length=20,
        choices=TipoPagamentoChoices.choices,
        default=TipoPagamentoChoices.A_VISTA,
        verbose_name='Tipo de Pagamento',
        help_text='Forma de pagamento escolhida'
    )
    valor_total          = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00,
        verbose_name='Valor Total'
    )
    valor_entrada        = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name='Valor de Entrada'
    )
    parcelas_totais      = models.IntegerField(
        default=0,
        verbose_name='Total de Parcelas',
        help_text='Número total de parcelas do pagamento'
    )
    parcelas_pagas       = models.IntegerField(
        default=0,
        verbose_name='Parcelas Pagas'
    )
    parcelas_restantes   = models.IntegerField(
        default=0,
        verbose_name='Parcelas Restantes'
    )
    status               = models.CharField(
        max_length=20,
        choices=StatusPagamentoChoices.choices,
        default=StatusPagamentoChoices.EM_ANDAMENTO,
        verbose_name='Status do Pagamento',
        db_index=True
    )
    data_criacao         = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data de Criação'
    )
    data_atualizacao     = models.DateTimeField(
        auto_now=True,
        verbose_name='Data de Atualização'
    )

    class Meta:
        verbose_name        = 'Registro de Pagamento'
        verbose_name_plural = 'Registros de Pagamento'
        ordering            = ['-data_criacao']

    def __str__(self):
        return f"Pagamento #{self.id} - {self.acao_inss} - {self.get_status_display()}"


class RegistroPagamentosFeitos(models.Model):
    class TipoAcordoChoices(models.TextChoices):
        NENHUM = 'NENHUM', 'Nenhum'
        DESCONTO = 'DESCONTO', 'Desconto no Valor'
        PARCELAMENTO = 'PARCELAMENTO', 'Novo Parcelamento'
        QUITACAO = 'QUITACAO', 'Quitação com Desconto'

    registro_pagamento   = models.ForeignKey(
        RegistroPagamentos,
        on_delete=models.CASCADE,
        related_name='pagamentos_feitos',
        verbose_name='Registro de Pagamento',
        db_index=True
    )
    valor_pago          = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name='Valor Pago'
    )
    parcela_paga        = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Número da Parcela',
        help_text='Número da parcela paga (opcional para pagamentos à vista)'
    )
    flg_atrasado        = models.BooleanField(
        default=False,
        verbose_name='Pagamento Atrasado'
    )
    flg_acordo          = models.BooleanField(
        default=False,
        verbose_name='Pagamento com Acordo'
    )
    tipo_acordo         = models.CharField(
        max_length=20,
        choices=TipoAcordoChoices.choices,
        default=TipoAcordoChoices.NENHUM,
        verbose_name='Tipo de Acordo'
    )
    juros_atrasado_mensal = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        verbose_name='Juros por Atraso Mensal (%)',
        help_text='Percentual de juros aplicado por atraso mensal (0-100)'
    )
    data_pagamento      = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data do Pagamento'
    )
    observacao          = models.TextField(
        blank=True,
        null=True,
        verbose_name='Observação',
        help_text='Observações sobre o pagamento ou acordo'
    )

    class Meta:
        verbose_name        = 'Registro de Pagamento Feito'
        verbose_name_plural = 'Registros de Pagamentos Feitos'
        ordering            = ['-data_pagamento']

    def __str__(self):
        return f"Pagamento #{self.id} - {self.registro_pagamento} - R$ {self.valor_pago}"

    def save(self, *args, **kwargs):
        # Atualiza o registro de pagamento principal
        if self.parcela_paga:
            self.registro_pagamento.parcelas_pagas += 1
            self.registro_pagamento.parcelas_restantes -= 1
            
            # Se não houver mais parcelas restantes, marca como quitado
            if self.registro_pagamento.parcelas_restantes <= 0:
                self.registro_pagamento.status = RegistroPagamentos.StatusPagamentoChoices.QUITADO
            
            self.registro_pagamento.save()
        
        super().save(*args, **kwargs)


class ArquivosAcoesINSS(models.Model):
    acao_inss      = models.ForeignKey(
        Acoes,
        on_delete=models.CASCADE,
        related_name='arquivos',
        verbose_name='Ação INSS',
        db_index=True
    )
    titulo         = models.CharField(
        max_length=255,
        default='',
        verbose_name='Título do Arquivo'
    )
    data_import    = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data de Importação',
        db_index=True
    )
    file           = models.FileField(
        upload_to=_upload_to_arquivo_acoes,
        verbose_name='Arquivo'
    )

    class Meta:
        verbose_name        = 'Arquivo de Ação INSS'
        verbose_name_plural = 'Arquivos de Ações INSS'
        ordering            = ['-data_import']

    def __str__(self):
        return f"{self.titulo} (Ação #{self.acao_inss.id})"


class DocsAcaoINSS(models.Model):
    acao_inss      = models.ForeignKey(
        Acoes,
        on_delete=models.CASCADE,
        related_name='documentos',
        verbose_name='Ação INSS',
        db_index=True
    )
    titulo         = models.CharField(
        max_length=255,
        default='',
        verbose_name='Título do Documento'
    )
    data_import    = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data de Importação',
        db_index=True
    )
    file           = models.FileField(
        upload_to=_upload_to_documento_acoes,
        verbose_name='Documento'
    )

    class Meta:
        verbose_name        = 'Documento de Ação INSS'
        verbose_name_plural = 'Documentos de Ações INSS'
        ordering            = ['-data_import']

    def __str__(self):
        return f"{self.titulo} (Ação #{self.acao_inss.id})"


class Processo(models.Model):
    class StatusChoices(models.TextChoices):
        ATIVO = 'ATIVO', 'Ativo'
        INATIVO = 'INATIVO', 'Inativo'
        FINALIZADO = 'FINALIZADO', 'Finalizado'
        ARQUIVADO = 'ARQUIVADO', 'Arquivado'

    acao = models.ForeignKey(
        Acoes,
        on_delete=models.CASCADE,
        related_name='processos',
        verbose_name='Ação',
        db_index=True
    )
    titulo = models.CharField(
        max_length=255,
        verbose_name='Título do Processo'
    )
    numero_processo = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name='Número do Processo',
        help_text='Número do processo em decorrimento judicial'
    )
    data_inicio = models.DateField(
        verbose_name='Data de Início'
    )
    data_final = models.DateField(
        null=True,
        blank=True,
        verbose_name='Data Final'
    )
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data de Criação'
    )
    resultado = models.TextField(
        null=True,
        blank=True,
        verbose_name='Resultado'
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ATIVO,
        verbose_name='Status'
    )

    class Meta:
        verbose_name = 'Processo'
        verbose_name_plural = 'Processos'
        ordering = ['-data_criacao']

    def __str__(self):
        return f"{self.titulo} - {self.acao}"


class ArquivosProcesso(models.Model):
    class StatusChoices(models.TextChoices):
        ATIVO = 'ATIVO', 'Ativo'
        INATIVO = 'INATIVO', 'Inativo'

    processo = models.ForeignKey(
        Processo,
        on_delete=models.CASCADE,
        related_name='arquivos',
        verbose_name='Processo',
        db_index=True
    )
    titulo = models.CharField(
        max_length=255,
        verbose_name='Título do Arquivo'
    )
    arquivo = models.FileField(
        upload_to=_upload_to_arquivo_processo,
        verbose_name='Arquivo'
    )
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name='Data de Criação'
    )
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.ATIVO,
        verbose_name='Status'
    )

    class Meta:
        verbose_name = 'Arquivo de Processo'
        verbose_name_plural = 'Arquivos de Processos'
        ordering = ['-data_criacao']

    def __str__(self):
        return f"{self.titulo} - {self.processo.titulo}"
