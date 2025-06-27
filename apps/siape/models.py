from django.db import models
from decimal import Decimal
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.utils import timezone
from django.contrib.auth.models import User
from apps.funcionarios.models import Funcionario, Loja, Departamento, Equipe, Setor

class Campanha(models.Model):
    nome = models.CharField(max_length=100, verbose_name="Nome da Campanha", blank=True, null=True)
    data_criacao = models.DateTimeField(default=timezone.now, verbose_name="Data de Criação", blank=True, null=True)
    setor = models.ForeignKey(
        Setor,
        on_delete=models.SET_NULL, # Usar SET_NULL para não deletar a campanha se o setor for excluído, ou PROTECT/CASCADE conforme regra
        related_name='campanhas_siape',
        verbose_name="Setor",
        blank=True,
        null=True
    )
    status = models.BooleanField(default=True, verbose_name="Status", blank=True, null=True)  # True para Ativo, False para Inativo

    def __str__(self):
        return f"{self.nome} - {self.setor.nome if self.setor else 'Sem Setor'} - {'Ativo' if self.status else 'Inativo'}"

class Cliente(models.Model):
    # Informações Pessoais
    nome = models.CharField(max_length=100, verbose_name="Nome", blank=True, null=True, db_index=True)
    cpf = models.CharField(
        max_length=11,
        unique=True,
        validators=[RegexValidator(r'^\d{11}$')],
        verbose_name="CPF",
        blank=True,
        null=True,
        db_index=True  # Adiciona índice no CPF para consultas mais rápidas
    )
    uf = models.CharField(max_length=2, verbose_name="UF", blank=True, null=True, db_index=True)
    rjur = models.CharField(max_length=50, verbose_name="RJur", blank=True, null=True)
    situacao_funcional = models.CharField(max_length=50, verbose_name="Situação Funcional", blank=True, null=True, db_index=True)

    # Dados Financeiros
    renda_bruta = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Renda Bruta")
    bruta_5 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Bruta 5")
    util_5 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Utilizado 5")
    saldo_5 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Saldo 5")
    brutaBeneficio_5 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Bruta Benefício 5")
    utilBeneficio_5 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Utilizado Benefício 5")
    saldoBeneficio_5 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Saldo Benefício 5")
    bruta_35 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Bruta 35")
    util_35 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Utilizado 35")
    saldo_35 = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Saldo 35")
    total_util = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Total Utilizado")
    total_saldo = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Total Saldo")

    class Meta:
        indexes = [
            models.Index(fields=['cpf']),
            models.Index(fields=['nome']),
            models.Index(fields=['uf', 'situacao_funcional']),
        ]

    def __str__(self):
        return f"{self.nome} - {self.cpf}"


class Debito(models.Model):
    # Relacionamento com o Cliente e com a Campanha
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='debitos', db_index=True)
    campanha = models.ForeignKey('Campanha', on_delete=models.CASCADE, related_name='debitos', db_index=True)
    
    # Campos do Débito (SIAPE)
    matricula = models.CharField(max_length=50, verbose_name="Matrícula", blank=True, null=True, db_index=True)
    banco = models.CharField(max_length=100, verbose_name="Banco", blank=True, null=True)
    orgao = models.CharField(max_length=50, verbose_name="Órgão", blank=True, null=True)
    rebrica = models.CharField(max_length=50, verbose_name="Rebrica", blank=True, null=True)
    parcela = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Parcela")
    prazo_restante = models.PositiveIntegerField(blank=True, null=True, verbose_name="Prazo Restante")
    tipo_contrato = models.CharField(max_length=50, verbose_name="Tipo de Contrato", blank=True, null=True)
    num_contrato = models.CharField(max_length=50, verbose_name="Número do Contrato", blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['cliente', 'campanha']),
            models.Index(fields=['matricula', 'parcela', 'prazo_restante']),
        ]

    def __str__(self):
        return f"{self.matricula} - {self.num_contrato or 'Sem Contrato'}"

class Produto(models.Model):
    """
    Modelo para representar os produtos oferecidos.
    """
    nome = models.CharField(max_length=100, verbose_name="Nome do Produto", unique=True)
    descricao = models.TextField(blank=True, null=True, verbose_name="Descrição")
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = "Produto"
        verbose_name_plural = "Produtos"
        ordering = ['nome']


