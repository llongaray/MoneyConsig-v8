from django.db import models
from django.contrib.auth.models import User
from django.core.files.storage import FileSystemStorage
from django.conf import settings
import os
from django.utils.text import slugify
from django.utils import timezone
from django.core.validators import FileExtensionValidator

# --- Configuração de Armazenamento ---

fs_funcionarios = FileSystemStorage(location=os.path.join(settings.MEDIA_ROOT, 'arquivos_funcionarios'))

def get_funcionario_upload_path(instance, filename):
    """Define o diretório como 'funcionarios/<nome_completo>/<filename>'"""
    # Se a instância é um ArquivoFuncionario, precisamos acessar o nome pelo relacionamento
    if hasattr(instance, 'funcionario') and instance.funcionario:
        nome_completo = slugify(instance.funcionario.nome_completo)
        return os.path.join('funcionarios', nome_completo, filename)
    # Se a instância é um Funcionario
    elif hasattr(instance, 'nome_completo') and instance.nome_completo:
        nome_completo = slugify(instance.nome_completo)
        return os.path.join('funcionarios', nome_completo, filename)
    # Caso nenhum nome completo esteja disponível
    return os.path.join('funcionarios', 'sem_nome', filename)

def get_loja_logo_upload_path(instance, filename):
    """Define o diretório como 'lojas/logos/<loja_id>/<filename>'"""
    if instance.pk:
        return os.path.join('lojas', 'logos', str(instance.pk), filename)
    return os.path.join('lojas', 'logos', 'sem_id', filename)


# --- Modelos Principais ---

class Empresa(models.Model):
    nome = models.CharField(max_length=255, verbose_name="Nome")
    cnpj = models.CharField(max_length=18, unique=True, verbose_name="CNPJ")
    endereco = models.CharField(max_length=255, verbose_name="Endereço")
    status = models.BooleanField(default=True, verbose_name="Ativo")

    def save(self, *args, **kwargs):
        self.nome = self.nome.upper()
        super(Empresa, self).save(*args, **kwargs)

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = "Empresa"
        verbose_name_plural = "Empresas"
        ordering = ['nome']

class Loja(models.Model):
    nome = models.CharField(max_length=255, verbose_name="Nome")
    empresa = models.ForeignKey(Empresa, on_delete=models.PROTECT, related_name='lojas', verbose_name="Empresa")
    logo = models.ImageField(upload_to=get_loja_logo_upload_path, null=True, blank=True, verbose_name="Logo")
    franquia = models.BooleanField(default=False, verbose_name="Franquia")
    filial = models.BooleanField(default=False, verbose_name="Filial")
    status = models.BooleanField(default=True, verbose_name="Ativo")

    def save(self, *args, **kwargs):
        self.nome = self.nome.upper()
        # Lógica para garantir que não seja franquia e filial ao mesmo tempo, se necessário
        # if self.franquia and self.filial:
        #    raise ValidationError("Uma loja não pode ser Franquia e Filial ao mesmo tempo.")
        super(Loja, self).save(*args, **kwargs)

    def __str__(self):
        tipo = ""
        if self.franquia:
            tipo = " (Franquia)"
        elif self.filial:
            tipo = " (Filial)"
        return f'{self.nome}{tipo} - {self.empresa.nome}'

    class Meta:
        verbose_name = "Loja"
        verbose_name_plural = "Lojas"
        ordering = ['empresa__nome', 'nome']

class Departamento(models.Model):
    nome = models.CharField(max_length=100, verbose_name="Nome")
    empresa = models.ForeignKey(Empresa, on_delete=models.PROTECT, related_name='departamentos', verbose_name="Empresa")
    status = models.BooleanField(default=True, verbose_name="Ativo")

    def save(self, *args, **kwargs):
        self.nome = self.nome.upper()
        super(Departamento, self).save(*args, **kwargs)

    def __str__(self):
        return f'{self.nome} - {self.empresa.nome}'

    class Meta:
        verbose_name = "Departamento"
        verbose_name_plural = "Departamentos"
        ordering = ['empresa__nome', 'nome']
        unique_together = ('nome', 'empresa') # Garante que o nome do departamento seja único por empresa

