from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.utils import timezone
from django.core.files.base import ContentFile
import json
import zipfile
import os
import tempfile
from .models import Orgao, Produto, Material, DownloadsMaterial
from custom_tags_app.templatetags.permissionsacess import controle_acess

# Create your views here.

def processar_arquivo_para_zip(arquivo):
    """
    Processa um arquivo e o converte para ZIP se necessário
    Retorna o arquivo processado
    """
    try:
        # Se já é um arquivo ZIP, retorna como está
        if arquivo.name.lower().endswith('.zip'):
            return arquivo
        
        # Criar um arquivo ZIP temporário
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_zip:
            with zipfile.ZipFile(temp_zip, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                # Adicionar o arquivo original ao ZIP
                arquivo.seek(0)  # Volta para o início do arquivo
                zip_file.writestr(arquivo.name, arquivo.read())
            
            # Ler o conteúdo do ZIP criado
            temp_zip.seek(0)
            zip_content = open(temp_zip.name, 'rb').read()
            
            # Criar nome do arquivo ZIP
            nome_original = os.path.splitext(arquivo.name)[0]
            nome_zip = f"{nome_original}.zip"
            
            # Criar um novo arquivo Django com o conteúdo ZIP
            arquivo_zip = ContentFile(zip_content, name=nome_zip)
            
            # Limpar arquivo temporário
            os.unlink(temp_zip.name)
            
            return arquivo_zip
            
    except Exception as e:
        # Em caso de erro, retorna o arquivo original
        print(f"Erro ao processar arquivo para ZIP: {e}")
        return arquivo

# RENDERS - Apenas renderizam templates limpos
@controle_acess('SCT71')  # 71 – MARKETING | GERENCIADOR MATERIAIS
def render_addmateriais(request):
    """Renderiza a página de adicionar materiais"""
    return render(request, 'criativos/addmateriais.html')

@controle_acess('SCT70')  # 70 – MARKETING | BIBLIOTECA DE MATERIAIS
def render_materiais(request):
    """Renderiza a página de listagem de materiais"""
    return render(request, 'criativos/materiais.html')

@controle_acess('SCT72')  # 72 – MARKETING | DASHBOARD
def render_dashboard_materiais(request):
    """Renderiza a página de dashboard de materiais"""
    return render(request, 'criativos/dashboard.html')

# APIS GET - Retornam dados JSON para popular templates via jQuery

@login_required
@require_http_methods(["GET"])
def api_get_materiais(request):
    """
    API GET para buscar materiais com filtros e paginação
    Parâmetros via query string: page, search, produto_id, status, orgao_id
    """
    try:
        # Parâmetros de filtro
        page = request.GET.get('page', 1)
        search = request.GET.get('search', '').strip()
        produto_id = request.GET.get('produto_id', '')
        orgao_id = request.GET.get('orgao_id', '')
        status = request.GET.get('status', '')
        
        # Query base com select_related para incluir órgão
        materiais = Material.objects.select_related('produto__orgao').prefetch_related('downloads')
        
        # Aplicar filtros
        if search:
            materiais = materiais.filter(
                Q(titulo__icontains=search) | 
                Q(produto__titulo__icontains=search) |
                Q(produto__orgao__titulo__icontains=search)
            )
        
        if orgao_id:
            materiais = materiais.filter(produto__orgao_id=orgao_id)
        
        if produto_id:
            materiais = materiais.filter(produto_id=produto_id)
            
        if status != '':
            materiais = materiais.filter(status=bool(int(status)))
        
        # Ordenação
        materiais = materiais.order_by('-data_criacao')
        
        # Paginação (para materiais.html, vamos retornar todos se não especificar página)
        if page == 'all' or not page or page == '1' and not request.GET.get('per_page'):
            # Para a biblioteca de materiais, retornar todos
            materiais_queryset = materiais
            paginator = None
            page_obj = None
        else:
            # Para outras páginas com paginação
            paginator = Paginator(materiais, 12)
            page_obj = paginator.get_page(page)
            materiais_queryset = page_obj
        
        # Serializar dados
        materiais_data = []
        for material in materiais_queryset:
            total_downloads = DownloadsMaterial.contar_downloads_material(material.id)
            materiais_data.append({
                'id': material.id,
                'titulo': material.titulo,
                'produto': {
                    'id': material.produto.id,
                    'titulo': material.produto.titulo,
                    'orgao': {
                        'id': material.produto.orgao.id,
                        'titulo': material.produto.orgao.titulo
                    }
                },
                'banner_url': material.banner.url if material.banner else None,
                'arquivo_url': material.arquivo.url if material.arquivo else None,
                'arquivo_nome': material.arquivo.name.split('/')[-1] if material.arquivo else None,
                'data_criacao': material.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'status': material.status,
                'total_downloads': total_downloads
            })
        
        response_data = {
            'success': True,
            'materiais': materiais_data
        }
        
        # Adicionar informações de paginação se houver
        if paginator:
            response_data['pagination'] = {
                'current_page': page_obj.number,
                'total_pages': paginator.num_pages,
                'has_previous': page_obj.has_previous(),
                'has_next': page_obj.has_next(),
                'total_items': paginator.count
            }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao buscar materiais: {str(e)}'
        }, status=500)