class RegisterMoney(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="Usuário")
    # Alterado on_delete para SET_NULL para preservar registros se a loja for excluída
    loja = models.ForeignKey(Loja, on_delete=models.SET_NULL, blank=True, null=True, verbose_name="Loja")
    cpf_cliente = models.CharField(max_length=14, blank=True, null=True, db_index=True) # Adicionado db_index
    produto = models.ForeignKey(
        Produto,
        on_delete=models.SET_NULL, # Mantém SET_NULL
        null=True,
        blank=True,
        verbose_name="Produto"
    )
    valor_est = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True, verbose_name="Valor Estimado/Registrado")
    status = models.BooleanField(default=True, blank=True, null=True, verbose_name="Status (Ativo)") # Considerar choices se houver mais status
    data = models.DateTimeField(default=timezone.now, blank=True, null=True, verbose_name="Data do Registro", db_index=True) # Adicionado db_index

    # Novos campos de associação organizacional
    empresa = models.ForeignKey(
        'funcionarios.Empresa', # Usando string para evitar import direto se preferir
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Empresa Associada",
        related_name='registros_financeiros'
    )
    departamento = models.ForeignKey(
        Departamento,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Departamento Associado",
        related_name='registros_financeiros'
    )
    setor = models.ForeignKey(
        Setor,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Setor Associado",
        related_name='registros_financeiros'
    )
    equipe = models.ForeignKey(
        Equipe,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Equipe Associada",
        related_name='registros_financeiros'
    )

    def __str__(self):
        display_name = f"User ID {self.user_id}" # Default
        try:
            # Tenta buscar o Funcionario associado ao User de forma otimizada
            # Evita import local repetido e usa select_related se possível (embora aqui seja get)
            # Nota: A lógica original com import local dentro do método é funcional, mas menos ideal.
            # Idealmente, a relação User -> Funcionario seria mais direta ou gerenciada de outra forma.
            funcionario = Funcionario.objects.select_related('usuario').get(usuario=self.user)
            # Usa apelido se existir, senão o primeiro nome
            display_name = funcionario.apelido or funcionario.nome_completo.split()[0]
        except Funcionario.DoesNotExist:
            # Se não encontrar Funcionario, usa o username do User (se user ainda existir)
            if self.user:
                display_name = self.user.username
        except Exception:
            # Fallback genérico para outros erros inesperados
            # Logar o erro seria bom em produção: logger.exception("Erro ao buscar funcionário em RegisterMoney.__str__")
            pass # Mantém o default "User ID X"

        valor_str = f"{self.valor_est:.2f}" if self.valor_est is not None else "N/A"
        produto_str = self.produto.nome if self.produto else "Sem Produto"

        # Adiciona informações organizacionais se disponíveis
        org_info = []
        if self.loja: org_info.append(f"Loja: {self.loja.nome}")
        if self.setor: org_info.append(f"Setor: {self.setor.nome}")
        if self.equipe: org_info.append(f"Equipe: {self.equipe.nome}")

        org_str = " | ".join(org_info) if org_info else "Sem Info Org."

        return f'{display_name} - {self.cpf_cliente or "Sem CPF"} - {produto_str} - R$ {valor_str} ({org_str})'

    class Meta:
        verbose_name = "Registro Financeiro"
        verbose_name_plural = "Registros Financeiros"
        ordering = ['-data']
        indexes = [
            models.Index(fields=['cpf_cliente']),
            models.Index(fields=['data']),
            models.Index(fields=['user']),
            models.Index(fields=['loja']),
            models.Index(fields=['empresa']),
            models.Index(fields=['departamento']),
            models.Index(fields=['setor']),
            models.Index(fields=['equipe']),
        ]

class RegisterMeta(models.Model):
    CATEGORIA_CHOICES = [
        ('GERAL', 'Geral - Todas as equipes'),
        ('EMPRESA', 'Empresa'),
        ('FRANQUIA', 'Franquia'),
        ('LOJAS', 'Lojas'),
        ('SETOR', 'Setor'),
        ('OUTROS', 'Outros')
    ]
    
    titulo = models.TextField(max_length=100, default="Ranking Geral", blank=True, null=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    categoria = models.CharField(max_length=10, choices=CATEGORIA_CHOICES, default='GERAL', blank=True, null=True)
    equipe = models.ManyToManyField(Equipe, blank=True, help_text="Selecione uma ou mais equipes quando a categoria for 'Outros'")
    setor = models.ForeignKey(Setor, on_delete=models.SET_NULL, blank=True, null=True, help_text="Selecione o setor quando a categoria for 'Setor'")
    data_inicio = models.DateTimeField(blank=True, null=True, help_text="Data e hora de início (meia-noite AM)")
    data_fim = models.DateTimeField(blank=True, null=True, help_text="Data e hora de término (meia-noite PM)")
    status = models.BooleanField(default=False, blank=True, null=True, help_text="Ativo ou Inativo")
    data_criacao = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.categoria == 'GERAL':
            return f'Meta Geral: {self.valor:.2f}'
        elif self.categoria == 'OUTROS':
            equipes = ', '.join([equipe.nome for equipe in self.equipe.all()])
            return f'Meta {equipes}: {self.valor:.2f}'
        elif self.categoria == 'SETOR':
            return f'Meta Setor {self.setor.nome if self.setor else "N/A"}: {self.valor:.2f}'
        return f'Meta {self.categoria}: {self.valor:.2f}'


class AgendamentoFichaCliente(models.Model):
    STATUS_CHOICES = [
        ('AGENDADO', 'Agendado'),
        ('CONFIRMADO', 'Confirmado'),
        ('FECHOU', 'Fechou negócio'),
        ('NAO_QUIS', 'Não quis')
    ]
    
    ORIGEM_TELEFONE_CHOICES = [
        ('AGENDAMENTO', 'Adicionado pelo Agendamento'),
        ('OUTROS', 'Adicionado por Outros Lugares'),
    ]

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='agendamentos')
    usuario = models.ForeignKey('auth.User', on_delete=models.CASCADE, verbose_name="Usuário", related_name='agendamentos_criados')
    data = models.DateField(verbose_name="Data")
    hora = models.TimeField(verbose_name="Hora")
    observacao = models.TextField(verbose_name="Observação", blank=True, null=True)
    telefone_contato = models.CharField(
        max_length=15,
        verbose_name="Telefone de Contato",
        blank=True,
        null=True,
        help_text="Telefone do cliente para contato relacionado ao agendamento"
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='AGENDADO',
        verbose_name="Status do Agendamento"
    )

    class Meta:
        verbose_name = "Agendamento"
        verbose_name_plural = "Agendamentos"
        ordering = ['-data', '-hora']

    def __str__(self):
        return f"Agendamento - {self.cliente.nome} - {self.data} {self.hora}"