class Setor(models.Model):
    nome = models.CharField(max_length=100, verbose_name="Nome")
    departamento = models.ForeignKey(Departamento, on_delete=models.PROTECT, related_name='setores', verbose_name="Departamento")
    status = models.BooleanField(default=True, verbose_name="Ativo")

    def save(self, *args, **kwargs):
        self.nome = self.nome.upper()
        super(Setor, self).save(*args, **kwargs)

    def __str__(self):
        return f'{self.nome} - {self.departamento.nome}'

    class Meta:
        verbose_name = "Setor"
        verbose_name_plural = "Setores"
        ordering = ['departamento__nome', 'nome']
        unique_together = ('nome', 'departamento') # Garante que o nome do setor seja único por departamento


class Equipe(models.Model):
    nome = models.CharField(max_length=100, verbose_name="Nome da Equipe")
    participantes = models.ManyToManyField(User, related_name='equipes_participantes', verbose_name="Participantes", blank=True)
    status = models.BooleanField(default=True, verbose_name="Ativo")
    # Adicionar empresa ou loja aqui pode ser útil para filtrar equipes
    # loja = models.ForeignKey(Loja, on_delete=models.CASCADE, related_name='equipes', null=True, blank=True, verbose_name="Loja Associada")

    def save(self, *args, **kwargs):
        self.nome = self.nome.upper()
        super(Equipe, self).save(*args, **kwargs)

    def __str__(self):
        return self.nome

    class Meta:
        verbose_name = "Equipe"
        verbose_name_plural = "Equipes"
        ordering = ['nome']


class Cargo(models.Model):
    class HierarquiaChoices(models.IntegerChoices):
        ESTAGIO = 1, 'ESTAGIO'
        PADRAO = 2, 'PADRAO'
        COORDENADOR = 3, 'COORDENADOR(A)'
        GERENTE = 4, 'GERENTE'
        FRANQUEADO = 5, 'FRANQUEADO(A)'
        SUPERVISOR_GERAL = 6, 'SUPERVISOR(A) GERAL'
        GESTOR = 7, 'GESTOR'
        # Removi SUPERUSER = 5, pois parece mais uma permissão do sistema
        # Se precisar de outros níveis, pode adicionar aqui seguindo o padrão VALOR, 'NOME_EXIBIDO'

    nome = models.CharField(max_length=100, verbose_name="Nome do Cargo")
    empresa = models.ForeignKey(Empresa, on_delete=models.PROTECT, related_name='cargos', verbose_name="Empresa")
    # Atualiza o default para ESTAGIO se fizer mais sentido que PADRAO, ou mantém PADRAO
    hierarquia = models.IntegerField(choices=HierarquiaChoices.choices, default=HierarquiaChoices.PADRAO, verbose_name="Nível Hierárquico")
    status = models.BooleanField(default=True, verbose_name="Ativo")

    def save(self, *args, **kwargs):
        self.nome = self.nome.upper()
        super(Cargo, self).save(*args, **kwargs)

    def __str__(self):
        return f"{self.nome} ({self.get_hierarquia_display()}) - {self.empresa.nome}"

    class Meta:
        verbose_name = "Cargo"
        verbose_name_plural = "Cargos"
        ordering = ['empresa__nome', 'hierarquia', 'nome']
        unique_together = ('nome', 'empresa', 'hierarquia')

class HorarioTrabalho(models.Model):
    nome = models.CharField(max_length=100, unique=True, verbose_name="Nome do Horário")
    entrada = models.TimeField(verbose_name="Horário de Entrada")
    saida_almoco = models.TimeField(verbose_name="Saída para Almoço")
    volta_almoco = models.TimeField(verbose_name="Volta do Almoço")
    saida = models.TimeField(verbose_name="Horário de Saída")
    status = models.BooleanField(default=True, verbose_name="Ativo")
    # empresa = models.ForeignKey(Empresa, on_delete=models.CASCADE, related_name='horarios', verbose_name="Empresa", null=True, blank=True) # Descomente se horários forem por empresa

    def save(self, *args, **kwargs):
        self.nome = self.nome.upper()
        super(HorarioTrabalho, self).save(*args, **kwargs)

    def __str__(self):
        return f"{self.nome} ({self.entrada} - {self.saida_almoco} / {self.volta_almoco} - {self.saida})"

    class Meta:
        verbose_name = "Horário de Trabalho"
        verbose_name_plural = "Horários de Trabalho"
        ordering = ['nome']


# --- Modelo Funcionario e Arquivos ---