@login_required
@require_http_methods(["GET"])
def api_get_infogeral(request):
    """
    API GET para informações gerais do dashboard
    Retorna estatísticas e dados para popular o template
    """
    try:
        # Estatísticas gerais
        total_orgaos = Orgao.objects.filter(status=True).count()
        total_produtos = Produto.objects.filter(status=True).count()
        total_materiais = Material.objects.filter(status=True).count()
        total_downloads = DownloadsMaterial.objects.filter(status=True).count()
        
        # Órgãos para dropdown/select
        orgaos = Orgao.objects.filter(status=True).order_by('titulo')
        orgaos_data = [
            {
                'id': orgao.id,
                'titulo': orgao.titulo,
                'total_produtos': orgao.produtos.filter(status=True).count()
            }
            for orgao in orgaos
        ]
        
        # Produtos para dropdown/select
        produtos = Produto.objects.filter(status=True).select_related('orgao').order_by('titulo')
        produtos_data = [
            {
                'id': produto.id,
                'titulo': produto.titulo,
                'orgao': {
                    'id': produto.orgao.id,
                    'titulo': produto.orgao.titulo
                },
                'total_materiais': produto.materiais.filter(status=True).count()
            }
            for produto in produtos
        ]
        
        # Materiais mais baixados (top 5)
        materiais_populares = DownloadsMaterial.materiais_mais_baixados(limite=5)
        
        # Downloads recentes (últimos 10)
        downloads_recentes = DownloadsMaterial.objects.filter(
            status=True
        ).select_related(
            'material', 'produto', 'usuario'
        ).order_by('-data')[:10]
        
        downloads_recentes_data = [
            {
                'material_titulo': download.material.titulo,
                'produto_titulo': download.produto.titulo,
                'usuario': download.usuario.get_full_name() or download.usuario.username,
                'data': download.data.strftime('%d/%m/%Y %H:%M')
            }
            for download in downloads_recentes
        ]
        
        return JsonResponse({
            'success': True,
            'estatisticas': {
                'total_orgaos': total_orgaos,
                'total_produtos': total_produtos,
                'total_materiais': total_materiais,
                'total_downloads': total_downloads
            },
            'orgaos': orgaos_data,
            'produtos': produtos_data,
            'materiais_populares': list(materiais_populares),
            'downloads_recentes': downloads_recentes_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao buscar informações gerais: {str(e)}'
        }, status=500)

@login_required
@require_http_methods(["GET"])
def api_get_orgaos(request):
    """
    API GET para buscar órgãos ativos
    """
    try:
        orgaos = Orgao.objects.filter(status=True).order_by('titulo')
        orgaos_data = [
            {
                'id': orgao.id,
                'titulo': orgao.titulo,
                'data_criacao': orgao.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'total_produtos': orgao.produtos.filter(status=True).count()
            }
            for orgao in orgaos
        ]
        
        return JsonResponse({
            'success': True,
            'orgaos': orgaos_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao buscar órgãos: {str(e)}'
        }, status=500)

@login_required
@require_http_methods(["GET"])
def api_get_material(request, material_id):
    """
    API GET para buscar dados de um material específico
    Usado para preencher o modal de edição
    """
    try:
        # Verificar se material existe
        try:
            material = Material.objects.select_related('produto').get(id=material_id)
        except Material.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Material não encontrado'
            }, status=404)
        
        # Serializar dados do material
        material_data = {
            'id': material.id,
            'titulo': material.titulo,
            'produto': {
                'id': material.produto.id,
                'titulo': material.produto.titulo
            },
            'banner_url': material.banner.url if material.banner else None,
            'arquivo_url': material.arquivo.url if material.arquivo else None,
            'arquivo_nome': material.arquivo.name.split('/')[-1] if material.arquivo else None,
            'data_criacao': material.data_criacao.strftime('%d/%m/%Y %H:%M'),
            'status': material.status
        }
        
        return JsonResponse({
            'success': True,
            'material': material_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao buscar material: {str(e)}'
        }, status=500)

