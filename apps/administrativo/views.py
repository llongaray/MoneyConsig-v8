from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Count, Q, F, Case, When, Value, DecimalField, CharField
from django.db.models.functions import Coalesce, ExtractYear, ExtractMonth
from django.utils import timezone
import datetime
from decimal import Decimal
import datetime
import json
from django.forms.models import model_to_dict
from datetime import timedelta
import re

# Import models from other apps
from apps.funcionarios.models import *
from apps.siape.models import *
from apps.inss.models import Agendamento as INSS_Agendamento, PresencaLoja as INSS_PresencaLoja
from apps.inss.models import *



from django.shortcuts import render # Adicionar import se não existir no topo do arquivo
from django.contrib.auth.decorators import login_required # Import já presente no contexto
from django.views.decorators.http import require_GET # Adicionar import se não existir


import logging
logger = logging.getLogger(__name__)
# renderização de paginas

from custom_tags_app.templatetags.permissionsacess import controle_acess

@login_required
@controle_acess('SCT9')   #  9 – ADMINISTRATIVO | DASHBOARD
def render_dashboard(request):
    """
    Renderiza a página principal do dashboard administrativo.
    Os dados são carregados dinamicamente via API (api_get_dashboard).
    """
    logger.debug("Iniciando render_dashboard administrativo")
    return render(request, 'administrativo/dashboard.html')

@login_required
@controle_acess('SCT10')  # 10 – ADMINISTRATIVO | CONTROLE DE METAS
def render_controlemetas(request):
    """
    Renderiza a página HTML para o controle e cadastro de metas.
    """
    logger.debug("Iniciando render_controlemetas")
    return render(request, 'administrativo/controle_metas.html')

@login_required
@require_GET              # Garante que esta view só responda a requisições GET
@controle_acess('SCT11')  # 11 – ADMINISTRATIVO | REEMBOLSOS
def render_reembolso(request):
    """
    Renderiza a página principal de controle de reembolsos.

    Esta view simplesmente renderiza o template HTML base. Os dados
    dinâmicos (tabelas, estatísticas) são carregados de forma assíncrona
    pelo JavaScript no frontend, que faz chamadas para as API views
    (ex: api_get_inforeembolso).
    """
    logger.debug("Iniciando render_reembolso administrativo")
    return render(request, 'administrativo/reembolso.html')

@login_required
@controle_acess('SCT52')
def render_importscsvs(request):
    """
    Renderiza a página de importação de CSVs do Administrativo.
    Não envia nenhum contexto adicional ao template.
    """
    logger.debug("Iniciando render_importscsvs")
    return render(request, 'administrativo/import_csvs.html')

# fim renderização de paginas


# Helper function for currency formatting (optional, frontend can also handle)
def format_currency(value):
    if value is None:
        return "R$ 0,00"
    try:
        # Ensure value is Decimal
        value = Decimal(value)
        return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    except (TypeError, ValueError):
        return "R$ 0,00"

# Helper function for percentage formatting (optional)
def format_percentage(value):
    if value is None:
        return "0.0%"
    try:
        value = Decimal(value)
        return f"{value:.1f}%"
    except (TypeError, ValueError):
        return "0.0%"


# -------------------------------------------
# INICIO API GET/POST DASHBOARD
# Funções relacionadas às requisições da dashboard administrativa
# -------------------------------------------

import traceback
from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum, Q
from django.db.models.functions import Coalesce

from django.utils import timezone


