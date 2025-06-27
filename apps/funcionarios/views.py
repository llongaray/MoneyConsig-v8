# Python standard library imports
import csv
import io
import json
import logging
import os
import traceback
import zipfile
from datetime import date, datetime, timedelta, time
from decimal import Decimal, InvalidOperation

# Third-party imports (Django)
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group, User
from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.db.models.fields.files import FileField, ImageField
from django.http import Http404, HttpResponse, JsonResponse, FileResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.utils.text import slugify
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie, csrf_protect

from custom_tags_app.templatetags.permissionsacess import controle_acess
from django.views.decorators.http import require_GET, require_http_methods, require_POST

# Local application/library specific imports
from setup.utils import verificar_autenticacao
from .forms import *  # TODO: Considerar importações específicas em vez de '*'
from .models import *  # TODO: Considerar importações específicas em vez de '*'
from apps.siape.models import * # <<< ADICIONAR IMPORT
# Nota: O código original também importava especificamente Comissionamento, Empresa, Departamento, Setor, Equipe de .models.
# Usar 'from .models import *' cobre estes, mas importações específicas são geralmente preferidas para clareza.


# Configuração do logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

# ----- Views de Renderização -----
from custom_tags_app.templatetags.permissionsacess import controle_acess


@login_required
@controle_acess('SCT15')   # 15 – RECURSOS HUMANOS | ADMINISTRATIVO
def render_administrativo(request):
    """Renderiza a página de cadastros administrativos."""
    logger.debug("Iniciando render_administrativo")
    return render(request, 'funcionarios/forms/administrativo.html', {})

@login_required
@controle_acess('SCT13')   # 13 – RECURSOS HUMANOS | NOVO FUNCIONARIO
def render_novofuncionario(request):
    """Renderiza o formulário para criar um novo funcionário."""
    logger.debug("Iniciando render_novofuncionario")
    return render(request, 'funcionarios/forms/novo_funcionario.html', {})

@login_required
@controle_acess('SCT14')   # 14 – RECURSOS HUMANOS | EDITAR FUNCIONARIO
@ensure_csrf_cookie
def render_editfuncionario(request):
    """Renderiza a página para editar funcionários."""
    logger.debug("Iniciando render_editfuncionario")
    return render(request, 'funcionarios/forms/edit_funcionario.html', {})

@login_required
@controle_acess('SCT12')   # 12 – RECURSOS HUMANOS | DASHBOARD
def render_dashboard(request):
    """Renderiza a página do dashboard de funcionários."""
    logger.debug("Iniciando render_dashboard")
    return render(request, 'funcionarios/forms/dashboard.html', {})



# ----- Views de API (JSON) -----

@require_GET
#@login_required # Ou seu decorador, APIs também devem ser protegidas
def api_get_infogeral(request):
    """Retorna informações gerais sobre entidades administrativas em JSON."""
    print("\n----- Iniciando api_get_infogeral -----")
    try:
        # Obtém os choices da hierarquia
        hierarquia_choices = [{'value': value, 'display': display} for value, display in Cargo.HierarquiaChoices.choices]

        # Obtém os cargos formatados
        cargos_formatados = []
        for cargo in Cargo.objects.filter(status=True).select_related('empresa'):
            cargos_formatados.append({
                'id': cargo.id,
                'nome': cargo.nome,
                'empresa_id': cargo.empresa_id,
                'empresa__nome': cargo.empresa.nome,
                'hierarquia': cargo.hierarquia,
                # Cria um campo combinado para exibição no select
                'nome_com_hierarquia': f"{cargo.nome} ({cargo.get_hierarquia_display()})"
            })

        # Obtém os horários formatados
        horarios_formatados = []
        for horario in HorarioTrabalho.objects.filter(status=True):
             horarios_formatados.append({
                 'id': horario.id,
                 'nome': horario.nome,
                 'entrada': horario.entrada.strftime('%H:%M') if horario.entrada else None,
                 'saida_almoco': horario.saida_almoco.strftime('%H:%M') if horario.saida_almoco else None,
                 'volta_almoco': horario.volta_almoco.strftime('%H:%M') if horario.volta_almoco else None,
                 'saida': horario.saida.strftime('%H:%M') if horario.saida else None,
                 # Adiciona texto pré-formatado para o select
                 'display_text': f"{horario.nome} ({horario.entrada.strftime('%H:%M') if horario.entrada else 'N/A'} - {horario.saida.strftime('%H:%M') if horario.saida else 'N/A'})"
             })


        data = {
            'empresas': list(Empresa.objects.filter(status=True).values('id', 'nome', 'cnpj', 'endereco')),
            'lojas': list(Loja.objects.filter(status=True).values('id', 'nome', 'empresa_id', 'empresa__nome', 'franquia', 'filial')),
            'departamentos': list(Departamento.objects.filter(status=True).values('id', 'nome', 'empresa_id', 'empresa__nome')),
            'setores': list(Setor.objects.filter(status=True).values('id', 'nome', 'departamento_id', 'departamento__nome')),
            # Usa a lista formatada de cargos
            'cargos': cargos_formatados,
            # Usa a lista formatada de horários
            'horarios': horarios_formatados,
            #'horarios': list(HorarioTrabalho.objects.filter(status=True).values('id', 'nome', 'entrada', 'saida_almoco', 'volta_almoco', 'saida')),
            'equipes': list(Equipe.objects.filter(status=True).values('id', 'nome')),
            'hierarquia_choices': hierarquia_choices, # Mantém para o form administrativo
            'tipo_contrato_choices': [{'value': value, 'display': display} for value, display in Funcionario.TipoContratoChoices.choices],
        }
        print("Dados gerais (incluindo cargos e horários formatados) coletados para API.")
        return JsonResponse(data)
    except Exception as e:
        print(f"Erro em api_get_infogeral: {e}")
        return JsonResponse({'error': f'Erro ao buscar informações gerais: {e}'}, status=500)


@require_GET
def api_get_infogeralemp(request):
    """
    Retorna todos os dados relacionados (empresas, departamentos, setores, lojas, equipes, cargos, horários)
    de forma estruturada, mantendo as relações entre eles.
    """
    try:
        # Busca todas as empresas
        empresas = Empresa.objects.filter(status=True).order_by('nome')
        
        data = {
            'empresas': []
        }
        
        for empresa in empresas:
            empresa_data = {
                'id': empresa.id,
                'nome': empresa.nome,
                'departamentos': [],
                'lojas': [],
                'cargos': [],
                'horarios': []
            }
            
            # Busca departamentos da empresa
            departamentos = Departamento.objects.filter(empresa=empresa, status=True).order_by('nome')
            for departamento in departamentos:
                dept_data = {
                    'id': departamento.id,
                    'nome': departamento.nome,
                    'setores': []
                }
                
                # Busca setores do departamento
                setores = Setor.objects.filter(departamento=departamento, status=True).order_by('nome')
                for setor in setores:
                    dept_data['setores'].append({
                        'id': setor.id,
                        'nome': setor.nome
                    })
                
                empresa_data['departamentos'].append(dept_data)
            
            # Busca lojas da empresa
            print(f"Buscando lojas para empresa {empresa.id} - {empresa.nome}")
            lojas = Loja.objects.filter(empresa=empresa, status=True).order_by('nome')
            print(f"Lojas encontradas: {lojas.count()}")
            for loja in lojas:
                print(f"Adicionando loja: {loja.id} - {loja.nome}")
                empresa_data['lojas'].append({
                    'id': loja.id,
                    'nome': loja.nome,
                    'franquia': loja.franquia,
                    'filial': loja.filial
                })
            
            # Busca cargos da empresa
            cargos = Cargo.objects.filter(empresa=empresa, status=True).order_by('nome')
            for cargo in cargos:
                empresa_data['cargos'].append({
                    'id': cargo.id,
                    'nome': cargo.nome,
                    'hierarquia': cargo.hierarquia,
                    'hierarquia_display': cargo.get_hierarquia_display()
                })
            
            # Busca horários ativos
            horarios = HorarioTrabalho.objects.filter(status=True).order_by('nome')
            for horario in horarios:
                empresa_data['horarios'].append({
                    'id': horario.id,
                    'nome': horario.nome,
                    'entrada': horario.entrada.strftime('%H:%M') if horario.entrada else None,
                    'saida_almoco': horario.saida_almoco.strftime('%H:%M') if horario.saida_almoco else None,
                    'volta_almoco': horario.volta_almoco.strftime('%H:%M') if horario.volta_almoco else None,
                    'saida': horario.saida.strftime('%H:%M') if horario.saida else None
                })
            
            data['empresas'].append(empresa_data)
        
        # Busca equipes ativas (não vinculadas a empresa)
        equipes = Equipe.objects.filter(status=True).order_by('nome')
        data['equipes'] = [{'id': equipe.id, 'nome': equipe.nome} for equipe in equipes]
        
        return JsonResponse(data)
    
    except Exception as e:
        print(f"Erro em api_get_infogeralemp: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)

@require_GET
def api_get_infocardsnovo(request):
    """
    API que retorna a quantidade de funcionários ativos e inativos para exibição nos cards.
    Retorna: JSON com 'qtd_ativos' e 'qtd_inativos'
    """
    print("\n----- Iniciando api_get_infocardsnovo -----")
    try:
        # Conta funcionários ativos
        qtd_ativos = Funcionario.objects.filter(status=True).count()
        print(f"Quantidade de funcionários ativos: {qtd_ativos}")
        
        # Conta funcionários inativos
        qtd_inativos = Funcionario.objects.filter(status=False).count()
        print(f"Quantidade de funcionários inativos: {qtd_inativos}")
        
        # Prepara os dados para retorno
        data = {
            'qtd_ativos': qtd_ativos,
            'qtd_inativos': qtd_inativos
        }
        
        print("Dados dos cards coletados com sucesso.")
        return JsonResponse(data)
    except Exception as e:
        print(f"Erro ao buscar dados para cards: {e}")
        return JsonResponse({'error': f'Erro ao buscar informações dos cards: {e}'}, status=500)




@require_GET
#@login_required
def api_get_infofuncionarios(request):
    """Retorna a lista de todos os funcionários em JSON."""
    print("\n----- Iniciando api_get_infofuncionarios -----")
    try:
        funcionarios = Funcionario.objects.select_related(
            'empresa', 'departamento', 'setor', 'cargo', 'horario', 'equipe', 'usuario'
        ).all()

        data = []
        for f in funcionarios:
            funcionario_data = {
                'id': f.id,
                'apelido': f.apelido,
                'nome_completo': f.nome_completo,
                'cpf': f.cpf,
                'data_nascimento': f.data_nascimento.strftime('%d/%m/%Y') if f.data_nascimento else None, # Exemplo de formatação
                'status': f.status,
                'empresa_id': f.empresa_id,
                'empresa_nome': f.empresa.nome if f.empresa else None,
                'departamento_id': f.departamento_id,
                'departamento_nome': f.departamento.nome if f.departamento else None,
                'setor_id': f.setor_id,
                'setor_nome': f.setor.nome if f.setor else None,
                'cargo_id': f.cargo_id,
                'cargo_nome': f.cargo.nome if f.cargo else None,
                'horario_id': f.horario_id,
                'horario_nome': f.horario.nome if f.horario else None,
                'equipe_id': f.equipe_id,
                'equipe_nome': f.equipe.nome if f.equipe else None,
                'matricula': f.matricula,
                'pis': f.pis,
                'data_admissao': f.data_admissao.strftime('%d/%m/%Y') if f.data_admissao else None,
                'data_demissao': f.data_demissao.strftime('%d/%m/%Y') if f.data_demissao else None,
                'foto_url': f.foto.url if f.foto else None,
                'usuario_id': f.usuario.id if f.usuario else None,
                'usuario_username': f.usuario.username if f.usuario else None,
                # Adicione outros campos conforme necessário
            }
            data.append(funcionario_data)

        print(f"{len(data)} funcionários coletados para API.")
        return JsonResponse(data, safe=False) # safe=False para permitir lista no JSON root
    except Exception as e:
        print(f"Erro em api_get_infofuncionarios: {e}")
        return JsonResponse({'error': f'Erro ao buscar lista de funcionários: {e}'}, status=500)

from django.http import FileResponse

@require_GET
def download_arquivo_funcionario(request, arquivo_id):
    """
    Força o download do arquivo do funcionário, enviando Content-Disposition: attachment.
    """
    from .models import ArquivoFuncionario
    arquivo_obj = get_object_or_404(ArquivoFuncionario, pk=arquivo_id, status=True)
    # abre o arquivo em modo binário
    fp = arquivo_obj.arquivo.open('rb')
    filename = os.path.basename(arquivo_obj.arquivo.name)
    response = FileResponse(fp, as_attachment=True, filename=filename)
    return response

@require_GET
def api_get_funcionario(request, funcionario_id):
    """Retorna dados detalhados de um funcionário específico em JSON, incluindo nomes relacionados."""
    print(f"\n----- Iniciando api_get_funcionario para ID: {funcionario_id} -----")
    try:
        funcionario = get_object_or_404(Funcionario.objects.select_related(
            'empresa', 'departamento', 'setor', 'cargo', 'horario', 'equipe', 'usuario'
        ).prefetch_related('lojas', 'arquivos', 'regras_comissionamento'), pk=funcionario_id)
        
        data = {
            'id': funcionario.id,
            'nome_completo': funcionario.nome_completo,
            'apelido': funcionario.apelido,
            'cpf': funcionario.cpf,
            'matricula': funcionario.matricula,
            'pis': funcionario.pis,
            'data_nascimento': funcionario.data_nascimento.strftime('%Y-%m-%d') if funcionario.data_nascimento else None,
            'genero': funcionario.genero,
            'estado_civil': funcionario.estado_civil,
            'celular1': funcionario.celular1,
            'celular2': funcionario.celular2,
            'cep': funcionario.cep,
            'endereco': funcionario.endereco,
            'bairro': funcionario.bairro,
            'cidade': funcionario.cidade,
            'estado': funcionario.estado,
            'nome_mae': funcionario.nome_mae,
            'nome_pai': funcionario.nome_pai,
            'nacionalidade': funcionario.nacionalidade,
            'naturalidade': funcionario.naturalidade,
            'empresa_id': funcionario.empresa.id if funcionario.empresa else None,
            'empresa_nome': funcionario.empresa.nome if funcionario.empresa else None,
            'lojas': [{'id': loja.id, 'nome': loja.nome} for loja in funcionario.lojas.all()],
            'departamento_id': funcionario.departamento.id if funcionario.departamento else None,
            'departamento_nome': funcionario.departamento.nome if funcionario.departamento else None,
            'setor_id': funcionario.setor.id if funcionario.setor else None,
            'setor_nome': funcionario.setor.nome if funcionario.setor else None,
            'cargo_id': funcionario.cargo.id if funcionario.cargo else None,
            'cargo_nome': funcionario.cargo.nome if funcionario.cargo else None,
            'horario_id': funcionario.horario.id if funcionario.horario else None,
            'horario_nome': funcionario.horario.nome if funcionario.horario else None,
            'equipe_id': funcionario.equipe.id if funcionario.equipe else None,
            'equipe_nome': funcionario.equipe.nome if funcionario.equipe else None,
            'status': funcionario.status,
            'tipo_contrato': funcionario.tipo_contrato, # Adicionado tipo_contrato
            'data_admissao': funcionario.data_admissao.strftime('%Y-%m-%d') if funcionario.data_admissao else None,
            'data_demissao': funcionario.data_demissao.strftime('%Y-%m-%d') if funcionario.data_demissao else None,
            'foto_url': funcionario.foto.url if funcionario.foto else None,
            'usuario_id': funcionario.usuario.id if funcionario.usuario else None,
            'usuario_username': funcionario.usuario.username if funcionario.usuario else None,
            # Adiciona os arquivos do funcionário
            'arquivos': [
                {
                    'id': arquivo.id,
                    'titulo': arquivo.titulo,
                    'descricao': arquivo.descricao or '',
                    'nome_arquivo': arquivo.arquivo.name.split('/')[-1] if arquivo.arquivo else '',
                    'download_url': arquivo.arquivo.url if arquivo.arquivo else None,
                    'data_upload': arquivo.data_upload.strftime('%Y-%m-%d %H:%M:%S') if arquivo.data_upload else None,
                }
                for arquivo in funcionario.arquivos.filter(status=True)
            ],
            # Adiciona as regras de comissionamento
            'regras_comissionamento': [
                {
                    'id': regra.id,
                    'titulo': regra.titulo
                }
                for regra in funcionario.regras_comissionamento.filter(status=True)
            ],
        }
        print("Dados do funcionário serializados:", data)
        return JsonResponse(data)
    except Exception as e:
        print(f"Erro em api_get_funcionario: {str(e)}")
        print("Erro detalhado em api_get_funcionario")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)

