from django.core.management.base import BaseCommand
from django.db import connections, transaction
from apps.siape.models import *
import sqlite3
from datetime import datetime
import os

class Command(BaseCommand):
    help = 'Transfere registros de DebitoMargem, Cliente e InformacoesPessoais entre bancos SQLite'

    def add_arguments(self, parser):
        parser.add_argument(
            '--origem',
            type=str,
            required=True,
            help='Caminho para o arquivo SQLite de origem'
        )
        parser.add_argument(
            '--destino',
            type=str,
            required=True,
            help='Caminho para o arquivo SQLite de destino'
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Força a transferência sem pedir confirmação'
        )
        parser.add_argument(
            '--log',
            action='store_true',
            help='Gera arquivo de log da transferência'
        )

    def handle(self, *args, **options):
        origem_path = options['origem']
        destino_path = options['destino']
        
        # Verifica arquivos
        if not os.path.exists(origem_path):
            self.stdout.write(self.style.ERROR(f'Arquivo de origem não encontrado: {origem_path}'))
            return
        if not os.path.exists(destino_path):
            self.stdout.write(self.style.ERROR(f'Arquivo de destino não encontrado: {destino_path}'))
            return

        # Prepara log
        log_file = None
        if options['log']:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            log_file = open(f'transferencia_dados_{timestamp}.log', 'w')
            self.log(log_file, f'Iniciando transferência em {datetime.now()}')

        try:
            # Conecta aos bancos
            origem_conn = sqlite3.connect(origem_path)
            origem_cursor = origem_conn.cursor()

            # Conta registros
            origem_cursor.execute('SELECT COUNT(*) FROM siape_InformacoesPessoais')
            total_info = origem_cursor.fetchone()[0]
            origem_cursor.execute('SELECT COUNT(*) FROM siape_cliente')
            total_clientes = origem_cursor.fetchone()[0]
            origem_cursor.execute('SELECT COUNT(*) FROM siape_debitomargem')
            total_debitos = origem_cursor.fetchone()[0]

            if not options['force']:
                self.stdout.write(f'\nSerão transferidos:')
                self.stdout.write(f'- {total_info} registros de Informação Pessoal')
                self.stdout.write(f'- {total_clientes} registros de Cliente')
                self.stdout.write(f'- {total_debitos} registros de Débito Margem')
                confirmacao = input('\nDeseja continuar? (sim/não): ')
                if confirmacao.lower() not in ['sim', 's', 'yes', 'y']:
                    self.stdout.write(self.style.WARNING('Operação cancelada pelo usuário.'))
                    return

            # Limpa dados existentes
            with transaction.atomic():
                self.stdout.write('Limpando dados existentes...')
                DebitoMargem.objects.all().delete()
                Cliente.objects.all().delete()
                InformacoesPessoais.objects.all().delete()

            # Transfere InformacoesPessoais
            self.stdout.write('Transferindo Informações Pessoais...')
            origem_cursor.execute('SELECT * FROM siape_InformacoesPessoais')
            for info in origem_cursor.fetchall():
                InformacoesPessoais.objects.create(
                    id=info[0],
                    nome=info[1],
                    cpf=info[2],
                    # adicione outros campos conforme necessário
                )

            # Transfere Cliente
            self.stdout.write('Transferindo Clientes...')
            origem_cursor.execute('SELECT * FROM siape_cliente')
            for cliente in origem_cursor.fetchall():
                info_pessoal = InformacoesPessoais.objects.get(id=cliente[1])  # assumindo que cliente[1] é o info_pessoal_id
                Cliente.objects.create(
                    id=cliente[0],
                    info_pessoal=info_pessoal,
                    # adicione outros campos conforme necessário
                )

            # Transfere DebitoMargem
            self.stdout.write('Transferindo Débitos Margem...')
            origem_cursor.execute('''
                SELECT * FROM siape_debitomargem
            ''')
            for debito in origem_cursor.fetchall():
                cliente = Cliente.objects.get(id=debito[1])  # assumindo que debito[1] é o cliente_id
                campanha = Campanha.objects.get(id=debito[2])  # assumindo que debito[2] é o campanha_id
                DebitoMargem.objects.create(
                    id=debito[0],
                    cliente=cliente,
                    campanha=campanha,
                    # adicione outros campos conforme necessário
                )

            self.stdout.write(self.style.SUCCESS(
                f'\nTransferência concluída!\n'
                f'Informações Pessoais: {total_info}\n'
                f'Clientes: {total_clientes}\n'
                f'Débitos: {total_debitos}'
            ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Erro durante a transferência: {str(e)}'))
            if log_file:
                self.log(log_file, f'ERRO FATAL: {str(e)}')
        
        finally:
            origem_conn.close()
            if log_file:
                log_file.close()

    def log(self, file, message):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        file.write(f'[{timestamp}] {message}\n')
        file.flush()