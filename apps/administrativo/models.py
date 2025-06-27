from django.db import models

# Create your models here.
class ControleCampanha(models.Model):
    CATEGORIA_CHOICES = [
        ('GERAL', 'Geral'),
        ('EMPRESA', 'Empresa'),
        ('DEPARTAMENTO', 'Departamento'),
        ('SETOR', 'Setor'),
        ('LOJA', 'Loja'),
        ('EQUIPE', 'Equipe'),
        ('CARGO', 'Cargo'),
    ]
    
    titulo = models.CharField(max_length=100, verbose_name="Título da Campanha")
    banner = models.ImageField(upload_to='banners_campanhas/', verbose_name="Banner da Campanha")
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name="Data de Criação")
    data_inicio = models.DateField(verbose_name="Data de Início")
    hora_inicio = models.TimeField(verbose_name="Hora de Início")
    data_final = models.DateField(verbose_name="Data Final")
    hora_final = models.TimeField(verbose_name="Hora Final")
    categoria = models.CharField(max_length=12, choices=CATEGORIA_CHOICES, default='GERAL', verbose_name="Categoria")
    
    # Relacionamentos ManyToMany
    empresas = models.ManyToManyField('funcionarios.Empresa', blank=True, verbose_name="Empresas")
    departamentos = models.ManyToManyField('funcionarios.Departamento', blank=True, verbose_name="Departamentos")
    setores = models.ManyToManyField('funcionarios.Setor', blank=True, verbose_name="Setores")
    lojas = models.ManyToManyField('funcionarios.Loja', blank=True, verbose_name="Lojas")
    equipes = models.ManyToManyField('funcionarios.Equipe', blank=True, verbose_name="Equipes")
    cargos = models.ManyToManyField('funcionarios.Cargo', blank=True, verbose_name="Cargos")
    
    status = models.BooleanField(default=True, verbose_name="Status Ativo")

    def __str__(self):
        return f"{self.titulo} - {self.get_categoria_display()} - {'Ativa' if self.status else 'Inativa'}"

    class Meta:
        verbose_name = "Controle de Campanha"
        verbose_name_plural = "Controles de Campanhas"
        ordering = ['-data_criacao']