@require_GET
#@login_required
def api_get_userFuncionario(request, user_id):
    """Retorna dados do funcionário associado a um User ID específico em JSON."""
    print(f"\n----- Iniciando api_get_userFuncionario para User ID: {user_id} -----")
    try:
        # Busca o usuário
        user = get_object_or_404(User, pk=user_id)
        print(f"Usuário '{user.username}' encontrado.")

        # Tenta buscar o funcionário relacionado
        try:
            # Acessa via related_name 'funcionario_profile' definido no OneToOneField
            funcionario = Funcionario.objects.select_related(
                'empresa', 'departamento', 'setor', 'cargo', 'horario', 'equipe', 'usuario', 'loja'
            ).get(usuario=user)
            print(f"Funcionário associado '{funcionario.nome_completo}' encontrado.")

            # Serializa os dados do funcionário (similar a api_get_funcionario)
            data = {
                'id': funcionario.id,
                'apelido': funcionario.apelido,
                'nome_completo': funcionario.nome_completo,
                'cpf': funcionario.cpf,
                'data_nascimento': funcionario.data_nascimento,
                'genero': funcionario.genero,
                'estado_civil': funcionario.estado_civil,
                'cep': funcionario.cep,
                'endereco': funcionario.endereco,
                'bairro': funcionario.bairro,
                'cidade': funcionario.cidade,
                'estado': funcionario.estado,
                'celular1': funcionario.celular1,
                'celular2': funcionario.celular2,
                'nome_mae': funcionario.nome_mae,
                'nome_pai': funcionario.nome_pai,
                'nacionalidade': funcionario.nacionalidade,
                'naturalidade': funcionario.naturalidade,
                'matricula': funcionario.matricula,
                'pis': funcionario.pis,
                'empresa_id': funcionario.empresa_id,
                'loja_id': funcionario.loja_id,
                'departamento_id': funcionario.departamento_id,
                'setor_id': funcionario.setor_id,
                'cargo_id': funcionario.cargo_id,
                'horario_id': funcionario.horario_id,
                'equipe_id': funcionario.equipe_id,
                'status': funcionario.status,
                'tipo_contrato': funcionario.tipo_contrato, # Adicionado tipo_contrato
                'data_admissao': funcionario.data_admissao,
                'data_demissao': funcionario.data_demissao,
                'foto_url': funcionario.foto.url if funcionario.foto else None,
                'usuario_id': funcionario.usuario_id, # Já temos o user_id
                 # Adicione nomes relacionados se necessário
            }
            print("Dados do funcionário associado serializados.")
            return JsonResponse(data)

        except Funcionario.DoesNotExist:
            print("Nenhum funcionário encontrado para este usuário.")
            return JsonResponse({'error': 'Nenhum funcionário associado a este usuário.'}, status=404)

    except Http404:
        print(f"Erro: Usuário com ID {user_id} não encontrado.")
        return JsonResponse({'error': 'Usuário não encontrado'}, status=404)
    except Exception as e:
        print(f"Erro em api_get_userFuncionario: {e}")
        return JsonResponse({'error': f'Erro ao buscar funcionário pelo usuário: {e}'}, status=500)

@require_POST
def api_post_userfuncionario(request):
    """
    API para criar um User e um Funcionario associado a partir de dados multipart/form-data.
    Espera campos normais em request.POST e o arquivo 'foto' em request.FILES.
    """
    print("\n----- Iniciando api_post_userfuncionario (multipart/form-data) -----")
    print("Dados POST:", request.POST)
    print("Arquivos FILES:", request.FILES)

    # 1. Extrair dados básicos
    apelido = request.POST.get('apelido')
    nome_completo = request.POST.get('nome_completo')
    print(f"Apelido recebido: {apelido}")
    print(f"Nome completo recebido: {nome_completo}")
    
    if not apelido or not nome_completo:
        print("Erro: Apelido e Nome Completo são obrigatórios.")
        return JsonResponse({'error': 'Apelido e Nome Completo são obrigatórios.'}, status=400)

    username = apelido.lower().replace(' ', '_')
    ano_atual = timezone.now().year
    password = f"Money@{ano_atual}"
    print(f"Username gerado: {username}")
    print(f"Senha gerada: {password}")

    partes_nome = nome_completo.split(' ', 1)
    first_name = partes_nome[0]
    last_name = partes_nome[1] if len(partes_nome) > 1 else ''
    print(f"First name: {first_name}, Last name: {last_name}")

    # 2. Verifica obrigatórios do funcionário
    required = ['cpf', 'data_nascimento', 'empresa', 'departamento', 'setor', 'cargo']
    missing = [f for f in required if not request.POST.get(f)]
    if missing:
        print(f"Campos obrigatórios faltando: {', '.join(missing)}")
        return JsonResponse({'error': f"Campos faltando: {', '.join(missing)}"}, status=400)

    # 3. Formatar CPF
    cpf_raw = request.POST['cpf']
    cpf_formatado = ''.join(filter(str.isdigit, cpf_raw))
    print(f"CPF raw: {cpf_raw}, CPF formatado: {cpf_formatado}")

    # 4. Arquivo de foto (opcional)
    foto_file = request.FILES.get('foto')
    print(f"Arquivo de foto recebido: {foto_file}")

    try:
        with transaction.atomic():
            print("Iniciando transação atômica")
            
            # 5. Criar User
            try:
                print("Criando usuário...")
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                )
                print(f"Usuário criado com sucesso. ID: {user.id}")
            except IntegrityError:
                print(f"Erro: Username '{username}' já existe.")
                return JsonResponse({'error': f"Username '{username}' já existe."}, status=400)

            # 6. Resgatar FK obrigatórias
            print("Resgatando FKs obrigatórias...")
            empresa = get_object_or_404(Empresa, pk=request.POST['empresa'])
            departamento = get_object_or_404(Departamento, pk=request.POST['departamento'])
            setor = get_object_or_404(Setor, pk=request.POST['setor'])
            cargo = get_object_or_404(Cargo, pk=request.POST['cargo'])
            print("FKs obrigatórias resgatadas com sucesso")

            # 7. Campos FK opcionais
            print("Processando FKs opcionais...")
            horario_pk = request.POST.get('horario')
            horario = HorarioTrabalho.objects.filter(pk=horario_pk).first() if horario_pk else None
            print(f"Horario: {horario}")

            equipe_pk = request.POST.get('equipe')
            equipe = Equipe.objects.filter(pk=equipe_pk).first() if equipe_pk else None
            print(f"Equipe: {equipe}")

            # 8. Converter data de nascimento
            try:
                data_nasc = datetime.strptime(request.POST['data_nascimento'], '%Y-%m-%d').date()
                print(f"Data de nascimento convertida: {data_nasc}")
            except (ValueError, TypeError):
                print("Erro: Formato inválido para data_nascimento")
                raise ValidationError("Formato inválido para data_nascimento. Use YYYY-MM-DD.")

            # 9. Criar Funcionario
            print("Criando funcionário...")
            funcionario = Funcionario.objects.create(
                usuario=user,
                apelido=apelido,
                nome_completo=nome_completo,
                cpf=cpf_formatado,
                data_nascimento=data_nasc,
                foto=foto_file,
                empresa=empresa,
                departamento=departamento,
                setor=setor,
                cargo=cargo,
                horario=horario,
                equipe=equipe,
                genero=request.POST.get('genero'),
                estado_civil=request.POST.get('estado_civil'),
                cep=request.POST.get('cep'),
                endereco=request.POST.get('endereco'),
                bairro=request.POST.get('bairro'),
                cidade=request.POST.get('cidade'),
                estado=request.POST.get('estado'),
                celular1=request.POST.get('celular1'),
                celular2=request.POST.get('celular2'),
                nome_mae=request.POST.get('nome_mae'),
                nome_pai=request.POST.get('nome_pai'),
                nacionalidade=request.POST.get('nacionalidade'),
                naturalidade=request.POST.get('naturalidade'),
                matricula=request.POST.get('matricula'),
                pis=request.POST.get('pis'),
            )

            # Adicionar lojas selecionadas
            lojas_ids = request.POST.getlist('lojas')
            if lojas_ids:
                print(f"Adicionando lojas: {lojas_ids}")
                funcionario.lojas.set(lojas_ids)
                print(f"Lojas adicionadas com sucesso ao funcionário {funcionario.id}")

            print(f"Funcionário criado com sucesso. ID: {funcionario.id}")

        # 10. Resposta de sucesso
        print("Processo concluído com sucesso")
        return JsonResponse({
            'message': (
                f"Usuário '{username}' criado com sucesso!\n"
                f"Funcionario ID: {funcionario.id}\n"
                f"User ID: {user.id}"
            )
        }, status=201)

    except ValidationError as e:
        print(f"Erro de validação: {e}")
        return JsonResponse({'error': str(e)}, status=400)
    except Exception as e:
        print(f"Erro inesperado em api_post_userfuncionario: {e}")
        traceback.print_exc()
        return JsonResponse({'error': 'Erro interno no servidor.'}, status=500)

