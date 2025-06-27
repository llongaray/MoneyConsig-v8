# Importações da biblioteca padrão Python
import json
import re
import json
import traceback
import os
from datetime import *
import calendar
import csv
import io
from django.http import JsonResponse, HttpResponse
from django.shortcuts import *
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import Group
from django.db.models import Count, F, Max, Q, Sum, DecimalField
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_exempt
from django.core.exceptions import FieldError
from decimal import Decimal, InvalidOperation
from django.utils import timezone
from datetime import timedelta, datetime, date, time
from django.conf import settings

# Importações de terceiros
import pytz

# Importações locais
from custom_tags_app.permissions import check_access
from setup.utils import verificar_autenticacao
from django.core.exceptions import ValidationError


# Importações de apps
from .forms import *
from .models import *
from apps.funcionarios.models import *
from apps.siape.models import RegisterMoney, RegisterMeta
from apps.juridico.models import *
import re
from django.views.decorators.csrf import ensure_csrf_cookie


# renderização de paginas


from custom_tags_app.templatetags.permissionsacess import controle_acess

@login_required(login_url='/')
@controle_acess('SCT20')   # 20 – INSS | RANKING LOJAS
def render_ranking(request):
    """
    Renderiza a página de ranking do INSS.
    """
    return render(request, 'inss/ranking.html')


@login_required(login_url='/')
@controle_acess('SCT21')   # 21 – INSS | DASHBOARD INSS
def render_dashboard(request):
    """
    Renderiza a página principal do Dashboard INSS.
    """
    return render(request, 'inss/dashboard.html')


@login_required(login_url='/')
@controle_acess('SCT22')   # 22 – INSS | AGENDAMENTO
def render_agendamento(request):
    """
    Renderiza a página de gerenciamento de agendamentos do INSS.
    """
    return render(request, 'inss/agendamento.html')


@login_required(login_url='/')
@controle_acess('SCT23')   # 23 – INSS | LOJA
def render_loja(request):
    """
    Renderiza a página com a visão da loja/vendas do INSS.
    """
    return render(request, 'inss/loja.html')


@login_required(login_url='/')
@controle_acess('SCT24')   # 24 – INSS | FINANCEIRO
@ensure_csrf_cookie
def render_financeiro(request):
    """
    Renderiza a página de acompanhamento financeiro do INSS.
    """
    return render(request, 'inss/financeiro.html')


@login_required(login_url='/')
@controle_acess('CT6')     #  6 – INSS (Categoria)
def render_inss_forms(request):
    """
    Renderiza a página que centraliza o acesso aos formulários do INSS.
    (Ex: listagem de todos os formulários/agendamentos.)
    """
    return render(request, 'inss/all_forms.html')

# fim renderização de paginas



def format_cpf(cpf):
    """
    Formata o CPF para o padrão 000.000.000-00.
    Remove caracteres não numéricos e, se o CPF tiver 11 dígitos, aplica a formatação.
    """
    if cpf is None:
        return ""
    cpf = re.sub(r'\D', '', cpf)  # Remove todos os caracteres não numéricos
    if len(cpf) == 11:
        return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"
    return cpf

# Função auxiliar para obter a data/hora atual em SP
def get_current_sp_time():
    """
    Retorna a hora atual de SP:
     - se USE_TZ=True, converte now() (UTC-aware) para SP-aware
     - se USE_TZ=False, retorna agora naïve no fuso local do servidor
    """
    now = timezone.now()  # aware se USE_TZ=True, naïve caso contrário
    if settings.USE_TZ:
        # já é aware em UTC, basta converter para SP
        return timezone.localtime(now, SP_TZ)
    # sem fuso, devolve o naïve original
    return now

def make_aware_sp(dt_naive):
    """
    Torna um datetime naïve "aware" em SP, se USE_TZ=True.
    Se USE_TZ=False, retorna o datetime sem modificações.
    """
    if settings.USE_TZ:
        # dt_naive é naïve → atribui fuso São Paulo
        return SP_TZ.localize(dt_naive)
    return dt_naive

def calcular_status_dias(agendamento, hoje, presenca=None):
    """Calcula o status baseado nos dias entre hoje e o agendamento, considerando a presença."""

    # Verifica se já tem presença com tabulação do vendedor
    # (presenca pode ser None se não houver registro PresencaLoja associado)
    tabulacao_venda = getattr(presenca, 'tabulacao_venda', None) if presenca else None

    if tabulacao_venda: # Se vendedor já tabulou na PresencaLoja
        return 'FINALIZADO'

    # Se não finalizado, calcula baseado na data do agendamento
    # Verifica se é um dicionário ou objeto Agendamento
    if isinstance(agendamento, dict):
        dia_agendado_val = agendamento.get('dia_agendado')
    else:
        dia_agendado_val = agendamento.dia_agendado

    # Converte a data do agendamento para date se for string ou datetime
    if isinstance(dia_agendado_val, str):
        try:
            dia_agendado = datetime.strptime(dia_agendado_val, '%Y-%m-%d').date()
        except ValueError:
             # Tenta formato com hora se o primeiro falhar (vindo do DB)
             try:
                 dia_agendado = datetime.strptime(dia_agendado_val, '%Y-%m-%d %H:%M:%S%z').date()
             except (ValueError, TypeError):
                 return 'ERRO_DATA' # Retorna um status indicando erro na data
    elif isinstance(dia_agendado_val, datetime):
        dia_agendado = timezone.localtime(dia_agendado_val).date() # Converte para data local
    elif isinstance(dia_agendado_val, date):
        dia_agendado = dia_agendado_val
    else:
        return 'ERRO_DATA' # Não foi possível determinar a data

    # Calcula a diferença de dias
    try:
        dias_diferenca = (dia_agendado - hoje).days
    except TypeError:
        return 'ERRO_DATA' # Se 'hoje' não for compatível

    # Retorna o status baseado na diferença de dias
    if dias_diferenca > 0:
        return 'FUTURO'
    elif dias_diferenca == 0:
        return 'HOJE'
    else: # dias_diferenca < 0
        return 'ATRASADO'

def format_percentage(value):
    """Formata um valor Decimal ou float como porcentagem com uma casa decimal."""
    if value is None or not isinstance(value, (Decimal, float, int)):
        return "0.0%"
    try:
        return f"{Decimal(value):.1f}%"
    except:
        return "0.0%"

def format_currency(value):
    """Formata um valor Decimal como moeda brasileira (R$)."""
    if value is None or not isinstance(value, Decimal):
        # Tenta converter se for numérico, senão retorna 0
        try:
            value = Decimal(value)
        except:
            value = Decimal('0.0')

    try:
        # Formatação básica para R$
        return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "R$ 0,00"
    

def _filter_por_hierarquia(qs, user):
    """
    Filtra agendamentos por hierarquia do usuário:
    - estágio/padrão: apenas próprios
    - coordenador/gerente: própria loja + próprios
    - demais: todos
    """
    if user.is_superuser:
        return qs

    try:
        func = Funcionario.objects.select_related('cargo').prefetch_related('lojas').get(usuario=user)
    except Funcionario.DoesNotExist:
        return Agendamento.objects.none()

    nivel = func.cargo.hierarquia if func.cargo else None
    lojas = func.lojas.all()

    if nivel in [Cargo.HierarquiaChoices.ESTAGIO, Cargo.HierarquiaChoices.PADRAO]:
        return qs.filter(atendente_agendou=user)
    if nivel in [Cargo.HierarquiaChoices.COORDENADOR, Cargo.HierarquiaChoices.GERENTE]:
        return qs.filter(Q(loja__in=lojas) | Q(atendente_agendou=user))
    return qs  # outros níveis sem filtro adicional


def _serialize_agendamento(a):
    """
    Converte um Agendamento em dict simples para JSON.
    """
    cliente = a.cliente_agendamento
    usuario = a.atendente_agendou

    # tenta pegar nome do funcionário, senão user.username
    try:
        atendente = Funcionario.objects.get(usuario=usuario).nome_completo
    except:
        atendente = f"{usuario.first_name} {usuario.last_name}".strip() or usuario.username

    # data do agendamento no formato YYYY-MM-DD HH:mm
    if settings.USE_TZ:
        dt = timezone.localtime(a.dia_agendado)
    else:
        dt = a.dia_agendado
    dia_str = dt.strftime('%Y-%m-%d %H:%M') if dt else ''

    return {
        'id': a.id,
        'nome_cliente': cliente.nome_completo if cliente else 'N/A',
        'cliente_agendamento_id': cliente.id if cliente else None,
        'cpf_cliente': getattr(cliente, 'cpf', 'N/A'),
        'numero_cliente': getattr(cliente, 'numero', 'N/A'),
        'dia_agendado': dia_str,
        'atendente_agendou': atendente,
        'loja_agendada': a.loja.nome if a.loja else 'N/A',
        'loja_id': a.loja.id if a.loja else None,
    }


# -------------------------------------------
# INICIO TEMPLATE FINANCEIRO.HTML
# -------------------------------------------

@login_required
@require_GET
@ensure_csrf_cookie
def api_get_historicopagamentos(request):
    try:
        base_query = PresencaLoja.objects.filter(
            valor_tac__isnull=False,
            valor_tac__gt=0,
            data_pagamento__isnull=False,
            status_pagamento=PresencaLoja.StatusPagamentoChoices.PAGO
        )

        try:
            historico_qs = (
                base_query
                .filter(vendedor__isnull=False)
                .select_related(
                    'loja_comp',
                    'vendedor',
                    'agendamento__cliente_agendamento',
                    'cliente_agendamento'
                )
                .order_by('-data_pagamento')
            )
            print(f"Consulta histórico de pagamentos executada com sucesso. "
                  f"Registros pagos encontrados: {historico_qs.count()}")
        except FieldError as fe:
            print(f"Erro de campo no filtro: {fe}")
            return JsonResponse({
                'error': 'Erro na configuração do filtro. Verifique os modelos relacionados ao vendedor.',
                'details': str(fe)
            }, status=500)

        data_list = []
        for pl in historico_qs:
            # Determina dados do cliente
            if pl.agendamento and pl.agendamento.cliente_agendamento:
                cli = pl.agendamento.cliente_agendamento
            else:
                cli = pl.cliente_agendamento
            data_list.append({
                'id': pl.id,
                'cliente_nome': getattr(cli, 'nome_completo', 'N/A'),
                'cliente_cpf': getattr(cli, 'cpf', 'N/A'),
                'loja_nome': pl.loja_comp.nome if pl.loja_comp else 'N/A',
                'data_pagamento': pl.data_pagamento.strftime('%d/%m/%Y') if pl.data_pagamento else '-',
                'valor_tac': format_currency(pl.valor_tac),
                'status_pagamento': pl.get_status_pagamento_display(),
            })

        return JsonResponse({'historico': data_list})

    except Exception as e:
        print(f"Erro inesperado em api_get_historicopagamentos: {e}")
        print(traceback.format_exc())
        return JsonResponse({
            'error': 'Ocorreu um erro interno ao processar a solicitação.',
            'details': str(e)
        }, status=500)


@login_required
@require_GET
@ensure_csrf_cookie
def api_get_cardsfinanceiro(request):
    try:
        hoje = timezone.now().date()
        print(f"Iniciando api_get_cardsfinanceiro. Data atual: {hoje}")

        # --- Período Ano Atual ---
        inicio_ano = hoje.replace(month=1, day=1)
        fim_ano    = hoje.replace(month=12, day=31)
        dt1 = datetime.combine(inicio_ano, time.min)
        dt2 = datetime.combine(fim_ano,    time.max)
        if settings.USE_TZ:
            start_dt_ano = timezone.make_aware(dt1)
            end_dt_ano   = timezone.make_aware(dt2)
        else:
            start_dt_ano = dt1
            end_dt_ano   = dt2
        print(f"Período ano: {start_dt_ano} a {end_dt_ano}")

        # --- Período Mês Atual ---
        inicio_mes = hoje.replace(day=1)
        try:
            proximo_mes = inicio_mes.replace(month=inicio_mes.month + 1)
        except ValueError:
            proximo_mes = inicio_mes.replace(year=inicio_mes.year + 1, month=1)
        fim_mes = proximo_mes - timedelta(days=1)

        dt3 = datetime.combine(inicio_mes, time.min)
        dt4 = datetime.combine(fim_mes,    time.max)
        if settings.USE_TZ:
            start_dt_mes = timezone.make_aware(dt3)
            end_dt_mes   = timezone.make_aware(dt4)
        else:
            start_dt_mes = dt3
            end_dt_mes   = dt4
        print(f"Período mês: {start_dt_mes} a {end_dt_mes}")

        # --- Consultas e Agregações ---
        base_tac_query = PresencaLoja.objects.filter(
            valor_tac__isnull=False,
            valor_tac__gt=0
        )
        print(f"Quantidade de TACs válidos no sistema: {base_tac_query.count()}")

        agregados_ano = base_tac_query.filter(
            data_presenca__gte=start_dt_ano,
            data_presenca__lte=end_dt_ano
        ).aggregate(
            total_pago_ano=Sum(
                'valor_tac',
                filter=Q(status_pagamento=PresencaLoja.StatusPagamentoChoices.PAGO),
                output_field=DecimalField()
            ),
            total_pendente_ano=Sum(
                'valor_tac',
                filter=Q(status_pagamento=PresencaLoja.StatusPagamentoChoices.EM_ESPERA),
                output_field=DecimalField()
            ),
            qtd_pago_ano=Count(
                'id',
                filter=Q(status_pagamento=PresencaLoja.StatusPagamentoChoices.PAGO)
            )
        )
        print(f"Agregados ano: {agregados_ano}")

        agregados_mes = base_tac_query.filter(
            data_presenca__gte=start_dt_mes,
            data_presenca__lte=end_dt_mes
        ).aggregate(
            total_pago_mes=Sum(
                'valor_tac',
                filter=Q(status_pagamento=PresencaLoja.StatusPagamentoChoices.PAGO),
                output_field=DecimalField()
            ),
            total_pendente_mes=Sum(
                'valor_tac',
                filter=Q(status_pagamento=PresencaLoja.StatusPagamentoChoices.EM_ESPERA),
                output_field=DecimalField()
            ),
            qtd_pago_mes=Count(
                'id',
                filter=Q(status_pagamento=PresencaLoja.StatusPagamentoChoices.PAGO)
            )
        )
        print(f"Agregados mês: {agregados_mes}")

        total_tc_ano           = agregados_ano.get('total_pago_ano') or Decimal('0.0')
        total_tc_ano_pendente  = agregados_ano.get('total_pendente_ano') or Decimal('0.0')
        qtd_tc_ano             = agregados_ano.get('qtd_pago_ano') or 0

        total_tc_mes           = agregados_mes.get('total_pago_mes') or Decimal('0.0')
        total_tc_mes_pendente  = agregados_mes.get('total_pendente_mes') or Decimal('0.0')
        qtd_tc_mes             = agregados_mes.get('qtd_pago_mes') or 0

        data = {
            'totalTCAno':            format_currency(total_tc_ano),
            'totalTCAnoPendente':    format_currency(total_tc_ano_pendente),
            'totalTCMes':            format_currency(total_tc_mes),
            'totalTCMesPendente':    format_currency(total_tc_mes_pendente),
            'qtdTCAno':              qtd_tc_ano,
            'qtdTCMes':              qtd_tc_mes,
        }
        print(f"Dados formatados para retorno: {data}")

        return JsonResponse(data)

    except Exception as e:
        print(f"Erro em api_get_cardsfinanceiro: {e}")
        print(traceback.format_exc())
        return JsonResponse({
            'error': f'Erro interno ao calcular dados financeiros: {str(e)}'
        }, status=500)

# -------------------------------------------
# FIM TEMPLATE FINANCEIRO.HTML
# -------------------------------------------

@login_required
@require_GET
@ensure_csrf_cookie
def api_get_tac(request):
    """
    API para buscar presenças em loja com valor TAC pendente.
    
    Retorna um JSON com todas as presenças que possuem valor_tac diferente de vazio ou 0,
    e com status de pagamento 'EM ESPERA'.
    
    Retorna para cada presença:
    - id: ID da presença
    - nome_cliente: Nome do cliente
    - cpf_cliente: CPF do cliente
    - loja: Nome da loja onde ocorreu o atendimento
    - data: Data do atendimento
    - valor_tac: Valor do TAC formatado como moeda
    """
    try:
        # Filtra presenças com valor_tac preenchido e diferente de zero, com status 'EM ESPERA'
        presencas = PresencaLoja.objects.filter(
            valor_tac__isnull=False,
            valor_tac__gt=0,
            status_pagamento=PresencaLoja.StatusPagamentoChoices.EM_ESPERA
        ).select_related(
            'agendamento__cliente_agendamento',
            'cliente_agendamento',
            'loja_comp',
            'vendedor'
        )
        
        # Prepara os dados para retorno
        presencas_data = []
        
        for presenca in presencas:
            # Determina o cliente (pode vir do agendamento ou diretamente da presença)
            cliente_obj = None
            if presenca.agendamento and presenca.agendamento.cliente_agendamento:
                cliente_obj = presenca.agendamento.cliente_agendamento
            elif presenca.cliente_agendamento:
                cliente_obj = presenca.cliente_agendamento
                
            # Só adiciona se tiver cliente identificado
            if cliente_obj:
                presencas_data.append({
                    'id': presenca.id,
                    'nome_cliente': cliente_obj.nome_completo,
                    'cpf_cliente': cliente_obj.cpf,
                    'loja': presenca.loja_comp.nome if presenca.loja_comp else 'N/A',
                    'data': presenca.data_presenca.strftime('%d/%m/%Y %H:%M'),
                    'valor_tac': format_currency(presenca.valor_tac)
                })
        
        return JsonResponse({
            'success': True,
            'presencas': presencas_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Erro ao buscar TACs pendentes: {str(e)}'
        }, status=500)

