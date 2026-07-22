from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("BrakePoint", "0017_video_start_time_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="savedlocation",
            name="road_polygons",
            field=models.JSONField(blank=True, default=list, null=True),
        ),
    ]