# ----- Views de API POST para Cadastros Administrativos -----

# @csrf_exempt # Usar com cautela
@require_POST
#@login_required # Adicione decoradores de permissão se necessário (ex: is_rh_or_superuser)
def api_post_empresa(request):
    """API para criar uma nova Empresa."""
    print("\n----- Iniciando api_post_empresa -----")
    data = request.POST
    print("Dados recebidos:", data)

    nome = data.get('nome')
    cnpj = data.get('cnpj')
    endereco = data.get('endereco')
    status = data.get('status') == 'on' # Checkbox/Switch envia 'on' se marcado

    if not all([nome, cnpj, endereco]):
        return JsonResponse({'error': 'Nome, CNPJ e Endereço são obrigatórios.'}, status=400)

    try:
        empresa = Empresa.objects.create(
            nome=nome,
            cnpj=cnpj,
            endereco=endereco,
            status=status
        )
        print(f"Empresa '{empresa.nome}' criada com ID: {empresa.id}")
        return JsonResponse({'message': f'Empresa "{empresa.nome}" criada com sucesso!', 'id': empresa.id}, status=201)
    except IntegrityError as e:
         print(f"Erro de integridade: {e}")
         # Verificar se é erro de CNPJ único
         if 'cnpj' in str(e).lower():
             return JsonResponse({'error': 'Já existe uma empresa com este CNPJ.'}, status=400)
         return JsonResponse({'error': f'Erro de integridade ao criar empresa: {e}'}, status=400)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        return JsonResponse({'error': f'Erro interno ao criar empresa: {e}'}, status=500)

# @csrf_exempt
@require_POST
#@login_required # Adicione decoradores de permissão
def api_post_loja(request):
    """API para criar uma nova Loja."""
    print("\n----- Iniciando api_post_loja -----")
    data = request.POST
    files = request.FILES
    print("Dados POST:", data)
    print("Arquivos FILES:", files)

    nome = data.get('nome')
    empresa_id = data.get('empresa')
    logo_file = files.get('logo')
    franquia = data.get('franquia') == 'on'
    filial = data.get('filial') == 'on'
    status = data.get('status') == 'on'

    if not nome or not empresa_id:
        return JsonResponse({'error': 'Nome da loja e Empresa são obrigatórios.'}, status=400)

    if franquia and filial:
        return JsonResponse({'error': 'Uma loja não pode ser Franquia e Filial ao mesmo tempo.'}, status=400)

    try:
        empresa = get_object_or_404(Empresa, pk=empresa_id)
        loja = Loja.objects.create(
            nome=nome,
            empresa=empresa,
            logo=logo_file, # Passa o arquivo diretamente
            franquia=franquia,
            filial=filial,
            status=status
        )
        print(f"Loja '{loja.nome}' criada com ID: {loja.id}")
        return JsonResponse({'message': f'Loja "{loja.nome}" criada com sucesso!', 'id': loja.id}, status=201)
    except Empresa.DoesNotExist:
         return JsonResponse({'error': 'Empresa selecionada não encontrada.'}, status=400)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        return JsonResponse({'error': f'Erro interno ao criar loja: {e}'}, status=500)

# @csrf_exempt
@require_POST
#@login_required # Adicione decoradores de permissão
def api_post_departamento(request):
    """API para criar um novo Departamento."""
    print("\n----- Iniciando api_post_departamento -----")
    data = request.POST
    print("Dados recebidos:", data)

    nome = data.get('nome')
    empresa_id = data.get('empresa')
    status = data.get('status') == 'on'

    if not nome or not empresa_id:
        return JsonResponse({'error': 'Nome do departamento e Empresa são obrigatórios.'}, status=400)

    try:
        empresa = get_object_or_404(Empresa, pk=empresa_id)
        departamento = Departamento.objects.create(
            nome=nome,
            empresa=empresa,
            status=status
        )
        print(f"Departamento '{departamento.nome}' criado com ID: {departamento.id}")
        return JsonResponse({'message': f'Departamento "{departamento.nome}" criado com sucesso!', 'id': departamento.id}, status=201)
    except Empresa.DoesNotExist:
         return JsonResponse({'error': 'Empresa selecionada não encontrada.'}, status=400)
    except IntegrityError:
         return JsonResponse({'error': f'Já existe um departamento com o nome "{nome}" nesta empresa.'}, status=400)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        return JsonResponse({'error': f'Erro interno ao criar departamento: {e}'}, status=500)

# @csrf_exempt
@require_POST
#@login_required # Adicione decoradores de permissão
def api_post_setor(request):
    """API para criar um novo Setor."""
    print("\n----- Iniciando api_post_setor -----")
    data = request.POST
    print("Dados recebidos:", data)

    nome = data.get('nome')
    departamento_id = data.get('departamento')
    status = data.get('status') == 'on'

    if not nome or not departamento_id:
        return JsonResponse({'error': 'Nome do setor e Departamento são obrigatórios.'}, status=400)

    try:
        departamento = get_object_or_404(Departamento, pk=departamento_id)
        setor = Setor.objects.create(
            nome=nome,
            departamento=departamento,
            status=status
        )
        print(f"Setor '{setor.nome}' criado com ID: {setor.id}")
        return JsonResponse({'message': f'Setor "{setor.nome}" criado com sucesso!', 'id': setor.id}, status=201)
    except Departamento.DoesNotExist:
         return JsonResponse({'error': 'Departamento selecionado não encontrado.'}, status=400)
    except IntegrityError:
         return JsonResponse({'error': f'Já existe um setor com o nome "{nome}" neste departamento.'}, status=400)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        return JsonResponse({'error': f'Erro interno ao criar setor: {e}'}, status=500)


# @csrf_exempt
@require_POST
#@login_required # Adicione decoradores de permissão
def api_post_equipe(request):
    """API para criar uma nova Equipe."""
    print("\n----- Iniciando api_post_equipe -----")
    data = request.POST
    print("Dados recebidos:", data)

    nome = data.get('nome')
    status = data.get('status') == 'on'
    participantes_ids = data.getlist('participantes') # Use getlist para campos multiple select

    if not nome:
        return JsonResponse({'error': 'Nome da equipe é obrigatório.'}, status=400)

    try:
        with transaction.atomic():
            equipe = Equipe.objects.create(
                nome=nome,
                status=status
            )
            print(f"Equipe '{equipe.nome}' criada com ID: {equipe.id}")

            if participantes_ids:
                participantes = User.objects.filter(pk__in=participantes_ids, is_active=True)
                equipe.participantes.set(participantes) # Usa set() para M2M
                print(f"Associados {participantes.count()} participantes.")

            return JsonResponse({'message': f'Equipe "{equipe.nome}" criada com sucesso!', 'id': equipe.id}, status=201)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        return JsonResponse({'error': f'Erro interno ao criar equipe: {e}'}, status=500)

# @csrf_exempt
@require_POST
#@login_required # Adicione decoradores de permissão
def api_post_cargo(request):
    """API para criar um novo Cargo."""
    print("\n----- Iniciando api_post_cargo -----")
    data = request.POST
    print("Dados recebidos:", data)

    nome = data.get('nome')
    empresa_id = data.get('empresa')
    hierarquia = data.get('hierarquia')
    status = data.get('status') == 'on'

    if not nome or not empresa_id or hierarquia is None: # Verifica se hierarquia foi enviado
        return JsonResponse({'error': 'Nome do cargo, Empresa e Nível Hierárquico são obrigatórios.'}, status=400)

    try:
        # Validar se hierarquia é um número válido e está nos choices
        hierarquia_int = int(hierarquia)
        if hierarquia_int not in Cargo.HierarquiaChoices.values:
             return JsonResponse({'error': 'Nível Hierárquico inválido.'}, status=400)

        empresa = get_object_or_404(Empresa, pk=empresa_id)
        cargo = Cargo.objects.create(
            nome=nome,
            empresa=empresa,
            hierarquia=hierarquia_int,
            status=status
        )
        print(f"Cargo '{cargo.nome}' criado com ID: {cargo.id}")
        return JsonResponse({'message': f'Cargo "{cargo.nome}" criado com sucesso!', 'id': cargo.id}, status=201)
    except Empresa.DoesNotExist:
         return JsonResponse({'error': 'Empresa selecionada não encontrada.'}, status=400)
    except ValueError:
        return JsonResponse({'error': 'Nível Hierárquico deve ser um número.'}, status=400)
    except IntegrityError:
         return JsonResponse({'error': f'Já existe um cargo com o nome "{nome}" nesta empresa.'}, status=400)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        return JsonResponse({'error': f'Erro interno ao criar cargo: {e}'}, status=500)

# @csrf_exempt
@require_POST
#@login_required # Adicione decoradores de permissão
def api_post_horario(request):
    """API para criar um novo HorarioTrabalho."""
    print("\n----- Iniciando api_post_horario -----")
    data = request.POST
    print("Dados recebidos:", data)

    nome = data.get('nome')
    entrada = data.get('entrada')
    saida_almoco = data.get('saida_almoco')
    volta_almoco = data.get('volta_almoco')
    saida = data.get('saida')
    status = data.get('status') == 'on'

    if not all([nome, entrada, saida_almoco, volta_almoco, saida]):
        return JsonResponse({'error': 'Nome e todos os campos de horário (entrada, saída almoço, volta almoço, saída) são obrigatórios.'}, status=400)

    try:
        # Validação básica do formato do tempo (HH:MM) pode ser adicionada aqui se necessário
        horario = HorarioTrabalho.objects.create(
            nome=nome,
            entrada=entrada,
            saida_almoco=saida_almoco,
            volta_almoco=volta_almoco,
            saida=saida,
            status=status
        )
        print(f"Horário '{horario.nome}' criado com ID: {horario.id}")
        return JsonResponse({'message': f'Horário "{horario.nome}" criado com sucesso!', 'id': horario.id}, status=201)
    except IntegrityError:
         return JsonResponse({'error': f'Já existe um horário com o nome "{nome}".'}, status=400)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        return JsonResponse({'error': f'Erro interno ao criar horário: {e}'}, status=500)

# ----- API POST para Editar Funcionário -----