@login_required
@require_GET
def api_get_dashboard_financeiro(request):
    """
    API endpoint para retornar dados financeiros do dashboard:
    - Faturamento por empresa (anual e mensal)
    - Faturamento por loja sede (anual e mensal)
    - Faturamento por franquia (anual e mensal)
    - Faturamento por filial (anual e mensal)
    """
    try:
        now = timezone.now()
        print(f"[DASHBOARD FINANCEIRO] Iniciando em {now.isoformat()}")

        # --- Intervalos de Data ---
        start_year = now.replace(month=1, day=1,  hour=0, minute=0, second=0, microsecond=0)
        end_year = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = start_month.replace(month=start_month.month % 12 + 1, day=1)
        if start_month.month == 12:
            next_month = next_month.replace(year=start_month.year + 1)
        end_month = next_month - timedelta(microseconds=1)

        registros_financeiros = RegisterMoney.objects.filter(status=True)
        data = {
            'empresas': {},
            'interno': {},
            'franquia': {},
            'filial': {},
            'timestamp': now.isoformat()
        }

        # --- Empresas ---
        for emp in Empresa.objects.filter(status=True).order_by('nome'):
            fat_ano = registros_financeiros.filter(
                empresa=emp, data__range=(start_year, end_year)
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
            fat_mes = registros_financeiros.filter(
                empresa=emp, data__range=(start_month, end_month)
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
            data['empresas'][emp.nome] = {
                'faturamento_ano': fat_ano,
                'faturamento_mes': fat_mes
            }
            print(f"[DASHBOARD FINANCEIRO] Empresa '{emp.nome}': ano={fat_ano}, mes={fat_mes}")

        # --- Lojas Sede (interno) ---
        for loja in Loja.objects.filter(status=True, filial=False, franquia=False):
            fat_ano = registros_financeiros.filter(
                loja=loja, data__range=(start_year, end_year)
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
            fat_mes = registros_financeiros.filter(
                loja=loja, data__range=(start_month, end_month)
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
            data['interno'][loja.nome] = {
                'faturamento_ano': fat_ano,
                'faturamento_mes': fat_mes
            }
            print(f"[DASHBOARD FINANCEIRO] Sede '{loja.nome}': ano={fat_ano}, mes={fat_mes}")

        # --- Franquias ---
        for loja in Loja.objects.filter(status=True, franquia=True):
            fat_ano = registros_financeiros.filter(
                loja=loja, data__range=(start_year, end_year)
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
            fat_mes = registros_financeiros.filter(
                loja=loja, data__range=(start_month, end_month)
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
            data['franquia'][loja.nome] = {
                'faturamento_ano': fat_ano,
                'faturamento_mes': fat_mes
            }
            print(f"[DASHBOARD FINANCEIRO] Franquia '{loja.nome}': ano={fat_ano}, mes={fat_mes}")

        # --- Filiais ---
        for loja in Loja.objects.filter(status=True, filial=True):
            fat_ano = registros_financeiros.filter(
                loja=loja, data__range=(start_year, end_year)
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
            fat_mes = registros_financeiros.filter(
                loja=loja, data__range=(start_month, end_month)
            ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
            data['filial'][loja.nome] = {
                'faturamento_ano': fat_ano,
                'faturamento_mes': fat_mes
            }
            print(f"[DASHBOARD FINANCEIRO] Filial '{loja.nome}': ano={fat_ano}, mes={fat_mes}")

        return JsonResponse(data)

    except Exception as e:
        print(f"[DASHBOARD FINANCEIRO] Erro: {e}")
        traceback.print_exc()
        return JsonResponse({
            'error': 'Erro interno ao processar dados financeiros do dashboard.',
            'details': str(e)
        }, status=500)

@login_required
@require_GET
def api_get_dashboard_lojas(request):
    """
    API endpoint para retornar métricas das lojas:
    - Métricas agregadas das lojas sede
    - Métricas individuais por filial
    - Métricas individuais por franquia
    """
    try:
        now = timezone.now()
        print(f"[DASHBOARD LOJAS] Iniciando em {now.isoformat()}")

        # --- Intervalos de Data ---
        start_year = now.replace(month=1, day=1,  hour=0, minute=0, second=0, microsecond=0)
        end_year = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = start_month.replace(month=start_month.month % 12 + 1, day=1)
        if start_month.month == 12:
            next_month = next_month.replace(year=start_month.year + 1)
        end_month = next_month - timedelta(microseconds=1)

        registros_financeiros = RegisterMoney.objects.filter(status=True)
        data = {
            'sede': {},
            'filiais_list': [],
            'franquias_list': [],
            'timestamp': now.isoformat()
        }

        def get_loja_metrics(loja_inst):
            """Calcula métricas para uma loja específica"""
            print(f"[DASHBOARD LOJAS] Calculando métricas para '{loja_inst.nome}'")
            m = {
                'faturamento_ano': registros_financeiros.filter(
                    loja=loja_inst, data__range=(start_year, end_year)
                ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0),
                'faturamento_mes': registros_financeiros.filter(
                    loja=loja_inst, data__range=(start_month, end_month)
                ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0),
                'taxa_comparecimento': Decimal(0),
                'clientes_rua': 0,
                'negocios_fechados': 0,
                'agendamentos': 0,
                'sem_interesse': 0
            }

            # Métricas de agendamento e presença
            ag_m = INSS_Agendamento.objects.filter(
                loja=loja_inst, dia_agendado__range=(start_month, end_month)
            ).count()
            pr_qs = INSS_PresencaLoja.objects.filter(
                loja_comp=loja_inst, data_presenca__range=(start_month, end_month)
            )

            m['agendamentos'] = ag_m
            comp = pr_qs.exclude(cliente_rua=True).count()
            if ag_m:
                m['taxa_comparecimento'] = (Decimal(comp) / Decimal(ag_m)) * 100

            m['clientes_rua'] = pr_qs.filter(cliente_rua=True).count()
            m['negocios_fechados'] = pr_qs.filter(
                tabulacao_venda=INSS_PresencaLoja.TabulacaoVendaChoices.NEGOCIO_FECHADO
            ).count()
            m['sem_interesse'] = pr_qs.filter(
                tabulacao_venda__in=[
                    INSS_PresencaLoja.TabulacaoVendaChoices.NAO_ACEITOU,
                    INSS_PresencaLoja.TabulacaoVendaChoices.NAO_QUIS_OUVIR,
                    INSS_PresencaLoja.TabulacaoVendaChoices.INELEGIVEL
                ]
            ).count()

            print(f"[DASHBOARD LOJAS] Métricas para '{loja_inst.nome}': {m}")
            return m

        # --- Métricas Agregadas das Lojas Sede ---
        sede_lojas = Loja.objects.filter(status=True, filial=False, franquia=False)
        sede_tot = {
            'faturamento_ano': Decimal(0), 'faturamento_mes': Decimal(0),
            'taxa_comparecimento': Decimal(0), 'clientes_rua': 0,
            'negocios_fechados': 0, 'agendamentos': 0, 'sem_interesse': 0
        }
        sum_age = sum_comp = 0

        for s in sede_lojas:
            mt = get_loja_metrics(s)
            for k in sede_tot:
                sede_tot[k] += mt[k]
            ag_ct = mt['agendamentos']
            cp_ct = mt['taxa_comparecimento'] * ag_ct / 100 if ag_ct else 0
            sum_age += ag_ct
            sum_comp += cp_ct

        if sum_age:
            sede_tot['taxa_comparecimento'] = (Decimal(sum_comp) / Decimal(sum_age)) * 100

        data['sede'] = sede_tot
        print(f"[DASHBOARD LOJAS] Métricas agregadas sede: {sede_tot}")

        # --- Métricas por Filial ---
        for f in Loja.objects.filter(status=True, filial=True):
            entry = {
                'id': f.id,
                'nome': f.nome,
                'metrics': get_loja_metrics(f)
            }
            data['filiais_list'].append(entry)

        # --- Métricas por Franquia ---
        for fq in Loja.objects.filter(status=True, franquia=True):
            entry = {
                'id': fq.id,
                'nome': fq.nome,
                'metrics': get_loja_metrics(fq)
            }
            data['franquias_list'].append(entry)

        return JsonResponse(data)

    except Exception as e:
        print(f"[DASHBOARD LOJAS] Erro: {e}")
        traceback.print_exc()
        return JsonResponse({
            'error': 'Erro interno ao processar métricas das lojas.',
            'details': str(e)
        }, status=500)

@login_required
@require_GET
def api_get_dashboard_rh(request):
    """
    API endpoint para retornar dados de RH:
    - Quantidade de funcionários ativos/inativos
    - Desempenho por funcionário (faturamento, clientes, comissões)
    """
    try:
        now = timezone.now()
        print(f"[DASHBOARD RH] Iniciando em {now.isoformat()}")

        # --- Intervalos de Data ---
        start_year = now.replace(month=1, day=1,  hour=0, minute=0, second=0, microsecond=0)
        end_year = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month = start_month.replace(month=start_month.month % 12 + 1, day=1)
        if start_month.month == 12:
            next_month = next_month.replace(year=start_month.year + 1)
        end_month = next_month - timedelta(microseconds=1)

        registros_financeiros = RegisterMoney.objects.filter(status=True)
        data = {
            'geral': {'ativos': 0, 'inativos': 0},
            'funcionarios_list': [],
            'desempenho': {},
            'timestamp': now.isoformat()
        }

        # --- Contagem Geral ---
        funcs = Funcionario.objects.select_related('usuario').prefetch_related('regras_comissionamento')
        data['geral']['ativos'] = funcs.filter(status=True).count()
        data['geral']['inativos'] = funcs.filter(status=False).count()
        print(f"[DASHBOARD RH] Ativos={data['geral']['ativos']}, Inativos={data['geral']['inativos']}")

        # --- Desempenho por Funcionário ---
        for fn in funcs.filter(status=True).order_by('nome_completo'):
            data['funcionarios_list'].append({
                'id': fn.id,
                'nome': fn.apelido or fn.nome_completo
            })

            desempenho = {
                'faturamento_ano': Decimal(0),
                'faturamento_mes': Decimal(0),
                'clientes_concluidos': 0,
                'comissao_total_mes': Decimal(0)
            }

            if fn.usuario:
                ur = registros_financeiros.filter(user=fn.usuario)
                
                # Faturamento
                desempenho['faturamento_ano'] = ur.filter(
                    data__range=(start_year, end_year)
                ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)
                
                desempenho['faturamento_mes'] = ur.filter(
                    data__range=(start_month, end_month)
                ).aggregate(total=Sum('valor_est'))['total'] or Decimal(0)

                # Clientes Concluídos
                desempenho['clientes_concluidos'] = ur.filter(
                    data__range=(start_month, end_month)
                ).values('cpf_cliente').distinct().count()

                # Cálculo de Comissão
                total_com = Decimal(0)
                for rg in fn.regras_comissionamento.filter(status=True):
                    base = desempenho['faturamento_mes']
                    if rg.percentual is not None:
                        if ((rg.valor_de is None or base >= rg.valor_de) and
                            (rg.valor_ate is None or base <= rg.valor_ate)):
                            total_com += (base * rg.percentual) / Decimal(100)
                    elif rg.valor_fixo is not None:
                        if ((rg.valor_de is None or base >= rg.valor_de) and
                            (rg.valor_ate is None or base <= rg.valor_ate)):
                            total_com += rg.valor_fixo

                desempenho['comissao_total_mes'] = total_com
                print(f"[DASHBOARD RH] Funcionário '{fn.nome_completo}': {desempenho}")

            data['desempenho'][fn.id] = desempenho

        return JsonResponse(data)

    except Exception as e:
        print(f"[DASHBOARD RH] Erro: {e}")
        traceback.print_exc()
        return JsonResponse({
            'error': 'Erro interno ao processar dados de RH.',
            'details': str(e)
        }, status=500)

@login_required
@require_GET
def api_get_dashboard_metas(request):
    """
    API endpoint para retornar dados de metas:
    - Metas ativas: valor meta, atingido, restante e status
    - Metas inativas: valor meta, atingido, restante e status
    """
    try:
        now = timezone.now()
        print(f"[DASHBOARD METAS] Iniciando em {now.isoformat()}")

        data = {
            'ativas_list': [],
            'inativadas_list': [],
            'timestamp': now.isoformat()
        }

        def calcular_meta_atingida(meta):
            """Calcula o valor atingido para uma meta específica"""
            q = Q(status=True, data__range=(meta.data_inicio, meta.data_fim))
            
            if meta.categoria == 'GERAL':
                pass
            elif meta.categoria == 'EMPRESA':
                q &= Q(empresa__isnull=False)
            elif meta.categoria == 'FRANQUIA':
                q &= Q(loja__franquia=True)
            elif meta.categoria == 'LOJAS':
                q &= Q(loja__isnull=False)
            elif meta.categoria == 'SETOR' and meta.setor:
                q &= Q(setor=meta.setor)
            elif meta.categoria == 'OUTROS' and meta.equipe.exists():
                q &= Q(equipe__in=meta.equipe.all())

            total = RegisterMoney.objects.filter(q).aggregate(
                total=Sum('valor_est')
            )['total'] or Decimal(0)
            
            print(f"[DASHBOARD METAS] Meta '{meta.titulo}' atingido={total}")
            return total

        # --- Metas Ativas ---
        metas_ativas = RegisterMeta.objects.filter(
            status=True,
            data_inicio__lte=now,
            data_fim__gte=now
        )

        for m in metas_ativas:
            vm = m.valor or Decimal(0)
            va = calcular_meta_atingida(m)
            restante = max(Decimal(0), vm - va)
            pct = (va / vm * 100) if vm > 0 else Decimal(100)
            
            status = 'Concluída' if pct >= 100 else 'Quase lá' if pct >= 85 else 'Em andamento'
            
            data['ativas_list'].append({
                'id': m.id,
                'nome': m.titulo,
                'valor_meta': vm,
                'valor_atingido': va,
                'valor_restante': restante,
                'percentual': pct,
                'status': status
            })

        # --- Metas Inativas ---
        metas_inativas = RegisterMeta.objects.filter(
            Q(status=False) | Q(data_fim__lt=now)
        ).exclude(
            pk__in=[m['id'] for m in data['ativas_list']]
        )[:20]

        for m in metas_inativas:
            vm = m.valor or Decimal(0)
            va = calcular_meta_atingida(m)
            restante = max(Decimal(0), vm - va)
            
            st = 'Concluída' if va >= vm else 'Não atingida'
            if not m.status:
                st = 'Cancelada'
            
            data['inativadas_list'].append({
                'id': m.id,
                'nome': m.titulo,
                'valor_meta': vm,
                'valor_atingido': va,
                'valor_restante': restante,
                'status': st
            })

        return JsonResponse(data)

    except Exception as e:
        print(f"[DASHBOARD METAS] Erro: {e}")
        traceback.print_exc()
        return JsonResponse({
            'error': 'Erro interno ao processar dados de metas.',
            'details': str(e)
        }, status=500)

# -------------------------------------------
# FIM API GET/POST DASHBOARD
# -------------------------------------------



# -------------------------------------------
# INICIO API SIAPE DASHBOARD
# -------------------------------------------
@login_required
@require_GET
def api_get_dashboard_siape(request):
    """
    API endpoint para retornar dados do SIAPE para o dashboard:
    - Faturamento anual e mensal do SIAPE.
    - Funcionário com maior faturamento anual e mensal no SIAPE.
    """
    try:
        now = timezone.now()
        logger.info(f"[DASHBOARD SIAPE] Iniciando em {now.isoformat()}")

        start_year = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end_year = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
        start_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        next_month_start = (start_month.replace(day=28) + timedelta(days=4)).replace(day=1) # Avança para o próximo mês
        end_month = next_month_start - timedelta(microseconds=1)


        # Considerar que todos os RegisterMoney são do SIAPE para este contexto.
        # Se precisar de filtro específico (ex: por Produto ou Setor específico do SIAPE), adicionar aqui.
        registros_siape = RegisterMoney.objects.filter(status=True, setor__nome__iexact='SIAPE')

        # Faturamento Anual SIAPE
        faturamento_anual_siape = registros_siape.filter(
            data__range=(start_year, end_year)
        ).aggregate(total=Coalesce(Sum('valor_est'), Decimal(0)))['total']
        logger.info(f"[DASHBOARD SIAPE] Faturamento Anual: {faturamento_anual_siape}")

        # Faturamento Mensal SIAPE
        faturamento_mensal_siape = registros_siape.filter(
            data__range=(start_month, end_month)
        ).aggregate(total=Coalesce(Sum('valor_est'), Decimal(0)))['total']
        logger.info(f"[DASHBOARD SIAPE] Faturamento Mensal: {faturamento_mensal_siape}")

        # Melhor Funcionário Ano
        melhor_funcionario_ano_info = {
            'nome': 'N/A', 'valor': Decimal(0), 'foto_url': None
        }
        top_func_ano_qs = registros_siape.filter(
            data__range=(start_year, end_year), user__isnull=False
        ).values('user').annotate(
            total_vendido=Sum('valor_est'),
            nome_func=F('user__funcionario_profile__apelido') # Correção aqui
        ).filter(total_vendido__gt=0).order_by('-total_vendido')

        if top_func_ano_qs.exists():
            top_func_ano = top_func_ano_qs.first()
            nome_display_ano = top_func_ano['nome_func']
            if not nome_display_ano: # Fallback se apelido for vazio
                user_obj_ano = User.objects.get(pk=top_func_ano['user'])
                nome_display_ano = user_obj_ano.get_full_name() or user_obj_ano.username
            
            foto_url_ano = None
            try:
                funcionario_obj_ano = Funcionario.objects.get(usuario_id=top_func_ano['user'])
                if funcionario_obj_ano.foto:
                    foto_url_ano = request.build_absolute_uri(funcionario_obj_ano.foto.url)
            except Funcionario.DoesNotExist:
                pass # Mantém foto_url_ano como None

            melhor_funcionario_ano_info = {
                'nome': nome_display_ano,
                'valor': top_func_ano['total_vendido'],
                'foto_url': foto_url_ano
            }
        logger.info(f"[DASHBOARD SIAPE] Melhor Funcionário Ano: {melhor_funcionario_ano_info}")


        # Melhor Funcionário Mês
        melhor_funcionario_mes_info = {
            'nome': 'N/A', 'valor': Decimal(0), 'foto_url': None
        }
        top_func_mes_qs = registros_siape.filter(
            data__range=(start_month, end_month), user__isnull=False
        ).values('user').annotate(
            total_vendido=Sum('valor_est'),
            nome_func=F('user__funcionario_profile__apelido') # Correção aqui
        ).filter(total_vendido__gt=0).order_by('-total_vendido')
        
        if top_func_mes_qs.exists():
            top_func_mes = top_func_mes_qs.first()
            nome_display_mes = top_func_mes['nome_func']
            if not nome_display_mes: # Fallback se apelido for vazio
                user_obj_mes = User.objects.get(pk=top_func_mes['user'])
                nome_display_mes = user_obj_mes.get_full_name() or user_obj_mes.username

            foto_url_mes = None
            try:
                funcionario_obj_mes = Funcionario.objects.get(usuario_id=top_func_mes['user'])
                if funcionario_obj_mes.foto:
                    foto_url_mes = request.build_absolute_uri(funcionario_obj_mes.foto.url)
            except Funcionario.DoesNotExist:
                pass # Mantém foto_url_mes como None

            melhor_funcionario_mes_info = {
                'nome': nome_display_mes,
                'valor': top_func_mes['total_vendido'],
                'foto_url': foto_url_mes
            }
        logger.info(f"[DASHBOARD SIAPE] Melhor Funcionário Mês: {melhor_funcionario_mes_info}")

        data = {
            'faturamento_anual': faturamento_anual_siape,
            'faturamento_mensal': faturamento_mensal_siape,
            'melhor_funcionario_ano': melhor_funcionario_ano_info,
            'melhor_funcionario_mes': melhor_funcionario_mes_info,
            'timestamp': now.isoformat()
        }
        return JsonResponse(data)

    except Exception as e:
        logger.error(f"[DASHBOARD SIAPE] Erro: {e}", exc_info=True)
        return JsonResponse({
            'error': 'Erro interno ao processar dados SIAPE do dashboard.',
            'details': str(e)
        }, status=500)

# -------------------------------------------
# FIM API SIAPE DASHBOARD
# -------------------------------------------


# -------------------------------------------
# INICIO Views Controle de Metas
# -------------------------------------------



@login_required
@require_GET
def api_get_metas(request):
    """
    API endpoint para listar todas as metas registradas (RegisterMeta).
    """
    try:
        # Otimização: Usar select_related e prefetch_related
        metas = RegisterMeta.objects.select_related('setor').prefetch_related('equipe').order_by('-data_criacao')

        metas_data = []
        for meta in metas:
            meta_dict = model_to_dict(meta, fields=[
                'id', 'titulo', 'valor', 'categoria', 'data_inicio',
                'data_fim', 'status', 'data_criacao'
            ])
            # Adicionar informações relacionadas manualmente
            meta_dict['setor_nome'] = meta.setor.nome if meta.setor else None
            meta_dict['equipes_nomes'] = list(meta.equipe.values_list('nome', flat=True))
            meta_dict['categoria_display'] = meta.get_categoria_display() # Nome legível da categoria

            # Formatar datas para JSON (ISO 8601)
            meta_dict['data_inicio'] = meta.data_inicio.isoformat() if meta.data_inicio else None
            meta_dict['data_fim'] = meta.data_fim.isoformat() if meta.data_fim else None
            meta_dict['data_criacao'] = meta.data_criacao.isoformat() if meta.data_criacao else None

            metas_data.append(meta_dict)

        # --- Buscar dados para os seletores ---
        setores = Setor.objects.filter(status=True).values('id', 'nome').order_by('nome')
        equipes = Equipe.objects.filter(status=True).values('id', 'nome').order_by('nome')
        categorias_meta = [{'value': choice[0], 'display': choice[1]} for choice in RegisterMeta.CATEGORIA_CHOICES]

        response_data = {
            'metas': metas_data,
            'seletores': {
                'setores': list(setores),
                'equipes': list(equipes),
                'categorias': categorias_meta
            }
        }

        return JsonResponse(response_data)

    except Exception as e:
        print(f"Erro em api_get_metas: {e}")
        # Em produção, logar o erro detalhado
        return JsonResponse({'error': 'Erro ao buscar metas.', 'details': str(e)}, status=500)


@login_required
@require_POST
@csrf_exempt
def api_post_attmeta(request):
    """
    API endpoint para atualizar o status de uma meta (RegisterMeta).
    Recebe o ID da meta via POST e inverte o status (True para False ou False para True).
    """
    try:
        # Tenta obter o ID da meta do corpo da requisição (JSON) ou formulário POST
        meta_id = None
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
                meta_id = data.get('meta_id')
            except json.JSONDecodeError:
                return JsonResponse({'error': 'JSON inválido no corpo da requisição.'}, status=400)
        else:
            # Fallback para dados de formulário
            meta_id = request.POST.get('meta_id')

        if not meta_id:
            return JsonResponse({'error': 'ID da meta (meta_id) não fornecido.'}, status=400)

        try:
            meta_id = int(meta_id)
        except ValueError:
            return JsonResponse({'error': 'ID da meta inválido.'}, status=400)

        # Busca a meta pelo ID
        try:
            meta = RegisterMeta.objects.get(pk=meta_id)
        except RegisterMeta.DoesNotExist:
            return JsonResponse({'error': f'Meta com ID {meta_id} não encontrada.'}, status=404)

        # Inverte o status da meta
        meta.status = not meta.status
        meta.save()

        # Retorna sucesso com o novo status
        return JsonResponse({
            'success': True,
            'message': f'Status da meta atualizado com sucesso para {"Ativo" if meta.status else "Inativo"}.',
            'meta_id': meta.id,
            'new_status': meta.status
        }, status=200)

    except Exception as e:
        # Logar o erro em produção seria ideal
        print(f"Erro em api_post_attmeta: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': 'Erro interno ao atualizar o status da meta.', 'details': str(e)}, status=500)


@login_required
@require_POST
@csrf_exempt
def api_post_novameta(request):
    """
    Cria uma nova meta (RegisterMeta).
    Recebe JSON no corpo com:
      - titulo, valor, categoria, data_inicio, data_fim
      - opcional: status, setor_id, equipe_ids
    Aceita datas em ISO (ex: '2025-05-01T00:01') ou 'DD/MM/YYYY HH:MM'.
    """
    try:
        data = json.loads(request.body)
        # 1) Validação básica
        obrig = ['titulo', 'valor', 'categoria', 'data_inicio', 'data_fim']
        for f in obrig:
            if not data.get(f):
                return JsonResponse({'error': f'Campo obrigatório ausente: {f}'}, status=400)

        categoria = data['categoria']
        setor_id  = data.get('setor_id')
        equipes   = data.get('equipe_ids', [])

        if categoria == 'SETOR' and not setor_id:
            return JsonResponse({'error': 'ID do setor é obrigatório para SETOR'}, status=400)
        if categoria == 'OUTROS' and not equipes:
            return JsonResponse({'error': 'Pelo menos uma equipe para OUTROS'}, status=400)

        # 2) Parse de valor
        try:
            valor = Decimal(str(data['valor']))
        except Exception:
            return JsonResponse({'error': 'Formato de valor inválido.'}, status=400)

        # 3) Parse de datas com fallback
        def parse_dt(v):
            # tenta ISO
            try:
                return datetime.fromisoformat(v)
            except Exception:
                pass
            # tenta BR 'DD/MM/YYYY HH:MM'
            try:
                return datetime.strptime(v, "%d/%m/%Y %H:%M")
            except Exception:
                raise ValueError()

        try:
            inicio = parse_dt(data['data_inicio'])
            fim    = parse_dt(data['data_fim'])
        except ValueError:
            return JsonResponse(
                {'error': "Formato de data inválido. Use ISO ('YYYY-MM-DDTHH:MM') ou 'DD/MM/YYYY HH:MM'."},
                status=400
            )

        # 4) Criação da meta
        nova = RegisterMeta.objects.create(
            titulo       = data['titulo'],
            valor        = valor,
            categoria    = categoria,
            data_inicio  = inicio,
            data_fim     = fim,
            status       = data.get('status', False),
            # data_criacao é auto_now_add
        )

        # 5) Associa SETOR ou equipes
        if categoria == 'SETOR':
            try:
                nova.setor = Setor.objects.get(pk=setor_id)
                nova.save()
            except Setor.DoesNotExist:
                nova.delete()
                return JsonResponse({'error': f'Setor {setor_id} não encontrado.'}, status=404)

        if categoria == 'OUTROS':
            qs = Equipe.objects.filter(pk__in=equipes)
            if qs.count() != len(equipes):
                nova.delete()
                return JsonResponse({'error': 'Uma ou mais equipes não encontradas.'}, status=404)
            nova.equipe.set(qs)

        # 6) Response
        m = model_to_dict(nova, exclude=['equipe'])
        m['setor_nome']     = nova.setor.nome if nova.setor else None
        m['equipes_nomes']  = list(nova.equipe.values_list('nome', flat=True))
        m['categoria_disp'] = nova.get_categoria_display()
        fmt = "%d/%m/%Y %H:%M"
        m['data_inicio']    = nova.data_inicio.strftime(fmt)
        m['data_fim']       = nova.data_fim.strftime(fmt)
        m['data_criacao']   = nova.data_criacao.strftime(fmt)

        return JsonResponse({'message': 'Meta criada! 🎯', 'meta': m}, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'JSON inválido.'}, status=400)
    except Exception as e:
        print(f"❌ Erro em api_post_novameta: {e}")
        return JsonResponse({'error': 'Erro interno no servidor.', 'details': str(e)}, status=500)


# -------------------------------------------
# FIM Views Controle de Metas
# -------------------------------------------



# -------------------------------------------
# Views Reembolso
# -------------------------------------------
# (Outras views relacionadas a reembolso, como POST para criar/reverter, podem vir aqui)

from datetime import timedelta

@login_required
@require_GET
def api_get_inforeembolso(request):
    """
    Retorna:
    - registros_para_reembolsar: lista de RegisterMoney pendentes
    - registros_reembolsados:   lista de Reembolso já feitos
    - stats: contagens de Reembolso nos períodos 90d, 60d e mês atual
    """
    cpf     = request.GET.get('cpf_cliente', '').strip()
    produto = request.GET.get('produto_nome', '').strip()

    # — Registros ainda para reembolsar —
    qs_para = RegisterMoney.objects.filter(
        status=True,
        reembolso_info__isnull=True
    ).select_related('produto', 'setor')
    if cpf:
        qs_para = qs_para.filter(cpf_cliente__icontains=cpf)
    if produto:
        qs_para = qs_para.filter(produto__nome__icontains=produto)

    registros_para = []
    for reg in qs_para:
        nome_prod = reg.produto.nome if reg.produto else 'N/A'
        registros_para.append({
            'id':           reg.id,
            'cpf_cliente':  reg.cpf_cliente,
            'produto_nome': nome_prod,
            'valor':        f"{reg.valor_est:.2f}",
            'data_registro': reg.data.strftime('%d/%m/%Y %H:%M') if reg.data else 'N/A',
        })

    # — Registros já reembolsados —
    qs_remb = Reembolso.objects.filter(status=True).select_related(
        'registermoney__produto', 'registermoney__setor'
    )
    if cpf:
        qs_remb = qs_remb.filter(registermoney__cpf_cliente__icontains=cpf)

    registros_remb = []
    for remb in qs_remb:
        orig       = remb.registermoney
        nome_prod  = orig.produto.nome if orig.produto else 'N/A'
        nome_setor = orig.setor.nome   if orig.setor   else 'N/A'
        registros_remb.append({
            'reembolso_id':  remb.pk,
            'cpf_cliente':   orig.cpf_cliente,
            'produto_nome':  nome_prod,
            'valor':         f"{orig.valor_est:.2f}",
            'setor_nome':    nome_setor,
            'data_registro': orig.data.strftime('%d/%m/%Y %H:%M') if orig.data else 'N/A',
            'data_reembolso': remb.data_reembolso.strftime('%d/%m/%Y')
                               if remb.data_reembolso else 'N/A',
        })

    # — Estatísticas de Reembolso —
    hoje     = timezone.now().date()
    qs_todos = Reembolso.objects.filter(status=True)
    total_90d = qs_todos.filter(data_reembolso__gte=hoje - timedelta(days=90)).count()
    total_60d = qs_todos.filter(data_reembolso__gte=hoje - timedelta(days=60)).count()
    total_mes_atual = qs_todos.filter(
        data_reembolso__year=hoje.year,
        data_reembolso__month=hoje.month
    ).count()

    return JsonResponse({
        'registros_para_reembolsar': registros_para,
        'registros_reembolsados':   registros_remb,
        'stats': {
            'reembolsos_90d':       total_90d,
            'reembolsos_60d':       total_60d,
            'reembolsos_mes_atual': total_mes_atual,
        }
    })

# -------------------------------------------
# Views Reembolso
# -------------------------------------------
# (Outras views relacionadas a reembolso, como POST para criar/reverter, podem vir aqui)

from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from django.db import transaction
from apps.siape.models import RegisterMoney, Reembolso # Supondo que os modelos estão em .models
import json # Para decodificar o corpo da requisição se for JSON

@login_required
@require_POST
@transaction.atomic # Garante atomicidade da operação no banco
@csrf_exempt
def api_post_addreembolso(request):
    """
    API endpoint para registrar um novo reembolso para um RegisterMoney.
    Recebe o ID do RegisterMoney via POST.
    Cria um registro na tabela Reembolso associado ao RegisterMoney.
    """
    try:
        # Tenta obter o ID do corpo da requisição (JSON) ou formulário POST
        registermoney_id = None
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
                registermoney_id = data.get('registermoney_id')
            except json.JSONDecodeError:
                return JsonResponse({'error': 'JSON inválido no corpo da requisição.'}, status=400)
        else:
            # Fallback para dados de formulário
            registermoney_id = request.POST.get('registermoney_id')

        if not registermoney_id:
            return JsonResponse({'error': 'ID do registro financeiro (registermoney_id) não fornecido.'}, status=400)

        try:
            registermoney_id = int(registermoney_id)
        except ValueError:
            return JsonResponse({'error': 'ID do registro financeiro inválido.'}, status=400)

        # Verifica se o RegisterMoney existe
        try:
            registro_financeiro = RegisterMoney.objects.get(pk=registermoney_id)
        except RegisterMoney.DoesNotExist:
            return JsonResponse({'error': f'Registro Financeiro com ID {registermoney_id} não encontrado.'}, status=404)

        # Verifica se já existe um reembolso para este registro
        if Reembolso.objects.filter(registermoney=registro_financeiro).exists():
            return JsonResponse({'error': f'Já existe um reembolso registrado para o ID {registermoney_id}.'}, status=409) # 409 Conflict

        # Cria o novo registro de Reembolso
        novo_reembolso = Reembolso.objects.create(
            registermoney=registro_financeiro,
            data_reembolso=timezone.now().date(), # Usa a data atual
            status=True # Status padrão é True (reembolsado)
        )

        # Retorna sucesso com o ID do reembolso criado (que é o mesmo do registermoney)
        return JsonResponse({
            'success': True,
            'message': 'Reembolso registrado com sucesso.',
            'reembolso_id': novo_reembolso.pk
        }, status=201) # 201 Created

    except Exception as e:
        # Logar o erro em produção seria ideal
        print(f"Erro em api_post_addreembolso: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': 'Erro interno ao registrar o reembolso.', 'details': str(e)}, status=500)


@login_required
@require_POST
@transaction.atomic # Garante atomicidade da operação no banco
@csrf_exempt
def api_post_reverterreembolso(request):
    """
    API endpoint para reverter (marcar como inativo) um registro de reembolso.
    Recebe o ID do Reembolso (que é o mesmo ID do RegisterMoney associado) via POST.
    Atualiza o status do Reembolso para False.
    """
    try:
        # Tenta obter o ID do corpo da requisição (JSON) ou formulário POST
        reembolso_id = None
        if request.content_type == 'application/json':
            try:
                data = json.loads(request.body)
                reembolso_id = data.get('reembolso_id')
            except json.JSONDecodeError:
                return JsonResponse({'error': 'JSON inválido no corpo da requisição.'}, status=400)
        else:
            # Fallback para dados de formulário
            reembolso_id = request.POST.get('reembolso_id')


        if not reembolso_id:
            return JsonResponse({'error': 'ID do reembolso (reembolso_id) não fornecido.'}, status=400)

        try:
            reembolso_id = int(reembolso_id)
        except ValueError:
            return JsonResponse({'error': 'ID do reembolso inválido.'}, status=400)

        # Busca o registro de Reembolso pelo ID (que é a PK e FK para RegisterMoney)
        try:
            reembolso = Reembolso.objects.get(pk=reembolso_id)
        except Reembolso.DoesNotExist:
            return JsonResponse({'error': f'Reembolso com ID {reembolso_id} não encontrado.'}, status=404)

        # Verifica se o reembolso já está inativo (status=False)
        if not reembolso.status:
             return JsonResponse({
                'success': False, # Ou True, dependendo se considera idempotente
                'message': f'Reembolso com ID {reembolso_id} já está marcado como revertido (inativo). Nenhuma ação realizada.'
            }, status=200) # Ou 400 Bad Request se não for idempotente

        # Atualiza o status para False
        reembolso.status = False
        reembolso.save()

        # Retorna sucesso
        return JsonResponse({
            'success': True,
            'message': f'Reembolso com ID {reembolso_id} revertido com sucesso (status alterado para False).'
        }, status=200)

    except Exception as e:
        # Logar o erro em produção seria ideal
        print(f"Erro em api_post_reverterreembolso: {e}")
        import traceback
        traceback.print_exc()
        return JsonResponse({'error': 'Erro interno ao reverter o reembolso.', 'details': str(e)}, status=500)


import json
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib.auth.decorators import login_required
from django.utils.dateparse import parse_date, parse_datetime
from django.contrib.auth.models import User
from django.db import transaction, IntegrityError
from django.utils import timezone
from apps.funcionarios.models import *
from apps.siape.models import *
from apps.inss.models import *
from django.shortcuts import get_object_or_404
import traceback
from datetime import datetime

@require_POST
@login_required
def api_post_csvfuncionarios(request):
    """
    Recebe JSON (UTF-8) com vários funcionários e cria User + Funcionario para cada um.
    Os campos de cada objeto podem vir como:
      Apelido, Nome_Completo, CPF, Data_Nascimento,
      Empresa_ID, Departamento_ID, Setor_ID, Cargo_ID,
      Horario_ID (opcional), Equipe_ID (opcional), Loja_ID (opcional)
    """
    print("\n----- Iniciando api_post_csvfuncionarios -----")
    try:
        rows = json.loads(request.body.decode('utf-8'))
    except Exception as e:
        print("Erro ao decodificar JSON:", e)
        return JsonResponse({'success': False, 'error': 'JSON inválido'}, status=400)

    total = len(rows)
    print(f"Total de linhas recebidas: {total}")
    created = 0
    errors = []

    for i, row in enumerate(rows):
        print(f"\nProcessando linha {i}: {row}")
        try:
            # 1) Normalize keys to lowercase
            data = {k.lower(): v for k, v in row.items()}

            # 2) Required fields
            required = ['apelido', 'nome_completo', 'cpf', 'data_nascimento',
                        'empresa_id', 'departamento_id', 'setor_id', 'cargo_id']
            missing = [f for f in required if not data.get(f)]
            if missing:
                raise ValueError(f"Campos obrigatórios faltando: {', '.join(missing)}")

            # 3) Clean & validate CPF
            cpf = ''.join(filter(str.isdigit, data['cpf']))
            if len(cpf) != 11:
                raise ValueError("CPF inválido")

            # 4) Parse nascimento date
            nascimento = None
            for fmt in ('%Y-%m-%d', '%d/%m/%Y'):
                try:
                    nascimento = datetime.strptime(data['data_nascimento'], fmt).date()
                    break
                except ValueError:
                    continue
            if not nascimento:
                raise ValueError("data_nascimento inválida")

            # 5) Prepare User fields
            apelido       = data['apelido'].strip()
            nome_completo = data['nome_completo'].strip()
            username      = apelido.lower().replace(' ', '_')
            password      = f"Money@{timezone.now().year}"
            fn, *rest     = nome_completo.split(' ', 1)
            ln            = rest[0] if rest else ''

            # 6) Fetch required FK instances
            empresa     = get_object_or_404(Empresa,      pk=data['empresa_id'])
            departamento= get_object_or_404(Departamento, pk=data['departamento_id'])
            setor       = get_object_or_404(Setor,        pk=data['setor_id'])
            cargo       = get_object_or_404(Cargo,        pk=data['cargo_id'])

            # 7) Fetch optional FK instances
            horario = None
            if data.get('horario_id'):
                horario = HorarioTrabalho.objects.filter(pk=data['horario_id']).first()
            equipe = None
            if data.get('equipe_id'):
                equipe = Equipe.objects.filter(pk=data['equipe_id']).first()
            loja = None
            if data.get('loja_id'):
                loja = Loja.objects.filter(pk=data['loja_id']).first()

            # 8) Create User + Funcionario atomically
            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    first_name=fn,
                    last_name=ln
                )
                print(f"  → User criado: ID={user.id}")

                Funcionario.objects.create(
                    usuario=user,
                    apelido=apelido,
                    nome_completo=nome_completo,
                    cpf=cpf,
                    data_nascimento=nascimento,
                    empresa=empresa,
                    departamento=departamento,
                    setor=setor,
                    cargo=cargo,
                    horario=horario,
                    equipe=equipe,
                    loja=loja,
                )
                print("  → Funcionario criado")
                created += 1

        except Exception as e:
            print(f"  Erro na linha {i}: {e}")
            traceback.print_exc()
            errors.append({'row': i, 'error': str(e)})

    print(f"\nConcluído. Criados: {created}, Erros: {len(errors)}")
    return JsonResponse({
        'success': True,
        'total': total,
        'created': created,
        'errors': errors,
    })

@require_POST
@login_required
def api_post_csvclientec2(request):
    """
    Recebe JSON com lista de clientes C2 e importa para ClienteAgendamento.
    Headers esperados por linha: nome_completo, cpf, numero_contato, flg_whatsapp.
    """
    print("Iniciando api_post_csvclientec2")
    try:
        rows = json.loads(request.body)
        print(f"Total de linhas recebidas: {len(rows)}")
    except json.JSONDecodeError:
        print("Erro ao decodificar JSON")
        return JsonResponse({'success': False, 'error': 'JSON inválido'}, status=400)

    created, errors = 0, []
    for i, row in enumerate(rows):
        print(f"Processando linha {i}: {row}")
        try:
            cliente = ClienteAgendamento.objects.create(
                nome_completo = row['nome_completo'],
                cpf           = row['cpf'],
                numero        = row['numero_contato'],
                flg_whatsapp  = bool(row.get('flg_whatsapp', True)),
            )
            print(f"Cliente criado com ID: {cliente.id}")
            created += 1
        except Exception as e:
            print(f"Erro na linha {i}: {str(e)}")
            errors.append({'row': i, 'error': str(e)})

    print(f"Processamento concluído. Criados: {created}, Erros: {len(errors)}")
    return JsonResponse({'success': True, 'created': created, 'errors': errors})


@require_POST
@login_required
def api_post_csvagendamento(request):
    print("Iniciando api_post_csvagendamento")
    try:
        rows = json.loads(request.body)
        print(f"Total de linhas recebidas: {len(rows)}")
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'JSON inválido'}, status=400)

    created, errors = 0, []
    for i, row in enumerate(rows):
        print(f"Processando linha {i}: {row}")
        try:
            # limpa o CPF recebido (remove . e -)
            raw_cpf = row['cpf_cliente']
            cleaned = re.sub(r'\D', '', raw_cpf)
            
            # primeiro, tenta achar exato
            try:
                cliente = ClienteAgendamento.objects.get(cpf=row['cpf_cliente'])
            except ClienteAgendamento.DoesNotExist:
                # senão, busca pelo CPF sem formatação
                cliente = None
                for c in ClienteAgendamento.objects.all():
                    if re.sub(r'\D', '', c.cpf) == cleaned:
                        cliente = c
                        break
                if not cliente:
                    raise ClienteAgendamento.DoesNotExist(f"CPF {raw_cpf} não encontrado")
            
            # continua com resto do processamento
            dia     = parse_datetime(row['dia_agendado'])
            loja    = Loja.objects.get(pk=row['loja_id'])
            user    = User.objects.get(pk=row['atendente_id'])

            Agendamento.objects.create(
                cliente_agendamento   = cliente,
                dia_agendado          = dia,
                loja                  = loja,
                atendente_agendou     = user,
                tabulacao_agendamento = row.get('tabulacao_agendamento', '')
            )
            created += 1
            print(f"Agendamento criado para cliente {cliente.id}")

        except Exception as e:
            print(f"Erro na linha {i}: {e}")
            errors.append({'row': i, 'error': str(e)})

    print(f"Processamento concluído. Criados: {created}, Erros: {len(errors)}")
    return JsonResponse({'success': True, 'created': created, 'errors': errors})


@require_POST
@login_required
def api_post_csvfinanceiro(request):
    """
    Recebe JSON com lista de registros financeiros e importa para RegisterMoney.
    Headers esperados por linha: user_id, loja_id, produto (nome), cpf_cliente,
    valor_estimado, empresa_id, departamento_id, setor_id, equipe_id, data_pagamento (ISO).
    """
    print("Iniciando api_post_csvfinanceiro")
    try:
        rows = json.loads(request.body)
        print(f"Total de linhas recebidas: {len(rows)}")
    except json.JSONDecodeError:
        print("Erro ao decodificar JSON")
        return JsonResponse({'success': False, 'error': 'JSON inválido'}, status=400)

    created, errors = 0, []
    for i, row in enumerate(rows):
        try:
            user       = User.objects.get(pk=row['user_id'])
            loja       = Loja.objects.get(pk=row['loja_id'])
            produto, _= Produto.objects.get_or_create(nome=row['produto'])
            empresa    = Empresa.objects.get(pk=row['empresa_id'])
            departamento= Departamento.objects.get(pk=row['departamento_id'])
            setor      = Setor.objects.get(pk=row['setor_id'])
            equipe     = Equipe.objects.get(pk=row['equipe_id'])
            data_reg   = parse_datetime(row.get('data_pagamento'))

            RegisterMoney.objects.create(
                user         = user,
                loja         = loja,
                produto      = produto,
                cpf_cliente  = row.get('cpf_cliente', ''),
                valor_est    = row.get('valor_estimado') or None,
                empresa      = empresa,
                departamento = departamento,
                setor        = setor,
                equipe       = equipe,
                data         = data_reg
            )
            created += 1
        except Exception as e:
            errors.append({'row': i, 'error': str(e)})

    return JsonResponse({'success': True, 'created': created, 'errors': errors})


# ┌───────────────────────────────────────────────────────────────────────────────
# │ Início – Controle de Campanhas (views)
# └───────────────────────────────────────────────────────────────────────────────
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import *
from apps.siape.models import *
from apps.funcionarios.models import *


@login_required
@require_GET
@ensure_csrf_cookie
@controle_acess('SCT23')
def api_get_minhasCampanhas(request):
    """
    Retorna todas as campanhas ativas, com relacionamentos,
    e fornece também as listas de opções para cada categoria.
    """
    # 1️⃣ campanhas
    qs = (
        ControleCampanha.objects
        .filter(status=True)
        .order_by('-data_inicio')
        .prefetch_related('empresas', 'departamentos', 'setores', 'lojas', 'equipes', 'cargos')
    )
    resultado = []
    for c in qs:
        resultado.append({
            'id':            c.id,
            'titulo':        c.titulo,
            'banner_url':    request.build_absolute_uri(c.banner.url) if c.banner else None,
            'data_inicio':   c.data_inicio.isoformat(),
            'hora_inicio':   c.hora_inicio.strftime('%H:%M'),
            'data_final':    c.data_final.isoformat(),
            'hora_final':    c.hora_final.strftime('%H:%M'),
            'categoria':     c.categoria,
            'empresas':      list(c.empresas.values_list('id', flat=True)),
            'departamentos': list(c.departamentos.values_list('id', flat=True)),
            'setores':       list(c.setores.values_list('id', flat=True)),
            'lojas':         list(c.lojas.values_list('id', flat=True)),
            'equipes':       list(c.equipes.values_list('id', flat=True)),
            'cargos':        list(c.cargos.values_list('id', flat=True)),
            'status':        c.status,
        })

    # 2️⃣ todas as opções para montar checkboxes
    opcoes = {
        'EMPRESA':      list(Empresa.objects.filter(status=True).values('id', 'nome')),
        'DEPARTAMENTO': list(Departamento.objects.filter(status=True).values('id', 'nome')),
        'SETOR':        list(Setor.objects.filter(status=True).values('id', 'nome')),
        'LOJA':         list(Loja.objects.filter(status=True).values('id', 'nome')),
        'EQUIPE':       list(Equipe.objects.filter(status=True).values('id', 'nome')),
        'CARGO':        list(Cargo.objects.filter(status=True).values('id', 'nome')),
    }

    return JsonResponse({
        'campanhas': resultado,
        'opcoes':    opcoes
    }, status=200)

@login_required
@require_POST
@csrf_exempt
@controle_acess('SCT23')
def api_post_criarCampanha(request):
    """
    Cria uma nova campanha.
    Espera multipart/form-data com:
      - titulo, banner (file)
      - data_inicio (YYYY-MM-DD), hora_inicio (HH:MM)
      - data_final (YYYY-MM-DD), hora_final (HH:MM)
      - categoria (string)
      - empresas, departamentos, setores, lojas, equipes (listas de IDs)
      - status ('true' ou 'false')
    """
    try:
        # 1️⃣ Debug dos dados recebidos
        print("\n=== DEBUG: Dados Recebidos na View ===")
        print("POST data:", request.POST)
        print("FILES:", request.FILES)

        # 2️⃣ Extrai e valida campos obrigatórios
        titulo     = request.POST.get('titulo')
        banner     = request.FILES.get('banner')
        di_str     = request.POST.get('data_inicio')
        hi_str     = request.POST.get('hora_inicio')
        df_str     = request.POST.get('data_final')
        hf_str     = request.POST.get('hora_final')
        categoria  = request.POST.get('categoria', 'GERAL')
        status_bool = request.POST.get('status', 'true').lower() in ('true','1','on')

        print("\n=== DEBUG: Campos Extraídos ===")
        print(f"Título: {titulo}")
        print(f"Banner: {banner}")
        print(f"Data Início: {di_str}")
        print(f"Hora Início: {hi_str}")
        print(f"Data Final: {df_str}")
        print(f"Hora Final: {hf_str}")
        print(f"Categoria: {categoria}")
        print(f"Status: {status_bool}")

        if not all([titulo, banner, di_str, hi_str, df_str, hf_str]):
            return JsonResponse({'error': 'Campos obrigatórios faltando.'}, status=400)

        # 3️⃣ Parse de datas e horas
        data_inicio = datetime.strptime(di_str, '%Y-%m-%d').date()
        hora_inicio = datetime.strptime(hi_str, '%H:%M').time()
        data_final  = datetime.strptime(df_str, '%Y-%m-%d').date()
        hora_final  = datetime.strptime(hf_str, '%H:%M').time()

        # 4️⃣ Cria a campanha
        campanha = ControleCampanha.objects.create(
            titulo      = titulo,
            banner      = banner,
            data_inicio = data_inicio,
            hora_inicio = hora_inicio,
            data_final  = data_final,
            hora_final  = hora_final,
            categoria   = categoria,
            status      = status_bool
        )

        # 5️⃣ Mapeamento para ManyToMany
        campanhas_map = {
            'empresas':      Empresa,
            'departamentos': Departamento,
            'setores':       Setor,
            'lojas':         Loja,
            'equipes':       Equipe,
            'cargos':        Cargo,  # Adicionando Cargo ao mapeamento
        }
        singular_map = {
            'empresas':      'empresa',
            'departamentos': 'departamento',
            'setores':       'setor',
            'lojas':         'loja',
            'equipes':       'equipe',
            'cargos':        'cargo',  # Adicionando mapeamento singular para cargo
        }

        print("\n=== DEBUG: IDs para ManyToMany ===")
        for plural, model in campanhas_map.items():
            singular = singular_map[plural]
            ids = request.POST.getlist(plural) or request.POST.getlist(singular)
            print(f"{plural}: {ids}")
            if not ids:
                continue

            try:
                ids = list({int(i) for i in ids})
            except ValueError:
                return JsonResponse({'error': f'IDs inválidos em {plural}.'}, status=400)

            qs = model.objects.filter(pk__in=ids)
            print(f"→ encontradas {qs.count()} instâncias de {model.__name__}")
            getattr(campanha, plural).set(qs)

        campanha.save()

        # 6️⃣ Debug da campanha criada
        print("\n=== DEBUG: Campanha Criada ===")
        print(f"ID: {campanha.id}")
        print(f"Título: {campanha.titulo}")
        print(f"Categoria: {campanha.categoria}")
        for field in campanhas_map:
            print(f"- {field}: {list(getattr(campanha, field).values_list('id', flat=True))}")

        # 7️⃣ Prepara resposta
        resp = {
            'id':           campanha.id,
            'titulo':       campanha.titulo,
            'banner_url':   request.build_absolute_uri(campanha.banner.url),
            'data_inicio':  campanha.data_inicio.isoformat(),
            'hora_inicio':  campanha.hora_inicio.strftime('%H:%M'),
            'data_final':   campanha.data_final.isoformat(),
            'hora_final':   campanha.hora_final.strftime('%H:%M'),
            'categoria':    campanha.categoria,
            'status':       campanha.status,
        }
        return JsonResponse({'message': 'Campanha criada com sucesso! 🎉', 'campanha': resp}, status=201)

    except Exception as e:
        print("\n=== DEBUG: Erro na View ===")
        print("Erro:", str(e))
        import traceback
        print(traceback.format_exc())
        return JsonResponse({'error': str(e)}, status=400)


    
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET
from django.http import JsonResponse
from django.utils import timezone
from .models import ControleCampanha
from apps.funcionarios.models import Funcionario
from urllib.parse import urlparse, urlunparse

@login_required
@require_GET
def api_get_banners_campanhas(request):
    """
    Retorna JSON com banners de campanhas ativas às quais o usuário tem acesso.
    - Superusuário vê todas.
    - Demais usuários veem apenas campanhas cujo M2M inclui seu ID.
    Garante que banner_url comece com https://
    """
    try:
        usuario = request.user
        print(f"DEBUG: Usuário {usuario.username} acessando banners")

        # 1) Carrega campanhas ativas
        if usuario.is_superuser:
            print("DEBUG: Usuário é superusuário, carregando todas campanhas")
            qs = ControleCampanha.objects.filter(status=True)
            ids_func = {}
        else:
            try:
                print(f"DEBUG: Buscando funcionário para usuário {usuario.id}")
                funcionario = Funcionario.objects.select_related(
                    'usuario', 'empresa', 'departamento', 'setor', 'cargo', 'horario', 'equipe'
                ).get(usuario=usuario, status=True)
                print(f"DEBUG: Funcionário encontrado: {funcionario.id}")
            except Funcionario.DoesNotExist:
                print(f"DEBUG: Funcionário não encontrado para usuário {usuario.id}")
                return JsonResponse({'banners': []}, status=200)  # Retorna lista vazia ao invés de erro

            ids_func = {
                'empresa':      funcionario.empresa_id,
                'departamento': funcionario.departamento_id,
                'setor':        funcionario.setor_id,
                'equipe':       funcionario.equipe_id,
                'cargo':        funcionario.cargo_id,
            }
            qs = ControleCampanha.objects.filter(status=True)

        resultados = []

        for camp in qs:
            categoria = camp.categoria
            print(f"DEBUG: Processando campanha {camp.id} - Categoria: {categoria}")

            # campanhas GERAL sempre passam
            if categoria == 'GERAL':
                inclui = True
            else:
                # pega lista de IDs do M2M correto
                escopos = {
                    'EMPRESA':      list(camp.empresas.values_list('id', flat=True)),
                    'DEPARTAMENTO': list(camp.departamentos.values_list('id', flat=True)),
                    'SETOR':        list(camp.setores.values_list('id', flat=True)),
                    'LOJA':         list(camp.lojas.values_list('id', flat=True)),
                    'EQUIPE':       list(camp.equipes.values_list('id', flat=True)),
                    'CARGO':        list(camp.cargos.values_list('id', flat=True)),
                }
                lista_ids = escopos.get(categoria, [])
                inclui = (not usuario.is_superuser
                          and ids_func.get(categoria.lower()) in lista_ids)
                print(f"DEBUG: IDs do escopo {categoria}: {lista_ids}")
                print(f"DEBUG: ID do funcionário: {ids_func.get(categoria.lower())}")
                print(f"DEBUG: Incluir? {inclui}")

            # só continua se incluir e tiver banner
            if not inclui or not camp.banner:
                continue

            # mantém a URL original do banner
            banner_url = request.build_absolute_uri(camp.banner.url)

            resultados.append({
                'id':         camp.id,
                'titulo':     camp.titulo,
                'banner_url': banner_url,
                'categoria':  camp.categoria,
            })

        print(f"DEBUG: Total de banners encontrados: {len(resultados)}")
        return JsonResponse({'banners': resultados}, status=200)

    except Exception as e:
        print(f"DEBUG: Erro ao processar banners: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return JsonResponse({'error': 'Erro interno ao processar banners'}, status=500)


@login_required
@require_POST
@controle_acess('SCT23')
@csrf_exempt
def api_post_atualizar_status_campanha(request):
    """
    POST: Atualiza o campo `status` (ativo/inativo) de uma campanha.
    Espera receber:
      - id: ID da campanha
      - status: 'true' ou 'false'
    Retorna JSON com mensagem e o novo status.
    """
    campanha_id = request.POST.get('id')
    status_str  = request.POST.get('status')

    if not campanha_id or status_str is None:
        return JsonResponse({'error': 'Campos "id" e "status" são obrigatórios.'}, status=400)

    # Busca a campanha ou 404
    campanha = get_object_or_404(ControleCampanha, pk=campanha_id)

    # Converte string para booleano
    novo_status = status_str.lower() in ('true', '1', 'on')

    # Atualiza e salva
    campanha.status = novo_status
    campanha.save(update_fields=['status'])

    return JsonResponse({
        'message': f'Campanha "{campanha.titulo}" agora está {"ativa" if novo_status else "inativa"}.',
        'campanha': {
            'id': campanha.id,
            'status': campanha.status
        }
    }, status=200)

# (adicione aqui todas as outras views relacionadas a ControleCampanhas)

# ┌───────────────────────────────────────────────────────────────────────────────
# │ Fim – Controle de Campanhas (views)
# └───────────────────────────────────────────────────────────────────────────────
