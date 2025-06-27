# Python built-in imports
import calendar
import csv
import io
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
import math

# Third party imports
import pandas as pd
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, F, OuterRef, Q, Subquery, Sum, Avg, Max, Min
from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST
from django.core.exceptions import FieldError, ValidationError # <-- Import FieldError
from django.core.serializers.json import DjangoJSONEncoder

# Local imports
# É recomendado importar explicitamente os modelos necessários em vez de usar '*'
# Adicione outros modelos de .models, apps.inss.models e apps.funcionarios.models se forem usados neste arquivo.
from apps.funcionarios.models import *
from apps.inss.models import *
from custom_tags_app.permissions import *
from setup.utils import *
from .models import *
from .models import DadosNegociacao, ArquivoNegociacao
from apps.funcionarios.models import Setor # <-- Adiciona a importação do Setor

from custom_tags_app.templatetags.permissionsacess import controle_acess

# Configurando o logger para registrar atividades e erros no sistema
logger = logging.getLogger(__name__)


# renderização de páginas

@login_required
@controle_acess('SCT16')   # 16 – SIAPE | CONSULTA CLIENTE
def render_consulta_cliente(request):
    """
    Renderiza a página base de consulta de cliente.
    """
    logger.debug("Iniciando render_consulta_cliente")
    return render(request, 'siape/forms/consulta_cliente.html')

@login_required
@controle_acess('SCT17')   # 17 – SIAPE | CAMPANHAS
def render_campanha_Siape(request):
    logger.debug("Iniciando render_campanha_Siape")
    return render(request, 'siape/forms/campanhas_consulta_siape.html')

@login_required
@controle_acess('SCT19')   # 19 – SIAPE | FINANCEIRO
def render_financeiro(request):
    """
    Renderiza a página de financeiro do SIAPE.
    """
    logger.debug("Iniciando render_financeiro")
    return render(request, 'siape/forms/financeiro.html')

@login_required
@controle_acess('SCT18')   # 18 – SIAPE | RANKING
def render_ranking(request):
    # Apenas renderiza o template; os dados serão obtidos via API 🚀
    logger.debug("Iniciando render_ranking")
    return render(request, 'siape/ranking.html')

@login_required
@controle_acess('SCT16')   # 16 – SIAPE | CONSULTA CLIENTE
def render_dashboard_agendamentos(request):
    """
    Renderiza a página do dashboard de agendamentos SIAPE.
    """
    logger.debug("Iniciando render_dashboard_agendamentos")
    return render(request, 'siape/dashboard_agendamentos.html')

@login_required
@controle_acess('SCT77')   # 77 – SIAPE | CRM KANBAN
def render_crm_kanban(request):
    """
    Renderiza a página do CRM Kanban para coordenadores e supervisores.
    """
    logger.debug("Iniciando render_crm_kanban")
    return render(request, 'siape/crm_kanban.html')

# fim renderização de paginas


def normalize_cpf(cpf):
    """Remove caracteres não numéricos do CPF e retorna apenas os 11 dígitos."""
    if cpf is None:
        return None
    
    if not isinstance(cpf, str):
        cpf = str(cpf)
    
    # Remove caracteres não numéricos (espaços, pontos, traços, etc)
    cpf_digits = ''.join(filter(str.isdigit, cpf))
    
    # Tenta preencher com zeros à esquerda se o CPF tiver menos de 11 dígitos
    if len(cpf_digits) > 0 and len(cpf_digits) < 11:
        cpf_digits = cpf_digits.zfill(11)
        print(f"CPF ajustado com zeros à esquerda: {cpf} -> {cpf_digits}")
    
    # Verifica se tem 11 dígitos
    if len(cpf_digits) == 11:
        return cpf_digits
    else:
        print(f"CPF inválido: {cpf}. Deve conter 11 dígitos.")
        return None

def clean_text_field(value, max_length=None):
    """Limpa campos de texto, removendo espaços extras e limitando tamanho."""
    if value is None:
        return value
    
    # Converte para string se não for
    if not isinstance(value, str):
        value = str(value)
    
    # Remove espaços em branco no início e fim
    value = value.strip()
    
    # Limita o tamanho se especificado
    if max_length and len(value) > max_length:
        value = value[:max_length]
        
    return value

def parse_float(value):
    """
    Converte um valor string para float, tratando diferentes formatos de número
    """
    try:
        # Se já for float, retorna o valor
        if isinstance(value, float):
            return value
            
        # Remove espaços em branco e verifica se está vazio
        if not value or str(value).strip() in ['', ' ', '-']:
            return 0.0
            
        # Converte para string e substitui vírgula por ponto
        value_str = str(value).strip().replace(',', '.')
        
        # Remove caracteres não numéricos (exceto ponto e sinal negativo)
        value_str = ''.join(c for c in value_str if c.isdigit() or c in '.-')
        
        return float(value_str)
    except (ValueError, TypeError) as e:
        print(f"Aviso: Valor inválido '{value}' convertido para 0.0: {str(e)}")
        return 0.0

def parse_int(value):
    """
    Converte um valor para inteiro puro
    """
    try:
        # Se for float, converte para inteiro
        if isinstance(value, float):
            return int(value)
            
        # Se for string vazia ou traço
        if not value or str(value).strip() in ['', '-']:
            return 0
            
        # Remove espaços e vírgulas
        value_clean = str(value).strip().replace(',', '')
        
        # Converte para inteiro
        return int(float(value_clean))
        
    except (ValueError, TypeError) as e:
        print(f"Aviso: Valor inválido '{value}' convertido para 0: {str(e)}")
        return 0

def parse_valor_br(value):
    """
    Converte um valor monetário em formato brasileiro para Decimal.
    
    Exemplos:
      "R$ 1.234,56" -> Decimal('1234.56')
      "4780,24"     -> Decimal('4780.24')
    """
    if value is None:
        return Decimal('0.00')

    # Se já for numérico, converte direto
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))

    s = str(value).strip()
    if not s or s.lower() in ('nan', 'none'):
        return Decimal('0.00')

    # Remove tudo que não é dígito, vírgula, ponto ou sinal de menos
    s = re.sub(r'[^\d,.-]', '', s)

    # Se houver vírgula, considera última vírgula como separador decimal
    if ',' in s:
        inteiro, frac = s.rsplit(',', 1)
        inteiro = inteiro.replace('.', '')  # remove pontos de milhar
        s = f"{inteiro}.{frac}"
    else:
        # sem vírgula, apenas remove pontos de milhar
        s = s.replace('.', '')

    # Garante formato "-1234.56" ou "1234.56"
    try:
        return Decimal(s)
    except InvalidOperation:
        print(f"⚠️ Erro ao converter valor '{value}' para Decimal.")
        return Decimal('0.00')

def parse_date(value):
    """Converte uma string de data para objeto datetime.date ou None se inválida."""
    if not value:
        return None
        
    try:
        # Primeiro tenta o formato DD/MM/YYYY
        if isinstance(value, str) and '/' in value:
            parts = value.split('/')
            if len(parts) == 3:
                day, month, year = parts
                return datetime(int(year), int(month), int(day)).date()
        
        # Tenta formato ISO (YYYY-MM-DD) que vem do frontend
        if isinstance(value, str) and '-' in value and len(value) == 10:
            try:
                return datetime.strptime(value, '%Y-%m-%d').date()
            except ValueError:
                pass
                
        # Se não for possível, tenta dateutil parser
        from dateutil.parser import parse as date_parse
        parsed_date = date_parse(value)
        return parsed_date.date() if hasattr(parsed_date, 'date') else parsed_date
    except:
        return None

def format_currency(value):
    """Formata o valor para o padrão '1.000,00'."""
    if value is None:
        value = Decimal('0.00')
    value = Decimal(value)
    formatted_value = f'{value:,.2f}'.replace('.', 'X').replace(',', '.').replace('X', ',')
    return formatted_value

# =============================================================================== v2

# ===== INICIO CONSULTA CLIENTE ==============================================


def api_get_ficha_cliente(request):
    """
    API que retorna os dados da ficha de um cliente em formato JSON,
    considerando apenas os débitos associados a campanhas ativas e com prazo_restante > 0.
    """
    print("🔍 [api_get_ficha_cliente] Iniciando busca de ficha do cliente")
    
    if request.method != 'GET':
        print("❌ [api_get_ficha_cliente] Método não permitido:", request.method)
        return JsonResponse({'erro': 'Método não permitido. Use GET.'}, status=405)

    cpf = request.GET.get('cpf')
    print(f"🔍 [api_get_ficha_cliente] CPF recebido: {cpf}")
    
    if not cpf:
        print("❌ [api_get_ficha_cliente] CPF não fornecido")
        return JsonResponse({'erro': 'CPF não fornecido.'}, status=400)

    # Normaliza o CPF (supondo que a função normalize_cpf já esteja implementada)
    cpf_normalizado = normalize_cpf(cpf)
    print(f"🔍 [api_get_ficha_cliente] CPF normalizado: {cpf_normalizado}")
    
    if not cpf_normalizado:
        print("❌ [api_get_ficha_cliente] CPF inválido após normalização")
        return JsonResponse({'erro': 'CPF inválido.'}, status=400)

    # Busca o cliente pelo CPF normalizado
    print(f"🔍 [api_get_ficha_cliente] Buscando cliente com CPF: {cpf_normalizado}")
    cliente = Cliente.objects.filter(cpf=cpf_normalizado).first()
    
    if not cliente:
        print("❌ [api_get_ficha_cliente] Cliente não encontrado")
        return JsonResponse({'erro': 'Cliente não encontrado.'}, status=404)

    print(f"✅ [api_get_ficha_cliente] Cliente encontrado: {cliente.nome}")
    
    # Dados do cliente (informações pessoais e financeiras)
    cliente_data = {
        'id': cliente.id,
        'nome': cliente.nome,
        'cpf': cliente.cpf,
        'uf': cliente.uf,
        'rjur': cliente.rjur,
        'situacao_funcional': cliente.situacao_funcional,
        'renda_bruta': str(cliente.renda_bruta) if cliente.renda_bruta is not None else None,
        'bruta_5': str(cliente.bruta_5) if cliente.bruta_5 is not None else None,
        'util_5': str(cliente.util_5) if cliente.util_5 is not None else None,
        'saldo_5': str(cliente.saldo_5) if cliente.saldo_5 is not None else None,
        'brutaBeneficio_5': str(cliente.brutaBeneficio_5) if cliente.brutaBeneficio_5 is not None else None,
        'utilBeneficio_5': str(cliente.utilBeneficio_5) if cliente.utilBeneficio_5 is not None else None,
        'saldoBeneficio_5': str(cliente.saldoBeneficio_5) if cliente.saldoBeneficio_5 is not None else None,
        'bruta_35': str(cliente.bruta_35) if cliente.bruta_35 is not None else None,
        'util_35': str(cliente.util_35) if cliente.util_35 is not None else None,
        'saldo_35': str(cliente.saldo_35) if cliente.saldo_35 is not None else None,
        'total_util': str(cliente.total_util) if cliente.total_util is not None else None,
        'total_saldo': str(cliente.total_saldo) if cliente.total_saldo is not None else None,
    }

    # Filtra os débitos do cliente associados a campanhas ativas e com prazo_restante > 0
    print(f"🔍 [api_get_ficha_cliente] Buscando débitos para o cliente ID: {cliente.id}")
    debitos = Debito.objects.filter(cliente=cliente, campanha__status=True, prazo_restante__gt=0).select_related('campanha')
    print(f"✅ [api_get_ficha_cliente] Encontrados {debitos.count()} débitos ativos")
    
    lista_debitos = []
    for d in debitos:
        print(f"📋 [api_get_ficha_cliente] Processando débito: {d.num_contrato} - Campanha: {d.campanha.nome if d.campanha else 'N/A'}")
        lista_debitos.append({
            'matricula': d.matricula,
            'banco': d.banco,
            'orgao': d.orgao,
            'rebrica': d.rebrica,
            'parcela': str(d.parcela) if d.parcela is not None else None,
            'prazo_restante': d.prazo_restante,
            'tipo_contrato': d.tipo_contrato,
            'num_contrato': d.num_contrato,
            # Incluindo dados da campanha associada ao débito para referência
            'campanha': {
                'nome': d.campanha.nome,
                'data_criacao': d.campanha.data_criacao.strftime("%Y-%m-%d %H:%M:%S") if d.campanha.data_criacao else None,
                'setor': d.campanha.setor.nome if d.campanha.setor else 'Sem Setor', # Alterado de departamento para setor
                'status': d.campanha.status,
            },
        })

    # Busca telefones do cliente
    print(f"🔍 [api_get_ficha_cliente] Buscando telefones do cliente")
    telefones = TelefoneCliente.objects.filter(
        cliente=cliente,
        ativo=True
    ).select_related('usuario_cadastro').order_by('-principal', '-data_cadastro')
    
    telefones_data = []
    for tel in telefones:
        try:
            from apps.funcionarios.models import Funcionario
            funcionario = Funcionario.objects.get(usuario=tel.usuario_cadastro)
            nome_usuario = funcionario.apelido or funcionario.nome_completo.split()[0]
        except:
            nome_usuario = tel.usuario_cadastro.username if tel.usuario_cadastro else 'Sistema'
        
        telefones_data.append({
            'id': tel.id,
            'numero': tel.numero,
            'tipo': tel.tipo,
            'tipo_display': tel.get_tipo_display(),
            'origem': tel.origem,
            'origem_display': tel.get_origem_display(),
            'principal': tel.principal,
            'data_cadastro': tel.data_cadastro.strftime('%d/%m/%Y %H:%M'),
            'usuario_cadastro': nome_usuario,
            'observacoes': tel.observacoes or '',
            'agendamento_origem_id': tel.agendamento_origem.id if tel.agendamento_origem else None
        })
    
    print(f"✅ [api_get_ficha_cliente] Encontrados {len(telefones_data)} telefones")
    print("✅ [api_get_ficha_cliente] Retornando dados completos do cliente, débitos e telefones")
    return JsonResponse({
        'cliente': cliente_data,
        'debitos': lista_debitos,
        'telefones': telefones_data
    })


# ======= FIM CONSULTA CLIENTE =======





























# =============================================================================== v2



# ===== INÍCIO DA SEÇÃO DE FICHA CLIENTE =====

# def get_ficha_cliente(request, cpf):
    """
    Obtém os dados da ficha do cliente com base no CPF fornecido e renderiza a página.
    """
    print(f"Iniciando get_ficha_cliente para CPF: {cpf}")
    
    # Normaliza o CPF
    cpf_normalizado = normalize_cpf(cpf)
    if not cpf_normalizado:
        return render(request, 'siape/error.html', {'message': 'CPF inválido.'})

    # Obtém o cliente pelo CPF, ou retorna um erro 404 se não encontrado
    cliente = get_object_or_404(Cliente, cpf=cpf_normalizado)
    print(f"Cliente encontrado: {cliente.nome}")

    # Dicionário com os dados do cliente
    cliente_data = {
        'nome': cliente.nome,
        'cpf': cliente.cpf,
        'uf': cliente.uf,
        'upag': cliente.upag,
        'situacao_funcional': cliente.situacao_funcional,
        'rjur': cliente.rjur,
        'data_nascimento': cliente.data_nascimento,
        'sexo': cliente.sexo,
        'rf_situacao': cliente.rf_situacao,
        'siape_tipo_siape': cliente.siape_tipo_siape,
        'siape_qtd_matriculas': cliente.siape_qtd_matriculas,
        'siape_qtd_contratos': cliente.siape_qtd_contratos,
    }
    print("Dados do cliente coletados")

    # Obtém as informações pessoais mais recentes do cliente
    try:
        info_pessoal = cliente.informacoes_pessoais.latest('data_envio')
        info_pessoal_data = {
            'fne_celular_1': info_pessoal.fne_celular_1,
            'fne_celular_2': info_pessoal.fne_celular_2,
            'end_cidade_1': info_pessoal.end_cidade_1,
            'email_1': info_pessoal.email_1,
            'email_2': info_pessoal.email_2,
            'email_3': info_pessoal.email_3,
        }
        print("Informações pessoais coletadas")
    except InformacoesPessoais.DoesNotExist:
        info_pessoal_data = {}
        print("Nenhuma informação pessoal encontrada")

    # Obtém o débito/margem mais recente para os cards (apenas de campanhas ativas)
    debito_recente = DebitoMargem.objects.filter(
        cliente=cliente,
        campanha__status=True
    ).first()
    
    cards_data = {
        'saldo_5': debito_recente.saldo_5 if debito_recente else Decimal('0.00'),
        'benef_saldo_5': debito_recente.benef_saldo_5 if debito_recente else Decimal('0.00')
    }
    print(f"Dados dos cards coletados: Saldo 5 = {cards_data['saldo_5']}, Benef Saldo 5 = {cards_data['benef_saldo_5']}")

    # Filtra os débitos e margens associados ao cliente com prazo maior que zero e campanha ativa
    debitos_margens = DebitoMargem.objects.filter(
        cliente=cliente, 
        prazo__gt=0,
        campanha__status=True
    )
    print(f"Total de débitos/margens encontrados (apenas campanhas ativas): {debitos_margens.count()}")

    debitos_margens_data = []
    for debito_margem in debitos_margens:
        # Cálculo do saldo devedor
        pmt = float(debito_margem.pmt)
        prazo = float(debito_margem.prazo)
        pr_pz = pmt * prazo
        
        if prazo < 10:
            porcentagem = 0
        elif 10 <= prazo <= 39:
            porcentagem = 0.1
        elif 40 <= prazo <= 59:
            porcentagem = 0.2
        elif 60 <= prazo <= 71:
            porcentagem = 0.25
        elif 72 <= prazo <= 83:
            porcentagem = 0.3
        elif 84 <= prazo <= 96:
            porcentagem = 0.35
        else:
            porcentagem = 0
        
        desconto = pr_pz * porcentagem
        saldo_devedor = round(pr_pz - desconto, 2)
        
        # Cálculo da margem
        margem = round(float(debito_margem.saldo_35), 2)  # Assumindo que saldo_35 representa a margem
        
        debitos_margens_data.append({
            'matricula': debito_margem.matricula,
            'banco': debito_margem.banco,
            'orgao': debito_margem.orgao,
            'pmt': debito_margem.pmt,
            'prazo': debito_margem.prazo,
            'contrato': debito_margem.contrato,
            'margem': margem,
            'saldo_devedor': saldo_devedor,
        })
    print(f"Processados {len(debitos_margens_data)} débitos/margens")

    context = {
        'cliente': cliente_data,
        'informacoes_pessoais': info_pessoal_data,
        'debitos_margens': debitos_margens_data,
        'cards_data': cards_data,  # Adiciona os dados dos cards ao contexto
        'debito_recente': debito_recente,  # Passa o objeto completo também
    }
    
    print("Contexto da ficha do cliente montado")
    print("Renderizando página da ficha do cliente")
    return render(request, 'siape/ficha_cliente.html', context)

# ===== FIM DA SEÇÃO DE FICHA CLIENTE =====

# ===== INÍCIO DA SEÇÃO DOS POSTS =====
def post_addMeta(form_data):
    """Processa a adição de uma nova meta em RegisterMeta."""
    print("\n\n----- Iniciando post_addMeta -----\n")
    mensagem = {'texto': '', 'classe': ''}

    try:
        valor = Decimal(str(form_data.get('valor')).replace(',', '.'))
        tipo = form_data.get('tipo')
        setor = form_data.get('setor') if tipo == 'EQUIPE' else None
        loja = form_data.get('loja') if setor == 'INSS' else None
        
        meta = RegisterMeta.objects.create(
            titulo=form_data.get('titulo'),
            valor=valor,
            tipo=tipo,
            setor=setor,
            loja=loja,
            range_data_inicio=form_data.get('range_data_inicio'),
            range_data_final=form_data.get('range_data_final'),
            status=form_data.get('status') == 'True',
            descricao=form_data.get('descricao')
        )
        
        mensagem['texto'] = f'Meta "{meta.titulo}" adicionada com sucesso!'
        mensagem['classe'] = 'success'
        print(f"Meta adicionada: {meta}")

    except ValueError as e:
        mensagem['texto'] = 'Erro: Valor inválido para a meta'
        mensagem['classe'] = 'error'
        print(f"Erro de valor: {str(e)}")
    except Exception as e:
        mensagem['texto'] = f'Erro ao adicionar meta: {str(e)}'
        mensagem['classe'] = 'error'
        print(f"Erro: {str(e)}")

    return mensagem

def post_addMoney(form_data):
    """Processa a adição de um novo registro em RegisterMoney."""
    print("\n\n----- Iniciando post_addMoney -----\n")
    mensagem = {'texto': '', 'classe': ''}

    try:
        funcionario_id = form_data.get('funcionario_id')
        cpf_cliente = form_data.get('cpf_cliente')
        valor_est = form_data.get('valor_est')
        status = form_data.get('status') == 'True'  # Converte o valor do status para booleano
        data_atual = timezone.now()  # Data e hora atuais

        # Cria um novo registro em RegisterMoney
        registro = RegisterMoney.objects.create(
            funcionario_id=funcionario_id,
            cpf_cliente=cpf_cliente,
            valor_est=valor_est,
            status=status, 
            data=data_atual  # Usando a data e hora atuais
        )
        mensagem['texto'] = 'Registro adicionado com sucesso!'
        mensagem['classe'] = 'success'
        print(f"Registro adicionado: {registro}")

    except Exception as e:
        mensagem['texto'] = f'Erro ao adicionar registro: {str(e)}'
        mensagem['classe'] = 'error'
        print(f"Erro: {str(e)}")

    print(f"Mensagem final: {mensagem}\n\n")
    print("\n----- Finalizando post_addMoney -----\n")
    return mensagem

@login_required
@csrf_exempt
@require_GET
def api_get_info_camp(request):
    """
    API endpoint que retorna a lista de setores e de campanhas já criadas.
    """
    logger.info("----- Iniciando api_get_info_camp -----")
    try:
        # Obter a lista de setores ativos
        setores_queryset = Setor.objects.filter(status=True).select_related('departamento') # Adiciona select_related se precisar do nome do departamento
        setores_list = [
            {
                "id": setor.pk,
                "nome": setor.nome
                # Adicionar nome do departamento se necessário: "nome_completo": f"{setor.nome} - {setor.departamento.nome}"
            }
            for setor in setores_queryset
        ]

        # Obter a lista de campanhas, ordenadas por data de criação (mais recentes primeiro)
        campanhas_queryset = Campanha.objects.all().select_related('setor').order_by('-data_criacao') # Adiciona select_related para setor
        campanhas_list = [
            {
                "id": campanha.pk,
                "nome": campanha.nome,
                "setor": campanha.setor.nome if campanha.setor else None, # Obtém o nome do setor
                "setor_id": campanha.setor.id if campanha.setor else None, # Obtém o ID do setor
                "status": campanha.status,
                "data_criacao": campanha.data_criacao.strftime("%Y-%m-%d %H:%M:%S") if campanha.data_criacao else None,
            }
            for campanha in campanhas_queryset
        ]

        data = {
            "setores": setores_list, # Alterado de "departamentos" para "setores"
            "campanhas": campanhas_list,
        }
        logger.info("Dados obtidos com sucesso para api_get_info_camp.")
        logger.info("----- Finalizando api_get_info_camp -----")
        return JsonResponse(data, status=200)
    except Exception as e:
        logger.error("Erro ao obter informações: " + str(e))
        data = {
            "texto": f"Erro ao obter informações: {str(e)}",
            "classe": "error"
        }
        logger.info("----- Finalizando api_get_info_camp com erro -----")
        return JsonResponse(data, status=500)

@csrf_exempt
@require_POST
@login_required
@transaction.atomic
def api_post_campanha(request):
    """
    API endpoint para criar uma nova campanha.

    Recebe os dados via POST (nome_campanha, setor_id) e retorna uma resposta JSON.
    """
    logger.info("----- Iniciando api_post_campanha -----")

    # Extração dos dados enviados pelo formulário
    nome_campanha = request.POST.get('nome_campanha')
    setor_id = request.POST.get('setor_id') # Alterado de 'departamento' para 'setor_id'

    # Validação dos campos obrigatórios
    if not nome_campanha or not setor_id:
        mensagem = {
            'texto': 'Por favor, preencha o nome da campanha e selecione o setor. ⚠️',
            'classe': 'error'
        }
        logger.error("Erro: Campos obrigatórios (nome_campanha, setor_id) não preenchidos.")
        logger.info("----- Finalizando api_post_campanha -----")
        return JsonResponse(mensagem, status=400)

    try:
        # Busca a instância do Setor
        try:
            setor_obj = Setor.objects.get(pk=int(setor_id))
        except (Setor.DoesNotExist, ValueError):
            mensagem = {
                'texto': 'Setor inválido ou não encontrado. 😞',
                'classe': 'error'
            }
            logger.error(f"Erro: Setor com ID '{setor_id}' inválido ou não encontrado.")
            logger.info("----- Finalizando api_post_campanha -----")
            return JsonResponse(mensagem, status=400)


        # Criação da nova campanha associada ao setor
        campanha = Campanha.objects.create(
            nome=nome_campanha,
            setor=setor_obj, # Associa a instância do Setor
            data_criacao=timezone.now(),
            status=True  # Status padrão: Ativo
        )
        mensagem = {
            'texto': f'Campanha "{campanha.nome}" criada com sucesso para o setor {setor_obj.nome}! 🎉',
            'classe': 'success'
        }
        logger.info(f"Campanha criada: {campanha.nome} para Setor ID: {setor_obj.id}")
        logger.info("----- Finalizando api_post_campanha -----")
        return JsonResponse(mensagem, status=201)

    except Exception as e:
        mensagem = {
            'texto': f'Erro ao criar a campanha: {str(e)} 😞',
            'classe': 'error'
        }
        logger.error(f"Erro ao criar a campanha: {str(e)}")
        logger.info("----- Finalizando api_post_campanha -----")
        return JsonResponse(mensagem, status=500)