class Reembolso(models.Model):
    """
    Registra a ocorrência e a data de reembolso para um registro financeiro.
    Este modelo simplificado apenas marca se um RegisterMoney foi reembolsado.
    """
    # Relação um-para-um: Cada RegisterMoney pode ter no máximo um registro de reembolso.
    registermoney = models.OneToOneField(
        'RegisterMoney',
        on_delete=models.PROTECT,  # Impede a exclusão de RegisterMoney se houver reembolso associado
        related_name='reembolso_info', # Nome do relacionamento reverso
        verbose_name="Registro Financeiro",
        help_text="O registro financeiro que foi reembolsado.",
        primary_key=True, # Torna a chave estrangeira a chave primária da tabela Reembolso
    )
    data_reembolso = models.DateField(
        verbose_name="Data do Reembolso",
        help_text="Data em que o reembolso foi efetivado."
        # Considerar adicionar default=timezone.now se apropriado ao criar
    )
    # O status booleano confirma que o reembolso ocorreu.
    # Se a simples existência do registro já implica reembolso, este campo pode
    # ser redundante, mas foi explicitamente solicitado.
    status = models.BooleanField(
        default=True,
        verbose_name="Status do Reembolso",
        help_text="True se o reembolso foi efetivado, False caso contrário."
    )
    
    # Campo de observações (opcional)
    observacoes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observações",
        help_text="Observações sobre o reembolso, motivos, etc."
    )

    class Meta:
        verbose_name = "Registro de Reembolso"
        verbose_name_plural = "Registros de Reembolso"
        # Ordena pela data de reembolso mais recente por padrão
        ordering = ['-data_reembolso']

    def __str__(self):
        status_texto = "Efetivado" if self.status else "Pendente"
        return f"Reembolso {status_texto} - {self.registermoney} em {self.data_reembolso}"


