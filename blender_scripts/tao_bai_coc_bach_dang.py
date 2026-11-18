# Kịch bản Python Blender mẫu tạo mô hình Bãi cọc Bạch Đằng 938 và xuất ra .glb
import bpy
import math

bpy.ops.wm.read_factory_settings(use_empty=True)

# Tạo mặt sông
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
river = bpy.context.active_object
river.name = "Mat_Nuoc_Bach_Dang"

# Tạo hàng cọc gỗ nhọn
for r in range(-2, 3):
    for c in range(-4, 5):
        bpy.ops.mesh.primitive_cone_add(
            vertices=10, radius1=0.14, radius2=0.04, depth=1.6,
            location=(c * 0.9, r * 0.9, 0.2)
        )
        stake = bpy.context.active_object
        stake.name = f"Coc_Go_{r}_{c}"
        stake.rotation_euler = (math.radians(12), 0, 0)

# Xuất ra tệp GLB chuẩn cho WebGL / Three.js
bpy.ops.export_scene.gltf(filepath="bach_dang_custom.glb", export_format="GLB")
