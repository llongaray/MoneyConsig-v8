from django.core.management.base import BaseCommand
from django.db import transaction, connection
from apps.siape.models import DebitoMargem, Cliente, InformacoesPessoais
from datetime import datetime

class Command(BaseCommand):
    help = 'Limpa todos os registros das tabelas e reinicia as sequências de IDs'

    def add_arguments(self, parser):
        parser.add_argument(
            '--backup',
            action='store_true',
            help='Criar backup dos dados antes de limpar',
        )
        
        parser.add_argument(
            '--force',
            action='store_true',
            help='Força a limpeza sem pedir confirmação',
        )

    def handle(self, *args, **options):
        try:
            # Conta total de registros
            total_registros_debito = DebitoMargem.objects.count()
            total_registros_cliente = Cliente.objects.count()
            total_registros_info = InformacoesPessoais.objects.count()
            
            if not options['force']:
                confirmacao = input(
                    f'\nATENÇÃO: Isso irá deletar todos os registros e reiniciar os IDs:\n'
                    f'- {total_registros_debito} registros da tabela DebitoMargem\n'
                    f'- {total_registros_cliente} registros da tabela Cliente\n'
                    f'- {total_registros_info} registros da tabela InformacoesPessoais\n'
                    'Tem certeza que deseja continuar? (sim/não): '
                )
                if confirmacao.lower() not in ['sim', 's', 'yes', 'y']:
                    self.stdout.write(self.style.WARNING('Operação cancelada pelo usuário.'))
                    return

            # Backup opcional
            if options['backup']:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f'backup_debitos_{timestamp}.csv'
                
                self.stdout.write(f'Criando backup em {filename}...')
                
                # Exporta dados para CSV
                import csv
                with open(filename, 'w', newline='') as f:
                    writer = csv.writer(f)
                    # Escreve cabeçalho
                    fields = [field.name for field in DebitoMargem._meta.fields]
                    writer.writerow(fields)
                    
                    # Escreve dados em lotes de 1000
                    queryset = DebitoMargem.objects.all().iterator()
                    batch = []
                    for obj in queryset:
                        row = [getattr(obj, field) for field in fields]
                        writer.writerow(row)
                
                self.stdout.write(self.style.SUCCESS(f'Backup criado com sucesso em {filename}'))

            # Deleta os registros e reinicia as sequências usando transaction
            with transaction.atomic():
                with connection.cursor() as cursor:
                    self.stdout.write('Iniciando limpeza das tabelas e reiniciando sequências...')
                    
                    # Desativa temporariamente as chaves estrangeiras para SQLite
                    cursor.execute('PRAGMA foreign_keys=OFF;')
                    
                    # Limpa as tabelas e reinicia as sequências
                    cursor.execute('DELETE FROM siape_debitomargem;')
                    cursor.execute('DELETE FROM sqlite_sequence WHERE name="siape_debitomargem";')
                    
                    cursor.execute('DELETE FROM siape_cliente;')
                    cursor.execute('DELETE FROM sqlite_sequence WHERE name="siape_cliente";')
                    
                    cursor.execute('DELETE FROM siape_informacoespessoais;')
                    cursor.execute('DELETE FROM sqlite_sequence WHERE name="siape_informacoespessoais";')
                    
                    # Reativa as chaves estrangeiras
                    cursor.execute('PRAGMA foreign_keys=ON;')
                
                self.stdout.write(self.style.SUCCESS(
                    f'Tabelas limpas e sequências reiniciadas com sucesso!\n'
                    f'- {total_registros_debito} registros removidos de DebitoMargem\n'
                    f'- {total_registros_cliente} registros removidos de Cliente\n'
                    f'- {total_registros_info} registros removidos de InformacoesPessoais'
                ))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Erro ao limpar tabelas: {str(e)}'))
            raise