class TabulacaoAgendamento(models.Model):
    """
    Modelo para armazenar as tabulações dos agendamentos
    """
    STATUS_CHOICES = [
        ('SEM_RESPOSTA', 'Sem Resposta'),
        ('EM_NEGOCIACAO', 'Em Negociação'),
        ('REVERSAO', 'Reversão'),
        ('REVERTIDO', 'Revertido'),
        ('DESISTIU', 'Desistiu'),
        ('CHECAGEM', 'Checagem'),
        ('CHECAGEM_OK', 'Checagem OK'),
        ('ALTO_RISCO', 'Alto Risco'),
        ('CONCLUIDO_PG', 'Concluído PG'),
    ]
    
    agendamento = models.OneToOneField(
        AgendamentoFichaCliente,
        on_delete=models.CASCADE,
        related_name='tabulacao',
        verbose_name="Agendamento"
    )
    status = models.CharField(
        max_length=25,
        choices=STATUS_CHOICES,
        default='EM_NEGOCIACAO',
        verbose_name="Status da Tabulação"
    )
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de Criação"
    )
    data_atualizacao = models.DateTimeField(
        auto_now=True,
        verbose_name="Data de Atualização"
    )
    usuario_responsavel = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tabulacoes_agendamentos',
        verbose_name="Usuário Responsável"
    )
    observacoes = models.TextField(
        blank=True,
        null=True,
        max_length=2000,
        verbose_name="Observações",
        help_text="Máximo de 2000 caracteres"
    )

    class Meta:
        verbose_name = "Tabulação do Agendamento"
        verbose_name_plural = "Tabulações dos Agendamentos"
        ordering = ['-data_atualizacao']
        indexes = [
            models.Index(fields=['agendamento']),
            models.Index(fields=['status']),
            models.Index(fields=['data_atualizacao']),
        ]

    def __str__(self):
        return f"{self.agendamento.cliente.nome} - {self.get_status_display()}"

    def pode_ser_editada_por_consultor(self):
        """
        Verifica se o consultor pode editar esta tabulação
        Regras:
        - Consultor pode editar se estiver em: SEM_RESPOSTA, EM_NEGOCIACAO, REVERTIDO, CHECAGEM_OK
        - Consultor NÃO pode editar se: foi tabulado por coordenador/supervisor ou está em status restrito
        """
        # Status que consultor pode editar
        status_editaveis_consultor = ['SEM_RESPOSTA', 'EM_NEGOCIACAO', 'REVERTIDO', 'CHECAGEM_OK']
        
        # Se não está em status editável, não pode editar
        if self.status not in status_editaveis_consultor:
            return False
            
        # Se foi tabulado por coordenador/supervisor, consultor não pode editar
        if self.usuario_responsavel:
            try:
                from apps.funcionarios.models import Funcionario
                funcionario = Funcionario.objects.get(usuario=self.usuario_responsavel)
                # Se hierarquia <= 3 (coordenador ou superior), consultor não pode editar
                if funcionario.cargo and funcionario.cargo.hierarquia <= 3:
                    return False
            except:
                pass
                
        return True
    
    def get_status_choices_para_consultor(self):
        """
        Retorna as opções de status disponíveis para consultores baseado no histórico
        """
        # Status básicos que consultor sempre pode usar
        choices_basicas = [
            ('SEM_RESPOSTA', 'Sem Resposta'),
            ('EM_NEGOCIACAO', 'Em Negociação'),
            ('CONCLUIDO_PG', 'Concluído PG'),
        ]
        
        # Verifica histórico para determinar se pode usar REVERSAO e CHECAGEM
        historico = HistoricoTabulacaoAgendamento.objects.filter(
            agendamento=self.agendamento
        ).order_by('data_alteracao')
        
        passou_por_reversao = historico.filter(status_novo='REVERSAO').exists()
        passou_por_checagem = historico.filter(status_novo='CHECAGEM').exists()
        
        # Se nunca passou por REVERSAO, pode usar
        if not passou_por_reversao:
            choices_basicas.append(('REVERSAO', 'Reversão'))
            
        # Se nunca passou por CHECAGEM, pode usar  
        if not passou_por_checagem:
            choices_basicas.append(('CHECAGEM', 'Checagem'))
            
        return choices_basicas
    
    def get_status_choices_para_coordenador(self):
        """
        Retorna todas as opções de status para coordenadores/supervisores
        """
        return self.STATUS_CHOICES
    
    def pode_mover_para_concluido_pg(self):
        """
        Verifica se pode mover para CONCLUIDO_PG
        Consultor só pode mover se passou por REVERTIDO ou CHECAGEM_OK
        """
        return self.status in ['REVERTIDO', 'CHECAGEM_OK']


class HistoricoTabulacaoAgendamento(models.Model):
    """
    Modelo para armazenar o histórico de todas as alterações de tabulação dos agendamentos
    """
    agendamento = models.ForeignKey(
        AgendamentoFichaCliente,
        on_delete=models.CASCADE,
        related_name='historico_tabulacoes_agendamento',
        verbose_name="Agendamento"
    )
    status_anterior = models.CharField(
        max_length=25,
        choices=TabulacaoAgendamento.STATUS_CHOICES,
        blank=True,
        null=True,
        verbose_name="Status Anterior"
    )
    status_novo = models.CharField(
        max_length=25,
        choices=TabulacaoAgendamento.STATUS_CHOICES,
        verbose_name="Status Novo"
    )
    usuario = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='historico_tabulacoes_agendamento',
        verbose_name="Usuário que Alterou"
    )
    data_alteracao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data da Alteração"
    )
    observacoes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observações"
    )

    class Meta:
        verbose_name = "Histórico de Tabulação do Agendamento"
        verbose_name_plural = "Históricos de Tabulações dos Agendamentos"
        ordering = ['-data_alteracao']
        indexes = [
            models.Index(fields=['agendamento']),
            models.Index(fields=['data_alteracao']),
            models.Index(fields=['status_novo']),
        ]

    def __str__(self):
        return f"Histórico {self.agendamento.cliente.nome} - {self.status_anterior} → {self.status_novo}"