@login_required
@require_http_methods(["GET"])
def api_get_dashboard_materiais(request):
    """
    API GET para dados do dashboard de materiais
    Retorna estatísticas completas e formatadas para o dashboard
    """
    try:
        from django.db.models import Count, Q
        from datetime import datetime, timedelta
        import calendar
        
        # ========================================
        # ESTATÍSTICAS GERAIS
        # ========================================
        total_orgaos = Orgao.objects.filter(status=True).count()
        total_produtos = Produto.objects.filter(status=True).count()
        total_materiais = Material.objects.filter(status=True).count()
        total_downloads = DownloadsMaterial.objects.filter(status=True).count()
        
        # ========================================
        # MATERIAIS POR STATUS
        # ========================================
        materiais_ativos = Material.objects.filter(status=True).count()
        materiais_inativos = Material.objects.filter(status=False).count()
        
        # ========================================
        # MATERIAIS POR ÓRGÃO
        # ========================================
        materiais_por_orgao = []
        orgaos = Orgao.objects.filter(status=True).annotate(
            total_materiais=Count('produtos__materiais', filter=Q(produtos__materiais__status=True))
        ).order_by('-total_materiais')[:5]  # Top 5 órgãos
        
        for orgao in orgaos:
            materiais_por_orgao.append({
                'id': orgao.id,
                'titulo': orgao.titulo,
                'total_materiais': orgao.total_materiais,
                'total_produtos': orgao.produtos.filter(status=True).count()
            })
        
        # ========================================
        # PRODUTOS MAIS ATIVOS
        # ========================================
        produtos_mais_ativos = []
        produtos = Produto.objects.filter(status=True).annotate(
            total_materiais=Count('materiais', filter=Q(materiais__status=True))
        ).select_related('orgao').order_by('-total_materiais')[:5]
        
        for produto in produtos:
            produtos_mais_ativos.append({
                'id': produto.id,
                'titulo': produto.titulo,
                'orgao': produto.orgao.titulo,
                'total_materiais': produto.total_materiais
            })
        
        # ========================================
        # MATERIAIS MAIS BAIXADOS
        # ========================================
        materiais_mais_baixados = []
        materiais_populares = Material.objects.filter(status=True).annotate(
            total_downloads=Count('downloads', filter=Q(downloads__status=True))
        ).select_related('produto__orgao').order_by('-total_downloads')[:5]
        
        for material in materiais_populares:
            materiais_mais_baixados.append({
                'id': material.id,
                'titulo': material.titulo,
                'produto': material.produto.titulo,
                'orgao': material.produto.orgao.titulo,
                'total_downloads': material.total_downloads
            })
        
        # ========================================
        # DOWNLOADS RECENTES
        # ========================================
        downloads_recentes = []
        downloads = DownloadsMaterial.objects.filter(
            status=True
        ).select_related('material', 'produto__orgao', 'usuario').order_by('-data')[:10]
        
        for download in downloads:
            downloads_recentes.append({
                'material_titulo': download.material.titulo,
                'produto_titulo': download.produto.titulo,
                'orgao_titulo': download.produto.orgao.titulo,
                'usuario': download.usuario.get_full_name() or download.usuario.username,
                'data': download.data.strftime('%d/%m/%Y %H:%M')
            })
        
        # ========================================
        # HISTÓRICO DE MATERIAIS (Últimos 6 meses)
        # ========================================
        historico_materiais = []
        data_atual = datetime.now()
        
        for i in range(5, -1, -1):  # Últimos 6 meses
            data_mes = data_atual - timedelta(days=30*i)
            ano = data_mes.year
            mes = data_mes.month
            
            materiais_mes = Material.objects.filter(
                data_criacao__year=ano,
                data_criacao__month=mes,
                status=True
            ).count()
            
            downloads_mes = DownloadsMaterial.objects.filter(
                data__year=ano,
                data__month=mes,
                status=True
            ).count()
            
            historico_materiais.append({
                'mes': calendar.month_name[mes][:3],  # Jan, Feb, Mar...
                'ano': ano,
                'materiais': materiais_mes,
                'downloads': downloads_mes
            })
        
        # ========================================
        # ESTATÍSTICAS DE CRESCIMENTO
        # ========================================
        mes_atual = datetime.now()
        mes_anterior = mes_atual - timedelta(days=30)
        
        materiais_este_mes = Material.objects.filter(
            data_criacao__year=mes_atual.year,
            data_criacao__month=mes_atual.month,
            status=True
        ).count()
        
        materiais_mes_passado = Material.objects.filter(
            data_criacao__year=mes_anterior.year,
            data_criacao__month=mes_anterior.month,
            status=True
        ).count()
        
        downloads_este_mes = DownloadsMaterial.objects.filter(
            data__year=mes_atual.year,
            data__month=mes_atual.month,
            status=True
        ).count()
        
        downloads_mes_passado = DownloadsMaterial.objects.filter(
            data__year=mes_anterior.year,
            data__month=mes_anterior.month,
            status=True
        ).count()
        
        # Calcular percentuais de crescimento
        crescimento_materiais = 0
        if materiais_mes_passado > 0:
            crescimento_materiais = ((materiais_este_mes - materiais_mes_passado) / materiais_mes_passado) * 100
        
        crescimento_downloads = 0
        if downloads_mes_passado > 0:
            crescimento_downloads = ((downloads_este_mes - downloads_mes_passado) / downloads_mes_passado) * 100
        
        # ========================================
        # RESPONSE FINAL
        # ========================================
        return JsonResponse({
            'success': True,
            'timestamp': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
            'estatisticas_gerais': {
                'total_orgaos': total_orgaos,
                'total_produtos': total_produtos,
                'total_materiais': total_materiais,
                'total_downloads': total_downloads
            },
            'materiais_status': {
                'ativos': materiais_ativos,
                'inativos': materiais_inativos
            },
            'crescimento': {
                'materiais_este_mes': materiais_este_mes,
                'materiais_mes_passado': materiais_mes_passado,
                'percentual_materiais': round(crescimento_materiais, 1),
                'downloads_este_mes': downloads_este_mes,
                'downloads_mes_passado': downloads_mes_passado,
                'percentual_downloads': round(crescimento_downloads, 1)
            },
            'materiais_por_orgao': materiais_por_orgao,
            'produtos_mais_ativos': produtos_mais_ativos,
            'materiais_mais_baixados': materiais_mais_baixados,
            'downloads_recentes': downloads_recentes,
            'historico_materiais': historico_materiais
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao buscar dados do dashboard: {str(e)}'
        }, status=500)