@login_required
@require_POST
@csrf_exempt # << TEMPORÁRIO PARA DIAGNÓSTICO
def api_post_tac(request):
    """
    API para registrar um TAC no sistema financeiro (RegisterMoney).

    Recebe o ID da presença em loja (PresencaLoja) e cria um novo RegisterMoney
    no app SIAPE utilizando os dados do cliente, loja, valor TAC da presença,
    e as informações organizacionais (empresa, departamento, setor, equipe)
    do funcionário associado ao vendedor no momento do registro.

    Parâmetros esperados no corpo da requisição POST:
    - presenca_id: ID da PresencaLoja

    Retorna:
    - success: True/False
    - message: Mensagem de sucesso ou erro
    - register_money_id: ID do registro financeiro criado (em caso de sucesso)
    """
    try:
        # Obtém o ID da presença do corpo da requisição POST
        presenca_id = request.POST.get('presenca_id')

        if not presenca_id:
            return JsonResponse({
                'success': False,
                'message': 'ID da presença não fornecido.'
            }, status=400)

        # Busca a presença pelo ID, otimizando com select_related
        try:
            presenca = PresencaLoja.objects.select_related(
                'agendamento__cliente_agendamento',
                'cliente_agendamento',
                'loja_comp',
                'vendedor' # Garante que o User vendedor seja carregado
            ).get(id=presenca_id)
        except PresencaLoja.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': f'Presença com ID {presenca_id} não encontrada.'
            }, status=404)
        except ValueError: # Caso presenca_id não seja um número válido
             return JsonResponse({
                'success': False,
                'message': 'ID da presença inválido.'
            }, status=400)

        # Verifica se a presença tem valor_tac válido
        if not presenca.valor_tac or presenca.valor_tac <= 0:
            return JsonResponse({
                'success': False,
                'message': 'Presença não possui valor TAC válido para registro.'
            }, status=400)

        # Verifica se o status já é PAGO para evitar duplicidade
        if presenca.status_pagamento == PresencaLoja.StatusPagamentoChoices.PAGO:
             return JsonResponse({
                'success': False,
                'message': 'Este TAC já foi registrado anteriormente.'
            }, status=409) # Conflict

        # Determina o cliente (pode vir do agendamento ou diretamente da presença)
        cliente_obj = None
        if presenca.agendamento and presenca.agendamento.cliente_agendamento:
            cliente_obj = presenca.agendamento.cliente_agendamento
        elif presenca.cliente_agendamento:
            cliente_obj = presenca.cliente_agendamento

        if not cliente_obj:
            return JsonResponse({
                'success': False,
                'message': 'Cliente não identificado na presença.'
            }, status=400)

        # Verifica se há um vendedor associado à presença
        if not presenca.vendedor:
             return JsonResponse({
                'success': False,
                'message': 'Vendedor não associado a esta presença.'
            }, status=400)

        # Importa os modelos necessários
        from apps.siape.models import RegisterMoney
        from apps.funcionarios.models import Funcionario

        # Busca o Funcionario associado ao User vendedor para obter dados organizacionais
        funcionario = None
        try:
            # Otimiza buscando os campos relacionados necessários
            funcionario = Funcionario.objects.select_related(
                'empresa', 'departamento', 'setor', 'equipe'
            ).get(usuario=presenca.vendedor)
        except Funcionario.DoesNotExist:
            # Se não encontrar o funcionário, os campos organizacionais ficarão nulos
            # Pode ser útil logar um aviso aqui, dependendo da regra de negócio
            # logger.warning(f"Funcionário não encontrado para o usuário {presenca.vendedor.id} ao registrar TAC da presença {presenca.id}")
            pass # Continua a execução, os campos serão None

        # Prepara os dados para criar o RegisterMoney
        register_data = {
            'user': presenca.vendedor,
            'loja': presenca.loja_comp,
            'cpf_cliente': cliente_obj.cpf,
            'valor_est': presenca.valor_tac,
            'status': True,  # Status ativo por padrão
            'data': timezone.now(), # Data/Hora do registro financeiro
            # Associa os dados organizacionais do funcionário no momento do registro
            'empresa': funcionario.empresa if funcionario else None,
            'departamento': funcionario.departamento if funcionario else None,
            'setor': funcionario.setor if funcionario else None,
            'equipe': funcionario.equipe if funcionario else None,
        }

        # Cria o novo registro no RegisterMoney
        # Idealmente, envolver a criação e a atualização da presença em uma transação
        # from django.db import transaction
        # with transaction.atomic():
        register_money = RegisterMoney.objects.create(**register_data)

        # Atualiza o status da presença para PAGO e define a data de pagamento
        presenca.status_pagamento = PresencaLoja.StatusPagamentoChoices.PAGO
        presenca.data_pagamento = timezone.now().date() # Grava apenas a data do pagamento
        presenca.save(update_fields=['status_pagamento', 'data_pagamento']) # Otimiza o save

        return JsonResponse({
            'success': True,
            'message': 'TAC registrado com sucesso no sistema financeiro.',
            'register_money_id': register_money.id
        })

    except Exception as e:
        # Logar o erro seria importante em produção
        # logger.error(f"Erro inesperado em api_post_tac para presenca_id {request.POST.get('presenca_id')}: {e}", exc_info=True)
        return JsonResponse({
            'success': False,
            'message': f'Erro interno ao registrar TAC: {str(e)}'
        }, status=500)

@login_required
@require_POST
@csrf_exempt # << TEMPORÁRIO PARA DIAGNÓSTICO
@ensure_csrf_cookie
def api_post_attvalortac(request):
    """
    API para atualizar o valor TAC de uma presença em loja.
    
    Recebe:
    - id: ID da PresencaLoja
    - valor_tac: Novo valor TAC
    
    Retorna:
    - success: True/False
    - valor_antigo: Valor TAC anterior
    - valor_novo: Novo valor TAC
    - message: Mensagem de sucesso ou erro
    """
    try:
        # Obtém os parâmetros da requisição
        presenca_id = request.POST.get('id')
        novo_valor_tac = request.POST.get('valor_tac')
        
        # Validação básica
        if not presenca_id or not novo_valor_tac:
            return JsonResponse({
                'success': False,
                'message': 'Parâmetros incompletos. ID e valor_tac são obrigatórios.'
            }, status=400)
            
        # Converte o valor para decimal
        try:
            novo_valor_tac = Decimal(novo_valor_tac)
        except:
            return JsonResponse({
                'success': False,
                'message': 'Valor TAC inválido. Informe um valor numérico.'
            }, status=400)
            
        # Busca a presença pelo ID
        try:
            presenca = PresencaLoja.objects.get(id=presenca_id)
        except PresencaLoja.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': f'Presença com ID {presenca_id} não encontrada.'
            }, status=404)
            
        # Armazena o valor antigo para retornar na resposta
        valor_antigo = presenca.valor_tac
        
        # Atualiza o valor TAC
        presenca.valor_tac = novo_valor_tac
        presenca.save()
        
        # Retorna resposta de sucesso
        return JsonResponse({
            'success': True,
            'message': 'Valor TAC atualizado com sucesso',
            'valor_antigo': float(valor_antigo) if valor_antigo else 0,
            'valor_novo': float(novo_valor_tac)
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao atualizar valor TAC: {str(e)}'
        }, status=500)


# -------------------------------------------
# FIM TEMPLATE FINANCEIRO.HTML
# Funções relacionadas à página financeira (financeiro.html)
# -------------------------------------------

# -------------------------------------------
# INICIO TEMPLATE LOJA.HTML
# Funções relacionadas à página de lojas (loja.html)
# -------------------------------------------

def _local(dt):
    """Garante que dt seja aware antes de chamar localtime."""
    if not dt:
        return None
    if settings.USE_TZ:
        # torna aware se for naive
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_default_timezone())
        return timezone.localtime(dt)
    return dt

@login_required
@require_GET
@ensure_csrf_cookie
@controle_acess('SCT23')
def api_get_agendadosHoje(request):
    print(f"[DEBUG] Iniciando api_get_agendadosHoje para usuário: {request.user}")
    
    user  = request.user
    hoje  = _local(timezone.now()).date()
    print(f"[DEBUG] Data de hoje: {hoje}")

    # 1️⃣ Base: agendamentos de hoje sem presença
    base_qs = Agendamento.objects.filter(
        dia_agendado__date=hoje,
        presencas__isnull=True
    ).select_related('cliente_agendamento', 'loja', 'atendente_agendou')
    print(f"[DEBUG] Total de agendamentos base: {base_qs.count()}")

    # 2️⃣ Se for superuser, libera tudo
    if user.is_superuser:
        qs = base_qs
        print("[DEBUG] Acesso total - superuser")
    else:
        # 3️⃣ Perfil do funcionário
        func = Funcionario.objects.filter(
            usuario=user, status=True
        ).prefetch_related('lojas').first()
        if not func or not func.lojas.exists():
            print("[DEBUG] Funcionário não encontrado ou sem loja")
            return JsonResponse({'agendamentos': [], 'message': 'Sem permissão'}, status=200)

        hier = func.cargo.hierarquia if func.cargo else Cargo.HierarquiaChoices.PADRAO
        print(f"[DEBUG] Hierarquia do usuário: {hier}")

        # 4️⃣ Filtro de acesso por hierarquia
        if hier == Cargo.HierarquiaChoices.SUPERVISOR_GERAL:
            qs = base_qs
            print("[DEBUG] Acesso total - supervisor(a) geral")
        elif hier >= Cargo.HierarquiaChoices.GERENTE:
            qs = base_qs.exclude(loja__is_franquia=True)
            print("[DEBUG] Filtro gerente - excluindo franquias")
        else:
            qs = base_qs.filter(loja__in=func.lojas.all())
            print(f"[DEBUG] Filtro loja específica: {func.lojas.all()}")

    # 5️⃣ Filtros opcionais por querystring
    nome = request.GET.get('nomeCliente','').strip()
    cpf  = ''.join(c for c in request.GET.get('cpfCliente','') if c.isdigit())
    aten = request.GET.get('atendente','').strip()
    
    print(f"[DEBUG] Filtros recebidos - Nome: {nome}, CPF: {cpf}, Atendente: {aten}")
    
    if nome:
        qs = qs.filter(cliente_agendamento__nome_completo__icontains=nome)
        print(f"[DEBUG] Aplicando filtro por nome: {nome}")
    if cpf:
        qs = qs.filter(cliente_agendamento__cpf__icontains=cpf)
        print(f"[DEBUG] Aplicando filtro por CPF: {cpf}")
    if aten:
        qs = qs.filter(
            Q(atendente_agendou__first_name__icontains=aten) |
            Q(atendente_agendou__last_name__icontains=aten)   |
            Q(atendente_agendou__username__icontains=aten)
        )
        print(f"[DEBUG] Aplicando filtro por atendente: {aten}")

    # 6️⃣ Monta resultado
    resultado = []
    for a in qs:
        dt = _local(a.dia_agendado)
        data_hora = dt.strftime('%d/%m/%Y %H:%M') if dt else ''
        usr = a.atendente_agendou
        nome_at = (usr.get_full_name() or usr.username) if usr else ''
        resultado.append({
            'id_agendamento': a.id,
            'nome':           a.cliente_agendamento.nome_completo,
            'cpf':            a.cliente_agendamento.cpf,
            'numero':         a.cliente_agendamento.numero,
            'dia_agendado':   data_hora,
            'atendente':      nome_at,
            'status':         'Aguardando',
            'loja':           a.loja.nome if a.loja else 'Sem loja',
            'loja_id':        a.loja.id if a.loja else None
        })

    print(f"[DEBUG] Total de agendamentos retornados: {len(resultado)}")
    return JsonResponse({'agendamentos': resultado, 'total': len(resultado)}, status=200)



@login_required
@require_GET
@ensure_csrf_cookie
@controle_acess('SCT23')
def api_get_agendPendentes(request):
    user = request.user
    hoje = _local(timezone.now()).date()

    # 1️⃣ Base: apenas pendentes (não 'CONFIRMADO') a partir de hoje
    base_qs = (
        Agendamento.objects
        .exclude(tabulacao_agendamento='CONFIRMADO')
        .filter(dia_agendado__date__gte=hoje)
        .select_related('cliente_agendamento', 'loja', 'atendente_agendou')
    )

    # 2️⃣ Acesso irrestrito para superuser
    if user.is_superuser:
        qs = base_qs
    else:
        # 3️⃣ Perfil do funcionário
        func = (
            Funcionario.objects
            .filter(usuario=user, status=True)
            .prefetch_related('lojas')
            .first()
        )
        if not func or not func.lojas.exists():
            return JsonResponse({'agendamentos': [], 'message': 'Sem permissão'}, status=200)

        hier = func.cargo.hierarquia if func.cargo else Cargo.HierarquiaChoices.PADRAO

        # 4️⃣ Supervisor(a) Geral sem filtro
        if hier == Cargo.HierarquiaChoices.SUPERVISOR_GERAL:
            qs = base_qs
        # 5️⃣ Gerentes e acima (exceto superuser) veem todas as não-franquias
        elif hier >= Cargo.HierarquiaChoices.GERENTE:
            qs = base_qs.exclude(loja__is_franquia=True)
        # 6️⃣ Demais veem apenas a própria loja
        else:
            qs = base_qs.filter(loja__in=func.lojas.all())

    # 7️⃣ Filtros opcionais via querystring
    nome = request.GET.get('nomeCliente', '').strip()
    cpf  = ''.join(c for c in request.GET.get('cpfCliente', '') if c.isdigit())
    aten = request.GET.get('atendente', '').strip()
    stat = request.GET.get('status', '').strip()

    if nome:
        qs = qs.filter(cliente_agendamento__nome_completo__icontains=nome)
    if cpf:
        qs = qs.filter(cliente_agendamento__cpf__icontains=cpf)
    if aten:
        qs = qs.filter(
            Q(atendente_agendou__first_name__icontains=aten) |
            Q(atendente_agendou__last_name__icontains=aten)   |
            Q(atendente_agendou__username__icontains=aten)
        )
    if stat:
        qs = qs.filter(tabulacao_agendamento__icontains=stat)

    # 8️⃣ Monta array de resultado
    resultado = []
    for a in qs:
        dt = _local(a.dia_agendado)
        dia = dt.strftime('%Y-%m-%d') if dt else ''
        usr = a.atendente_agendou
        nome_at = (usr.get_full_name() or usr.username) if usr else ''
        resultado.append({
            'agendamento_id':             a.id,
            'cliente_agendamento_nome':   a.cliente_agendamento.nome_completo,
            'cliente_agendamento_cpf':    a.cliente_agendamento.cpf,
            'cliente_agendamento_numero': a.cliente_agendamento.numero,
            'agendamento_dia':            dia,
            'agendamento_atendente_nome': nome_at,
            'agendamento_tabulacao':      a.tabulacao_agendamento or '',
            'agendamento_loja_id':        a.loja.id if a.loja else None,
            'agendamento_loja_nome':      a.loja.nome if a.loja else 'Sem loja',
            'tem_presenca':               hasattr(a, 'presenca'),
        })

    return JsonResponse({'agendamentos': resultado, 'total': len(resultado)}, status=200)

@login_required
@require_GET
@ensure_csrf_cookie
@controle_acess('SCT23')
def api_get_clientesAtrasadoLoja(request):
    """
    Lista clientes com dia_agendado < hoje, tabulacao != 'CONFIRMADO'
    e sem PresencaLoja registrada.
    Superuser e Supervisor(a) Geral veem todos sem filtro de loja.
    """
    print(f"[DEBUG] Iniciando api_get_clientesAtrasadoLoja. User: {request.user}")
    user = request.user
    hoje = _local(timezone.now()).date()
    print(f"[DEBUG] Data de hoje: {hoje}")

    # base: agendamentos passados não confirmados e sem presença
    base_qs = (
        Agendamento.objects
        .filter(dia_agendado__date__lt=hoje)
        .exclude(tabulacao_agendamento='CONFIRMADO')
        .filter(presencas__isnull=True)
        .select_related('cliente_agendamento', 'loja', 'atendente_agendou')
    )
    print(f"[DEBUG] Total de agendamentos base: {base_qs.count()}")

    # 1️⃣ Se for superuser, acesso total
    if user.is_superuser:
        qs = base_qs
        print("[DEBUG] Superuser – acesso total")
    else:
        # 2️⃣ Busca perfil do funcionário
        func = (
            Funcionario.objects
            .filter(usuario=user, status=True)
            .prefetch_related('lojas')
            .first()
        )
        if not func:
            print("[DEBUG] Sem perfil de funcionário")
            return JsonResponse({'agendamentos': [], 'message': 'Sem permissão'}, status=200)

        hier = func.cargo.hierarquia if func.cargo else Cargo.HierarquiaChoices.PADRAO
        print(f"[DEBUG] Hierarquia do usuário: {hier}")

        # 3️⃣ Supervisor(a) Geral sem filtro de loja
        if hier == Cargo.HierarquiaChoices.SUPERVISOR_GERAL:
            qs = base_qs
            print("[DEBUG] Supervisor(a) Geral – acesso total")
        # 4️⃣ Gerentes veem todas as lojas, exceto franquias
        elif hier >= Cargo.HierarquiaChoices.GERENTE:
            qs = base_qs.exclude(loja__is_franquia=True)
            print("[DEBUG] Gerente – excluindo franquias")
        # 5️⃣ Demais: apenas a própria loja
        else:
            if not func.lojas.exists():
                print("[DEBUG] Funcionário sem loja associada")
                return JsonResponse({'agendamentos': [], 'message': 'Sem permissão'}, status=200)
            qs = base_qs.filter(loja__in=func.lojas.all())
            print(f"[DEBUG] Filtrando pelas lojas: {func.lojas.all()}")

    # 6️⃣ Filtros opcionais
    nome = request.GET.get('nomeCliente', '').strip()
    cpf  = ''.join(c for c in request.GET.get('cpfCliente', '') if c.isdigit())
    aten = request.GET.get('atendente', '').strip()
    stat = request.GET.get('status', '').strip()
    print(f"[DEBUG] Filtros recebidos – Nome: {nome}, CPF: {cpf}, Atendente: {aten}, Status: {stat}")

    if nome:
        qs = qs.filter(cliente_agendamento__nome_completo__icontains=nome)
        print(f"[DEBUG] Aplicando filtro por nome: {nome}")
    if cpf:
        qs = qs.filter(cliente_agendamento__cpf__icontains=cpf)
        print(f"[DEBUG] Aplicando filtro por CPF: {cpf}")
    if aten:
        qs = qs.filter(
            Q(atendente_agendou__first_name__icontains=aten) |
            Q(atendente_agendou__last_name__icontains=aten)   |
            Q(atendente_agendou__username__icontains=aten)
        )
        print(f"[DEBUG] Aplicando filtro por atendente: {aten}")
    if stat:
        qs = qs.filter(tabulacao_agendamento__icontains=stat)
        print(f"[DEBUG] Aplicando filtro por status: {stat}")

    print(f"[DEBUG] Total após filtros: {qs.count()}")

    # 7️⃣ Monta resultado
    resultado = []
    for a in qs.order_by('dia_agendado'):
        dt = _local(a.dia_agendado)
        data_hora = dt.strftime('%d/%m/%Y %H:%M') if dt else ''
        usr = a.atendente_agendou
        nome_at = (usr.get_full_name() or usr.username) if usr else ''
        resultado.append({
            'id_agendamento': a.id,
            'nome':            a.cliente_agendamento.nome_completo,
            'cpf':             a.cliente_agendamento.cpf,
            'numero':          a.cliente_agendamento.numero,
            'dia_agendado':    data_hora,
            'atendente':       nome_at,
            'status':          a.tabulacao_agendamento,
            'loja':            a.loja.nome if a.loja else 'Sem loja',
            'loja_id':         a.loja.id if a.loja else None
        })

    print(f"[DEBUG] Total de resultados encontrados: {len(resultado)}")
    return JsonResponse({'agendamentos': resultado, 'total': len(resultado)}, status=200)

@login_required
@require_GET
@ensure_csrf_cookie
def api_get_infocliente(request):
    ag_id = request.GET.get('agendamento_id')
    if not ag_id:
        return JsonResponse({'error': 'ID não fornecido'}, status=400)
    a = Agendamento.objects.select_related('cliente_agendamento', 'loja', 'atendente_agendou') \
        .filter(id=ag_id).first()
    if not a:
        return JsonResponse({'error': 'Agendamento não encontrado'}, status=404)

    dt_cr = _local(a.data_criacao)
    dt_ag = _local(a.dia_agendado)
    data_fmt = dt_ag.strftime('%d/%m/%Y') if dt_ag else ''
    hora_fmt = dt_ag.strftime('%H:%M') if dt_ag else ''

    usr = a.atendente_agendou
    nome_at = (usr.get_full_name() or usr.username) if usr else ''
    # busca cargo
    cargo_at = Funcionario.objects.filter(usuario=usr, status=True).select_related('cargo') \
        .first()
    cargo_nome = cargo_at.cargo.nome if cargo_at and cargo_at.cargo else None

    tem = hasattr(a, 'presenca')
    resposta = {
        'agendamento': {
            'id': a.id,
            'data_criacao': dt_cr.strftime('%d/%m/%Y %H:%M') if dt_cr else '',
            'dia_agendado': data_fmt,
            'hora_agendada': hora_fmt,
            'tabulacao': a.tabulacao_agendamento or '',
            'tem_presenca': tem
        },
        'cliente': {
            'id': a.cliente_agendamento.id,
            'nome_completo': a.cliente_agendamento.nome_completo,
            'cpf': a.cliente_agendamento.cpf,
            'numero_contato': a.cliente_agendamento.numero,
            'possui_whatsapp': a.cliente_agendamento.flg_whatsapp,
            'status': a.cliente_agendamento.status
        },
        'loja': {
            'id': a.loja.id if a.loja else None,
            'nome': a.loja.nome if a.loja else 'Sem loja'
        },
        'atendente': {
            'id': usr.id if usr else None,
            'nome': nome_at,
            'cargo': cargo_nome
        }
    }
    return JsonResponse(resposta, status=200)

