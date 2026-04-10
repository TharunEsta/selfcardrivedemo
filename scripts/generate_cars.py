import bpy
import math
import os
from mathutils import Vector


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPORT_DIR = os.path.join(ROOT_DIR, "public", "models")
os.makedirs(EXPORT_DIR, exist_ok=True)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.outliner.orphans_purge(do_recursive=True)


def ensure_world():
    world = bpy.data.worlds.new("StudioWorld")
    bpy.context.scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputWorld")
    background = nodes.new("ShaderNodeBackground")
    env_mix = nodes.new("ShaderNodeMixRGB")
    gradient = nodes.new("ShaderNodeTexGradient")
    mapping = nodes.new("ShaderNodeMapping")
    tex_coord = nodes.new("ShaderNodeTexCoord")
    ramp = nodes.new("ShaderNodeValToRGB")

    env_mix.blend_type = "MIX"
    env_mix.inputs[0].default_value = 1.0
    env_mix.inputs[1].default_value = (0.02, 0.025, 0.03, 1.0)
    env_mix.inputs[2].default_value = (0.42, 0.46, 0.55, 1.0)
    background.inputs["Strength"].default_value = 0.8
    ramp.color_ramp.elements[0].color = (0.95, 0.97, 1.0, 1.0)
    ramp.color_ramp.elements[1].color = (0.04, 0.05, 0.06, 1.0)
    mapping.inputs["Rotation"].default_value[1] = math.radians(90)

    links.new(tex_coord.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], gradient.inputs["Vector"])
    links.new(gradient.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], env_mix.inputs[2])
    links.new(env_mix.outputs["Color"], background.inputs["Color"])
    links.new(background.outputs["Background"], output.inputs["Surface"])


def add_camera():
    bpy.ops.object.camera_add(location=(7.5, -7.2, 3.4), rotation=(math.radians(78), 0, math.radians(46)))
    camera = bpy.context.active_object
    camera.data.lens = 52
    bpy.context.scene.camera = camera


def add_floor():
    bpy.ops.mesh.primitive_plane_add(size=24, location=(0, 0, 0))
    floor = bpy.context.active_object
    floor.name = "Floor"
    floor_mat = bpy.data.materials.new("FloorMaterial")
    floor_mat.use_nodes = True
    bsdf = floor_mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.03, 0.035, 0.045, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.22
    bsdf.inputs["Metallic"].default_value = 0.0
    floor.data.materials.append(floor_mat)
    return floor


def add_light(location, energy, size, rotation):
    bpy.ops.object.light_add(type="AREA", location=location, rotation=rotation)
    light = bpy.context.active_object
    light.data.energy = energy
    light.data.shape = "RECTANGLE"
    light.data.size = size[0]
    light.data.size_y = size[1]
    return light


def build_material(name, base_color, metallic=0.0, roughness=0.35, transmission=0.0, clearcoat=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Transmission Weight"].default_value = transmission
    bsdf.inputs["Coat Weight"].default_value = clearcoat
    return material


def add_cube(name, location, scale, bevel=0.05):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.modifier_add(type="BEVEL")
    obj.modifiers["Bevel"].width = bevel
    obj.modifiers["Bevel"].segments = 3
    bpy.ops.object.shade_smooth()
    return obj


def add_cylinder(name, location, rotation, radius, depth, vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return obj


def join_parts(parts, name):
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
      part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def add_wheel_pack(track_width, wheelbase, radius=0.42, width=0.24):
    wheels = []
    offsets = [
        (-wheelbase / 2, track_width / 2, radius),
        (-wheelbase / 2, -track_width / 2, radius),
        (wheelbase / 2, track_width / 2, radius),
        (wheelbase / 2, -track_width / 2, radius),
    ]

    tire_material = build_material("TireMaterial", (0.07, 0.07, 0.07), roughness=0.85)
    wheel_material = build_material("WheelMaterial", (0.42, 0.45, 0.5), metallic=0.85, roughness=0.28)

    for index, loc in enumerate(offsets):
        tire = add_cylinder(f"Tire_{index}", loc, (math.radians(90), 0, 0), radius, width)
        rim = add_cylinder(
            f"Wheel_{index}",
            (loc[0], loc[1], loc[2]),
            (math.radians(90), 0, 0),
            radius * 0.6,
            width * 1.1,
            vertices=24,
        )
        tire.data.materials.append(tire_material)
        rim.data.materials.append(wheel_material)
        wheels.extend([tire, rim])
    return wheels


def apply_turntable_animation(root):
    root.rotation_euler = (0, 0, 0)
    root.keyframe_insert(data_path="rotation_euler", frame=1)
    root.rotation_euler[2] = math.radians(360)
    root.keyframe_insert(data_path="rotation_euler", frame=240)

    action = root.animation_data.action
    for fcurve in action.fcurves:
        for point in fcurve.keyframe_points:
            point.interpolation = "LINEAR"


def export_glb(filename):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "EMPTY"} and obj.name not in {"Floor"}:
            obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(EXPORT_DIR, filename),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_animations=True,
        export_apply=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_draco_mesh_compression_enable=False,
    )