# APIS POST - Processam FormData e retornam JSON responses

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_post_material(request):
    """
    API POST para criar/editar materiais
    Recebe FormData com: titulo, produto_id, banner, arquivo, status, material_id (para edição)
    """
    try:
        # Verificar se é edição ou criação
        material_id = request.POST.get('material_id')
        is_edit = bool(material_id)
        
        # Validações básicas
        titulo = request.POST.get('titulo', '').strip()
        produto_id = request.POST.get('produto_id')
        status_raw = request.POST.get('status', '0')
        
        # Tratar valor do checkbox corretamente
        if status_raw in ['on', '1', 'true', 'True']:
            status = True
        else:
            status = False
        
        if not titulo:
            return JsonResponse({
                'success': False,
                'error': 'Título é obrigatório'
            }, status=400)
        
        if not produto_id:
            return JsonResponse({
                'success': False,
                'error': 'Produto é obrigatório'
            }, status=400)
        
        # Verificar se produto existe
        try:
            produto = Produto.objects.get(id=produto_id, status=True)
        except Produto.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Produto não encontrado'
            }, status=404)
        
        # Criar ou editar material
        if is_edit:
            try:
                material = Material.objects.get(id=material_id)
                action = 'editado'
            except Material.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'Material não encontrado'
                }, status=404)
        else:
            material = Material()
            action = 'criado'
        
        # Atualizar campos
        material.titulo = titulo
        material.produto = produto
        material.status = status
        
        # Processar arquivos
        if 'banner' in request.FILES:
            material.banner = request.FILES['banner']
        
        if 'arquivo' in request.FILES:
            # Processar arquivo (converter para ZIP se necessário)
            arquivo_processado = processar_arquivo_para_zip(request.FILES['arquivo'])
            material.arquivo = arquivo_processado
        elif not is_edit:  # Arquivo obrigatório apenas na criação
            return JsonResponse({
                'success': False,
                'error': 'Arquivo é obrigatório'
            }, status=400)
        
        material.save()
        
        return JsonResponse({
            'success': True,
            'message': f'Material {action} com sucesso!',
            'material': {
                'id': material.id,
                'titulo': material.titulo,
                'produto_titulo': material.produto.titulo,
                'banner_url': material.banner.url if material.banner else None,
                'arquivo_url': material.arquivo.url if material.arquivo else None,
                'status': material.status,
                'data_criacao': material.data_criacao.strftime('%d/%m/%Y %H:%M')
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao processar material: {str(e)}'
        }, status=500)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_post_download(request):
    """
    API POST para registrar download de material
    Recebe: material_id
    """
    try:
        material_id = request.POST.get('material_id')
        
        if not material_id:
            return JsonResponse({
                'success': False,
                'error': 'Material ID é obrigatório'
            }, status=400)
        
        # Verificar se material existe e está ativo
        try:
            material = Material.objects.get(id=material_id, status=True)
        except Material.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Material não encontrado ou inativo'
            }, status=404)
        
        # Registrar download
        download = DownloadsMaterial.objects.create(
            material=material,
            produto=material.produto,
            usuario=request.user,
            ip_usuario=request.META.get('REMOTE_ADDR'),
            data=timezone.now()
        )
        
        # Contar total de downloads do material
        total_downloads = DownloadsMaterial.contar_downloads_material(material_id)
        
        return JsonResponse({
            'success': True,
            'message': 'Download registrado com sucesso!',
            'download_url': material.arquivo.url,
            'total_downloads': total_downloads
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao registrar download: {str(e)}'
        }, status=500)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_post_produto(request):
    """
    API POST para criar novos produtos
    Recebe FormData com: titulo, orgao_id
    """
    try:
        # Validações básicas
        titulo = request.POST.get('titulo', '').strip()
        orgao_id = request.POST.get('orgao_id')
        
        if not titulo:
            return JsonResponse({
                'success': False,
                'error': 'Título é obrigatório'
            }, status=400)
        
        if not orgao_id:
            return JsonResponse({
                'success': False,
                'error': 'Órgão é obrigatório'
            }, status=400)
        
        # Verificar se órgão existe
        try:
            orgao = Orgao.objects.get(id=orgao_id, status=True)
        except Orgao.DoesNotExist:
            return JsonResponse({
                'success': False,
                'error': 'Órgão não encontrado'
            }, status=404)
        
        # Verificar se já existe produto com o mesmo título no mesmo órgão
        if Produto.objects.filter(titulo__iexact=titulo, orgao=orgao, status=True).exists():
            return JsonResponse({
                'success': False,
                'error': 'Já existe um produto com este título neste órgão'
            }, status=400)
        
        # Criar produto
        produto = Produto.objects.create(
            titulo=titulo,
            orgao=orgao,
            data_criacao=timezone.now(),
            status=True
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Produto criado com sucesso!',
            'produto': {
                'id': produto.id,
                'titulo': produto.titulo,
                'orgao': {
                    'id': produto.orgao.id,
                    'titulo': produto.orgao.titulo
                },
                'data_criacao': produto.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'status': produto.status
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao criar produto: {str(e)}'
        }, status=500)

@login_required
@csrf_exempt
@require_http_methods(["POST"])
def api_post_orgao(request):
    """
    API POST para criar novos órgãos
    Recebe FormData com: titulo
    """
    try:
        # Validações básicas
        titulo = request.POST.get('titulo', '').strip()
        
        if not titulo:
            return JsonResponse({
                'success': False,
                'error': 'Título é obrigatório'
            }, status=400)
        
        # Verificar se já existe órgão com o mesmo título
        if Orgao.objects.filter(titulo__iexact=titulo, status=True).exists():
            return JsonResponse({
                'success': False,
                'error': 'Já existe um órgão com este título'
            }, status=400)
        
        # Criar órgão
        orgao = Orgao.objects.create(
            titulo=titulo,
            data_criacao=timezone.now(),
            status=True
        )
        
        return JsonResponse({
            'success': True,
            'message': 'Órgão criado com sucesso!',
            'orgao': {
                'id': orgao.id,
                'titulo': orgao.titulo,
                'data_criacao': orgao.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'status': orgao.status
            }
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao criar órgão: {str(e)}'
        }, status=500)