@login_required
@require_POST
def api_post_novavenda(request):
    print("[NOVA_VENDA] Iniciando processamento de nova venda")
    try:
        # 1. Printar todos os campos recebidos
        print(f'[NOVA_VENDA] Campos recebidos no POST:')
        for k, v in request.POST.items():
            print(f'  {k}: {v}')
        
        # 2. Verificar/obter cliente
        cpf = (request.POST.get('cpf_cliente') or request.POST.get('cpf', '')).replace('.', '').replace('-', '')
        nome = request.POST.get('nome_cliente') or request.POST.get('nome_completo') or request.POST.get('nome')
        numero = request.POST.get('numero_cliente') or request.POST.get('numero')
        if not cpf or not nome or not numero:
            return JsonResponse({'status': 'error', 'message': 'Nome, CPF e número são obrigatórios'}, status=400)
        try:
            cliente = ClienteAgendamento.objects.get(cpf=cpf)
            print(f"[NOVA_VENDA] Cliente existente encontrado: {cliente.id}")
            cliente.nome_completo = nome
            cliente.numero = numero
            cliente.save()
        except ClienteAgendamento.DoesNotExist:
            cliente = ClienteAgendamento.objects.create(
                nome_completo=nome,
                cpf=cpf,
                numero=numero
            )
            print(f"[NOVA_VENDA] Novo cliente criado: {cliente.id}")
        
        # 3. Obter dados comuns
        loja_id = request.POST.get('loja')
        vendedor_id = request.POST.get('vendedor_id')
        tabulacao = request.POST.get('tabulacao_vendedor') or request.POST.get('tabulacao') or 'NEGOCIO_FECHADO'
        data_comparecimento = request.POST.get('data_comparecimento') or request.POST.get('data')
        try:
            loja = Loja.objects.get(id=loja_id)
            funcionario = Funcionario.objects.get(id=vendedor_id)
            vendedor = User.objects.get(id=funcionario.usuario_id)
        except Exception as e:
            print(f'[NOVA_VENDA] Erro ao buscar loja/vendedor: {e}')
            return JsonResponse({'status': 'error', 'message': 'Loja ou vendedor não encontrado'}, status=404)
        
        # 4. Montar lista de produtos a partir dos campos do FormData
        produtos = []
        
        # Verificar se os produtos foram enviados como JSON
        produtos_json = request.POST.get('produtos_json')
        if produtos_json:
            import json
            try:
                produtos = json.loads(produtos_json)
                print(f'[NOVA_VENDA] Produtos recebidos via JSON: {produtos}')
            except json.JSONDecodeError as e:
                print(f'[NOVA_VENDA] Erro ao decodificar JSON de produtos: {e}')
        else:
            # Método antigo: descobrir quantos produtos vieram via campos individuais
            indices = set()
            for key in request.POST.keys():
                if key.startswith('produtos['):
                    idx = key.split('[')[1].split(']')[0]
                    if idx.isdigit():
                        indices.add(int(idx))
            indices = sorted(indices)
            print(f'[NOVA_VENDA] Indices de produtos encontrados: {indices}')
            for idx in indices:
                produto = {
                    'produto_id': request.POST.get(f'produtos[{idx}][produto_id]'),
                    'tipo_negociacao': request.POST.get(f'produtos[{idx}][tipo_negociacao]'),
                    'banco': request.POST.get(f'produtos[{idx}][banco]'),
                    'valor_tac': request.POST.get(f'produtos[{idx}][valor_tac]'),
                    'subsidio': request.POST.get(f'produtos[{idx}][subsidio]'),
                    'associacao': request.POST.get(f'produtos[{idx}][associacao]'),
                    'aumento': request.POST.get(f'produtos[{idx}][aumento]'),
                }
                print(f'[NOVA_VENDA] Produto {idx}: {produto}')
                produtos.append(produto)
        
        # Verificar se temos produtos para processar
        if tabulacao == 'NEGOCIO_FECHADO' and not produtos:
            return JsonResponse({'status': 'error', 'message': 'Para NEGÓCIO FECHADO é necessário adicionar pelo menos um produto'}, status=400)
        
        # 5. Criar uma PresencaLoja para cada produto
        presencas_ids = []
        for produto in produtos:
            try:
                # Processar valor TAC
                vt_str = produto.get('valor_tac','0').replace('R$','').replace('.','').replace(',','.')
                try: vt_dec = Decimal(vt_str)
                except: vt_dec = Decimal('0')
                
                # Buscar nome do produto se for passado produto_id
                tipo_negociacao = produto.get('tipo_negociacao', '')
                produto_id = produto.get('produto_id')
                
                if produto_id and produto_id.isdigit():
                    try:
                        from apps.siape.models import Produto
                        produto_obj = Produto.objects.get(id=int(produto_id))
                        tipo_negociacao = produto_obj.nome
                        print(f'[NOVA_VENDA] Produto encontrado: {tipo_negociacao} (ID: {produto_id})')
                    except Exception as e:
                        print(f'[NOVA_VENDA] Erro ao buscar produto com ID {produto_id}: {e}')
                
                presenca = PresencaLoja.objects.create(
                    cliente_agendamento=cliente,
                    loja_comp=loja,
                    vendedor=vendedor,
                    tabulacao_venda=tabulacao,
                    tipo_negociacao=(tipo_negociacao or '').upper(),
                    banco=(produto.get('banco') or '').upper(),
                    subsidio=str(produto.get('subsidio')).lower() in ('true','1','sim'),
                    valor_tac=vt_dec,
                    associacao=str(produto.get('associacao')).lower() in ('true','1','sim'),
                    aumento=str(produto.get('aumento')).lower() in ('true','1','sim'),
                    cliente_rua=True,
                    data_presenca=timezone.now(),
                )
                presencas_ids.append(presenca.id)
                print(f'[NOVA_VENDA] PresencaLoja criada para produto {tipo_negociacao}: {presenca.id}')
            except Exception as e:
                print(f'[NOVA_VENDA] Erro ao criar PresencaLoja para produto {produto}: {e}')
        print(f'[NOVA_VENDA] Total de presenças criadas: {len(presencas_ids)}')
        return JsonResponse({
            'status': 'success',
            'message': f'{len(presencas_ids)} presença(s) registrada(s) para cliente rua',
            'presencas_ids': presencas_ids
        })
    except Exception as e:
        print(f"[NOVA_VENDA] Erro ao processar nova venda: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@login_required
@require_POST
def api_post_addvenda(request):
    ag_id   = request.POST.get('agendamento_id','').strip()
    vend_id = request.POST.get('vendedor_id','').strip()
    raw_tab = request.POST.get('tabulacao_vendedor','').strip()
    loja_id = request.POST.get('loja_id','').strip()

    # 1️⃣ Campos obrigatórios
    if not all([ag_id, vend_id, raw_tab]):
        return JsonResponse({'status':'error','message':'Campos obrigatórios faltando'}, status=400)

    # 2️⃣ Normaliza tabulação
    TAB_MAP = {
        'NEGÓCIO FECHADO':  PresencaLoja.TabulacaoVendaChoices.NEGOCIO_FECHADO,
        'FECHOU NEGOCIO':   PresencaLoja.TabulacaoVendaChoices.NEGOCIO_FECHADO,
        'INELEGÍVEL':       PresencaLoja.TabulacaoVendaChoices.INELEGIVEL,
        'INELEGIVEL':       PresencaLoja.TabulacaoVendaChoices.INELEGIVEL,
        'NÃO ACEITOU':      PresencaLoja.TabulacaoVendaChoices.NAO_ACEITOU,
        'NAO ACEITOU':      PresencaLoja.TabulacaoVendaChoices.NAO_ACEITOU,
        'NÃO QUIS OUVIR':   PresencaLoja.TabulacaoVendaChoices.NAO_QUIS_OUVIR,
        'NAO QUIS OUVIR':   PresencaLoja.TabulacaoVendaChoices.NAO_QUIS_OUVIR,
        'PENDENTE':         PresencaLoja.TabulacaoVendaChoices.PENDENTE,
    }
    tab_v = TAB_MAP.get(raw_tab, raw_tab.replace(' ', '_').upper())
    if tab_v not in PresencaLoja.TabulacaoVendaChoices.values:
        return JsonResponse({
            'status':'error','message':f"Tabulação inválida: '{raw_tab}'."
        }, status=400)

    # 3️⃣ Carrega agendamento
    try:
        ag = Agendamento.objects.get(id=ag_id)
    except Agendamento.DoesNotExist:
        return JsonResponse({'status':'error','message':'Agendamento não encontrado'}, status=404)

    # Carrega vendedor
    try:
        vend = User.objects.get(id=vend_id)
    except User.DoesNotExist:
        return JsonResponse({'status':'error','message':'Vendedor não encontrado'}, status=404)

    # Carrega loja (ou usa a do agendamento)
    if loja_id:
        try:
            loja = Loja.objects.get(id=loja_id)
        except Loja.DoesNotExist:
            return JsonResponse({'status':'error','message':'Loja não encontrada'}, status=404)
    else:
        loja = ag.loja

    pres_ids = []

    # 4️⃣ NEGÓCIO FECHADO → itera sobre produtos JSON
    if tab_v == PresencaLoja.TabulacaoVendaChoices.NEGOCIO_FECHADO:
        raw = request.POST.get('produtos_json','[]')
        try:
            produtos = json.loads(raw)
        except json.JSONDecodeError:
            return JsonResponse({'status':'error','message':'JSON de produtos inválido'}, status=400)

        if not isinstance(produtos, list) or not produtos:
            return JsonResponse({
                'status':'error',
                'message':'Ao menos um produto é obrigatório para NEGÓCIO FECHADO'
            }, status=400)

        total_tac = Decimal('0')
        for info in produtos:
            # parsing...
            vt_str = info.get('valor_tac','0').replace('R$','').replace('.','').replace(',','.')
            try: vt_dec = Decimal(vt_str)
            except: vt_dec = Decimal('0')
            total_tac += vt_dec

            # monta PresencaLoja
            p = PresencaLoja(
                agendamento       = ag,
                loja_comp         = loja,
                vendedor          = vend,
                tabulacao_venda   = tab_v,
                tipo_negociacao   = info.get('tipo_negociacao','').upper(),
                banco             = info.get('banco','').upper(),
                subsidio          = str(info.get('subsidio')).lower() in ('true','1','sim'),
                valor_tac         = vt_dec,
                acao              = str(info.get('acao')).lower() in ('true','1','sim'),
                associacao        = str(info.get('associacao')).lower() in ('true','1','sim'),
                aumento           = str(info.get('aumento')).lower() in ('true','1','sim'),
                status_pagamento  = PresencaLoja.StatusPagamentoChoices.EM_ESPERA,
                data_presenca     = timezone.now(),  # Adiciona data da presença
            )
            # Salva sem validar unicidade de agendamento
            p.save()
            pres_ids.append(p.id)

        # Atualiza status do agendamento
        if ag.tabulacao_agendamento != 'CONFIRMADO':
            ag.tabulacao_agendamento = 'CONFIRMADO'
        ag.status_atendimento = Agendamento.StatusAtendimentoChoices.EM_ATENDIMENTO
        ag.save()

        return JsonResponse({
            'status':'success',
            'message':f'{len(pres_ids)} produto(s) registrado(s)',
            'presencas_ids': pres_ids,
            'valor_total_tac': f'R$ {total_tac:.2f}'.replace('.',',')
        })

    # 5️⃣ Fluxo padrão (sem produtos)
    p = PresencaLoja(
        agendamento     = ag,
        loja_comp       = loja,
        vendedor        = vend,
        tabulacao_venda = tab_v,
        data_presenca   = timezone.now()  # Adiciona data da presença
    )
    p.save()
    pres_ids.append(p.id)

    # Atualiza status do agendamento
    if ag.tabulacao_agendamento != 'CONFIRMADO':
        ag.tabulacao_agendamento = 'CONFIRMADO'
    ag.status_atendimento = Agendamento.StatusAtendimentoChoices.EM_ATENDIMENTO
    ag.save()

    return JsonResponse({
        'status':'success',
        'message':'Presença registrada',
        'presenca_id': p.id
    })

@login_required
@require_GET
def api_get_infolojaefuncionario(request):
    """
    API para buscar informações de lojas ativas e funcionários permitidos.
    
    Aplica filtros baseados na hierarquia do usuário:
    - Superuser: vê todas as lojas e todos os funcionários
    - Supervisor Geral: vê todas as lojas e todos os funcionários
    - Gerente: vê todas as lojas não-franquia e funcionários dessas lojas
    - Coordenador: vê suas lojas e funcionários dessas lojas
    - Demais (ESTAGIO, PADRAO): vê apenas suas lojas e apenas o próprio usuário como funcionário
    
    Parâmetros:
    - loja_id (opcional): ID da loja para filtrar funcionários
    """
    try:
        user = request.user
        print(f"[INFO_LOJA_FUNC] Usuário: {user.username}")
        
        # Verificar se foi passado loja_id como parâmetro
        loja_id_param = request.GET.get('loja_id')
        print(f"[INFO_LOJA_FUNC] Parâmetro loja_id: {loja_id_param}")
        
        # Inicializa queryset vazias
        lojas_qs = Loja.objects.none()
        funcionarios_qs = Funcionario.objects.none()
        
        # Variável para armazenar a hierarquia do usuário
        user_hierarquia = None
        
        # Se for superuser, retorna todas as lojas e todos os funcionários
        if user.is_superuser:
            print(f"[INFO_LOJA_FUNC] Usuário é superuser - acesso total")
            lojas_qs = Loja.objects.filter(status=True)
            funcionarios_qs = Funcionario.objects.filter(status=True, cargo__isnull=False)
        else:
            # Procura o funcionário associado ao usuário logado
            try:
                funcionario = Funcionario.objects.select_related('cargo').prefetch_related('lojas').get(usuario=user, status=True)
                hier = funcionario.cargo.hierarquia if funcionario.cargo else None
                # Armazena a hierarquia para uso posterior
                user_hierarquia = hier
                
                print(f"[INFO_LOJA_FUNC] Usuário tem hierarquia: {hier}")
                
                # Supervisor Geral - acesso total
                if hier == Cargo.HierarquiaChoices.SUPERVISOR_GERAL:
                    print(f"[INFO_LOJA_FUNC] Supervisor Geral - acesso total")
                    lojas_qs = Loja.objects.filter(status=True)
                    funcionarios_qs = Funcionario.objects.filter(status=True, cargo__isnull=False)
                
                # Gerente - todas as lojas não-franquia e funcionários dessas lojas
                elif hier == Cargo.HierarquiaChoices.GERENTE:
                    print(f"[INFO_LOJA_FUNC] Gerente - lojas não-franquia")
                    lojas_qs = Loja.objects.filter(status=True, franquia=False)
                    # Funcionários dessas lojas
                    funcionarios_qs = Funcionario.objects.filter(
                        status=True, 
                        cargo__isnull=False,
                        lojas__in=lojas_qs
                    ).distinct()
                
                # Coordenador - suas lojas e funcionários dessas lojas
                elif hier == Cargo.HierarquiaChoices.COORDENADOR:
                    print(f"[INFO_LOJA_FUNC] Coordenador - lojas próprias")
                    lojas_qs = funcionario.lojas.filter(status=True)
                    # Funcionários dessas lojas
                    funcionarios_qs = Funcionario.objects.filter(
                        status=True, 
                        cargo__isnull=False,
                        lojas__in=lojas_qs
                    ).distinct()
                
                # ESTAGIO ou PADRAO (níveis 1 e 2) - apenas suas lojas e apenas o próprio usuário
                elif hier in [Cargo.HierarquiaChoices.ESTAGIO, Cargo.HierarquiaChoices.PADRAO]:
                    print(f"[INFO_LOJA_FUNC] Nível básico (ESTAGIO/PADRAO) - apenas próprio usuário")
                    lojas_qs = funcionario.lojas.filter(status=True)
                    # Apenas o próprio funcionário
                    funcionarios_qs = Funcionario.objects.filter(
                        usuario=user,
                        status=True
                    )
                
                # Demais - suas lojas e funcionários dessas lojas
                else:
                    print(f"[INFO_LOJA_FUNC] Outro nível - lojas próprias")
                    lojas_qs = funcionario.lojas.filter(status=True)
                    # Funcionários dessas lojas
                    funcionarios_qs = Funcionario.objects.filter(
                        status=True, 
                        cargo__isnull=False,
                        lojas__in=lojas_qs
                    ).distinct()
            
            except Funcionario.DoesNotExist:
                print(f"[INFO_LOJA_FUNC] Funcionário não encontrado para usuário {user.username}")
                return JsonResponse({"error": "Funcionário não encontrado"}, status=404)
        
        # Se foi passado loja_id, filtrar funcionários por essa loja específica
        if loja_id_param:
            try:
                loja_id = int(loja_id_param)
                print(f"[INFO_LOJA_FUNC] Filtrando funcionários pela loja ID: {loja_id}")
                # Filtrar funcionários que trabalham na loja específica
                funcionarios_qs = funcionarios_qs.filter(lojas__id=loja_id).distinct()
            except (ValueError, TypeError):
                print(f"[INFO_LOJA_FUNC] loja_id inválido: {loja_id_param}")
                return JsonResponse({"error": "ID da loja inválido"}, status=400)
        
        # Converter QuerySets para dicionários
        lojas_dict = {loja.id: {'id': loja.id, 'nome': loja.nome} for loja in lojas_qs}
        
        # Para níveis 1 e 2 (ESTAGIO e PADRAO), o value do funcionário será o user_id
        if user_hierarquia in [Cargo.HierarquiaChoices.ESTAGIO, Cargo.HierarquiaChoices.PADRAO]:
            funcionarios_dict = {func.usuario.id: {'id': func.usuario.id, 'nome': func.nome_completo} 
                               for func in funcionarios_qs if func.usuario}
        else:
            funcionarios_dict = {func.id: {'id': func.id, 'nome': func.nome_completo} for func in funcionarios_qs}
        
        # Obter produtos ativos (sem filtro de hierarquia)
        try:
            from apps.siape.models import Produto
            produtos = Produto.objects.filter(ativo=True)
            produtos_dict = {prod.id: {'id': prod.id, 'nome': prod.nome} for prod in produtos}
        except Exception as e:
            print(f"[INFO_LOJA_FUNC] Erro ao carregar produtos: {e}")
            produtos_dict = {}
        
        print(f"[INFO_LOJA_FUNC] Retornando {len(lojas_dict)} lojas e {len(funcionarios_dict)} funcionários")
        return JsonResponse({
            'status': 'success',
            'lojas': lojas_dict,
            'funcionarios': funcionarios_dict,
            'produtos': produtos_dict
        })
    except Exception as e:
        import traceback
        print(f"[INFO_LOJA_FUNC] Erro: {str(e)}")
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': str(e)
        }, status=500)