class Funcionario(models.Model):
    # Vínculo com Usuário Django (Opcional)
    usuario = models.OneToOneField(User, on_delete=models.SET_NULL, related_name='funcionario_profile', null=True, blank=True, verbose_name="Usuário Django")

    # Informações Pessoais
    apelido = models.CharField(max_length=100, blank=True, null=True, verbose_name="Apelido")
    nome_completo = models.CharField(max_length=255, verbose_name="Nome Completo")
    foto = models.ImageField(upload_to=get_funcionario_upload_path, blank=True, null=True, verbose_name="Foto")
    cpf = models.CharField(max_length=14, unique=True, verbose_name="CPF") # Adicionado unique=True
    data_nascimento = models.DateField(verbose_name="Data de Nascimento")
    genero = models.CharField(max_length=50, blank=True, null=True, verbose_name="Gênero") # Ajustado max_length
    estado_civil = models.CharField(max_length=50, blank=True, null=True, verbose_name="Estado Civil") # Ajustado max_length

    # Informações de Contato
    cep = models.CharField(max_length=9, blank=True, null=True, verbose_name="CEP")
    endereco = models.CharField(max_length=255, blank=True, null=True, verbose_name="Endereço")
    bairro = models.CharField(max_length=100, blank=True, null=True, verbose_name="Bairro")
    cidade = models.CharField(max_length=100, blank=True, null=True, verbose_name="Cidade")
    estado = models.CharField(max_length=2, blank=True, null=True, verbose_name="UF") # Ajustado max_length para sigla
    celular1 = models.CharField(max_length=20, blank=True, null=True, verbose_name="Celular Principal") # Ajustado max_length
    celular2 = models.CharField(max_length=20, blank=True, null=True, verbose_name="Celular Secundário") # Ajustado max_length

    # Informações Familiares (Opcional)
    nome_mae = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nome da Mãe") # Ajustado max_length
    nome_pai = models.CharField(max_length=255, blank=True, null=True, verbose_name="Nome do Pai") # Ajustado max_length
    nacionalidade = models.CharField(max_length=100, blank=True, null=True, verbose_name="Nacionalidade") # Ajustado max_length
    naturalidade = models.CharField(max_length=100, blank=True, null=True, verbose_name="Naturalidade (Cidade de Nascimento)") # Ajustado max_length e verbose_name

    # Informações Profissionais e Documentos
    matricula = models.CharField(max_length=50, unique=True, blank=True, null=True, verbose_name="Matrícula") # Adicionado unique=True
    pis = models.CharField(max_length=20, blank=True, null=True, verbose_name="PIS") # Campo PIS adicionado aqui
    
    class TipoContratoChoices(models.TextChoices):
        CLT = 'CLT', 'CLT'
        MEI = 'MEI', 'MEI'
        ESTAGIO = 'ESTAGIO', 'Estágio'

    tipo_contrato = models.CharField(
        max_length=10,
        choices=TipoContratoChoices.choices,
        default=TipoContratoChoices.CLT,
        verbose_name="Tipo de Contrato",
        null=True, blank=True # Permitir nulo temporariamente para migrações em dados existentes
    )

    empresa = models.ForeignKey(Empresa, on_delete=models.PROTECT, related_name='funcionarios', verbose_name="Empresa")
    lojas = models.ManyToManyField(Loja, blank=True, related_name='funcionarios', verbose_name="Lojas")
    departamento = models.ForeignKey(Departamento, on_delete=models.PROTECT, related_name='funcionarios', verbose_name="Departamento")
    setor = models.ForeignKey(Setor, on_delete=models.PROTECT, related_name='funcionarios', verbose_name="Setor")
    cargo = models.ForeignKey(Cargo, on_delete=models.PROTECT, related_name='funcionarios', verbose_name="Cargo")
    horario = models.ForeignKey(HorarioTrabalho, on_delete=models.SET_NULL, null=True, blank=True, related_name='funcionarios', verbose_name="Horário Padrão")
    equipe = models.ForeignKey(Equipe, on_delete=models.SET_NULL, blank=True, null=True, related_name='membros', verbose_name="Equipe")

    # Campo para regras de comissionamento específicas (Muitos-para-Muitos)
    regras_comissionamento = models.ManyToManyField(
        'Comissionamento',
        blank=True, # Permite que um funcionário não tenha regras específicas
        related_name='funcionarios_aplicaveis', # Nome para acessar funcionários a partir de uma regra
        verbose_name="Regras de Comissionamento Específicas",
        help_text="Selecione as regras de comissionamento que se aplicam especificamente a este funcionário. Estas podem complementar ou sobrescrever regras gerais."
    )

    status = models.BooleanField(default=True, verbose_name="Ativo") # Adicionado campo Status
    data_admissao = models.DateField(null=True, blank=True, verbose_name="Data de Admissão") # Adicionado campo Data Admissão
    data_demissao = models.DateField(null=True, blank=True, verbose_name="Data de Demissão") # Adicionado campo Data Demissão

    # Adicionar outros campos que foram removidos se necessário (RG, CNH, CTPS, etc.)
    # rg = models.CharField(max_length=20, blank=True, null=True)
    # cnh = models.CharField(max_length=20, blank=True, null=True)
    # categoria_cnh = models.CharField(max_length=5, blank=True, null=True)
    # ctps = models.CharField(max_length=20, blank=True, null=True)
    # numero_da_folha = models.CharField(max_length=20, blank=True, null=True)
    # superior_direto = models.ForeignKey('self', on_delete=models.SET_NULL, blank=True, null=True, related_name='subordinados')

    def save(self, *args, **kwargs):
        # Gerenciamento da foto antiga (se necessário, similar ao código anterior)
        if self.pk:  # Verifica se o objeto já existe
            try:
                old_instance = Funcionario.objects.get(pk=self.pk)
                if old_instance.foto and self.foto != old_instance.foto: # Se a foto antiga existir e for diferente da nova
                    if os.path.isfile(old_instance.foto.path):
                        os.remove(old_instance.foto.path) # Remove o arquivo da foto antiga
            except Funcionario.DoesNotExist:
                pass # Objeto sendo criado
            except Exception as e:
                # Considerar usar logging em vez de print em produção
                print(f"Erro ao tentar deletar a foto antiga do funcionário {self.pk}: {e}")

        # Padroniza campos de texto para maiúsculas
        self.nome_completo = self.nome_completo.upper() if self.nome_completo else None
        self.apelido = self.apelido.upper() if self.apelido else None
        self.nome_mae = self.nome_mae.upper() if self.nome_mae else None
        self.nome_pai = self.nome_pai.upper() if self.nome_pai else None
        # Adicionar validações se necessário (ex: CPF, data de admissão/demissão)
        # Exemplo: Validação de datas
        if self.data_admissao and self.data_demissao and self.data_demissao < self.data_admissao:
            from django.core.exceptions import ValidationError
            raise ValidationError({'data_demissao': "A data de demissão não pode ser anterior à data de admissão."})

        super(Funcionario, self).save(*args, **kwargs)

    def __str__(self):
        display = self.apelido if self.apelido else (self.nome_completo.split()[0] if self.nome_completo else 'Sem Nome')
        matricula_display = self.matricula or 'Sem Matrícula'
        empresa_nome = self.empresa.nome if self.empresa else 'Sem Empresa'
        return f"{display} ({matricula_display}) - {empresa_nome}"

    class Meta:
        verbose_name = "Funcionário"
        verbose_name_plural = "Funcionários"
        ordering = ['empresa__nome', 'nome_completo']