@require_POST
@login_required
def api_edit_funcionario(request):
    """
    Edita um Funcionario existente, atualiza todos os campos (exceto CPF),
    faz parsing de datas YYYY-MM-DD, trata FKs e salva novos ArquivoFuncionario.
    """
    print("\n[EDITFUNC] ----- Iniciando api_edit_funcionario -----")
    print("[EDITFUNC] Content-Type:", request.content_type)
    print("[EDITFUNC] POST data:", request.POST)
    print("[EDITFUNC] FILES:", request.FILES)

    # 1) carrega dados JSON ou form-data
    if request.content_type.startswith('application/json'):
        try:
            data = json.loads(request.body)
            print("[EDITFUNC] Dados JSON carregados:", data)
        except json.JSONDecodeError:
            print("[EDITFUNC] Erro ao decodificar JSON")
            return JsonResponse({'error': 'JSON inválido.'}, status=400)
        files = {}
    else:
        data = request.POST
        files = request.FILES
        print("[EDITFUNC] Dados form-data carregados")

    func_id = data.get('funcionario_id')
    if not func_id:
        print("[EDITFUNC] funcionario_id não fornecido")
        return JsonResponse({'error': 'funcionario_id é obrigatório.'}, status=400)

    print(f"[EDITFUNC] Buscando funcionário com ID {func_id}")
    funcionario = get_object_or_404(Funcionario, pk=func_id)

    try:
        with transaction.atomic():
            print("[EDITFUNC] Iniciando transação atômica")
            
            # 2) campos simples (exceto cpf)
            simples = (
                'apelido','nome_completo','genero','estado_civil',
                'cep','endereco','bairro','cidade','estado',
                'celular1','celular2','nome_mae','nome_pai',
                'nacionalidade','naturalidade','matricula','pis',
                'tipo_contrato'
            )
            for f in simples:
                if f in data:
                    val = data.get(f).strip()
                    print(f"[EDITFUNC] Atualizando campo {f}: {val}")
                    setattr(funcionario, f, val or None)

            # status
            if 'status' in data:
                status_val = data.get('status') in ('on','true',True,'True')
                print(f"[EDITFUNC] Atualizando status: {status_val}")
                funcionario.status = status_val
                # Atualiza o status do usuário Django associado
                if funcionario.usuario:
                    funcionario.usuario.is_active = status_val
                    funcionario.usuario.save()

            # 3) datas
            for f in ('data_nascimento','data_admissao','data_demissao'):
                if f in data:
                    s = data.get(f).strip()
                    if s:
                        try:
                            print(f"[EDITFUNC] Atualizando data {f}: {s}")
                            setattr(funcionario, f, datetime.strptime(s, '%Y-%m-%d').date())
                        except ValueError:
                            print(f"[EDITFUNC] Formato inválido para {f}: {s}")
                            return JsonResponse(
                                {'error': f'Formato inválido para {f}. Use YYYY-MM-DD.'},
                                status=400
                            )
                    else:
                        print(f"[EDITFUNC] Limpando campo de data {f}")
                        setattr(funcionario, f, None)

            # 4) FKs
            fk_map = {
                'empresa': Empresa, 'departamento': Departamento,
                'setor': Setor, 'cargo': Cargo,
                'horario': HorarioTrabalho, 'equipe': Equipe
            }

            for f, model in fk_map.items():
                if f in data:
                    val = data.get(f).strip()
                    if val:
                        try:
                            print(f"[EDITFUNC] Atualizando FK {f} com ID {val}")
                            setattr(funcionario, f, model.objects.get(pk=val))
                        except model.DoesNotExist:
                            print(f"[EDITFUNC] {f.title()} não encontrado com ID {val}")
                            return JsonResponse(
                                {'error': f'{f.title()} não encontrado.'},
                                status=400
                            )
                    else:
                        print(f"[EDITFUNC] Limpando FK {f}")
                        setattr(funcionario, f, None)

            # Atualizar lojas
            lojas_ids = data.getlist('edit_lojas')
            if lojas_ids:
                print(f"[EDITFUNC] Atualizando lojas com IDs {lojas_ids}")
                funcionario.lojas.clear()
                funcionario.lojas.add(*lojas_ids)

            # 5) foto
            if 'foto' in files:
                print("[EDITFUNC] Atualizando foto do funcionário")
                novo = files['foto']
                if funcionario.foto:
                    funcionario.foto.delete(save=False)
                funcionario.foto = novo
            elif data.get('foto_clear') in ('on','true','True'):
                print("[EDITFUNC] Removendo foto do funcionário")
                if funcionario.foto:
                    funcionario.foto.delete(save=False)
                    funcionario.foto = None

            # 6) validação e save principal
            print("[EDITFUNC] Validando e salvando funcionário")
            funcionario.full_clean(exclude=['regras_comissionamento'])
            funcionario.save()

            # 7) upload de novos ArquivoFuncionario
            titulos = request.POST.getlist('arquivo_titulos[]')
            descrs  = request.POST.getlist('arquivo_descricoes[]')
            arquivos= request.FILES.getlist('arquivo_files[]')
            print(f"[EDITFUNC] Processando {len(arquivos)} arquivos anexados")
            for titulo, arquivo_file, descricao in zip(titulos, arquivos, descrs):
                t = titulo.strip()
                if t and arquivo_file:
                    print(f"[EDITFUNC] Criando arquivo anexo: {t}")
                    ArquivoFuncionario.objects.create(
                        funcionario=funcionario,
                        titulo=t,
                        descricao=descricao.strip() or '',
                        arquivo=arquivo_file
                    )

        print("[EDITFUNC] Funcionário atualizado com sucesso")
        return JsonResponse({'message': 'Funcionário e arquivos atualizados com sucesso.'})

    except IntegrityError as e:
        msg = str(e)
        if 'cpf' in msg.lower(): msg = 'CPF já em uso.'
        if 'matricula' in msg.lower(): msg = 'Matrícula já em uso.'
        print(f"[EDITFUNC] Erro de integridade: {msg}")
        return JsonResponse({'error': msg}, status=400)

    except ValidationError as e:
        print(f"[EDITFUNC] Erro de validação: {e.message_dict}")
        return JsonResponse({'error': 'Erro de validação.', 'details': e.message_dict}, status=400)

    except Exception:
        print("[EDITFUNC] Erro interno no servidor")
        import traceback; traceback.print_exc()
        return JsonResponse({'error': 'Erro interno no servidor.'}, status=500)

# ----- API POST para Desativar Funcionário (Soft Delete) -----



@require_GET
def api_get_comissao(request):
    """
    API para retornar dados necessários para formulários de comissionamento,
    incluindo regras de comissionamento ativas e listas de entidades
    (Empresas, Departamentos, Setores, Equipes) para seleção.
    """
    try:
        # Busca regras de comissionamento ativas (ID e Título)
        regras_comissionamento = list(Comissionamento.objects.filter(status=True).values('id', 'titulo').order_by('titulo'))

        # Busca Empresas ativas (ID e Nome)
        empresas = list(Empresa.objects.filter(status=True).values('id', 'nome').order_by('nome'))

        # Busca Departamentos ativos (ID, Nome, Empresa ID)
        departamentos = list(Departamento.objects.filter(status=True).values('id', 'nome', 'empresa_id').order_by('empresa__nome', 'nome'))

        # Busca Setores ativos (ID, Nome, Departamento ID)
        setores = list(Setor.objects.filter(status=True).values('id', 'nome', 'departamento_id').order_by('departamento__nome', 'nome'))

        # Busca Equipes ativas (ID e Nome)
        equipes = list(Equipe.objects.filter(status=True).values('id', 'nome').order_by('nome'))

        # Busca Lojas ativas (ID, Nome, Empresa ID)
        lojas = list(Loja.objects.filter(status=True).values('id', 'nome', 'empresa_id').order_by('empresa__nome', 'nome'))

        # Monta o dicionário de resposta
        data = {
            'regras_comissionamento': regras_comissionamento,
            'empresas': empresas,
            'departamentos': departamentos,
            'setores': setores,
            'equipes': equipes,
            'lojas': lojas,
        }

        return JsonResponse(data)

    except Exception as e:
        # Log do erro (substituir print por logger em produção)
        import traceback
        tb_str = traceback.format_exc()
        print(f"Erro ao buscar dados para formulário de comissionamento: {e}\n{tb_str}")
        # logger.exception("Erro ao buscar dados para formulário de comissionamento")
        return JsonResponse({'error': 'Erro interno ao buscar dados necessários.'}, status=500)