@csrf_exempt
@require_POST
def api_post_agendamento(request):
    print(">>> Iniciando processamento do agendamento")
    try:
        payload = json.loads(request.body)
        print("Dados recebidos:", payload)
    except json.JSONDecodeError:
        return JsonResponse({'texto': 'Dados inválidos', 'classe': 'error'}, status=400)

    try:
        # 1️⃣ Extrai campos do JSON
        nome_cliente          = payload.get('nome_cliente')
        cpf_cliente_raw       = payload.get('cpf_cliente')
        numero_cliente        = payload.get('numero_cliente')
        dia_agendado_str      = payload.get('dia_agendado')        # precisa existir no JSON
        loja_agendada_id      = payload.get('loja_agendada')
        usuario_atendente_id  = payload.get('funcionario_atendente')

        # Validação básica
        faltam = []
        if not nome_cliente:      faltam.append('Nome')
        if not cpf_cliente_raw:   faltam.append('CPF')
        if not numero_cliente:    faltam.append('Número')
        if not dia_agendado_str:  faltam.append('Dia Agendado')
        if not loja_agendada_id:  faltam.append('Loja')
        if not usuario_atendente_id: faltam.append('Funcionário')
        if faltam:
            return JsonResponse({
                'texto': f"Campos obrigatórios faltando: {', '.join(faltam)}",
                'classe': 'error'
            }, status=400)

        # 2️⃣ Processa CPF
        cpf_limpo = re.sub(r'\D', '', cpf_cliente_raw)
        if len(cpf_limpo) != 11:
            raise ValueError("CPF inválido.")

        # 3️⃣ Converte dia_agendado para datetime
        #    Espera que dia_agendado_str venha no formato 'YYYY-MM-DD'
        try:
            dia_naive = datetime.strptime(dia_agendado_str, '%Y-%m-%d')
        except ValueError:
            raise ValueError("Formato de data inválido. Use YYYY-MM-DD.")

        # Se sua aplicação usa TZ, torne aware; senão, mantenha naive
        if settings.USE_TZ:
            dia_agendado = timezone.make_aware(
                datetime.combine(dia_naive.date(), timezone.now().time()),
                timezone.get_default_timezone()
            )
        else:
            # Garante que esse datetime não tenha tzinfo
            dia_agendado = dia_naive.replace(
                hour=timezone.now().hour,
                minute=timezone.now().minute,
                second=timezone.now().second,
                microsecond=0
            )

        # 4️⃣ ClienteAgendamento
        cliente, created = ClienteAgendamento.objects.get_or_create(
            cpf=cpf_limpo,
            defaults={
                'nome_completo': nome_cliente.upper(),
                'numero': numero_cliente,
                'status': True
            }
        )
        msg_cliente = "Cliente Cadastrado!" if created else "Cliente Já existe, contato atualizado!"
        if not created:
            updated = False
            if cliente.numero != numero_cliente:
                cliente.numero = numero_cliente; updated = True
            if cliente.nome_completo != nome_cliente.upper():
                cliente.nome_completo = nome_cliente.upper(); updated = True
            if not cliente.status:
                cliente.status = True; updated = True
            if updated:
                cliente.save()

        # 5️⃣ Recupera atendente e loja
        try:
            atendente = User.objects.get(pk=int(usuario_atendente_id))
        except User.DoesNotExist:
            raise ValueError("Funcionário selecionado não existe.")

        try:
            loja_obj = Loja.objects.get(pk=int(loja_agendada_id))
        except Loja.DoesNotExist:
            raise ValueError("Loja selecionada não existe.")

        # 6️⃣ Cria o Agendamento
        agendamento = Agendamento.objects.create(
            cliente_agendamento=cliente,
            dia_agendado=dia_agendado,
            loja=loja_obj,
            atendente_agendou=atendente,
            tabulacao_agendamento='EM ESPERA'
        )
        msg_agendamento = f"Agendamento {agendamento.id} registrado com sucesso!"

        # 7️⃣ Resposta
        texto = f"{msg_cliente} {msg_agendamento}".strip()
        return JsonResponse({'texto': texto, 'classe': 'success'}, status=201)

    except ValueError as ve:
        print("Erro de validação:", ve)
        return JsonResponse({'texto': str(ve), 'classe': 'error'}, status=400)
    except Exception as e:
        import traceback
        print("Exception inesperada:", e)
        traceback.print_exc()
        return JsonResponse({'texto': 'Erro interno.', 'classe': 'error'}, status=500)

@csrf_exempt
@require_POST
def api_post_confirmagem(request):
    """
    Confirma ou reagenda um Agendamento:
      - tabulacao_agendamento é sempre obrigatória
      - se for REAGENDADO, nova_dia_agendado (YYYY-MM-DD) é obrigatória
      - DESISTIU apenas atualiza a tabulação
    Retorna JSON com 'texto' e 'classe' ('success' ou 'error').
    """
    # 1️⃣ Parse dos dados (JSON ou form-encoded)
    if request.content_type.startswith('application/json'):
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({'texto': 'JSON mal formatado', 'classe': 'error'}, status=400)
    else:
        data = request.POST

    # 2️⃣ Validação do ID do agendamento
    ag_id = data.get('agendamento_id')
    if not ag_id:
        return JsonResponse({'texto': 'ID do agendamento não fornecido', 'classe': 'error'}, status=400)
    try:
        ag_id = int(ag_id)
    except ValueError:
        return JsonResponse({'texto': 'ID do agendamento inválido', 'classe': 'error'}, status=400)

    # 3️⃣ Busca do Agendamento
    try:
        ag = Agendamento.objects.get(pk=ag_id)
    except Agendamento.DoesNotExist:
        return JsonResponse({'texto': 'Agendamento não encontrado', 'classe': 'error'}, status=404)

    # 4️⃣ Tabulação do atendente/agendamento
    nova_tab = data.get('tabulacao_agendamento') or data.get('tabulacao_atendente')
    if not nova_tab:
        return JsonResponse({'texto': 'Tabulação não fornecida', 'classe': 'error'}, status=400)
    ag.tabulacao_agendamento = nova_tab

    # 5️⃣ Se for REAGENDADO, valida e atualiza data
    if nova_tab.upper() == 'REAGENDADO':
        nova_data = data.get('nova_dia_agendado')
        if not nova_data:
            return JsonResponse({'texto': 'Nova data obrigatória para reagendamento', 'classe': 'error'}, status=400)
        try:
            d = datetime.strptime(nova_data, '%Y-%m-%d').date()
        except ValueError:
            return JsonResponse({'texto': 'Formato de data inválido. Use YYYY-MM-DD', 'classe': 'error'}, status=400)

        # une com hora atual de SP e torna aware
        hora_sp = get_current_sp_time().time()
        dt_comb = datetime.combine(d, hora_sp)
        ag.dia_agendado = make_aware_sp(dt_comb)

    # 6️⃣ Se for DESISTIU, apenas tabulação é atualizada (sem campo extra)

    # 7️⃣ Salva e retorna sucesso
    ag.save()
    return JsonResponse({'texto': 'Agendamento atualizado com sucesso 😊', 'classe': 'success'}, status=200)

@csrf_exempt
@require_GET
def api_get_submodal_cliente(request):
    """
    API que recebe 'agendamento_id' ou 'cpf_cliente' e retorna:
    - dados do agendamento
    - dados da presença (PresencaLoja), se houver
    """
    try:
        agendamento_id    = request.GET.get('agendamento_id')
        cpf_cliente_param = request.GET.get('cpf_cliente')

        # 1) busca o Agendamento
        qs = Agendamento.objects.select_related(
            'cliente_agendamento', 'loja', 'atendente_agendou'
        )
        if agendamento_id:
            ag = qs.filter(pk=agendamento_id).first()
            if not ag:
                return JsonResponse(
                    {'texto': 'Agendamento não encontrado pelo ID', 'classe': 'error'},
                    status=404
                )
        elif cpf_cliente_param:
            cpf_limpo = re.sub(r'\D', '', cpf_cliente_param)
            if len(cpf_limpo) != 11:
                return JsonResponse(
                    {'texto': 'CPF inválido fornecido', 'classe': 'error'},
                    status=400
                )
            ag = qs.filter(
                cliente_agendamento__cpf=cpf_limpo
            ).order_by('-dia_agendado').first()
            if not ag:
                # se cliente existe mas sem agendamento...
                cliente = ClienteAgendamento.objects.filter(cpf=cpf_limpo).first()
                if cliente:
                    return JsonResponse({
                        'texto': 'Cliente sem agendamentos registrados.',
                        'cliente_info': {
                            'nome': cliente.nome_completo,
                            'cpf': cliente.cpf,
                            'numero': cliente.numero
                        }
                    }, status=404)
                return JsonResponse(
                    {'texto': 'Nenhum cliente ou agendamento encontrado', 'classe': 'error'},
                    status=404
                )
        else:
            return JsonResponse(
                {'texto': 'agendamento_id ou cpf_cliente não fornecido', 'classe': 'error'},
                status=400
            )

        # 2) Serializa dados do cliente
        cli = ag.cliente_agendamento
        cliente_data = {
            'nome_cliente':   cli.nome_completo if cli else 'N/A',
            'cpf_cliente':    getattr(cli, 'cpf', 'N/A'),
            'numero_cliente': getattr(cli, 'numero', 'N/A'),
        }

        # formata dia_agendado
        dt = ag.dia_agendado
        if dt and settings.USE_TZ:
            dt = timezone.localtime(dt)
        dia_ag = dt.strftime('%Y-%m-%d %H:%M') if dt else ''

        # nome do atendente que agendou
        atend = ag.atendente_agendou
        if atend:
            fn = Funcionario.objects.filter(usuario=atend).first()
            atend_nome = fn.apelido.split()[0] if fn and fn.apelido else (atend.get_full_name() or atend.username)
        else:
            atend_nome = 'N/A'

        agendamento_data = {
            'id': ag.id,
            'dia_agendado': dia_ag,
            'atendente_agendou': atend_nome,
            'loja_agendada': ag.loja.nome if ag.loja else 'N/A',
            'loja_id': ag.loja.id if ag.loja else None,
            'tabulacao_agendamento': ag.tabulacao_agendamento or '',
        }

        # 3) Pega a primeira PresencaLoja, se existir
        pres = ag.presencas.first()
        if pres:
            # nome do vendedor
            vend_fn = Funcionario.objects.filter(usuario=pres.vendedor).first()
            vendedor_nome = (
                vend_fn.apelido.split()[0] if vend_fn and vend_fn.apelido
                else (pres.vendedor.get_full_name() or pres.vendedor.username)
            ) if pres.vendedor else 'N/A'

            presenca_data = {
                'tabulacao_vendedor':    pres.tabulacao_venda or '',
                'tipo_negociacao':       pres.tipo_negociacao or '',
                'banco':                 pres.banco or '',
                'subsidio':              bool(pres.subsidio),
                'tac':                   str(pres.valor_tac or ''),
                'acao':                  bool(pres.acao),
                'associacao':            bool(pres.associacao),
                'aumento':               bool(pres.aumento),
                'status_tac':            pres.get_status_pagamento_display() or '',
                'data_pagamento_tac':    pres.data_pagamento.strftime('%Y-%m-%d') if pres.data_pagamento else '',
                'cliente_rua':           bool(pres.cliente_rua),
                'vendedor_loja':         vendedor_nome,
            }
        else:
            presenca_data = {
                'tabulacao_vendedor': '', 'tipo_negociacao': '', 'banco': '',
                'subsidio': False,       'tac': '',              'acao': False,
                'associacao': False,     'aumento': False,       'status_tac': '',
                'data_pagamento_tac': '', 'cliente_rua': False,  'vendedor_loja': 'N/A',
            }

        # 4) combina tudo
        resultado = {**cliente_data, **agendamento_data, **presenca_data}
        return JsonResponse(resultado, status=200)

    except Exception:
        traceback.print_exc()
        return JsonResponse(
            {'texto': 'Erro interno ao obter submodal do cliente', 'classe': 'error'},
            status=500
        )


@csrf_exempt
@require_GET
@login_required
def api_get_agendados(request):
    """
    Retorna agendamentos com tabulação 'EM ESPERA'.
    """
    try:
        qs = Agendamento.objects.filter(
            tabulacao_agendamento='EM ESPERA'
        ).select_related('cliente_agendamento', 'loja', 'atendente_agendou')
        qs = _filter_por_hierarquia(qs, request.user)
        
        # Serializa os resultados
        agendamentos = []
        for ag in qs.order_by('-dia_agendado'):
            agendamentos.append({
                'id': ag.id,
                'nome_cliente': ag.cliente_agendamento.nome_completo if ag.cliente_agendamento else 'N/A',
                'cliente_agendamento_id': ag.cliente_agendamento.id if ag.cliente_agendamento else None,
                'cpf_cliente': ag.cliente_agendamento.cpf if ag.cliente_agendamento else 'N/A',
                'numero_cliente': ag.cliente_agendamento.numero if ag.cliente_agendamento else 'N/A',
                'dia_agendado': ag.dia_agendado.strftime('%Y-%m-%d %H:%M') if ag.dia_agendado else 'N/A',
                'atendente_agendou': ag.atendente_agendou.get_full_name() if ag.atendente_agendou else 'N/A',
                'loja_agendada': ag.loja.nome if ag.loja else 'N/A',
                'loja_id': ag.loja.id if ag.loja else None,
            })
        return JsonResponse({'agendamentos': agendamentos}, status=200)
    except Exception as e:
        return JsonResponse({'texto': f'Erro: {str(e)}', 'classe': 'error'}, status=500)


@csrf_exempt
@require_GET
@login_required
def api_get_reagendados(request):
    """
    Retorna agendamentos com tabulação 'REAGENDADO'.
    """
    try:
        qs = Agendamento.objects.filter(
            tabulacao_agendamento='REAGENDADO'
        ).select_related('cliente_agendamento', 'loja', 'atendente_agendou')
        qs = _filter_por_hierarquia(qs, request.user)
        
        # Serializa os resultados
        agendamentos = []
        for ag in qs.order_by('-dia_agendado'):
            agendamentos.append({
                'id': ag.id,
                'nome_cliente': ag.cliente_agendamento.nome_completo if ag.cliente_agendamento else 'N/A',
                'cliente_agendamento_id': ag.cliente_agendamento.id if ag.cliente_agendamento else None,
                'cpf_cliente': ag.cliente_agendamento.cpf if ag.cliente_agendamento else 'N/A',
                'numero_cliente': ag.cliente_agendamento.numero if ag.cliente_agendamento else 'N/A',
                'dia_agendado': ag.dia_agendado.strftime('%Y-%m-%d %H:%M') if ag.dia_agendado else 'N/A',
                'atendente_agendou': ag.atendente_agendou.get_full_name() if ag.atendente_agendou else 'N/A',
                'loja_agendada': ag.loja.nome if ag.loja else 'N/A',
                'loja_id': ag.loja.id if ag.loja else None,
            })
        return JsonResponse({'agendamentos': agendamentos}, status=200)
    except Exception as e:
        return JsonResponse({'texto': f'Erro: {str(e)}', 'classe': 'error'}, status=500)


@csrf_exempt
@require_GET
@login_required
def api_get_atrasados(request):
    """
    Retorna agendamentos 'EM ESPERA' ou 'REAGENDADO' cujo dia_agendado < hoje.
    Mantém apenas o mais recente por CPF.
    """
    try:
        print(f"[api_get_atrasados] Usuário autenticado: {request.user}")
        user = request.user
        hoje = _local(timezone.now()).date()
        print(f"[api_get_atrasados] Data de hoje: {hoje}")

        # base: agendamentos passados não confirmados e sem presença
        base_qs = (
            Agendamento.objects
            .filter(dia_agendado__date__lt=hoje)
            .exclude(tabulacao_agendamento='CONFIRMADO')
            .filter(presencas__isnull=True)
            .select_related('cliente_agendamento', 'atendente_agendou')
            .prefetch_related('loja')
        )
        print(f"[api_get_atrasados] Total inicial de agendamentos: {base_qs.count()}")

        # 1️⃣ Se for superuser, acesso total
        if user.is_superuser:
            qs = base_qs
            print("[api_get_atrasados] Superuser – acesso total")
        else:
            # 2️⃣ Busca perfil do funcionário
            func = (
                Funcionario.objects
                .filter(usuario=user, status=True)
                .prefetch_related('lojas')
                .first()
            )
            if not func:
                print("[api_get_atrasados] Sem perfil de funcionário")
                return JsonResponse({'agendamentos': [], 'message': 'Sem permissão'}, status=200)

            hier = func.cargo.hierarquia if func.cargo else Cargo.HierarquiaChoices.PADRAO
            print(f"[api_get_atrasados] Hierarquia do usuário: {hier}")

            # 3️⃣ Supervisor(a) Geral sem filtro de loja
            if hier == Cargo.HierarquiaChoices.SUPERVISOR_GERAL:
                qs = base_qs
                print("[api_get_atrasados] Supervisor(a) Geral – acesso total")
            # 4️⃣ Gerentes veem todas as lojas, exceto franquias
            elif hier >= Cargo.HierarquiaChoices.GERENTE:
                qs = base_qs.exclude(loja__franquia=True)
                print("[api_get_atrasados] Gerente – excluindo franquias")
            # 5️⃣ Demais: apenas suas lojas
            else:
                if not func.lojas.exists():
                    print("[api_get_atrasados] Funcionário sem lojas associadas")
                    return JsonResponse({'agendamentos': [], 'message': 'Sem permissão'}, status=200)
                qs = base_qs.filter(loja__in=func.lojas.all())
                print(f"[api_get_atrasados] Filtrando pelas lojas: {func.lojas.all()}")

        # 6️⃣ Serializa os resultados
        agendamentos = []
        for ag in qs:
            agendamentos.append({
                'id': ag.id,
                'nome': ag.cliente_agendamento.nome_completo,  # Corrigido: usando nome_completo
                'cpf': ag.cliente_agendamento.cpf,
                'numero': ag.cliente_agendamento.numero,
                'dia_agendado': ag.dia_agendado.strftime('%Y-%m-%d %H:%M'),
                'atendente': ag.atendente_agendou.get_full_name() if ag.atendente_agendou else 'N/A',
                'loja': ag.loja.nome if ag.loja else 'N/A',
                'status': ag.tabulacao_agendamento or 'N/A'
            })

        return JsonResponse({'agendamentos': agendamentos})

    except Exception as e:
        print(f"[api_get_atrasados] Erro: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'error': f'Erro ao buscar agendamentos atrasados: {str(e)}',
            'agendamentos': []
        }, status=500)

@login_required
@require_GET
@ensure_csrf_cookie
def api_get_emloja(request):
    """
    Lista clientes que compareceram na loja na semana atual e que foram agendados pelo usuário logado.
    Não inclui clientes de rua (sem agendamento).
    """
    try:
        user = request.user
        hoje = _local(timezone.now()).date()
        inicio_semana = hoje - timedelta(days=hoje.weekday())
        fim_semana = inicio_semana + timedelta(days=6)

        # Busca presenças da semana atual que têm agendamento e o agendamento foi feito pelo user logado
        presencas = (
            PresencaLoja.objects
            .filter(
                data_presenca__date__range=[inicio_semana, fim_semana],
                agendamento__isnull=False,
                agendamento__atendente_agendou=user
            )
            .select_related('cliente_agendamento', 'loja_comp', 'vendedor', 'agendamento')
        )

        agendamentos = []
        for presenca in presencas:
            ag = presenca.agendamento
            cliente = ag.cliente_agendamento if ag else None
            agendamentos.append({
                'id': presenca.id,
                'nome': cliente.nome_completo if cliente else 'N/A',
                'cpf': cliente.cpf if cliente else 'N/A',
                'loja': presenca.loja_comp.nome if presenca.loja_comp else 'N/A',
                'data_presenca': presenca.data_presenca.strftime('%Y-%m-%d %H:%M') if presenca.data_presenca else 'N/A',
                'tabulacao': presenca.tabulacao_venda or 'N/A'
            })

        return JsonResponse({'agendamentos': agendamentos})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'error': f'Erro ao buscar clientes em loja: {str(e)}',
            'agendamentos': []
        }, status=500)