class ArquivoFuncionario(models.Model):
    funcionario = models.ForeignKey(Funcionario, on_delete=models.CASCADE, related_name='arquivos', verbose_name="Funcionário")
    arquivo = models.FileField(upload_to=get_funcionario_upload_path, storage=fs_funcionarios, verbose_name="Arquivo")
    titulo = models.CharField(max_length=100, verbose_name="Título do Arquivo")
    descricao = models.TextField(blank=True, null=True, verbose_name="Descrição")
    status = models.BooleanField(default=True, verbose_name="Ativo")
    data_upload = models.DateTimeField(auto_now_add=True, verbose_name="Data de Upload")

    def __str__(self):
        try:
            # Primeiro verifica se o funcionário existe
            if hasattr(self, 'funcionario') and self.funcionario is not None:
                return f"{self.titulo} - {self.funcionario.nome_completo}"
            return f"{self.titulo} - Sem Funcionário"
        except Exception as e:
            # Em caso de erro, retorna apenas o título com o ID se disponível
            return f"{self.titulo} - ID:{getattr(self, 'funcionario_id', 'N/A')}"

    def get_nome_funcionario(self):
        """Método seguro para obter o nome do funcionário"""
        try:
            if self.funcionario:
                return self.funcionario.nome_completo
            return "Sem funcionário vinculado"
        except:
            return "Funcionário indisponível"

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

    class Meta:
        verbose_name = "Arquivo do Funcionário"
        verbose_name_plural = "Arquivos dos Funcionários"
        ordering = ['funcionario_id', '-data_upload']

