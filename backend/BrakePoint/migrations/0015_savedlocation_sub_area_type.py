from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("BrakePoint", "0014_savedlocation_parent_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="savedlocation",
            name="sub_area_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("road_segment", "Road Segment"),
                    ("intersection", "Intersection"),
                    ("junction", "Junction"),
                ],
                max_length=20,
                null=True,
            ),
        ),
    ]