@login_required
@require_GET
@ensure_csrf_cookie
def api_get_cpfclientenome(request):
    """
    Recebe ?cpf=000.000.000-00 (ou sem formatação),
    busca em ClienteAgendamento.cpf (armazenado sem máscara)
    e retorna {'nome': 'Fulano da Silva'} ou 404 com {'mensagem': 'Cliente não encontrado'}.
    """
    cpf = request.GET.get('cpf', '')
    print(f"[DEBUG] CPF recebido: {cpf}")
    
    # remove tudo que não for dígito
    cpf_digits = re.sub(r'\D', '', cpf)
    print(f"[DEBUG] CPF formatado: {cpf_digits}")
    
    try:
        # Remove caracteres especiais de todos os CPFs no banco antes de comparar
        clientes = ClienteAgendamento.objects.all()
        for cliente in clientes:
            cpf_banco = re.sub(r'\D', '', cliente.cpf)
            if cpf_banco == cpf_digits:
                print(f"[DEBUG] Cliente encontrado: {cliente.nome_completo}")
                return JsonResponse({'nome': cliente.nome_completo})
        
        print("[DEBUG] Cliente não encontrado")
        return JsonResponse(
            {'mensagem': 'Cliente não encontrado'},
            status=404
        )
    except Exception as e:
        print(f"[ERROR] Erro ao buscar cliente: {str(e)}")
        return JsonResponse(
            {'mensagem': 'Erro interno ao buscar cliente'},
            status=500
        )

# -------------------------------------------
# FIM TEMPLATE AGENDAMENTO.HTML
# -------------------------------------------



# -------------------------------------------
# INICIO RANKING : inss/ranking.html
# Funções relacionadas ao Ranking
# -------------------------------------------

def _to_range(dt_date, start=True):
    """
    Return a datetime (aware if USE_TZ) at start or end of dt_date.
    """
    t = time.min if start else time.max
    dt = datetime.combine(dt_date, t)
    if settings.USE_TZ:
        return timezone.make_aware(dt)
    return dt