# Remover modelos antigos se não forem mais necessários
# class Horario(models.Model): ... (removido)
# class FotoFuncionario(models.Model): ... (removido ou adaptado para ArquivoFuncionario)


# --- Modelos de Comissionamento ---

class Comissionamento(models.Model):
    """
    Modelo para definir regras de comissionamento para funcionários.
    Permite configurar comissões baseadas em percentuais ou valores fixos,
    possivelmente por faixas de valor. O escopo da base de cálculo (geral,
    empresa, departamento, etc.) determina como o valor base para a comissão
    é agregado. A regra pode ser aplicada a entidades específicas (empresas,
    departamentos, etc.).
    """
    class EscopoBaseComissaoChoices(models.TextChoices):
        GERAL = 'GERAL', 'Geral (Valor Total)'
        EMPRESA = 'EMPRESA', 'Por Empresa(s)'
        DEPARTAMENTO = 'DEPARTAMENTO', 'Por Departamento'
        SETOR = 'SETOR', 'Por Setor'
        EQUIPE = 'EQUIPE', 'Por Equipe'
        PESSOAL = 'PESSOAL', 'Individual (Pessoal)'
        LOJA = 'LOJA', 'Por Loja(s)'
        # Adicionar outros escopos conforme necessário

    # --- Configuração da Regra ---
    titulo = models.CharField(
        max_length=255,
        verbose_name="Título da Regra",
        help_text="Um nome descritivo para esta regra de comissionamento."
    )
    escopo_base = models.CharField(
        max_length=20,
        choices=EscopoBaseComissaoChoices.choices,
        default=EscopoBaseComissaoChoices.PESSOAL, # Default pode ser ajustado conforme a necessidade mais comum
        verbose_name="Escopo da Base de Cálculo",
        help_text=(
            "Define como o valor base para o cálculo da comissão é determinado: "
            "'Geral' usa um valor total; 'Empresa' soma valores da(s) empresa(s) vinculada(s); "
            "'Departamento', 'Setor', 'Equipe' somam valores da respectiva entidade; "
            "'Pessoal' considera apenas o valor individual do funcionário."
            "'Loja' soma valores da(s) loja(s) vinculada(s); "
        )
    )

    # --- Método de Cálculo da Comissão ---
    # Estes campos definem COMO a comissão é calculada sobre o valor base (definido pelo escopo_base)
    # Pode ser percentual, valor fixo, ou por faixas. A lógica de aplicação deve
    # verificar qual campo está preenchido. Idealmente, usar validação (clean method)
    # para garantir que apenas um método (ou combinação válida para faixas) seja definido.

    percentual = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        verbose_name="Percentual (%)",
        help_text="Percentual da comissão aplicado sobre o valor base (Ex: 5.00 para 5%)."
    )
    valor_fixo = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Valor Fixo (R$)",
        help_text="Valor fixo da comissão, independente do valor base (pode ser usado para metas atingidas)."
    )

    # Campos para cálculo baseado em faixa de valor (opcionais)
    valor_de = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Valor Base De (para faixas)",
        help_text="Valor base inicial da faixa para cálculo da comissão."
    )
    valor_ate = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        verbose_name="Valor Base Até (para faixas)",
        help_text="Valor base final da faixa para cálculo da comissão."
    )

    # --- Aplicabilidade da Regra ---
    # Define A QUEM esta regra se aplica. Se um campo M2M estiver vazio,
    # geralmente significa que não há filtro naquele nível.
    # A lógica de aplicação deve considerar a combinação desses filtros.
    empresas = models.ManyToManyField(
        Empresa,
        blank=True,
        related_name='regras_comissionamento',
        verbose_name="Empresas Aplicáveis",
        help_text="Selecione as empresas onde esta regra se aplica. Se vazio, pode aplicar-se a todas (dependendo de outros filtros)."
    )
    lojas = models.ManyToManyField(
        Loja,
        blank=True,
        related_name='regras_comissionamento_loja', # Evitar conflito com Empresa
        verbose_name="Lojas Aplicáveis",
        help_text="Selecione as lojas específicas onde esta regra se aplica. Filtra dentro das empresas selecionadas (se houver)."
    )
    departamentos = models.ManyToManyField(
        Departamento,
        blank=True,
        related_name='regras_comissionamento',
        verbose_name="Departamentos Aplicáveis",
        help_text="Selecione os departamentos onde esta regra se aplica. Filtra dentro das empresas selecionadas (se houver)."
    )
    setores = models.ManyToManyField(
        Setor,
        blank=True,
        related_name='regras_comissionamento',
        verbose_name="Setores Aplicáveis",
        help_text="Selecione os setores onde esta regra se aplica. Filtra dentro dos departamentos selecionados (se houver)."
    )
    equipes = models.ManyToManyField(
        Equipe,
        blank=True,
        related_name='regras_comissionamento',
        verbose_name="Equipes Aplicáveis",
        help_text="Selecione as equipes onde esta regra se aplica. Filtra dentro dos filtros anteriores (se houver)."
    )
    # Poderia adicionar M2M para Cargo ou Funcionario se precisar de granularidade maior

    # --- Controle e Auditoria ---
    status = models.BooleanField(default=True, verbose_name="Ativo")
    data_inicio = models.DateField(
        verbose_name="Data de Início da Vigência",
        null=True, blank=True,
        help_text="Data a partir da qual esta regra se torna válida."
    )
    data_fim = models.DateField(
        verbose_name="Data de Fim da Vigência",
        null=True, blank=True,
        help_text="Data até a qual esta regra é válida (deixe em branco se não houver data de término)."
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_atualizacao = models.DateTimeField(auto_now=True, verbose_name="Data de Atualização")

    def __str__(self):
        # Tenta mostrar o escopo no __str__
        try:
            escopo_display = self.get_escopo_base_display()
        except:
            escopo_display = self.escopo_base # Fallback para o valor bruto
        return f"{self.titulo} (Escopo: {escopo_display})"

    def clean(self):
        """
        Adiciona validações personalizadas ao modelo.
        """
        from django.core.exceptions import ValidationError

        # Validação 1: Garantir que pelo menos um método de cálculo (percentual ou valor_fixo) seja definido
        # (A menos que seja uma regra complexa que dependa apenas de faixas, o que precisaria de lógica adicional)
        # Esta validação pode ser ajustada conforme a regra de negócio exata.
        if self.percentual is None and self.valor_fixo is None:
             raise ValidationError(
                 "É necessário definir um 'Percentual (%)' ou um 'Valor Fixo (R$)' para a regra de comissão."
             )

        # Validação 2: Se for por faixa, os campos de faixa devem ser consistentes
        if (self.valor_de is not None or self.valor_ate is not None) and self.percentual is None and self.valor_fixo is None:
             # Permitir faixas sem valor/percentual base PODE fazer sentido se a regra for complexa,
             # mas geralmente uma faixa define um percentual ou valor específico PARA AQUELA FAIXA.
             # Se o percentual/valor_fixo aqui são GERAIS, e as faixas os sobrescrevem, a lógica muda.
             # Assumindo que valor_de/valor_ate definem a faixa e percentual/valor_fixo o cálculo DENTRO da faixa:
             pass # Ajustar esta lógica conforme necessário

        if self.valor_de is not None and self.valor_ate is not None and self.valor_de >= self.valor_ate:
            raise ValidationError({'valor_ate': "O 'Valor Base Até' deve ser maior que o 'Valor Base De'."})

        # Validação 3: Datas de vigência
        if self.data_inicio and self.data_fim and self.data_fim < self.data_inicio:
            raise ValidationError({'data_fim': "A 'Data de Fim da Vigência' não pode ser anterior à 'Data de Início da Vigência'."})

        # Validação 4: Coerência entre escopo e aplicabilidade (Exemplo)
        # Se o escopo é EMPRESA, idealmente o campo 'empresas' deveria ser preenchido.
        # Isso pode ser um aviso ou um erro, dependendo da rigidez desejada.
        if self.escopo_base == self.EscopoBaseComissaoChoices.EMPRESA and not self.empresas.exists() and self.pk: # Verifica apenas em updates
             # Poderia gerar um warning ou impedir o save. Por enquanto, apenas um exemplo.
             # print(f"Aviso: Regra {self.titulo} tem escopo 'Por Empresa(s)' mas nenhuma empresa foi selecionada.")
             pass
        # Lógicas similares podem ser aplicadas para DEPARTAMENTO, SETOR, EQUIPE.

    class Meta:
        verbose_name = "Regra de Comissionamento"
        verbose_name_plural = "Regras de Comissionamento"
        ordering = ['-status', '-data_criacao', 'titulo']
        constraints = [
            # Garante que a data fim, se existir, seja maior ou igual à data início
            models.CheckConstraint(
                check=models.Q(data_fim__isnull=True) | models.Q(data_fim__gte=models.F('data_inicio')),
                name='data_fim_maior_igual_data_inicio'
            ),
            # Garante que valor_ate, se existir, seja maior que valor_de (se valor_de existir)
             models.CheckConstraint(
                 check=models.Q(valor_de__isnull=True) | models.Q(valor_ate__isnull=True) | models.Q(valor_ate__gt=models.F('valor_de')),
                 name='valor_ate_maior_que_valor_de'
             ),
             # Adicionar constraints para garantir que apenas um método de cálculo principal seja usado,
             # ou que campos de faixa sejam usados corretamente, pode ser complexo via constraints.
             # O método clean() é geralmente mais adequado para essas validações condicionais.
        ]

# --- Modelos de Comunicados ---

class Comunicado(models.Model):
    """
    Modelo para armazenar comunicados enviados pelo RH para os funcionários.
    """
    assunto = models.CharField(max_length=255, verbose_name="Assunto")
    destinatarios = models.ManyToManyField(
        User,
        related_name='comunicados_recebidos',
        verbose_name="Destinatários"
    )
    texto = models.TextField(verbose_name="Texto do Comunicado", blank=True)
    banner = models.ImageField(
        upload_to='comunicados/banners/',
        verbose_name="Banner",
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(allowed_extensions=['png', 'jpg', 'jpeg', 'webp'])
        ]
    )
    status = models.BooleanField(default=True, verbose_name="Ativo")
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    criado_por = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='comunicados_criados',
        verbose_name="Criado por"
    )

    def clean(self):
        if not self.texto and not self.banner:
            raise ValidationError('O comunicado deve ter texto ou banner.')
        if self.texto and self.banner:
            raise ValidationError('O comunicado não pode ter texto e banner simultaneamente.')

    def __str__(self):
        return f"{self.assunto} ({self.data_criacao.strftime('%d/%m/%Y')})"

    def marcar_como_lido(self, usuario):
        """
        Marca o comunicado como lido para um usuário específico.
        Cria ou atualiza o registro de controle.
        """
        controle, created = ControleComunicado.objects.get_or_create(
            comunicado=self,
            usuario=usuario,
            defaults={'lido': True, 'data_leitura': timezone.now()}
        )
        
        if not created and not controle.lido:
            controle.lido = True
            controle.data_leitura = timezone.now()
            controle.save()
        
        return controle

    class Meta:
        verbose_name = "Comunicado"
        verbose_name_plural = "Comunicados"
        ordering = ['-data_criacao']