@csrf_exempt # Remover em produção se usar autenticação de sessão e AJAX configurado corretamente
@require_POST
@transaction.atomic # Garante que a criação e a adição de M2M sejam atômicas
def api_post_novaregracomissao(request):
    """
    API para criar uma nova regra de comissionamento via POST (JSON).
    Espera um corpo JSON com os dados da regra, incluindo listas de IDs para campos ManyToMany.
    Exemplo de JSON esperado:
    {
        "titulo": "Comissão Vendas Loja X",
        "escopo_base": "PESSOAL",
        "percentual": "5.50",
        "valor_fixo": null,
        "valor_de": null,
        "valor_ate": null,
        "data_inicio": "2024-01-01",
        "data_fim": null,
        "status": true,
        "empresas": [1, 2],
        "departamentos": [3],
        "setores": [],
        "equipes": [5],
        "lojas": [6]
    }
    """
    try:
        data = json.loads(request.body)

        # --- Extração e Validação de Dados ---
        titulo = data.get('titulo')
        escopo_base = data.get('escopo_base')
        percentual_str = data.get('percentual')
        valor_fixo_str = data.get('valor_fixo')
        valor_de_str = data.get('valor_de')
        valor_ate_str = data.get('valor_ate')
        data_inicio_str = data.get('data_inicio')
        data_fim_str = data.get('data_fim')
        status = data.get('status', True) # Default para True se não fornecido

        # Validações básicas de campos obrigatórios
        if not titulo:
            return JsonResponse({'error': 'O campo "titulo" é obrigatório.'}, status=400)
        if not escopo_base or escopo_base not in Comissionamento.EscopoBaseComissaoChoices.values:
             valid_choices = ", ".join(Comissionamento.EscopoBaseComissaoChoices.values)
             return JsonResponse({'error': f'O campo "escopo_base" é obrigatório e deve ser um dos seguintes: {valid_choices}.'}, status=400)

        # Conversão e validação de campos numéricos (Decimal)
        percentual = None
        if percentual_str is not None and percentual_str != '':
            try:
                percentual = Decimal(percentual_str)
            except InvalidOperation:
                return JsonResponse({'error': 'Valor inválido para "percentual". Use formato numérico (ex: 5.50).'}, status=400)

        valor_fixo = None
        if valor_fixo_str is not None and valor_fixo_str != '':
            try:
                valor_fixo = Decimal(valor_fixo_str)
            except InvalidOperation:
                return JsonResponse({'error': 'Valor inválido para "valor_fixo". Use formato numérico (ex: 100.00).'}, status=400)

        valor_de = None
        if valor_de_str is not None and valor_de_str != '':
            try:
                valor_de = Decimal(valor_de_str)
            except InvalidOperation:
                return JsonResponse({'error': 'Valor inválido para "valor_de". Use formato numérico.'}, status=400)

        valor_ate = None
        if valor_ate_str is not None and valor_ate_str != '':
            try:
                valor_ate = Decimal(valor_ate_str)
            except InvalidOperation:
                return JsonResponse({'error': 'Valor inválido para "valor_ate". Use formato numérico.'}, status=400)

        # Conversão e validação de datas
        data_inicio = None
        if data_inicio_str:
            data_inicio = parse_date(data_inicio_str)
            if not data_inicio:
                return JsonResponse({'error': 'Formato inválido para "data_inicio". Use AAAA-MM-DD.'}, status=400)

        data_fim = None
        if data_fim_str:
            data_fim = parse_date(data_fim_str)
            if not data_fim:
                return JsonResponse({'error': 'Formato inválido para "data_fim". Use AAAA-MM-DD.'}, status=400)

        # --- Criação da Instância ---
        nova_regra = Comissionamento(
            titulo=titulo,
            escopo_base=escopo_base,
            percentual=percentual,
            valor_fixo=valor_fixo,
            valor_de=valor_de,
            valor_ate=valor_ate,
            data_inicio=data_inicio,
            data_fim=data_fim,
            status=status
        )

        # Executa validações do modelo (método clean)
        try:
            nova_regra.full_clean(exclude=['empresas', 'departamentos', 'setores', 'equipes', 'lojas']) # Exclui M2M da validação inicial
        except ValidationError as e:
            print(f"Erro de validação ao criar regra de comissão: {e.message_dict}") # Substituído logger.warning por print
            return JsonResponse({'error': 'Erro de validação.', 'details': e.message_dict}, status=400)

        # Salva o objeto principal primeiro
        nova_regra.save()

        # --- Processamento dos Campos ManyToMany ---
        m2m_errors = {}

        # Empresas
        empresa_ids = data.get('empresas', [])
        if isinstance(empresa_ids, list):
            try:
                empresas_objs = Empresa.objects.filter(id__in=empresa_ids)
                if len(empresas_objs) != len(empresa_ids):
                     m2m_errors['empresas'] = 'Uma ou mais IDs de Empresa fornecidas são inválidas.'
                else:
                     nova_regra.empresas.set(empresas_objs)
            except Exception as e:
                 m2m_errors['empresas'] = f'Erro ao processar Empresas: {e}'
        elif empresa_ids:
             m2m_errors['empresas'] = 'O campo "empresas" deve ser uma lista de IDs.'

        # Departamentos
        departamento_ids = data.get('departamentos', [])
        if isinstance(departamento_ids, list):
            try:
                departamentos_objs = Departamento.objects.filter(id__in=departamento_ids)
                if len(departamentos_objs) != len(departamento_ids):
                    m2m_errors['departamentos'] = 'Uma ou mais IDs de Departamento fornecidas são inválidas.'
                else:
                    nova_regra.departamentos.set(departamentos_objs)
            except Exception as e:
                m2m_errors['departamentos'] = f'Erro ao processar Departamentos: {e}'
        elif departamento_ids:
            m2m_errors['departamentos'] = 'O campo "departamentos" deve ser uma lista de IDs.'

        # Setores
        setor_ids = data.get('setores', [])
        if isinstance(setor_ids, list):
            try:
                setores_objs = Setor.objects.filter(id__in=setor_ids)
                if len(setores_objs) != len(setor_ids):
                    m2m_errors['setores'] = 'Uma ou mais IDs de Setor fornecidas são inválidas.'
                else:
                    nova_regra.setores.set(setores_objs)
            except Exception as e:
                m2m_errors['setores'] = f'Erro ao processar Setores: {e}'
        elif setor_ids:
            m2m_errors['setores'] = 'O campo "setores" deve ser uma lista de IDs.'

        # Equipes
        equipe_ids = data.get('equipes', [])
        if isinstance(equipe_ids, list):
            try:
                equipes_objs = Equipe.objects.filter(id__in=equipe_ids)
                if len(equipes_objs) != len(equipe_ids):
                    m2m_errors['equipes'] = 'Uma ou mais IDs de Equipe fornecidas são inválidas.'
                else:
                    nova_regra.equipes.set(equipes_objs)
            except Exception as e:
                m2m_errors['equipes'] = f'Erro ao processar Equipes: {e}'
        elif equipe_ids:
            m2m_errors['equipes'] = 'O campo "equipes" deve ser uma lista de IDs.'

        # Lojas
        loja_ids = data.get('lojas', [])
        if isinstance(loja_ids, list):
            try:
                lojas_objs = Loja.objects.filter(id__in=loja_ids)
                if len(lojas_objs) != len(loja_ids):
                    m2m_errors['lojas'] = 'Uma ou mais IDs de Loja fornecidas são inválidas.'
                else:
                    nova_regra.lojas.set(lojas_objs)
            except Exception as e:
                m2m_errors['lojas'] = f'Erro ao processar Lojas: {e}'
        elif loja_ids:
            m2m_errors['lojas'] = 'O campo "lojas" deve ser uma lista de IDs.'

        # Se houve erros nos M2M, retorna o erro (a transação será revertida)
        if m2m_errors:
             print(f"Erro ao processar M2M para nova regra de comissão: {m2m_errors}") # Substituído logger.warning por print
             # A transação será revertida automaticamente ao levantar a exceção ou retornar erro
             return JsonResponse({'error': 'Erro ao processar relações ManyToMany.', 'details': m2m_errors}, status=400)

        # Executa validações novamente, agora incluindo M2M (se houver validações dependentes)
        try:
            nova_regra.full_clean()
        except ValidationError as e:
            print(f"Erro de validação final (com M2M) ao criar regra: {e.message_dict}") # Substituído logger.warning por print
            # A transação será revertida
            return JsonResponse({'error': 'Erro de validação final.', 'details': e.message_dict}, status=400)


        print(f"Nova regra de comissionamento '{nova_regra.titulo}' (ID: {nova_regra.id}) criada com sucesso.") # Substituído logger.info por print
        return JsonResponse({
            'message': 'Nova regra de comissionamento criada com sucesso!',
            'comissao_id': nova_regra.id
        }, status=201) # 201 Created

    except json.JSONDecodeError:
        print("Erro ao decodificar JSON na criação de regra de comissão.") # Substituído logger.error por print
        return JsonResponse({'error': 'JSON inválido no corpo da requisição.'}, status=400)
    except IntegrityError as e:
        print(f"Erro de integridade ao criar regra de comissão: {e}") # Substituído logger.error por print
        return JsonResponse({'error': f'Erro de integridade: {e}'}, status=400)
    except Exception as e:
        import traceback
        print(f"Erro inesperado ao criar nova regra de comissionamento: {e}\n{traceback.format_exc()}") # Substituído logger.exception por print com traceback
        return JsonResponse({'error': f'Erro interno no servidor: {e}'}, status=500)

# ----- API POST para Produto -----

# @csrf_exempt # Usar com cautela
@require_POST
#@login_required # Adicione decoradores de permissão se necessário (ex: is_rh_or_superuser)
def api_post_novoproduto(request):
    """API para criar um novo Produto."""
    print("\n----- Iniciando api_post_novoproduto -----")
    data = request.POST
    print("Dados recebidos:", data)

    nome = data.get('nome')
    descricao = data.get('descricao', '') # Descrição é opcional
    status = data.get('status') == 'on' # Checkbox/Switch envia 'on' se marcado

    if not nome:
        return JsonResponse({'error': 'Nome do Produto é obrigatório.'}, status=400)

    try:
        produto = Produto.objects.create(
            nome=nome.upper(), # Salvar nome em maiúsculas, por exemplo
            descricao=descricao,
            ativo=status # O nome do campo no modelo é 'ativo'
        )
        print(f"Produto '{produto.nome}' criado com ID: {produto.id}")
        return JsonResponse({'message': f'Produto "{produto.nome}" criado com sucesso!', 'id': produto.id}, status=201)
    except IntegrityError:
         # O modelo Produto tem unique=True no nome
         return JsonResponse({'error': f'Já existe um produto com o nome "{nome.upper()}".'}, status=400)
    except Exception as e:
        print(f"Erro inesperado ao criar produto: {e}")
        # logger.exception("Erro inesperado ao criar produto") # Se usar logger
        return JsonResponse({'error': f'Erro interno ao criar produto: {e}'}, status=500)


# ----- Views e API para o Dashboard de Funcionários -----



@require_GET
@login_required
def api_get_dashboard(request):
    """
    API que retorna dados agregados para o dashboard de funcionários,
    incluindo a lista de aniversariantes do mês.
    """
    try:
        hoje = timezone.now().date()
        mes_atual = hoje.month
        dia_atual = hoje.day

        # --- Dados Gerais de RH ---
        total_ativos = Funcionario.objects.filter(status=True).count()
        total_inativos = Funcionario.objects.filter(status=False).count()

        admin_counts = {
            'empresas': Empresa.objects.filter(status=True).count(),
            'lojas_sede': Loja.objects.filter(status=True, filial=False, franquia=False).count(),
            'lojas_filial': Loja.objects.filter(status=True, filial=True).count(),
            'lojas_franquia': Loja.objects.filter(status=True, franquia=True).count(),
            'departamentos': Departamento.objects.filter(status=True).count(),
            'setores': Setor.objects.filter(status=True).count(),
            'cargos': Cargo.objects.filter(status=True).count(),
            'equipes': Equipe.objects.filter(status=True).count(),
        }

        # --- Distribuição de Funcionários ---
        ativos_qs = Funcionario.objects.filter(status=True)
        from django.db.models import Count
        cargos_ativos = ativos_qs.values('cargo__nome').annotate(total=Count('id')).order_by('-total')
        funcionarios_distribuicao = {
            'geral': {
                'ativos': total_ativos,
                'inativos': total_inativos,
            },
            'por_empresa': list(ativos_qs.values('empresa__nome').annotate(total=Count('id')).order_by('empresa__nome')),
            'por_loja':    list(ativos_qs.exclude(lojas__isnull=True)
                                   .values('lojas__nome').annotate(total=Count('id')).order_by('lojas__nome')),
            'por_departamento': list(ativos_qs.values('departamento__nome')
                                     .annotate(total=Count('id')).order_by('departamento__nome')),
            'por_setor': list(ativos_qs.values('setor__nome')
                              .annotate(total=Count('id')).order_by('setor__nome')),
            'por_cargo': list(cargos_ativos),
            'por_equipe': list(ativos_qs.exclude(equipe__isnull=True)
                               .values('equipe__nome').annotate(total=Count('id')).order_by('equipe__nome')),
        }

        # --- Aniversariantes do Mês ---
        # Removido filtro status=True para não excluir aniversariantes inativos
        aniversariantes_qs = Funcionario.objects.filter(
            data_nascimento__month=mes_atual
        ).select_related('departamento', 'setor').order_by('data_nascimento__day')

        aniversariantes_list = []
        for f in aniversariantes_qs:
            dia_aniv = f.data_nascimento.day
            if dia_aniv == dia_atual:
                status = "Dia de comemorar"
            elif dia_aniv > dia_atual:
                status = "Quase lá"
            else:
                status = "Já foi"

            aniversariantes_list.append({
                'nome': f.nome_completo,
                'departamento': f.departamento.nome if f.departamento else 'N/A',
                'setor': f.setor.nome if f.setor else 'N/A',
                'data': f.data_nascimento.strftime('%d/%m'),
                'status': status,
                'dia': dia_aniv,  # Mantemos o dia caso queira ordenar ou usar no frontend
            })

        # Log de depuração
        print(f"Aniversariantes mês {mes_atual}: {len(aniversariantes_list)} encontrado(s).")

        response = {
            'admin_rh': admin_counts,
            'funcionarios': funcionarios_distribuicao,
            'aniversariantes': aniversariantes_list,
            'timestamp': timezone.now().isoformat(),
        }
        return JsonResponse(response)

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"Erro em api_get_dashboard: {e}\n{tb}")
        return JsonResponse({'error': f'Erro interno ao buscar dados do dashboard: {e}'}, status=500)



# SUB CATEGORIA: COMUNICADOS - INICIO

@login_required
@controle_acess('SCT54')   # 54 – RECURSOS HUMANOS | COMUNICADOS
def render_formscomunicados(request):
    """Renderiza o formulário para criar novos comunicados."""
    return render(request, 'funcionarios/forms/formscomunicados.html')