class DocumentoCliente(models.Model):
    """
    Modelo para armazenar documentos/arquivos do cliente
    """
    TIPO_DOCUMENTO_CHOICES = [
        ('RG', 'RG'),
        ('CPF', 'CPF'),
        ('COMPROVANTE_RENDA', 'Comprovante de Renda'),
        ('COMPROVANTE_RESIDENCIA', 'Comprovante de Residência'),
        ('CONTRACHEQUE', 'Contracheque'),
        ('DECLARACAO_IR', 'Declaração Imposto de Renda'),
        ('OUTROS', 'Outros'),
    ]
    
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='documentos',
        verbose_name="Cliente"
    )
    nome_documento = models.CharField(
        max_length=255,
        verbose_name="Nome do Documento"
    )
    tipo_documento = models.CharField(
        max_length=25,
        choices=TIPO_DOCUMENTO_CHOICES,
        default='OUTROS',
        verbose_name="Tipo do Documento"
    )
    arquivo = models.FileField(
        upload_to='documentos_clientes/%Y/%m/',
        verbose_name="Arquivo"
    )
    data_upload = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data do Upload"
    )
    usuario_upload = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos_enviados',
        verbose_name="Usuário que Enviou"
    )
    observacoes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observações"
    )
    ativo = models.BooleanField(
        default=True,
        verbose_name="Ativo"
    )

    class Meta:
        verbose_name = "Documento do Cliente"
        verbose_name_plural = "Documentos dos Clientes"
        ordering = ['-data_upload']
        indexes = [
            models.Index(fields=['cliente']),
            models.Index(fields=['tipo_documento']),
            models.Index(fields=['data_upload']),
        ]

    def __str__(self):
        return f"{self.cliente.nome} - {self.nome_documento} ({self.get_tipo_documento_display()})"


class TelefoneCliente(models.Model):
    """
    Modelo para armazenar números de telefone associados ao CPF do cliente
    """
    TIPO_CHOICES = [
        ('CELULAR', 'Celular'),
        ('FIXO', 'Fixo'),
        ('COMERCIAL', 'Comercial'),
        ('RECADO', 'Recado'),
    ]
    
    ORIGEM_CHOICES = [
        ('AGENDAMENTO', 'Adicionado pelo Agendamento'),
        ('OUTROS', 'Adicionado por Outros Lugares'),
    ]
    
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.CASCADE,
        related_name='telefones',
        verbose_name="Cliente"
    )
    numero = models.CharField(
        max_length=15,
        verbose_name="Número do Telefone",
        help_text="Formato: (XX) XXXXX-XXXX ou (XX) XXXX-XXXX"
    )
    tipo = models.CharField(
        max_length=10,
        choices=TIPO_CHOICES,
        default='CELULAR',
        verbose_name="Tipo de Telefone"
    )
    origem = models.CharField(
        max_length=20,
        choices=ORIGEM_CHOICES,
        default='OUTROS',
        verbose_name="Origem do Cadastro",
        help_text="Indica se o telefone foi adicionado pelo agendamento ou outros lugares"
    )
    agendamento_origem = models.ForeignKey(
        'AgendamentoFichaCliente',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='telefones_cadastrados',
        verbose_name="Agendamento de Origem",
        help_text="Agendamento que originou este telefone (se aplicável)"
    )
    principal = models.BooleanField(
        default=False,
        verbose_name="Telefone Principal"
    )
    data_cadastro = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data do Cadastro"
    )
    usuario_cadastro = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='telefones_cadastrados',
        verbose_name="Usuário que Cadastrou"
    )
    observacoes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observações"
    )
    ativo = models.BooleanField(
        default=True,
        verbose_name="Ativo"
    )

    class Meta:
        verbose_name = "Telefone do Cliente"
        verbose_name_plural = "Telefones dos Clientes"
        ordering = ['-principal', '-data_cadastro']
        indexes = [
            models.Index(fields=['cliente']),
            models.Index(fields=['numero']),
            models.Index(fields=['tipo']),
        ]
        unique_together = ['cliente', 'numero']  # Evita números duplicados para o mesmo cliente

    def __str__(self):
        principal_text = " (Principal)" if self.principal else ""
        return f"{self.cliente.nome} - {self.numero} ({self.get_tipo_display()}){principal_text}"

    def clean(self):
        from django.core.exceptions import ValidationError
        # Validação para garantir que apenas um telefone seja principal por cliente
        if self.principal:
            existing_principal = TelefoneCliente.objects.filter(
                cliente=self.cliente,
                principal=True,
                ativo=True
            ).exclude(pk=self.pk)
            if existing_principal.exists():
                raise ValidationError('Já existe um telefone principal para este cliente.')