def parse_json_post_file(request):
    if request.content_type.startswith('multipart/form-data'):
        return request.FILES.get('csv_file'), request.POST.get('campanha_id', '0')
    else:
        return None, None

import time


@csrf_exempt
@require_POST
def api_post_importar_csv(request):
    """
    Importa CSV/XLS via upload de arquivo (multipart/form-data).
    Produz:
      - clientes novos (bulk_create)
      - clientes atualizados (bulk_update)
      - débitos criados (bulk_create)
    """
    print("\n----- Iniciando importação de dados CSV via API -----")
    print(f"Request method: {request.method}")
    print(f"Content type: {request.content_type}")

    # 1) Extrai o arquivo e o ID da campanha do FormData
    csv_file = request.FILES.get('csv_file')
    campanha_id = request.POST.get('campanha_id')
    print(f"Arquivo recebido: {csv_file.name if csv_file else 'Nenhum'}")
    print(f"ID da campanha: {campanha_id}")

    if not csv_file or not campanha_id:
        print("Erro: csv_file ou campanha_id não fornecidos")
        return JsonResponse(
            {'status': 'erro', 'mensagem': 'csv_file e campanha_id são obrigatórios.'},
            status=400
        )

    # 2) Lê o DataFrame (decimal=',' e milhares='.')
    name = csv_file.name.lower()
    print(f"Processando arquivo: {name}")
    
    try:
        if name.endswith('.csv'):
            print("Processando arquivo CSV")
            df = pd.read_csv(
                csv_file,
                encoding='utf-8-sig',
                sep=';',
                decimal=',',
                thousands='.'
            )
        elif name.endswith(('.xls', '.xlsx')):
            print("Processando arquivo Excel")
            df = pd.read_excel(csv_file, dtype=str)
        else:
            raise ValueError("Formato inválido: use .csv, .xls ou .xlsx")
        
        print(f"DataFrame carregado com {len(df)} linhas")
        print("Colunas originais:", df.columns.tolist())
        
    except Exception as e:
        print(f"Erro ao processar arquivo: {str(e)}")
        return JsonResponse({'status': 'erro', 'mensagem': str(e)}, status=400)

    df.columns = df.columns.str.strip()
    rows = df.to_dict(orient='records')
    total_linhas = len(rows)
    print(f"Total de linhas para processar: {total_linhas}")

    # 3) Carrega a campanha
    try:
        print(f"Buscando campanha com ID: {campanha_id}")
        campanha = Campanha.objects.get(pk=int(campanha_id))
        print(f"Campanha encontrada: {campanha.nome}")
    except (Campanha.DoesNotExist, ValueError) as e:
        print(f"Erro ao buscar campanha: {str(e)}")
        return JsonResponse(
            {'status': 'erro', 'mensagem': f"Campanha {campanha_id} não encontrada."},
            status=404
        )

    # 4) Extrai CPFs únicos
    cpfs_unicos = {
        normalize_cpf(str(r.get('CPF', '')))
        for r in rows
        if normalize_cpf(str(r.get('CPF', '')))
    }
    print(f"CPFs únicos encontrados: {len(cpfs_unicos)}")

    # 5) Busca clientes existentes
    print("Buscando clientes existentes no banco de dados...")
    clientes_existentes = {
        c.cpf: c for c in Cliente.objects.filter(cpf__in=cpfs_unicos)
    }
    print(f"Clientes existentes encontrados: {len(clientes_existentes)}")
    
    criar, atualizar, novos_por_cpf, debitos_info = [], [], {}, []
    print("Iniciando processamento de linhas...")

    # 6) Processa cada linha
    for idx, row in enumerate(rows, start=1):
        try:
            print(f"\nProcessando linha {idx}")
            cpf = normalize_cpf(str(row.get('CPF', '')))
            print(f"CPF processado: {cpf}")
            
            if not cpf:
                raise ValueError(f"CPF inválido na linha {idx}")

            # Cliente
            if cpf in clientes_existentes:
                print(f"Cliente existente encontrado para CPF: {cpf}")
                cli = clientes_existentes[cpf]
            elif cpf in novos_por_cpf:
                print(f"Cliente novo já processado para CPF: {cpf}")
                cli = novos_por_cpf[cpf]
            else:
                print(f"Novo cliente detectado para CPF: {cpf}")
                cli = Cliente(cpf=cpf)
                criar.append(cli)
                novos_por_cpf[cpf] = cli

            # Campos numéricos do Cliente
            print("Atualizando campos do cliente...")
            cli.nome = clean_text_field(get_safe_value(row, 'Nome', ''), 100)
            cli.uf = clean_text_field(get_safe_value(row, 'UF', ''), 2)
            cli.rjur = clean_text_field(get_safe_value(row, 'RJur', ''), 50)
            cli.situacao_funcional = clean_text_field(get_safe_value(row, 'Situacao_Funcional', ''), 50)
            cli.renda_bruta = parse_valor_br(get_safe_value(row, 'Renda_Bruta', '0'))
            cli.bruta_5 = parse_valor_br(get_safe_value(row, 'Bruta_5', '0'))
            cli.util_5 = parse_valor_br(get_safe_value(row, 'Utilizado_5', '0'))
            cli.saldo_5 = parse_valor_br(get_safe_value(row, 'Saldo_5', '0'))
            cli.brutaBeneficio_5 = parse_valor_br(get_safe_value(row, 'Bruta_Beneficio_5', '0'))
            cli.utilBeneficio_5 = parse_valor_br(get_safe_value(row, 'Utilizado_Beneficio_5', '0'))
            cli.saldoBeneficio_5 = parse_valor_br(get_safe_value(row, 'Saldo_Beneficio_5', '0'))
            cli.bruta_35 = parse_valor_br(get_safe_value(row, 'Bruta_35', '0'))
            cli.util_35 = parse_valor_br(get_safe_value(row, 'Utilizado_35', '0'))
            cli.saldo_35 = parse_valor_br(get_safe_value(row, 'Saldo_35', '0'))
            cli.total_util = parse_valor_br(get_safe_value(row, 'Total_Utilizado', '0'))
            cli.total_saldo = parse_valor_br(get_safe_value(row, 'Total_Saldo', '0'))

            if getattr(cli, 'pk', None):
                print("Cliente marcado para atualização")
                atualizar.append(cli)

            # Débito
            print("Criando informações de débito...")
            debitos_info.append({
                'cpf': cpf,
                'banco': clean_text_field(get_safe_value(row, 'Banco', ''), 100),
                'matricula': clean_text_field(get_safe_value(row, 'Matricula', ''), 50),
                'orgao': clean_text_field(get_safe_value(row, 'Orgao', ''), 50),
                'rebrica': clean_text_field(get_safe_value(row, 'Rebrica', ''), 50), # Adicionado campo Rebrica
                'parcela': parse_valor_br(get_safe_value(row, 'Parcela', '0')),
                'prazo_restante': parse_int(get_safe_value(row, 'Prazo_Restante', '0')),
                'tipo_contrato': clean_text_field(get_safe_value(row, 'Tipo_de_Contrato', ''), 50),
                'num_contrato': clean_text_field(get_safe_value(row, 'Numero_do_Contrato', ''), 50),
            })
            
        except Exception as e:
            print(f"[Linha {idx}] erro: {e}")
            continue

    # 7) Salva tudo em transação
    print("\nIniciando transação no banco de dados...")
    with transaction.atomic():
        if criar:
            print(f"Criando {len(criar)} novos clientes...")
            print("Iniciando bulk_create de clientes...")
            
            # Processa em lotes para acompanhar o progresso
            batch_size = 100
            total_batches = (len(criar) + batch_size - 1) // batch_size
            
            for i in range(0, len(criar), batch_size):
                batch_num = (i // batch_size) + 1
                end_idx = min(i + batch_size, len(criar))
                batch = criar[i:end_idx]
                
                print(f"Processando lote {batch_num}/{total_batches} - Clientes {i+1} a {end_idx} de {len(criar)}")
                Cliente.objects.bulk_create(batch, batch_size=batch_size)
                print(f"Lote {batch_num} concluído - {len(batch)} clientes criados")
            
            print("Criação de clientes concluída!")
        
        if atualizar:
            print(f"Atualizando {len(atualizar)} clientes existentes...")
            print("Iniciando bulk_update de clientes...")
            
            # Processa em lotes para acompanhar o progresso
            batch_size = 100
            total_batches = (len(atualizar) + batch_size - 1) // batch_size
            
            for i in range(0, len(atualizar), batch_size):
                batch_num = (i // batch_size) + 1
                end_idx = min(i + batch_size, len(atualizar))
                batch = atualizar[i:end_idx]
                
                print(f"Processando lote {batch_num}/{total_batches} - Clientes {i+1} a {end_idx} de {len(atualizar)}")
                Cliente.objects.bulk_update(
                    batch,
                    fields=[
                        'nome','uf','rjur','situacao_funcional',
                        'renda_bruta','bruta_5','util_5','saldo_5',
                        'brutaBeneficio_5','utilBeneficio_5','saldoBeneficio_5',
                        'bruta_35','util_35','saldo_35',
                        'total_util','total_saldo'
                    ],
                    batch_size=batch_size
                )
                print(f"Lote {batch_num} concluído - {len(batch)} clientes atualizados")
            
            print("Atualização de clientes concluída!")

        print("Buscando todos os clientes para criar débitos...")
        todos = Cliente.objects.filter(cpf__in=cpfs_unicos)
        mapa  = {c.cpf: c for c in todos}
        print(f"Mapa de clientes criado com {len(mapa)} registros")
        
        print("Criando objetos de débito...")
        debs  = []
        for idx, info in enumerate(debitos_info, 1):
            if idx % 1000 == 0:
                print(f"Processando débito {idx}/{len(debitos_info)}")
            
            cli = mapa.get(info['cpf'])
            if cli:
                debs.append(Debito(
                    cliente=cli,
                    campanha=campanha,
                    banco=info['banco'],
                    matricula=info['matricula'],
                    orgao=info['orgao'],
                    rebrica=info['rebrica'], # Adicionado campo rebrica
                    parcela=info['parcela'],
                    prazo_restante=info['prazo_restante'],
                    tipo_contrato=info['tipo_contrato'],
                    num_contrato=info['num_contrato'],
                ))
        
        print(f"Total de débitos preparados: {len(debs)}")
        
        if debs:
            print("Iniciando criação de débitos...")
            print("Iniciando bulk_create de débitos...")
            
            # Processa em lotes para acompanhar o progresso
            batch_size = 100
            total_batches = (len(debs) + batch_size - 1) // batch_size
            
            for i in range(0, len(debs), batch_size):
                batch_num = (i // batch_size) + 1
                end_idx = min(i + batch_size, len(debs))
                batch = debs[i:end_idx]
                
                print(f"Processando lote {batch_num}/{total_batches} - Débitos {i+1} a {end_idx} de {len(debs)}")
                Debito.objects.bulk_create(batch, batch_size=batch_size)
                print(f"Lote {batch_num} concluído - {len(batch)} débitos criados")
            
            print("Criação de débitos concluída!")

    print(f"----- Importação concluída -----")

    return JsonResponse({
        'status': 'sucesso',
        'linhas_processadas': total_linhas,
        'clientes_novos':      len(criar),
        'clientes_atualizados':len(atualizar),
        'debitos_criados':     len(debs),
    })


@csrf_exempt
@require_POST
@login_required
@transaction.atomic
def api_post_excluir_debitos_campanha(request):
    """
    API endpoint para excluir todos os débitos associados a uma campanha.
    Recebe o ID da campanha via POST.
    """
    logger.info("----- Iniciando api_post_excluir_debitos_campanha -----")
    mensagem = {'texto': '', 'classe': ''}

    try:
        campanha_id = request.POST.get('campanha_id')
        if not campanha_id:
            logger.error("Erro: ID da campanha não fornecido.")
            mensagem['texto'] = 'ID da campanha não fornecido.'
            mensagem['classe'] = 'error'
            return JsonResponse(mensagem, status=400)

        try:
            campanha_id_int = int(campanha_id)
            campanha = Campanha.objects.get(pk=campanha_id_int)
        except (ValueError, Campanha.DoesNotExist):
            logger.error(f"Erro: Campanha com ID '{campanha_id}' inválido ou não encontrado.")
            mensagem['texto'] = f'Campanha com ID \'{campanha_id}\' inválida ou não encontrada.'
            mensagem['classe'] = 'error'
            return JsonResponse(mensagem, status=404)

        # Excluir débitos associados à campanha
        debitos_excluidos, _ = Debito.objects.filter(campanha=campanha).delete()

        mensagem['texto'] = f'{debitos_excluidos} débitos da campanha "{campanha.nome}" foram excluídos com sucesso! ✅'
        mensagem['classe'] = 'success'
        logger.info(f"{debitos_excluidos} débitos da campanha '{campanha.nome}' (ID: {campanha_id}) excluídos.")
        status_code = 200

    except Exception as e:
        logger.error(f"Erro inesperado ao excluir débitos da campanha: {str(e)}")
        mensagem['texto'] = f'Erro inesperado ao excluir débitos: {str(e)}'
        mensagem['classe'] = 'error'
        status_code = 500

    logger.info("----- Finalizando api_post_excluir_debitos_campanha -----")
    return JsonResponse(mensagem, status=status_code)



# Antes de get_all_forms()
def post_deleteMoney(registro_id):
    """Processa a exclusão de um registro em RegisterMoney."""
    print("\n\n----- Iniciando post_deleteMoney -----\n")
    mensagem = {'texto': '', 'classe': ''}

    try:
        registro = RegisterMoney.objects.get(id=registro_id)
        registro.delete()
        mensagem['texto'] = 'Registro excluído com sucesso!'
        mensagem['classe'] = 'success'
        print(f"Registro excluído: {registro_id}")

    except RegisterMoney.DoesNotExist:
        mensagem['texto'] = 'Registro não encontrado.'
        mensagem['classe'] = 'error'
        print(f"Erro: Registro {registro_id} não encontrado")
    except Exception as e:
        mensagem['texto'] = f'Erro ao excluir registro: {str(e)}'
        mensagem['classe'] = 'error'
        print(f"Erro: {str(e)}")

    print(f"Mensagem final: {mensagem}\n\n")
    print("\n----- Finalizando post_deleteMoney -----\n")
    return mensagem

def post_csv_money(form_data):
    """Processa a importação de registros em RegisterMoney a partir de um arquivo CSV."""
    print("\n\n----- Iniciando post_csv_money -----\n")
    mensagem = {'texto': '', 'classe': ''}

    try:
        # Obtém o arquivo CSV do form_data
        csv_file = form_data.get('csv_file')
        if not csv_file:
            raise ValueError("Nenhum arquivo CSV fornecido.")

        # Lê o arquivo CSV
        df = pd.read_csv(csv_file, sep=';', encoding='utf-8-sig')

        for index, row in df.iterrows():
            funcionario_id = row['funcionario_id']
            cpf_cliente = row['cpf_cliente']
            valor_est = parse_float(row['valor_est'])
            data = parse_date(row['data'])

            # Cria um novo registro em RegisterMoney
            RegisterMoney.objects.create(
                funcionario_id=funcionario_id,
                cpf_cliente=cpf_cliente,
                valor_est=valor_est,
                status=True,
                data=data
            )
            print(f"Registro adicionado: Funcionario ID={funcionario_id}, CPF={cpf_cliente}, Valor={valor_est}")

        mensagem['texto'] = 'Registros importados com sucesso!'
        mensagem['classe'] = 'success'

    except Exception as e:
        mensagem['texto'] = f'Erro ao importar registros: {str(e)}'
        mensagem['classe'] = 'error'
        print(f"Erro: {str(e)}")

    return mensagem

def post_import_situacao(request):
    """
    Processa o arquivo CSV para atualizar a situação funcional dos clientes.
    Formato esperado do CSV:
    cpf_cliente;situacao_funcional
    03418758215;APOSENTADO
    24154571249;APOSENTADO
    """
    print("\n----- Iniciando post_import_situacao -----\n")
    mensagem = {'texto': '', 'classe': ''}
    
    if 'arquivo_situacao' not in request.FILES:
        mensagem['texto'] = 'Nenhum arquivo CSV foi enviado.'
        mensagem['classe'] = 'error'
        print(f"Aviso: {mensagem['texto']}")
        return mensagem

    arquivo = request.FILES['arquivo_situacao']
    print(f"Nome do arquivo: {arquivo.name}")
    print(f"Tamanho do arquivo: {arquivo.size} bytes")
    
    if not arquivo.name.endswith('.csv'):
        mensagem['texto'] = 'O arquivo deve ser um CSV.'
        mensagem['classe'] = 'error'
        print(f"Aviso: {mensagem['texto']}")
        return mensagem

    try:
        # Tenta diferentes encodings e separadores
        encodings = ['utf-8-sig', 'utf-8', 'latin1', 'iso-8859-1']
        separators = [';', ',']
        df = None
        
        for encoding in encodings:
            for sep in separators:
                try:
                    print(f"Tentando ler com encoding {encoding} e separador '{sep}'")
                    df = pd.read_csv(
                        arquivo,
                        encoding=encoding,
                        sep=sep,
                        dtype=str  # Força todos os campos como string
                    )
                    # Verifica se as colunas esperadas existem
                    if 'cpf_cliente' in df.columns and 'situacao_funcional' in df.columns:
                        print(f"Arquivo lido com sucesso usando {encoding} e separador '{sep}'")
                        print(f"Colunas encontradas: {df.columns.tolist()}")
                        break
                    else:
                        print(f"Colunas esperadas não encontradas. Colunas presentes: {df.columns.tolist()}")
                        df = None
                except Exception as e:
                    print(f"Erro ao tentar {encoding} com separador '{sep}': {str(e)}")
                    continue
            if df is not None:
                break

        if df is None:
            raise Exception("Não foi possível ler o arquivo com nenhuma combinação de encoding e separador")

        print(f"Total de linhas no arquivo: {len(df)}")
        print("Primeiras linhas do arquivo:")
        print(df.head())
        
        # Remove espaços em branco
        df['cpf_cliente'] = df['cpf_cliente'].str.strip()
        df['situacao_funcional'] = df['situacao_funcional'].str.strip()
        
        atualizados = 0
        erros = 0
        erros_log = []

        for index, row in df.iterrows():
            try:
                # Normaliza o CPF
                cpf = ''.join(filter(str.isdigit, str(row['cpf_cliente'])))
                if len(cpf) != 11:
                    erro_msg = f"CPF inválido na linha {index + 1}: {row['cpf_cliente']}"
                    erros_log.append(erro_msg)
                    erros += 1
                    print(erro_msg)
                    continue

                situacao = row['situacao_funcional'].upper()
                
                # Atualiza o cliente
                cliente = Cliente.objects.filter(cpf=cpf).first()
                if cliente:
                    cliente.situacao_funcional = situacao
                    cliente.save()
                    atualizados += 1
                    print(f"Cliente {cpf} atualizado com situação: {situacao}")
                else:
                    erro_msg = f"CPF não encontrado: {cpf}"
                    erros_log.append(erro_msg)
                    erros += 1
                    print(erro_msg)
                    
            except Exception as e:
                erro_msg = f"Erro na linha {index + 1}: {str(e)}"
                erros_log.append(erro_msg)
                erros += 1
                print(erro_msg)

        mensagem['texto'] = f'Importação concluída. {atualizados} clientes atualizados, {erros} erros encontrados.'
        mensagem['classe'] = 'success'
        
        if erros_log:
            mensagem['texto'] += "\nErros encontrados:\n" + "\n".join(erros_log)
            mensagem['classe'] = 'warning' if atualizados > 0 else 'error'
            
    except Exception as e:
        mensagem['texto'] = f'Erro ao processar arquivo: {str(e)}'
        mensagem['classe'] = 'error'
        print(f"Erro: {mensagem['texto']}")

    print("\n----- Finalizando post_import_situacao -----\n")
    return mensagem

# ===== FIM DA SEÇÃO DOS POSTS =====


# ===== INÍCIO DA SEÇÃO DE FINANCEIRO =====

@login_required
def api_get_infosiape(request):
    """
    API para fornecer listas de produtos ativos e funcionários do setor SIAPE ativos.
    """
    try:
        # Lista de produtos ativos
        produtos = Produto.objects.filter(ativo=True).values('id', 'nome') # CORRIGIDO: Usar 'ativo' em vez de 'status'

        # Lista de funcionários ativos no setor SIAPE com user_id
        # Assumindo que o nome do setor é 'SIAPE'
        funcionarios_siape = Funcionario.objects.filter(
            status=True,
            setor__nome='SIAPE',
            usuario__isnull=False # Garante que há um usuário Django associado
        ).select_related('usuario', 'setor').values(
            'usuario_id',
            'nome_completo',
            'apelido'
        )

        # Formata a lista de funcionários para incluir nome preferencial e user_id
        funcionarios_list = [
            {
                'user_id': f['usuario_id'],
                'nome_funcionario': f['apelido'] if f['apelido'] else f['nome_completo'].split()[0] # Usa apelido ou primeiro nome
            }
            for f in funcionarios_siape
        ]

        data = {
            'produtos': list(produtos),
            'funcionarios': funcionarios_list,
        }
        return JsonResponse(data)

    except Exception as e:
        # Logar o erro para diagnóstico
        logger.error(f"Erro em api_get_infosiape: {type(e).__name__} - {e}")
        logger.exception("Detalhes do erro em api_get_infosiape:") # Loga o traceback completo
        return JsonResponse({'error': 'Ocorreu um erro ao buscar informações.'}, status=500)


@login_required
def api_get_registrosTac(request):
    """
    API para fornecer dados de registros de TAC (RegisterMoney) para uma tabela.
    Inclui nome do funcionário, nome do cliente, CPF, valor e tipo (baseado no setor).
    Aceita parâmetros GET para filtragem: vendedor_id, cpf, data_inicio, data_fim, tipo.
    """
    try:
        # Obter parâmetros de filtro
        vendedor_id = request.GET.get('vendedor_id')
        cpf_filtro = request.GET.get('cpf')
        data_inicio_str = request.GET.get('data_inicio')
        data_fim_str = request.GET.get('data_fim')
        tipo_filtro = request.GET.get('tipo')

        # Query base
        registros_qs = RegisterMoney.objects.select_related('user', 'produto', 'loja').order_by('-data')

        # Aplicar filtros ao queryset
        if vendedor_id:
            registros_qs = registros_qs.filter(user_id=vendedor_id)
        if cpf_filtro:
            cpf_limpo = re.sub(r'\D', '', cpf_filtro)
            if len(cpf_limpo) == 11:
                registros_qs = registros_qs.filter(cpf_cliente=cpf_limpo)
        if data_inicio_str:
            try:
                data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d').date()
                registros_qs = registros_qs.filter(data__date__gte=data_inicio) # Filtrar pela parte da data
            except ValueError:
                logger.warning(f"Formato de data inválido para data_inicio: {data_inicio_str}")
        if data_fim_str:
            try:
                data_fim = datetime.strptime(data_fim_str, '%Y-%m-%d').date()
                registros_qs = registros_qs.filter(data__date__lte=data_fim) # Filtrar pela parte da data
            except ValueError:
                logger.warning(f"Formato de data inválido para data_fim: {data_fim_str}")

        # Obter todos os registros filtrados (exceto por tipo ainda)
        registros_filtrados = list(registros_qs)

        # Otimização: Buscar funcionários e clientes uma vez
        user_ids = [reg.user_id for reg in registros_filtrados if reg.user_id]
        cpfs_clientes = [reg.cpf_cliente for reg in registros_filtrados if reg.cpf_cliente]

        funcionarios = Funcionario.objects.filter(
            usuario_id__in=user_ids
        ).select_related('setor', 'usuario').in_bulk(field_name='usuario_id')

        clientes_siape = Cliente.objects.filter(cpf__in=cpfs_clientes).only('nome').in_bulk(field_name='cpf')
        # Assumindo que ClienteAgendamento é o modelo para clientes INSS
        clientes_inss = ClienteAgendamento.objects.filter(cpf__in=cpfs_clientes).only('nome_completo').in_bulk(field_name='cpf')


        data_list = []
        for reg in registros_filtrados:
            nome_funcionario = "Usuário não encontrado"
            tipo = "Outros" # Padrão
            funcionario = funcionarios.get(reg.user_id)

            if funcionario:
                nome_funcionario = funcionario.apelido if funcionario.apelido else funcionario.nome_completo
                if funcionario.setor:
                    # Define o tipo baseado no nome do setor do funcionário
                    setor_nome_upper = funcionario.setor.nome.upper()
                    if setor_nome_upper == 'SIAPE':
                        tipo = 'SIAPE'
                    elif setor_nome_upper == 'INSS':
                        tipo = 'INSS'

            # Aplicar filtro de TIPO aqui, após calcular o tipo
            if tipo_filtro and tipo_filtro != tipo:
                continue # Pula este registro se não corresponder ao tipo filtrado

            # Buscar nome do cliente
            nome_cliente = "Cliente não encontrado"
            cpf_cliente = reg.cpf_cliente
            if cpf_cliente:
                cliente_obj_siape = clientes_siape.get(cpf_cliente)
                if cliente_obj_siape:
                    nome_cliente = cliente_obj_siape.nome
                else:
                    cliente_obj_inss = clientes_inss.get(cpf_cliente)
                    if cliente_obj_inss:
                        nome_cliente = cliente_obj_inss.nome_completo

            data_list.append({
                'id': reg.id,
                'nome_funcionario': nome_funcionario,
                'nome_cliente': nome_cliente or 'Nome não disponível',
                'cpf_cliente': cpf_cliente,
                'valor_tac': reg.valor_est,
                'data': reg.data.strftime('%d/%m/%Y %H:%M:%S') if reg.data else None,
                'tipo': tipo,
                'produto': reg.produto.nome if reg.produto else 'N/A', # Adicionado produto
                'loja': reg.loja.nome if reg.loja else 'N/A', # Adicionado loja
            })

        return JsonResponse({'registros': data_list})

    except Exception as e:
        logger.error(f"Erro em api_get_registrosTac: {type(e).__name__} - {e}")
        logger.exception("Detalhes do erro em api_get_registrosTac:")
        return JsonResponse({'error': 'Ocorreu um erro ao buscar os registros de TAC.'}, status=500)

def api_get_cardstac(request):
    """
    API endpoint para buscar os valores agregados de TAC para os cards do dashboard financeiro.
    Retorna:
        - Total TAC no ano corrente.
        - Total TAC no mês corrente.
        - Total TAC no dia corrente.
        - Meta do mês para o setor SIAPE (se ativa).
    """
    try:
        hoje = timezone.now()
        ano_atual = hoje.year
        mes_atual = hoje.month
        dia_atual = hoje.day

        # 1. Calcular Total TAC Período (Ano)
        inicio_ano = hoje.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        fim_ano = hoje.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
        total_tac_ano = RegisterMoney.objects.filter(
            data__range=(inicio_ano, fim_ano),
            status=True # Considerando apenas registros ativos
        ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0.00')

        # 2. Calcular Total TAC Mês
        inicio_mes = hoje.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Calcula o último dia do mês
        ultimo_dia_mes = calendar.monthrange(ano_atual, mes_atual)[1]
        fim_mes = hoje.replace(day=ultimo_dia_mes, hour=23, minute=59, second=59, microsecond=999999)
        total_tac_mes = RegisterMoney.objects.filter(
            data__range=(inicio_mes, fim_mes),
            status=True
        ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0.00')

        # 3. Calcular Total TAC Dia
        inicio_dia = hoje.replace(hour=0, minute=0, second=0, microsecond=0)
        fim_dia = hoje.replace(hour=23, minute=59, second=59, microsecond=999999)
        total_tac_dia = RegisterMoney.objects.filter(
            data__range=(inicio_dia, fim_dia),
            status=True
        ).aggregate(total=Sum('valor_est'))['total'] or Decimal('0.00')

        # 4. Buscar Meta do Mês para SIAPE (direto pelo nome do setor)
        meta_mes_obj = None
        meta_mes_valor = Decimal('0.00')
        try:
            logger.debug("Tentando buscar meta por setor__nome__iexact='SIAPE'")
            meta_mes_obj = RegisterMeta.objects.filter(
                categoria='SETOR',
                setor__nome__iexact='SIAPE', # Busca case-insensitive pelo nome do setor
                status=True,
                data_inicio__lte=hoje,
                data_fim__gte=hoje
            ).first()
            logger.debug(f"Meta encontrada (por nome): {meta_mes_obj}")

            if meta_mes_obj:
                meta_mes_valor = meta_mes_obj.valor if meta_mes_obj.valor else Decimal('0.00')

        except Exception as meta_error:
            logger.error(f"Erro inesperado ao buscar meta do mês para o setor SIAPE: {type(meta_error).__name__} - {meta_error}")
            logger.exception("Detalhes do erro ao buscar meta:")
            # Continua sem a meta, mas loga o erro

        data = {
            'total_tac_periodo': total_tac_ano, # Valor Decimal
            'total_tac_mes': total_tac_mes,     # Valor Decimal
            'total_tac_dia': total_tac_dia,     # Valor Decimal
            'meta_mes': meta_mes_valor,         # Valor Decimal
        }

        return JsonResponse(data)

    except Exception as e:
        # Logar o erro para diagnóstico
        logger.error(f"Erro em api_get_cardstac: {type(e).__name__} - {e}")
        logger.exception("Detalhes do erro em api_get_cardstac:") # Loga o traceback completo
        return JsonResponse({'error': 'Ocorreu um erro ao buscar os dados dos cards.'}, status=500)

@require_POST
@csrf_exempt # Considere remover se o token CSRF for enviado via AJAX para maior segurança.
def api_post_novotac(request):
    """
    API para criar um novo registro financeiro (RegisterMoney) via POST JSON.
    Espera JSON com: cpf_cliente, produto_id, valor_tac, data_pago (YYYY-MM-DD), user_id.
    Associa automaticamente a loja, empresa, departamento, setor e equipe do funcionário.
    """
    try:
        data = json.loads(request.body)
        cpf_cliente = data.get('cpf_cliente')
        produto_id = data.get('produto_id')
        valor_tac_str = data.get('valor_tac')
        data_pago_str = data.get('data_pago') # Formato esperado 'YYYY-MM-DD'
        user_id = data.get('user_id')

        # Validação básica de presença dos campos
        campos_obrigatorios = {
            'cpf_cliente': cpf_cliente,
            'produto_id': produto_id,
            'valor_tac': valor_tac_str,
            'data_pago': data_pago_str,
            'user_id': user_id
        }
        campos_ausentes = [nome for nome, valor in campos_obrigatorios.items() if not valor]
        if campos_ausentes:
            logger.warning(f"Tentativa de criar TAC com campos ausentes: {', '.join(campos_ausentes)}. Dados: {data}")
            return JsonResponse({'error': f'Campos obrigatórios ausentes: {", ".join(campos_ausentes)}'}, status=400)

        # Limpeza e validação do CPF
        cpf_cliente_cleaned = re.sub(r'\D', '', cpf_cliente)
        if len(cpf_cliente_cleaned) != 11:
             logger.warning(f"CPF inválido recebido: {cpf_cliente}")
             return JsonResponse({'error': 'Formato de CPF inválido. Deve conter 11 dígitos.'}, status=400)

        # Validação e conversão do valor_tac
        try:
            valor_tac = Decimal(valor_tac_str)
            if valor_tac < Decimal('0.00'):
                 raise ValueError("Valor TAC não pode ser negativo.")
        except (InvalidOperation, ValueError) as e:
            logger.error(f"Erro ao converter valor_tac '{valor_tac_str}': {e}")
            return JsonResponse({'error': f'Valor TAC inválido: {valor_tac_str}. Use formato numérico com ponto decimal.'}, status=400)

        # Validação e conversão da data_pago
        try:
            # API agora espera YYYY-MM-DD do input type="date"
            data_pago = datetime.strptime(data_pago_str, '%Y-%m-%d').date()
            data_registro = data_pago # Assumindo que o campo 'data' no modelo é DateField ou pode aceitar Date
        except ValueError:
             logger.error(f"Erro ao converter data_pago '{data_pago_str}': Formato inválido.")
             return JsonResponse({'error': "Formato de data inválido. Use 'YYYY-MM-DD'."}, status=400)

        # Busca objetos relacionados (Usuário, Produto, Funcionário e suas associações)
        try:
            user = User.objects.get(pk=user_id)
            produto = Produto.objects.get(pk=produto_id, ativo=True) # Garante que o produto está ativo

            # Busca o funcionário e suas associações organizacionais
            funcionario = None
            loja = None
            empresa = None
            departamento = None
            setor = None
            equipe = None

            try:
                # Busca o funcionário e suas associações organizacionais
                funcionario = Funcionario.objects.select_related(
                    'empresa', 'departamento', 'setor', 'equipe'
                ).filter(
                    usuario=user,
                    status=True  # Garante que o funcionário está ativo
                ).first()

                if not funcionario:
                    logger.warning(f"Usuário {user.username} (ID: {user_id}) não encontrado no cadastro de funcionários ativos.")
                    return JsonResponse({'error': 'Usuário não encontrado no cadastro de funcionários ativos.'}, status=404)

                # Extrai os dados organizacionais do funcionário
                empresa = funcionario.empresa
                departamento = funcionario.departamento
                setor = funcionario.setor
                equipe = funcionario.equipe

                # Log para verificar os dados encontrados
                logger.info(f"Funcionário {user.username} encontrado. Empresa: {empresa}, Depto: {departamento}, Setor: {setor}, Equipe: {equipe}")

            except Exception as func_error:
                logger.error(f"Erro ao buscar dados do funcionário: {type(func_error).__name__} - {func_error}")
                logger.exception("Detalhes do erro na busca de dados do funcionário:")
                return JsonResponse({'error': 'Erro ao buscar dados do funcionário.'}, status=500)

        except User.DoesNotExist:
            logger.error(f"Usuário com ID {user_id} não encontrado.")
            return JsonResponse({'error': f'Usuário com ID {user_id} não encontrado.'}, status=404)
        except Produto.DoesNotExist:
            logger.error(f"Produto com ID {produto_id} não encontrado ou inativo.")
            return JsonResponse({'error': f'Produto com ID {produto_id} não encontrado ou inativo.'}, status=404)
        except Exception as lookup_error:
            logger.error(f"Erro ao buscar User/Produto: {type(lookup_error).__name__} - {lookup_error}")
            logger.exception("Detalhes do erro na busca de objetos relacionados:")
            return JsonResponse({'error': 'Erro ao buscar dados relacionados.'}, status=500)

        # Criação da instância de RegisterMoney com os dados organizacionais
        try:
            novo_registro = RegisterMoney.objects.create(
                user=user,
                empresa=empresa,
                departamento=departamento,
                setor=setor,
                equipe=equipe,
                cpf_cliente=cpf_cliente_cleaned,
                produto=produto,
                valor_est=valor_tac,
                data=data_registro,
                status=True
            )
            logger.info(f"Registro TAC criado com sucesso: ID {novo_registro.id} para User {user.username}")

            return JsonResponse({
                'success': True,
                'message': 'Registro TAC criado com sucesso!',
                'registro_id': novo_registro.id
            }, status=201) # Status 201 Created

        except Exception as create_error:
            logger.error(f"Erro ao criar RegisterMoney: {type(create_error).__name__} - {create_error}")
            logger.exception("Detalhes do erro na criação do registro TAC:")
            return JsonResponse({'error': 'Erro ao salvar o registro no banco de dados.'}, status=500)

    except json.JSONDecodeError:
        logger.error("Erro ao decodificar JSON da requisição.")
        return JsonResponse({'error': 'Formato JSON inválido no corpo da requisição.'}, status=400)
    except Exception as e:
        logger.error(f"Erro inesperado em api_post_novotac: {type(e).__name__} - {e}")
        logger.exception("Detalhes do erro inesperado em api_post_novotac:")
        return JsonResponse({'error': 'Ocorreu um erro interno no servidor ao processar a solicitação.'}, status=500)


@require_GET
def api_get_nomecliente(request):
    """
    API para buscar o nome de um cliente pelo CPF.
    Busca primeiro no modelo Cliente (SIAPE) e depois em ClienteAgendamento (INSS).
    Recebe o parâmetro 'cpf' via GET.
    Retorna JSON {'nome': 'Nome Encontrado'} ou {'nome': 'Não registrado'}.
    """
    print("--- Iniciando api_get_nomecliente ---") # DEBUG
    cpf_param = request.GET.get('cpf')
    print(f"DEBUG: CPF recebido como parâmetro: {cpf_param}") # DEBUG

    if not cpf_param:
        print("DEBUG: Parâmetro CPF ausente.") # DEBUG
        return JsonResponse({'error': 'Parâmetro CPF ausente na requisição.'}, status=400)

    # Limpa o CPF para conter apenas dígitos
    cpf_limpo = re.sub(r'\D', '', cpf_param)
    print(f"DEBUG: CPF limpo: {cpf_limpo}") # DEBUG

    # Valida se o CPF limpo tem 11 dígitos
    if len(cpf_limpo) != 11:
        print(f"DEBUG: CPF limpo ({cpf_limpo}) não tem 11 dígitos. Retornando 'Não registrado'.") # DEBUG
        # Retorna 'Não registrado' para simplificar o tratamento no frontend
        # Alternativa: retornar erro 400
        return JsonResponse({'nome': 'Não registrado'})
        # return JsonResponse({'error': 'CPF inválido. Deve conter 11 dígitos.'}, status=400)

    nome_cliente = 'Não registrado' # Valor padrão
    print(f"DEBUG: Valor inicial de nome_cliente: {nome_cliente}") # DEBUG

    try:
        # 1. Busca no modelo Cliente (SIAPE)
        print(f"DEBUG: Buscando CPF {cpf_limpo} no modelo Cliente (SIAPE)...") # DEBUG
        # Usar first() para obter um objeto ou None, evitando exceção DoesNotExist
        cliente_siape = Cliente.objects.filter(cpf=cpf_limpo).only('nome').first()
        print(f"DEBUG: Resultado da busca no Cliente (SIAPE): {cliente_siape}") # DEBUG
        if cliente_siape:
            # Usa o nome se existir, senão mantém um placeholder ou o padrão
            nome_cliente = cliente_siape.nome if cliente_siape.nome else 'Nome não cadastrado (SIAPE)'
            print(f"DEBUG: Cliente encontrado no SIAPE. Nome: {nome_cliente}") # DEBUG
            return JsonResponse({'nome': nome_cliente})

        # 2. Se não encontrou no SIAPE, busca no modelo ClienteAgendamento (INSS)
        print(f"DEBUG: CPF {cpf_limpo} não encontrado no SIAPE. Buscando no ClienteAgendamento (INSS)...") # DEBUG
        cliente_inss = ClienteAgendamento.objects.filter(cpf=cpf_limpo).only('nome_completo').first()
        print(f"DEBUG: Resultado da busca no ClienteAgendamento (INSS): {cliente_inss}") # DEBUG
        if cliente_inss:
            nome_cliente = cliente_inss.nome_completo if cliente_inss.nome_completo else 'Nome não cadastrado (INSS)'
            print(f"DEBUG: Cliente encontrado no INSS. Nome: {nome_cliente}") # DEBUG
            return JsonResponse({'nome': nome_cliente})

        # 3. Se não encontrou em nenhum modelo, retorna o valor padrão 'Não registrado'
        print(f"DEBUG: CPF {cpf_limpo} não encontrado em nenhum modelo. Retornando '{nome_cliente}'.") # DEBUG
        return JsonResponse({'nome': nome_cliente})

    except Exception as e:
        # Logar o erro em produção
        print(f"!!! ERRO !!! Erro ao buscar nome do cliente por CPF ({cpf_limpo}): {e}") # DEBUG
        # Retorna 'Não registrado' para evitar quebrar o frontend em caso de erro inesperado
        print("DEBUG: Retornando 'Não registrado' devido a exceção.") # DEBUG
        return JsonResponse({'nome': 'Não registrado'})
        # Alternativa: retornar um erro 500 mais explícito
        # return JsonResponse({'error': 'Erro interno ao buscar nome do cliente.'}, status=500)





# ===== FIM DA SEÇÃO DE FINANCEIRO =====


# ===== INÍCIO DA SEÇÃO DE RANKING =====


from decimal import Decimal, InvalidOperation
from datetime import datetime, time, timedelta
import calendar
from django.utils import timezone
from django.db.models import Sum

# ===== INÍCIO DA SEÇÃO DE RANKING =====

@login_required
@require_GET
def api_cards(request, periodo='mes'):
    hoje = timezone.now().date()

    # --- Carrega metas ---
    meta_geral = RegisterMeta.objects.filter(
        categoria='GERAL', status=True,
        data_inicio__lte=hoje, data_fim__gte=hoje
    ).first()
    meta_empresa = RegisterMeta.objects.filter(
        categoria='EMPRESA', status=True,
        data_inicio__lte=hoje, data_fim__gte=hoje
    ).first()
    meta_siape = RegisterMeta.objects.filter(
        categoria='SETOR', status=True,
        data_inicio__lte=hoje, data_fim__gte=hoje,
        setor__nome='SIAPE'
    ).first()

    # --- Define períodos ---
    def period_bounds(meta, default_month=True):
        if meta:
            start = datetime.combine(meta.data_inicio, time.min)
            end   = datetime.combine(meta.data_fim,    time.max)
        elif default_month:
            first = hoje.replace(day=1)
            last  = hoje.replace(day=calendar.monthrange(hoje.year, hoje.month)[1])
            start = datetime.combine(first, time.min)
            end   = datetime.combine(last,  time.max)
        else:
            start = end = None
        return start, end

    p0_start, p0_end = period_bounds(meta_geral)
    p1_start, p1_end = period_bounds(meta_empresa)
    p2_start, p2_end = period_bounds(meta_siape)

    # --- Soma helper ---
    def sum_range(model_qs):
        tot = model_qs.aggregate(
            total=Sum('valor_est')
        )['total'] or Decimal('0')
        return tot

    # --- Meta Geral ---
    valores_geral = RegisterMoney.objects.filter(
        data__range=[p0_start, p0_end]
    )
    faturamento_total = sum((Decimal(str(v.valor_est)) for v in valores_geral if v.valor_est), Decimal('0'))
    percentual_geral = (
        round((faturamento_total / meta_geral.valor) * 100, 2)
        if meta_geral and meta_geral.valor and meta_geral.valor > 0 else 0
    )

    # --- Meta Empresa (exclui franquias) ---
    qs_emp_base = RegisterMoney.objects.filter(
        data__range=[p1_start, p1_end],
        status=True
    )
    total_emp = sum((Decimal(str(v.valor_est)) for v in qs_emp_base if v.valor_est), Decimal('0'))
    # subtrai o faturamento das franquias
    franquias_emp = sum((Decimal(str(v.valor_est)) for v in qs_emp_base.filter(loja__franquia=True) if v.valor_est), Decimal('0'))
    faturamento_empresa = total_emp - franquias_emp

    percentual_empresa = (
        round((faturamento_empresa / meta_empresa.valor) * 100, 2)
        if meta_empresa and meta_empresa.valor and meta_empresa.valor > 0 else 0
    )
    valor_meta_empresa = (
        format_currency(meta_empresa.valor) if meta_empresa and meta_empresa.valor else "R$ 0,00"
    )

    # --- Meta Siape ---
    qs_siape = RegisterMoney.objects.filter(
        data__range=[p2_start, p2_end],
        setor__nome='SIAPE'
    )
    faturamento_siape = sum((Decimal(str(v.valor_est)) for v in qs_siape if v.valor_est), Decimal('0'))
    percentual_siape = (
        round((faturamento_siape / meta_siape.valor) * 100, 2)
        if meta_siape and meta_siape.valor and meta_siape.valor > 0 else 0
    )

    # --- Calcula valores em falta ---
    falta_meta_empresa = (
        (meta_empresa.valor - faturamento_empresa) 
        if meta_empresa and meta_empresa.valor and (meta_empresa.valor > faturamento_empresa) 
        else Decimal('0')
    )
    
    falta_meta_siape = (
        (meta_siape.valor - faturamento_siape) 
        if meta_siape and meta_siape.valor and (meta_siape.valor > faturamento_siape) 
        else Decimal('0')
    )

    # --- Monta resposta ---
    data = {
        'meta_geral': {
            'valor_total': format_currency(faturamento_total),
            'percentual': percentual_geral,
            'valor_meta': format_currency(meta_geral.valor) if meta_geral and meta_geral.valor else "R$ 0,00"
        },
        'meta_empresa': {
            'valor_total': format_currency(faturamento_empresa),
            'percentual': percentual_empresa,
            'valor_meta': valor_meta_empresa
        },
        'falta_meta_empresa': {
            'valor_total': format_currency(falta_meta_empresa)
        },
        'meta_siape': {
            'valor_total': format_currency(faturamento_siape),
            'percentual': percentual_siape,
            'valor_meta': format_currency(meta_siape.valor) if meta_siape and meta_siape.valor else "R$ 0,00"
        },
        'falta_meta_siape': {
            'valor_total': format_currency(falta_meta_siape)
        }
    }
    return JsonResponse(data)


@login_required
@require_GET
def api_podium(request, periodo='mes'):
    hoje = timezone.now().date()

    meta_siape = RegisterMeta.objects.filter(
        status=True, categoria='SETOR',
        setor__nome='SIAPE',
        data_inicio__lte=hoje, data_fim__gte=hoje
    ).first()

    if meta_siape:
        primeiro_dia = meta_siape.data_inicio
        ultimo_dia   = meta_siape.data_fim
    else:
        primeiro_dia = hoje.replace(day=1)
        ultimo_mes   = calendar.monthrange(hoje.year, hoje.month)[1]
        ultimo_dia   = hoje.replace(day=ultimo_mes)

    podium_query = RegisterMoney.objects.filter(
        data__date__range=[primeiro_dia, ultimo_dia],
        setor__nome='SIAPE', user__isnull=False, status=True
    ).values('user_id').annotate(
        total_fechamentos=Sum('valor_est')
    ).filter(
        total_fechamentos__gt=Decimal('0.00')
    ).order_by('-total_fechamentos')[:5]

    user_ids = [x['user_id'] for x in podium_query]
    funcionarios_map = Funcionario.objects.filter(
        usuario_id__in=user_ids
    ).select_related('usuario').in_bulk(field_name='usuario_id')

    podium = []
    for pos, item in enumerate(podium_query, start=1):
        user_id = item['user_id']
        func = funcionarios_map.get(user_id)
        if func:
            nome = func.apelido or func.nome_completo.split()[0]
            logo = func.foto.url if func.foto else '/static/img/default-store.png'
            total = item['total_fechamentos']
        else:
            nome, logo, total = f'Usuário {user_id}', '/static/img/default-store.png', item['total_fechamentos']

        podium.append({
            'id': func.id if func else None,
            'user_id': user_id,
            'nome': nome,
            'logo': logo,
            'total_fechamentos': format_currency(total),
            'posicao': pos
        })

    return JsonResponse({
        'podium': podium,
        'periodo': {
            'inicio': primeiro_dia.strftime('%Y-%m-%d'),
            'fim':    ultimo_dia.strftime('%Y-%m-%d')
        }
    })




import io
import csv
import zipfile
from tqdm import tqdm
import sys

def export_register_money(request):
    """
    View que gera um arquivo ZIP contendo um CSV para o model RegisterMoney.
    O CSV utilizará ';' como delimitador.
    Durante a exportação, é exibida uma barra de progresso no terminal.
    """
    zip_buffer = io.BytesIO()
    filename = "registermoney.csv"
    
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer, delimiter=';')
        
        # Escreve o cabeçalho com os nomes dos campos do model
        field_names = [field.name for field in RegisterMoney._meta.fields]
        writer.writerow(field_names)
        
        queryset = RegisterMoney.objects.all()
        # Barra de progresso para cada objeto do model
        for obj in tqdm(queryset, desc=f"Processando {filename}", file=sys.stdout):
            row = []
            for field in RegisterMoney._meta.fields:
                value = getattr(obj, field.name)
                row.append("" if value is None else str(value))
            writer.writerow(row)
        
        # Adiciona o conteúdo do CSV ao arquivo ZIP
        zip_file.writestr(filename, csv_buffer.getvalue())
        csv_buffer.close()
    
    zip_buffer.seek(0)
    response = HttpResponse(zip_buffer, content_type="application/zip")
    response["Content-Disposition"] = "attachment; filename=export_registermoney.zip"
    return response

# ======= INÍCIO AGENDAMENTO CLIENTE =======

@csrf_exempt
@require_POST
def api_post_agend_cliente(request):
    """
    API endpoint para criar um novo agendamento para um cliente.
    Recebe os dados via POST e retorna uma resposta JSON.
    """
    logger.info("----- Iniciando api_post_agend_cliente -----")

    cliente_id = request.POST.get('cliente_id')
    data_str = request.POST.get('data')
    hora_str = request.POST.get('hora')
    observacao = request.POST.get('observacao', '') # Observação é opcional
    telefone_contato = request.POST.get('telefone_contato', '') # Telefone é opcional

    # Validação básica dos campos obrigatórios
    if not cliente_id or not data_str or not hora_str:
        logger.error("Erro: Campos obrigatórios (cliente_id, data, hora) não fornecidos.")
        return JsonResponse({'status': 'erro', 'mensagem': 'Campos obrigatórios não fornecidos.'}, status=400)

    try:
        # Busca o cliente
        cliente = Cliente.objects.get(id=int(cliente_id))
        logger.info(f"Cliente encontrado: {cliente.nome} (ID: {cliente_id})")

        # Tenta converter data e hora
        try:
            # Tenta formato DD-MM-YYYY primeiro
            data_agendamento = datetime.strptime(data_str, '%d-%m-%Y').date() 
            logger.info(f"Data parseada com formato DD-MM-YYYY: {data_agendamento}")
        except ValueError:
            try:
                 # Tenta formato YYYY-MM-DD como fallback
                data_agendamento = datetime.strptime(data_str, '%Y-%m-%d').date()
                logger.info(f"Data parseada com formato YYYY-MM-DD: {data_agendamento}")
            except ValueError:
                 logger.error(f"Erro: Formato inválido de data ({data_str}). Use DD-MM-YYYY ou YYYY-MM-DD.")
                 return JsonResponse({'status': 'erro', 'mensagem': 'Formato de data inválido. Use DD-MM-YYYY.'}, status=400)
        
        try:
            # Mantém o parse da hora como HH:MM
            hora_agendamento = datetime.strptime(hora_str, '%H:%M').time()
            logger.info(f"Hora parseada: {hora_agendamento}")
        except ValueError:
            logger.error(f"Erro: Formato inválido de hora ({hora_str}). Use HH:MM.")
            return JsonResponse({'status': 'erro', 'mensagem': 'Formato de hora inválido. Use HH:MM.'}, status=400)

        # Cria o agendamento usando objects.create com o nome correto do modelo
        try:
            # Usa AgendamentoFichaCliente.objects.create() para criar e salvar
            novo_agendamento = AgendamentoFichaCliente.objects.create(
                cliente=cliente,               # Passa a instância do cliente
                usuario=request.user,          # Adiciona o usuário logado
                data=data_agendamento,         # Passa o objeto date
                hora=hora_agendamento,         # Passa o objeto time
                observacao=observacao,         # Passa a string de observação
                telefone_contato=telefone_contato  # Passa o telefone de contato
            )
            logger.info(f"Agendamento (Ficha Cliente) criado com sucesso via objects.create: ID {novo_agendamento.id}")
            
            # Cria automaticamente a tabulação "Em Negociação" para o novo agendamento
            try:
                # Cria a tabulação automática
                nova_tabulacao = TabulacaoAgendamento.objects.create(
                    agendamento=novo_agendamento,
                    status='EM_NEGOCIACAO',
                    usuario_responsavel=request.user,
                    observacoes='Tabulação criada automaticamente ao criar o agendamento.'
                )
                logger.info(f"Tabulação criada automaticamente para agendamento {novo_agendamento.id} com status EM_NEGOCIACAO")
                
                # Cria o primeiro registro no histórico
                HistoricoTabulacaoAgendamento.objects.create(
                    agendamento=novo_agendamento,
                    status_anterior=None,
                    status_novo='EM_NEGOCIACAO',
                    usuario=request.user,
                    observacoes='Status inicial definido automaticamente.'
                )
                logger.info(f"Histórico de tabulação criado para agendamento {novo_agendamento.id}")
                
            except Exception as tab_error:
                # Não bloqueia a criação do agendamento se houver erro na tabulação
                logger.warning(f"Erro ao criar tabulação automática para agendamento {novo_agendamento.id}: {str(tab_error)}")
            
            # Se um telefone foi fornecido, cria o registro no TelefoneCliente
            if telefone_contato and telefone_contato.strip():
                telefone_limpo = ''.join(filter(str.isdigit, telefone_contato))
                if len(telefone_limpo) >= 8:  # Validação básica de telefone
                    try:
                        # Verifica se já existe este número para o cliente
                        if not TelefoneCliente.objects.filter(
                            cliente=cliente, 
                            numero=telefone_contato, 
                            ativo=True
                        ).exists():
                            TelefoneCliente.objects.create(
                                cliente=cliente,
                                numero=telefone_contato,
                                tipo='CELULAR',  # Padrão
                                origem='AGENDAMENTO',
                                agendamento_origem=novo_agendamento,
                                usuario_cadastro=request.user,
                                observacoes=f'Telefone adicionado via agendamento #{novo_agendamento.id}'
                            )
                            logger.info(f"Telefone {telefone_contato} adicionado ao cliente via agendamento")
                    except Exception as tel_error:
                        # Não bloqueia o agendamento se houver erro no telefone
                        logger.warning(f"Erro ao salvar telefone do agendamento: {str(tel_error)}")
                        
        except Exception as creation_error:
            # Log detalhado do erro de criação
            logger.error(f"Erro ao criar AgendamentoFichaCliente via objects.create: {type(creation_error).__name__} - {str(creation_error)}")
            logger.exception("Detalhes do erro de criação do agendamento:") # Loga o traceback completo
            error_message = str(creation_error)
            # O erro TypeError original fazia sentido agora, remove a mensagem genérica
            return JsonResponse({'status': 'erro', 'mensagem': f'Erro ao criar registro no banco: {error_message}'}, status=500)

        return JsonResponse({
            'status': 'sucesso',
            'mensagem': 'Agendamento criado com sucesso!',
            'agendamento_id': novo_agendamento.id
        }, status=201)

    except Cliente.DoesNotExist:
        logger.error(f"Erro: Cliente com ID {cliente_id} não encontrado.")
        return JsonResponse({'status': 'erro', 'mensagem': 'Cliente não encontrado.'}, status=404)
    except ValueError as ve: # Captura especificamente ValueError de int(cliente_id)
        logger.error(f"Erro: ID do cliente inválido ({cliente_id}): {str(ve)}")
        return JsonResponse({'status': 'erro', 'mensagem': 'ID do cliente inválido.'}, status=400)
    except Exception as e:
        logger.error(f"Erro inesperado ao criar agendamento: {type(e).__name__} - {str(e)}")
        logger.exception("Detalhes do erro inesperado:") # Loga o traceback completo
        return JsonResponse({'status': 'erro', 'mensagem': f'Erro interno do servidor: {str(e)}'}, status=500)
    finally:
        logger.info("----- Finalizando api_post_agend_cliente -----")


@login_required
def api_get_agendamentos_cliente(request):
    """
    Retorna os agendamentos feitos pelo usuário logado que não estão confirmados.
    """
    try:
        # Obtém os agendamentos do usuário logado que não estão confirmados
        agendamentos = AgendamentoFichaCliente.objects.filter(
            usuario=request.user
        ).exclude(
            status='CONFIRMADO'  # Exclui agendamentos já confirmados
        ).select_related('cliente').order_by('-data', '-hora')

        # Prepara a lista de agendamentos para o JSON
        agendamentos_list = []
        for agend in agendamentos:
            agendamentos_list.append({
                'id': agend.id,
                'cliente_id': agend.cliente.id,
                'cliente_nome': agend.cliente.nome,
                'cliente_cpf': agend.cliente.cpf,
                'data': agend.data.strftime('%d/%m/%Y'),
                'hora': agend.hora.strftime('%H:%M'),
                'observacao': agend.observacao or '',
                'telefone_contato': agend.telefone_contato or '',
                'data_criacao': agend.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'status': agend.status  # Adicionar o status para referência no frontend
            })

        return JsonResponse({
            'status': 'sucesso',
            'agendamentos': agendamentos_list
        })

    except Exception as e:
        logger.error(f"Erro ao buscar agendamentos: {str(e)}")
        return JsonResponse({
            'status': 'erro',
            'mensagem': 'Erro ao buscar agendamentos.'
        }, status=500)

@require_GET
def api_get_infocliente(request):
    """
    API que retorna os dados da ficha de um cliente específico em formato JSON,
    recebendo o cliente_id via GET e opcionalmente o agendamento_id.
    Filtra os débitos apenas para campanhas ativas.
    """
    cliente_id      = request.GET.get('cliente_id')
    agendamento_id  = request.GET.get('agendamento_id')  # Parâmetro opcional

    if not cliente_id:
        return JsonResponse({'erro': 'ID do cliente não fornecido.'}, status=400)

    try:
        cliente = Cliente.objects.get(id=cliente_id)
    except Cliente.DoesNotExist:
        return JsonResponse({'erro': 'Cliente não encontrado.'}, status=404)
    except ValueError:
        return JsonResponse({'erro': 'ID do cliente inválido.'}, status=400)

    # Monta dados principais do cliente
    cliente_data = {
        'id': cliente.id,
        'nome': cliente.nome,
        'cpf': cliente.cpf,
        'uf': cliente.uf,
        'rjur': cliente.rjur,
        'situacao_funcional': cliente.situacao_funcional,
        'renda_bruta': str(cliente.renda_bruta) if cliente.renda_bruta is not None else None,
        'bruta_5': str(cliente.bruta_5) if cliente.bruta_5 is not None else None,
        'util_5': str(cliente.util_5) if cliente.util_5 is not None else None,
        'saldo_5': str(cliente.saldo_5) if cliente.saldo_5 is not None else None,
        'brutaBeneficio_5': str(cliente.brutaBeneficio_5) if cliente.brutaBeneficio_5 is not None else None,
        'utilBeneficio_5': str(cliente.utilBeneficio_5) if cliente.utilBeneficio_5 is not None else None,
        'saldoBeneficio_5': str(cliente.saldoBeneficio_5) if cliente.saldoBeneficio_5 is not None else None,
        'bruta_35': str(cliente.bruta_35) if cliente.bruta_35 is not None else None,
        'util_35': str(cliente.util_35) if cliente.util_35 is not None else None,
        'saldo_35': str(cliente.saldo_35) if cliente.saldo_35 is not None else None,
        'total_util': str(cliente.total_util) if cliente.total_util is not None else None,
        'total_saldo': str(cliente.total_saldo) if cliente.total_saldo is not None else None,
    }

    # Busca débitos apenas de campanhas ativas
    debitos = Debito.objects.filter(
        cliente=cliente,
        campanha__status=True
    ).select_related('campanha__setor')

    lista_debitos = []
    for d in debitos:
        lista_debitos.append({
            'id': d.id,
            'matricula': d.matricula,
            'banco': d.banco,
            'orgao': d.orgao,
            'rebrica': d.rebrica,
            'parcela': str(d.parcela) if d.parcela is not None else None,
            'prazo_restante': d.prazo_restante,
            'tipo_contrato': d.tipo_contrato,
            'num_contrato': d.num_contrato,
            'campanha': {
                'id': d.campanha.id,
                'nome': d.campanha.nome,
                # usa o campo correto 'setor' em vez de 'departamento'
                'setor': {
                    'id': d.campanha.setor.id,
                    'nome': d.campanha.setor.nome
                }
            }
        })

    # Busca telefones do cliente
    telefones = TelefoneCliente.objects.filter(
        cliente=cliente,
        ativo=True
    ).select_related('usuario_cadastro', 'agendamento_origem').order_by('-principal', '-data_cadastro')
    
    lista_telefones = []
    for tel in telefones:
        try:
            funcionario = Funcionario.objects.get(usuario=tel.usuario_cadastro)
            nome_usuario = funcionario.apelido or funcionario.nome_completo.split()[0]
        except:
            nome_usuario = tel.usuario_cadastro.username if tel.usuario_cadastro else 'Sistema'
        
        telefone_data = {
            'id': tel.id,
            'numero': tel.numero,
            'tipo': tel.tipo,
            'tipo_display': tel.get_tipo_display(),
            'origem': tel.origem,
            'origem_display': tel.get_origem_display(),
            'principal': tel.principal,
            'data_cadastro': tel.data_cadastro.strftime('%d/%m/%Y %H:%M'),
            'usuario_cadastro': nome_usuario,
            'observacoes': tel.observacoes or '',
            'agendamento_origem_id': tel.agendamento_origem.id if tel.agendamento_origem else None
        }
        lista_telefones.append(telefone_data)

    # Se houver agendamento associado, busca também
    agendamento_data = None
    if agendamento_id:
        try:
            ag = AgendamentoFichaCliente.objects.get(id=agendamento_id, cliente=cliente)
            agendamento_data = {
                'id': ag.id,
                'data': ag.data.strftime('%d/%m/%Y'),
                'hora': ag.hora.strftime('%H:%M'),
                'observacao': ag.observacao or '',
                'telefone_contato': ag.telefone_contato or '',
                'data_criacao': ag.data_criacao.strftime('%d/%m/%Y %H:%M') if ag.data_criacao else None
            }
        except AgendamentoFichaCliente.DoesNotExist:
            # deixa agendamento_data como None
            pass

    return JsonResponse({
        'status': 'sucesso',
        'cliente': cliente_data,
        'debitos': lista_debitos,
        'telefones': lista_telefones,
        'agendamento': agendamento_data
    })

@csrf_exempt
@require_POST
def api_post_confirm_agend(request):
    """
    API para confirmar um agendamento existente
    Recebe: id do agendamento via POST
    Retorna: Mensagem de sucesso ou erro em JSON
    """
    try:
        # Simplificar a obtenção dos dados - usar apenas POST
        agendamento_id = request.POST.get('agendamento_id')
        
        # Verificar se o ID foi fornecido
        if not agendamento_id:
            return JsonResponse({
                'status': 'erro',
                'mensagem': 'ID de agendamento não fornecido'
            }, status=400)
        
        # Buscar o agendamento pelo ID
        try:
            agendamento = AgendamentoFichaCliente.objects.get(id=agendamento_id)
        except AgendamentoFichaCliente.DoesNotExist:
            return JsonResponse({
                'status': 'erro',
                'mensagem': f'Agendamento com ID {agendamento_id} não encontrado'
            }, status=404)
        
        # Atualizar o status para CONFIRMADO
        agendamento.status = 'CONFIRMADO'
        agendamento.save()
        
        # Registrar a confirmação no log
        logger.info(f'Agendamento {agendamento_id} confirmado com sucesso')
        
        # Retornar resposta de sucesso
        return JsonResponse({
            'status': 'sucesso',
            'mensagem': 'Agendamento confirmado com sucesso',
            'agendamento_id': agendamento_id
        })
        
    except Exception as e:
        # Registrar o erro
        logger.error(f'Erro ao confirmar agendamento: {str(e)}')
        
        # Retornar mensagem de erro
        return JsonResponse({
            'status': 'erro',
            'mensagem': f'Erro ao confirmar agendamento: {str(e)}'
        }, status=500)

def get_safe_value(row, column_name, default=''):
    """Obtém um valor de forma segura do DataFrame, lidando com colunas ausentes ou valores nulos."""
    try:
        if column_name not in row:
            print(f"Aviso: Coluna '{column_name}' não encontrada.")
            return default
        
        value = row.get(column_name)
        if value is None or (isinstance(value, str) and value.strip() == '') or pd.isna(value):
            return default
        return value
    except Exception as e:
        print(f"Erro ao obter valor da coluna '{column_name}': {e}")
        return default

# ===== INÍCIO DASHBOARD AGENDAMENTOS =====

@login_required
@require_GET
def api_get_dashboard_agendamentos_overview(request):
    """
    API que retorna dados gerais (cards de estatísticas) do dashboard de agendamentos.
    Permite filtros por data_inicio, data_fim, funcionario_id e status (baseado em tabulações).
    """
    logger.debug("Iniciando api_get_dashboard_agendamentos_overview")
    
    try:
        # Obter parâmetros de filtro
        data_inicio_str = request.GET.get('data_inicio')
        data_fim_str = request.GET.get('data_fim')
        funcionario_id = request.GET.get('funcionario_id')
        status_filtro = request.GET.get('status')

        # Query base de agendamentos - incluir relacionamento com tabulação
        agendamentos_qs = AgendamentoFichaCliente.objects.select_related(
            'cliente', 'usuario', 'tabulacao'
        ).prefetch_related('usuario__funcionario_profile').all()

        # Aplicar filtros
        if data_inicio_str:
            try:
                data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d').date()
                agendamentos_qs = agendamentos_qs.filter(data__gte=data_inicio)
            except ValueError:
                logger.warning(f"Formato de data inválido para data_inicio: {data_inicio_str}")

        if data_fim_str:
            try:
                data_fim = datetime.strptime(data_fim_str, '%Y-%m-%d').date()
                agendamentos_qs = agendamentos_qs.filter(data__lte=data_fim)
            except ValueError:
                logger.warning(f"Formato de data inválido para data_fim: {data_fim_str}")

        if funcionario_id:
            try:
                agendamentos_qs = agendamentos_qs.filter(usuario_id=int(funcionario_id))
            except ValueError:
                logger.warning(f"ID de funcionário inválido: {funcionario_id}")

        if status_filtro:
            # Filtrar por status de tabulação
            agendamentos_qs = agendamentos_qs.filter(tabulacao__status=status_filtro)

        # Calcular estatísticas baseadas nas tabulações
        hoje = timezone.now().date()
        
        # 1. Total tabulados (agendamentos que possuem tabulação)
        total_tabulados = agendamentos_qs.filter(tabulacao__isnull=False).count()
        
        # 2. Tabulados hoje (agendamentos tabulados na data de hoje)
        tabulados_hoje = agendamentos_qs.filter(
            tabulacao__isnull=False,
            tabulacao__data_atualizacao__date=hoje
        ).count()
        
        # 3. Quantidade de Concluído PG
        total_concluidos_pg = agendamentos_qs.filter(tabulacao__status='CONCLUIDO_PG').count()
        
        # 4. Percentual de conversão: dos que foram tabulados, qual % é 'Concluído PG'
        if total_tabulados > 0:
            percentual_conversao = round((total_concluidos_pg / total_tabulados) * 100, 1)
        else:
            percentual_conversao = 0.0

        # Dados para gráficos
        # Distribuição por status de tabulação
        status_counts = {}
        for choice in TabulacaoAgendamento.STATUS_CHOICES:
            status_key = choice[0]
            status_label = choice[1]
            count = agendamentos_qs.filter(tabulacao__status=status_key).count()
            status_counts[status_label] = count
        
        # Adicionar agendamentos sem tabulação como "Em Negociação"
        agendamentos_sem_tabulacao = agendamentos_qs.filter(tabulacao__isnull=True).count()
        if agendamentos_sem_tabulacao > 0:
            status_counts['Em Negociação'] = status_counts.get('Em Negociação', 0) + agendamentos_sem_tabulacao

        # Timeline dos últimos 30 dias (apenas tabulações)
        data_limite = hoje - timedelta(days=30)
        agendamentos_timeline = agendamentos_qs.filter(
            tabulacao__isnull=False,
            tabulacao__data_atualizacao__date__gte=data_limite
        )
        
        timeline_data = {}
        for i in range(30):
            data_atual = hoje - timedelta(days=i)
            count = agendamentos_timeline.filter(tabulacao__data_atualizacao__date=data_atual).count()
            timeline_data[data_atual.strftime('%Y-%m-%d')] = count

        # Top 10 funcionários com mais tabulações e fechamentos
        funcionarios_stats = agendamentos_qs.filter(tabulacao__isnull=False).values('usuario__username', 'usuario_id').annotate(
            total_tabulacoes=Count('id'),
            total_fechamentos=Count('id', filter=Q(tabulacao__status='CONCLUIDO_PG'))
        ).order_by('-total_tabulacoes')[:10]

        # Otimizar: buscar dados dos funcionários de uma vez
        user_ids = [f['usuario_id'] for f in funcionarios_stats]
        try:
            funcionarios_map = Funcionario.objects.filter(
                usuario_id__in=user_ids,
                status=True
            ).select_related('usuario').in_bulk(field_name='usuario_id')
        except:
            funcionarios_map = {}

        funcionarios_data = []
        for stat in funcionarios_stats:
            funcionario = funcionarios_map.get(stat['usuario_id'])
            if funcionario:
                nome = funcionario.apelido if funcionario.apelido else funcionario.nome_completo.split()[0]
            else:
                nome = stat['usuario__username']
            funcionarios_data.append({
                'nome': nome,
                'total_agendamentos': stat['total_tabulacoes'],  # Agora representa tabulações
                'total_fechamentos': stat['total_fechamentos']
            })

        # Horários mais tabulados
        horarios_stats = agendamentos_qs.filter(tabulacao__isnull=False).extra(
            select={'hora_formatada': "DATE_FORMAT(hora, '%%H:00')"}
        ).values('hora_formatada').annotate(
            total=Count('id')
        ).order_by('-total')[:10]

        data_response = {
            'cards': {
                'total_tabulados': total_tabulados,
                'tabulados_hoje': tabulados_hoje,
                'percentual_conversao': percentual_conversao,
                'total_concluidos_pg': total_concluidos_pg
            },
            'graficos': {
                'status_distribuicao': status_counts,
                'timeline': dict(sorted(timeline_data.items())),
                'top_funcionarios': funcionarios_data,
                'horarios_populares': list(horarios_stats)
            }
        }

        logger.debug("Dados do dashboard de agendamentos obtidos com sucesso")
        return JsonResponse(data_response)

    except Exception as e:
        logger.error(f"Erro em api_get_dashboard_agendamentos_overview: {type(e).__name__} - {e}")
        logger.exception("Detalhes do erro em api_get_dashboard_agendamentos_overview:")
        return JsonResponse({'error': 'Ocorreu um erro ao buscar dados do dashboard.'}, status=500)

@login_required
@require_GET
def api_get_agendamentos_detalhes(request):
    """
    API que retorna lista detalhada de agendamentos com paginação.
    Permite filtros por data_inicio, data_fim, funcionario_id, status, equipe_id, setor_id, cliente_nome e cliente_cpf.
    """
    logger.debug("Iniciando api_get_agendamentos_detalhes")
    
    try:
        # Parâmetros de paginação
        page = int(request.GET.get('page', 1))
        per_page = int(request.GET.get('per_page', 20))
        
        # Parâmetros de filtro
        data_inicio_str = request.GET.get('data_inicio')
        data_fim_str = request.GET.get('data_fim')
        funcionario_id = request.GET.get('funcionario_id')
        status_filtro = request.GET.get('status')
        equipe_id = request.GET.get('equipe_id')
        setor_id = request.GET.get('setor_id')
        cliente_nome = request.GET.get('cliente_nome', '').strip()
        cliente_cpf = request.GET.get('cliente_cpf', '').strip()

        # Query base com otimizações
        agendamentos_qs = AgendamentoFichaCliente.objects.select_related(
            'cliente', 'usuario', 'tabulacao'
        ).all().order_by('-data', '-hora')

        # Aplicar filtros
        if data_inicio_str:
            try:
                data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d').date()
                agendamentos_qs = agendamentos_qs.filter(data__gte=data_inicio)
            except ValueError:
                pass

        if data_fim_str:
            try:
                data_fim = datetime.strptime(data_fim_str, '%Y-%m-%d').date()
                agendamentos_qs = agendamentos_qs.filter(data__lte=data_fim)
            except ValueError:
                pass

        if funcionario_id:
            try:
                agendamentos_qs = agendamentos_qs.filter(usuario_id=int(funcionario_id))
            except ValueError:
                pass

        if status_filtro:
            # Filtrar por status de tabulação
            agendamentos_qs = agendamentos_qs.filter(tabulacao__status=status_filtro)

        if equipe_id:
            try:
                # Usar o relacionamento direto com funcionario_profile
                agendamentos_qs = agendamentos_qs.filter(usuario__funcionario_profile__equipe_id=int(equipe_id))
            except (ValueError, AttributeError):
                pass

        if setor_id:
            try:
                # Usar o relacionamento direto com funcionario_profile
                agendamentos_qs = agendamentos_qs.filter(usuario__funcionario_profile__setor_id=int(setor_id))
            except (ValueError, AttributeError):
                pass

        if cliente_nome:
            agendamentos_qs = agendamentos_qs.filter(cliente__nome__icontains=cliente_nome)

        if cliente_cpf:
            # Remover formatação do CPF
            cpf_limpo = ''.join(filter(str.isdigit, cliente_cpf))
            if cpf_limpo:
                agendamentos_qs = agendamentos_qs.filter(cliente__cpf__icontains=cpf_limpo)

        # Paginação manual
        total_items = agendamentos_qs.count()
        total_pages = (total_items + per_page - 1) // per_page
        
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        
        agendamentos_pagina = agendamentos_qs[start_index:end_index]

        # Otimizar: buscar dados dos funcionários de uma vez
        user_ids = [ag.usuario_id for ag in agendamentos_pagina]
        funcionarios_map = Funcionario.objects.filter(
            usuario_id__in=user_ids
        ).select_related('usuario', 'equipe', 'setor').in_bulk(field_name='usuario_id')

        # Preparar dados dos agendamentos
        agendamentos_data = []
        for agendamento in agendamentos_pagina:
            funcionario = funcionarios_map.get(agendamento.usuario_id)
            nome_funcionario = funcionario.apelido if funcionario and funcionario.apelido else agendamento.usuario.username
            equipe_nome = funcionario.equipe.nome if funcionario and funcionario.equipe else 'N/A'
            setor_nome = funcionario.setor.nome if funcionario and funcionario.setor else 'N/A'

            # Obter status de tabulação ou padrão "Em Negociação"
            if hasattr(agendamento, 'tabulacao') and agendamento.tabulacao:
                status_tabulacao = agendamento.tabulacao.status
                status_display = agendamento.tabulacao.get_status_display()
            else:
                status_tabulacao = 'EM_NEGOCIACAO'
                status_display = 'Em Negociação'

            agendamentos_data.append({
                'id': agendamento.id,
                'data': agendamento.data.strftime('%d/%m/%Y'),
                'hora': agendamento.hora.strftime('%H:%M'),
                'cliente': {
                    'id': agendamento.cliente.id,
                    'nome': agendamento.cliente.nome,
                    'cpf': agendamento.cliente.cpf,
                    'renda_bruta': format_currency(agendamento.cliente.renda_bruta) if agendamento.cliente.renda_bruta else 'N/A',
                    'total_saldo': format_currency(agendamento.cliente.total_saldo) if agendamento.cliente.total_saldo else 'N/A'
                },
                'funcionario': {
                    'id': agendamento.usuario_id,
                    'nome': nome_funcionario,
                    'equipe': equipe_nome,
                    'setor': setor_nome
                },
                'status': status_tabulacao,
                'status_display': status_display,
                'observacao': agendamento.observacao or '',
                'data_criacao': agendamento.data_criacao.strftime('%d/%m/%Y %H:%M')
            })

        response_data = {
            'agendamentos': agendamentos_data,
            'paginacao': {
                'pagina_atual': page,
                'total_paginas': total_pages,
                'total_items': total_items,
                'items_por_pagina': per_page,
                'tem_proxima': page < total_pages,
                'tem_anterior': page > 1
            }
        }

        logger.debug(f"Lista de agendamentos obtida com sucesso - Página {page}/{total_pages}")
        return JsonResponse(response_data)

    except Exception as e:
        logger.error(f"Erro em api_get_agendamentos_detalhes: {type(e).__name__} - {e}")
        logger.exception("Detalhes do erro em api_get_agendamentos_detalhes:")
        return JsonResponse({'error': 'Ocorreu um erro ao buscar os agendamentos.'}, status=500)

@login_required
@require_GET
def api_get_funcionarios_lista(request):
    """
    API que retorna lista de funcionários do setor SIAPE para filtros.
    """
    logger.debug("Iniciando api_get_funcionarios_lista")
    
    try:
        # Buscar funcionários ativos do setor SIAPE
        funcionarios = Funcionario.objects.filter(
            status=True,
            setor__nome='SIAPE',
            usuario__isnull=False
        ).select_related('usuario', 'setor').values(
            'usuario_id',
            'nome_completo',
            'apelido',
            'usuario__username'
        ).order_by('nome_completo')

        funcionarios_data = []
        for func in funcionarios:
            nome_display = func['apelido'] if func['apelido'] else func['nome_completo'].split()[0]
            funcionarios_data.append({
                'id': func['usuario_id'],
                'nome': nome_display,
                'username': func['usuario__username']
            })

        logger.debug(f"Lista de funcionários SIAPE obtida com sucesso - {len(funcionarios_data)} funcionários")
        return JsonResponse({'funcionarios': funcionarios_data})

    except Exception as e:
        logger.error(f"Erro em api_get_funcionarios_lista: {type(e).__name__} - {e}")
        logger.exception("Detalhes do erro em api_get_funcionarios_lista:")
        return JsonResponse({'error': 'Ocorreu um erro ao buscar lista de funcionários.'}, status=500)

@login_required
@require_GET
def api_get_relatorio_agendamentos(request):
    """
    API para gerar relatório de agendamentos em formato de exportação.
    Retorna dados para geração de Excel via frontend.
    """
    logger.debug("Iniciando api_get_relatorio_agendamentos")
    
    try:
        # Parâmetros de filtro
        data_inicio_str = request.GET.get('data_inicio')
        data_fim_str = request.GET.get('data_fim')
        funcionario_id = request.GET.get('funcionario_id')
        status_filtro = request.GET.get('status')

        # Query base com todas as otimizações
        agendamentos_qs = AgendamentoFichaCliente.objects.select_related(
            'cliente', 'usuario', 'tabulacao'
        ).all().order_by('-data', '-hora')

        # Aplicar filtros
        if data_inicio_str:
            try:
                data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d').date()
                agendamentos_qs = agendamentos_qs.filter(data__gte=data_inicio)
            except ValueError:
                pass

        if data_fim_str:
            try:
                data_fim = datetime.strptime(data_fim_str, '%Y-%m-%d').date()
                agendamentos_qs = agendamentos_qs.filter(data__lte=data_fim)
            except ValueError:
                pass

        if funcionario_id:
            try:
                agendamentos_qs = agendamentos_qs.filter(usuario_id=int(funcionario_id))
            except ValueError:
                pass

        if status_filtro:
            # Filtrar por status de tabulação
            agendamentos_qs = agendamentos_qs.filter(tabulacao__status=status_filtro)

        # Buscar dados dos funcionários de uma vez
        user_ids = [ag.usuario_id for ag in agendamentos_qs]
        funcionarios_map = Funcionario.objects.filter(
            usuario_id__in=user_ids
        ).select_related('usuario').in_bulk(field_name='usuario_id')

        # Preparar dados para exportação
        relatorio_data = []
        for agendamento in agendamentos_qs:
            funcionario = funcionarios_map.get(agendamento.usuario_id)
            nome_funcionario = funcionario.apelido if funcionario and funcionario.apelido else agendamento.usuario.username
            
            # Obter status de tabulação ou padrão "Em Negociação"
            if hasattr(agendamento, 'tabulacao') and agendamento.tabulacao:
                status_display = agendamento.tabulacao.get_status_display()
            else:
                status_display = 'Em Negociação'

            relatorio_data.append({
                'Data': agendamento.data.strftime('%d/%m/%Y'),
                'Hora': agendamento.hora.strftime('%H:%M'),
                'Cliente': agendamento.cliente.nome,
                'CPF': agendamento.cliente.cpf,
                'UF': agendamento.cliente.uf or '',
                'Situação Funcional': agendamento.cliente.situacao_funcional or '',
                'Renda Bruta': str(agendamento.cliente.renda_bruta) if agendamento.cliente.renda_bruta else '0,00',
                'Saldo Total': str(agendamento.cliente.total_saldo) if agendamento.cliente.total_saldo else '0,00',
                'Funcionário': nome_funcionario,
                'Status': status_display,
                'Observação': agendamento.observacao or '',
                'Data Criação': agendamento.data_criacao.strftime('%d/%m/%Y %H:%M')
            })

        logger.debug(f"Relatório de agendamentos gerado com sucesso - {len(relatorio_data)} registros")
        return JsonResponse({
            'relatorio': relatorio_data,
            'total_registros': len(relatorio_data),
            'filtros_aplicados': {
                'data_inicio': data_inicio_str,
                'data_fim': data_fim_str,
                'funcionario_id': funcionario_id,
                'status': status_filtro
            }
        })

    except Exception as e:
        logger.error(f"Erro em api_get_relatorio_agendamentos: {type(e).__name__} - {e}")
        logger.exception("Detalhes do erro em api_get_relatorio_agendamentos:")
        return JsonResponse({'error': 'Ocorreu um erro ao gerar o relatório.'}, status=500)

# ===== FIM DASHBOARD AGENDAMENTOS =====

@csrf_exempt
@require_POST
@login_required
def api_post_editar_observacao_agendamento(request):
    """
    API para editar observação de um agendamento
    """
    try:
        data = json.loads(request.body)
        agendamento_id = data.get('agendamento_id')
        nova_observacao = data.get('observacao', '')
        
        agendamento = get_object_or_404(AgendamentoFichaCliente, id=agendamento_id)
        agendamento.observacao = nova_observacao
        agendamento.save()
        
        return JsonResponse({
            'message': 'Observação atualizada com sucesso!',
            'result': True
        })
        
    except Exception as e:
        logger.error(f"Erro ao editar observação do agendamento: {str(e)}")
        return JsonResponse({
            'message': f'Erro ao editar observação: {str(e)}',
            'result': False
        }, status=400)


# SISTEMA DE TABULAÇÃO

@login_required
@require_GET
def api_get_tabulacao_cliente(request):
    """
    API para obter a tabulação de agendamentos de um cliente
    """
    try:
        cpf = request.GET.get('cpf')
        agendamento_id = request.GET.get('agendamento_id')
        
        if not cpf:
            return JsonResponse({
                'message': 'CPF é obrigatório',
                'result': False
            }, status=400)
        
        cpf_normalizado = normalize_cpf(cpf)
        if not cpf_normalizado:
            return JsonResponse({
                'message': 'CPF inválido',
                'result': False
            }, status=400)
        
        try:
            cliente = Cliente.objects.get(cpf=cpf_normalizado)
        except Cliente.DoesNotExist:
            return JsonResponse({
                'message': 'Cliente não encontrado',
                'result': False
            }, status=404)
        
        # Se agendamento_id foi fornecido, busca tabulação específica do agendamento
        if agendamento_id:
            try:
                agendamento = AgendamentoFichaCliente.objects.get(id=agendamento_id, cliente=cliente)
                tabulacao_atual = getattr(agendamento, 'tabulacao', None)
                agendamentos_cliente = [agendamento]
            except AgendamentoFichaCliente.DoesNotExist:
                return JsonResponse({
                    'message': 'Agendamento não encontrado',
                    'result': False
                }, status=404)
        else:
            # Busca todos os agendamentos do cliente
            agendamentos_cliente = AgendamentoFichaCliente.objects.filter(cliente=cliente).order_by('-data', '-hora')
            tabulacao_atual = None
            # Pega a tabulação do último agendamento que tem tabulação
            for agend in agendamentos_cliente:
                if hasattr(agend, 'tabulacao'):
                    tabulacao_atual = agend.tabulacao
                    break
        
        # Busca histórico de tabulações do cliente (através de agendamentos)
        historico = HistoricoTabulacaoAgendamento.objects.filter(
            agendamento__cliente=cliente
        ).select_related('usuario', 'agendamento')[:10]  # Últimas 10 alterações
        
        historico_data = []
        for item in historico:
            try:
                funcionario = Funcionario.objects.get(usuario=item.usuario)
                nome_usuario = funcionario.apelido or funcionario.nome_completo.split()[0]
            except:
                nome_usuario = item.usuario.username if item.usuario else 'Sistema'
            
            historico_data.append({
                'status_anterior': dict(TabulacaoAgendamento.STATUS_CHOICES).get(item.status_anterior, 'Novo'),
                'status_novo': dict(TabulacaoAgendamento.STATUS_CHOICES).get(item.status_novo),
                'usuario': nome_usuario,
                'data_alteracao': item.data_alteracao.strftime('%d/%m/%Y %H:%M'),
                'observacoes': item.observacoes or '',
                'agendamento_data': item.agendamento.data.strftime('%d/%m/%Y') if item.agendamento else 'N/A'
            })
        
        # Verifica se o usuário atual pode editar e determina as opções de status
        try:
            funcionario = Funcionario.objects.get(usuario=request.user)
            cargo = funcionario.cargo
            eh_coordenador = cargo and cargo.hierarquia <= 3
        except:
            eh_coordenador = False
            
        if eh_coordenador:
            pode_editar = True
            status_choices = TabulacaoAgendamento.STATUS_CHOICES
        else:
            pode_editar = tabulacao_atual.pode_ser_editada_por_consultor() if tabulacao_atual else True
            if tabulacao_atual:
                status_choices = tabulacao_atual.get_status_choices_para_consultor()
            else:
                # Se não há tabulação, oferece opções básicas para consultor
                status_choices = [
                    ('SEM_RESPOSTA', 'Sem Resposta'),
                    ('EM_NEGOCIACAO', 'Em Negociação'),
                    ('REVERSAO', 'Reversão'),
                    ('CHECAGEM', 'Checagem'),
                    ('CONCLUIDO_PG', 'Concluído PG'),
                ]
        
        # Dados dos agendamentos do cliente
        agendamentos_data = []
        for agend in agendamentos_cliente:
            tem_tabulacao = hasattr(agend, 'tabulacao')
            agendamentos_data.append({
                'id': agend.id,
                'data': agend.data.strftime('%d/%m/%Y'),
                'hora': agend.hora.strftime('%H:%M'),
                'status': agend.status,
                'tem_tabulacao': tem_tabulacao,
                'tabulacao_status': agend.tabulacao.get_status_display() if tem_tabulacao else None,
                'tabulacao_status_code': agend.tabulacao.status if tem_tabulacao else None
            })
        
        return JsonResponse({
            'result': True,
            'data': {
                'cliente': {
                    'nome': cliente.nome,
                    'cpf': cliente.cpf
                },
                'agendamentos': agendamentos_data,
                'tabulacao_atual': {
                    'agendamento_id': tabulacao_atual.agendamento.id if tabulacao_atual else None,
                    'status': tabulacao_atual.status if tabulacao_atual else None,
                    'status_display': tabulacao_atual.get_status_display() if tabulacao_atual else None,
                    'observacoes': tabulacao_atual.observacoes or '' if tabulacao_atual else '',
                    'data_atualizacao': tabulacao_atual.data_atualizacao.strftime('%d/%m/%Y %H:%M') if tabulacao_atual else None,
                    'pode_editar': pode_editar
                } if tabulacao_atual else None,
                'historico': historico_data,
                'status_choices': status_choices
            }
        })
        
    except Exception as e:
        logger.error(f"Erro ao buscar tabulação do cliente: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


@csrf_exempt
@require_POST
@login_required
def api_post_atualizar_tabulacao(request):
    """
    API para atualizar ou criar tabulação de um agendamento específico
    """
    try:
        data = json.loads(request.body)
        # Aceita tanto 'agendamento_id' quanto 'id' para compatibilidade
        agendamento_id = data.get('agendamento_id') or data.get('id')
        novo_status = data.get('status')
        observacoes = data.get('observacoes', '')
        
        # Log dos dados recebidos para debug
        logger.info(f"Dados recebidos na API atualizar tabulação: {data}")
        logger.info(f"agendamento_id: {agendamento_id}, novo_status: {novo_status}")
        
        if not agendamento_id or not novo_status:
            logger.error(f"Campos obrigatórios ausentes - agendamento_id: {agendamento_id}, status: {novo_status}")
            return JsonResponse({
                'message': 'ID do agendamento e status são obrigatórios',
                'result': False,
                'debug': {
                    'agendamento_id_recebido': agendamento_id,
                    'status_recebido': novo_status,
                    'dados_completos': data
                }
            }, status=400)
        
        try:
            agendamento = AgendamentoFichaCliente.objects.get(id=agendamento_id)
        except AgendamentoFichaCliente.DoesNotExist:
            return JsonResponse({
                'message': 'Agendamento não encontrado',
                'result': False
            }, status=404)
        
        # Verifica se o status é válido globalmente
        status_validos_global = [choice[0] for choice in TabulacaoAgendamento.STATUS_CHOICES]
        if novo_status not in status_validos_global:
            return JsonResponse({
                'message': f'Status inválido: "{novo_status}"',
                'result': False
            }, status=400)
        
        # Busca tabulação atual do agendamento
        tabulacao_atual = getattr(agendamento, 'tabulacao', None)
        
        # Verifica permissões
        try:
            funcionario = Funcionario.objects.get(usuario=request.user)
            cargo = funcionario.cargo
            eh_coordenador = cargo and cargo.hierarquia <= 3
        except:
            eh_coordenador = False
        
        # Verifica se é coordenador ou pode editar
        if not eh_coordenador:
            if tabulacao_atual and not tabulacao_atual.pode_ser_editada_por_consultor():
                return JsonResponse({
                    'message': 'Você não tem permissão para alterar esta tabulação. Entre em contato com seu coordenador.',
                    'result': False
                }, status=403)
            
            # Verifica se o consultor pode usar este status específico
            if tabulacao_atual:
                status_permitidos = [choice[0] for choice in tabulacao_atual.get_status_choices_para_consultor()]
            else:
                status_permitidos = ['SEM_RESPOSTA', 'EM_NEGOCIACAO', 'REVERSAO', 'CHECAGEM', 'CONCLUIDO_PG']
                
            if novo_status not in status_permitidos:
                return JsonResponse({
                    'message': f'Você não tem permissão para usar o status "{dict(TabulacaoAgendamento.STATUS_CHOICES).get(novo_status, novo_status)}". Entre em contato com seu coordenador.',
                    'result': False
                }, status=403)
                
            # Verifica regra específica para CONCLUIDO_PG
            if novo_status == 'CONCLUIDO_PG' and tabulacao_atual:
                if not tabulacao_atual.pode_mover_para_concluido_pg():
                    return JsonResponse({
                        'message': 'Só é possível mover para "Concluído PG" após passar por "Revertido" ou "Checagem OK".',
                        'result': False
                    }, status=403)
        
        status_anterior = tabulacao_atual.status if tabulacao_atual else None
        
        with transaction.atomic():
            if tabulacao_atual:
                # Atualiza tabulação existente
                tabulacao_atual.status = novo_status
                tabulacao_atual.observacoes = observacoes
                tabulacao_atual.usuario_responsavel = request.user
                tabulacao_atual.save()
            else:
                # Cria nova tabulação para o agendamento
                tabulacao_atual = TabulacaoAgendamento.objects.create(
                    agendamento=agendamento,
                    status=novo_status,
                    observacoes=observacoes,
                    usuario_responsavel=request.user
                )
            
            # Registra no histórico
            HistoricoTabulacaoAgendamento.objects.create(
                agendamento=agendamento,
                status_anterior=status_anterior,
                status_novo=novo_status,
                usuario=request.user,
                observacoes=observacoes
            )

            # --- Criação do HorarioChecagem se for CHECAGEM ou REVERSAO ---
            if novo_status in ["CHECAGEM", "REVERSAO"]:
                coordenador_id = data.get("coordenador_id")
                data_checagem = data.get("data_checagem")  # Esperado: 'DD/MM/YYYY'
                hora_checagem = data.get("hora_checagem")  # Esperado: 'HH:MM'
                observacao_checagem = data.get("observacao_checagem", "")
                from datetime import datetime
                from apps.siape.models import HorarioChecagem
                if coordenador_id and data_checagem and hora_checagem:
                    try:
                        coordenador = User.objects.get(id=coordenador_id)
                        # Converte data e hora
                        data_dt = datetime.strptime(data_checagem, "%d/%m/%Y").date()
                        hora_dt = datetime.strptime(hora_checagem, "%H:%M").time()
                        # Evita duplicidade para o mesmo agendamento/tabulacao/data/hora/coordenador
                        existe = HorarioChecagem.objects.filter(
                            agendamento=agendamento,
                            tabulacao=tabulacao_atual,
                            data=data_dt,
                            hora=hora_dt,
                            coordenador=coordenador
                        ).exists()
                        if not existe:
                            HorarioChecagem.objects.create(
                                coordenador=coordenador,
                                consultor=request.user,
                                agendamento=agendamento,
                                tabulacao=tabulacao_atual,
                                data=data_dt,
                                hora=hora_dt,
                                observacao_consultor=observacao_checagem,
                                status_checagem="EM_ESPERA",
                                status=True
                            )
                    except Exception as e:
                        logger.error(f"Erro ao criar HorarioChecagem: {str(e)}")
        
        return JsonResponse({
            'message': 'Tabulação atualizada com sucesso!',
            'result': True
        })
        
    except json.JSONDecodeError as e:
        logger.error(f"Erro ao decodificar JSON: {str(e)}")
        return JsonResponse({
            'message': 'Dados JSON inválidos',
            'result': False,
            'debug': {
                'raw_body': request.body.decode('utf-8') if request.body else 'Vazio',
                'error': str(e)
            }
        }, status=400)
    except Exception as e:
        logger.error(f"Erro ao atualizar tabulação: {str(e)}")
        logger.exception("Detalhes do erro:")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


# SISTEMA DE DADOS DE NEGOCIAÇÃO

@login_required
@require_GET
def api_get_dados_negociacao(request):
    """
    API para obter dados de negociação de um agendamento
    """
    try:
        agendamento_id = request.GET.get('agendamento_id')
        if not agendamento_id:
            return JsonResponse({
                'message': 'ID do agendamento é obrigatório',
                'result': False
            }, status=400)
        
        try:
            agendamento = AgendamentoFichaCliente.objects.get(id=agendamento_id)
        except AgendamentoFichaCliente.DoesNotExist:
            return JsonResponse({
                'message': 'Agendamento não encontrado',
                'result': False
            }, status=404)
        
        # Busca dados de negociação existentes
        dados_negociacao = None
        try:
            tabulacao = agendamento.tabulacao
            dados_negociacao = DadosNegociacao.objects.filter(
                agendamento=agendamento,
                tabulacao=tabulacao,
                status=True
            ).first()
        except:
            pass
        
        # Busca arquivos se existir dados de negociação
        arquivos_data = []
        if dados_negociacao:
            arquivos = ArquivoNegociacao.objects.filter(
                dados_negociacao=dados_negociacao,
                status=True
            ).order_by('-data_criacao')
            
            for arquivo in arquivos:
                arquivos_data.append({
                    'id': arquivo.id,
                    'titulo_arquivo': arquivo.titulo_arquivo,
                    'arquivo_url': arquivo.arquivo.url if arquivo.arquivo else '',
                    'tamanho_arquivo': arquivo.get_tamanho_arquivo(),
                    'data_criacao': arquivo.data_criacao.strftime('%d/%m/%Y %H:%M')
                })
        
        dados = {}
        if dados_negociacao:
            dados = {
                'id': dados_negociacao.id,
                'banco_nome': dados_negociacao.banco_nome or '',
                'valor_liberado': str(dados_negociacao.valor_liberado) if dados_negociacao.valor_liberado else '',
                'saldo_devedor': str(dados_negociacao.saldo_devedor) if dados_negociacao.saldo_devedor else '',
                'parcela_atual': str(dados_negociacao.parcela_atual) if dados_negociacao.parcela_atual else '',
                'parcela_nova': str(dados_negociacao.parcela_nova) if dados_negociacao.parcela_nova else '',
                'tc': str(dados_negociacao.tc) if dados_negociacao.tc else '',
                'troco': str(dados_negociacao.troco) if dados_negociacao.troco else '',
                'prazo_atual': dados_negociacao.prazo_atual or '',
                'prazo_acordado': dados_negociacao.prazo_acordado or '',
                'descricao': dados_negociacao.descricao or '',
                'data_criacao': dados_negociacao.data_criacao.strftime('%d/%m/%Y %H:%M'),
                'data_ultima_modificacao': dados_negociacao.data_ultima_modificacao.strftime('%d/%m/%Y %H:%M')
            }
        
        return JsonResponse({
            'result': True,
            'data': {
                'agendamento': {
                    'id': agendamento.id,
                    'cliente_nome': agendamento.cliente.nome,
                    'cliente_cpf': agendamento.cliente.cpf,
                    'data': agendamento.data.strftime('%d/%m/%Y'),
                    'hora': agendamento.hora.strftime('%H:%M')
                },
                'dados_negociacao': dados,
                'arquivos': arquivos_data,
                'existe_dados': dados_negociacao is not None
            }
        })
        
    except Exception as e:
        logger.error(f"Erro ao buscar dados de negociação: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


@csrf_exempt
@require_POST
@login_required
def api_post_salvar_dados_negociacao(request):
    """
    API para salvar dados de negociação (chamada quando tabulação é CHECAGEM)
    """
    try:
        data = json.loads(request.body)
        logger.info(f"Dados recebidos para salvar negociação: {data}")
        
        agendamento_id = data.get('agendamento_id')
        if not agendamento_id:
            return JsonResponse({
                'message': 'ID do agendamento é obrigatório',
                'result': False
            }, status=400)
        
        try:
            agendamento = AgendamentoFichaCliente.objects.get(id=agendamento_id)
            tabulacao = agendamento.tabulacao
        except AgendamentoFichaCliente.DoesNotExist:
            return JsonResponse({
                'message': 'Agendamento não encontrado',
                'result': False
            }, status=404)
        except:
            return JsonResponse({
                'message': 'Tabulação não encontrada para este agendamento',
                'result': False
            }, status=404)
        
        # Verifica se consultor pode editar
        try:
            funcionario = Funcionario.objects.get(usuario=request.user)
            eh_coordenador = funcionario.cargo and funcionario.cargo.hierarquia <= 3
        except:
            eh_coordenador = False
        
        if not eh_coordenador and tabulacao.status == 'CHECAGEM':
            # Consultor só pode editar se tiver permissão
            consultor_hierarquia = getattr(funcionario, 'cargo', None)
            if consultor_hierarquia and consultor_hierarquia.hierarquia in [1, 2]:  # ESTAGIO ou PADRAO
                pass  # Pode prosseguir
            else:
                return JsonResponse({
                    'message': 'Apenas consultores podem adicionar dados de negociação quando status é CHECAGEM',
                    'result': False
                }, status=403)
        
        # Busca ou cria dados de negociação
        dados_negociacao, created = DadosNegociacao.objects.get_or_create(
            agendamento=agendamento,
            tabulacao=tabulacao,
            defaults={'status': True}
        )
        
        # Atualiza os campos
        dados_negociacao.banco_nome = data.get('banco_nome', '').strip()
        
        # Converte valores monetários
        valor_liberado = data.get('valor_liberado', '').strip()
        if valor_liberado:
            dados_negociacao.valor_liberado = Decimal(valor_liberado.replace(',', '.'))
        else:
            dados_negociacao.valor_liberado = None
            
        saldo_devedor = data.get('saldo_devedor', '').strip()
        if saldo_devedor:
            dados_negociacao.saldo_devedor = Decimal(saldo_devedor.replace(',', '.'))
        else:
            dados_negociacao.saldo_devedor = None
            
        parcela_atual = data.get('parcela_atual', '').strip()
        if parcela_atual:
            dados_negociacao.parcela_atual = Decimal(parcela_atual.replace(',', '.'))
        else:
            dados_negociacao.parcela_atual = None
            
        parcela_nova = data.get('parcela_nova', '').strip()
        if parcela_nova:
            dados_negociacao.parcela_nova = Decimal(parcela_nova.replace(',', '.'))
        else:
            dados_negociacao.parcela_nova = None
            
        tc = data.get('tc', '').strip()
        if tc:
            dados_negociacao.tc = Decimal(tc.replace(',', '.'))
        else:
            dados_negociacao.tc = None
            
        troco = data.get('troco', '').strip()
        if troco:
            dados_negociacao.troco = Decimal(troco.replace(',', '.'))
        else:
            dados_negociacao.troco = None
        
        # Converte valores inteiros
        prazo_atual = data.get('prazo_atual', '').strip()
        if prazo_atual:
            dados_negociacao.prazo_atual = int(prazo_atual)
        else:
            dados_negociacao.prazo_atual = None
            
        prazo_acordado = data.get('prazo_acordado', '').strip()
        if prazo_acordado:
            dados_negociacao.prazo_acordado = int(prazo_acordado)
        else:
            dados_negociacao.prazo_acordado = None
        
        dados_negociacao.descricao = data.get('descricao', '').strip()
        
        dados_negociacao.full_clean()  # Executa validações do modelo
        dados_negociacao.save()
        
        message = 'Dados de negociação criados com sucesso!' if created else 'Dados de negociação atualizados com sucesso!'
        
        return JsonResponse({
            'message': message,
            'result': True,
            'dados_negociacao_id': dados_negociacao.id
        })
        
    except json.JSONDecodeError as e:
        return JsonResponse({
            'message': 'Dados JSON inválidos',
            'result': False
        }, status=400)
    except ValidationError as e:
        return JsonResponse({
            'message': f'Erro de validação: {str(e)}',
            'result': False
        }, status=400)
    except Exception as e:
        logger.error(f"Erro ao salvar dados de negociação: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


@csrf_exempt
@require_POST
@login_required
def api_post_upload_arquivo_negociacao(request):
    """
    API para upload de arquivo(s) de negociação
    Aceita tanto upload individual quanto múltiplo
    """
    try:
        print(f"[DEBUG] Upload arquivo negociação - POST data: {list(request.POST.keys())}")
        print(f"[DEBUG] Upload arquivo negociação - FILES data: {list(request.FILES.keys())}")
        
        # Modo 1: Upload individual com dados_negociacao_id (modo original)
        dados_negociacao_id = request.POST.get('dados_negociacao_id')
        
        # Modo 2: Upload múltiplo com agendamento_id (novo modo)
        agendamento_id = request.POST.get('agendamento_id')
        
        # Determina o modo de operação
        if dados_negociacao_id:
            # Modo original: upload individual
            print(f"[DEBUG] Modo individual - dados_negociacao_id: {dados_negociacao_id}")
            
            titulo_arquivo = request.POST.get('titulo_arquivo')
            arquivo = request.FILES.get('arquivo')
            
            if not all([dados_negociacao_id, titulo_arquivo, arquivo]):
                return JsonResponse({
                    'message': 'ID dos dados de negociação, título e arquivo são obrigatórios',
                    'result': False
                }, status=400)
            
            try:
                dados_negociacao = DadosNegociacao.objects.get(id=dados_negociacao_id)
            except DadosNegociacao.DoesNotExist:
                return JsonResponse({
                    'message': 'Dados de negociação não encontrados',
                    'result': False
                }, status=404)
            
            # Verifica o tamanho do arquivo (máximo 20MB)
            if arquivo.size > 20 * 1024 * 1024:
                return JsonResponse({
                    'message': 'Arquivo muito grande. Máximo permitido: 20MB',
                    'result': False
                }, status=400)
            
            arquivo_negociacao = ArquivoNegociacao.objects.create(
                dados_negociacao=dados_negociacao,
                titulo_arquivo=titulo_arquivo,
                arquivo=arquivo
            )
            
            return JsonResponse({
                'message': 'Arquivo enviado com sucesso!',
                'result': True,
                'arquivo': {
                    'id': arquivo_negociacao.id,
                    'titulo_arquivo': arquivo_negociacao.titulo_arquivo,
                    'arquivo_url': arquivo_negociacao.arquivo.url,
                    'tamanho_arquivo': arquivo_negociacao.get_tamanho_arquivo(),
                    'data_criacao': arquivo_negociacao.data_criacao.strftime('%d/%m/%Y %H:%M')
                }
            })
            
        elif agendamento_id:
            # Modo novo: upload múltiplo via agendamento_id
            print(f"[DEBUG] Modo múltiplo - agendamento_id: {agendamento_id}")
            
            try:
                agendamento = AgendamentoFichaCliente.objects.get(id=agendamento_id)
                print(f"[DEBUG] Agendamento encontrado: {agendamento}")
            except AgendamentoFichaCliente.DoesNotExist:
                return JsonResponse({
                    'message': 'Agendamento não encontrado',
                    'result': False
                }, status=404)
            
            # Busca os dados de negociação relacionados ao agendamento
            try:
                dados_negociacao = DadosNegociacao.objects.filter(agendamento=agendamento).first()
                if not dados_negociacao:
                    return JsonResponse({
                        'message': 'Dados de negociação não encontrados para este agendamento. Salve os dados de negociação primeiro.',
                        'result': False
                    }, status=400)
                print(f"[DEBUG] Dados negociação encontrados: {dados_negociacao.id}")
            except Exception as e:
                print(f"[DEBUG] Erro ao buscar dados negociação: {str(e)}")
                return JsonResponse({
                    'message': f'Erro ao buscar dados de negociação: {str(e)}',
                    'result': False
                }, status=400)
            
            # Processa múltiplos arquivos
            arquivos = request.FILES.getlist('arquivos')
            if not arquivos:
                return JsonResponse({
                    'message': 'Nenhum arquivo foi enviado',
                    'result': False
                }, status=400)
            
            arquivos_criados = []
            
            for i, arquivo in enumerate(arquivos):
                # Verifica o tamanho do arquivo (máximo 20MB)
                if arquivo.size > 20 * 1024 * 1024:
                    return JsonResponse({
                        'message': f'Arquivo "{arquivo.name}" muito grande. Máximo permitido: 20MB',
                        'result': False
                    }, status=400)
                
                # Cria título do arquivo baseado no nome
                titulo_arquivo = arquivo.name
                
                try:
                    arquivo_negociacao = ArquivoNegociacao.objects.create(
                        dados_negociacao=dados_negociacao,
                        titulo_arquivo=titulo_arquivo,
                        arquivo=arquivo
                    )
                    
                    arquivos_criados.append({
                        'id': arquivo_negociacao.id,
                        'titulo_arquivo': arquivo_negociacao.titulo_arquivo,
                        'arquivo_url': arquivo_negociacao.arquivo.url,
                        'tamanho_arquivo': arquivo_negociacao.get_tamanho_arquivo(),
                        'data_criacao': arquivo_negociacao.data_criacao.strftime('%d/%m/%Y %H:%M')
                    })
                    
                    print(f"[DEBUG] Arquivo {i+1} criado com sucesso: {arquivo_negociacao.id}")
                    
                except Exception as e:
                    print(f"[DEBUG] Erro ao criar arquivo {i+1}: {str(e)}")
                    return JsonResponse({
                        'message': f'Erro ao salvar arquivo "{arquivo.name}": {str(e)}',
                        'result': False
                    }, status=500)
            
            return JsonResponse({
                'message': f'{len(arquivos_criados)} arquivo(s) enviado(s) com sucesso!',
                'result': True,
                'arquivos': arquivos_criados,
                'total_arquivos': len(arquivos_criados)
            })
        
        else:
            return JsonResponse({
                'message': 'É necessário fornecer dados_negociacao_id ou agendamento_id',
                'result': False
            }, status=400)
        
    except Exception as e:
        print(f"[DEBUG] Erro geral em api_post_upload_arquivo_negociacao: {str(e)}")
        import traceback
        print(f"[DEBUG] Traceback: {traceback.format_exc()}")
        logger.error(f"Erro ao fazer upload de arquivo de negociação: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


# SISTEMA DE DOCUMENTOS

@login_required
@require_GET
def api_get_documentos_cliente(request):
    """
    API para obter documentos de um cliente
    """
    try:
        cpf = request.GET.get('cpf')
        if not cpf:
            return JsonResponse({
                'message': 'CPF é obrigatório',
                'result': False
            }, status=400)
        
        cpf_normalizado = normalize_cpf(cpf)
        if not cpf_normalizado:
            return JsonResponse({
                'message': 'CPF inválido',
                'result': False
            }, status=400)
        
        try:
            cliente = Cliente.objects.get(cpf=cpf_normalizado)
        except Cliente.DoesNotExist:
            return JsonResponse({
                'message': 'Cliente não encontrado',
                'result': False
            }, status=404)
        
        documentos = DocumentoCliente.objects.filter(
            cliente=cliente,
            ativo=True
        ).select_related('usuario_upload').order_by('-data_upload')
        
        documentos_data = []
        for doc in documentos:
            try:
                funcionario = Funcionario.objects.get(usuario=doc.usuario_upload)
                nome_usuario = funcionario.apelido or funcionario.nome_completo.split()[0]
            except:
                nome_usuario = doc.usuario_upload.username if doc.usuario_upload else 'Sistema'
            
            documentos_data.append({
                'id': doc.id,
                'nome_documento': doc.nome_documento,
                'tipo_documento': doc.tipo_documento,
                'tipo_documento_display': doc.get_tipo_documento_display(),
                'arquivo_url': doc.arquivo.url if doc.arquivo else '',
                'data_upload': doc.data_upload.strftime('%d/%m/%Y %H:%M'),
                'usuario_upload': nome_usuario,
                'observacoes': doc.observacoes or ''
            })
        
        return JsonResponse({
            'result': True,
            'data': {
                'cliente': {
                    'nome': cliente.nome,
                    'cpf': cliente.cpf
                },
                'documentos': documentos_data,
                'tipos_documento': DocumentoCliente.TIPO_DOCUMENTO_CHOICES
            }
        })
        
    except Exception as e:
        logger.error(f"Erro ao buscar documentos do cliente: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


@csrf_exempt
@require_POST
@login_required
def api_post_upload_documento(request):
    """
    API para upload de documento do cliente
    """
    try:
        cpf = request.POST.get('cpf')
        nome_documento = request.POST.get('nome_documento')
        tipo_documento = request.POST.get('tipo_documento')
        observacoes = request.POST.get('observacoes', '')
        arquivo = request.FILES.get('arquivo')
        
        if not all([cpf, nome_documento, tipo_documento, arquivo]):
            return JsonResponse({
                'message': 'CPF, nome do documento, tipo e arquivo são obrigatórios',
                'result': False
            }, status=400)
        
        cpf_normalizado = normalize_cpf(cpf)
        if not cpf_normalizado:
            return JsonResponse({
                'message': 'CPF inválido',
                'result': False
            }, status=400)
        
        try:
            cliente = Cliente.objects.get(cpf=cpf_normalizado)
        except Cliente.DoesNotExist:
            return JsonResponse({
                'message': 'Cliente não encontrado',
                'result': False
            }, status=404)
        
        # Verifica se o tipo de documento é válido
        tipos_validos = [choice[0] for choice in DocumentoCliente.TIPO_DOCUMENTO_CHOICES]
        if tipo_documento not in tipos_validos:
            return JsonResponse({
                'message': 'Tipo de documento inválido',
                'result': False
            }, status=400)
        
        # Verifica o tamanho do arquivo (máximo 10MB)
        if arquivo.size > 10 * 1024 * 1024:
            return JsonResponse({
                'message': 'Arquivo muito grande. Máximo permitido: 10MB',
                'result': False
            }, status=400)
        
        documento = DocumentoCliente.objects.create(
            cliente=cliente,
            nome_documento=nome_documento,
            tipo_documento=tipo_documento,
            arquivo=arquivo,
            observacoes=observacoes,
            usuario_upload=request.user
        )
        
        return JsonResponse({
            'message': 'Documento enviado com sucesso!',
            'result': True,
            'documento_id': documento.id
        })
        
    except Exception as e:
        logger.error(f"Erro ao fazer upload do documento: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


# SISTEMA DE TELEFONES

@login_required
@require_GET
def api_get_telefones_cliente(request):
    """
    API para obter telefones de um cliente
    """
    try:
        cpf = request.GET.get('cpf')
        if not cpf:
            return JsonResponse({
                'message': 'CPF é obrigatório',
                'result': False
            }, status=400)
        
        cpf_normalizado = normalize_cpf(cpf)
        if not cpf_normalizado:
            return JsonResponse({
                'message': 'CPF inválido',
                'result': False
            }, status=400)
        
        try:
            cliente = Cliente.objects.get(cpf=cpf_normalizado)
        except Cliente.DoesNotExist:
            return JsonResponse({
                'message': 'Cliente não encontrado',
                'result': False
            }, status=404)
        
        telefones = TelefoneCliente.objects.filter(
            cliente=cliente,
            ativo=True
        ).select_related('usuario_cadastro').order_by('-principal', '-data_cadastro')
        
        telefones_data = []
        for tel in telefones:
            try:
                funcionario = Funcionario.objects.get(usuario=tel.usuario_cadastro)
                nome_usuario = funcionario.apelido or funcionario.nome_completo.split()[0]
            except:
                nome_usuario = tel.usuario_cadastro.username if tel.usuario_cadastro else 'Sistema'
            
            telefones_data.append({
                'id': tel.id,
                'numero': tel.numero,
                'tipo': tel.tipo,
                'tipo_display': tel.get_tipo_display(),
                'origem': tel.origem,
                'origem_display': tel.get_origem_display(),
                'principal': tel.principal,
                'data_cadastro': tel.data_cadastro.strftime('%d/%m/%Y %H:%M'),
                'usuario_cadastro': nome_usuario,
                'observacoes': tel.observacoes or '',
                'agendamento_origem_id': tel.agendamento_origem.id if tel.agendamento_origem else None
            })
        
        return JsonResponse({
            'result': True,
            'data': {
                'cliente': {
                    'nome': cliente.nome,
                    'cpf': cliente.cpf
                },
                'telefones': telefones_data,
                'tipos_telefone': TelefoneCliente.TIPO_CHOICES,
                'origens_telefone': TelefoneCliente.ORIGEM_CHOICES
            }
        })
        
    except Exception as e:
        logger.error(f"Erro ao buscar telefones do cliente: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


@csrf_exempt
@require_POST
@login_required
def api_post_adicionar_telefone(request):
    """
    API para adicionar telefone do cliente
    """
    try:
        data = json.loads(request.body)
        cpf = data.get('cpf')
        numero = data.get('numero')
        tipo = data.get('tipo', 'CELULAR')
        origem = data.get('origem', 'OUTROS')
        principal = data.get('principal', False)
        observacoes = data.get('observacoes', '')
        
        if not cpf or not numero:
            return JsonResponse({
                'message': 'CPF e número são obrigatórios',
                'result': False
            }, status=400)
        
        cpf_normalizado = normalize_cpf(cpf)
        if not cpf_normalizado:
            return JsonResponse({
                'message': 'CPF inválido',
                'result': False
            }, status=400)
        
        try:
            cliente = Cliente.objects.get(cpf=cpf_normalizado)
        except Cliente.DoesNotExist:
            return JsonResponse({
                'message': 'Cliente não encontrado',
                'result': False
            }, status=404)
        
        # Verifica se o tipo é válido
        tipos_validos = [choice[0] for choice in TelefoneCliente.TIPO_CHOICES]
        if tipo not in tipos_validos:
            return JsonResponse({
                'message': 'Tipo de telefone inválido',
                'result': False
            }, status=400)
        
        # Verifica se a origem é válida
        origens_validas = [choice[0] for choice in TelefoneCliente.ORIGEM_CHOICES]
        if origem not in origens_validas:
            return JsonResponse({
                'message': 'Origem do telefone inválida',
                'result': False
            }, status=400)
        
        # Remove formatação do número
        numero_limpo = ''.join(filter(str.isdigit, numero))
        
        # Verifica se já existe este número para o cliente
        if TelefoneCliente.objects.filter(cliente=cliente, numero=numero, ativo=True).exists():
            return JsonResponse({
                'message': 'Este número já está cadastrado para o cliente',
                'result': False
            }, status=400)
        
        with transaction.atomic():
            # Se for principal, remove o principal anterior
            if principal:
                TelefoneCliente.objects.filter(
                    cliente=cliente,
                    principal=True,
                    ativo=True
                ).update(principal=False)
            
            telefone = TelefoneCliente.objects.create(
                cliente=cliente,
                numero=numero,
                tipo=tipo,
                origem=origem,
                principal=principal,
                observacoes=observacoes,
                usuario_cadastro=request.user
            )
        
        return JsonResponse({
            'message': 'Telefone adicionado com sucesso!',
            'result': True,
            'telefone_id': telefone.id
        })
        
    except Exception as e:
        logger.error(f"Erro ao adicionar telefone: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


@csrf_exempt
@require_POST
@login_required
def api_post_remover_telefone(request):
    """
    API para remover telefone do cliente
    """
    try:
        data = json.loads(request.body)
        telefone_id = data.get('telefone_id')
        
        if not telefone_id:
            return JsonResponse({
                'message': 'ID do telefone é obrigatório',
                'result': False
            }, status=400)
        
        try:
            telefone = TelefoneCliente.objects.get(id=telefone_id, ativo=True)
        except TelefoneCliente.DoesNotExist:
            return JsonResponse({
                'message': 'Telefone não encontrado',
                'result': False
            }, status=404)
        
        # Marca como inativo ao invés de deletar
        telefone.ativo = False
        telefone.save()
        
        return JsonResponse({
            'message': 'Telefone removido com sucesso!',
            'result': True
        })
        
    except Exception as e:
        logger.error(f"Erro ao remover telefone: {str(e)}")
        return JsonResponse({
            'message': f'Erro interno: {str(e)}',
            'result': False
        }, status=500)


# APIs do CRM Kanban

def verificar_permissao_kanban(user):
    """
    Verifica se o usuário pode ver todos os agendamentos ou apenas os próprios.
    Retorna:
    - True: pode ver todos (superuser, coordenador, supervisor geral, gestor, gerente, franqueado)
    - False: pode ver apenas os próprios (estágio, padrão)
    """
    try:
        # Superuser sempre pode ver todos
        if user.is_superuser:
            return True
        
        # Busca o funcionário associado ao usuário
        funcionario = Funcionario.objects.select_related('cargo').get(usuario=user, status=True)
        
        if not funcionario.cargo:
            # Sem cargo definido, aplica regra restritiva
            return False
        
        # Cargos que podem ver todos os agendamentos (hierarquia 3 e acima)
        cargos_supervisores = [
            Cargo.HierarquiaChoices.COORDENADOR,      # 3
            Cargo.HierarquiaChoices.GERENTE,          # 4
            Cargo.HierarquiaChoices.FRANQUEADO,       # 5
            Cargo.HierarquiaChoices.SUPERVISOR_GERAL, # 6
            Cargo.HierarquiaChoices.GESTOR,           # 7
        ]
        
        # Cargos que veem apenas próprios agendamentos (hierarquia 1 e 2)
        cargos_restritos = [
            Cargo.HierarquiaChoices.ESTAGIO,  # 1
            Cargo.HierarquiaChoices.PADRAO,   # 2
        ]
        
        if funcionario.cargo.hierarquia in cargos_restritos:
            return False
        
        return funcionario.cargo.hierarquia in cargos_supervisores
        
    except Funcionario.DoesNotExist:
        # Usuário sem funcionário associado, aplica regra restritiva
        return False
    except Exception as e:
        logger.error(f"Erro ao verificar permissão kanban para usuário {user.username}: {str(e)}")
        return False

@login_required
@require_GET
def api_get_kanban_dados(request):
    """
    Retorna dados para o CRM Kanban organizados por tabulação.
    Aplica filtros de permissão baseados no cargo do usuário:
    - Estágio/Padrão: vê apenas próprios agendamentos
    - Coordenador/Supervisor/Gestor/Superuser: vê todos
    """
    try:
        logger.info(f"Iniciando carregamento Kanban para usuário: {request.user.username}")
        
        # Verificar permissões do usuário
        pode_ver_todos = verificar_permissao_kanban(request.user)
        logger.info(f"Usuário pode ver todos: {pode_ver_todos}")
        
        # Filtros opcionais
        data_inicio = request.GET.get('data_inicio')
        data_fim = request.GET.get('data_fim')
        funcionario_id = request.GET.get('funcionario_id')
        
        # Consulta base dos agendamentos - busca TODOS os agendamentos primeiro
        agendamentos_base_query = AgendamentoFichaCliente.objects.select_related(
            'cliente', 
            'usuario'
        )
        
        logger.info(f"Total de agendamentos no sistema: {agendamentos_base_query.count()}")
        
        # Aplicar filtro de permissão por cargo
        if not pode_ver_todos:
            # Usuários com cargo ESTAGIO ou PADRAO só veem próprios agendamentos
            agendamentos_base_query = agendamentos_base_query.filter(usuario=request.user)
            logger.info(f"Filtrado para usuário atual: {agendamentos_base_query.count()} agendamentos")
        
        # Aplicar filtros opcionais se fornecidos
        if data_inicio:
            agendamentos_base_query = agendamentos_base_query.filter(data__gte=data_inicio)
            logger.info(f"Filtrado por data início: {agendamentos_base_query.count()} agendamentos")
        if data_fim:
            agendamentos_base_query = agendamentos_base_query.filter(data__lte=data_fim)
            logger.info(f"Filtrado por data fim: {agendamentos_base_query.count()} agendamentos")
        if funcionario_id and pode_ver_todos:
            # Só aplica filtro de funcionário se o usuário pode ver todos
            agendamentos_base_query = agendamentos_base_query.filter(usuario_id=funcionario_id)
            logger.info(f"Filtrado por funcionário: {agendamentos_base_query.count()} agendamentos")
        
        # Organizar dados por status de tabulação
        kanban_data = {}
        
        # Verificar quantos agendamentos têm tabulação no total
        total_agendamentos_com_tabulacao = agendamentos_base_query.filter(tabulacao__isnull=False).count()
        logger.info(f"Total de agendamentos com tabulação (filtrados): {total_agendamentos_com_tabulacao}")
        
        # Verificar no sistema inteiro
        total_tabulacoes_sistema = TabulacaoAgendamento.objects.count()
        logger.info(f"Total de tabulações no sistema: {total_tabulacoes_sistema}")
        
        # Buscar todos os agendamentos que têm tabulação
        agendamentos_com_tabulacao = agendamentos_base_query.filter(
            tabulacao__isnull=False  # Filtro direto para agendamentos com tabulação
        ).select_related('tabulacao', 'cliente').order_by('-data', '-hora')
        
        logger.info(f"Total de agendamentos com tabulação encontrados: {agendamentos_com_tabulacao.count()}")
        
        # Processar cada agendamento individualmente
        cards_processados = 0
        for agendamento in agendamentos_com_tabulacao:
            try:
                cliente = agendamento.cliente
                tabulacao = agendamento.tabulacao
                status = tabulacao.status
                
                logger.info(f"Processando agendamento {agendamento.id} - Cliente: {cliente.nome} - Status: {status}")
                
                if status not in kanban_data:
                    kanban_data[status] = {
                        'nome': dict(TabulacaoAgendamento.STATUS_CHOICES).get(status, status),
                        'cards': []
                    }
            
                # Buscar números adicionais do cliente
                telefones = list(TelefoneCliente.objects.filter(
                    cliente=cliente,
                    ativo=True
                ).values_list('numero', flat=True))
                
                # Buscar horário de checagem ativo para este agendamento específico
                horario_checagem = None
                try:
                    from apps.siape.models import HorarioChecagem
                    horario_checagem = HorarioChecagem.objects.filter(
                        agendamento=agendamento,
                        status=True,
                        status_checagem__in=['EM_ESPERA', 'EM_ANDAMENTO']
                    ).order_by('data', 'hora').first()
                except Exception as e:
                    logger.warning(f"Erro ao buscar horário de checagem para agendamento {agendamento.id}: {str(e)}")
                
                # Buscar dados de negociação (valor TC) se existir
                valor_tc = None
                try:
                    dados_negociacao = DadosNegociacao.objects.filter(
                        agendamento=agendamento,
                        status=True
                    ).order_by('-data_criacao').first()
                    
                    if dados_negociacao and dados_negociacao.tc and dados_negociacao.tc > 0:
                        valor_tc = float(dados_negociacao.tc)
                        logger.info(f"TC encontrado para agendamento {agendamento.id}: R$ {valor_tc}")
                except Exception as e:
                    logger.warning(f"Erro ao buscar dados de negociação para agendamento {agendamento.id}: {str(e)}")
                
                # Dados do card
                card_data = {
                    'id': f"{tabulacao.id}_{agendamento.id}",
                    'tabulacao_id': tabulacao.id,
                    'agendamento_id': agendamento.id,
                    'cliente_nome': cliente.nome or 'Nome não informado',
                    'cliente_cpf': cliente.cpf or 'CPF não informado',
                    'tabulacao_status': status,
                    'tabulacao_nome': dict(TabulacaoAgendamento.STATUS_CHOICES).get(status, status),
                    'observacoes': tabulacao.observacoes or '',
                    'data_agendamento': agendamento.data.strftime('%d/%m/%Y') if agendamento.data else '',
                    'hora_agendamento': agendamento.hora.strftime('%H:%M') if agendamento.hora else '',
                    'status_agendamento': agendamento.status,
                    'funcionario_nome': getattr(agendamento.usuario, 'username', 'N/A'),
                    'renda_bruta': float(cliente.renda_bruta or 0),
                    'total_saldo': float(cliente.total_saldo or 0),
                    'uf': cliente.uf or '',
                    'situacao_funcional': cliente.situacao_funcional or '',
                    'telefones': telefones,
                    'data_atualizacao': tabulacao.data_atualizacao.strftime('%d/%m/%Y %H:%M') if tabulacao.data_atualizacao else '',
                    # Valor TC se existir e for > 0
                    'valor_tc': valor_tc,
                    'cores': {
                        'EM_NEGOCIACAO': '#3498db',
                        'ANALISANDO_PROPOSTA': '#f39c12',
                        'ESPERANDO_DOCUMENTOS': '#e74c3c',
                        'REVERSAO': '#9b59b6',
                        'VENDA_DIGITADA': '#2ecc71',
                        'CHECAGEM': '#34495e',
                        'FINALIZADA': '#27ae60'
                    }.get(status, '#95a5a6'),
                    # Dados do horário de checagem
                    'horario_checagem': {
                        'existe': horario_checagem is not None,
                        'data': horario_checagem.data.strftime('%d/%m/%Y') if horario_checagem else None,
                        'hora': horario_checagem.hora.strftime('%H:%M') if horario_checagem else None,
                        'data_hora_raw': horario_checagem.data.strftime('%Y-%m-%d') + ' ' + horario_checagem.hora.strftime('%H:%M:%S') if horario_checagem else None,
                        'coordenador': getattr(horario_checagem.coordenador, 'username', '') if horario_checagem else None,
                        'status_checagem': horario_checagem.status_checagem if horario_checagem else None
                    } if horario_checagem else {
                        'existe': False,
                        'data': None,
                        'hora': None,
                        'data_hora_raw': None,
                        'coordenador': None,
                        'status_checagem': None
                    }
                }
                
                kanban_data[status]['cards'].append(card_data)
                cards_processados += 1
                logger.info(f"Card criado para agendamento {agendamento.id} - Cliente: {cliente.nome} - Status: {status}")
                
            except Exception as e:
                logger.error(f"Erro ao processar agendamento {agendamento.id}: {str(e)}")
                continue
        
        # Informações adicionais sobre o usuário
        info_usuario = {
            'username': request.user.username,
            'is_superuser': request.user.is_superuser,
            'cargo': None,
            'hierarquia': None
        }
        
        try:
            funcionario = Funcionario.objects.select_related('cargo').get(usuario=request.user, status=True)
            if funcionario.cargo:
                info_usuario['cargo'] = funcionario.cargo.nome
                info_usuario['hierarquia'] = funcionario.cargo.hierarquia
        except Funcionario.DoesNotExist:
            pass
        
        # Ordenação especial para colunas REVERSAO e CHECAGEM
        for status in ['REVERSAO', 'CHECAGEM']:
            if status in kanban_data:
                cards = kanban_data[status]['cards']
                
                # Separar cards com e sem horário de checagem
                cards_com_horario = [card for card in cards if card['horario_checagem']['existe']]
                cards_sem_horario = [card for card in cards if not card['horario_checagem']['existe']]
                
                # Ordenar cards com horário por data/hora do horário de checagem (mais antigo primeiro)
                cards_com_horario.sort(key=lambda x: x['horario_checagem']['data_hora_raw'])
                
                # Ordenar cards sem horário por data do agendamento
                cards_sem_horario.sort(key=lambda x: x['data_agendamento'], reverse=True)
                
                # Juntar: primeiro os com horário (do mais antigo para mais recente)
                # depois os sem horário (do mais recente para mais antigo)
                kanban_data[status]['cards'] = cards_com_horario + cards_sem_horario
                
                logger.info(f"Coluna {status} reordenada: {len(cards_com_horario)} com horário, {len(cards_sem_horario)} sem horário")

        logger.info(f"Total de cards processados: {cards_processados}")
        logger.info(f"Colunas no kanban_data: {list(kanban_data.keys())}")
        for status, coluna in kanban_data.items():
            logger.info(f"Coluna {status}: {len(coluna['cards'])} cards")
        
        return JsonResponse({
            'success': True,
            'data': kanban_data,
            'permissoes': {
                'pode_ver_todos': pode_ver_todos,
                'pode_filtrar_funcionario': pode_ver_todos,
                'usuario_atual': request.user.username,
                'info_usuario': info_usuario
            }
        })
        
    except Exception as e:
        logger.error(f"Erro ao buscar dados do Kanban: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({
            'success': False,
            'message': f'Erro interno: {str(e)}'
        })

@login_required
@require_GET
def api_get_kanban_teste(request):
    """
    Rota de teste para debug do Kanban
    """
    try:
        # Contar dados básicos
        total_agendamentos = AgendamentoFichaCliente.objects.count()
        total_tabulacoes = TabulacaoAgendamento.objects.count()
        total_clientes = Cliente.objects.count()
        
        # Agendamentos do usuário atual
        meus_agendamentos = AgendamentoFichaCliente.objects.filter(usuario=request.user).count()
        
        # Agendamentos com tabulação
        agendamentos_com_tabulacao = AgendamentoFichaCliente.objects.filter(tabulacao__isnull=False).count()
        
        # Agendamentos SEM tabulação
        agendamentos_sem_tabulacao = AgendamentoFichaCliente.objects.filter(tabulacao__isnull=True).count()
        
        # Verificar permissões
        pode_ver_todos = verificar_permissao_kanban(request.user)
        
        dados = {
            'total_agendamentos': total_agendamentos,
            'total_tabulacoes': total_tabulacoes,
            'total_clientes': total_clientes,
            'meus_agendamentos': meus_agendamentos,
            'agendamentos_com_tabulacao': agendamentos_com_tabulacao,
            'agendamentos_sem_tabulacao': agendamentos_sem_tabulacao,
            'pode_ver_todos': pode_ver_todos,
            'usuario': request.user.username,
            'is_superuser': request.user.is_superuser
        }
        
        return JsonResponse({
            'success': True,
            'dados': dados
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': str(e)
        })

@csrf_exempt
@require_POST
@login_required
def api_post_mover_card_kanban(request):
    """
    Move um card entre colunas do Kanban (atualiza status da tabulação)
    """
    try:
        data = json.loads(request.body)
        tabulacao_id = data.get('tabulacao_id')
        novo_status = data.get('novo_status')
        observacoes = data.get('observacoes', '')
        
        if not tabulacao_id or not novo_status:
            return JsonResponse({
                'success': False,
                'message': 'ID da tabulação e novo status são obrigatórios'
            })
        
        # Verificar se o status é válido
        status_validos = [choice[0] for choice in TabulacaoAgendamento.STATUS_CHOICES]
        if novo_status not in status_validos:
            return JsonResponse({
                'success': False,
                'message': 'Status inválido'
            })
        
        tabulacao = get_object_or_404(TabulacaoAgendamento, id=tabulacao_id)
        
        # Verificar permissões do usuário
        pode_ver_todos = verificar_permissao_kanban(request.user)
        
        if not pode_ver_todos:
            # Usuários com cargo ESTAGIO ou PADRAO só podem mover próprios agendamentos
            if tabulacao.agendamento.usuario != request.user:
                return JsonResponse({
                    'success': False,
                    'message': 'Você não tem permissão para mover este card'
                })
            
            # Verificar restrições de hierarquia para usuários ESTAGIO e PADRAO
            try:
                funcionario = Funcionario.objects.select_related('cargo').get(usuario=request.user, status=True)
                if funcionario.cargo and funcionario.cargo.hierarquia in [Cargo.HierarquiaChoices.ESTAGIO, Cargo.HierarquiaChoices.PADRAO]:
                    status_origem = tabulacao.status
                    
                    # Restrição 1: Não pode mover PARA status restritos
                    if novo_status in ['REVERSAO', 'CHECAGEM', 'REVERTIDO', 'CHECAGEM_OK', 'DESISTIU']:
                        status_nome = dict(TabulacaoAgendamento.STATUS_CHOICES).get(novo_status, novo_status)
                        
                        if novo_status in ['REVERSAO', 'CHECAGEM']:
                            message = f'Para adicionar a {status_nome.lower()} deve usar o formulário em consulta cliente.'
                        else:
                            message = f'Apenas superiores podem mover cards para {status_nome.lower()}.'
                            
                        return JsonResponse({
                            'success': False,
                            'message': message,
                            'restricao_hierarquia': True
                        })
                    
                    # Restrição 2: Não pode mover DE REVERSAO ou CHECAGEM para qualquer lugar
                    if status_origem in ['REVERSAO', 'CHECAGEM']:
                        status_origem_nome = dict(TabulacaoAgendamento.STATUS_CHOICES).get(status_origem, status_origem)
                        return JsonResponse({
                            'success': False,
                            'message': f'Apenas superiores podem mover cards que estão em {status_origem_nome.lower()}.',
                            'restricao_hierarquia': True
                        })
                    
                    # Restrição 3: Não pode mover DE DESISTIU para qualquer lugar
                    if status_origem == 'DESISTIU':
                        return JsonResponse({
                            'success': False,
                            'message': 'Cards em "Desistiu" não podem ser movidos para nenhum outro status.',
                            'restricao_hierarquia': True
                        })
                    
                    # Restrição 4: DE REVERTIDO/CHECAGEM_OK pode mover, mas não para REVERSAO/CHECAGEM
                    if status_origem in ['REVERTIDO', 'CHECAGEM_OK'] and novo_status in ['REVERSAO', 'CHECAGEM']:
                        status_nome = dict(TabulacaoAgendamento.STATUS_CHOICES).get(novo_status, novo_status)
                        return JsonResponse({
                            'success': False,
                            'message': f'Para mover para {status_nome.lower()} deve usar o formulário em consulta cliente.',
                            'restricao_hierarquia': True
                        })
            except Funcionario.DoesNotExist:
                pass
        
        # Salvar histórico
        HistoricoTabulacaoAgendamento.objects.create(
            agendamento=tabulacao.agendamento,
            status_anterior=tabulacao.status,
            status_novo=novo_status,
            usuario=request.user,
            observacoes=f"Movido via CRM Kanban. {observacoes}".strip()
        )
        
        # Atualizar tabulação
        tabulacao.status = novo_status
        if observacoes:
            tabulacao.observacoes = observacoes
        tabulacao.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Card movido com sucesso'
        })
        
    except Exception as e:
        logger.error(f"Erro ao mover card do Kanban: {str(e)}")
        return JsonResponse({
            'success': False,
            'message': f'Erro interno: {str(e)}'
        })

@login_required
@require_GET
def api_get_detalhes_card_kanban(request):
    """
    Retorna detalhes completos de um card do Kanban
    """
    try:
        tabulacao_id = request.GET.get('tabulacao_id')
        agendamento_id = request.GET.get('agendamento_id')
        
        if not tabulacao_id or not agendamento_id:
            return JsonResponse({
                'success': False,
                'message': 'IDs da tabulação e agendamento são obrigatórios'
            })
        
        tabulacao = get_object_or_404(TabulacaoAgendamento.objects.select_related('agendamento__cliente'), id=tabulacao_id)
        agendamento = get_object_or_404(AgendamentoFichaCliente.objects.select_related('usuario'), id=agendamento_id)
        
        # Verificar permissões do usuário
        pode_ver_todos = verificar_permissao_kanban(request.user)
        
        if not pode_ver_todos:
            # Usuários com cargo ESTAGIO ou PADRAO só podem ver detalhes dos próprios agendamentos
            if agendamento.usuario != request.user:
                return JsonResponse({
                    'success': False,
                    'message': 'Você não tem permissão para ver detalhes deste card'
                })
        
        # Buscar dados completos do cliente
        cliente = tabulacao.agendamento.cliente
        
        # Telefones
        telefones = TelefoneCliente.objects.filter(cliente=cliente, ativo=True).values(
            'numero', 'tipo', 'principal'
        )
        
        # Documentos
        documentos = DocumentoCliente.objects.filter(cliente=cliente, ativo=True).values(
            'nome_documento', 'tipo_documento', 'data_upload'
        )
        
        # Dados de negociação
        dados_negociacao = None
        arquivos_negociacao = []
        try:
            # Buscar dados_negociacao por agendamento e status=True (independente da tabulação)
            dados_negociacao = DadosNegociacao.objects.filter(
                agendamento=agendamento,
                status=True
            ).order_by('-data_criacao').first()
            # Buscar arquivos se existir dados de negociação (qualquer status)
            if dados_negociacao:
                arquivos = ArquivoNegociacao.objects.filter(
                    dados_negociacao=dados_negociacao,
                    status=True
                ).order_by('-data_criacao')
                for arquivo in arquivos:
                    arquivos_negociacao.append({
                        'id': arquivo.id,
                        'titulo_arquivo': arquivo.titulo_arquivo,
                        'arquivo_url': arquivo.arquivo.url if arquivo.arquivo else '',
                        'tamanho_arquivo': arquivo.get_tamanho_arquivo(),
                        'data_criacao': arquivo.data_criacao.strftime('%d/%m/%Y %H:%M')
                    })
        except Exception as e:
            logger.warning(f"Erro ao buscar arquivos de negociação: {str(e)}")
        
        # Histórico de tabulações (apenas para superusers)
        historico_data = []
        if request.user.is_superuser:
            historico = HistoricoTabulacaoAgendamento.objects.filter(agendamento__cliente=cliente).select_related('usuario', 'agendamento').order_by('-data_alteracao')[:10]
            
            for hist in historico:
                historico_data.append({
                    'status_anterior': dict(TabulacaoAgendamento.STATUS_CHOICES).get(hist.status_anterior, hist.status_anterior),
                    'status_novo': dict(TabulacaoAgendamento.STATUS_CHOICES).get(hist.status_novo, hist.status_novo),
                    'usuario': hist.usuario.username if hist.usuario else 'Sistema',
                    'data_alteracao': hist.data_alteracao.strftime('%d/%m/%Y %H:%M'),
                    'observacoes': hist.observacoes or '',
                    'agendamento_data': hist.agendamento.data.strftime('%d/%m/%Y') if hist.agendamento else 'N/A'
                })
        
        dados_completos = {
            'cliente': {
                'nome': cliente.nome or 'Nome não informado',
                'cpf': cliente.cpf or 'CPF não informado',
                'uf': cliente.uf or '',
                'rjur': cliente.rjur or '',
                'situacao_funcional': cliente.situacao_funcional or '',
                'renda_bruta': float(cliente.renda_bruta or 0),
                'bruta_5': float(cliente.bruta_5 or 0),
                'util_5': float(cliente.util_5 or 0),
                'saldo_5': float(cliente.saldo_5 or 0),
                'bruta_35': float(cliente.bruta_35 or 0),
                'util_35': float(cliente.util_35 or 0),
                'saldo_35': float(cliente.saldo_35 or 0),
                'total_util': float(cliente.total_util or 0),
                'total_saldo': float(cliente.total_saldo or 0)
            },
            'agendamento': {
                'data': agendamento.data.strftime('%d/%m/%Y') if agendamento.data else '',
                'hora': agendamento.hora.strftime('%H:%M') if agendamento.hora else '',
                'status': agendamento.status,
                'status_nome': dict(AgendamentoFichaCliente.STATUS_CHOICES).get(agendamento.status, agendamento.status),
                'observacao': agendamento.observacao or '',
                'funcionario': agendamento.usuario.username if agendamento.usuario else 'N/A',
                'data_criacao': agendamento.data_criacao.strftime('%d/%m/%Y %H:%M') if agendamento.data_criacao else ''
            },
            'tabulacao': {
                'status': tabulacao.status,
                'status_nome': dict(TabulacaoAgendamento.STATUS_CHOICES).get(tabulacao.status, tabulacao.status),
                'observacoes': tabulacao.observacoes or '',
                'data_atualizacao': tabulacao.data_atualizacao.strftime('%d/%m/%Y %H:%M') if tabulacao.data_atualizacao else '',
                'usuario_responsavel': tabulacao.usuario_responsavel.username if tabulacao.usuario_responsavel else 'N/A'
            },
            'telefones': list(telefones),
            'documentos': list(documentos),
            'historico': historico_data,
            'dados_negociacao': {
                'existe': dados_negociacao is not None,
                'banco_nome': dados_negociacao.banco_nome if dados_negociacao else '',
                'valor_liberado': float(dados_negociacao.valor_liberado) if dados_negociacao and dados_negociacao.valor_liberado else 0,
                'saldo_devedor': float(dados_negociacao.saldo_devedor) if dados_negociacao and dados_negociacao.saldo_devedor else 0,
                'parcela_atual': float(dados_negociacao.parcela_atual) if dados_negociacao and dados_negociacao.parcela_atual else 0,
                'parcela_nova': float(dados_negociacao.parcela_nova) if dados_negociacao and dados_negociacao.parcela_nova else 0,
                'tc': float(dados_negociacao.tc) if dados_negociacao and dados_negociacao.tc else 0,
                'troco': float(dados_negociacao.troco) if dados_negociacao and dados_negociacao.troco else 0,
                'prazo_atual': dados_negociacao.prazo_atual if dados_negociacao else 0,
                'prazo_acordado': dados_negociacao.prazo_acordado if dados_negociacao else 0,
                'descricao': dados_negociacao.descricao if dados_negociacao else '',
                'data_criacao': dados_negociacao.data_criacao.strftime('%d/%m/%Y %H:%M') if dados_negociacao else '',
                'data_ultima_modificacao': dados_negociacao.data_ultima_modificacao.strftime('%d/%m/%Y %H:%M') if dados_negociacao else '',
                'arquivos': arquivos_negociacao
            },
            'permissoes': {
                'is_superuser': request.user.is_superuser,
                'pode_ver_historico': request.user.is_superuser
            }
        }
        
        return JsonResponse({
            'success': True,
            'data': dados_completos
        })
        
    except Exception as e:
        logger.error(f"Erro ao buscar detalhes do card: {str(e)}")
        return JsonResponse({
            'success': False,
            'message': f'Erro interno: {str(e)}'
        })

@login_required
@require_GET
def api_get_setores_para_filtro(request):
    """
    API para retornar setores para uso em filtros.
    Retorna dados específicos para os filtros de presença e agendamentos.
    """
    try:
        from apps.funcionarios.models import Setor
        
        setores = Setor.objects.filter(status=True).select_related('departamento__empresa')
        
        data = []
        for setor in setores:
            data.append({
                'id': setor.id,
                'nome': setor.nome,
                'departamento_nome': setor.departamento.nome,
                'empresa_nome': setor.departamento.empresa.nome
            })
        
        return JsonResponse({'setores': data})
        
    except Exception as e:
        logger.error(f"Erro ao buscar setores para filtro: {e}", exc_info=True)
        return JsonResponse({'error': 'Erro interno do servidor'}, status=500)


@login_required
@require_GET
def api_get_equipes_para_filtro(request):
    """
    API para retornar equipes para uso em filtros.
    """
    try:
        from apps.funcionarios.models import Equipe
        
        equipes = Equipe.objects.filter(status=True)
        
        data = []
        for equipe in equipes:
            data.append({
                'id': equipe.id,
                'nome': equipe.nome
            })
        
        return JsonResponse({'equipes': data})
        
    except Exception as e:
        logger.error(f"Erro ao buscar equipes para filtro: {e}", exc_info=True)
        return JsonResponse({'error': 'Erro interno do servidor'}, status=500)


@login_required
@require_GET
def api_get_presenca_ausencias(request):
    """
    API para retornar dados de funcionários sem presença ou atrasados.
    Filtra por data, equipe, setor e tipo de ocorrência.
    """
    try:
        from apps.funcionarios.models import (
            Funcionario, Equipe, Setor, RegistroPresenca, 
            EntradaAuto, RelatorioSistemaPresenca, HorarioTrabalho
        )
        from django.db.models import Q, Count, Max, Min
        
        # Parâmetros de filtro
        data_inicio_str = request.GET.get('data_inicio')
        data_fim_str = request.GET.get('data_fim')
        equipe_id = request.GET.get('equipe_id')
        setor_id = request.GET.get('setor_id')
        tipo_ocorrencia = request.GET.get('tipo_ocorrencia')  # 'sem_presenca', 'atrasado', 'todos'
        
        # Paginaão
        page = int(request.GET.get('page', 1))
        per_page = int(request.GET.get('per_page', 20))
        
        # Validação e conversão de datas
        if data_inicio_str:
            try:
                data_inicio = datetime.strptime(data_inicio_str, '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'error': 'Formato de data inválido para data_inicio'}, status=400)
        else:
            data_inicio = timezone.now().date() - timedelta(days=7)  # Padrão: última semana
            
        if data_fim_str:
            try:
                data_fim = datetime.strptime(data_fim_str, '%Y-%m-%d').date()
            except ValueError:
                return JsonResponse({'error': 'Formato de data inválido para data_fim'}, status=400)
        else:
            data_fim = timezone.now().date()
        
        # Base query - funcionários ativos
        funcionarios_base = Funcionario.objects.filter(
            status=True,
            usuario__isnull=False
        ).select_related(
            'usuario', 'empresa', 'departamento', 'setor', 'equipe', 'horario'
        )
        
        # Aplicar filtros
        if equipe_id:
            funcionarios_base = funcionarios_base.filter(equipe_id=equipe_id)
        
        if setor_id:
            funcionarios_base = funcionarios_base.filter(setor_id=setor_id)
        
        ocorrencias = []
        
        # Iterar sobre cada dia no período
        current_date = data_inicio
        while current_date <= data_fim:
            # Pular finais de semana (opcional - pode ser configurável)
            if current_date.weekday() < 5:  # Segunda a sexta (0-4)
                
                for funcionario in funcionarios_base:
                    # Verificar se tem entrada automática no dia
                    entrada_auto = EntradaAuto.objects.filter(
                        usuario=funcionario.usuario,
                        data=current_date
                    ).first()
                    
                    if not entrada_auto:
                        # Sem presença
                        if tipo_ocorrencia in ['sem_presenca', 'todos', '']:
                            ocorrencias.append({
                                'funcionario_id': funcionario.id,
                                'funcionario_nome': funcionario.nome_completo,
                                'funcionario_apelido': funcionario.apelido,
                                'equipe_nome': funcionario.equipe.nome if funcionario.equipe else 'Sem equipe',
                                'setor_nome': funcionario.setor.nome,
                                'departamento_nome': funcionario.departamento.nome,
                                'empresa_nome': funcionario.empresa.nome,
                                'data': current_date.strftime('%d/%m/%Y'),
                                'data_raw': current_date.isoformat(),
                                'tipo_ocorrencia': 'Sem presença',
                                'horario_entrada': funcionario.horario.entrada.strftime('%H:%M') if funcionario.horario else 'N/A',
                                'hora_registro': None,
                                'atraso_minutos': None
                            })
                    else:
                        # Verificar atraso
                        if funcionario.horario and tipo_ocorrencia in ['atrasado', 'todos', '']:
                            horario_entrada = funcionario.horario.entrada
                            hora_entrada_funcionario = entrada_auto.datahora.time()
                            
                            # Calcular atraso
                            entrada_datetime = datetime.combine(current_date, horario_entrada)
                            registro_datetime = datetime.combine(current_date, hora_entrada_funcionario)
                            
                            if registro_datetime > entrada_datetime:
                                diferenca = registro_datetime - entrada_datetime
                                atraso_minutos = int(diferenca.total_seconds() / 60)
                                
                                # Considera atraso se for maior que 5 minutos (tolerância)
                                if atraso_minutos > 5:
                                    ocorrencias.append({
                                        'funcionario_id': funcionario.id,
                                        'funcionario_nome': funcionario.nome_completo,
                                        'funcionario_apelido': funcionario.apelido,
                                        'equipe_nome': funcionario.equipe.nome if funcionario.equipe else 'Sem equipe',
                                        'setor_nome': funcionario.setor.nome,
                                        'departamento_nome': funcionario.departamento.nome,
                                        'empresa_nome': funcionario.empresa.nome,
                                        'data': current_date.strftime('%d/%m/%Y'),
                                        'data_raw': current_date.isoformat(),
                                        'tipo_ocorrencia': 'Atrasado',
                                        'horario_entrada': funcionario.horario.entrada.strftime('%H:%M'),
                                        'hora_registro': hora_entrada_funcionario.strftime('%H:%M'),
                                        'atraso_minutos': atraso_minutos
                                    })
            
            current_date += timedelta(days=1)
        
        # Ordenar por data mais recente e nome
        ocorrencias.sort(key=lambda x: (x['data_raw'], x['funcionario_nome']), reverse=True)
        
        # Aplicar paginação
        total_items = len(ocorrencias)
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        ocorrencias_paginadas = ocorrencias[start_index:end_index]
        
        # Dados de paginação
        total_pages = math.ceil(total_items / per_page) if total_items > 0 else 1
        
        paginacao = {
            'pagina_atual': page,
            'total_paginas': total_pages,
            'total_items': total_items,
            'items_por_pagina': per_page,
            'tem_anterior': page > 1,
            'tem_proxima': page < total_pages
        }
        
        return JsonResponse({
            'ocorrencias': ocorrencias_paginadas,
            'paginacao': paginacao,
            'resumo': {
                'total_sem_presenca': len([o for o in ocorrencias if o['tipo_ocorrencia'] == 'Sem presença']),
                'total_atrasados': len([o for o in ocorrencias if o['tipo_ocorrencia'] == 'Atrasado']),
                'total_ocorrencias': len(ocorrencias)
            }
        })
        
    except Exception as e:
        logger.error(f"Erro ao buscar dados de presença/ausências: {e}", exc_info=True)
        return JsonResponse({'error': 'Erro interno do servidor'}, status=500)

@csrf_exempt
@require_POST
@login_required
def api_post_criar_tabulacoes_automaticas(request):
    """
    API para criar tabulações automáticas em lote.
    """
    try:
        data = json.loads(request.body)
        agendamento_ids = data.get('agendamento_ids', [])
        
        if not agendamento_ids:
            return JsonResponse({
                'success': False,
                'message': 'Nenhum agendamento selecionado.'
            })
        
        agendamentos = AgendamentoFichaCliente.objects.filter(
            id__in=agendamento_ids
        ).exclude(
            tabulacao__isnull=False  # Exclui agendamentos que já têm tabulação
        )
        
        tabulacoes_criadas = 0
        for agendamento in agendamentos:
            TabulacaoAgendamento.objects.create(
                agendamento=agendamento,
                status='EM_NEGOCIACAO',
                usuario_responsavel=request.user
            )
            tabulacoes_criadas += 1
        
        return JsonResponse({
            'success': True,
            'message': f'{tabulacoes_criadas} tabulações criadas com sucesso!',
            'tabulacoes_criadas': tabulacoes_criadas
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao criar tabulações: {str(e)}'
        })


@login_required
@require_GET
def api_get_coordenadores_horarios_disponiveis(request):
    """
    API para buscar coordenadores/supervisores gerais do setor SIAPE 
    e seus horários disponíveis para checagem.
    """
    try:
        from apps.funcionarios.models import Funcionario, Cargo, Setor
        from apps.siape.models import HorarioChecagem
        from datetime import date, time, timedelta
        
        # Busca o setor SIAPE
        try:
            setor_siape = Setor.objects.get(nome__icontains='SIAPE')
        except Setor.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': 'Setor SIAPE não encontrado.'
            })
        
        # Busca funcionários do setor SIAPE com hierarquia de coordenador (3) ou superior
        funcionarios_coordenadores = Funcionario.objects.filter(
            setor=setor_siape,
            cargo__hierarquia__gte=3,  # 3 = Coordenador, 4+ = superiores
            status=True,
            usuario__isnull=False
        ).select_related('usuario', 'cargo').order_by('cargo__hierarquia', 'nome_completo')
        
        coordenadores_data = []
        for funcionario in funcionarios_coordenadores:
            nome_exibicao = funcionario.apelido or funcionario.nome_completo.split()[0]
            hierarquia_nome = funcionario.cargo.get_hierarquia_display() if funcionario.cargo else "Sem Cargo"
            
            coordenadores_data.append({
                'user_id': funcionario.usuario.id,
                'nome': nome_exibicao,
                'nome_completo': funcionario.nome_completo,
                'hierarquia': funcionario.cargo.hierarquia if funcionario.cargo else 0,
                'hierarquia_nome': hierarquia_nome,
                'cargo_nome': funcionario.cargo.nome if funcionario.cargo else "Sem Cargo"
            })
        
        return JsonResponse({
            'success': True,
            'coordenadores': coordenadores_data
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao buscar coordenadores: {str(e)}'
        })


@login_required
@require_GET
def api_get_horarios_disponiveis_coordenador(request):
    """
    API para buscar horários disponíveis de um coordenador em uma data específica.
    """
    try:
        from apps.siape.models import HorarioChecagem
        from datetime import time, datetime
        
        coordenador_id = request.GET.get('coordenador_id')
        data_str = request.GET.get('data')
        
        if not coordenador_id or not data_str:
            return JsonResponse({
                'success': False,
                'message': 'Coordenador e data são obrigatórios.'
            })
        
        try:
            # Tenta primeiro o formato YYYY-MM-DD (padrão do input type="date")
            if '-' in data_str and len(data_str) == 10:
                ano, mes, dia = data_str.split('-')
                data_checagem = datetime(int(ano), int(mes), int(dia)).date()
            else:
                data_checagem = parse_date(data_str)
                if isinstance(data_checagem, datetime):
                    data_checagem = data_checagem.date()
            
            if not data_checagem:
                raise ValueError("Data inválida")
        except:
            return JsonResponse({
                'success': False,
                'message': 'Formato de data inválido. Use YYYY-MM-DD ou DD/MM/YYYY.'
            })
        
        # Verifica se a data não é no passado
        from django.utils import timezone
        hoje = timezone.now().date()
        if data_checagem < hoje:
            return JsonResponse({
                'success': False,
                'message': 'Não é possível agendar para datas passadas.'
            })
        
        try:
            coordenador = User.objects.get(id=coordenador_id)
        except User.DoesNotExist:
            return JsonResponse({
                'success': False,
                'message': 'Coordenador não encontrado.'
            })
        
        # Gera todos os horários possíveis (10:00 - 16:45, intervalos de 15 min)
        horarios_possiveis = []
        hora_atual = time(10, 0)  # 10:00
        hora_limite = time(16, 45)  # 16:45 (último horário)
        
        while hora_atual <= hora_limite:
            horarios_possiveis.append({
                'valor': hora_atual.strftime('%H:%M'),
                'texto': hora_atual.strftime('%H:%M')
            })
            
            # Adiciona 15 minutos
            minutos = hora_atual.minute + 15
            horas = hora_atual.hour
            if minutos >= 60:
                horas += 1
                minutos = 0
            hora_atual = time(horas, minutos)
        
        # Busca horários já ocupados para o coordenador na data
        horarios_ocupados = HorarioChecagem.objects.filter(
            coordenador=coordenador,
            data=data_checagem,
            status=True  # Apenas horários ativos
        ).values_list('hora', flat=True)
        
        # Converte horários ocupados para strings para comparação
        horarios_ocupados_str = [h.strftime('%H:%M') for h in horarios_ocupados]
        
        # Filtra horários disponíveis
        horarios_disponiveis = [
            h for h in horarios_possiveis 
            if h['valor'] not in horarios_ocupados_str
        ]
        
        # Verifica se todos os horários estão ocupados
        todos_ocupados = len(horarios_disponiveis) == 0
        
        return JsonResponse({
            'success': True,
            'horarios_disponiveis': horarios_disponiveis,
            'todos_ocupados': todos_ocupados,
            'total_horarios': len(horarios_possiveis),
            'ocupados': len(horarios_ocupados_str),
            'disponiveis': len(horarios_disponiveis)
        })
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': f'Erro ao buscar horários: {str(e)}'
        })

@login_required
@require_GET
def api_get_detalhes_agendamento(request):
    """
    API para obter detalhes completos de um agendamento específico
    """
    try:
        agendamento_id = request.GET.get('agendamento_id')
        
        if not agendamento_id:
            return JsonResponse({
                'result': False,
                'message': 'ID do agendamento não fornecido.'
            })
        
        # Busca o agendamento
        try:
            agendamento = AgendamentoFichaCliente.objects.select_related(
                'cliente', 'tabulacao'
            ).get(id=agendamento_id)
        except AgendamentoFichaCliente.DoesNotExist:
            return JsonResponse({
                'result': False,
                'message': 'Agendamento não encontrado.'
            })
        
        # Prepara os dados do agendamento
        dados_agendamento = {
            'id': agendamento.id,
            'data': agendamento.data.strftime('%Y-%m-%d'),
            'hora': agendamento.hora.strftime('%H:%M'),
            'telefone_contato': agendamento.telefone_contato,
            'observacao': agendamento.observacao,
            'status': agendamento.status,
            'data_criacao': agendamento.data_criacao.strftime('%d/%m/%Y %H:%M'),
            'cliente': {
                'id': agendamento.cliente.id,
                'nome': agendamento.cliente.nome,
                'cpf': agendamento.cliente.cpf
            }
        }
        
        # Adiciona dados da tabulação se existir
        if hasattr(agendamento, 'tabulacao') and agendamento.tabulacao:
            dados_agendamento['tabulacao'] = {
                'id': agendamento.tabulacao.id,
                'status': agendamento.tabulacao.status,
                'status_display': agendamento.tabulacao.get_status_display(),
                'observacoes': agendamento.tabulacao.observacoes,
                'data_atualizacao': agendamento.tabulacao.data_atualizacao.strftime('%d/%m/%Y %H:%M')
            }
        
        return JsonResponse({
            'result': True,
            'agendamento': dados_agendamento
        })
        
    except Exception as e:
        logger.error(f"Erro em api_get_detalhes_agendamento: {str(e)}")
        return JsonResponse({
            'result': False,
            'message': 'Erro interno do servidor.'
        })

@csrf_exempt
@require_POST
@login_required
def api_post_editar_agendamento(request):
    """
    API para editar um agendamento existente, agendar horário de checagem se necessário,
    e salvar dados de negociação para status CHECAGEM ou REVERSAO
    """
    try:
        print(f"[DEBUG] api_post_editar_agendamento iniciada pelo usuário: {request.user}")
        
        # Verifica se é FormData (com arquivos) ou JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Dados com arquivos - FormData
            data = {}
            for key, value in request.POST.items():
                data[key] = value
            arquivos = request.FILES
            print(f"[DEBUG] Dados FormData recebidos: {data}")
            print(f"[DEBUG] Arquivos recebidos: {list(arquivos.keys())}")
        else:
            # Dados JSON
            data = json.loads(request.body)
            arquivos = {}
            print(f"[DEBUG] Dados JSON recebidos: {data}")
        
        agendamento_id = data.get('agendamento_id')
        data_agendamento = data.get('data')
        hora_agendamento = data.get('hora')
        telefone_contato = data.get('telefone_contato', '')
        observacao = data.get('observacao', '')
        tabulacao_status = data.get('tabulacao_status')
        tabulacao_observacoes = data.get('tabulacao_observacoes', '')
        
        print(f"[DEBUG] Dados básicos extraídos: agendamento_id={agendamento_id}, data={data_agendamento}, hora={hora_agendamento}")
        
        # Dados do agendamento de checagem (se fornecidos)
        coordenador_id = data.get('coordenador_id')
        data_checagem = data.get('data_checagem')
        hora_checagem = data.get('hora_checagem')
        observacao_checagem = data.get('observacao_checagem', '')
        
        # Dados de negociação (para CHECAGEM ou REVERSAO)
        dados_negociacao_data = {}
        if tabulacao_status in ['CHECAGEM', 'REVERSAO']:
            if tabulacao_status == 'CHECAGEM':
                dados_negociacao_data = {
                    'banco_nome': data.get('banco_nome', '').strip(),
                    'valor_liberado': data.get('valor_liberado', ''),
                    'saldo_devedor': data.get('saldo_devedor', ''),
                    'parcela_atual': data.get('parcela_atual', ''),
                    'parcela_nova': data.get('parcela_nova', ''),
                    'tc': data.get('tc', ''),
                    'troco': data.get('troco', ''),
                    'prazo_atual': data.get('prazo_atual', ''),
                    'prazo_acordado': data.get('prazo_acordado', ''),
                    'descricao': data.get('descricao_negociacao', '').strip()
                }
            else:  # REVERSAO
                dados_negociacao_data = {
                    'descricao': data.get('observacoes_reversao', '').strip()
                }
            
            print(f"[DEBUG] Dados de negociação extraídos para {tabulacao_status}: {dados_negociacao_data}")
            
            # Validações específicas para CHECAGEM
            if tabulacao_status == 'CHECAGEM':
                campos_obrigatorios = ['banco_nome', 'valor_liberado', 'saldo_devedor', 'parcela_atual', 'parcela_nova', 'prazo_acordado']
                for campo in campos_obrigatorios:
                    valor = dados_negociacao_data.get(campo, '')
                    if not valor or str(valor).strip() == '':
                        return JsonResponse({
                            'result': False,
                            'message': f'Campo obrigatório não preenchido: {campo.replace("_", " ").title()}'
                        })
                
                # Validar descrição mínima
                if not dados_negociacao_data['descricao'] or len(dados_negociacao_data['descricao']) < 10:
                    return JsonResponse({
                        'result': False,
                        'message': 'Descrição da negociação deve ter pelo menos 10 caracteres'
                    })
            
            # Validações específicas para REVERSAO
            elif tabulacao_status == 'REVERSAO':
                if not dados_negociacao_data['descricao'] or len(dados_negociacao_data['descricao']) < 10:
                    return JsonResponse({
                        'result': False,
                        'message': 'Descrição da negociação deve ter pelo menos 10 caracteres'
                    })
        
        print(f"[DEBUG] Dados de checagem: coordenador_id={coordenador_id}, data_checagem={data_checagem}, hora_checagem={hora_checagem}")
        
        # Validações básicas
        if not agendamento_id:
            print("[DEBUG] Erro: ID do agendamento não fornecido")
            return JsonResponse({
                'result': False,
                'message': 'ID do agendamento não fornecido.'
            })
        
        if not data_agendamento or not hora_agendamento:
            print("[DEBUG] Erro: Data e hora são obrigatórios")
            return JsonResponse({
                'result': False,
                'message': 'Data e hora são obrigatórios.'
            })
        
        # Busca o agendamento
        try:
            agendamento = AgendamentoFichaCliente.objects.get(id=agendamento_id)
            print(f"[DEBUG] Agendamento encontrado: {agendamento.id} - {agendamento.cliente.nome}")
        except AgendamentoFichaCliente.DoesNotExist:
            print(f"[DEBUG] Erro: Agendamento {agendamento_id} não encontrado")
            return JsonResponse({
                'result': False,
                'message': 'Agendamento não encontrado.'
            })
        
        # Validações para agendamento de checagem
        if tabulacao_status in ['CHECAGEM', 'REVERSAO']:
            # Validações obrigatórias para checagem/reversão
            if not coordenador_id:
                return JsonResponse({
                    'result': False,
                    'message': 'Coordenador é obrigatório para checagem/reversão.'
                })
            
            if not data_checagem:
                return JsonResponse({
                    'result': False,
                    'message': 'Data da checagem/reversão é obrigatória.'
                })
            
            if not hora_checagem:
                return JsonResponse({
                    'result': False,
                    'message': 'Horário da checagem/reversão é obrigatório.'
                })
            
            # Verifica se o coordenador existe
            try:
                coordenador = User.objects.get(id=coordenador_id)
            except User.DoesNotExist:
                return JsonResponse({
                    'result': False,
                    'message': 'Coordenador não encontrado.'
                })
            
            # Verifica se a data não é no passado
            data_checagem_obj = parse_date(data_checagem)
            data_hoje = timezone.now().date()
            
            print(f"[DEBUG] Validação de data de checagem:")
            print(f"[DEBUG] data_checagem original: '{data_checagem}'")
            print(f"[DEBUG] data_checagem_obj após parse: {data_checagem_obj}")
            print(f"[DEBUG] data_hoje: {data_hoje}")
            print(f"[DEBUG] Tipo data_checagem_obj: {type(data_checagem_obj)}")
            print(f"[DEBUG] Tipo data_hoje: {type(data_hoje)}")
            print(f"[DEBUG] data_agendamento (para comparação): '{data_agendamento}'")
            
            if data_checagem_obj is None:
                print(f"[DEBUG] Erro: data_checagem_obj é None após parse_date")
                return JsonResponse({
                    'result': False,
                    'message': 'Formato de data da checagem inválido.'
                })
            
            if data_checagem_obj < data_hoje:
                print(f"[DEBUG] Erro: Data da checagem no passado - {data_checagem_obj} < {data_hoje}")
                return JsonResponse({
                    'result': False,
                    'message': 'Data da checagem/reversão não pode ser no passado.'
                })
            
            print(f"[DEBUG] Validação de data OK: {data_checagem_obj} >= {data_hoje}")
            
            # Verifica se o horário está disponível
            hora_checagem_obj = datetime.strptime(hora_checagem, '%H:%M').time()
            horario_existente = HorarioChecagem.objects.filter(
                coordenador=coordenador,
                data=data_checagem_obj,
                hora=hora_checagem_obj,
                status=True
            ).exists()
            
            if horario_existente:
                return JsonResponse({
                    'result': False,
                    'message': f'O horário {hora_checagem} já está ocupado para este coordenador na data {data_checagem}.'
                })
        
        # Atualiza os dados do agendamento
        print(f"[DEBUG] Atualizando agendamento {agendamento.id}")
        agendamento.data = data_agendamento
        agendamento.hora = hora_agendamento
        agendamento.telefone_contato = telefone_contato
        agendamento.observacao = observacao
        agendamento.save()
        print(f"[DEBUG] Agendamento {agendamento.id} atualizado com sucesso")
        
        # Atualiza ou cria a tabulação se fornecida
        tabulacao = None
        if tabulacao_status:
            tabulacao, created = TabulacaoAgendamento.objects.get_or_create(
                agendamento=agendamento,
                defaults={
                    'status': tabulacao_status,
                    'observacoes': tabulacao_observacoes,
                    'usuario_responsavel': request.user
                }
            )
            
            if not created:
                # Se já existe, atualiza
                status_anterior = tabulacao.status
                tabulacao.status = tabulacao_status
                tabulacao.observacoes = tabulacao_observacoes
                tabulacao.usuario_responsavel = request.user
                tabulacao.save()
                
                # Registra no histórico se o status mudou
                if status_anterior != tabulacao_status:
                    HistoricoTabulacaoAgendamento.objects.create(
                        agendamento=agendamento,
                        status_anterior=status_anterior,
                        status_novo=tabulacao_status,
                        usuario=request.user,
                        observacoes=f'Status alterado via modal de edição. {tabulacao_observacoes}'
                    )
        
        # Salva dados de negociação se for CHECAGEM ou REVERSAO
        dados_negociacao = None
        if tabulacao_status in ['CHECAGEM', 'REVERSAO'] and tabulacao:
            print(f"[DEBUG] Salvando dados de negociação para status: {tabulacao_status}")
            
            # Busca ou cria dados de negociação
            dados_negociacao, created = DadosNegociacao.objects.get_or_create(
                agendamento=agendamento,
                tabulacao=tabulacao,
                defaults={'status': True}
            )
            
            # Preenche dados específicos por tipo
            if tabulacao_status == 'CHECAGEM':
                # Atualiza os campos de dados de negociação para CHECAGEM
                dados_negociacao.banco_nome = dados_negociacao_data.get('banco_nome', '')
                
                # Converte valores monetários com tratamento de erro
                def converter_decimal(valor, nome_campo):
                    if valor and str(valor).strip():
                        try:
                            return Decimal(str(valor).replace(',', '.'))
                        except (ValueError, TypeError, InvalidOperation) as e:
                            print(f"[DEBUG] Erro ao converter {nome_campo}: '{valor}' - {str(e)}")
                            raise ValueError(f"Valor inválido para {nome_campo}: {valor}")
                    return None
                
                def converter_inteiro(valor, nome_campo):
                    if valor and str(valor).strip():
                        try:
                            return int(float(str(valor)))  # Converte via float primeiro para lidar com decimais
                        except (ValueError, TypeError) as e:
                            print(f"[DEBUG] Erro ao converter {nome_campo}: '{valor}' - {str(e)}")
                            raise ValueError(f"Valor inválido para {nome_campo}: {valor}")
                    return None
                
                dados_negociacao.valor_liberado = converter_decimal(dados_negociacao_data.get('valor_liberado'), 'valor_liberado')
                dados_negociacao.saldo_devedor = converter_decimal(dados_negociacao_data.get('saldo_devedor'), 'saldo_devedor')
                dados_negociacao.parcela_atual = converter_decimal(dados_negociacao_data.get('parcela_atual'), 'parcela_atual')
                dados_negociacao.parcela_nova = converter_decimal(dados_negociacao_data.get('parcela_nova'), 'parcela_nova')
                dados_negociacao.tc = converter_decimal(dados_negociacao_data.get('tc'), 'tc')
                dados_negociacao.troco = converter_decimal(dados_negociacao_data.get('troco'), 'troco')
                dados_negociacao.prazo_atual = converter_inteiro(dados_negociacao_data.get('prazo_atual'), 'prazo_atual')
                dados_negociacao.prazo_acordado = converter_inteiro(dados_negociacao_data.get('prazo_acordado'), 'prazo_acordado')
            
            # Para ambos CHECAGEM e REVERSAO
            dados_negociacao.descricao = dados_negociacao_data.get('descricao', '')
            dados_negociacao.full_clean()
            dados_negociacao.save()
            
            print(f"[DEBUG] Dados de negociação {'criados' if created else 'atualizados'} com sucesso: ID {dados_negociacao.id}")
            
            # Processa arquivos se houver
            if arquivos:
                print(f"[DEBUG] Processando {len(arquivos)} arquivos para dados de negociação")
                for key, arquivo in arquivos.items():
                    if key.startswith('arquivo_negociacao_'):
                        # Extrai o título do arquivo do campo correspondente
                        titulo_key = key.replace('arquivo_negociacao_', 'titulo_arquivo_')
                        titulo_arquivo = data.get(titulo_key, f'Arquivo_{arquivo.name}')
                        
                        # Verifica o tamanho do arquivo (máximo 20MB)
                        if arquivo.size > 20 * 1024 * 1024:
                            print(f"[DEBUG] Arquivo {arquivo.name} muito grande: {arquivo.size} bytes")
                            continue
                        
                        try:
                            arquivo_negociacao = ArquivoNegociacao.objects.create(
                                dados_negociacao=dados_negociacao,
                                titulo_arquivo=titulo_arquivo,
                                arquivo=arquivo
                            )
                            print(f"[DEBUG] Arquivo {arquivo.name} salvo com sucesso: ID {arquivo_negociacao.id}")
                        except Exception as e:
                            print(f"[DEBUG] Erro ao salvar arquivo {arquivo.name}: {str(e)}")
        
        # Cria o agendamento de checagem se necessário
        if tabulacao_status in ['CHECAGEM', 'REVERSAO'] and coordenador_id and tabulacao:
            print(f"[DEBUG] Criando horário de checagem para status: {tabulacao_status}")
            
            # Busca novamente o coordenador (pode ter sido usado na validação anterior)
            try:
                coordenador = User.objects.get(id=coordenador_id)
                print(f"[DEBUG] Coordenador encontrado: {coordenador.username} (ID: {coordenador.id})")
            except User.DoesNotExist:
                print(f"[DEBUG] Erro: Coordenador {coordenador_id} não encontrado na criação do horário")
                return JsonResponse({
                    'result': False,
                    'message': 'Coordenador não encontrado.'
                })
            
            data_checagem_obj = parse_date(data_checagem)
            hora_checagem_obj = datetime.strptime(hora_checagem, '%H:%M').time()
            
            print(f"[DEBUG] Objetos para criação do HorarioChecagem:")
            print(f"[DEBUG] coordenador: {coordenador}")
            print(f"[DEBUG] consultor: {request.user}")
            print(f"[DEBUG] agendamento: {agendamento}")
            print(f"[DEBUG] tabulacao: {tabulacao}")
            print(f"[DEBUG] data_checagem_obj: {data_checagem_obj}")
            print(f"[DEBUG] hora_checagem_obj: {hora_checagem_obj}")
            
            # Remove agendamentos de checagem anteriores para este agendamento (se houver)
            horarios_removidos = HorarioChecagem.objects.filter(
                agendamento=agendamento,
                status=True
            ).update(status=False)
            print(f"[DEBUG] Horários de checagem anteriores desativados: {horarios_removidos}")
            
            # Cria o novo horário de checagem
            try:
                horario_checagem = HorarioChecagem.objects.create(
                    coordenador=coordenador,
                    consultor=request.user,
                    agendamento=agendamento,
                    tabulacao=tabulacao,
                    data=data_checagem_obj,
                    hora=hora_checagem_obj,
                    observacao_consultor=observacao_checagem,
                    status_checagem='EM_ESPERA',
                    status=True
                )
                print(f"[DEBUG] HorarioChecagem criado com sucesso: ID {horario_checagem.id}")
                
                message = f'Agendamento atualizado e horário de checagem/reversão agendado para {data_checagem_obj.strftime("%d/%m/%Y")} às {hora_checagem}!'
                if dados_negociacao:
                    message += ' Dados de negociação salvos com sucesso.'
                
                return JsonResponse({
                    'result': True,
                    'message': message
                })
            except Exception as e:
                print(f"[DEBUG] Erro ao criar HorarioChecagem: {str(e)}")
                return JsonResponse({
                    'result': False,
                    'message': f'Erro ao criar horário de checagem: {str(e)}'
                })
        
        message = 'Agendamento atualizado com sucesso!'
        if dados_negociacao:
            message += ' Dados de negociação salvos com sucesso.'
        
        return JsonResponse({
            'result': True,
            'message': message
        })
        
    except json.JSONDecodeError as e:
        print(f"[DEBUG] Erro JSON em api_post_editar_agendamento: {str(e)}")
        return JsonResponse({
            'result': False,
            'message': 'Dados JSON inválidos.'
        })
    except ValidationError as e:
        print(f"[DEBUG] Erro de validação em api_post_editar_agendamento: {str(e)}")
        return JsonResponse({
            'result': False,
            'message': f'Erro de validação: {str(e)}'
        })
    except ValueError as e:
        print(f"[DEBUG] Erro de valor em api_post_editar_agendamento: {str(e)}")
        return JsonResponse({
            'result': False,
            'message': f'Erro nos dados fornecidos: {str(e)}'
        })
    except Exception as e:
        import traceback
        print(f"[DEBUG] Erro geral em api_post_editar_agendamento: {str(e)}")
        print(f"[DEBUG] Traceback completo: {traceback.format_exc()}")
        logger.error(f"Erro em api_post_editar_agendamento: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({
            'result': False,
            'message': f'Erro interno do servidor: {str(e)}'
        })


