# apps/usuarios/views.py
from custom_tags_app.permissions import check_access
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.contrib.auth.models import Group
from django.contrib import messages
from apps.funcionarios.models import *
from apps.siape.models import *
from apps.inss.models import *
from django.http import JsonResponse
from django.utils.timezone import now
from datetime import timedelta
from django.db.models import Count, Sum
from collections import defaultdict
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import *
from django.contrib.auth.models import User
from .models import *
from apps.funcionarios.models import *
import json
from custom_tags_app.templatetags.permissionsacess import controle_acess
from django.template.loader import render_to_string
from django.utils import timezone


# 1. Renderiza a página de permissões
@require_GET
@controle_acess('SCT8')
def render_permissionacess(request):
    return render(request, 'usuarios/permissionacess.html')

def criar_usuario_com_grupo(nome, sobrenome, email, senha, senha2, grupo_id):
    """
    Cria um novo usuário com as informações fornecidas, adiciona o usuário ao grupo especificado e retorna o ID do usuário e uma variável de sucesso.

    Args:
        nome (str): Primeiro nome do usuário.
        sobrenome (str): Sobrenome do usuário.
        email (str): E-mail do usuário.
        senha (str): Senha do usuário.
        senha2 (str): Confirmação da senha do usuário.
        grupo_id (int): ID do grupo ao qual o usuário será adicionado.

    Returns:
        dict: Um dicionário contendo o ID do usuário e uma variável de sucesso.
    """
    success = False
    user_id = None

    if senha != senha2:
        return {'success': success, 'user_id': user_id, 'error': 'As senhas não coincidem.'}

    if User.objects.filter(username=email).exists():
        return {'success': success, 'user_id': user_id, 'error': 'Usuário já existe.'}

    try:
        user = User.objects.create_user(
            username=email,
            email=email,
            password=senha,
            first_name=nome,
            last_name=sobrenome
        )

        # Adiciona o usuário ao grupo especificado, se o grupo existir
        try:
            group = Group.objects.get(id=grupo_id)
            user.groups.add(group)
        except Group.DoesNotExist:
            return {'success': success, 'user_id': user_id, 'error': 'Grupo não encontrado.'}

        user_id = user.id
        success = True
        return {'success': success, 'user_id': user_id}

    except Exception as e:
        return {'success': success, 'user_id': user_id, 'error': str(e)}

def login_view(request):
    """
    Gerencia o login do usuário. Exibe o formulário de login e realiza a autenticação.

    Args:
        request (HttpRequest): A requisição HTTP.

    Returns:
        HttpResponse: Redireciona para a URL de destino após o login ou exibe um formulário com erro de autenticação.
    """
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(username=username, password=password)
            if user is not None:
                login(request, user)
                messages.success(request, f"Bem-vindo, {user.first_name}!")
                return redirect('administrativo:dashboard')  # ou qualquer outra página inicial
            else:
                messages.error(request, "Usuário ou senha inválidos.")
        else:
            messages.error(request, "Formulário inválido. Por favor, tente novamente.")
    else:
        form = AuthenticationForm()
    return render(request, 'usuarios/login.html', {'form': form})

@login_required
def logout_view(request):
    """
    Realiza o logout do usuário autenticado. Redireciona para a URL de destino após o logout.

    Args:
        request (HttpRequest): A requisição HTTP.

    Returns:
        HttpResponse: Redireciona para a URL de destino após o logout.
    """
    logout(request)
    messages.info(request, "Você foi desconectado com sucesso.")
    return redirect('usuarios:login')


@login_required
def perfil_view(request):
    """
    Exibe o perfil do funcionário logado.
    O usuário deve estar autenticado para acessar esta página.
    """
    return render(request, 'usuarios/perfil.html')