class DadosNegociacao(models.Model):
    """
    Modelo para armazenar dados detalhados da negociação quando a tabulação for CHECAGEM.
    Este modelo nunca pode ser excluído, mesmo que o agendamento ou tabulação sejam excluídos.
    """
    # Relacionamentos protegidos - nunca serão excluídos
    agendamento = models.ForeignKey(
        AgendamentoFichaCliente,
        on_delete=models.PROTECT,
        related_name='dados_negociacao',
        verbose_name="Agendamento"
    )
    tabulacao = models.ForeignKey(
        TabulacaoAgendamento,
        on_delete=models.PROTECT,
        related_name='dados_negociacao',
        verbose_name="Tabulação"
    )
    
    # Dados financeiros da negociação
    banco_nome = models.CharField(
        max_length=100,
        verbose_name="Nome do Banco",
        blank=True,
        null=True
    )
    valor_liberado = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Valor Liberado",
        blank=True,
        null=True
    )
    saldo_devedor = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Saldo Devedor",
        blank=True,
        null=True
    )
    parcela_atual = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Parcela Atual",
        blank=True,
        null=True
    )
    parcela_nova = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        verbose_name="Parcela Nova",
        blank=True,
        null=True
    )
    tc = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        verbose_name="TC",
        blank=True,
        null=True,
        help_text="Valor TC (quanto a empresa recebe na operação)"
    )
    troco = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name="Troco",
        blank=True,
        null=True
    )
    prazo_atual = models.PositiveIntegerField(
        verbose_name="Prazo Atual (meses)",
        blank=True,
        null=True
    )
    prazo_acordado = models.PositiveIntegerField(
        verbose_name="Prazo Acordado (meses)",
        blank=True,
        null=True
    )
    
    # Informações adicionais
    descricao = models.TextField(
        verbose_name="Descrição da Negociação",
        blank=True,
        null=True,
        max_length=3000,
        help_text="Detalhes adicionais sobre a negociação - máximo 3000 caracteres"
    )
    
    # Controle temporal
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de Criação"
    )
    data_ultima_modificacao = models.DateTimeField(
        auto_now=True,
        verbose_name="Data da Última Modificação"
    )
    
    # Status do registro
    status = models.BooleanField(
        default=True,
        verbose_name="Ativo"
    )

    class Meta:
        verbose_name = "Dados da Negociação"
        verbose_name_plural = "Dados das Negociações"
        ordering = ['-data_criacao']
        indexes = [
            models.Index(fields=['agendamento']),
            models.Index(fields=['tabulacao']),
            models.Index(fields=['data_criacao']),
            models.Index(fields=['banco_nome']),
        ]

    def __str__(self):
        cliente_nome = self.agendamento.cliente.nome if self.agendamento and self.agendamento.cliente else "Cliente N/A"
        banco_info = f" - {self.banco_nome}" if self.banco_nome else ""
        valor_info = f" - R$ {self.valor_liberado}" if self.valor_liberado else ""
        return f"Negociação: {cliente_nome}{banco_info}{valor_info}"

    def clean(self):
        from django.core.exceptions import ValidationError
        
        # Apenas valida se ambos os valores estão preenchidos e são iguais, mas apenas em criação
        # Para edições, permite valores iguais se o usuário quiser manter
        warnings = []
        
        # Validação: parcela_nova deve ser diferente de parcela_atual apenas se for uma criação inicial 
        # com valores substanciais e ambos preenchidos
        if (self.parcela_atual is not None and self.parcela_nova is not None and 
            self.parcela_atual == self.parcela_nova and self.parcela_atual > 0):
            # Se é uma criação nova (não tem ID) ou se está sendo editado com valores idênticos > 0
            if not self.pk:  # Só valida na criação, não na edição
                warnings.append('Atenção: A parcela nova é igual à parcela atual.')
        
        # Validação: prazo_acordado deve ser diferente de prazo_atual apenas se for uma criação inicial
        if (self.prazo_atual is not None and self.prazo_acordado is not None and 
            self.prazo_atual == self.prazo_acordado and self.prazo_atual > 0):
            # Se é uma criação nova (não tem ID)
            if not self.pk:  # Só valida na criação, não na edição
                warnings.append('Atenção: O prazo acordado é igual ao prazo atual.')
        
        # Validação: valores não podem ser negativos
        campos_monetarios = ['valor_liberado', 'saldo_devedor', 'parcela_atual', 'parcela_nova', 'troco', 'tc']
        for campo in campos_monetarios:
            valor = getattr(self, campo)
            if valor is not None and valor < 0:
                raise ValidationError({
                    campo: f'{campo.replace("_", " ").title()} não pode ser negativo.'
                })
        
        # Por enquanto, apenas logamos os warnings ao invés de bloquear
        if warnings:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Dados de negociação com possíveis inconsistências: {'; '.join(warnings)}")


