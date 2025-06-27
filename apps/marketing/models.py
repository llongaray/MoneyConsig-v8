from django.db import models
from django.utils import timezone
from django.contrib.auth.models import User

# Create your models here.
# Nota: Usando timezone.now() para compatibilidade com MySQL
# Configure no settings.py: USE_TZ = True e TIME_ZONE = 'America/Sao_Paulo'

class Orgao(models.Model):
    """
    Modelo para representar órgãos/empresas no sistema
    """
    titulo = models.CharField(max_length=200, verbose_name="Título")
    data_criacao = models.DateTimeField(
        default=timezone.now, 
        verbose_name="Data de Criação",
        help_text="Armazenada em UTC, exibida no timezone local"
    )
    status = models.BooleanField(default=True, verbose_name="Status Ativo")
    
    class Meta:
        verbose_name = "Órgão"
        verbose_name_plural = "Órgãos"
        ordering = ['-data_criacao']
    
    def __str__(self):
        return self.titulo


class Produto(models.Model):
    """
    Modelo para representar produtos disponíveis no sistema
    """
    titulo = models.CharField(max_length=200, verbose_name="Título")
    orgao = models.ForeignKey(
        Orgao, 
        on_delete=models.CASCADE, 
        related_name='produtos',
        verbose_name="Órgão"
    )
    data_criacao = models.DateTimeField(
        default=timezone.now, 
        verbose_name="Data de Criação",
        help_text="Armazenada em UTC, exibida no timezone local"
    )
    status = models.BooleanField(default=True, verbose_name="Status Ativo")
    
    class Meta:
        verbose_name = "Produto"
        verbose_name_plural = "Produtos"
        ordering = ['-data_criacao']
    
    def __str__(self):
        return f"{self.titulo} - {self.orgao.titulo}"


class Material(models.Model):
    """
    Modelo para materiais de marketing vinculados a produtos
    """
    titulo = models.CharField(max_length=200, verbose_name="Título")
    banner = models.ImageField(upload_to='marketing/banners/', verbose_name="Banner", blank=True, null=True)
    produto = models.ForeignKey(
        Produto, 
        on_delete=models.CASCADE, 
        related_name='materiais',
        verbose_name="Produto"
    )
    arquivo = models.FileField(upload_to='marketing/arquivos/', verbose_name="Arquivo")
    data_criacao = models.DateTimeField(
        default=timezone.now, 
        verbose_name="Data de Criação",
        help_text="Armazenada em UTC, exibida no timezone local"
    )
    status = models.BooleanField(default=True, verbose_name="Status Ativo")
    
    class Meta:
        verbose_name = "Material"
        verbose_name_plural = "Materiais"
        ordering = ['-data_criacao']
    
    def __str__(self):
        return f"{self.titulo} - {self.produto.titulo}"


class DownloadsMaterial(models.Model):
    """
    Modelo para registrar e contabilizar downloads realizados dos materiais
    Cada registro representa um download individual para fins de auditoria e estatísticas
    """
    material = models.ForeignKey(
        Material,
        on_delete=models.CASCADE,
        related_name='downloads',
        verbose_name="Material"
    )
    produto = models.ForeignKey(
        Produto,
        on_delete=models.CASCADE,
        related_name='downloads_realizados',
        verbose_name="Produto"
    )
    data = models.DateTimeField(
        default=timezone.now, 
        verbose_name="Data e Hora do Download",
        help_text="Timestamp UTC do download, exibido no timezone local"
    )
    # Campos adicionais para melhor rastreamento
    usuario = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='downloads_realizados',
        verbose_name="Usuário"
    )
    ip_usuario = models.GenericIPAddressField(verbose_name="IP do Usuário", blank=True, null=True)
    status = models.BooleanField(default=True, verbose_name="Download Válido")
    
    class Meta:
        verbose_name = "Registro de Download"
        verbose_name_plural = "Registros de Downloads"
        ordering = ['-data']
        # Índices para otimizar consultas de contagem
        indexes = [
            models.Index(fields=['material', 'data']),
            models.Index(fields=['produto', 'data']),
            models.Index(fields=['usuario', 'data']),
            models.Index(fields=['data']),
        ]
    
    def __str__(self):
        return f"Download: {self.material.titulo} por {self.usuario.username} em {self.data.strftime('%d/%m/%Y %H:%M')}"
    
    @classmethod
    def contar_downloads_material(cls, material_id):
        """
        Método para contar total de downloads de um material específico
        """
        return cls.objects.filter(material_id=material_id, status=True).count()
    
    @classmethod
    def contar_downloads_produto(cls, produto_id):
        """
        Método para contar total de downloads de todos os materiais de um produto
        """
        return cls.objects.filter(produto_id=produto_id, status=True).count()
    
    @classmethod
    def contar_downloads_usuario(cls, usuario_id):
        """
        Método para contar total de downloads realizados por um usuário específico
        """
        return cls.objects.filter(usuario_id=usuario_id, status=True).count()
    
    @classmethod
    def materiais_mais_baixados(cls, limite=10):
        """
        Retorna os materiais mais baixados com contagem
        """
        from django.db.models import Count
        return cls.objects.filter(status=True).values(
            'material__titulo'
        ).annotate(
            total_downloads=Count('id')
        ).order_by('-total_downloads')[:limite]