class ControleComunicado(models.Model):
    """
    Modelo para controlar quais comunicados foram lidos por cada usuário.
    """
    comunicado = models.ForeignKey(
        Comunicado,
        on_delete=models.CASCADE,
        related_name='controles',
        verbose_name="Comunicado"
    )
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='controles_comunicados',
        verbose_name="Usuário"
    )
    lido = models.BooleanField(default=False, verbose_name="Lido")
    data_leitura = models.DateTimeField(null=True, blank=True, verbose_name="Data da Leitura")

    class Meta:
        verbose_name = "Controle de Comunicado"
        verbose_name_plural = "Controles de Comunicados"
        unique_together = ['comunicado', 'usuario']
        ordering = ['-data_leitura']

    def __str__(self):
        status = "Lido" if self.lido else "Não lido"
        return f"{self.comunicado.assunto} - {self.usuario.username} ({status})"

class ArquivoComunicado(models.Model):
    """
    Modelo para armazenar arquivos anexados aos comunicados.
    """
    comunicado = models.ForeignKey(
        Comunicado,
        on_delete=models.CASCADE,
        related_name='arquivos',
        verbose_name="Comunicado"
    )
    arquivo = models.FileField(
        upload_to='comunicados/arquivos/',
        verbose_name="Arquivo"
    )
    status = models.BooleanField(default=True, verbose_name="Ativo")
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")

    def __str__(self):
        return f"Arquivo: {os.path.basename(self.arquivo.name)} - {self.comunicado.assunto}"

    class Meta:
        verbose_name = "Arquivo de Comunicado"
        verbose_name_plural = "Arquivos de Comunicados"
        ordering = ['-data_criacao']