class ArquivoNegociacao(models.Model):
    """
    Modelo para armazenar arquivos relacionados aos dados de negociação.
    """
    # Relacionamento protegido - nunca será excluído
    dados_negociacao = models.ForeignKey(
        DadosNegociacao,
        on_delete=models.PROTECT,
        related_name='arquivos',
        verbose_name="Dados da Negociação"
    )
    
    # Informações do arquivo
    titulo_arquivo = models.CharField(
        max_length=255,
        verbose_name="Título do Arquivo"
    )
    arquivo = models.FileField(
        upload_to='arquivos_negociacao/%Y/%m/',
        verbose_name="Arquivo",
        help_text="Arquivos relacionados à negociação"
    )
    
    # Controle temporal
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de Criação"
    )
    data_ultima_modificacao = models.DateTimeField(
        auto_now=True,
        verbose_name="Data da Última Modificação"
    )
    
    # Status do registro
    status = models.BooleanField(
        default=True,
        verbose_name="Ativo"
    )

    class Meta:
        verbose_name = "Arquivo da Negociação"
        verbose_name_plural = "Arquivos das Negociações"
        ordering = ['-data_criacao']
        indexes = [
            models.Index(fields=['dados_negociacao']),
            models.Index(fields=['data_criacao']),
        ]

    def __str__(self):
        return f"{self.titulo_arquivo} - {self.dados_negociacao}"

    def get_tamanho_arquivo(self):
        """Retorna o tamanho do arquivo em formato legível"""
        try:
            if self.arquivo and hasattr(self.arquivo, 'size'):
                tamanho = self.arquivo.size
                if tamanho < 1024:
                    return f"{tamanho} bytes"
                elif tamanho < 1024 * 1024:
                    return f"{tamanho/1024:.1f} KB"
                else:
                    return f"{tamanho/(1024*1024):.1f} MB"
            return "Arquivo não disponível"
        except:
            return "Erro ao calcular tamanho"