def api_get_cards(request, periodo='meta'):
    hoje = timezone.now().date()
    
    # Funções auxiliares
    fmt = lambda v: f"R$ {v:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")
    pct = lambda f, m: round((f / m) * 100, 2) if m > 0 else 0

    # Busca as metas
    meta_empresa = RegisterMeta.objects.filter(
        categoria='EMPRESA',
        status=True,
        data_inicio__date__lte=hoje,
        data_fim__date__gte=hoje
    ).first()
    
    meta_inss = RegisterMeta.objects.filter(
        categoria='SETOR',
        status=True,
        data_inicio__date__lte=hoje,
        data_fim__date__gte=hoje,
        setor__nome='INSS'
    ).first()

    # Define períodos
    if meta_empresa:
        inicio_empresa = datetime.combine(meta_empresa.data_inicio.date(), time.min)
        fim_empresa = datetime.combine(meta_empresa.data_fim.date(), time.max)
        valor_meta_empresa = meta_empresa.valor or Decimal('0.0')
    else:
        inicio_empresa = fim_empresa = None
        valor_meta_empresa = Decimal('0.0')

    if meta_inss:
        inicio_inss = datetime.combine(meta_inss.data_inicio.date(), time.min)
        fim_inss = datetime.combine(meta_inss.data_fim.date(), time.max)
        valor_meta_inss = meta_inss.valor or Decimal('0.0')
    else:
        inicio_inss = fim_inss = None
        valor_meta_inss = Decimal('0.0')

    # Card 1: Meta Empresa (não conta franquia)
    if inicio_empresa and fim_empresa:
        # Soma total e subtrai franquias
        total_empresa = RegisterMoney.objects.filter(
            data__range=[inicio_empresa, fim_empresa],
            status=True
        ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0.0')
        
        franquias = RegisterMoney.objects.filter(
            data__range=[inicio_empresa, fim_empresa],
            status=True,
            loja__franquia=True
        ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0.0')
        
        faturamento_empresa = total_empresa - franquias
    else:
        faturamento_empresa = Decimal('0.0')

    # Card 2: Falta Meta Empresa (não conta franquia)
    falta_meta_empresa = valor_meta_empresa - faturamento_empresa if valor_meta_empresa > faturamento_empresa else Decimal('0.0')

    # Card 3: Meta INSS (não conta franquia)
    if inicio_inss and fim_inss:
        # Soma total do setor INSS e subtrai franquias
        total_inss = RegisterMoney.objects.filter(
            data__range=[inicio_inss, fim_inss],
            status=True,
            setor__nome='INSS'
        ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0.0')
        
        franquias_inss = RegisterMoney.objects.filter(
            data__range=[inicio_inss, fim_inss],
            status=True,
            setor__nome='INSS',
            loja__franquia=True
        ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0.0')
        
        faturamento_inss = total_inss - franquias_inss
    else:
        faturamento_inss = Decimal('0.0')

    # Card 4: Falta Meta INSS (não conta franquia)
    falta_meta_inss = valor_meta_inss - faturamento_inss if valor_meta_inss > faturamento_inss else Decimal('0.0')

    # Monta a resposta
    response_data = {
        'meta_empresa': {
            'valor': fmt(faturamento_empresa),
            'percentual': pct(faturamento_empresa, valor_meta_empresa),
            'valor_meta': fmt(valor_meta_empresa)
        },
        'falta_meta_empresa': {
            'valor': fmt(falta_meta_empresa),
            'valor_meta': fmt(valor_meta_empresa)
        },
        'meta_inss': {
            'valor': fmt(faturamento_inss),
            'percentual': pct(faturamento_inss, valor_meta_inss),
            'valor_meta': fmt(valor_meta_inss)
        },
        'falta_meta_inss': {
            'valor': fmt(falta_meta_inss),
            'valor_meta': fmt(valor_meta_inss)
        },
        'periodo': {
            'inicio_empresa': inicio_empresa.date().isoformat() if inicio_empresa else hoje.replace(day=1).isoformat(),
            'fim_empresa': fim_empresa.date().isoformat() if fim_empresa else hoje.isoformat(),
            'inicio_inss': inicio_inss.date().isoformat() if inicio_inss else hoje.replace(day=1).isoformat(),
            'fim_inss': fim_inss.date().isoformat() if fim_inss else hoje.isoformat(),
            'tipo': periodo
        }
    }

    return JsonResponse(response_data)


def api_get_podium(request, periodo='meta'):
    hoje = timezone.now().date()

    # define di, df
    if periodo == 'dia':
        di, df = hoje, hoje
    elif periodo == 'semana':
        di = hoje - timedelta(days=hoje.weekday())
        df = di + timedelta(days=6)
    elif periodo == 'mes':
        di = hoje.replace(day=1)
        try:
            df = hoje.replace(day=1, month=hoje.month + 1) - timedelta(days=1)
        except ValueError:
            df = hoje.replace(day=31, month=12)
    else:
        m = RegisterMeta.objects.filter(
            categoria='SETOR', status=True,
            data_inicio__date__lte=hoje, data_fim__date__gte=hoje,
            setor__nome='INSS'
        ).first()
        if m and m.data_inicio and m.data_fim:
            di = m.data_inicio.date()
            df = m.data_fim.date()
        else:
            di = hoje.replace(day=1)
            try:
                df = hoje.replace(day=1, month=hoje.month + 1) - timedelta(days=1)
            except ValueError:
                df = hoje.replace(day=31, month=12)
            periodo = 'mes'

    si = datetime.combine(di, time.min)
    sf = datetime.combine(df, time.max)

    users_inss = Funcionario.objects.filter(
        setor__nome='INSS', status=True, usuario__isnull=False
    ).values_list('usuario_id', flat=True)

    vendas = RegisterMoney.objects.filter(
        data__range=[si, sf],
        status=True,
        loja__isnull=False,
        user_id__in=users_inss
    ).values('loja__id', 'loja__nome', 'loja__logo')\
     .annotate(total=Sum('valor_est'))\
     .order_by('-total')

    top3 = list(vendas[:3])
    default_logo = '/static/img/default-store.png'
    podium = []
    for idx, itm in enumerate(top3):
        tot = itm['total'] or Decimal('0.0')
        vf  = f"R$ {tot:,.2f}".replace(',', '_').replace('.', ',').replace('_', '.')
        logo = f"/media/{itm['loja__logo']}" if itm['loja__logo'] else default_logo
        podium.append({'nome': itm['loja__nome'], 'valor': vf, 'pos': idx+1, 'logo': logo})
    while len(podium) < 3:
        podium.append({'nome':'','valor':'R$ 0,00','pos':len(podium)+1,'logo':default_logo})

    return JsonResponse({
        'podium': podium,
        'periodo': {
            'inicio': di.strftime("%Y-%m-%d"),
            'fim':    df.strftime("%Y-%m-%d"),
            'tipo':   periodo
        }
    })


def api_get_tabela(request, periodo='semana'):
    hoje = timezone.now().date()

    # define di, df
    if periodo == 'dia':
        di, df = hoje, hoje
    elif periodo == 'semana':
        di = hoje - timedelta(days=hoje.weekday())
        df = di + timedelta(days=6)
    elif periodo == 'mes':
        di = hoje.replace(day=1)
        try:
            df = hoje.replace(day=1, month=hoje.month + 1) - timedelta(days=1)
        except ValueError:
            df = hoje.replace(day=31, month=12)
    else:
        m = RegisterMeta.objects.filter(
            categoria='SETOR', status=True,
            data_inicio__date__lte=hoje, data_fim__date__gte=hoje,
            setor__nome='INSS'
        ).first()
        if m and m.data_inicio and m.data_fim:
            di = m.data_inicio.date()
            df = m.data_fim.date()
        else:
            di = hoje.replace(day=1)
            try:
                df = hoje.replace(day=1, month=hoje.month + 1) - timedelta(days=1)
            except ValueError:
                df = hoje.replace(day=31, month=12)
            periodo = 'mes'

    si = datetime.combine(di, time.min)
    sf = datetime.combine(df, time.max)

    # 1) todos os INSS ativos
    users_all = User.objects.filter(
        funcionario_profile__setor__nome='INSS',
        funcionario_profile__status=True
    )
    user_ids = list(users_all.values_list('id', flat=True))

    # 2) quem confirmou
    conf_qs = Agendamento.objects.filter(
        dia_agendado__range=[si, sf],
        atendente_agendou_id__in=user_ids,
        tabulacao_agendamento='CONFIRMADO'
    )
    eleg_ids = set(conf_qs.values_list('atendente_agendou_id', flat=True))

    # 3) mapa base
    default_foto = '/static/img/user.png'
    perfil_map = {}
    for u in users_all:
        if u.id in eleg_ids:
            prof = getattr(u, 'funcionario_profile', None)
            foto = prof.foto.url if prof and prof.foto else default_foto
            nome = prof.apelido or (prof.nome_completo.split()[0] if prof else u.username)
            perfil_map[u.id] = {'foto': foto, 'nome': nome, 'qtd_ag':0, 'qtd_el':0, 'val_v':Decimal('0.0')}

    if not eleg_ids:
        return JsonResponse({
            'ranking_data': [],
            'periodo': {'inicio': di.strftime("%Y-%m-%d"), 'fim': df.strftime("%Y-%m-%d"), 'tipo': periodo},
            'total_agendamentos': 0
        })

    # 4) conta agendados
    ag_ct = Agendamento.objects.filter(
        dia_agendado__range=[si, sf],
        atendente_agendou_id__in=eleg_ids
    ).values('atendente_agendou_id').annotate(cnt=Count('id'))
    for itm in ag_ct:
        perfil_map[itm['atendente_agendou_id']]['qtd_ag'] = itm['cnt']

    # 5) conta presenças válidas
    pres_ct = PresencaLoja.objects.filter(
        data_presenca__range=[si, sf],
        agendamento__atendente_agendou_id__in=eleg_ids
    ).exclude(tabulacao_venda=PresencaLoja.TabulacaoVendaChoices.NAO_QUIS_OUVIR)\
     .values('agendamento__atendente_agendou_id').annotate(cnt=Count('id'))
    for itm in pres_ct:
        perfil_map[itm['agendamento__atendente_agendou_id']]['qtd_el'] = itm['cnt']

    # 6) soma vendas
    vend_ct = RegisterMoney.objects.filter(
        data__range=[si, sf],
        status=True,
        user_id__in=eleg_ids
    ).values('user_id').annotate(total=Sum('valor_est'))
    for itm in vend_ct:
        perfil_map[itm['user_id']]['val_v'] = itm['total'] or Decimal('0.0')

    # 7) formata e ordena
    ranking = []
    for uid, d in perfil_map.items():
        vf = f"R$ {d['val_v']:,.2f}".replace(',', '_').replace('.', ',').replace('_','.')
        ranking.append({
            'foto':         d['foto'],
            'nome':         d['nome'],
            'qtd_agendados':d['qtd_ag'],
            'qtd_emloja':   d['qtd_el'],
            'valor_vendas': vf
        })
    ranking.sort(key=lambda x: (
        -float(x['valor_vendas'].replace('R$ ','').replace('.','').replace(',','.')),
        -x['qtd_emloja'],
        -x['qtd_agendados'],
        x['nome']
    ))
    for i, itm in enumerate(ranking, 1):
        itm['posicao'] = i

    return JsonResponse({
        'ranking_data': ranking,
        'periodo': {'inicio': di.strftime("%Y-%m-%d"), 'fim': df.strftime("%Y-%m-%d"), 'tipo': periodo},
        'total_agendamentos': len(ag_ct)
    })
# -------------------------------------------
# FIM RANKING
# -------------------------------------------


# -------------------------------------------
# GERAL
# -------------------------------------------


@require_GET
def api_get_infogeral(request):
    print('iniciando api get!')
    user = request.user
    # Se for superuser, retorna todas as lojas e todos os funcionários
    if user.is_superuser:
        lojas = Loja.objects.all()
        funcionarios = Funcionario.objects.all()
    else:
        # Procura o funcionário associado ao usuário logado
        try:
            funcionario = Funcionario.objects.get(usuario_id=user.id)
        except Funcionario.DoesNotExist:
            return JsonResponse({"erro": "Funcionário não encontrado"}, status=404)
        # Exibe apenas as lojas do funcionário e o próprio funcionário
        lojas = funcionario.lojas.all() # Alterado de funcionario.loja para funcionario.lojas.all()
        funcionarios = [funcionario]

    lojas_data = [{"id": loja.id, "nome": loja.nome} for loja in lojas]
    funcionarios_data = [{"id": func.id, "apelido": func.apelido} for func in funcionarios]

    return JsonResponse({"lojas": lojas_data, "funcionarios": funcionarios_data}, status=200)

# Nova View para Exportar CSV
@login_required # Opcional: Adicione autenticação se necessário
def export_agendamentos_csv(request):
    """
    Gera e retorna um arquivo CSV com todos os dados de Agendamento e sua PresencaLoja associada (se houver).
    Substitui IDs por nomes/apelidos e formata os dados adequadamente, conforme os novos modelos.
    """
    # Define o nome do arquivo CSV, incluindo a data atual
    filename = f"agendamentos_export_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"

    # Cria a resposta HTTP com os headers apropriados para CSV
    response = HttpResponse(
        content_type='text/csv; charset=utf-8-sig', # utf-8-sig inclui BOM para melhor compatibilidade com Excel
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )

    # Utiliza StringIO para escrever o CSV em memória
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=';', quotechar='"', quoting=csv.QUOTE_MINIMAL) # Usando ';' como delimitador

    # --- Cabeçalho do CSV (Ajustado) ---
    header = [
        'ID Agendamento',
        'Nome Cliente',
        'CPF Cliente',
        'Numero Cliente',
        'Cliente Possui WhatsApp', # Nome da coluna atualizado
        'Dia Agendado',
        'Loja Agendada', # Nome da loja vindo de agendamento.loja
        'Atendente Agendou (Apelido)', # Obtido do User -> Funcionario
        'Atendente Agendou (Nome Completo)', # Obtido do User -> Funcionario
        'Tabulacao Agendamento', # Campo do Agendamento
        'Observacao Atendente', # Campo não existe mais, será vazio
        'Vendedor Loja (Apelido)', # Obtido da PresencaLoja.vendedor (User -> Funcionario)
        'Vendedor Loja (Nome Completo)', # Obtido da PresencaLoja.vendedor (User -> Funcionario)
        'Tabulacao Venda (Presença)', # Campo da PresencaLoja
        'Observacao Vendedor', # Campo não existe mais, será vazio
        'Tipo Negociacao (Presença)', # Campo da PresencaLoja
        'Banco (Presença)', # Campo da PresencaLoja
        'Subsidio (Presença)', # Campo da PresencaLoja
        'TAC Valor (Presença)', # Campo da PresencaLoja
        'Acao (Presença)', # Campo da PresencaLoja
        'Associacao (Presença)', # Campo da PresencaLoja
        'Aumento (Presença)', # Campo da PresencaLoja
        'Status TAC (Presença)', # Campo da PresencaLoja (status_pagamento)
        'Data Pagamento TAC (Presença)', # Campo da PresencaLoja (data_pagamento)
        'Cliente Rua (Presença)', # Campo da PresencaLoja
        'Mensagem Update TAC', # Campo não existe mais, será vazio
    ]
    writer.writerow(header)

    # --- Dados dos Agendamentos ---
    # Otimização: Pré-carregar dados relacionados
    agendamentos = Agendamento.objects.select_related(
        'cliente_agendamento',
        'loja',
        'atendente_agendou', # Relação com User
        'presenca', # Relação OneToOne reversa com PresencaLoja
        'presenca__vendedor' # Relação com User a partir da PresencaLoja
    ).all().order_by('-dia_agendado') # Ordena do mais recente para o mais antigo

    # Otimização: Buscar todos os funcionários relevantes de uma vez
    user_ids = set()
    for ag in agendamentos:
        if ag.atendente_agendou:
            user_ids.add(ag.atendente_agendou.id)
        # Verifica se 'presenca' existe e não é None antes de acessar seus atributos
        presenca_obj = getattr(ag, 'presenca', None)
        if presenca_obj and presenca_obj.vendedor:
            user_ids.add(presenca_obj.vendedor.id)
            
    # Garante que Funcionario seja importado (pode precisar ajustar o caminho)
    try:
        from apps.funcionarios.models import Funcionario 
        funcionarios_map = {
            func.usuario_id: func
            for func in Funcionario.objects.filter(usuario_id__in=list(user_ids)).select_related('usuario')
        }
    except ImportError:
        print("Erro: Não foi possível importar o modelo Funcionario. Verifique o caminho.")
        funcionarios_map = {}
        # Considerar retornar um erro ou continuar com dados limitados

    # Função auxiliar para formatar datas e horas
    def format_datetime(dt):
        if dt:
            # Converte para o fuso horário local (se necessário) e formata
            return timezone.localtime(dt).strftime('%d/%m/%Y %H:%M:%S')
        return ''

    # Função auxiliar para obter nome/apelido de um User via Funcionario mapeado
    def get_funcionario_info_from_user(user, info_type='apelido'):
        if not user:
            return 'N/A'
        
        funcionario = funcionarios_map.get(user.id)
        if not funcionario:
            # Se não encontrar o funcionário mapeado, tenta retornar o username do User
            # Ou primeiro/último nome se disponíveis
            display_name = f"{user.first_name} {user.last_name}".strip()
            return display_name or user.username or 'N/A'

        if info_type == 'apelido':
            # Usa apelido do funcionário, senão primeiro nome do user, senão username
            return funcionario.apelido or user.first_name or user.username or 'N/A' 
        elif info_type == 'nome_completo':
             # Usa nome e sobrenome do User (padrão Django)
             full_name = f"{user.first_name} {user.last_name}".strip()
             # Alternativa: Usar nome_completo do Funcionario se existir:
             # full_name = getattr(funcionario, 'nome_completo', f"{user.first_name} {user.last_name}".strip())
             return full_name if full_name else user.username or 'N/A' # Fallback para username
        return 'N/A'

    # Função auxiliar para formatar booleano
    def format_boolean(value):
        if value is None:
            return '' # Retorna vazio em vez de 'N/A' para consistência
        return 'Sim' if value else 'Não'

     # Função auxiliar para formatar decimal para CSV (com vírgula decimal)
    def format_decimal(value):
        if value is None:
            return ''
        try:
            # Tenta formatar como decimal com 2 casas, usando vírgula
            return f"{Decimal(value):.2f}".replace('.', ',')
        except (TypeError, ValueError, InvalidOperation):
             # Retorna vazio se a conversão falhar
             return ''


    for agendamento in agendamentos:
        presenca = getattr(agendamento, 'presenca', None) # Acessa a presença relacionada (pode ser None)

        # Dados do ClienteAgendamento
        cliente_nome = 'N/A'
        cliente_cpf = 'N/A'
        cliente_numero = 'N/A'
        cliente_whatsapp = 'Não'
        if agendamento.cliente_agendamento:
            cliente_nome = agendamento.cliente_agendamento.nome_completo or 'N/A'
            cliente_cpf = agendamento.cliente_agendamento.cpf or 'N/A'
            cliente_numero = agendamento.cliente_agendamento.numero or 'N/A'
            cliente_whatsapp = format_boolean(agendamento.cliente_agendamento.flg_whatsapp)

        # Dados do Agendamento
        dia_agendado_fmt = format_datetime(agendamento.dia_agendado)
        loja_nome = agendamento.loja.nome if agendamento.loja else 'N/A'
        atendente_apelido = get_funcionario_info_from_user(agendamento.atendente_agendou, 'apelido')
        atendente_nome_completo = get_funcionario_info_from_user(agendamento.atendente_agendou, 'nome_completo')
        tabulacao_agendamento = agendamento.tabulacao_agendamento or ''
        obs_atendente = '' # Campo não existe mais

        # Dados da PresencaLoja (se existir) - Valores padrão
        vendedor_apelido = 'N/A'
        vendedor_nome_completo = 'N/A'
        tabulacao_venda = ''
        obs_vendedor = '' # Campo não existe mais
        tipo_negociacao = ''
        banco = ''
        subsidio = 'Não'
        tac_valor = ''
        acao = 'Não'
        associacao = 'Não'
        aumento = 'Não'
        status_tac = ''
        data_pagamento_tac = ''
        cliente_rua = 'Não'
        msg_update_tac = '' # Campo não existe mais

        if presenca: # Se existe um registro de PresencaLoja associado
            vendedor_apelido = get_funcionario_info_from_user(presenca.vendedor, 'apelido')
            vendedor_nome_completo = get_funcionario_info_from_user(presenca.vendedor, 'nome_completo')
            tabulacao_venda = presenca.tabulacao_venda or ''
            # obs_vendedor = '' # Ainda vazio
            tipo_negociacao = presenca.tipo_negociacao or ''
            banco = presenca.banco or ''
            subsidio = format_boolean(presenca.subsidio)
            tac_valor = format_decimal(presenca.valor_tac)
            acao = format_boolean(presenca.acao)
            associacao = format_boolean(presenca.associacao)
            aumento = format_boolean(presenca.aumento)
            status_tac = presenca.get_status_pagamento_display() # Usa o método display se disponível
            data_pagamento_tac = format_datetime(presenca.data_pagamento)
            cliente_rua = format_boolean(presenca.cliente_rua)
            # msg_update_tac = '' # Ainda vazio

        row = [
            agendamento.id,
            cliente_nome,
            cliente_cpf,
            cliente_numero,
            cliente_whatsapp,
            dia_agendado_fmt,
            loja_nome,
            atendente_apelido,
            atendente_nome_completo,
            tabulacao_agendamento,
            obs_atendente,
            vendedor_apelido,
            vendedor_nome_completo,
            tabulacao_venda,
            obs_vendedor,
            tipo_negociacao,
            banco,
            subsidio,
            tac_valor,
            acao,
            associacao,
            aumento,
            status_tac,
            data_pagamento_tac,
            cliente_rua,
            msg_update_tac,
        ]
        writer.writerow(row)

    # Escreve o conteúdo do buffer na resposta HTTP, codificado corretamente
    response.write(buffer.getvalue().encode('utf-8-sig')) # Usar encode aqui garante a codificação
    buffer.close() # Fecha o buffer
    return response







# ==============================================================================
# API VIEW - DASHBOARD DATA
# ==============================================================================
# Esta view fornece os dados agregados necessários para popular o dashboard do INSS.


@verificar_autenticacao
@check_access(departamento='INSS', nivel_minimo='ESTAGIO')
def api_get_dashboard(request, periodo='mes'):
    """
    Fornece dados agregados para popular o dashboard do INSS.
    Parâmetro 'periodo': 'dia', 'semana', 'mes' ou 'meta'.
    """
    try:
        print(f"----- api_get_dashboard chamado por {request.user.username}, periodo={periodo} -----")
        hoje = timezone.now().date()
        now_dt = timezone.now()
        print(f"Data de hoje: {hoje}, now_dt: {now_dt}")

        # 1) DETERMINAR intervalo [data_inicio, data_fim]
        if periodo == 'dia':
            di = df = hoje
        elif periodo == 'semana':
            di = hoje - timedelta(days=hoje.weekday())
            df = di + timedelta(days=6)
        elif periodo == 'mes':
            di = hoje.replace(day=1)
            try:
                df = (hoje.replace(day=1, month=hoje.month + 1) - timedelta(days=1))
            except ValueError:
                df = hoje.replace(day=31, month=12)
        elif periodo == 'meta':
            meta = RegisterMeta.objects.filter(
                categoria='SETOR', status=True,
                data_inicio__date__lte=hoje, data_fim__date__gte=hoje,
                setor__nome='INSS'
            ).order_by('-data_inicio').first()
            if meta:
                di = meta.data_inicio.date()
                df = meta.data_fim.date()
            else:
                print("Nenhuma meta INSS ativa — caindo para 'mes'")
                periodo = 'mes'
                di = hoje.replace(day=1)
                try:
                    df = (hoje.replace(day=1, month=hoje.month + 1) - timedelta(days=1))
                except ValueError:
                    df = hoje.replace(day=31, month=12)
        else:
            print(f"Período inválido '{periodo}' — usando 'mes'")
            periodo = 'mes'
            di = hoje.replace(day=1)
            try:
                df = (hoje.replace(day=1, month=hoje.month + 1) - timedelta(days=1))
            except ValueError:
                df = hoje.replace(day=31, month=12)

        # 2) CONVERTER para datetimes
        def to_dt(d, start=True):
            t = time.min if start else time.max
            dt = datetime.combine(d, t)
            return timezone.make_aware(dt) if settings.USE_TZ else dt

        start_dt = to_dt(di, start=True)
        end_dt   = to_dt(df, start=False)
        print(f"Intervalo usado: {start_dt} — {end_dt} ({periodo})")

        # 3) AGENDAMENTOS
        qs_ag = Agendamento.objects.filter(dia_agendado__range=[start_dt, end_dt])
        total_ag = qs_ag.count()
        confirmados = qs_ag.filter(tabulacao_agendamento='CONFIRMADO').count()
        print(f"Total agendamentos: {total_ag}, Confirmados: {confirmados}")

        # 4) PRESENÇAS / FINALIZADOS
        qs_pres = PresencaLoja.objects.filter(
            data_presenca__range=[start_dt, end_dt],
            agendamento__dia_agendado__range=[start_dt, end_dt]
        )
        finalizados = qs_pres.exclude(
            Q(tabulacao_venda=PresencaLoja.TabulacaoVendaChoices.NAO_QUIS_OUVIR) |
            Q(tabulacao_venda=PresencaLoja.TabulacaoVendaChoices.PENDENTE) |
            Q(tabulacao_venda__isnull=True)
        ).count()
        atrasados = qs_ag.filter(
            dia_agendado__lt=now_dt,
            presencas__isnull=True
        ).count()
        print(f"Finalizados: {finalizados}, Atrasados: {atrasados}")

        # 5) DADOS FINANCEIROS DO REGISTERMONEY (INSS)
        from apps.siape.models import RegisterMoney
        qs_register = RegisterMoney.objects.filter(
            data__range=[start_dt, end_dt],
            setor__nome='INSS'
        )
        
        # Total de vendas registradas
        total_vendas = qs_register.count()
        valor_total_vendas = qs_register.aggregate(
            total=Sum('valor_est')
        )['total'] or Decimal('0.00')
        
        # Vendas por vendedor
        vendas_por_vendedor = qs_register.values('user__username').annotate(
            total_vendas=Count('id'),
            valor_total=Sum('valor_est')
        ).order_by('-valor_total')[:10]
        
        # Vendas por loja
        vendas_por_loja = qs_register.values('loja__nome').annotate(
            total_vendas=Count('id'),
            valor_total=Sum('valor_est')
        ).order_by('-valor_total')[:10]

        # 6) EFETIVIDADE POR LOJA
        lojas_ids = qs_ag.values_list('loja_id', flat=True).distinct()
        lojas = {loja.id: loja for loja in Loja.objects.filter(id__in=lojas_ids)}

        ag_por_loja = qs_ag.values('loja_id').annotate(total=Count('id'))
        pres_por_loja = qs_pres.values('agendamento__loja_id').annotate(total=Count('id'))
        fech_por_loja = qs_pres.filter(
            tabulacao_venda=PresencaLoja.TabulacaoVendaChoices.NEGOCIO_FECHADO
        ).values('agendamento__loja_id').annotate(total=Count('id'))

        ag_map = {i['loja_id']: i['total'] for i in ag_por_loja}
        pres_map = {i['agendamento__loja_id']: i['total'] for i in pres_por_loja}
        fech_map = {i['agendamento__loja_id']: i['total'] for i in fech_por_loja}

        efetividade_lojas = []
        tot_pres, tot_fech = 0, 0
        for loja_id, tot_ag in ag_map.items():
            loj = lojas.get(loja_id)
            if not loj: continue
            p = pres_map.get(loja_id, 0)
            f = fech_map.get(loja_id, 0)
            tot_pres += p
            tot_fech += f
            cmp = (Decimal(p) / tot_ag * 100) if tot_ag else Decimal(0)
            fe = (Decimal(f) / p * 100) if p else Decimal(0)
            nome = loj.nome.split(' - ')[-1] if ' - ' in loj.nome else loj.nome
            efetividade_lojas.append({
                'loja_nome': nome,
                'comparecimento': f"{cmp:.2f}%",
                'fechamento':      f"{fe:.2f}%"
            })
        efetividade_lojas.sort(key=lambda x: x['loja_nome'])
        efetividade_geral = (tot_fech / tot_pres * 100) if tot_pres else Decimal(0)

        # 7) SITUAÇÃO TAC
        qs_tac = PresencaLoja.objects.filter(
            data_presenca__range=[start_dt, end_dt],
            valor_tac__isnull=False, valor_tac__gt=0
        )
        vals = list(qs_tac.values_list('valor_tac', flat=True))
        tac_m = (sum(vals) / len(vals)) if vals else Decimal(0)
        tac_min = min(vals) if vals else Decimal(0)
        tac_max = max(vals) if vals else Decimal(0)

        ultimas = qs_tac.select_related(
            'agendamento__cliente_agendamento',
            'agendamento__loja',
            'cliente_agendamento',
            'loja_comp'
        ).order_by('-data_presenca')[:50]
        situacao = []
        for pres in ultimas:
            # compor loja, tipo e cliente
            loja_nome, tipo = 'N/A', 'N/A'
            if pres.agendamento and pres.agendamento.cliente_agendamento:
                tipo = 'Agendado'
                loja_at = pres.loja_comp or pres.agendamento.loja
                loja_nome = loja_at.nome.split(' - ')[-1] if loja_at and ' - ' in loja_at.nome else (loja_at.nome if loja_at else 'N/A')
            elif pres.cliente_agendamento:
                tipo = 'Rua'
                loja_nome = pres.loja_comp.nome.split(' - ')[-1] if pres.loja_comp and ' - ' in pres.loja_comp.nome else (pres.loja_comp.nome if pres.loja_comp else 'N/A')
            situacao.append({
                'loja': loja_nome,
                'tipo': tipo,
                'valor': f"R$ {pres.valor_tac:,.2f}".replace(',', '_').replace('.', ',').replace('_', '.'),
                'status': pres.get_status_pagamento_display()
            })

        # 8) ESTATÍSTICAS ADICIONAIS
        # Clientes únicos atendidos
        clientes_unicos = ClienteAgendamento.objects.filter(
            agendamentos__dia_agendado__range=[start_dt, end_dt]
        ).distinct().count()
        
        # Presenças por tipo (agendado vs rua)
        presencas_agendadas = qs_pres.filter(agendamento__isnull=False).count()
        presencas_rua = qs_pres.filter(cliente_rua=True).count()
        
        # Negócios fechados por tipo de negociação
        negocios_fechados = qs_pres.filter(
            tabulacao_venda=PresencaLoja.TabulacaoVendaChoices.NEGOCIO_FECHADO
        )
        com_acao = negocios_fechados.filter(acao=True).count()
        com_associacao = negocios_fechados.filter(associacao=True).count()
        com_aumento = negocios_fechados.filter(aumento=True).count()
        com_subsidio = negocios_fechados.filter(subsidio=True).count()

        # 9) INSIGHTS E ANÁLISES
        insights = gerar_insights_dashboard(
            total_ag, confirmados, finalizados, atrasados,
            total_vendas, valor_total_vendas, efetividade_geral,
            tac_m, presencas_agendadas, presencas_rua
        )

        # 10) MONTAR E RETORNAR
        data = {
            'periodo': {
                'inicio': di.strftime("%d/%m/%Y"),
                'fim':    df.strftime("%d/%m/%Y"),
                'tipo':   periodo
            },
            'metricas_agendamentos': {
                'total': total_ag,
                'confirmados': confirmados,
                'finalizados': finalizados,
                'atrasados': atrasados,
                'clientes_unicos': clientes_unicos
            },
            'metricas_financeiras': {
                'tac_medio':    f"R$ {tac_m:,.2f}".replace(',', '_').replace('.', ',').replace('_', '.'),
                'tac_menor':    f"R$ {tac_min:,.2f}".replace(',', '_').replace('.', ',').replace('_', '.'),
                'tac_maior':    f"R$ {tac_max:,.2f}".replace(',', '_').replace('.', ',').replace('_', '.'),
                'efetividade_geral': f"{efetividade_geral:.2f}%",
                'total_vendas': total_vendas,
                'valor_total_vendas': f"R$ {valor_total_vendas:,.2f}".replace(',', '_').replace('.', ',').replace('_', '.')
            },
            'metricas_detalhadas': {
                'presencas_agendadas': presencas_agendadas,
                'presencas_rua': presencas_rua,
                'com_acao': com_acao,
                'com_associacao': com_associacao,
                'com_aumento': com_aumento,
                'com_subsidio': com_subsidio
            },
            'vendas_por_vendedor': list(vendas_por_vendedor),
            'vendas_por_loja': list(vendas_por_loja),
            'efetividade_loja': efetividade_lojas,
            'situacao_tac': situacao,
            'insights': insights
        }
        print("api_get_dashboard retornando com sucesso.")
        return JsonResponse(data)

    except Exception as e:
        print(f"Erro em api_get_dashboard: {e}")
        print(traceback.format_exc())
        # Retorna estrutura padrão de erro para o frontend
        return JsonResponse({
            'error': f"Erro ao processar dashboard: {str(e)}",
            'periodo': {'inicio': '', 'fim': '', 'tipo': periodo},
            'metricas_agendamentos': {'total': 0, 'confirmados': 0, 'finalizados': 0, 'atrasados': 0, 'clientes_unicos': 0},
            'metricas_financeiras': {'tac_medio': 'R$ 0,00', 'tac_menor': 'R$ 0,00', 'tac_maior': 'R$ 0,00', 'efetividade_geral': '0%', 'total_vendas': 0, 'valor_total_vendas': 'R$ 0,00'},
            'metricas_detalhadas': {'presencas_agendadas': 0, 'presencas_rua': 0, 'com_acao': 0, 'com_associacao': 0, 'com_aumento': 0, 'com_subsidio': 0},
            'vendas_por_vendedor': [],
            'vendas_por_loja': [],
            'efetividade_loja': [],
            'situacao_tac': [],
            'insights': {}
        }, status=500)

def gerar_insights_dashboard(total_ag, confirmados, finalizados, atrasados, 
                           total_vendas, valor_total_vendas, efetividade_geral, 
                           tac_medio, presencas_agendadas, presencas_rua):
    """
    Gera insights automáticos baseados nos dados do dashboard
    """
    insights = {}
    
    # Taxa de confirmação
    if total_ag > 0:
        taxa_confirmacao = (confirmados / total_ag) * 100
        if taxa_confirmacao >= 80:
            insights['agendamentos'] = f"Excelente taxa de confirmação de {taxa_confirmacao:.1f}%! Os clientes estão muito engajados."
        elif taxa_confirmacao >= 60:
            insights['agendamentos'] = f"Boa taxa de confirmação de {taxa_confirmacao:.1f}%. Há espaço para melhorar o follow-up."
        else:
            insights['agendamentos'] = f"Taxa de confirmação baixa ({taxa_confirmacao:.1f}%). Considere melhorar a comunicação prévia."
    
    # Taxa de finalização
    if confirmados > 0:
        taxa_finalizacao = (finalizados / confirmados) * 100
        if taxa_finalizacao >= 70:
            insights['vendas'] = f"Ótima conversão! {taxa_finalizacao:.1f}% dos confirmados finalizaram."
        elif taxa_finalizacao >= 50:
            insights['vendas'] = f"Conversão regular de {taxa_finalizacao:.1f}%. Foque no processo de vendas."
        else:
            insights['vendas'] = f"Conversão baixa ({taxa_finalizacao:.1f}%). Revise o processo de atendimento."
    
    # Efetividade geral
    if efetividade_geral >= 60:
        insights['efetividade'] = f"Efetividade excelente de {efetividade_geral:.1f}%! Equipe muito produtiva."
    elif efetividade_geral >= 40:
        insights['efetividade'] = f"Efetividade boa de {efetividade_geral:.1f}%. Mantenha o foco na qualidade."
    else:
        insights['efetividade'] = f"Efetividade baixa ({efetividade_geral:.1f}%). Treinamento pode ser necessário."
    
    # TAC médio
    if tac_medio >= 300:
        insights['tac'] = f"TAC médio alto (R$ {tac_medio:,.2f}). Ótimo trabalho na qualificação!"
    elif tac_medio >= 200:
        insights['tac'] = f"TAC médio regular (R$ {tac_medio:,.2f}). Há potencial para aumentar."
    else:
        insights['tac'] = f"TAC médio baixo (R$ {tac_medio:,.2f}). Foque na qualificação de leads."
    
    # Presenças por origem
    total_presencas = presencas_agendadas + presencas_rua
    if total_presencas > 0:
        percent_agendadas = (presencas_agendadas / total_presencas) * 100
        if percent_agendadas >= 70:
            insights['origem'] = "Maioria dos clientes vem de agendamentos. Sistema funcionando bem!"
        elif percent_agendadas >= 50:
            insights['origem'] = "Bom equilíbrio entre agendamentos e clientes da rua."
        else:
            insights['origem'] = "Muitos clientes da rua. Considere aumentar campanhas de agendamento."
    
    # Recomendações gerais
    recomendacoes = []
    if atrasados > 0:
        recomendacoes.append("Há agendamentos atrasados. Revise o processo de follow-up.")
    if total_vendas == 0:
        recomendacoes.append("Nenhuma venda registrada no período. Verifique o processo de registro.")
    if efetividade_geral < 30:
        recomendacoes.append("Efetividade muito baixa. Considere treinamento da equipe.")
    
    if recomendacoes:
        insights['recomendacoes'] = " | ".join(recomendacoes)
    
    return insights



# -------------------------------------------
# FIM TEMPLATE DASHBOARD

# -------------------------------------------
# INÍCIO INFORMAÇÕES DO PROCESSO
# -------------------------------------------

@login_required(login_url='/')
@require_GET
def api_get_info_processo(request, acao_id):
    """
    API para obter informações detalhadas de um processo/ação.
    
    Args:
        request: Requisição HTTP
        acao_id: ID da ação para buscar informações
        
    Returns:
        JsonResponse com as informações detalhadas do processo
    """
    try:
        # Buscar a ação pelo ID
        acao = Acoes.objects.select_related(
            'cliente', 
            'vendedor_responsavel', 
            'loja', 
            'advogado_responsavel'
        ).get(id=acao_id)
        
        # Buscar arquivos relacionados à ação
        arquivos = ArquivosAcoesINSS.objects.filter(acao_inss=acao).order_by('-data_import')
        
        # Buscar documentos relacionados à ação
        documentos = DocsAcaoINSS.objects.filter(acao_inss=acao).order_by('-data_import')
        
        # Buscar registros de pagamento relacionados à ação
        pagamentos = RegistroPagamentos.objects.filter(acao_inss=acao).first()
        
        # Preparar dados do cliente
        cliente_data = {
            'nome': acao.cliente.nome,
            'cpf': format_cpf(acao.cliente.cpf),
            'contato': acao.cliente.contato or '-',
            'data_criacao': acao.cliente.data_criacao.strftime('%d/%m/%Y %H:%M') if acao.cliente.data_criacao else '-',
        }
        
        # Preparar dados da ação
        acao_data = {
            'id': acao.id,
            'tipo_acao': acao.get_tipo_acao_display(),
            'status': acao.get_status_emcaminhamento_display(),
            'data_criacao': acao.data_criacao.strftime('%d/%m/%Y %H:%M') if acao.data_criacao else '-',
            'data_atualizacao': acao.data_atualizacao.strftime('%d/%m/%Y %H:%M') if acao.data_atualizacao else '-',
            'numero_protocolo': acao.numero_protocolo or '-',
            'vendedor_responsavel': acao.vendedor_responsavel.get_full_name() if acao.vendedor_responsavel else '-',
            'loja': acao.loja.nome if acao.loja else '-',
            'advogado_responsavel': acao.advogado_responsavel.get_full_name() if acao.advogado_responsavel else '-',
            'senha_inss': acao.senha_inss or '-',
        }
        
        # Adicionar informações de sentença se disponíveis
        if acao.sentenca:
            acao_data.update({
                'sentenca': acao.get_sentenca_display(),
                'grau_sentenca': acao.get_grau_sentenca_display() if acao.grau_sentenca else '-',
                'valor_sentenca': format_currency(acao.valor_sentenca) if acao.valor_sentenca else '-',
                'data_sentenca': acao.data_sentenca.strftime('%d/%m/%Y') if acao.data_sentenca else '-',
            })
            
            # Adicionar informações de recurso baseado no grau da sentença
            if acao.grau_sentenca == Acoes.GrauSentencaChoices.PRIMEIRO_GRAU:
                acao_data.update({
                    'recurso': acao.get_recurso_primeiro_grau_display() if acao.recurso_primeiro_grau else '-',
                    'data_recurso': acao.data_recurso_primeiro_grau.strftime('%d/%m/%Y') if acao.data_recurso_primeiro_grau else '-',
                    'resultado_recurso': acao.get_resultado_recurso_primeiro_grau_display() if acao.resultado_recurso_primeiro_grau else '-',
                })
            elif acao.grau_sentenca == Acoes.GrauSentencaChoices.SEGUNDO_GRAU:
                acao_data.update({
                    'recurso': acao.get_recurso_segundo_grau_display() if acao.recurso_segundo_grau else '-',
                    'data_recurso': acao.data_recurso_segundo_grau.strftime('%d/%m/%Y') if acao.data_recurso_segundo_grau else '-',
                    'resultado_recurso': acao.get_resultado_recurso_segundo_grau_display() if acao.resultado_recurso_segundo_grau else '-',
                })
        
        # Preparar dados de arquivos
        arquivos_data = []
        for arquivo in arquivos:
            arquivos_data.append({
                'id': arquivo.id,
                'titulo': arquivo.titulo,
                'data_upload': arquivo.data_import.strftime('%d/%m/%Y %H:%M'),
                'url': arquivo.file.url if arquivo.file else None,
            })
        
        # Preparar dados de documentos
        documentos_data = []
        for documento in documentos:
            documentos_data.append({
                'id': documento.id,
                'titulo': documento.titulo,
                'data_upload': documento.data_import.strftime('%d/%m/%Y %H:%M'),
                'url': documento.file.url if documento.file else None,
            })
        
        # Preparar dados de pagamento
        pagamento_data = {}
        if pagamentos:
            pagamento_data = {
                'tipo_pagamento': pagamentos.get_tipo_pagamento_display(),
                'valor_total': format_currency(pagamentos.valor_total),
                'status': pagamentos.get_status_display(),
                'valor_entrada': format_currency(pagamentos.valor_entrada) if pagamentos.valor_entrada else '-',
                'parcelas_totais': pagamentos.parcelas_totais,
                'parcelas_pagas': pagamentos.parcelas_pagas,
                'parcelas_restantes': pagamentos.parcelas_restantes,
            }
        
        # Montar resposta
        response_data = {
            'status': 'success',
            'cliente': cliente_data,
            'acao': acao_data,
            'arquivos': arquivos_data,
            'documentos': documentos_data,
            'pagamento': pagamento_data,
        }
        
        return JsonResponse(response_data)
    
    except Acoes.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'Ação não encontrada'
        }, status=404)
    
    except Exception as e:
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao obter informações do processo: {str(e)}'
        }, status=500)