@login_required
@controle_acess('SCT54')   # 16 – RECURSOS HUMANOS | COMUNICADOS
@require_POST
def api_post_addcomunicados(request):
    """
    API para criar um novo comunicado.
    Aceita dados via form-data, incluindo arquivos e banner.
    """
    try:
        # Validação dos campos obrigatórios
        assunto = request.POST.get('assunto')
        texto = request.POST.get('texto', '')
        banner = request.FILES.get('banner')
        destinatarios_data = json.loads(request.POST.get('destinatarios', '{}'))

        if not assunto:
            return JsonResponse({
                'status': 'error',
                'message': 'O assunto é obrigatório.'
            }, status=400)

        if not texto and not banner:
            return JsonResponse({
                'status': 'error',
                'message': 'O comunicado deve ter texto ou banner.'
            }, status=400)

        if texto and banner:
            return JsonResponse({
                'status': 'error',
                'message': 'O comunicado não pode ter texto e banner simultaneamente.'
            }, status=400)

        # Cria o comunicado
        comunicado = Comunicado(
            assunto=assunto,
            texto=texto,
            criado_por=request.user
        )

        if banner:
            comunicado.banner = banner

        comunicado.full_clean()  # Valida o modelo
        comunicado.save()

        # Processa os destinatários por categoria
        usuarios_ids = set()  # Usa set para evitar duplicatas

        # Processa empresas
        if 'empresas' in destinatarios_data and destinatarios_data['empresas']:
            funcionarios = Funcionario.objects.filter(
                empresa_id__in=destinatarios_data['empresas'],
                usuario__isnull=False
            ).values_list('usuario_id', flat=True)
            usuarios_ids.update(funcionarios)

        # Processa departamentos
        if 'departamentos' in destinatarios_data and destinatarios_data['departamentos']:
            funcionarios = Funcionario.objects.filter(
                departamento_id__in=destinatarios_data['departamentos'],
                usuario__isnull=False
            ).values_list('usuario_id', flat=True)
            usuarios_ids.update(funcionarios)

        # Processa setores
        if 'setores' in destinatarios_data and destinatarios_data['setores']:
            funcionarios = Funcionario.objects.filter(
                setor_id__in=destinatarios_data['setores'],
                usuario__isnull=False
            ).values_list('usuario_id', flat=True)
            usuarios_ids.update(funcionarios)

        # Processa lojas
        if 'lojas' in destinatarios_data and destinatarios_data['lojas']:
            funcionarios = Funcionario.objects.filter(
                loja_id__in=destinatarios_data['lojas'],
                usuario__isnull=False
            ).values_list('usuario_id', flat=True)
            usuarios_ids.update(funcionarios)

        # Processa equipes
        if 'equipes' in destinatarios_data and destinatarios_data['equipes']:
            funcionarios = Funcionario.objects.filter(
                equipe_id__in=destinatarios_data['equipes'],
                usuario__isnull=False
            ).values_list('usuario_id', flat=True)
            usuarios_ids.update(funcionarios)

        # Processa funcionários individuais
        if 'funcionarios' in destinatarios_data and destinatarios_data['funcionarios']:
            usuarios_ids.update(destinatarios_data['funcionarios'])

        # Verifica se há destinatários
        if not usuarios_ids:
            return JsonResponse({
                'status': 'error',
                'message': 'Selecione pelo menos um destinatário.'
            }, status=400)

        # Adiciona os destinatários ao comunicado
        comunicado.destinatarios.set(usuarios_ids)

        # Cria os registros de controle para cada destinatário
        for user_id in usuarios_ids:
            ControleComunicado.objects.create(
                comunicado=comunicado,
                usuario_id=user_id
            )

        # Processa os arquivos, se houver
        arquivos = request.FILES.getlist('arquivos[]')
        for arquivo in arquivos:
            ArquivoComunicado.objects.create(
                comunicado=comunicado,
                arquivo=arquivo
            )

        return JsonResponse({
            'status': 'success',
            'message': 'Comunicado criado com sucesso!',
            'comunicado_id': comunicado.id
        })

    except ValidationError as e:
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=400)
    except Exception as e:
        print(f"Erro ao criar comunicado: {e}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@login_required
@controle_acess('SCT53')   # 53 – RECURSOS HUMANOS | COMUNICADOS
def render_comunicados(request):
    """Renderiza a página de visualização de comunicados."""
    return render(request, 'administrativo/comunicados.html')

@login_required
@require_GET
def api_get_comunicados(request):
    """
    API para listar os comunicados do usuário logado.
    Retorna os comunicados com status de leitura, banner e arquivos anexados.
    """
    try:
        # Busca comunicados onde o usuário é destinatário
        comunicados = Comunicado.objects.filter(
            destinatarios=request.user,
            status=True
        ).prefetch_related(
            'controles',
            'arquivos'
        ).order_by('-data_criacao')

        data = []
        for comunicado in comunicados:
            # Busca o controle específico deste usuário
            controle = comunicado.controles.filter(usuario=request.user).first()
            
            # Prepara os dados do comunicado
            comunicado_data = {
                'id': comunicado.id,
                'assunto': comunicado.assunto,
                'texto': comunicado.texto,
                'banner': comunicado.banner.url if comunicado.banner else None,
                'data_criacao': comunicado.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'lido': controle.lido if controle else False,
                'data_leitura': controle.data_leitura.strftime('%d/%m/%Y %H:%M') if controle and controle.data_leitura else None,
                'arquivos': []
            }

            # Adiciona os arquivos anexados
            for arquivo in comunicado.arquivos.filter(status=True):
                comunicado_data['arquivos'].append({
                    'id': arquivo.id,
                    'nome': os.path.basename(arquivo.arquivo.name),
                    'url': arquivo.arquivo.url
                })

            data.append(comunicado_data)

        return JsonResponse(data, safe=False)

    except Exception as e:
        print(f"Erro ao buscar comunicados: {e}")
        return JsonResponse({'error': 'Erro interno ao buscar comunicados.'}, status=500)

@login_required
@require_POST
@csrf_exempt
def api_post_marcarcomolido_comunicado(request, comunicado_id):
    """Marca um comunicado como lido para o usuário atual."""
    try:
        comunicado = get_object_or_404(Comunicado, id=comunicado_id)
        comunicado.marcar_como_lido(request.user)
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_GET
def api_get_destinatarios(request):
    """
    API para retornar a lista de funcionários ativos que podem receber comunicados.
    Retorna nome do funcionário e ID do usuário associado.
    """
    try:
        # Busca funcionários ativos que têm usuário associado
        funcionarios = Funcionario.objects.filter(
            status=True,
            usuario__isnull=False
        ).select_related('usuario').order_by('nome_completo')

        # Prepara a lista de destinatários
        destinatarios = []
        for func in funcionarios:
            destinatarios.append({
                'id': func.usuario.id,
                'nome': func.nome_completo,
                'apelido': func.apelido or func.nome_completo.split()[0],
                'departamento': func.departamento.nome if func.departamento else 'N/A',
                'cargo': func.cargo.nome if func.cargo else 'N/A'
            })

        return JsonResponse(destinatarios, safe=False)

    except Exception as e:
        print(f"Erro ao buscar destinatários: {e}")
        return JsonResponse({'error': 'Erro interno ao buscar destinatários.'}, status=500)


@require_GET
def download_arquivo_comunicado(request, arquivo_id):
    """
    Força o download do arquivo do comunicado, enviando Content-Disposition: attachment.
    """
    arquivo_obj = get_object_or_404(ArquivoComunicado, pk=arquivo_id, status=True)
    # abre o arquivo em modo binário
    fp = arquivo_obj.arquivo.open('rb')
    filename = os.path.basename(arquivo_obj.arquivo.name)
    response = FileResponse(fp, as_attachment=True, filename=filename)
    return response


# SUB CATEGORIA: COMUNICADOS - FIM

@login_required
def render_comunicados_visualizacao(request):
    """Renderiza a página de visualização de comunicados."""
    return render(request, 'apps/funcionarios/comunicados.html')

@login_required
@require_GET
def api_get_infosgerais(request):
    """
    API para buscar todas as informações necessárias para o formulário de comunicados.
    Retorna empresas, departamentos, setores, lojas, equipes e funcionários ativos.
    """
    try:
        # Busca todas as informações em uma única chamada
        data = {
            'empresas': list(Empresa.objects.filter(status=True).values('id', 'nome')),
            'departamentos': list(Departamento.objects.filter(status=True).values('id', 'nome')),
            'setores': list(Setor.objects.filter(status=True).values('id', 'nome')),
            'lojas': list(Loja.objects.filter(status=True).values('id', 'nome')),
            'equipes': list(Equipe.objects.filter(status=True).values('id', 'nome')),
            'funcionarios': list(User.objects.filter(
                funcionario_profile__isnull=False,
                funcionario_profile__status=True
            ).values('id', 'username', 'first_name', 'last_name'))
        }

        # Formata os nomes dos funcionários
        for funcionario in data['funcionarios']:
            funcionario['nome'] = f"{funcionario['first_name']} {funcionario['last_name']}".strip()
            if not funcionario['nome']:
                funcionario['nome'] = funcionario['username']
            # Remove campos desnecessários
            del funcionario['first_name']
            del funcionario['last_name']
            del funcionario['username']

        return JsonResponse({
            'status': 'success',
            'data': data
        })

    except Exception as e:
        print(f"Erro ao buscar informações gerais: {e}")
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

# --- Views para Sistema de Presença ---

@login_required
@controle_acess('SCT67')   # 55 – RECURSOS HUMANOS | PRESENÇA (GINCANA)
@ensure_csrf_cookie
def render_presenca(request):
    """Renderiza a página de registro de participação na gincana."""
    user = request.user
    can_view_full_calendar = False

    if user.is_superuser:
        can_view_full_calendar = True
    else:
        try:
            funcionario = Funcionario.objects.get(usuario=user, status=True)
            if funcionario.cargo and funcionario.cargo.hierarquia in [Cargo.HierarquiaChoices.SUPERVISOR_GERAL, Cargo.HierarquiaChoices.GESTOR]:
                can_view_full_calendar = True
        except Funcionario.DoesNotExist:
            pass # Usuário não é um funcionário, ou não tem cargo, mantém can_view_full_calendar = False
        except Exception as e:
            # Logar o erro em um sistema de produção
            print(f"Erro ao verificar permissão do calendário para {user.username}: {e}")
            pass # Em caso de erro, assume a visão restrita por segurança

    context = {
        'can_view_full_calendar': can_view_full_calendar
    }
    return render(request, 'rh/presenca.html', context)

@login_required
@controle_acess('SCT68')   # 56 – RECURSOS HUMANOS | RELATÓRIO PRESENÇA (GINCANA)
def render_relatorio_presenca(request):
    """Renderiza a página de relatório de participação na gincana."""
    return render(request, 'rh/relatorio_presenca.html')

@require_GET
@login_required  
def api_test_ip_capture(request):
    """API temporária para testar a captura de IP"""
    client_ip = get_client_ip(request)
    
    # Coleta todos os headers relacionados a IP para debug
    ip_headers = {
        'HTTP_X_FORWARDED_FOR': request.META.get('HTTP_X_FORWARDED_FOR'),
        'HTTP_X_REAL_IP': request.META.get('HTTP_X_REAL_IP'),
        'HTTP_CF_CONNECTING_IP': request.META.get('HTTP_CF_CONNECTING_IP'),
        'HTTP_X_CLUSTER_CLIENT_IP': request.META.get('HTTP_X_CLUSTER_CLIENT_IP'),
        'REMOTE_ADDR': request.META.get('REMOTE_ADDR'),
        'HTTP_X_FORWARDED': request.META.get('HTTP_X_FORWARDED'),
        'HTTP_FORWARDED_FOR': request.META.get('HTTP_FORWARDED_FOR'),
        'HTTP_FORWARDED': request.META.get('HTTP_FORWARDED'),
    }
    
    # Remove headers vazios
    ip_headers = {k: v for k, v in ip_headers.items() if v}
    
    return JsonResponse({
        'ip_capturado': client_ip,
        'headers_disponiveis': ip_headers,
        'user_agent': request.META.get('HTTP_USER_AGENT', 'N/A'),
        'metodo_request': request.method,
        'timestamp': timezone.now().isoformat()
    })

@require_GET
@login_required
def api_get_registros_presenca(request):
    """API para buscar registros de participação na gincana de um dia específico."""
    print("[GINCANA_API] Iniciando busca de registros de participação")
    data_param = request.GET.get('data') # Renomeado para evitar conflito com o dict 'data'
    if not data_param:
        print("[GINCANA_API] Erro: Data não fornecida")
        return JsonResponse({'error': 'Data não fornecida'}, status=400)
    
    try:
        data_convertida = datetime.strptime(data_param, '%Y-%m-%d').date()
        print(f"[GINCANA_API] Data convertida: {data_convertida}")
    except ValueError:
        print("[GINCANA_API] Erro: Formato de data inválido")
        return JsonResponse({'error': 'Formato de data inválido'}, status=400)

    user = request.user
    # Determinar se o usuário tem visão completa do calendário
    tem_visao_completa = False
    if user.is_superuser:
        tem_visao_completa = True
    else:
        try:
            funcionario = Funcionario.objects.get(usuario=user, status=True)
            if funcionario.cargo and funcionario.cargo.hierarquia in [Cargo.HierarquiaChoices.SUPERVISOR_GERAL, Cargo.HierarquiaChoices.GESTOR]:
                tem_visao_completa = True
        except Funcionario.DoesNotExist:
            pass 
        except Exception as e:
            print(f"[GINCANA_API] Erro ao verificar permissão de visão completa para {user.username}: {e}")
            # Em caso de erro na verificação, assume que não tem visão completa por segurança
            tem_visao_completa = False
    
    response_data = {
        'data_solicitada': data_convertida.strftime('%Y-%m-%d'),
        'registros_usuario_logado': [], # Para o botão do dia atual e visão normal
        'resumo_dia': { # Para a visão de gestor/superuser
            'total_entradas': 0,
            'total_saidas': 0
        },
        'visao_completa_aplicada': tem_visao_completa # Informa ao frontend qual lógica foi usada
    }

    if tem_visao_completa:
        print(f"[GINCANA_API] Usuário {user.username} tem visão completa. Buscando todos os registros para {data_convertida}")
        # Contar todas as entradas e saídas para a data
        total_entradas_dia = RegistroPresenca.objects.filter(
            entrada_auto__data=data_convertida, 
            tipo='ENTRADA'
        ).count()
        total_saidas_dia = RegistroPresenca.objects.filter(
            entrada_auto__data=data_convertida, 
            tipo='SAIDA'
        ).count()
        response_data['resumo_dia']['total_entradas'] = total_entradas_dia
        response_data['resumo_dia']['total_saidas'] = total_saidas_dia
        print(f"[GINCANA_API] Resumo do dia: Entradas={total_entradas_dia}, Saídas={total_saidas_dia}")

    # Sempre buscar registros do usuário logado para o botão do dia atual e para a visão normal do usuário
    # Isso é importante mesmo para quem tem visão completa, para gerenciar o SEU PRÓPRIO botão de registro.
    print(f"[GINCANA_API] Buscando registros específicos para usuário {user.username} na data {data_convertida}")
    registros_usuario = RegistroPresenca.objects.filter(
        entrada_auto__usuario=user,
        entrada_auto__data=data_convertida
    ).order_by('datahora')
    
    print(f"[GINCANA_API] Encontrados {registros_usuario.count()} registros para o usuário {user.username}")
    
    for registro in registros_usuario:
        response_data['registros_usuario_logado'].append({
            'tipo': registro.tipo,
            'datahora': registro.datahora.strftime('%H:%M:%S')
        })
    
    print(f"[GINCANA_API] Retornando dados processados: {response_data}")
    return JsonResponse(response_data)

def get_client_ip(request):
    """
    Função avançada para obter o IP real do cliente, considerando proxies, load balancers
    e diferentes configurações de infraestrutura.
    
    IMPORTANTE: Esta função agora está sincronizada com o middleware PresencaAutoMiddleware
    para garantir consistência na captura de IP em todo o sistema.
    """
    # Importa a função do middleware para garantir consistência
    from custom_tags_app.middleware import get_client_ip_middleware
    
    client_ip = get_client_ip_middleware(request)
    print(f"[IP_CAPTURE] IP capturado: {client_ip}")
    
    # Log adicional para debug
    ip_headers = [
        'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'HTTP_CF_CONNECTING_IP',
        'HTTP_X_CLUSTER_CLIENT_IP', 'HTTP_X_FORWARDED', 'HTTP_FORWARDED_FOR',
        'HTTP_FORWARDED', 'REMOTE_ADDR'
    ]
    available_headers = {k: v for k, v in request.META.items() 
                        if k in ip_headers and v}
    print(f"[IP_CAPTURE] Headers disponíveis: {available_headers}")
    
    return client_ip

@require_POST
@login_required
@csrf_protect
def api_post_registro_presenca(request):
    """API para registrar participação na gincana."""
    print("[GINCANA_API] Iniciando registro de participação")
    try:
        # Verificar se o usuário é funcionário ativo E está em alguma equipe antes de permitir registro
        try:
            funcionario = Funcionario.objects.get(
                usuario=request.user,
                status=True,
                equipe__isnull=False  # Deve ter equipe para participar da gincana
            )
            print(f"[GINCANA_API] Funcionário verificado: {funcionario.nome_completo} - Equipe: {funcionario.equipe.nome}")
        except Funcionario.DoesNotExist:
            print(f"[GINCANA_API] Usuário {request.user.username} não é funcionário ativo com equipe")
            return JsonResponse({
                'error': 'Apenas funcionários ativos que estão em alguma equipe podem registrar presença na gincana'
            }, status=403)
        
        data = json.loads(request.body)
        tipo = data.get('tipo')
        print(f"[GINCANA_API] Tipo de registro solicitado: {tipo}")
        
        if not tipo:
            print("[GINCANA_API] Erro: Tipo de registro não fornecido")
            return JsonResponse({'error': 'Tipo de registro não fornecido'}, status=400)
        
        # Captura o IP real do cliente
        client_ip = get_client_ip(request)
        print(f"[GINCANA_API] IP capturado: {client_ip}")
        
        hoje = timezone.now().date()
        print(f"[GINCANA_API] Data atual: {hoje}")
        entrada_auto, created = EntradaAuto.objects.get_or_create(
            usuario=request.user,
            data=hoje,
            defaults={
                'ip_usado': client_ip
            }
        )
        
        # Se já existe mas queremos atualizar o IP (caso tenha mudado)
        if not created and entrada_auto.ip_usado != client_ip:
            entrada_auto.ip_usado = client_ip
            entrada_auto.save()
            print(f"[GINCANA_API] IP atualizado para entrada existente: {client_ip}")
        
        print(f"[GINCANA_API] Entrada automática {'criada' if created else 'recuperada'} para {request.user.username}")
        
        registro = RegistroPresenca.objects.create(
            entrada_auto=entrada_auto,
            tipo=tipo,
            datahora=timezone.now()
        )
        print(f"[GINCANA_API] Registro criado com ID {registro.id} às {registro.datahora}")
        
        return JsonResponse({
            'success': True,
            'message': f'Registro de {tipo.lower()} na gincana realizado com sucesso',
            'registro': {
                'id': registro.id,
                'tipo': registro.tipo,
                'datahora': registro.datahora.strftime('%H:%M:%S')
            }
        })
        
    except json.JSONDecodeError:
        print("[GINCANA_API] Erro: JSON inválido no corpo da requisição")
        return JsonResponse({'error': 'JSON inválido'}, status=400)
    except Exception as e:
        print(f"[GINCANA_API] Erro ao registrar participação: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': str(e)}, status=500)

@require_GET
@login_required
@controle_acess('SCT67') # Permissão consistente com a página de relatório
def api_rh_get_funcionarios_para_filtro_presenca(request):
    """
    API para buscar funcionários ativos (com usuário associado) para o filtro 
    do relatório de presença.
    Retorna lista de objetos com 'id' (User ID) e 'nome' (Nome completo do funcionário).
    """
    print("[API_FILTRO_FUNCIONARIOS_PRESENCA] Iniciando busca de funcionários para filtro")
    try:
        funcionarios = Funcionario.objects.filter(
            status=True, 
            usuario__isnull=False,
            equipe__isnull=False  # Apenas funcionários com equipe para gincana
        ).select_related('usuario', 'equipe').order_by('nome_completo')
        
        data = []
        for f in funcionarios:
            data.append({
                'id': f.usuario.id, 
                'nome': f.nome_completo,
                'equipe': f.equipe.nome if f.equipe else 'Sem equipe'
            })
        print(f"[API_FILTRO_FUNCIONARIOS_PRESENCA] Encontrados {len(data)} funcionários com equipe.")
        return JsonResponse(data, safe=False)
    except Exception as e:
        logger.error(f"[API_FILTRO_FUNCIONARIOS_PRESENCA] Erro ao buscar funcionários para filtro de presença: {e}", exc_info=True)
        # logger.error(f"Erro ao buscar funcionários para filtro de presença: {e}", exc_info=True) # Considerar logger em produção
        return JsonResponse({'error': 'Erro ao carregar lista de funcionários.'}, status=500)

@login_required
@require_GET
@controle_acess('SCT67')
def api_rh_get_equipes_para_filtro_presenca(request):
    """
    API para buscar equipes ativas para o filtro do relatório de presença.
    Retorna lista de objetos com 'id' (Equipe ID) e 'nome' (Nome da equipe).
    """
    print("[API_FILTRO_EQUIPES_PRESENCA] Iniciando busca de equipes para filtro")
    try:
        equipes = Equipe.objects.filter(status=True).order_by('nome')
        
        data = []
        for e in equipes:
            data.append({
                'id': e.id, 
                'nome': e.nome
            })
        print(f"[API_FILTRO_EQUIPES_PRESENCA] Encontradas {len(data)} equipes.")
        return JsonResponse(data, safe=False)
    except Exception as e:
        print(f"[API_FILTRO_EQUIPES_PRESENCA] Erro ao buscar equipes para filtro de presença: {e}")
        return JsonResponse({'error': 'Erro ao carregar lista de equipes.'}, status=500)

@require_GET
@login_required
@controle_acess('SCT68')
def api_get_ausencias_atrasos(request):
    """
    API para buscar funcionários ausentes ou atrasados em uma data específica.
    
    Considera apenas funcionários que possuem horário de trabalho definido.
    - Ausentes: funcionários sem nenhum registro na data
    - Atrasados: funcionários cujo primeiro registro foi após (horário_entrada + 5min)
    - Funcionários sem horário definido são exceções e não aparecem no relatório
    """
    try:
        data_consulta = request.GET.get('data')
        filtro_equipe = request.GET.get('filtro_equipe', '')
        
        if not data_consulta:
            return JsonResponse({'error': 'Data é obrigatória'}, status=400)
        
        # Converte string para date
        try:
            data_obj = datetime.strptime(data_consulta, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'error': 'Formato de data inválido. Use YYYY-MM-DD'}, status=400)
        
        # Busca apenas funcionários ativos que possuem horário de trabalho definido
        funcionarios_query = Funcionario.objects.filter(
            status=True,
            usuario__is_active=True,
            horario__isnull=False  # Só considera funcionários com horário definido
        )
        
        # Aplica filtro de equipe se especificado
        if filtro_equipe == 'com_equipe':
            funcionarios_query = funcionarios_query.filter(equipe__isnull=False)
        elif filtro_equipe == 'sem_equipe':
            funcionarios_query = funcionarios_query.filter(equipe__isnull=True)
        
        funcionarios_ativos = funcionarios_query.select_related('departamento', 'equipe', 'usuario', 'horario')
        
        dados_ausencias = []
        
        for funcionario in funcionarios_ativos:
            # Busca registros de presença do funcionário na data
            registros_do_dia = RegistroPresenca.objects.filter(
                entrada_auto__usuario=funcionario.usuario,
                entrada_auto__data=data_obj
            ).order_by('datahora')
            
            # Obtém o horário de trabalho do funcionário
            horario_trabalho = funcionario.horario
            hora_entrada = horario_trabalho.entrada
            
            # Calcula hora limite (entrada + 5 minutos de tolerância)
            hora_entrada_datetime = datetime.combine(data_obj, hora_entrada)
            hora_limite_datetime = hora_entrada_datetime + timedelta(minutes=5)
            hora_limite = hora_limite_datetime.time()
            
            if not registros_do_dia.exists():
                # Funcionário não registrou presença
                dados_ausencias.append({
                    'funcionario_nome': funcionario.nome_completo,
                    'departamento': funcionario.departamento.nome if funcionario.departamento else None,
                    'equipe': funcionario.equipe.nome if funcionario.equipe else None,
                    'situacao': 'ausente',
                    'primeiro_registro': None,
                    'observacao': f'Nenhum registro de presença encontrado (horário: {hora_entrada.strftime("%H:%M")})'
                })
            else:
                # Verifica se o primeiro registro foi após o horário limite
                primeiro_registro = registros_do_dia.first()
                
                if primeiro_registro.datahora.time() > hora_limite:
                    dados_ausencias.append({
                        'funcionario_nome': funcionario.nome_completo,
                        'departamento': funcionario.departamento.nome if funcionario.departamento else None,
                        'equipe': funcionario.equipe.nome if funcionario.equipe else None,
                        'situacao': 'atrasado',
                        'primeiro_registro': primeiro_registro.datahora.strftime('%H:%M:%S'),
                        'observacao': f'Primeiro registro após {hora_limite.strftime("%H:%M")} (horário: {hora_entrada.strftime("%H:%M")} + 5min tolerância)'
                    })
        
        # Conta funcionários total e com horário
        total_funcionarios_ativos = Funcionario.objects.filter(
            status=True,
            usuario__is_active=True
        ).count()
        
        funcionarios_com_horario = funcionarios_ativos.count()
        funcionarios_sem_horario = total_funcionarios_ativos - funcionarios_com_horario
        
        # Informações sobre o filtro aplicado
        filtro_info = 'Todos os funcionários'
        if filtro_equipe == 'com_equipe':
            filtro_info = 'Apenas funcionários com equipe'
        elif filtro_equipe == 'sem_equipe':
            filtro_info = 'Apenas funcionários sem equipe'
        
        return JsonResponse({
            'dados': dados_ausencias,
            'total_problemas': len(dados_ausencias),
            'funcionarios_analisados': funcionarios_com_horario,
            'funcionarios_excluidos': funcionarios_sem_horario,
            'data_consulta': data_consulta,
            'filtro_equipe': filtro_equipe,
            'filtro_info': filtro_info,
            'observacoes': {
                'criterio': 'Horário de trabalho individual + 5 minutos de tolerância',
                'excluidos': 'Funcionários sem horário definido não são analisados',
                'filtro_aplicado': filtro_info
            }
        })
        
    except Exception as e:
        print(f"[AUSENCIAS_API] Erro: {str(e)}")
        return JsonResponse({'error': 'Erro interno do servidor'}, status=500)

@login_required
@require_GET
@controle_acess('SCT67')
def api_get_relatorio_presenca(request):
    """
    API aprimorada para o Dashboard de Presença.
    Busca dados de EntradaAuto, RegistroPresenca e RelatorioSistemaPresenca.
    """
    print("[API_DASHBOARD_PRESENCA] Iniciando busca de dados abrangentes")
    try:
        data_inicio_str = request.GET.get('data_inicio')
        data_fim_str = request.GET.get('data_fim')
        equipe_id_str = request.GET.get('equipe_id')
        usuario_id_str = request.GET.get('usuario_id')
        
        print(f"[API_DASHBOARD_PRESENCA] Filtros recebidos: data_inicio={data_inicio_str}, data_fim={data_fim_str}, equipe_id={equipe_id_str}, usuario_id={usuario_id_str}")

        data_ref_hoje = timezone.now().date()
        if data_fim_str and (not data_inicio_str or data_inicio_str == data_fim_str):
            try:
                parsed_date_fim = parse_date(data_fim_str)
                if parsed_date_fim:
                    data_ref_hoje = parsed_date_fim
            except ValueError:
                pass 
        
        print(f"[API_DASHBOARD_PRESENCA] Data de referência para 'hoje': {data_ref_hoje}")

        filters_periodo_ponto = Q()
        filters_periodo_ausencia = Q()

        if data_inicio_str:
            filters_periodo_ponto &= Q(entrada_auto__data__gte=data_inicio_str)
            filters_periodo_ausencia &= Q(data__gte=data_inicio_str)
        if data_fim_str:
            filters_periodo_ponto &= Q(entrada_auto__data__lte=data_fim_str)
            filters_periodo_ausencia &= Q(data__lte=data_fim_str)
        
        user_q_object = Q()
        usuarios_da_equipe = None
        
        # Aplicar filtro por equipe se fornecido
        if equipe_id_str:
            usuarios_da_equipe = Funcionario.objects.filter(
                equipe_id=equipe_id_str, 
                status=True, 
                usuario__isnull=False
            ).values_list('usuario_id', flat=True)
            
            # Converter para lista para verificar se há usuários na equipe
            usuarios_da_equipe = list(usuarios_da_equipe)
            print(f"[API_DASHBOARD_PRESENCA] Funcionários encontrados na equipe {equipe_id_str}: {len(usuarios_da_equipe)}")
            
            if usuarios_da_equipe:
                user_q_object = Q(usuario_id__in=usuarios_da_equipe)
                filters_periodo_ponto &= Q(entrada_auto__usuario_id__in=usuarios_da_equipe)
                filters_periodo_ausencia &= Q(usuario_id__in=usuarios_da_equipe)
            else:
                # Se não há funcionários na equipe, retorna resultados vazios
                print(f"[API_DASHBOARD_PRESENCA] Nenhum funcionário encontrado na equipe {equipe_id_str}")
                user_q_object = Q(usuario_id=-1)  # Filtro que não retorna nada
                filters_periodo_ponto &= Q(entrada_auto__usuario_id=-1)
                filters_periodo_ausencia &= Q(usuario_id=-1)
        
        # Aplicar filtro por usuário específico se fornecido (mais restritivo que equipe)
        if usuario_id_str:
            # Verificar se o usuário específico é funcionário ativo com equipe antes de aplicar o filtro
            usuario_funcionario = Funcionario.objects.filter(
                usuario_id=usuario_id_str,
                status=True,
                equipe__isnull=False  # Deve ter equipe para participar da gincana
            ).first()
            
            if usuario_funcionario:
                user_q_object = Q(usuario_id=usuario_id_str)
                filters_periodo_ponto &= Q(entrada_auto__usuario_id=usuario_id_str)
                filters_periodo_ausencia &= Q(usuario_id=usuario_id_str)
            else:
                # Se o usuário não for funcionário ativo com equipe, não mostra dados para ele
                print(f"[API_DASHBOARD_PRESENCA] Usuário {usuario_id_str} não é funcionário ativo com equipe ou não existe")
                user_q_object = Q(usuario_id=-1)  # Filtro que não retorna nada
                filters_periodo_ponto &= Q(entrada_auto__usuario_id=-1)
                filters_periodo_ausencia &= Q(usuario_id=-1)

        dashboard_data = {}

        filters_hoje_checkin = Q(data=data_ref_hoje) & user_q_object
        entradas_auto_hoje = EntradaAuto.objects.filter(filters_hoje_checkin)
        dashboard_data['total_checkins_hoje'] = entradas_auto_hoje.count()
        
        funcionarios_ativos_qs = Funcionario.objects.filter(
            status=True, 
            usuario__isnull=False,
            equipe__isnull=False  # Apenas funcionários com equipe para gincana
        )
        if equipe_id_str:
            funcionarios_ativos_qs = funcionarios_ativos_qs.filter(equipe_id=equipe_id_str)
        if usuario_id_str:
            funcionarios_ativos_qs = funcionarios_ativos_qs.filter(usuario_id=usuario_id_str)
        total_funcionarios_ativos_contexto = funcionarios_ativos_qs.count()
        dashboard_data['total_funcionarios_ativos_contexto'] = total_funcionarios_ativos_contexto
        ids_usuarios_com_checkin_hoje = entradas_auto_hoje.values_list('usuario_id', flat=True)
        dashboard_data['funcionarios_sem_checkin_hoje'] = total_funcionarios_ativos_contexto - len(set(ids_usuarios_com_checkin_hoje))

        filters_hoje_registros = Q(entrada_auto__data=data_ref_hoje)
        if equipe_id_str and usuarios_da_equipe is not None: # Aplicar filtro de equipe se presente
            if usuarios_da_equipe:
                filters_hoje_registros &= Q(entrada_auto__usuario_id__in=usuarios_da_equipe)
            else:
                filters_hoje_registros &= Q(entrada_auto__usuario_id=-1)  # Nenhum resultado
        if usuario_id_str: # Aplicar filtro de usuário se presente (mais restritivo que equipe)
            filters_hoje_registros &= Q(entrada_auto__usuario_id=usuario_id_str)

        dashboard_data['total_entradas_hoje'] = RegistroPresenca.objects.filter(filters_hoje_registros, tipo='ENTRADA').count()
        dashboard_data['total_saidas_hoje'] = RegistroPresenca.objects.filter(filters_hoje_registros, tipo='SAIDA').count()

        if data_inicio_str or data_fim_str:
            dashboard_data['total_entradas_periodo'] = RegistroPresenca.objects.filter(filters_periodo_ponto, tipo='ENTRADA').count()
            dashboard_data['total_saidas_periodo'] = RegistroPresenca.objects.filter(filters_periodo_ponto, tipo='SAIDA').count()
        else: # Se não há filtro de período, os totais do período são os de "hoje"
            dashboard_data['total_entradas_periodo'] = dashboard_data['total_entradas_hoje']
            dashboard_data['total_saidas_periodo'] = dashboard_data['total_saidas_hoje']

        ausencias_qs = RelatorioSistemaPresenca.objects.filter(filters_periodo_ausencia)
        dashboard_data['total_ausencias_reportadas'] = ausencias_qs.count()
        dashboard_data['usuarios_com_ausencias'] = ausencias_qs.values('usuario_id').distinct().count()
        
        top_observacoes_list_ausencias = []
        if dashboard_data['total_ausencias_reportadas'] > 0:
            top_obs_qs = ausencias_qs.values('observacao').annotate(count=Count('observacao')).order_by('-count')[:1]
            if top_obs_qs:
                top_observacoes_list_ausencias = [{'observacao': item['observacao'], 'count': item['count']} for item in top_obs_qs]
        dashboard_data['top_observacoes_ausencias'] = top_observacoes_list_ausencias
        
        print(f"[API_DASHBOARD_PRESENCA] Dados do Dashboard calculados: {dashboard_data}")

        registros_ponto_qs = RegistroPresenca.objects.filter(
            filters_periodo_ponto 
        ).select_related(
            'entrada_auto__usuario',
            'entrada_auto__usuario__funcionario_profile',
            'entrada_auto__usuario__funcionario_profile__departamento',
            'entrada_auto__usuario__funcionario_profile__equipe'
        ).order_by('-entrada_auto__data', '-datahora')

        registros_ponto_list = []
        for rp in registros_ponto_qs:
            usuario = rp.entrada_auto.usuario
            nome_usuario = f"{usuario.first_name} {usuario.last_name}".strip() or usuario.username
            
            departamento_nome = "N/A"
            equipe_nome = "N/A"
            try:
                if usuario.funcionario_profile:
                    if usuario.funcionario_profile.departamento:
                        departamento_nome = usuario.funcionario_profile.departamento.nome
                    if usuario.funcionario_profile.equipe:
                        equipe_nome = usuario.funcionario_profile.equipe.nome
            except ObjectDoesNotExist:
                pass # Funcionário pode não ter perfil ou departamento/equipe associado

            registros_ponto_list.append({
                'id': rp.id,
                'data': rp.entrada_auto.data.strftime('%d/%m/%Y'),
                'hora': rp.datahora.strftime('%H:%M:%S'),
                'usuario_nome': nome_usuario,
                'departamento': departamento_nome,
                'equipe': equipe_nome,
                'tipo': rp.get_tipo_display(),
                'ip_usado': rp.entrada_auto.ip_usado if rp.entrada_auto else 'N/A'
            })
        
        print(f"[API_DASHBOARD_PRESENCA] {len(registros_ponto_list)} registros de ponto para a tabela.")
        
        response_payload = {
            'dashboard': dashboard_data,
            'registros_ponto': registros_ponto_list
        }
        return JsonResponse(response_payload, safe=False)

    except Exception as e:
        logger.error(f"[API_DASHBOARD_PRESENCA] Erro crítico: {e}", exc_info=True)
        # Removido traceback.print_exc() pois o logger já fará isso com exc_info=True
        return JsonResponse({'error': 'Erro interno ao processar dados de presença.'}, status=500)

# ... (restante das views) ...