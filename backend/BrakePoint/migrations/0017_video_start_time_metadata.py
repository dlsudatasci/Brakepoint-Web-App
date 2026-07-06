from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("BrakePoint", "0016_set_default_sub_area_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="video",
            name="start_time",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="video",
            name="start_time_source",
            field=models.CharField(blank=True, default="failed", max_length=20),
        ),
    ]