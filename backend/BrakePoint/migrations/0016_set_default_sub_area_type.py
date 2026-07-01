from django.db import migrations


def set_road_segment_default(apps, schema_editor):
    SavedLocation = apps.get_model("BrakePoint", "SavedLocation")
    SavedLocation.objects.filter(
        location_type="sub_area",
        sub_area_type__isnull=True,
    ).update(sub_area_type="road_segment")


class Migration(migrations.Migration):

    dependencies = [
        ("BrakePoint", "0015_savedlocation_sub_area_type"),
    ]

    operations = [
        migrations.RunPython(
            set_road_segment_default,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