# -------------------------------------------



# ==============================================================================
# VIEWS DE RENDERIZAÇÃO DE PÁGINAS HTML (Templates)
# ==============================================================================
# Nota: Manter esta seção conforme estrutura atual para renderização de templates.

# Acesso permitido para usuários logados que são superusuários ou pertencem ao departamento INSS.
# O nível 'ESTAGIO' é o mais baixo, garantindo que qualquer membro do INSS possa acessar.




# ==============================================================================
# API VIEW - AÇÕES INSS
# ==============================================================================

from apps.juridico.models import *

@login_required(login_url='/')
@controle_acess('SCT58')   # 58 – INSS | AÇÕES
def render_acoesinss(request):
    """
    Renderiza a página de ações do INSS.
    """
    return render(request, 'apps/inss/acoes.html')



@require_GET
@ensure_csrf_cookie
@controle_acess('SCT58')   # 58 – INSS | AÇÕES
def api_get_acoes(request):
    """
    API para obter todas as ações INSS com seus arquivos associados,
    com filtro de acesso baseado na hierarquia do usuário.
    """
    print("[API_GET_ACOES] Iniciando consulta de ações INSS")
    try:
        user = request.user
        acoes_qs = Acoes.objects.none()  # Começa com uma queryset vazia

        if user.is_superuser:
            print(f"[API_GET_ACOES] Usuário {user.username} é superuser - Acesso completo")
            acoes_qs = Acoes.objects.filter(status=True, loja__isnull=False)
        else:
            try:
                print(f"[API_GET_ACOES] Verificando perfil do usuário {user.username}")
                funcionario_logado = Funcionario.objects.select_related(
                    'cargo', 'empresa'
                ).prefetch_related('lojas').get(usuario=user, status=True)
            except Funcionario.DoesNotExist:
                # Usuário não é superuser e não tem perfil de funcionário ativo, não mostra nada.
                print(f"[API_GET_ACOES] Usuário {user.username} não possui perfil de funcionário ativo")
                return JsonResponse({'success': True, 'acoes': []})

            if not funcionario_logado.cargo:
                 # Funcionário sem cargo definido, não deveria acontecer, mas por segurança.
                print(f"[API_GET_ACOES] Funcionário {funcionario_logado.id} não possui cargo definido")
                return JsonResponse({'success': True, 'acoes': []})

            hierarquia = funcionario_logado.cargo.hierarquia
            print(f"[API_GET_ACOES] Usuário {user.username} com hierarquia {hierarquia}")

            if hierarquia in [Cargo.HierarquiaChoices.SUPERVISOR_GERAL, Cargo.HierarquiaChoices.GESTOR]:
                # Níveis 6 ou 7: Acesso total
                print(f"[API_GET_ACOES] Usuário {user.username} com nível de supervisor/gestor - Acesso completo")
                acoes_qs = Acoes.objects.filter(status=True, loja__isnull=False)
            elif hierarquia in [Cargo.HierarquiaChoices.ESTAGIO, Cargo.HierarquiaChoices.PADRAO]:
                # Níveis 1 ou 2: Apenas ações do próprio usuário logado
                print(f"[API_GET_ACOES] Usuário {user.username} com nível básico - Acesso apenas às próprias ações")
                acoes_qs = Acoes.objects.filter(
                    status=True,
                    loja__isnull=False,
                    vendedor_responsavel=user
                )
            elif hierarquia in [Cargo.HierarquiaChoices.COORDENADOR, Cargo.HierarquiaChoices.GERENTE, Cargo.HierarquiaChoices.FRANQUEADO]:
                # Níveis 3, 4 ou 5: Ações de vendedores das mesmas lojas + próprias ações
                ids_lojas_funcionario = list(funcionario_logado.lojas.values_list('id', flat=True))
                print(f"[API_GET_ACOES] Usuário {user.username} com nível médio - Acesso às lojas: {ids_lojas_funcionario}")
                
                if ids_lojas_funcionario:
                    # Vendedores que trabalham em pelo menos uma das lojas do funcionário logado
                    condicao_lojas_compartilhadas = Q(vendedor_responsavel__funcionario_profile__lojas__id__in=ids_lojas_funcionario)
                    # Ações do próprio funcionário logado
                    condicao_proprias_acoes = Q(vendedor_responsavel=user)
                    
                    acoes_qs = Acoes.objects.filter(
                        status=True,
                        loja__isnull=False
                    ).filter(
                        condicao_lojas_compartilhadas | condicao_proprias_acoes
                    ).distinct()
                else:
                    # Se o funcionário (níveis 3-5) não tiver lojas, mostra apenas as próprias.
                    print(f"[API_GET_ACOES] Usuário {user.username} sem lojas associadas - Acesso apenas às próprias ações")
                    acoes_qs = Acoes.objects.filter(
                        status=True,
                        loja__isnull=False,
                        vendedor_responsavel=user
                    )
            else:
                # Hierarquia não reconhecida ou sem permissão específica, não mostra nada.
                print(f"[API_GET_ACOES] Usuário {user.username} com hierarquia não reconhecida ({hierarquia})")
                acoes_qs = Acoes.objects.none()

        # Aplica filtros dinâmicos da requisição GET
        nome_cliente_filtro = request.GET.get('nome', '').strip()
        cpf_cliente_filtro = request.GET.get('cpf', '').strip()
        status_acao_filtro = request.GET.get('status', '').strip()
        loja_acao_filtro = request.GET.get('loja', '').strip() # Este é o nome da loja da Ação, não filtro hierárquico

        print(f"[API_GET_ACOES] Aplicando filtros: nome='{nome_cliente_filtro}', cpf='{cpf_cliente_filtro}', status='{status_acao_filtro}', loja='{loja_acao_filtro}'")

        if nome_cliente_filtro:
            acoes_qs = acoes_qs.filter(cliente__nome__icontains=nome_cliente_filtro)
        if cpf_cliente_filtro:
            acoes_qs = acoes_qs.filter(cliente__cpf__icontains=cpf_cliente_filtro)
        if status_acao_filtro:
            acoes_qs = acoes_qs.filter(status_emcaminhamento=status_acao_filtro)
        if loja_acao_filtro:
            # Aqui, assumimos que 'loja_acao_filtro' é o nome da loja da Ação.
            # Se for ID, a lógica de filtro precisa ser ajustada (ex: Q(loja__id=loja_acao_filtro) se for ID)
            acoes_qs = acoes_qs.filter(loja__nome__icontains=loja_acao_filtro)

        # Prepara a queryset final com prefetch e select_related para otimização
        print("[API_GET_ACOES] Otimizando query com select_related e prefetch_related")
        acoes_final_qs = acoes_qs.select_related(
            'cliente',
            'vendedor_responsavel', # User
            'advogado_responsavel', # User
            'loja'
        ).prefetch_related(
            'arquivos', # ArquivosAcoesINSS
            'vendedor_responsavel__funcionario_profile', # Para acessar dados do Funcionario do vendedor
            'advogado_responsavel__funcionario_profile' # Para acessar dados do Funcionario do advogado
        ).order_by('-data_criacao')

        print(f"[API_GET_ACOES] Total de ações encontradas: {acoes_final_qs.count()}")

        # Formata os dados para a tabela
        dados_acoes = []
        for acao in acoes_final_qs:
            arquivos_data = [{
                'id': arquivo.id,
                'titulo': arquivo.titulo,
                'data_import': arquivo.data_import.strftime('%d/%m/%Y %H:%M'),
                'url': arquivo.file.url if arquivo.file else None
            } for arquivo in acao.arquivos.all()]

            vendedor_nome = '-'
            if acao.vendedor_responsavel:
                # Tenta obter apelido do funcionário, senão nome completo do user, senão username
                try:
                    perfil_vendedor = acao.vendedor_responsavel.funcionario_profile
                    vendedor_nome = perfil_vendedor.apelido or acao.vendedor_responsavel.get_full_name() or acao.vendedor_responsavel.username
                except AttributeError: # Se funcionario_profile não existir ou não tiver apelido
                    vendedor_nome = acao.vendedor_responsavel.get_full_name() or acao.vendedor_responsavel.username
            
            dados_acoes.append({
                'id': acao.id,
                'cliente': acao.cliente.nome if acao.cliente else '-',
                'cpf': acao.cliente.cpf if acao.cliente else '-',
                'contato': acao.cliente.contato if acao.cliente else '-', # Adicionado campo contato do cliente
                'atendente': vendedor_nome, # Nome do vendedor/atendente
                'loja': acao.loja.nome if acao.loja else '-',
                'status': acao.get_status_emcaminhamento_display(),
                'motivo_incompleto': acao.motivo_incompleto if acao.status_emcaminhamento == 'INCOMPLETO' else None,
                'arquivos': arquivos_data,
                # Adicionar outros campos se necessário para a tabela
                'tipo_acao': acao.get_tipo_acao_display(),
                'data_criacao': acao.data_criacao.strftime('%d/%m/%Y %H:%M') if acao.data_criacao else '-',
                'sentenca': acao.get_sentenca_display() if acao.sentenca else '-',
            })

        print("[API_GET_ACOES] Dados formatados com sucesso, retornando resposta")
        return JsonResponse({
            'success': True,
            'acoes': dados_acoes
        })
    except Funcionario.DoesNotExist: # Captura aqui caso o .get() falhe mais acima e não seja pego
        # Isso pode acontecer se o usuário logado for deletado ou seu perfil de funcionário desativado
        # entre o login e a chamada desta API.
        print("[API_GET_ACOES] Erro: Perfil de funcionário não encontrado ou inativo")
        return JsonResponse({'success': True, 'acoes': [], 'message': 'Perfil de funcionário não encontrado ou inativo.'})
    except Exception as e:
        import traceback
        print(f"[API_GET_ACOES] Erro crítico: {str(e)}")
        print(traceback.format_exc())
        return JsonResponse({
            'success': False,
            'message': f'Erro ao obter ações: {str(e)}'
        }, status=500)

@login_required
@require_GET
@ensure_csrf_cookie
def api_get_arquivosacoes(request, acao_id):
    """
    API para buscar os arquivos de uma ação específica.
    
    Args:
        request: Requisição HTTP
        acao_id: ID da ação para buscar os arquivos
        
    Returns:
        JsonResponse com a lista de arquivos da ação
    """
    try:
        # Importar modelos do app juridico
        from apps.juridico.models import Acoes, ArquivosAcoesINSS
        
        # Buscar a ação
        acao = Acoes.objects.get(id=acao_id)
        
        # Buscar os arquivos da ação
        arquivos = ArquivosAcoesINSS.objects.filter(acao_inss=acao).order_by('-data_import')
        
        # Serializar os arquivos
        arquivos_list = []
        for arquivo in arquivos:
            arquivos_list.append({
                'id': arquivo.id,
                'titulo': arquivo.titulo,
                'tipo': 'Documento',  # Pode ser expandido para usar um campo específico do modelo
                'data_upload': arquivo.data_import.isoformat(),
                'url': arquivo.file.url if arquivo.file else None
            })
        
        return JsonResponse({
            'status': 'success',
            'arquivos': arquivos_list
        })
        
    except Acoes.DoesNotExist:
        return JsonResponse({
            'status': 'error',
            'message': 'Ação não encontrada'
        }, status=404)
    except Exception as e:
        print(f"[API_GET_ARQUIVOSACOES] Erro ao buscar arquivos: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao buscar arquivos: {str(e)}'
        }, status=500)


@login_required
@require_POST
@csrf_exempt  # Adicionado para resolver o erro de CSRF
@ensure_csrf_cookie
def api_post_arquivo(request):
    """
    API para enviar arquivos relacionados a uma ação INSS
    
    Args:
        request: Requisição HTTP contendo FormData com:
            - acao_id: ID da ação
            - titulo: Título do arquivo
            - arquivo: Arquivo a ser carregado
        
    Returns:
        JsonResponse com status da operação
    """
    if request.method != 'POST':
        return JsonResponse({
            'status': 'error',
            'message': 'Método não permitido. Use POST.'
        }, status=405)
    
    try:
        # Importar modelos do app juridico
        from apps.juridico.models import Acoes, ArquivosAcoesINSS
        
        # Obter dados do formulário
        acao_id = request.POST.get('acao_id')
        titulo = request.POST.get('titulo')
        arquivo = request.FILES.get('arquivo')
        
        # Validar campos obrigatórios
        if not all([acao_id, titulo, arquivo]):
            return JsonResponse({
                'status': 'error',
                'message': 'Todos os campos são obrigatórios (acao_id, titulo, arquivo)'
            }, status=400)
        
        # Buscar a ação
        try:
            acao = Acoes.objects.get(id=acao_id)
        except Acoes.DoesNotExist:
            return JsonResponse({
                'status': 'error',
                'message': 'Ação não encontrada'
            }, status=404)
        
        # Criar o registro do arquivo
        arquivo_acao = ArquivosAcoesINSS.objects.create(
            acao_inss=acao,
            titulo=titulo,
            file=arquivo
        )
        
        return JsonResponse({
            'status': 'success',
            'message': 'Arquivo adicionado com sucesso',
            'arquivo': {
                'id': arquivo_acao.id,
                'titulo': arquivo_acao.titulo,
                'data_upload': arquivo_acao.data_import.isoformat(),
                'url': arquivo_acao.file.url if arquivo_acao.file else None
            }
        })
        
    except Exception as e:
        print(f"[API_POST_ARQUIVO] Erro ao adicionar arquivo: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao adicionar arquivo: {str(e)}'
        }, status=500)

@login_required
@require_POST
@csrf_exempt
def api_post_finalizaratendimento(request):
    """API para finalizar um atendimento, alterando o status_atendimento para FINALIZADO."""
    print("[FINALIZAR_ATENDIMENTO] Iniciando processamento")
    try:
        # Obter ID do agendamento
        agendamento_id = request.POST.get('agendamento_id')
        
        if not agendamento_id:
            print("[FINALIZAR_ATENDIMENTO] ID do agendamento não fornecido")
            return JsonResponse({
                'status': 'error',
                'message': 'ID do agendamento não fornecido'
            }, status=400)
        
        # Buscar o agendamento
        try:
            agendamento = Agendamento.objects.get(id=agendamento_id)
            print(f"[FINALIZAR_ATENDIMENTO] Agendamento encontrado: {agendamento.id}")
        except Agendamento.DoesNotExist:
            print(f"[FINALIZAR_ATENDIMENTO] Agendamento não encontrado: {agendamento_id}")
            return JsonResponse({
                'status': 'error',
                'message': 'Agendamento não encontrado'
            }, status=404)
        
        # Atualizar o status do atendimento
        agendamento.status_atendimento = Agendamento.StatusAtendimentoChoices.FINALIZADO
        agendamento.save()
        print(f"[FINALIZAR_ATENDIMENTO] Agendamento {agendamento.id} finalizado com sucesso")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Atendimento finalizado com sucesso'
        })
        
    except Exception as e:
        print(f"[FINALIZAR_ATENDIMENTO] Erro ao finalizar atendimento: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao finalizar atendimento: {str(e)}'
        }, status=500)

