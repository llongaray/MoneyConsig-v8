# Generated by Django 5.1 on 2025-05-23 12:00

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('usuarios', '0004_alter_alertati_audio'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AlertaTIVisto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data_visualizacao', models.DateTimeField(auto_now_add=True)),
                ('alerta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vistos', to='usuarios.alertati')),
                ('usuario', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alertas_vistos', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Alerta TI Visto',
                'verbose_name_plural': 'Alertas TI Vistos',
                'unique_together': {('alerta', 'usuario')},
            },
        ),
    ]
