from django.db import models
from django.contrib.auth.models import User

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey


PRODUCT_CHOICES = (
    ('INSS', 'INSS'),
    ('SIAPE', 'SIAPE'),
    ('FGTS', 'FGTS'),
)

class DBCliente(models.Model):
    # Identificação do Produto
    produto = models.CharField(max_length=10, choices=PRODUCT_CHOICES)
    
    # Dados Pessoais (comuns)
    nome_completo = models.CharField(max_length=255)
    cpf = models.CharField(max_length=14)
    
    # INSS e FGTS
    data_nasc = models.DateField(blank=True, null=True)
    idade = models.PositiveIntegerField(blank=True, null=True)
    
    # INSS específico
    rg = models.CharField(max_length=50, blank=True, null=True)
    cidade = models.CharField(max_length=100, blank=True, null=True)
    uf = models.CharField(max_length=2, blank=True, null=True)  # Pode ser usado em INSS e SIAPE
    cep = models.CharField(max_length=10, blank=True, null=True)
    
    # SIAPE específico
    rjur = models.CharField(max_length=50, blank=True, null=True)
    
    # Situação (para INSS e SIAPE)
    situacao_funcional = models.CharField(max_length=50, blank=True, null=True)
    liberacao_emprestimo = models.BooleanField(default=False)
    qtd_emprestimos = models.PositiveIntegerField(blank=True, null=True)
    
    # Situação adicional para SIAPE
    total_credito = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_debitos = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    total_liquido = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    margem_disponivel_geral = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Informações Complementares (comuns)
    celular_1 = models.CharField(max_length=20, blank=True, null=True)
    flg_wts_1 = models.BooleanField(default=False)
    celular_2 = models.CharField(max_length=20, blank=True, null=True)
    flg_wts_2 = models.BooleanField(default=False)
    celular_3 = models.CharField(max_length=20, blank=True, null=True)
    flg_wts_3 = models.BooleanField(default=False)
    
    # Desconto Associação (INSS)
    flg_desconto = models.BooleanField(default=False)
    taxa_associativa = models.CharField(max_length=50, blank=True, null=True)
    parcela = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)

        
    # Cartões para INSS
    rmc_saldo = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    rcc_saldo = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Cartões para SIAPE
    rmc_bruta = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    rmc_util = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    rcc_bruta = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    rcc_util = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Margem 35% para SIAPE (renomeado para evitar dígitos iniciais)
    trinta_cinco_bruta = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    trinta_cinco_util = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    trinta_cinco_saldo = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # FGTS específico
    situacao = models.CharField(max_length=50, blank=True, null=True)  # Situação do FGTS
    cnpj_empresa = models.CharField(max_length=20, blank=True, null=True)
    razao_social = models.CharField(max_length=255, blank=True, null=True)
    tempo_de_contribuicao = models.CharField(max_length=50, blank=True, null=True)
    
    # PIS
    salario = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    saldo_aproximado = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Novo campo: campanha
    # Permite inativar clientes e seus débitos se a campanha estiver inativa (status=False)
    campanha = models.ForeignKey(
        'DBCampanha',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="clientes"
    )
    
    def __str__(self):
        return f"{self.nome_completo} - {self.produto}"


class Equipe(models.Model):
    nome = models.CharField(max_length=255)
    participantes = models.ManyToManyField(User, blank=True, related_name='equipes_moneyplus')
    status = models.BooleanField(default=True)
    
    def __str__(self):
        return self.nome


class DBCampanha(models.Model):
    nome = models.CharField(max_length=255)
    data_criacao = models.DateTimeField(auto_now_add=True)
    descricao = models.TextField(blank=True, null=True)
    status = models.BooleanField(default=True)
    equipes = models.ManyToManyField(Equipe, blank=True, related_name='campanhas')
    
    def __str__(self):
        return self.nome



class DBDebito(models.Model):
    DEBITO_PRODUTO_CHOICES = (
        ('INSS', 'INSS'),
        ('SIAPE', 'SIAPE'),
    )
    
    cliente = models.ForeignKey(DBCliente, on_delete=models.CASCADE, related_name='debitos')
    produto = models.CharField(max_length=10, choices=DEBITO_PRODUTO_CHOICES)
    
    # Campos comuns
    matricula = models.CharField(max_length=50, blank=True, null=True)
    cod_banco = models.CharField(max_length=20, blank=True, null=True)
    valor_parcela = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    campanha = models.ForeignKey(
        DBCampanha,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='debitos'
    )
    
    # Campos exclusivos para INSS
    tipo_emprestimo = models.CharField(max_length=150, blank=True, null=True)
    taxa = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    # Removido o campo parcelas_pagas (já que é equivalente a parcelas)
    parcelas = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    restantes = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    
    # Campos exclusivos para SIAPE
    cod_contrato = models.CharField(max_length=50, blank=True, null=True)
    prazo = models.PositiveIntegerField(blank=True, null=True)
    
    def __str__(self):
        return f"Débito {self.produto} de {self.cliente.nome_completo}"