class HorarioChecagem(models.Model):
    """
    Modelo para gerenciar horários de checagem e reversão.
    Permite que coordenadores (hierarquia 3+) visualizem calendário de horários
    e consultores agendem checagens/reversões.
    """
    STATUS_CHECAGEM_CHOICES = [
        ('EM_ESPERA', 'Em Espera'),
        ('EM_ANDAMENTO', 'Em Andamento'),
        ('FINALIZADO', 'Finalizado'),
    ]
    
    # Relacionamentos com usuários
    coordenador = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='horarios_coordenador',
        verbose_name="Coordenador",
        help_text="Usuário coordenador ou superior (hierarquia 3+) responsável pela checagem"
    )
    consultor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='horarios_consultor',
        verbose_name="Consultor",
        help_text="Usuário consultor que solicitou a checagem/reversão"
    )
    
    # Relacionamentos com agendamento e tabulação
    agendamento = models.ForeignKey(
        AgendamentoFichaCliente,
        on_delete=models.PROTECT,
        related_name='horarios_checagem',
        verbose_name="Agendamento",
        help_text="Agendamento relacionado à checagem/reversão"
    )
    tabulacao = models.ForeignKey(
        TabulacaoAgendamento,
        on_delete=models.PROTECT,
        related_name='horarios_checagem',
        verbose_name="Tabulação",
        help_text="Tabulação relacionada à checagem/reversão"
    )
    
    # Data e hora do agendamento de checagem
    data = models.DateField(
        verbose_name="Data da Checagem",
        help_text="Data agendada para a checagem/reversão"
    )
    hora = models.TimeField(
        verbose_name="Hora da Checagem",
        help_text="Hora agendada para a checagem/reversão (intervalos de 15 min entre 10h-17h)"
    )
    
    # Controle temporal
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de Criação"
    )
    data_ultima_modificacao = models.DateTimeField(
        auto_now=True,
        verbose_name="Data da Última Modificação"
    )
    
    # Observações
    observacao_consultor = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observação do Consultor",
        help_text="Observações do consultor sobre a checagem/reversão solicitada"
    )
    observacao_coordenador = models.TextField(
        blank=True,
        null=True,
        verbose_name="Observação do Coordenador",
        help_text="Observações do coordenador sobre a checagem/reversão"
    )
    
    # Status da checagem
    status_checagem = models.CharField(
        max_length=15,
        choices=STATUS_CHECAGEM_CHOICES,
        default='EM_ESPERA',
        verbose_name="Status da Checagem"
    )
    
    # Status ativo/inativo
    status = models.BooleanField(
        default=True,
        verbose_name="Ativo",
        help_text="Define se o horário de checagem está ativo ou inativo"
    )
    
    class Meta:
        verbose_name = "Horário de Checagem"
        verbose_name_plural = "Horários de Checagem"
        ordering = ['-data', '-hora']
        indexes = [
            models.Index(fields=['coordenador', 'data']),
            models.Index(fields=['consultor', 'data']),
            models.Index(fields=['data', 'hora']),
            models.Index(fields=['status_checagem']),
            models.Index(fields=['agendamento']),
            models.Index(fields=['tabulacao']),
        ]
        # Garante que não haja duplicatas do mesmo agendamento com mesmo coordenador e horário
        unique_together = ['coordenador', 'agendamento', 'data', 'hora']
    
    def __str__(self):
        coordenador_nome = "Coordenador ID " + str(self.coordenador_id)
        consultor_nome = "Consultor ID " + str(self.consultor_id)
        
        try:
            # Tenta buscar o nome do coordenador
            if hasattr(self.coordenador, 'funcionario_profile') and self.coordenador.funcionario_profile:
                coord_func = self.coordenador.funcionario_profile
                coordenador_nome = coord_func.apelido or coord_func.nome_completo.split()[0]
            else:
                coordenador_nome = self.coordenador.username
        except:
            pass
        
        try:
            # Tenta buscar o nome do consultor
            if hasattr(self.consultor, 'funcionario_profile') and self.consultor.funcionario_profile:
                cons_func = self.consultor.funcionario_profile
                consultor_nome = cons_func.apelido or cons_func.nome_completo.split()[0]
            else:
                consultor_nome = self.consultor.username
        except:
            pass
        
        return f"{coordenador_nome} x {consultor_nome} - {self.data.strftime('%d/%m/%Y')} {self.hora.strftime('%H:%M')} ({self.get_status_checagem_display()})"
    
    def clean(self):
        """
        Validações personalizadas do modelo
        """
        from django.core.exceptions import ValidationError
        from datetime import time
        
        # Validação de hora: deve estar entre 10h e 17h
        if self.hora:
            hora_inicio = time(10, 0)  # 10:00
            hora_fim = time(17, 0)     # 17:00
            
            if not (hora_inicio <= self.hora <= hora_fim):
                raise ValidationError({
                    'hora': 'A hora deve estar entre 10:00 e 17:00.'
                })
            
            # Validação de intervalo de 15 minutos
            minutos_validos = [0, 15, 30, 45]
            if self.hora.minute not in minutos_validos:
                raise ValidationError({
                    'hora': 'A hora deve ser agendada em intervalos de 15 minutos (00, 15, 30, 45).'
                })
        
        # Validação: data não pode ser no passado
        if self.data:
            from django.utils import timezone
            hoje = timezone.now().date()
            if self.data < hoje:
                raise ValidationError({
                    'data': 'A data da checagem não pode ser no passado.'
                })
        
        # Validação: coordenador deve ter hierarquia 3 ou superior
        if self.coordenador_id:
            try:
                from apps.funcionarios.models import Funcionario, Cargo
                funcionario_coordenador = Funcionario.objects.get(usuario=self.coordenador)
                if funcionario_coordenador.cargo and funcionario_coordenador.cargo.hierarquia < 3:
                    raise ValidationError({
                        'coordenador': 'O coordenador deve ter hierarquia 3 (Coordenador) ou superior.'
                    })
            except Funcionario.DoesNotExist:
                raise ValidationError({
                    'coordenador': 'O usuário coordenador deve ter um perfil de funcionário válido.'
                })
        
        # Validação: consultor e coordenador devem ser usuários diferentes
        if self.coordenador_id and self.consultor_id and self.coordenador_id == self.consultor_id:
            raise ValidationError(
                'O coordenador e o consultor devem ser usuários diferentes.'
            )
    
    @classmethod
    def get_horarios_disponiveis(cls, coordenador, data):
        """
        Retorna lista de horários disponíveis para um coordenador em uma data específica.
        Horários: 10:00 às 17:00 em intervalos de 15 minutos.
        """
        from datetime import time, timedelta
        
        # Gera todos os horários possíveis (10:00 - 17:00, intervalos de 15 min)
        horarios_possiveis = []
        hora_atual = time(10, 0)
        hora_limite = time(17, 0)
        
        while hora_atual <= hora_limite:
            horarios_possiveis.append(hora_atual)
            # Adiciona 15 minutos
            minutos = hora_atual.minute + 15
            horas = hora_atual.hour
            if minutos >= 60:
                horas += 1
                minutos = 0
            hora_atual = time(horas, minutos)
        
        # Remove horários já ocupados para o coordenador na data
        horarios_ocupados = cls.objects.filter(
            coordenador=coordenador,
            data=data,
            status=True  # Apenas horários ativos
        ).values_list('hora', flat=True)
        
        # Retorna horários disponíveis
        horarios_disponiveis = [h for h in horarios_possiveis if h not in horarios_ocupados]
        
        return horarios_disponiveis
    
    @property
    def pode_ser_editado(self):
        """
        Verifica se o horário ainda pode ser editado (não finalizado)
        """
        return self.status_checagem != 'FINALIZADO'
    
    @property
    def cliente_nome(self):
        """
        Retorna o nome do cliente do agendamento relacionado
        """
        try:
            return self.agendamento.cliente.nome
        except:
            return "Cliente não disponível"
    
    @property
    def cliente_cpf(self):
        """
        Retorna o CPF do cliente do agendamento relacionado
        """
        try:
            return self.agendamento.cliente.cpf
        except:
            return "CPF não disponível"