def setup_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.eevee.taa_render_samples = 64
    scene.eevee.use_gtao = True
    scene.frame_start = 1
    scene.frame_end = 240
    scene.render.film_transparent = True


def parent_to_root(parts, name):
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = name
    for part in parts:
        part.parent = root
    return root


def build_innova():
    body = add_cube("Body", (0, 0, 1.18), (2.2, 0.92, 0.58), bevel=0.08)
    cabin = add_cube("GlassCabin", (0.15, 0, 1.85), (1.5, 0.82, 0.45), bevel=0.06)
    grille = add_cube("ChromeGrille", (2.23, 0, 1.23), (0.08, 0.62, 0.22), bevel=0.02)
    hood = add_cube("BodyHood", (1.62, 0, 1.38), (0.86, 0.86, 0.18), bevel=0.03)
    rear = add_cube("BodyRear", (-2.0, 0, 1.32), (0.22, 0.88, 0.3), bevel=0.04)
    light_l = add_cube("LightFrontL", (2.16, 0.64, 1.28), (0.07, 0.16, 0.12), bevel=0.02)
    light_r = add_cube("LightFrontR", (2.16, -0.64, 1.28), (0.07, 0.16, 0.12), bevel=0.02)
    lights = [light_l, light_r]
    wheels = add_wheel_pack(track_width=1.56, wheelbase=3.1, radius=0.48, width=0.28)
    parts = [body, cabin, grille, hood, rear, *lights, *wheels]
    root = parent_to_root(parts, "InnovaCrysta")
    return root


def build_gypsy():
    body = add_cube("Body", (0, 0, 1.16), (1.86, 0.84, 0.54), bevel=0.04)
    roof = add_cube("BodyRoof", (-0.18, 0, 1.82), (1.08, 0.8, 0.34), bevel=0.02)
    glass = add_cube("GlassCabin", (0.12, 0, 1.62), (1.18, 0.78, 0.28), bevel=0.02)
    grille = add_cube("ChromeGrille", (1.92, 0, 1.16), (0.07, 0.58, 0.22), bevel=0.01)
    bumper = add_cube("ChromeBumper", (1.98, 0, 0.68), (0.1, 0.72, 0.09), bevel=0.01)
    lights = [
        add_cube("LightFrontL", (1.9, 0.52, 1.16), (0.05, 0.11, 0.11), bevel=0.01),
        add_cube("LightFrontR", (1.9, -0.52, 1.16), (0.05, 0.11, 0.11), bevel=0.01),
    ]
    wheels = add_wheel_pack(track_width=1.48, wheelbase=2.44, radius=0.5, width=0.32)
    parts = [body, roof, glass, grille, bumper, *lights, *wheels]
    root = parent_to_root(parts, "Gypsy")
    return root


