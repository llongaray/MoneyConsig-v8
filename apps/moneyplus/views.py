# 📦 Biblioteca padrão
import csv
import io
import re
import json
import logging
import decimal
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from django.contrib.auth.models import User
from django.db import IntegrityError

# 🏗️ Django
from django.shortcuts import render
from django.http import JsonResponse, HttpResponseRedirect
from django.core import serializers
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.contrib.auth.decorators import login_required, user_passes_test
from django.views.decorators.http import require_POST, require_GET
from django.shortcuts import redirect

# 📁 Imports locais
from .models import *

# renderização de paginas

from custom_tags_app.templatetags.permissionsacess import controle_acess

@login_required(login_url='/')
@controle_acess('SCT25')   # 25 – MONEY CAMPANHAS | CAMPANHA
def render_infocliente(request):
    """
    Renderiza o template com as informações detalhadas do cliente.
    Usuário deve ter acesso à subcategoria 'Campanha'.
    """
    return render(request, 'moneyplus/moneyplus.html')


@login_required(login_url='/')
@controle_acess('SCT26')   # 26 – MONEY CAMPANHAS | CONTROLE CAMPANHA
def render_uploadbase(request):
    """
    Renderiza o template para upload da base completa.
    Usuário deve ter acesso à subcategoria 'Controle Campanha'.
    """
    return render(request, 'moneyplus/uploadbase.html')

# fim renderização de paginas


def is_superuser(user):
    return user.is_superuser

@user_passes_test(is_superuser, login_url='/')
@login_required(login_url='/')
def render_uploadbase(request):
    """
    Renderiza o template para upload da base completa.
    Apenas superusuários têm permissão de acesso.
    """
    if request.method == 'POST':
        # Lógica para processar o upload do arquivo
        # Exemplo:
        # arquivo = request.FILES.get('arquivo')
        pass

    return render(request, 'moneyplus/uploadbase.html', {})

def api_get_uploadbase(request):
    """
    Retorna um JSON com todos os registros dos modelos:
    - DBCliente
    - Equipe
    - DBCampanha
    - DBDebito
    - Usuários ativos (id e username)
    
    Essa view é utilizada para alimentar o template uploadbase.
    """
    equipes = json.loads(serializers.serialize('json', Equipe.objects.all()))
    campanhas = json.loads(serializers.serialize('json', DBCampanha.objects.all()))
    users = list(User.objects.filter(is_active=True).values('id', 'username'))
    
    data = {
        'equipes': equipes,
        'campanhas': campanhas,
        'users': users
    }
    return JsonResponse(data)