@login_required
def api_perfil_get(request):
    """Retorna os dados do funcionário logado e seu dashboard."""
    try:
        usuario = request.user
        print(f"🔎 1. Buscando funcionário para usuário: {usuario}")

        funcionario = Funcionario.objects.select_related(
            'empresa', 'loja', 'departamento', 'cargo'
        ).filter(usuario=usuario).first()

        if not funcionario:
            print("❌ 2. Funcionário não encontrado!")
            return JsonResponse({'error': 'Funcionário não encontrado'}, status=404)

        print("✅ 3. Funcionário encontrado.")

        # Nome do departamento ajustado corretamente
        nome_departamento = funcionario.departamento.grupo.name if funcionario.departamento else None
        print(f"📌 4. Departamento identificado: {nome_departamento}")

        # Dados do funcionário
        dados_funcionario = {
            "nome": f"{funcionario.nome} {funcionario.sobrenome}",
            "foto": funcionario.foto.url if funcionario.foto else None,
            "data_nascimento": funcionario.data_de_nascimento.strftime("%d/%m/%Y") if funcionario.data_de_nascimento else "Não informado",
            "genero": funcionario.genero or "Não informado",
            "empresa": funcionario.empresa.nome if funcionario.empresa else None,
            "loja": funcionario.loja.nome if funcionario.loja else None,
            "departamento": nome_departamento,
            "cargo": funcionario.cargo.nome if funcionario.cargo else None,
        }
        print(f"✅ 5. Dados do funcionário carregados: {dados_funcionario}")

        # Definir período para faturamento mensal e ranking
        hoje = now().date()
        print(f"📆 6. Data de hoje: {hoje}")

        inicio_mes = hoje.replace(day=1)
        print(f"📆 7. Início do mês: {inicio_mes}")

        proximo_mes = (inicio_mes.replace(day=28) + timedelta(days=4)).replace(day=1)
        print(f"📆 8. Próximo mês: {proximo_mes}")

        faturamento_total = Decimal('0')
        faturamento_mensal = Decimal('0')

        if nome_departamento == "SIAPE":
            print("📊 9. Calculando faturamento para SIAPE...")

            faturamento_total = RegisterMoney.objects.filter(
                funcionario=funcionario, status=True
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0')

            faturamento_mensal = RegisterMoney.objects.filter(
                funcionario=funcionario, status=True,
                data__gte=inicio_mes, data__lt=proximo_mes
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0')

        elif nome_departamento == "INSS":
            print("📊 12. Calculando agendamentos em loja para INSS...")

            # 1. Obter todos os agendamentos do funcionário (usando `atendente_agendou`)
            agendamentos = Agendamento.objects.filter(atendente_agendou=funcionario)
            print(f"📌 13. Total de agendamentos antes de filtros: {agendamentos.count()}")

            # 2. Filtrar apenas os que têm tabulacao_vendedor diferente de vazio
            agendamentos_filtrados = agendamentos.filter(tabulacao_vendedor__isnull=False)
            print(f"📌 14. Após remover tabulação vazia: {agendamentos_filtrados.count()}")

            # 3. Remover os com tabulacao_vendedor == 'NÃO QUIS OUVIR'
            agendamentos_filtrados = agendamentos_filtrados.exclude(tabulacao_vendedor="NÃO QUIS OUVIR")
            print(f"📌 15. Após remover 'NÃO QUIS OUVIR': {agendamentos_filtrados.count()}")

            # 4. Contar "Em Loja Totais" (SEM FILTRO DE DATA)
            faturamento_total = agendamentos_filtrados.count()
            print(f"✅ 16. Em Loja Totais (INSS): {faturamento_total}")

            # 5. Filtrar para pegar apenas os agendamentos do mês atual
            faturamento_mensal = agendamentos_filtrados.filter(
                dia_agendado__gte=inicio_mes, dia_agendado__lt=proximo_mes
            ).count()
            print(f"✅ 17. Em Loja Mensal (INSS): {faturamento_mensal}")

        print(f"📊 18. Finalizado cálculo de faturamento/agendamentos.")

        # Cálculo do ranking (baseado em **todos os agendamentos**)
        ranking_posicao = calcular_posicao_ranking(funcionario, nome_departamento)
        print(f"🏆 19. Posição no ranking: {ranking_posicao}")

        return JsonResponse({
            "funcionario": dados_funcionario,
            "dashboard": {
                "faturamento_total": int(faturamento_total),
                "faturamento_mensal": int(faturamento_mensal),
                "ranking_posicao": ranking_posicao
            }
        })

    except Exception as e:
        print(f"❌ 20. Erro interno: {e}")
        return JsonResponse({'error': 'Erro interno do servidor', 'message': str(e)}, status=500)


import pandas as pd  # Para exibição de tabela formatada
def calcular_posicao_ranking(funcionario, setor):
    """Calcula a posição do funcionário no ranking do setor."""
    hoje = now().date()
    posicao = "N/A"

    print(f"📊 21. Calculando ranking para setor: {setor}")

    if setor == "SIAPE":
        print("📊 22. Buscando meta ativa para SIAPE...")

        # 1. Buscar meta geral primeiro, se não houver, buscar meta específica para SIAPE
        meta_siape = RegisterMeta.objects.filter(setor="SIAPE", status=True).order_by('-range_data_inicio').first()

        if meta_siape:
            primeiro_dia, ultimo_dia = meta_siape.range_data_inicio, meta_siape.range_data_final
            print(f"📆 23. Usando Meta Específica SIAPE - Período do ranking: {primeiro_dia} até {ultimo_dia}")
        else:
            primeiro_dia, ultimo_dia = hoje.replace(day=1), hoje
            print(f"📆 23. Sem meta ativa, usando período padrão: {primeiro_dia} até {ultimo_dia}")

        # 2. Receber todos os registros de RegisterMoney
        registros_siape = RegisterMoney.objects.filter(status=True).values('funcionario', 'valor_est', 'data')
        print(f"📌 24. Total de registros de vendas antes de filtro: {len(registros_siape)}")

        # 3. ID do funcionário logado
        funcionario_id = funcionario.id
        print(f"📌 25. ID do funcionário logado: {funcionario_id}")

        # 4. Filtrar registros apenas dentro do data_range (convertendo `data` para `date`)
        registros_filtrados = [reg for reg in registros_siape if primeiro_dia <= reg['data'].date() <= ultimo_dia]
        print(f"📌 26. Registros após filtro por data_range: {len(registros_filtrados)}")

        # 5. Filtrar funcionários que pertencem ao setor SIAPE
        funcionarios_siape = Funcionario.objects.filter(departamento__grupo__name="SIAPE").values_list('id', flat=True)
        registros_filtrados = [reg for reg in registros_filtrados if reg['funcionario'] in funcionarios_siape]
        print(f"📌 27. Registros após filtrar apenas funcionários do setor SIAPE: {len(registros_filtrados)}")

        # 6. Somar valor por funcionário
        faturamento_por_funcionario = {}
        for reg in registros_filtrados:
            funcionario_id_reg = reg['funcionario']
            valor = reg['valor_est'] or 0
            faturamento_por_funcionario[funcionario_id_reg] = faturamento_por_funcionario.get(funcionario_id_reg, 0) + valor
        
        print(f"📌 28. Total de funcionários no ranking (após filtrar por SIAPE): {len(faturamento_por_funcionario)}")

        # 7. Ordenar do maior para o menor faturamento
        ranking_lista = sorted(faturamento_por_funcionario.items(), key=lambda x: x[1], reverse=True)

        # 8. Exibir ranking no terminal em formato numerado
        print("\n📊 29. Ranking de Funcionários - Ordenado (Apenas SIAPE):")
        for idx, (func_id, total) in enumerate(ranking_lista, start=1):
            print(f"{idx}. Funcionário ID: {func_id} | Total: R$ {total:,.2f}")

        # 9. Encontrar a posição do funcionário logado
        posicao = next((idx + 1 for idx, (func_id, total) in enumerate(ranking_lista) if func_id == funcionario_id), "N/A")
        print(f"🏆 30. Ranking calculado - Posição: {posicao}, Valor: {faturamento_por_funcionario.get(funcionario_id, 0)}")



    elif setor == "INSS":
        print("📊 24. Calculando ranking para INSS...")

        # 1. Buscar a meta ativa para INSS e obter o período do ranking (data_range)
        meta_inss = RegisterMeta.objects.filter(setor="INSS", status=True).order_by('-range_data_inicio').first()
        primeiro_dia, ultimo_dia = (meta_inss.range_data_inicio, meta_inss.range_data_final) if meta_inss else (hoje.replace(day=1), hoje)

        print(f"📆 25. Período do ranking INSS: {primeiro_dia} até {ultimo_dia}")

        # 2. Obter todos os agendamentos no período do ranking
        agendamentos = Agendamento.objects.filter(dia_agendado__range=[primeiro_dia, ultimo_dia])
        print(f"📌 26. Total de agendamentos no período: {agendamentos.count()}")

        # 3. Filtrar apenas aqueles com tabulacao_vendedor diferente de vazio
        agendamentos = agendamentos.filter(tabulacao_vendedor__isnull=False)
        print(f"📌 27. Após remover tabulação vazia: {agendamentos.count()}")

        # 4. Filtrar tabulacao_vendedor diferente de 'NÃO QUIS OUVIR'
        agendamentos = agendamentos.exclude(tabulacao_vendedor="NÃO QUIS OUVIR")
        print(f"📌 28. Após remover 'NÃO QUIS OUVIR': {agendamentos.count()}")

        # 5. Contar por atendente_agendou e criar uma lista ordenada
        ranking_inss = agendamentos.values('atendente_agendou').annotate(agendamentos_totais=Count('id')).order_by('-agendamentos_totais')

        # 6. Criar lista ordenada corretamente
        ranking_lista = list(ranking_inss)

        # 7. Determinar a posição do funcionário logado
        posicao = next((idx + 1 for idx, item in enumerate(ranking_lista) if item['atendente_agendou'] == funcionario.id), "N/A")

    print(f"🏆 29. Ranking calculado: Posição {posicao}")
    return posicao


# 2. API: lista todos os acessos
@require_GET
def api_get_acessos(request):
    acessos = Acesso.objects.filter(status=True).order_by('nome')
    data = [
        {
            'id': a.id,
            'nome': a.nome,
            'tipo': a.tipo,
            'data_criacao': a.data_criacao,
            'status': a.status,
            'codigo': a.gerar_codigo()
        }
        for a in acessos
    ]
    return JsonResponse({'acessos': data})

# 3. API: lista grupos de acessos com ids dos acessos
@require_GET
def api_get_groupsacesses(request):
    grupos = GroupsAcessos.objects.filter(status=True).order_by('titulo')
    data = [
        {
            'id': g.id,
            'titulo': g.titulo,
            'acessos': list(g.acessos.values_list('id', flat=True)),
            'data_criacao': g.data_criacao,
            'status': g.status
        }
        for g in grupos
    ]
    return JsonResponse({'groups_acessos': data})

# 4. API: lista usuários com nome do funcionário
@require_GET
def api_get_useracess(request):
    print("DEBUG: 4. Iniciando api_get_useracess")
    print("DEBUG: 4.1. Buscando Controles de Acessos ativos...")
    controles = ControleAcessos.objects.filter(status=True)
    print(f"DEBUG: 4.2. Encontrados {controles.count()} controles ativos.")
    data = []
    for c in controles:
        user = c.user
        print(f"DEBUG: 4.3. Processando controle para usuário ID: {user.id}, Username: {user.username}")
        # tenta obter nome do Funcionario
        try:
            nome = user.funcionario_profile.nome_completo
            print(f"DEBUG: 4.4. Nome do funcionário encontrado: {nome}")
        except Funcionario.DoesNotExist:
            nome = user.username
            print(f"DEBUG: 4.4. Perfil de funcionário não encontrado. Usando username: {nome}")
        
        acessos_ids = list(c.acessos.values_list('id', flat=True))
        print(f"DEBUG: 4.5. Acessos associados (IDs): {acessos_ids}")

        data.append({
            'user_id': user.id,
            'nome_funcionario': nome,
            'acessos': acessos_ids,
            'data_criacao': c.data_criacao,
            'status': c.status
        })
        print(f"DEBUG: 4.6. Dados do usuário {user.id} adicionados à lista.")

    print(f"DEBUG: 4.7. Preparando resposta JSON com {len(data)} usuários.")
    return JsonResponse({'user_acessos': data})



@require_GET
def api_get_infouser(request):
    """
    Retorna lista de usuários (user_id) e nome_completo do Funcionario vinculado.
    Apenas funcionários ativos são retornados.
    """
    # Pega apenas os Funcionarios ativos que têm usuário Django associado
    funcionarios = Funcionario.objects.filter(usuario__isnull=False, status=True)
    data = [
        {
            'user_id': f.usuario.id,
            'nome_completo': f.nome_completo
        }
        for f in funcionarios
    ]
    return JsonResponse({'infousers': data})


# 5. API: cria novo grupo de acessos
@require_POST
@csrf_exempt
def api_post_newgroupacess(request):
    payload = json.loads(request.body)
    titulo = payload.get('titulo')
    acessos_ids = payload.get('acessos', [])
    grupo = GroupsAcessos.objects.create(titulo=titulo)
    grupo.acessos.set(acessos_ids)
    return JsonResponse({'status': 'success', 'group_id': grupo.id})

# 6. API: cria novo acesso
@require_POST
@csrf_exempt
def api_post_newacesse(request):
    payload = json.loads(request.body)
    nome = payload.get('titulo')
    tipo = payload.get('tipo')
    acesso = Acesso.objects.create(nome=nome, tipo=tipo)
    return JsonResponse({'status': 'success', 'acesso_id': acesso.id})

# 7. API: registra acessos para um usuário
@require_POST
@csrf_exempt
def api_post_registeracessosuser(request):
    try:
        payload = json.loads(request.body)
        user_id = payload.get('user_id')
        acessos_ids = payload.get('acessos', [])
        
        # Validação básica
        if not user_id or not acessos_ids:
            return JsonResponse({
                'status': 'error',
                'message': 'ID do usuário e lista de acessos são obrigatórios'
            }, status=400)

        # Busca o usuário
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return JsonResponse({
                'status': 'error',
                'message': f'Usuário com ID {user_id} não encontrado'
            }, status=404)

        # Cria ou atualiza o controle de acesso
        controle, created = ControleAcessos.objects.get_or_create(user=user)
        controle.acessos.set(acessos_ids)
        controle.status = True
        controle.save()

        return JsonResponse({
            'status': 'success',
            'user_id': user.id,
            'message': 'Acessos registrados com sucesso'
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'JSON inválido no corpo da requisição'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao processar requisição: {str(e)}'
        }, status=500)

# 8. API: registra acessos para múltiplos usuários
@require_POST
@csrf_exempt
def api_post_registeracessosusers(request):
    try:
        payload = json.loads(request.body)
        user_ids = payload.get('user_ids', [])
        acessos_ids = payload.get('acessos', [])
        status = payload.get('status', True)

        # Validação básica
        if not user_ids or not acessos_ids:
            return JsonResponse({
                'status': 'error',
                'message': 'Lista de usuários e lista de acessos são obrigatórios'
            }, status=400)

        # Busca todos os usuários de uma vez
        users = User.objects.filter(id__in=user_ids)
        if not users.exists():
            return JsonResponse({
                'status': 'error',
                'message': 'Nenhum usuário encontrado com os IDs fornecidos'
            }, status=404)

        # Lista para armazenar resultados
        results = []
        errors = []

        # Processa cada usuário
        for user in users:
            try:
                # Cria ou atualiza o controle de acesso
                controle, created = ControleAcessos.objects.get_or_create(user=user)
                controle.acessos.set(acessos_ids)
                controle.status = status
                controle.save()

                results.append({
                    'user_id': user.id,
                    'status': 'success',
                    'message': 'Acessos registrados com sucesso'
                })
            except Exception as e:
                errors.append({
                    'user_id': user.id,
                    'status': 'error',
                    'message': str(e)
                })

        # Retorna o resultado consolidado
        return JsonResponse({
            'status': 'success',
            'total_processed': len(user_ids),
            'successful': len(results),
            'failed': len(errors),
            'results': results,
            'errors': errors
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'JSON inválido no corpo da requisição'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao processar requisição: {str(e)}'
        }, status=500)

# 9. API: adiciona acessos para múltiplos usuários (sem substituir existentes)
@require_POST
@csrf_exempt
def api_post_addacessosusers(request):
    try:
        payload = json.loads(request.body)
        user_ids = payload.get('user_ids', [])
        acessos_ids = payload.get('acessos', [])
        status = payload.get('status', True)

        # Validação básica
        if not user_ids or not acessos_ids:
            return JsonResponse({
                'status': 'error',
                'message': 'Lista de usuários e lista de acessos são obrigatórios'
            }, status=400)

        # Busca todos os usuários de uma vez
        users = User.objects.filter(id__in=user_ids)
        if not users.exists():
            return JsonResponse({
                'status': 'error',
                'message': 'Nenhum usuário encontrado com os IDs fornecidos'
            }, status=404)

        # Lista para armazenar resultados
        results = []
        errors = []

        # Processa cada usuário
        for user in users:
            try:
                # Busca ou cria o controle de acesso
                controle, created = ControleAcessos.objects.get_or_create(user=user)
                
                # Adiciona os novos acessos aos existentes
                current_acessos = list(controle.acessos.values_list('id', flat=True))
                new_acessos = list(set(current_acessos + acessos_ids))  # Remove duplicatas
                
                controle.acessos.set(new_acessos)
                controle.status = status
                controle.save()

                results.append({
                    'user_id': user.id,
                    'status': 'success',
                    'message': f'Acessos adicionados com sucesso. Total de acessos: {len(new_acessos)}',
                    'acessos_anteriores': len(current_acessos),
                    'acessos_adicionados': len(set(acessos_ids) - set(current_acessos)),
                    'total_acessos': len(new_acessos)
                })
            except Exception as e:
                errors.append({
                    'user_id': user.id,
                    'status': 'error',
                    'message': str(e)
                })

        # Retorna o resultado consolidado
        return JsonResponse({
            'status': 'success',
            'total_processed': len(user_ids),
            'successful': len(results),
            'failed': len(errors),
            'results': results,
            'errors': errors
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'status': 'error',
            'message': 'JSON inválido no corpo da requisição'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao processar requisição: {str(e)}'
        }, status=500)

@login_required
def render_alert_ti(request):
    """Renderiza a página de formulário de alertas TI"""
    if not request.user.is_superuser:
        return JsonResponse({'error': 'Acesso negado'}, status=403)
    return render(request, 'usuarios/forms_alert_ti.html')

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def api_post_alert_ti(request):
    """API para criar novo alerta"""
    if not request.user.is_superuser:
        return JsonResponse({'error': 'Acesso negado'}, status=403)
    
    try:
        mensagem = request.POST.get('mensagem')
        destinatarios_ids = request.POST.getlist('destinatarios[]')  # Agora recebe uma lista de IDs
        audio = request.FILES.get('audio')
        
        if not all([mensagem, destinatarios_ids, audio]):
            return JsonResponse({'error': 'Todos os campos são obrigatórios'}, status=400)
        
        # Cria o alerta
        alerta = AlertaTI.objects.create(
            mensagem=mensagem,
            audio=audio,
            criado_por=request.user
        )
        
        # Adiciona os destinatários
        alerta.destinatarios.set(destinatarios_ids)
        
        return JsonResponse({
            'status': 'success',
            'message': 'Alerta criado com sucesso',
            'alerta_id': alerta.id
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_http_methods(["GET"])
def api_get_alert_ti(request, alerta_id=None):
    """API para verificar novos alertas"""
    try:
        # print('🔍 [api_get_alert_ti] Iniciando verificação de alertas...')
        # print(f'🔍 [api_get_alert_ti] Usuário: {request.user.username}')
        # print(f'🔍 [api_get_alert_ti] Alerta ID: {alerta_id}')
        
        # Busca alertas ativos dos últimos 5 minutos
        cinco_minutos_atras = timezone.now() - timedelta(minutes=5)
        # print(f'🔍 [api_get_alert_ti] Buscando alertas após: {cinco_minutos_atras}')
        
        # Primeiro, busca todos os alertas ativos
        query = AlertaTI.objects.filter(
            ativo=True,
            data_criacao__gte=cinco_minutos_atras
        )
        
        # Se um ID específico foi fornecido, filtra por ele
        if alerta_id:
            # print(f'🔍 [api_get_alert_ti] Filtrando por alerta ID: {alerta_id}')
            query = query.filter(id=alerta_id)
        
        # Ordena por data de criação (mais recente primeiro)
        alertas = query.order_by('-data_criacao')
        # print(f'🔍 [api_get_alert_ti] Total de alertas encontrados: {alertas.count()}')
        
        # Filtra os alertas para o usuário atual
        alertas_usuario = []
        for alerta in alertas:
            if alerta.destinatarios.filter(id=request.user.id).exists():
                alertas_usuario.append(alerta)
        
        # print(f'🔍 [api_get_alert_ti] Total de alertas para o usuário: {len(alertas_usuario)}')
        
        if not alertas_usuario:
            # print('🔍 [api_get_alert_ti] Nenhum alerta encontrado para o usuário')
            return JsonResponse({'tem_alerta': False})
        
        # Pega o alerta mais recente
        alerta = alertas_usuario[0]
        # print(f'🔍 [api_get_alert_ti] Alerta mais recente ID: {alerta.id}')
        
        # Verifica se o usuário já viu este alerta
        ja_visto = AlertaTIVisto.objects.filter(
            alerta=alerta,
            usuario=request.user
        ).exists()
        # print(f'🔍 [api_get_alert_ti] Alerta já visto: {ja_visto}')
        
        # print('🔍 [api_get_alert_ti] Retornando dados do alerta')
        return JsonResponse({
            'tem_alerta': True,
            'alerta_id': alerta.id,
            'mensagem': alerta.mensagem,
            'audio_url': alerta.audio.url,
            'ja_visto': ja_visto
        })
        
    except Exception as e:
        # print(f'❌ [api_get_alert_ti] Erro: {str(e)}')
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def api_marcar_alerta_visto(request, alerta_id):
    """API para marcar um alerta como visto"""
    try:
        alerta = get_object_or_404(AlertaTI, id=alerta_id)
        
        # Verifica se o usuário é destinatário do alerta
        if not alerta.destinatarios.filter(id=request.user.id).exists():
            return JsonResponse({'error': 'Usuário não é destinatário deste alerta'}, status=403)
        
        # Marca o alerta como visto
        AlertaTIVisto.objects.get_or_create(
            alerta=alerta,
            usuario=request.user
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Alerta marcado como visto'
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_http_methods(["GET"])
def api_get_destinatarios(request, tipo):
    """API para listar destinatários por tipo"""
    try:
        if tipo == 'funcionarios':
            # Busca todos os funcionários ativos
            funcionarios = Funcionario.objects.filter(
                status=True,
                usuario__isnull=False
            ).select_related('usuario')
            
            data = [{
                'id': f.usuario.id,
                'nome': f.nome_completo
            } for f in funcionarios]
            
        elif tipo == 'empresas':
            # Busca todas as empresas ativas
            empresas = Empresa.objects.filter(status=True)
            data = [{
                'id': e.id,
                'nome': e.nome
            } for e in empresas]
            
        elif tipo == 'departamentos':
            # Busca todos os departamentos ativos
            departamentos = Departamento.objects.filter(status=True)
            data = [{
                'id': d.id,
                'nome': d.nome
            } for d in departamentos]
            
        elif tipo == 'setores':
            # Busca todos os setores ativos
            setores = Setor.objects.filter(status=True)
            data = [{
                'id': s.id,
                'nome': s.nome
            } for s in setores]
            
        elif tipo == 'lojas':
            # Busca todas as lojas ativas
            lojas = Loja.objects.filter(status=True)
            data = [{
                'id': l.id,
                'nome': l.nome
            } for l in lojas]
            
        elif tipo == 'equipes':
            # Busca todas as equipes ativas
            equipes = Equipe.objects.filter(status=True)
            data = [{
                'id': e.id,
                'nome': e.nome
            } for e in equipes]
            
        else:
            return JsonResponse({
                'error': f'Tipo de destinatário inválido: {tipo}. Tipos válidos: funcionarios, empresas, departamentos, setores, lojas, equipes'
            }, status=400)
            
        return JsonResponse(data, safe=False)
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

# -------------------------
# CONFIGURAÇÕES DO USUÁRIO
# -------------------------

@login_required
def render_configuracoes(request):
    """Renderiza a página de configurações do usuário"""
    return render(request, 'usuarios/configuracoes.html')

@login_required
@require_http_methods(["GET"])
def api_get_configuracoes(request):
    """API para obter as configurações do usuário"""
    try:
        configuracao, created = ConfiguracaoUsuario.objects.get_or_create(
            user=request.user,
            defaults={
                'modo_escuro': False,
                'manter_menu_aberto': False
            }
        )
        
        return JsonResponse({
            'modo_escuro': configuracao.modo_escuro,
            'manter_menu_aberto': configuracao.manter_menu_aberto
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@login_required
@require_http_methods(["POST"])
@csrf_exempt
def api_post_configuracoes(request):
    """API para atualizar as configurações do usuário"""
    try:
        modo_escuro = request.POST.get('modo_escuro') == 'true'
        manter_menu_aberto = request.POST.get('manter_menu_aberto') == 'true'
        
        configuracao, created = ConfiguracaoUsuario.objects.get_or_create(
            user=request.user,
            defaults={
                'modo_escuro': modo_escuro,
                'manter_menu_aberto': manter_menu_aberto
            }
        )
        
        if not created:
            configuracao.modo_escuro = modo_escuro
            configuracao.manter_menu_aberto = manter_menu_aberto
            configuracao.save()
        
        return JsonResponse({
            'status': 'success',
            'message': 'Configurações atualizadas com sucesso',
            'modo_escuro': configuracao.modo_escuro,
            'manter_menu_aberto': configuracao.manter_menu_aberto
        })
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)