@login_required
@require_POST
@csrf_exempt
def api_post_adicionaracao(request):
    """API para adicionar uma ação judicial a um agendamento existente."""
    print("[ADICIONAR_ACAO] Iniciando processamento")
    try:
        # Obter dados do formulário
        agendamento_id = request.POST.get('agendamento_id')
        tipo_acao = request.POST.get('tipo_acao')
        senha_inss = request.POST.get('senha_inss')
        tipo_pagamento = request.POST.get('tipo_pagamento')
        
        print(f"[ADICIONAR_ACAO] POST data: {request.POST}")
        print(f"[ADICIONAR_ACAO] FILES data: {request.FILES}")
        
        print(f"[ADICIONAR_ACAO] Dados recebidos - Agendamento: {agendamento_id}, Tipo Ação: {tipo_acao}, Tipo Pagamento: {tipo_pagamento}")
        
        # Verificar campos obrigatórios
        if not all([agendamento_id, tipo_acao, tipo_pagamento]):
            print("[ADICIONAR_ACAO] Campos obrigatórios ausentes")
            return JsonResponse({
                'status': 'error',
                'message': 'Campos obrigatórios ausentes: ID do agendamento, tipo de ação e tipo de pagamento'
            }, status=400)
        
        # Buscar o agendamento
        try:
            agendamento = Agendamento.objects.select_related('cliente_agendamento', 'loja').get(id=agendamento_id)
            print(f"[ADICIONAR_ACAO] Agendamento encontrado: {agendamento.id}")
        except Agendamento.DoesNotExist:
            print(f"[ADICIONAR_ACAO] Agendamento não encontrado: {agendamento_id}")
            return JsonResponse({
                'status': 'error',
                'message': 'Agendamento não encontrado'
            }, status=404)
        
        # Preparar dados para criar a ação
        cliente_agendamento_instance = agendamento.cliente_agendamento
        
        # Importar ClienteAcao e Acoes aqui para evitar importação circular no topo do arquivo, se aplicável
        from apps.juridico.models import Acoes, ClienteAcao, ArquivosAcoesINSS
        
        # Encontrar ou criar o ClienteAcao correspondente (do app juridico)
        # Assumindo que ClienteAgendamento (cliente_agendamento_instance) tem 'cpf_cliente' e 'nome_cliente'
        # e ClienteAcao tem 'cpf' e 'nome'
        cpf_cliente_str = cliente_agendamento_instance.cpf
        nome_cliente_str = cliente_agendamento_instance.nome_completo
        contato_cliente_str = cliente_agendamento_instance.numero

        cliente_acao_obj, cliente_acao_created = ClienteAcao.objects.get_or_create(
            cpf=cpf_cliente_str,
            defaults={
                'nome': nome_cliente_str,
                'contato': contato_cliente_str
            }
        )
        if cliente_acao_created:
            print(f"[ADICIONAR_ACAO] Novo ClienteAcao criado: {cliente_acao_obj.id} - {cliente_acao_obj.cpf}")
        else:
            print(f"[ADICIONAR_ACAO] ClienteAcao existente encontrado: {cliente_acao_obj.id} - {cliente_acao_obj.cpf}")

        # Criar presença na loja (sempre criar uma nova)
        vendedor_id = request.POST.get('vendedor')
        vendedor = User.objects.get(id=vendedor_id) if vendedor_id else None

        presenca = PresencaLoja.objects.create(
            agendamento=agendamento,
            cliente_agendamento=cliente_agendamento_instance,
            loja_comp=agendamento.loja,
            vendedor=vendedor,
            tabulacao_venda=PresencaLoja.TabulacaoVendaChoices.NEGOCIO_FECHADO,
            cliente_rua=False, # Esta view trata de ações originadas de agendamentos
            data_presenca=timezone.now()
        )
        print(f'[ADICIONAR_ACAO] Nova PresencaLoja criada com ID: {presenca.id}')
        
        # Criar ação judicial
        acao = Acoes.objects.create(
            cliente=cliente_acao_obj,
            status_emcaminhamento=Acoes.StatusChoices.EM_ESPERA,
            senha_inss=senha_inss,
            tipo_acao=tipo_acao,
            vendedor_responsavel=vendedor,  # Corrigido: usando o nome correto do campo
            loja=agendamento.loja  # Adicionando a loja do agendamento
        )
        print(f"[ADICIONAR_ACAO] Ação criada: {acao.id}")
        
        # Processar informações de pagamento
        from apps.juridico.models import RegistroPagamentos
        if tipo_pagamento in ['A_VISTA', 'PARCELADO']:
            valor_total = Decimal('0')
            tipo_pagamento_model = None
            if tipo_pagamento == 'A_VISTA':
                valor_total_str = request.POST.get('valor_total', '0').replace('R$', '').replace('.', '').replace(',', '.')
                try:
                    valor_total = Decimal(valor_total_str)
                except:
                    valor_total = Decimal('0')
                tipo_pagamento_model = RegistroPagamentos.TipoPagamentoChoices.A_VISTA
                RegistroPagamentos.objects.create(
                    acao_inss=acao,
                    tipo_pagamento=tipo_pagamento_model,
                    valor_total=valor_total,
                    valor_entrada=valor_total,
                    parcelas_totais=0,
                    parcelas_restantes=0,
                    parcelas_pagas=0,
                    status=RegistroPagamentos.StatusPagamentoChoices.EM_ANDAMENTO
                )
                print(f"[ADICIONAR_ACAO] Registro de pagamento à vista criado: Valor: {valor_total}")
            elif tipo_pagamento == 'PARCELADO':
                valor_entrada_str = request.POST.get('valor_entrada', '0').replace('R$', '').replace('.', '').replace(',', '.')
                qtd_parcelas_str = request.POST.get('qtd_parcelas', '0')
                valor_parcela_str = request.POST.get('valor_parcela', '0').replace('R$', '').replace('.', '').replace(',', '.')
                try:
                    valor_entrada = Decimal(valor_entrada_str)
                    qtd_parcelas = int(qtd_parcelas_str)
                    valor_parcela = Decimal(valor_parcela_str)
                    valor_total = valor_entrada + (qtd_parcelas * valor_parcela)
                except:
                    valor_entrada = Decimal('0')
                    qtd_parcelas = 0
                    valor_parcela = Decimal('0')
                    valor_total = Decimal('0')
                tipo_pagamento_model = RegistroPagamentos.TipoPagamentoChoices.PARCELADO
                RegistroPagamentos.objects.create(
                    acao_inss=acao,
                    tipo_pagamento=tipo_pagamento_model,
                    valor_total=valor_total,
                    valor_entrada=valor_entrada,
                    parcelas_totais=qtd_parcelas,
                    parcelas_restantes=qtd_parcelas,
                    parcelas_pagas=0,
                    status=RegistroPagamentos.StatusPagamentoChoices.EM_ANDAMENTO
                )
                print(f"[ADICIONAR_ACAO] Registro de pagamento parcelado criado: Valor total: {valor_total}, Entrada: {valor_entrada}, Parcelas: {qtd_parcelas}x{valor_parcela}")
        
        # Processar documentos
        documentos = []
        i = 0
        while True:
            # Verificar se existe um documento com o índice atual
            titulo = request.POST.get(f'documentos[{i}][titulo]')
            if not titulo:
                break
                
            arquivo = request.FILES.get(f'documentos[{i}][file]')
            if arquivo:
                documento = ArquivosAcoesINSS.objects.create(
                    acao_inss=acao,
                    titulo=titulo,
                    file=arquivo
                )
                documentos.append(documento)
                print(f"[ADICIONAR_ACAO] Documento adicionado: {documento.id}, Título: {titulo}, Arquivo: {arquivo.name}")
            i += 1
        
        print(f"[ADICIONAR_ACAO] Total de {len(documentos)} documentos adicionados")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Ação adicionada com sucesso',
            'acao_id': acao.id,
            'documentos_count': len(documentos)
        })
        
    except Exception as e:
        print(f"[ADICIONAR_ACAO] Erro ao adicionar ação: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao adicionar ação: {str(e)}'
        }, status=500)


@login_required
@require_POST
def api_post_clienterua_acao(request):
    """
    API para processar o formulário de cliente rua com ação.
    
    Esta função cria registros de:
    1. ClienteAgendamento (app inss)
    2. PresencaLoja (app inss) com acao=True
    3. ClienteAcao (app juridico)
    4. Acoes (app juridico)
    5. RegistroPagamentos (app juridico) se aplicável
    6. ArquivosAcoesINSS (app juridico) para os documentos enviados
    """
    print("[CLIENTE_RUA_ACAO] Iniciando processamento")
    try:
        # Verificar se o formulário é do tipo cliente_rua_acao
        form_type = request.POST.get('form_type')
        if form_type != 'cliente_rua_acao':
            return JsonResponse({
                'status': 'error',
                'message': 'Tipo de formulário inválido'
            }, status=400)
        
        # Obter dados do formulário
        data = {
            'nome_cliente': request.POST.get('nome_cliente'),
            'cpf_cliente': request.POST.get('cpf_cliente', '').replace('.', '').replace('-', ''),
            'numero_cliente': request.POST.get('numero_cliente'),
            'data_comparecimento': request.POST.get('data_comparecimento'),
            'loja_id': request.POST.get('loja'),
            'vendedor_id': request.POST.get('vendedor_id'),
            'senha_inss': request.POST.get('senha_inss'),
            'tipo_acao': request.POST.get('tipo_acao'),
            'tipo_pagamento': request.POST.get('tipo_pagamento'),
            'valor_total': request.POST.get('valor_total'),
            'valor_entrada': request.POST.get('valor_entrada'),
            'qtd_parcelas': request.POST.get('qtd_parcelas'),
            'valor_parcela': request.POST.get('valor_parcela')
        }
        
        print(f"[CLIENTE_RUA_ACAO] Dados recebidos: {data}")
        print(f"[CLIENTE_RUA_ACAO] FILES data: {request.FILES}")
        
        # Validar campos obrigatórios
        campos_obrigatorios = {
            'nome_cliente': 'Nome do cliente',
            'cpf_cliente': 'CPF do cliente',
            'numero_cliente': 'Número de contato',
            'data_comparecimento': 'Data de comparecimento',
            'loja_id': 'Loja',
            'vendedor_id': 'Vendedor',
            'tipo_acao': 'Tipo de ação',
            'tipo_pagamento': 'Tipo de pagamento'
        }
        
        for campo, descricao in campos_obrigatorios.items():
            if not data[campo]:
                return JsonResponse({
                    'status': 'error',
                    'message': f'{descricao} é obrigatório'
                }, status=400)
        
        # Validar campos de pagamento
        if data['tipo_pagamento'] == 'A_VISTA' and not data['valor_total']:
            return JsonResponse({
                'status': 'error',
                'message': 'Valor total é obrigatório para pagamento à vista'
            }, status=400)
        elif data['tipo_pagamento'] == 'PARCELADO' and not all([data['valor_entrada'], data['qtd_parcelas'], data['valor_parcela']]):
            return JsonResponse({
                'status': 'error',
                'message': 'Todos os campos do parcelamento são obrigatórios'
            }, status=400)
        
        # Criar ou atualizar cliente no app inss
        try:
            cliente = ClienteAgendamento.objects.get(cpf=data['cpf_cliente'])
            print(f"[CLIENTE_RUA_ACAO] Cliente existente encontrado: {cliente.id}")
            # Atualizar dados do cliente
            cliente.nome_completo = data['nome_cliente']
            cliente.numero = data['numero_cliente']
            cliente.save()
            print("[CLIENTE_RUA_ACAO] Dados do cliente atualizados")
        except ClienteAgendamento.DoesNotExist:
            print("[CLIENTE_RUA_ACAO] Criando novo cliente")
            cliente = ClienteAgendamento.objects.create(
                nome_completo=data['nome_cliente'],
                cpf=data['cpf_cliente'],
                numero=data['numero_cliente']
            )
            print(f"[CLIENTE_RUA_ACAO] Novo cliente criado: {cliente.id}")
        
        # Obter loja e vendedor
        try:
            loja = Loja.objects.get(id=data['loja_id'])
            print(f"[CLIENTE_RUA_ACAO] Loja encontrada: {loja.id}")
            
            # Buscar o Funcionario vendedor para obter o User associado
            funcionario_vendedor = Funcionario.objects.get(id=data['vendedor_id'])
            vendedor = funcionario_vendedor.usuario # Este é o objeto User
            if not vendedor:
                 print(f"[CLIENTE_RUA_ACAO] Erro: Funcionário {funcionario_vendedor.id} não tem usuário de sistema associado.")
                 return JsonResponse({
                     'status': 'error',
                     'message': f'O funcionário selecionado como vendedor ({funcionario_vendedor.nome_completo if funcionario_vendedor else data["vendedor_id"]}) não possui um usuário de sistema vinculado.'
                 }, status=400)
            print(f"[CLIENTE_RUA_ACAO] Vendedor (User) encontrado: {vendedor.id} via Funcionario ID: {funcionario_vendedor.id}")

        except Loja.DoesNotExist:
            print(f"[CLIENTE_RUA_ACAO] Erro: Loja com ID {data['loja_id']} não encontrada.")
            return JsonResponse({'status': 'error', 'message': 'Loja não encontrada.'}, status=404)
        except Funcionario.DoesNotExist:
            print(f"[CLIENTE_RUA_ACAO] Erro: Funcionário vendedor com ID {data['vendedor_id']} não encontrado.")
            return JsonResponse({'status': 'error', 'message': 'Funcionário vendedor não encontrado.'}, status=404)
        except Exception as e: # Captura outras exceções genéricas durante a busca de loja/vendedor
            print(f"[CLIENTE_RUA_ACAO] Erro inesperado ao buscar loja/vendedor: {str(e)}")
            return JsonResponse({
                'status': 'error',
                'message': f'Erro ao processar dados da loja ou vendedor: {str(e)}'
            }, status=500)
        
        # Criar presença na loja
        presenca = PresencaLoja.objects.create(
            cliente_agendamento=cliente,
            loja_comp=loja,
            vendedor=vendedor,
            tabulacao_venda=PresencaLoja.TabulacaoVendaChoices.NEGOCIO_FECHADO,
            cliente_rua=True,
            acao=True,  # Marcando como presença com ação judicial
            data_presenca=timezone.now()
        )
        print(f"[CLIENTE_RUA_ACAO] Presença criada: {presenca.id}")
        
        # Importar modelos do app juridico
        from apps.juridico.models import Acoes, ClienteAcao, ArquivosAcoesINSS, RegistroPagamentos
        
        # Criar ou obter cliente no app juridico
        cliente_acao, created = ClienteAcao.objects.get_or_create(
            cpf=data['cpf_cliente'],
            defaults={
                'nome': data['nome_cliente'],
                'contato': data['numero_cliente']
            }
        )
        if created:
            print(f"[CLIENTE_RUA_ACAO] Novo ClienteAcao criado: {cliente_acao.id}")
        else:
            print(f"[CLIENTE_RUA_ACAO] ClienteAcao existente encontrado: {cliente_acao.id}")
            # Atualizar dados do cliente
            cliente_acao.nome = data['nome_cliente']
            cliente_acao.contato = data['numero_cliente']
            cliente_acao.save()
        
        # Criar ação judicial
        acao = Acoes.objects.create(
            cliente=cliente_acao,
            status_emcaminhamento=Acoes.StatusChoices.EM_ESPERA,
            senha_inss=data['senha_inss'],
            tipo_acao=data['tipo_acao'],
            vendedor_responsavel=vendedor,
            loja=loja
        )
        print(f"[CLIENTE_RUA_ACAO] Ação criada: {acao.id}")
        
        # Processar informações de pagamento
        if data['tipo_pagamento'] in ['A_VISTA', 'PARCELADO']:
            valor_total = Decimal('0')
            tipo_pagamento_model = None
            from apps.juridico.models import RegistroPagamentos
            if data['tipo_pagamento'] == 'A_VISTA':
                valor_total_str = data['valor_total'].replace('R$', '').replace('.', '').replace(',', '.') if data['valor_total'] else '0'
                try:
                    valor_total = Decimal(valor_total_str)
                except:
                    valor_total = Decimal('0')
                tipo_pagamento_model = RegistroPagamentos.TipoPagamentoChoices.A_VISTA
                registro_pagamento = RegistroPagamentos.objects.create(
                    acao_inss=acao,
                    tipo_pagamento=tipo_pagamento_model,
                    valor_total=valor_total,
                    valor_entrada=valor_total,
                    parcelas_totais=0,
                    parcelas_restantes=0,
                    parcelas_pagas=0,
                    status=RegistroPagamentos.StatusPagamentoChoices.EM_ANDAMENTO
                )
                print(f"[CLIENTE_RUA_ACAO] Registro de pagamento à vista criado: {registro_pagamento.id}, Valor: {valor_total}")
            elif data['tipo_pagamento'] == 'PARCELADO':
                valor_entrada_str = data['valor_entrada'].replace('R$', '').replace('.', '').replace(',', '.') if data['valor_entrada'] else '0'
                qtd_parcelas_str = data['qtd_parcelas'] if data['qtd_parcelas'] else '0'
                valor_parcela_str = data['valor_parcela'].replace('R$', '').replace('.', '').replace(',', '.') if data['valor_parcela'] else '0'
                try:
                    valor_entrada = Decimal(valor_entrada_str)
                    qtd_parcelas = int(qtd_parcelas_str)
                    valor_parcela = Decimal(valor_parcela_str)
                    valor_total = valor_entrada + (qtd_parcelas * valor_parcela)
                except:
                    valor_entrada = Decimal('0')
                    qtd_parcelas = 0
                    valor_parcela = Decimal('0')
                    valor_total = Decimal('0')
                tipo_pagamento_model = RegistroPagamentos.TipoPagamentoChoices.PARCELADO
                registro_pagamento = RegistroPagamentos.objects.create(
                    acao_inss=acao,
                    tipo_pagamento=tipo_pagamento_model,
                    valor_total=valor_total,
                    valor_entrada=valor_entrada,
                    parcelas_totais=qtd_parcelas,
                    parcelas_restantes=qtd_parcelas,
                    parcelas_pagas=0,
                    status=RegistroPagamentos.StatusPagamentoChoices.EM_ANDAMENTO
                )
                print(f"[CLIENTE_RUA_ACAO] Registro de pagamento parcelado criado: {registro_pagamento.id}, Valor total: {valor_total}, Entrada: {valor_entrada}, Parcelas: {qtd_parcelas}x{valor_parcela}")
        
        # Processar arquivos
        arquivos = []
        for key, file in request.FILES.items():
            if key.startswith('arquivo_'):
                titulo = request.POST.get(f'titulo_{key}', f'Arquivo {len(arquivos) + 1}')
                arquivo = ArquivosAcoesINSS.objects.create(
                    acao_inss=acao,
                    titulo=titulo,
                    file=file
                )
                arquivos.append(arquivo)
                print(f"[CLIENTE_RUA_ACAO] Arquivo adicionado: {arquivo.id}, Título: {titulo}, Arquivo: {file.name}")
        
        print(f"[CLIENTE_RUA_ACAO] Total de {len(arquivos)} arquivos adicionados")
        
        return JsonResponse({
            'status': 'success',
            'message': 'Cliente com ação registrado com sucesso',
            'presenca_id': presenca.id,
            'acao_id': acao.id,
            'arquivos_count': len(arquivos)
        })
        
    except Exception as e:
        print(f"[CLIENTE_RUA_ACAO] Erro ao processar cliente rua com ação: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            'status': 'error',
            'message': f'Erro ao processar cliente rua com ação: {str(e)}'
        }, status=500)