# --- Modelos de Presença ---

class EntradaAuto(models.Model):
    """
    Modelo para registrar automaticamente quando um usuário acessa o sistema.
    O registro é feito apenas uma vez por dia, na primeira vez que o usuário acessa.
    """
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='entradas_auto',
        verbose_name="Usuário"
    )
    datahora = models.DateTimeField(
        default=timezone.now,
        verbose_name="Data e Hora"
    )
    data = models.DateField(
        default=timezone.now,
        verbose_name="Data"
    )
    ip_usado = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name="IP Usado"
    )

    def save(self, *args, **kwargs):
        # Se não está sendo criado manualmente (não tem pk) e não foi fornecida data/hora específica
        if not self.pk and not kwargs.get('manual_edit', False):
            # Comportamento automático - define data e datahora como agora
            now = timezone.now()
            if not hasattr(self, '_datahora_set'):
                self.datahora = now
            if not hasattr(self, '_data_set'):
                self.data = now.date()
        
        # Remove o parâmetro manual_edit antes de chamar super()
        kwargs.pop('manual_edit', None)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Entrada de {self.usuario.username} em {self.datahora.strftime('%d/%m/%Y %H:%M')}"

    class Meta:
        verbose_name = "Entrada Automática"
        verbose_name_plural = "Entradas Automáticas"
        ordering = ['-datahora']
        # Garante que só existe um registro por usuário por dia
        unique_together = ['usuario', 'data']

