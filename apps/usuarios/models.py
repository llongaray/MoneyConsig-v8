from django.db import models
from django.contrib.auth.models import User
from django.core.validators import FileExtensionValidator

class Acesso(models.Model):
    CATEGORIA_APP      = 'CT'
    SUBCATEGORIA_RENDER = 'SCT'
    SESSAO_SECTION     = 'SS'
    SUBSESSAO_DIV      = 'SSS'
    CAIXA_BOX          = 'CX'
    TIPO_CHOICES = [
        (CATEGORIA_APP,       'Categoria - APP'),
        (SUBCATEGORIA_RENDER,  'SubCategoria - Render/Template'),
        (SESSAO_SECTION,       'Sessão - Section/Container'),
        (SUBSESSAO_DIV,        'SubSessão - Div/Content'),
        (CAIXA_BOX,            'Caixa - div/span/box/card'),
    ]

    nome          = models.CharField(max_length=100)
    tipo          = models.CharField(max_length=20, choices=TIPO_CHOICES)
    data_criacao  = models.DateTimeField(auto_now_add=True)
    status        = models.BooleanField(default=True)

    def __str__(self):
        return self.nome

    def gerar_codigo(self):
        return f"COD_{self.tipo}{self.id}"

class GroupsAcessos(models.Model):
    titulo        = models.CharField(max_length=100)
    acessos       = models.ManyToManyField(Acesso, related_name='groups_acessos')
    data_criacao  = models.DateTimeField(auto_now_add=True)
    status        = models.BooleanField(default=True)

    def __str__(self):
        return self.titulo

class ControleAcessos(models.Model):
    user          = models.ForeignKey(User, on_delete=models.CASCADE, related_name='controle_acessos')
    acessos       = models.ManyToManyField(Acesso, related_name='usuarios_controle')
    data_criacao  = models.DateTimeField(auto_now_add=True)
    status        = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.username} – {self.acessos.count()} acessos"

class AlertaTI(models.Model):
    """
    Modelo para armazenar alertas enviados pelo TI para os usuários.
    """
    mensagem = models.TextField(verbose_name="Mensagem")
    destinatarios = models.ManyToManyField(
        User,
        related_name='alertas_ti_recebidos',
        verbose_name="Destinatários"
    )
    audio = models.FileField(
        upload_to='alertas/audios/',
        verbose_name="Áudio de Alerta",
        validators=[
            FileExtensionValidator(allowed_extensions=['mp3', 'wav', 'ogg', 'mpeg', 'mpeg4'])
        ]
    )
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    ativo = models.BooleanField(default=True, verbose_name="Ativo")
    criado_por = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='alertas_ti_criados',
        verbose_name="Criado por"
    )

    def __str__(self):
        return f"Alerta TI - {self.data_criacao.strftime('%d/%m/%Y %H:%M')}"

    class Meta:
        verbose_name = "Alerta TI"
        verbose_name_plural = "Alertas TI"
        ordering = ['-data_criacao']

class AlertaTIVisto(models.Model):
    """
    Modelo para controlar quais alertas foram vistos por cada usuário
    """
    alerta = models.ForeignKey(AlertaTI, on_delete=models.CASCADE, related_name='vistos')
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='alertas_vistos')
    data_visualizacao = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['alerta', 'usuario']
        verbose_name = "Alerta TI Visto"
        verbose_name_plural = "Alertas TI Vistos"

class ConfiguracaoUsuario(models.Model):
    """
    Modelo para armazenar configurações personalizadas de cada usuário
    """
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='configuracao',
        verbose_name="Usuário"
    )
    modo_escuro = models.BooleanField(
        default=False, 
        verbose_name="Modo Escuro"
    )
    manter_menu_aberto = models.BooleanField(
        default=False, 
        verbose_name="Manter Menu Aberto"
    )
    data_atualizacao = models.DateTimeField(
        auto_now=True, 
        verbose_name="Última Atualização"
    )

    def __str__(self):
        return f"Configurações de {self.user.username}"

    class Meta:
        verbose_name = "Configuração do Usuário"
        verbose_name_plural = "Configurações dos Usuários"

