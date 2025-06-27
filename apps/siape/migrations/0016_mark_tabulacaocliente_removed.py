# Generated manually to prevent Django from trying to remove already removed models

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('siape', '0015_remove_tabulacaocliente_cliente_and_more'),
    ]

    operations = [
        # Esta migração marca explicitamente que os modelos TabulacaoCliente e HistoricoTabulacao
        # já foram removidos manualmente na migração 0010, evitando que o Django continue
        # tentando removê-los em futuras migrações automáticas
        migrations.RunSQL(
            "SELECT 1;",  # No-op SQL command
            reverse_sql="-- Cannot reverse this operation"
        ),
    ] 