class RegistroPresenca(models.Model):
    """
    Modelo para registrar entradas e saídas dos funcionários.
    Pode ser registrado manualmente ou automaticamente pelo sistema.
    """
    class TipoRegistro(models.TextChoices):
        ENTRADA = 'ENTRADA', 'Entrada'
        SAIDA = 'SAIDA', 'Saída'

    entrada_auto = models.ForeignKey(
        EntradaAuto,
        on_delete=models.CASCADE,
        related_name='registros_presenca',
        verbose_name="Entrada Automática"
    )
    tipo = models.CharField(
        max_length=10,
        choices=TipoRegistro.choices,
        verbose_name="Tipo de Registro"
    )
    datahora = models.DateTimeField(
        default=timezone.now,
        verbose_name="Data e Hora"
    )

    def save(self, *args, **kwargs):
        # Se não está sendo criado manualmente e não foi fornecida data/hora específica
        if not self.pk and not kwargs.get('manual_edit', False):
            # Comportamento automático - define datahora como agora
            if not hasattr(self, '_datahora_set'):
                self.datahora = timezone.now()
        
        # Remove o parâmetro manual_edit antes de chamar super()
        kwargs.pop('manual_edit', None)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.entrada_auto.usuario.username} - {self.get_tipo_display()} - {self.datahora.strftime('%d/%m/%Y %H:%M')}"

    class Meta:
        verbose_name = "Registro de Presença"
        verbose_name_plural = "Registros de Presença"
        ordering = ['-datahora']

class RelatorioSistemaPresenca(models.Model):
    """
    Modelo para registrar relatórios gerados pelo sistema sobre ausências.
    O sistema verifica diariamente se houve registros de entrada/saída no dia anterior.
    """
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='relatorios_presenca',
        verbose_name="Usuário"
    )
    data = models.DateField(
        verbose_name="Data do Relatório"
    )
    observacao = models.TextField(
        verbose_name="Observação"
    )
    data_criacao = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Data de Criação"
    )

    def __str__(self):
        return f"{self.usuario.username} - {self.data.strftime('%d/%m/%Y')}"

    class Meta:
        verbose_name = "Relatório de Presença"
        verbose_name_plural = "Relatórios de Presença"
        ordering = ['-data']
        # Garante que só existe um relatório por usuário por dia
        unique_together = ['usuario', 'data']