class FGTSCliente(models.Model):
    cpf = models.CharField("CPF", max_length=14, unique=True)
    nome = models.CharField("Nome", max_length=255)
    data_nascimento = models.DateField(null=True, blank=True)
    idade = models.PositiveIntegerField("Idade")
    tipo = models.CharField("Tipo", max_length=10)
    
    # Associação à campanha
    campanha = models.ForeignKey(
        DBCampanha,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fgts_clientes'
    )
    
    logradouro = models.CharField("Logradouro", max_length=255)
    numero = models.CharField("Número", max_length=20, blank=True, null=True)
    complemento = models.CharField("Complemento", max_length=100, blank=True, null=True)
    bairro = models.CharField("Bairro", max_length=100)
    cidade = models.CharField("Cidade", max_length=100)
    uf = models.CharField("UF", max_length=2)
    cep = models.CharField("CEP", max_length=10)
    
    salario = models.DecimalField("Salário", max_digits=12, decimal_places=2)
    saldo_aproximado = models.DecimalField("Saldo Aproximado", max_digits=12, decimal_places=2)
    data_admissao = models.DateField("Data de Admissão")
    razao_social = models.CharField("Razão Social", max_length=255)
    tempo_contribuicao = models.CharField("Tempo de Contribuição", max_length=50, blank=True, null=True)
    
    demografica = models.CharField("Demográfica", max_length=100, blank=True, null=True)
    possivel_profissao = models.CharField("Possível Profissão", max_length=150, blank=True, null=True)
    score = models.PositiveIntegerField("Score", blank=True, null=True)
    
    flag_fgts = models.BooleanField("Flag FGTS", default=False)
    
    cel1 = models.CharField("Celular 1", max_length=20, blank=True, null=True)
    procon_cel1 = models.BooleanField("Procon Celular 1", default=False)
    fl_whatsapp_cel1 = models.BooleanField("WhatsApp Celular 1", default=False)
    
    cel2 = models.CharField("Celular 2", max_length=20, blank=True, null=True)
    procon_cel2 = models.BooleanField("Procon Celular 2", default=False)
    fl_whatsapp_cel2 = models.BooleanField("WhatsApp Celular 2", default=False)
    
    email1 = models.EmailField("Email", blank=True, null=True)
    
    class Meta:
        verbose_name = "FGTS Cliente"
        verbose_name_plural = "FGTS Clientes"
        ordering = ['nome']
    
    def __str__(self):
        return f"{self.nome} ({self.cpf})"

class ControleClientesCampanha(models.Model):
    STATUS_ENTREGUE = 'ENTREGUE'
    STATUS_AGENDADO = 'AGENDADO'
    STATUS_EM_NEGOCIACAO = 'EM_NEGOCIACAO'
    STATUS_NAO_QUIS = 'NAO_QUIS'
    STATUS_INELEGIVEL = 'INELEGIVEL'
    STATUS_SOLICITACAO_BLOQUEIO = 'SOLICITACAO_BLOQUEIO'

    STATUS_CHOICES = [
        (STATUS_ENTREGUE, 'Entregue'),
        (STATUS_AGENDADO, 'Agendado'),
        (STATUS_EM_NEGOCIACAO, 'Em Negociação'),
        (STATUS_NAO_QUIS, 'Não quis'),
        (STATUS_INELEGIVEL, 'Inelegível'),
        (STATUS_SOLICITACAO_BLOQUEIO, 'Solicitação de Bloqueio'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='controle_clientes_campanha'
    )
    campanha = models.ForeignKey(
        'DBCampanha',
        on_delete=models.CASCADE,
        related_name='controle_clientes'
    )
    db_cliente = models.ForeignKey(
        'DBCliente',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='controle_campanhas_db'
    )
    fgts_cliente = models.ForeignKey(
        'FGTSCliente',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='controle_campanhas_fgts'
    )
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default=STATUS_ENTREGUE
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = (
            ('campanha', 'db_cliente'),
            ('campanha', 'fgts_cliente'),
        )

    @property
    def cliente(self):
        return self.db_cliente or self.fgts_cliente

    def __str__(self):
        nome = None
        if self.db_cliente:
            nome = self.db_cliente.nome_completo
        elif self.fgts_cliente:
            nome = self.fgts_cliente.nome
        return f"{nome} ({self.campanha.nome}) → {self.get_status_display()}"

class AgendamentoCliente(models.Model):
    STATUS_EM_ESPERA = 'EM_ESPERA'
    STATUS_REALIZADO = 'REALIZADO'

    STATUS_CHOICES = [
        (STATUS_EM_ESPERA, 'Em Espera'),\
        (STATUS_REALIZADO, 'Realizado'),
    ]

    db_cliente = models.ForeignKey(
        'DBCliente',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='agendamentos_db'
    )
    fgts_cliente = models.ForeignKey(
        'FGTSCliente',
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name='agendamentos_fgts'
    )
    campanha = models.ForeignKey(
        'DBCampanha',
        on_delete=models.CASCADE,
        related_name='agendamentos'
    )
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp de quando o agendamento foi criado"
    )
    dia_agendamento = models.DateField(
        help_text="Data agendada (YYYY‑MM‑DD)"
    )
    hora = models.TimeField(
        help_text="Hora agendada (HH:MM)"
    )
    responsavel = models.CharField(
        max_length=255,
        help_text="Nome do responsável pelo agendamento"
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_EM_ESPERA,
        help_text="Status do agendamento (se já foi realizado ou não)"
    )

    class Meta:
        verbose_name = "Agendamento de Cliente"
        verbose_name_plural = "Agendamentos de Clientes"
        ordering = ['-dia_agendamento', 'hora']

    @property
    def cliente(self):
        return self.db_cliente or self.fgts_cliente

    def __str__(self):
        nome = None
        if self.db_cliente:
            nome = self.db_cliente.nome_completo
        elif self.fgts_cliente:
            nome = self.fgts_cliente.nome
        return (
            f"{nome} agendado para {self.dia_agendamento} às {self.hora} "
            f"por {self.responsavel} [{self.get_status_display()}]"
        )