@csrf_exempt
def api_create_equipe(request):
    if request.method != "POST":
        return JsonResponse({"error": "Método não permitido"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido"}, status=400)

    nome = data.get("nome", "").strip()
    participantes_ids = data.get("participantes", [])
    status = data.get("status", True)

    if not nome:
        return JsonResponse({"error": "O nome da equipe é obrigatório."}, status=400)

    equipe = Equipe.objects.create(nome=nome, status=status)

    if participantes_ids:
        users = User.objects.filter(id__in=participantes_ids)
        equipe.participantes.set(users)

    return JsonResponse({"message": "Equipe criada com sucesso", "equipe_id": equipe.id}, status=201)



def to_decimal(value):
    """
    Converte string monetária brasileira para Decimal.
    Ex: "R$ 15.252,91" → Decimal('15252.91')
    """
    if not value:
        return None
    # remove símbolo e espaços
    v = value.replace("R$", "").strip()
    # remove separadores de milhar
    v = re.sub(r"\.(?=\d{3}(?:[.,]|$))", "", v)
    # troca vírgula decimal por ponto
    v = v.replace(",", ".")
    try:
        return decimal.Decimal(v)
    except decimal.InvalidOperation as e:
        print(f"Erro ao converter '{value}' para Decimal: {e}")
        return None

@csrf_exempt
def api_upload_csv_clientes(request):
    """
    Processa upload de arquivo CSV com clientes.
    Suporta SIAPE, INSS e FGTS.
    """
    logger = logging.getLogger(__name__)
    logger.info("Iniciando processamento de upload CSV")
    
    if request.method != "POST":
        return JsonResponse({"error": "Método não permitido"}, status=405)

    produto = request.POST.get("produto", "").strip().upper()
    if produto not in ["SIAPE", "INSS", "FGTS"]:
        return JsonResponse({"error": "Produto inválido. Escolha SIAPE, INSS ou FGTS."}, status=400)

    campanha_id = request.POST.get("campanha_id")
    if not campanha_id:
        return JsonResponse({"error": "Campanha não informada."}, status=400)
    try:
        campanha_obj = DBCampanha.objects.get(pk=campanha_id, status=True)
    except DBCampanha.DoesNotExist:
        return JsonResponse({"error": "Campanha não encontrada ou inativa."}, status=400)

    csv_file = request.FILES.get("arquivo")
    if not csv_file:
        return JsonResponse({"error": "Nenhum arquivo enviado."}, status=400)

    logger.info(f"Arquivo recebido: {csv_file.name} ({csv_file.size} bytes)")
    
    try:
        # Lê o arquivo em chunks para evitar problemas de memória
        chunks = []
        for chunk in csv_file.chunks():
            chunks.append(chunk)
        data = b''.join(chunks).decode("utf-8")
        logger.info("Arquivo decodificado com sucesso")
    except Exception as e:
        logger.error(f"Erro ao ler o arquivo: {e}")
        return JsonResponse({"error": f"Erro ao ler o arquivo: {e}"}, status=400)

    reader = csv.DictReader(io.StringIO(data), delimiter=';')
    clientes_importados = debitos_importados = invalid_rows = 0
    valid_fields = {f.name for f in DBCliente._meta.get_fields()}
    
    logger.info(f"Processando {sum(1 for _ in reader)} linhas")
    reader = csv.DictReader(io.StringIO(data), delimiter=';')  # Reset reader

    # Processa em lotes
    batch_size = 100
    clientes_batch = []
    debitos_batch = []
    
    for original_row in reader:
        try:
            # normaliza chaves do CSV para lowercase
            row = {k.strip().lower(): (v or "").strip() for k, v in original_row.items()}

            def safe_get(f):
                return row.get(f, "")
            def safe_bool(f):
                v = row.get(f, "").strip().lower()
                return v in ('1', 'true', 'sim')
            def safe_decimal(f):
                return to_decimal(row.get(f))

            cpf = safe_get("cpf")
            nome = safe_get("nome") or safe_get("nome_completo")
            cel1 = safe_get("cel1") or safe_get("celular_1")
            if not cpf or not nome or not cel1:
                logger.warning(f"⚠️ Ignorando linha, faltam campos: CPF={cpf}, Nome={nome}, Cel1={cel1}")
                invalid_rows += 1
                continue

            # data de nascimento
            date_field = "data_de_nascimento" if produto == "FGTS" else "data_nasc"
            data_nasc = None
            if safe_get(date_field):
                try:
                    data_nasc = datetime.strptime(safe_get(date_field), "%d/%m/%Y").date()
                except:
                    data_nasc = None

            # Processamento FGTS
            if produto == "FGTS":
                logger.info(f"🔄 Processando FGTS para CPF: {cpf}")
                if data_nasc is None:
                    logger.warning(f"⚠️ Linha ignorada: sem data de nascimento para CPF={cpf}")
                    invalid_rows += 1
                    continue

                # Monta dados FGTS com base no template de cabeçalho
                tipo = safe_get("tipo")
                logradouro = safe_get("logradouro")
                numero = safe_get("numero") or None
                complemento = safe_get("complemento") or None
                bairro = safe_get("bairro")
                cidade = safe_get("cidade")
                uf = safe_get("uf")
                cep = safe_get("cep")
                salario = safe_decimal("salario")
                saldo_aproximado = safe_decimal("saldo_aproximado")

                # data de admissão pode vir em Excel ou dd/mm/YYYY
                adm = safe_get("data_de_admissao")
                data_admissao = None
                if adm:
                    try:
                        if adm.isdigit():
                            data_admissao = (datetime(1899, 12, 30) + timedelta(days=int(adm))).date()
                        else:
                            data_admissao = datetime.strptime(adm, "%d/%m/%Y").date()
                    except Exception as e:
                        logger.error(f"❌ Erro converter data_admissao: {e}")

                razao_social = safe_get("razao_social")
                tempo_contrib = safe_get("tempo_de_contribuicao")
                demografica = safe_get("demografica") or None
                possivel_prof = safe_get("possivel_profissao") or None
                score = safe_get("score") or None

                # booleans interpretando 0/1
                flag_fgts = safe_bool("flag_fgts")
                procon1 = safe_bool("proconcel1")
                wts1 = safe_bool("flwhatsappcel1")
                cel2 = safe_get("cel2") or None
                procon2 = safe_bool("proconcel2")
                wts2 = safe_bool("flwhatsappcel2")
                email1 = safe_get("email1") or None

                fgts_data = {
                    "cpf": cpf,
                    "nome": nome,
                    "data_nascimento": data_nasc,
                    "idade": safe_get("idade") or None,
                    "tipo": tipo,
                    "campanha": campanha_obj,
                    "logradouro": logradouro,
                    "numero": numero,
                    "complemento": complemento,
                    "bairro": bairro,
                    "cidade": cidade,
                    "uf": uf,
                    "cep": cep,
                    "salario": salario,
                    "saldo_aproximado": saldo_aproximado,
                    "data_admissao": data_admissao,
                    "razao_social": razao_social,
                    "tempo_contribuicao": tempo_contrib,
                    "demografica": demografica,
                    "possivel_profissao": possivel_prof,
                    "score": score,
                    "flag_fgts": flag_fgts,
                    "cel1": cel1,
                    "procon_cel1": procon1,
                    "fl_whatsapp_cel1": wts1,
                    "cel2": cel2,
                    "procon_cel2": procon2,
                    "fl_whatsapp_cel2": wts2,
                    "email1": email1,
                }

                # Adiciona ao lote
                clientes_batch.append(FGTSCliente(**fgts_data))
                if len(clientes_batch) >= batch_size:
                    with transaction.atomic():
                        FGTSCliente.objects.bulk_create(clientes_batch)
                        clientes_importados += len(clientes_batch)
                        clientes_batch = []
                continue

            # Processamento SIAPE / INSS
            defaults = {
                "nome_completo": nome,
                "cpf": cpf,
                "data_nasc": data_nasc,
                "idade": safe_get("idade") or None,
                "campanha": campanha_obj,
            }
            if produto == "SIAPE":
                defaults.update({
                    "rjur": safe_get("rjur"),
                    "situacao_funcional": safe_get("situacao_funcional"),
                    "margem_disponivel_geral": safe_decimal("saldo5_bruta"),
                    "celular_1": cel1,
                    "flg_wts_1": safe_bool("flg_wts_1"),
                    "celular_2": safe_get("celular_2"),
                    "flg_wts_2": safe_bool("flg_wts_2"),
                    "celular_3": safe_get("celular_3"),
                    "flg_wts_3": safe_bool("flg_wts_3"),
                    "rmc_bruta": safe_decimal("saldo5_bruta"),
                    "rmc_util": safe_decimal("saldo5_util"),
                    "rmc_saldo": safe_decimal("saldo5_saldo"),
                    "rcc_bruta": safe_decimal("benf_bruta"),
                    "rcc_util": safe_decimal("benf_util"),
                    "rcc_saldo": safe_decimal("benf_saldo"),
                    "trinta_cinco_bruta": safe_decimal("trinta_cinco_bruta"),
                    "trinta_cinco_util": safe_decimal("trinta_cinco_util"),
                    "trinta_cinco_saldo": safe_decimal("trinta_cinco_saldo"),
                })
            else:  # INSS
                defaults.update({
                    "rg": safe_get("rg"),
                    "nome_mae": safe_get("nome_mae"),
                    "qtd_emprestimos": safe_get("qtd_emprestimos") or None,
                    "possui_representante": safe_bool("possui_representante"),
                    "cep": safe_get("cep"),
                    "uf": safe_get("uf"),
                    "cidade": safe_get("cidade"),
                    "bairro": safe_get("bairro"),
                    "endereco": safe_get("endereco"),
                    "celular_1": cel1,
                    "flg_wts_1": safe_bool("flg_wts_1"),
                    "celular_2": safe_get("celular_2"),
                    "flg_wts_2": safe_bool("flg_wts_2"),
                    "celular_3": safe_get("celular_3"),
                    "flg_wts_3": safe_bool("flg_wts_3"),
                    "liberacao_emprestimo": safe_bool("liberacao_emprestimo"),
                    "desconto": safe_bool("desconto"),
                    "taxa_associativa": safe_get("taxa_associativa"),
                    "valor_parcela_associacao": safe_decimal("valor_parcela_associacao"),
                    "rmc_saldo": safe_decimal("rmc_saldo"),
                    "rcc_saldo": safe_decimal("rcc_saldo"),
                })

            filtered = {k: v for k, v in defaults.items() if k in valid_fields}

            # Adiciona ao lote
            clientes_batch.append(DBCliente(**filtered))
            if len(clientes_batch) >= batch_size:
                with transaction.atomic():
                    DBCliente.objects.bulk_create(clientes_batch)
                    clientes_importados += len(clientes_batch)
                    clientes_batch = []

            # Processa débitos
            if produto == "SIAPE":
                try:
                    debito = process_siape_debito(row, None, campanha_obj)
                    if debito:
                        debitos_batch.append(debito)
                        if len(debitos_batch) >= batch_size:
                            with transaction.atomic():
                                DBDebito.objects.bulk_create(debitos_batch)
                                debitos_importados += len(debitos_batch)
                                debitos_batch = []
                except Exception as e:
                    logger.error(f"❌ Erro débito SIAPE CPF={cpf}: {e}")
            else:
                try:
                    debito = process_inss_debito(row, None, campanha_obj)
                    if debito:
                        debitos_batch.append(debito)
                        if len(debitos_batch) >= batch_size:
                            with transaction.atomic():
                                DBDebito.objects.bulk_create(debitos_batch)
                                debitos_importados += len(debitos_batch)
                                debitos_batch = []
                except Exception as e:
                    logger.error(f"❌ Erro débito INSS CPF={cpf}: {e}")

        except Exception as e:
            logger.error(f"Erro processando linha: {e}")
            continue

    # Processa lotes restantes
    if clientes_batch:
        with transaction.atomic():
            DBCliente.objects.bulk_create(clientes_batch)
            clientes_importados += len(clientes_batch)
    
    if debitos_batch:
        with transaction.atomic():
            DBDebito.objects.bulk_create(debitos_batch)
            debitos_importados += len(debitos_batch)

    logger.info(f"Processamento concluído. Clientes: {clientes_importados}, Débitos: {debitos_importados}, Inválidos: {invalid_rows}")

    return JsonResponse({
        "message": "Upload processado com sucesso",
        "clientes_importados": clientes_importados,
        "debitos_importados": debitos_importados,
        "linhas_invalidas": invalid_rows,
    })


def process_siape_debito(row, cliente, campanha_obj):
    matricula = row.get("matricula", "")
    if not matricula:
        return False
    try:
        prazo = int(row.get("prazo") or 0)
    except:
        prazo = None
    contrato = row.get("cod_contrato") or row.get("contrato", "")
    debito_data = {
        "matricula": matricula,
        "cod_banco": row.get("cod_banco", ""),
        "valor_parcela": to_decimal(row.get("valor_parcela")),
        "cod_contrato": contrato,
        "prazo": prazo,
        "campanha": campanha_obj,
    }
    try:
        DBDebito.objects.create(cliente=cliente, produto="SIAPE", **debito_data)
        return True
    except:
        return False


def process_inss_debito(row, cliente, campanha_obj):
    matricula = row.get("beneficio") or row.get("matricula", "")
    if not matricula:
        return False
    try:
        prazo = int(row.get("prazo") or 0)
    except:
        prazo = None
    debito_data = {
        "matricula": matricula,
        "cod_banco": row.get("cod_banco", ""),
        "valor_parcela": to_decimal(row.get("valor_parcela")),
        "tipo_emprestimo": row.get("tipo_emprestimo", ""),
        "cod_contrato": row.get("contrato", ""),
        "prazo": prazo,
        "taxa": to_decimal(row.get("taxa")),
        "restantes": to_decimal(row.get("parcelas_restantes")),
        "campanha": campanha_obj,
    }
    try:
        DBDebito.objects.create(cliente=cliente, produto="INSS", **debito_data)
        return True
    except:
        return False







@csrf_exempt
def api_create_campaign(request):
    """
    View para criação de uma nova campanha.
    Espera receber, via POST (JSON ou form-data):
      - 'nome' (obrigatório)
      - 'descricao' (opcional)
      - 'status' (opcional, default True)
      - 'equipes' (opcional, lista de IDs de Equipe)
    """
    if request.method != "POST":
        return JsonResponse({"error": "Método não permitido"}, status=405)
    
    try:
        # Tenta interpretar os dados como JSON; caso não consiga, usa request.POST.
        data = json.loads(request.body) if request.body else request.POST
    except Exception as e:
        return JsonResponse({"error": "Dados inválidos: " + str(e)}, status=400)
    
    nome = data.get("nome", "").strip()
    if not nome:
        return JsonResponse({"error": "O campo 'nome' é obrigatório."}, status=400)
    
    descricao = data.get("descricao", "").strip() if data.get("descricao") else ""
    status_value = data.get("status", True)
    if isinstance(status_value, str):
        status_value = status_value.lower() == "true"
    else:
        status_value = bool(status_value)
    
    campanha = DBCampanha.objects.create(
        nome=nome,
        descricao=descricao,
        status=status_value
    )
    
    # Se for enviado um campo 'equipes' com lista de IDs, associa as equipes à campanha
    equipes = data.get("equipes")
    if equipes:
        try:
            # Caso venha como string JSON, converte para lista
            if isinstance(equipes, str):
                equipes = json.loads(equipes)
            campanha.equipes.set(equipes)
        except Exception as e:
            print("Erro ao associar equipes:", e)
    
    return JsonResponse({
        "message": "Campanha criada com sucesso.",
        "campanha": {
            "id": campanha.id,
            "nome": campanha.nome,
            "descricao": campanha.descricao,
            "status": campanha.status,
            "data_criacao": campanha.data_criacao,
        }
    })

def api_list_campaigns(request):
    """
    View para listar todas as campanhas.
    Retorna uma lista de campanhas com seus dados.
    """
    if request.method != "GET":
        return JsonResponse({"error": "Método não permitido"}, status=405)
    
    campanhas = DBCampanha.objects.all().order_by("-data_criacao")
    campanhas_list = []
    for campanha in campanhas:
        campanhas_list.append({
            "id": campanha.id,
            "nome": campanha.nome,
            "descricao": campanha.descricao,
            "status": campanha.status,
            "data_criacao": campanha.data_criacao,
            # Opcional: lista de IDs de equipes associadas
            "equipes": list(campanha.equipes.values_list("id", flat=True)),
        })
    
    return JsonResponse({"campanhas": campanhas_list})


@require_GET
@login_required(login_url='/')
def api_get_baseclientes(request):
    """
    Retorna JSON com cliente + débitos baseado na equipe/campanha do usuário.
    Suporta SIAPE, INSS (via DBCliente) e FGTS (via FGTSCliente).
    """
    user = request.user

    equipes_ativas = user.equipes_moneyplus.filter(status=True)
    if not equipes_ativas.exists():
        return JsonResponse({"error": "Usuário sem equipe ativa."}, status=403)

    campanha = DBCampanha.objects.filter(
        equipes__in=equipes_ativas,
        status=True
    ).distinct().first()
    if not campanha:
        return JsonResponse({"error": "Nenhuma campanha ativa."}, status=403)

    cliente = None
    is_fgts = False

    # 1º tenta pegar um DBCliente com status ENTREGUE
    controle = ControleClientesCampanha.objects.filter(
        user=user,
        campanha=campanha,
        status=ControleClientesCampanha.STATUS_ENTREGUE,
        db_cliente__isnull=False
    ).select_related('db_cliente').first()

    if controle:
        cliente = controle.db_cliente
    else:
        # 2º encontra próximo DBCliente não tabulado
        tabulados_ids = ControleClientesCampanha.objects.filter(
            campanha=campanha,
            db_cliente__isnull=False
        ).exclude(status=ControleClientesCampanha.STATUS_ENTREGUE) \
         .values_list('db_cliente_id', flat=True)

        cliente = DBCliente.objects.filter(
            campanha=campanha
        ).exclude(id__in=tabulados_ids).first()

        if cliente:
            ControleClientesCampanha.objects.create(
                user=user,
                campanha=campanha,
                db_cliente=cliente,
                status=ControleClientesCampanha.STATUS_ENTREGUE
            )

    # 3º se ainda não achou DBCliente, tenta FGTSCliente
    if not cliente:
        controle_fgts = ControleClientesCampanha.objects.filter(
            user=user,
            campanha=campanha,
            status=ControleClientesCampanha.STATUS_ENTREGUE,
            fgts_cliente__isnull=False
        ).select_related('fgts_cliente').first()

        if controle_fgts:
            cliente = controle_fgts.fgts_cliente
            is_fgts = True
        else:
            tabulados_fgts_ids = ControleClientesCampanha.objects.filter(
                campanha=campanha,
                fgts_cliente__isnull=False
            ).exclude(status=ControleClientesCampanha.STATUS_ENTREGUE) \
             .values_list('fgts_cliente_id', flat=True)

            cliente = FGTSCliente.objects.filter(
                campanha=campanha
            ).exclude(id__in=tabulados_fgts_ids).first()

            if cliente:
                is_fgts = True
                try:
                    ControleClientesCampanha.objects.create(
                        user=user,
                        campanha=campanha,
                        fgts_cliente=cliente,
                        status=ControleClientesCampanha.STATUS_ENTREGUE
                    )
                except IntegrityError:
                    # registro já existe, ignora para não causar 500 ❌
                    pass

    if not cliente:
        return JsonResponse({"error": "Nenhum cliente disponível."}, status=404)

    # Monta resposta
    if is_fgts:
        c = cliente
        cliente_data = {
            "id": c.id,
            "produto": "FGTS",
            "cpf": c.cpf,
            "nome_completo": c.nome,
            "data_nasc": c.data_nascimento.isoformat(),
            "idade": c.idade,
            "tipo": c.tipo,
            "logradouro": c.logradouro,
            "numero": c.numero,
            "complemento": c.complemento,
            "bairro": c.bairro,
            "cidade": c.cidade,
            "uf": c.uf,
            "cep": c.cep,
            "salario": float(c.salario),
            "saldo_aproximado": float(c.saldo_aproximado),
            "data_admissao": c.data_admissao.isoformat(),
            "razao_social": c.razao_social,
            "tempo_contribuicao": c.tempo_contribuicao,
            "demografica": c.demografica,
            "possivel_profissao": c.possivel_profissao,
            "score": c.score,
            "flag_fgts": c.flag_fgts,
            "cel1": c.cel1,
            "procon_cel1": c.procon_cel1,
            "fl_whatsapp_cel1": c.fl_whatsapp_cel1,
            "cel2": c.cel2,
            "procon_cel2": c.procon_cel2,
            "fl_whatsapp_cel2": c.fl_whatsapp_cel2,
            "email1": c.email1,
        }
        debitos_data = []
    else:
        c = cliente
        cliente_data = {
            "id": c.id,
            "produto": c.produto,
            "nome_completo": c.nome_completo,
            "cpf": c.cpf,
            "data_nasc": c.data_nasc.isoformat() if c.data_nasc else None,
            "idade": c.idade,
            "rg": c.rg,
            "cidade": c.cidade,
            "uf": c.uf,
            "cep": c.cep,
            "rjur": c.rjur,
            "situacao_funcional": c.situacao_funcional,
            "liberacao_emprestimo": c.liberacao_emprestimo,
            "qtd_emprestimos": c.qtd_emprestimos,
            "total_credito": float(c.total_credito) if c.total_credito is not None else None,
            "total_debitos": float(c.total_debitos) if c.total_debitos is not None else None,
            "total_liquido": float(c.total_liquido) if c.total_liquido is not None else None,
            "margem_disponivel_geral": float(c.margem_disponivel_geral) if c.margem_disponivel_geral is not None else None,
            "celular_1": c.celular_1,
            "flg_wts_1": c.flg_wts_1,
            "celular_2": c.celular_2,
            "flg_wts_2": c.flg_wts_2,
            "celular_3": c.celular_3,
            "flg_wts_3": c.flg_wts_3,
            "flg_desconto": c.flg_desconto,
            "taxa_associativa": c.taxa_associativa,
            "parcela": float(c.parcela) if c.parcela is not None else None,
            "rmc_saldo": float(c.rmc_saldo) if c.rmc_saldo is not None else None,
            "rcc_saldo": float(c.rcc_saldo) if c.rcc_saldo is not None else None,
            "rmc_bruta": float(c.rmc_bruta) if c.rmc_bruta is not None else None,
            "rmc_util": float(c.rmc_util) if c.rmc_util is not None else None,
            "rcc_bruta": float(c.rcc_bruta) if c.rcc_bruta is not None else None,
            "rcc_util": float(c.rcc_util) if c.rcc_util is not None else None,
            "trinta_cinco_bruta": float(c.trinta_cinco_bruta) if c.trinta_cinco_bruta is not None else None,
            "trinta_cinco_util": float(c.trinta_cinco_util) if c.trinta_cinco_util is not None else None,
            "trinta_cinco_saldo": float(c.trinta_cinco_saldo) if c.trinta_cinco_saldo is not None else None,
        }
        debitos_data = list(DBDebito.objects.filter(cliente=c).values())

    return JsonResponse({
        "cliente": cliente_data,
        "debitos": debitos_data,
        "campanha_id": campanha.id
    })

logger = logging.getLogger(__name__)

def login_required_ajax(view_func):
    def _wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            if request.is_ajax():
                return JsonResponse({"error": "Não autenticado."}, status=401)
            return HttpResponseRedirect('/')
        return view_func(request, *args, **kwargs)
    return _wrapped

@require_POST
@login_required_ajax
def api_post_tabulacao(request):
    """
    Atualiza o status de tabulação baseado em cliente_id/campanha_id/produto.
    Recebe form-data com:
      - cliente_id
      - campanha_id
      - produto (INSS, SIAPE ou FGTS)
      - status (AGENDADO, EM_NEGOCIACAO, NAO_QUIS, INELEGIVEL, SOLICITACAO_BLOQUEIO)
    """
    try:
        cliente_id   = request.POST.get('cliente_id')
        campanha_id  = request.POST.get('campanha_id')
        produto      = request.POST.get('produto', '').strip().upper()
        novo_status  = request.POST.get('status')

        if not all([cliente_id, campanha_id, produto, novo_status]):
            return JsonResponse({"error": "Todos os campos são obrigatórios."}, status=400)

        # valida status
        valid = [s for s, _ in ControleClientesCampanha.STATUS_CHOICES
                 if s != ControleClientesCampanha.STATUS_ENTREGUE]
        if novo_status not in valid:
            return JsonResponse({"error": f"Status inválido. Use: {', '.join(valid)}."}, status=400)

        user = request.user

        # valida campanha
        if user.is_superuser or user.is_staff:
            camp_qs = DBCampanha.objects.filter(id=campanha_id, status=True)
        else:
            equipes = user.equipes.filter(status=True)
            camp_qs = DBCampanha.objects.filter(
                id=campanha_id, status=True, equipes__in=equipes
            )
        campanha = camp_qs.distinct().first()
        if not campanha:
            return JsonResponse({"error": "Campanha não autorizada."}, status=403)

        # busca cliente
        is_fgts = (produto == 'FGTS')
        if is_fgts:
            try:
                cliente = FGTSCliente.objects.get(id=cliente_id, campanha=campanha)
            except FGTSCliente.DoesNotExist:
                return JsonResponse({"error": "Cliente FGTS não encontrado."}, status=404)
        else:
            try:
                cliente = DBCliente.objects.get(id=cliente_id, campanha=campanha, produto=produto)
            except DBCliente.DoesNotExist:
                return JsonResponse({"error": "Cliente DBCliente não encontrado."}, status=404)

        # busca controle ENTREGUE
        lookup = {
            'user': user,
            'campanha': campanha,
            'status': ControleClientesCampanha.STATUS_ENTREGUE
        }
        lookup['fgts_cliente' if is_fgts else 'db_cliente'] = cliente

        try:
            controle = ControleClientesCampanha.objects.get(**lookup)
        except ControleClientesCampanha.DoesNotExist:
            return JsonResponse({"error": "Nenhum cliente ENTREGUE para tabulação."}, status=404)

        # atualiza
        with transaction.atomic():
            controle.status = novo_status
            controle.save()

        return JsonResponse({"success": True})

    except Exception as e:
        logger.exception("Erro em api_post_tabulacao")
        return JsonResponse({"error": str(e)}, status=500)

    

@require_GET
@login_required(login_url='/')
def api_get_agendamentos(request):
    """
    Lista agendamentos 'Em Espera' da campanha ativa do usuário.
    Retorna JSON com id, cliente_id, cliente_nome, produto, data, hora
    """
    try:
        user = request.user
        # campanhas permitidas
        if user.is_superuser or user.is_staff:
            campanhas_qs = DBCampanha.objects.filter(status=True)
        else:
            equipes = user.equipes.filter(status=True)
            campanhas_qs = DBCampanha.objects.filter(equipes__in=equipes, status=True)
        campanha = campanhas_qs.distinct().first()
        if not campanha:
            return JsonResponse({"error": "Nenhuma campanha ativa para o usuário."}, status=403)

        qs = AgendamentoCliente.objects.filter(
            campanha=campanha,
            status=AgendamentoCliente.STATUS_EM_ESPERA
        ).select_related('db_cliente', 'fgts_cliente')

        agendamentos = []
        for ag in qs.order_by('dia_agendamento', 'hora'):
            if ag.db_cliente:
                cli = ag.db_cliente
                produto = cli.produto
                nome = cli.nome_completo
            else:
                cli = ag.fgts_cliente
                produto = 'FGTS'
                nome = cli.nome
            agendamentos.append({
                "id": ag.id,
                "cliente_id": cli.id,
                "cliente_nome": nome,
                "produto": produto,
                "data": ag.dia_agendamento.isoformat(),
                "hora": ag.hora.strftime("%H:%M")
            })
        return JsonResponse({"agendamentos": agendamentos})

    except Exception as e:
        logger.exception("Erro em api_get_agendamentos")
        return JsonResponse({"error": str(e)}, status=500)

@require_POST
@login_required(login_url='/')
def api_post_agendamento(request):
    """
    Cria um AgendamentoCliente.
    Recebe via POST:
      - cliente_id
      - campanha_id
      - produto (INSS, SIAPE ou FGTS)
      - data (YYYY-MM-DD)
      - hora (HH:MM)
      - responsavel
    """
    try:
        cliente_id  = request.POST.get('cliente_id')
        campanha_id = request.POST.get('campanha_id')
        produto     = request.POST.get('produto', '').strip().upper()
        dia_str     = request.POST.get('data')
        hora_str    = request.POST.get('hora')
        responsavel = request.POST.get('responsavel')

        if not all([cliente_id, campanha_id, produto, dia_str, hora_str, responsavel]):
            return JsonResponse({"error": "Todos os campos são obrigatórios."}, status=400)
        if produto not in ['INSS', 'SIAPE', 'FGTS']:
            return JsonResponse({"error": "Produto inválido."}, status=400)

        # parse date/time
        try:
            dia_obj = datetime.strptime(dia_str, "%Y-%m-%d").date()
            hora_obj = datetime.strptime(hora_str, "%H:%M").time()
        except ValueError:
            return JsonResponse({"error": "Formato de data/hora inválido."}, status=400)

        user = request.user
        # valida campanha
        if user.is_superuser or user.is_staff:
            campanhas_qs = DBCampanha.objects.filter(id=campanha_id, status=True)
        else:
            equipes = user.equipes.filter(status=True)
            campanhas_qs = DBCampanha.objects.filter(id=campanha_id, status=True, equipes__in=equipes)
        campanha = campanhas_qs.distinct().first()
        if not campanha:
            return JsonResponse({"error": "Campanha não autorizada."}, status=403)

        # busca cliente no modelo correto
        if produto == 'FGTS':
            try:
                cliente = FGTSCliente.objects.get(id=cliente_id, campanha=campanha)
            except FGTSCliente.DoesNotExist:
                return JsonResponse({"error": "Cliente FGTS não encontrado."}, status=404)
        else:
            try:
                cliente = DBCliente.objects.get(id=cliente_id, campanha=campanha, produto=produto)
            except DBCliente.DoesNotExist:
                return JsonResponse({"error": "Cliente DBCliente não encontrado."}, status=404)

        # cria agendamento
        with transaction.atomic():
            if produto == 'FGTS':
                ag = AgendamentoCliente.objects.create(
                    fgts_cliente=cliente,
                    campanha=campanha,
                    dia_agendamento=dia_obj,
                    hora=hora_obj,
                    responsavel=responsavel
                )
            else:
                ag = AgendamentoCliente.objects.create(
                    db_cliente=cliente,
                    campanha=campanha,
                    dia_agendamento=dia_obj,
                    hora=hora_obj,
                    responsavel=responsavel
                )

        return JsonResponse({
            "success": True,
            "agendamento": {
                "id": ag.id,
                "cliente_id": cliente.id,
                "produto": produto,
                "campanha_id": campanha.id,
                "data": ag.dia_agendamento.isoformat(),
                "hora": ag.hora.strftime("%H:%M"),
                "responsavel": ag.responsavel
            }
        })

    except Exception as e:
        logger.exception("Erro em api_post_agendamento")
        return JsonResponse({"error": str(e)}, status=500)

@require_POST
@login_required(login_url='/')
def api_post_confirm_agendamento(request):
    """
    Confirma um agendamento, alterando status para 'Realizado'.
    Recebe via POST:
      - agendamento_id
    """
    try:
        agendamento_id = request.POST.get('agendamento_id')
        if not agendamento_id:
            return JsonResponse({"error": "agendamento_id é obrigatório."}, status=400)

        # busca agendamento
        try:
            ag = AgendamentoCliente.objects.select_related('campanha').get(pk=agendamento_id)
        except AgendamentoCliente.DoesNotExist:
            return JsonResponse({"error": "Agendamento não encontrado."}, status=404)

        # permissão
        user = request.user
        if not (user.is_superuser or user.is_staff):
            equipes = user.equipes.filter(status=True)
            if not DBCampanha.objects.filter(
                id=ag.campanha.id, status=True, equipes__in=equipes
            ).exists():
                return JsonResponse({"error": "Permissão negada."}, status=403)

        # atualiza
        if ag.status == AgendamentoCliente.STATUS_REALIZADO:
            return JsonResponse({"error": "Agendamento já realizado."}, status=400)
        ag.status = AgendamentoCliente.STATUS_REALIZADO
        ag.save()

        return JsonResponse({"success": True, "agendamento_id": ag.id, "novo_status": ag.status})
    except Exception as e:
        logger.exception("Erro em api_post_confirm_agendamento")
        return JsonResponse({"error": str(e)}, status=500)

@require_GET
@login_required_ajax
def api_get_cliente(request):
    """
    Retorna JSON com dados de um cliente específico via cliente_id e produto.
    """
    user = request.user
    cliente_id = request.GET.get('cliente_id')
    produto = request.GET.get('produto', '').strip().upper()

    if not cliente_id or not produto:
        return JsonResponse({"error": "cliente_id e produto são obrigatórios."}, status=400)
    
    try:
        cliente_id = int(cliente_id)
    except ValueError:
        return JsonResponse({"error": "cliente_id inválido."}, status=400)

    equipes_ativas = user.equipes.filter(status=True)
    if not equipes_ativas.exists():
        return JsonResponse({"error": "Usuário sem equipe ativa."}, status=403)

    campanha = DBCampanha.objects.filter(equipes__in=equipes_ativas, status=True).distinct().first()
    if not campanha:
        return JsonResponse({"error": "Nenhuma campanha ativa para o usuário."}, status=403)

    if produto == 'FGTS':
        try:
            cliente = FGTSCliente.objects.get(id=cliente_id, campanha=campanha)
        except FGTSCliente.DoesNotExist:
            return JsonResponse({"error": "Cliente FGTS não encontrado nesta campanha."}, status=404)

        cliente_data = {
            "id": cliente.id,
            "produto": "FGTS",
            "cpf": cliente.cpf,
            "nome_completo": cliente.nome,
            "data_nasc": cliente.data_nascimento.isoformat(),
            "idade": cliente.idade,
            "tipo": cliente.tipo,
            "logradouro": cliente.logradouro,
            "numero": cliente.numero,
            "complemento": cliente.complemento,
            "bairro": cliente.bairro,
            "cidade": cliente.cidade,
            "uf": cliente.uf,
            "cep": cliente.cep,
            "salario": float(cliente.salario),
            "saldo_aproximado": float(cliente.saldo_aproximado),
            "data_admissao": cliente.data_admissao.isoformat(),
            "razao_social": cliente.razao_social,
            "tempo_contribuicao": cliente.tempo_contribuicao,
            "demografica": cliente.demografica,
            "possivel_profissao": cliente.possivel_profissao,
            "score": cliente.score,
            "flag_fgts": cliente.flag_fgts,
            "cel1": cliente.cel1,
            "procon_cel1": cliente.procon_cel1,
            "fl_whatsapp_cel1": cliente.fl_whatsapp_cel1,
            "cel2": cliente.cel2,
            "procon_cel2": cliente.procon_cel2,
            "fl_whatsapp_cel2": cliente.fl_whatsapp_cel2,
            "email1": cliente.email1,
        }

        return JsonResponse({
            "cliente": cliente_data,
            "debitos": [],
            "campanha_id": campanha.id
        })

    else:
        try:
            cliente = DBCliente.objects.get(id=cliente_id, campanha=campanha)
        except DBCliente.DoesNotExist:
            return JsonResponse({"error": "Cliente não encontrado nesta campanha."}, status=404)

        cliente_data = {
            "id": cliente.id,
            "produto": cliente.produto,
            "nome_completo": cliente.nome_completo,
            "cpf": cliente.cpf,
            "data_nasc": cliente.data_nasc.isoformat() if cliente.data_nasc else None,
            "idade": cliente.idade,
            "rg": cliente.rg,
            "cidade": cliente.cidade,
            "uf": cliente.uf,
            "cep": cliente.cep,
            "rjur": cliente.rjur,
            "situacao_funcional": cliente.situacao_funcional,
            "liberacao_emprestimo": cliente.liberacao_emprestimo,
            "qtd_emprestimos": cliente.qtd_emprestimos,
            "total_credito": float(cliente.total_credito) if cliente.total_credito is not None else None,
            "total_debitos": float(cliente.total_debitos) if cliente.total_debitos is not None else None,
            "total_liquido": float(cliente.total_liquido) if cliente.total_liquido is not None else None,
            "margem_disponivel_geral": float(cliente.margem_disponivel_geral) if cliente.margem_disponivel_geral is not None else None,
            "celular_1": cliente.celular_1,
            "flg_wts_1": cliente.flg_wts_1,
            "celular_2": cliente.celular_2,
            "flg_wts_2": cliente.flg_wts_2,
            "celular_3": cliente.celular_3,
            "flg_wts_3": cliente.flg_wts_3,
            "flg_desconto": cliente.flg_desconto,
            "taxa_associativa": cliente.taxa_associativa,
            "parcela": float(cliente.parcela) if cliente.parcela is not None else None,
            "rmc_saldo": float(cliente.rmc_saldo) if cliente.rmc_saldo is not None else None,
            "rcc_saldo": float(cliente.rcc_saldo) if cliente.rcc_saldo is not None else None,
            "rmc_bruta": float(cliente.rmc_bruta) if cliente.rmc_bruta is not None else None,
            "rmc_util": float(cliente.rmc_util) if cliente.rmc_util is not None else None,
            "rcc_bruta": float(cliente.rcc_bruta) if cliente.rcc_bruta is not None else None,
            "rcc_util": float(cliente.rcc_util) if cliente.rcc_util is not None else None,
            "trinta_cinco_bruta": float(cliente.trinta_cinco_bruta) if cliente.trinta_cinco_bruta is not None else None,
            "trinta_cinco_util": float(cliente.trinta_cinco_util) if cliente.trinta_cinco_util is not None else None,
            "trinta_cinco_saldo": float(cliente.trinta_cinco_saldo) if cliente.trinta_cinco_saldo is not None else None,
        }

        debitos_data = list(DBDebito.objects.filter(cliente=cliente).values())

        return JsonResponse({
            "cliente": cliente_data,
            "debitos": debitos_data,
            "campanha_id": campanha.id
        })