def build_swift():
    body = add_cube("Body", (0, 0, 1.0), (1.88, 0.84, 0.46), bevel=0.08)
    cabin = add_cube("GlassCabin", (0.0, 0, 1.55), (1.14, 0.78, 0.32), bevel=0.08)
    rear = add_cube("BodyRear", (-1.56, 0, 1.2), (0.28, 0.8, 0.24), bevel=0.04)
    hood = add_cube("BodyHood", (1.24, 0, 1.18), (0.58, 0.78, 0.14), bevel=0.04)
    grille = add_cube("ChromeGrille", (1.86, 0, 1.02), (0.06, 0.46, 0.16), bevel=0.02)
    lights = [
        add_cube("LightFrontL", (1.78, 0.52, 1.1), (0.06, 0.13, 0.1), bevel=0.02),
        add_cube("LightFrontR", (1.78, -0.52, 1.1), (0.06, 0.13, 0.1), bevel=0.02),
    ]
    wheels = add_wheel_pack(track_width=1.46, wheelbase=2.48, radius=0.41, width=0.23)
    parts = [body, cabin, rear, hood, grille, *lights, *wheels]
    root = parent_to_root(parts, "Swift")
    return root


def build_dzire():
    body = add_cube("Body", (0, 0, 1.02), (1.98, 0.84, 0.47), bevel=0.08)
    cabin = add_cube("GlassCabin", (-0.12, 0, 1.55), (1.0, 0.78, 0.31), bevel=0.08)
    trunk = add_cube("BodyRear", (-1.78, 0, 1.12), (0.42, 0.78, 0.18), bevel=0.04)
    hood = add_cube("BodyHood", (1.35, 0, 1.16), (0.62, 0.78, 0.14), bevel=0.04)
    grille = add_cube("ChromeGrille", (1.96, 0, 1.03), (0.06, 0.5, 0.16), bevel=0.02)
    lights = [
        add_cube("LightFrontL", (1.88, 0.52, 1.1), (0.06, 0.13, 0.1), bevel=0.02),
        add_cube("LightFrontR", (1.88, -0.52, 1.1), (0.06, 0.13, 0.1), bevel=0.02),
    ]
    wheels = add_wheel_pack(track_width=1.46, wheelbase=2.56, radius=0.42, width=0.23)
    parts = [body, cabin, trunk, hood, grille, *lights, *wheels]
    root = parent_to_root(parts, "Dzire")
    return root


def style_objects():
    body_material = build_material("BodyPaint", (0.95, 0.95, 0.95), metallic=0.18, roughness=0.18, clearcoat=1.0)
    glass_material = build_material("Glass", (0.08, 0.1, 0.12), roughness=0.04, transmission=0.12)
    chrome_material = build_material("Chrome", (0.78, 0.8, 0.84), metallic=0.95, roughness=0.18)
    light_material = build_material("Lights", (0.96, 0.97, 1.0), roughness=0.08, transmission=0.2)
    light_material.node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (0.85, 0.88, 1.0, 1.0)
    light_material.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 0.8

    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        if "Glass" in obj.name:
            obj.data.materials.clear()
            obj.data.materials.append(glass_material)
        elif "Chrome" in obj.name or "Wheel" in obj.name:
            obj.data.materials.clear()
            obj.data.materials.append(chrome_material)
        elif "Light" in obj.name:
            obj.data.materials.clear()
            obj.data.materials.append(light_material)
        elif "Tire" not in obj.name:
            obj.data.materials.clear()
            obj.data.materials.append(body_material)


def finalize(root):
    style_objects()
    apply_turntable_animation(root)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root


def build_and_export(name, builder, filename):
    reset_scene()
    ensure_world()
    setup_render()
    add_camera()
    add_floor()
    add_light((4.5, -5.6, 5.8), 8500, (6, 6), (math.radians(58), 0, math.radians(34)))
    add_light((-5.2, 4.2, 3.4), 3400, (4, 7), (math.radians(76), 0, math.radians(-132)))
    add_light((0, 0, 7.5), 2500, (5, 5), (0, 0, 0))

    root = builder()
    finalize(root)
    export_glb(filename)
    print(f"Exported {name} -> {filename}")


build_and_export("Toyota Innova Crysta", build_innova, "innova_crysta.glb")
build_and_export("Maruti Suzuki Gypsy", build_gypsy, "gypsy.glb")
build_and_export("Maruti Suzuki Swift", build_swift, "swift.glb")
build_and_export("Maruti Suzuki Dzire", build_dzire, "dzire.glb")
