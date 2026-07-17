#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fantasy Landscape Generator for Blender (4.x / 5.x, Cycles)
===========================================================

One fully-procedural script. Every run builds a fresh, randomized, cinematic
fantasy landscape: realistic eroded terrain always; castles, ruins, farm
fields, standing stones, sci-fi spires, distant sky-ships, and far-off
figures appear *sometimes*, subtly, as part of the world.

USAGE
-----
Inside Blender:    open in the Text Editor and press "Run Script".
Headless build:    blender -b -P fantasy_landscape.py -- [options]
Headless render:   blender -b -P fantasy_landscape.py -- --render out.png
As python module:  python fantasy_landscape.py --render out.png
                   (requires `pip install bpy` matching your Blender version)

OPTIONS (all optional)
----------------------
  --seed N            integer seed; omit for a random scene every run
  --mood NAME         golden_hour | misty_dawn | stormy | blue_hour |
                      moonlit | alien_dusk   (omit = random)
  --archetype NAME    alpine | highlands | coast | canyon  (omit = random)
  --with a,b,c        force elements on  (castle,ruins,fields,stones,
                      spire,ships,figures)
  --without a,b,c     force elements off
  --render PATH       render a still to PATH after building
  --save PATH         save the generated .blend to PATH
  --samples N         Cycles samples (default 128)
  --res WxH           resolution (default 1920x1080)
  --grid N            terrain grid resolution (default 512; 256 = faster)
  --fast              quick-preview: smaller grid, fewer samples, less fog
  --no-volumetrics    skip the fog volume (much faster renders)
  --list-moods        print moods and exit
"""

import bpy
import bmesh
import math
import random
import sys
import time
import numpy as np
from mathutils import Vector, Euler

# --------------------------------------------------------------------------
# Arguments
# --------------------------------------------------------------------------

def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    elif argv and argv[0].endswith(".py"):
        argv = argv[1:]
    else:
        argv = []
    opts = {
        "seed": None, "mood": None, "archetype": None,
        "render": None, "save": None, "samples": 128,
        "res": (1920, 1080), "grid": 512, "fast": False,
        "volumetrics": True, "force_on": set(), "force_off": set(),
    }
    i = 0
    while i < len(argv):
        a = argv[i]
        def nxt():
            nonlocal i
            i += 1
            return argv[i]
        if a == "--seed":
            opts["seed"] = int(nxt())
        elif a == "--mood":
            opts["mood"] = nxt()
        elif a == "--archetype":
            opts["archetype"] = nxt()
        elif a == "--render":
            opts["render"] = nxt()
        elif a == "--save":
            opts["save"] = nxt()
        elif a == "--samples":
            opts["samples"] = int(nxt())
        elif a == "--res":
            w, h = nxt().lower().split("x")
            opts["res"] = (int(w), int(h))
        elif a == "--grid":
            opts["grid"] = int(nxt())
        elif a == "--fast":
            opts["fast"] = True
        elif a == "--no-volumetrics":
            opts["volumetrics"] = False
        elif a == "--with":
            opts["force_on"] |= set(nxt().split(","))
        elif a == "--without":
            opts["force_off"] |= set(nxt().split(","))
        elif a == "--list-moods":
            print("Moods:", ", ".join(MOODS.keys()))
            sys.exit(0)
        i += 1
    if opts["fast"]:
        opts["grid"] = min(opts["grid"], 256)
        opts["samples"] = min(opts["samples"], 48)
    return opts


# --------------------------------------------------------------------------
# Noise toolkit (vectorized Perlin fBm, ridged multifractal, domain warp)
# --------------------------------------------------------------------------

class NoiseKit:
    def __init__(self, rng):
        p = rng.permutation(256).astype(np.int64)
        self.perm = np.concatenate([p, p])

    def _grad(self, h, x, y):
        h = h & 7
        u = np.where(h < 4, x, y)
        v = np.where(h < 4, y, x)
        return np.where(h & 1, -u, u) + np.where(h & 2, -2.0 * v, 2.0 * v)

    def perlin(self, x, y):
        xi = np.floor(x).astype(np.int64) & 255
        yi = np.floor(y).astype(np.int64) & 255
        xf = x - np.floor(x)
        yf = y - np.floor(y)
        u = xf * xf * xf * (xf * (xf * 6 - 15) + 10)
        v = yf * yf * yf * (yf * (yf * 6 - 15) + 10)
        p = self.perm
        aa = p[p[xi] + yi]
        ab = p[p[xi] + yi + 1]
        ba = p[p[xi + 1] + yi]
        bb = p[p[xi + 1] + yi + 1]
        n00 = self._grad(aa, xf, yf)
        n10 = self._grad(ba, xf - 1, yf)
        n01 = self._grad(ab, xf, yf - 1)
        n11 = self._grad(bb, xf - 1, yf - 1)
        nx0 = n00 + u * (n10 - n00)
        nx1 = n01 + u * (n11 - n01)
        return (nx0 + v * (nx1 - nx0)) * 0.6

    def fbm(self, x, y, octaves=6, lacunarity=2.0, gain=0.5, offset=(0, 0)):
        total = np.zeros_like(x)
        amp, freq, norm = 1.0, 1.0, 0.0
        for o in range(octaves):
            total += amp * self.perlin(x * freq + offset[0] + o * 17.17,
                                       y * freq + offset[1] + o * 31.31)
            norm += amp
            amp *= gain
            freq *= lacunarity
        return total / norm

    def ridged(self, x, y, octaves=6, lacunarity=2.1, gain=0.5, offset=(0, 0)):
        total = np.zeros_like(x)
        amp, freq, norm = 1.0, 1.0, 0.0
        weight = np.ones_like(x)
        for o in range(octaves):
            n = self.perlin(x * freq + offset[0] + o * 13.7,
                            y * freq + offset[1] + o * 7.3)
            n = 1.0 - np.abs(n)
            n = n * n * weight
            weight = np.clip(n * 2.0, 0, 1)
            total += n * amp
            norm += amp
            amp *= gain
            freq *= lacunarity
        return total / norm

    def warp(self, x, y, strength, freq, octaves=4):
        wx = self.fbm(x * freq, y * freq, octaves, offset=(51.2, 9.8))
        wy = self.fbm(x * freq, y * freq, octaves, offset=(-71.7, 33.1))
        return x + wx * strength, y + wy * strength


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / max(edge1 - edge0, 1e-9), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# --------------------------------------------------------------------------
# Terrain generation: archetypes + thermal & hydraulic erosion
# --------------------------------------------------------------------------

def thermal_erosion(H, iterations=30, talus=0.9, k=0.25):
    for _ in range(iterations):
        delta = np.zeros_like(H)
        c = H[1:-1, 1:-1]
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            nb = H[1 + dy:H.shape[0] - 1 + dy, 1 + dx:H.shape[1] - 1 + dx]
            diff = c - nb
            move = np.clip((diff - talus) * k * 0.25, 0, None)
            delta[1:-1, 1:-1] -= move
            delta[1 + dy:H.shape[0] - 1 + dy, 1 + dx:H.shape[1] - 1 + dx] += move
        H += delta
    return H


def hydraulic_erosion(H, rng, drops=30000, steps=48, inertia=0.08,
                      capacity_k=3.0, deposit_k=0.25, erode_k=0.30,
                      evaporation=0.015, min_slope=0.01, gravity=4.0):
    """Vectorized droplet erosion: all droplets advance in lock-step."""
    n = H.shape[0]
    px = rng.uniform(1.0, n - 2.0, drops)
    py = rng.uniform(1.0, n - 2.0, drops)
    dx = np.zeros(drops)
    dy = np.zeros(drops)
    vel = np.ones(drops)
    water = np.ones(drops)
    sediment = np.zeros(drops)

    def bilinear_and_grad(x, y):
        ix = np.clip(x.astype(np.int64), 0, n - 2)
        iy = np.clip(y.astype(np.int64), 0, n - 2)
        fx = x - ix
        fy = y - iy
        h00 = H[iy, ix]
        h10 = H[iy, ix + 1]
        h01 = H[iy + 1, ix]
        h11 = H[iy + 1, ix + 1]
        gx = (h10 - h00) * (1 - fy) + (h11 - h01) * fy
        gy = (h01 - h00) * (1 - fx) + (h11 - h10) * fx
        h = (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy
        return h, gx, gy, ix, iy, fx, fy

    def splat(ix, iy, fx, fy, amount):
        np.add.at(H, (iy, ix), amount * (1 - fx) * (1 - fy))
        np.add.at(H, (iy, ix + 1), amount * fx * (1 - fy))
        np.add.at(H, (iy + 1, ix), amount * (1 - fx) * fy)
        np.add.at(H, (iy + 1, ix + 1), amount * fx * fy)

    for _ in range(steps):
        h_old, gx, gy, ix, iy, fx, fy = bilinear_and_grad(px, py)
        dx = dx * inertia - gx * (1 - inertia)
        dy = dy * inertia - gy * (1 - inertia)
        length = np.sqrt(dx * dx + dy * dy) + 1e-9
        dx /= length
        dy /= length
        px_new = px + dx
        py_new = py + dy
        alive = ((px_new > 1) & (px_new < n - 2) &
                 (py_new > 1) & (py_new < n - 2) & (water > 0.01))
        px_new = np.clip(px_new, 1, n - 2)
        py_new = np.clip(py_new, 1, n - 2)
        h_new = bilinear_and_grad(px_new, py_new)[0]
        dh = h_new - h_old

        capacity = np.maximum(-dh, min_slope) * vel * water * capacity_k
        deposit = np.where(sediment > capacity,
                           (sediment - capacity) * deposit_k, 0.0)
        deposit = np.where(dh > 0, np.minimum(sediment, dh), deposit)
        erode = np.where(sediment <= capacity,
                         np.minimum((capacity - sediment) * erode_k, -np.minimum(dh, 0)),
                         0.0)
        # clamp per-step transfer: many droplets can hit one cell in the same
        # step, and unbounded feedback blows the heightfield up
        deposit = np.clip(deposit, 0.0, 0.5) * alive
        erode = np.clip(erode, 0.0, 0.5) * alive
        splat(ix, iy, fx, fy, deposit - erode)
        sediment = np.clip(sediment + erode - deposit, 0.0, 8.0)
        vel = np.minimum(np.sqrt(np.maximum(vel * vel + dh * -gravity, 0)), 6.0)
        water *= (1 - evaporation)
        water = np.where(alive, water, 0.0)
        px, py = px_new, py_new
    return H


def blur(H, passes=1):
    for _ in range(passes):
        H = (H +
             np.roll(H, 1, 0) + np.roll(H, -1, 0) +
             np.roll(H, 1, 1) + np.roll(H, -1, 1)) / 5.0
    return H


ARCHETYPES = ["alpine", "highlands", "coast", "canyon"]


def generate_heightfield(kind, n, size, nk, rng, nrng):
    """Returns (H in meters, water_z or None). Grid is n x n over size x size m."""
    axis = np.linspace(-size / 2, size / 2, n)
    X, Y = np.meshgrid(axis, axis)
    ws = rng.uniform(300, 900)
    wx, wy = nk.warp(X * 0.001, Y * 0.001, ws * 0.001, rng.uniform(0.3, 0.7))
    wx *= 1000
    wy *= 1000

    if kind == "alpine":
        base = nk.fbm(wx * 0.0007, wy * 0.0007, 5) * 0.5 + 0.5
        ridge = nk.ridged(wx * 0.0011, wy * 0.0011, 6, offset=(3.3, 8.8))
        H = np.power(np.clip(ridge, 0, None), 1.45) * rng.uniform(520, 820) * \
            (0.35 + 0.65 * base) + base * 140
        water_pct = rng.uniform(8, 22) if rng.random() < 0.6 else None

    elif kind == "highlands":
        roll = nk.fbm(wx * 0.0009, wy * 0.0009, 6) * 0.5 + 0.5
        crag_mask = smoothstep(0.55, 0.8, nk.fbm(wx * 0.0004, wy * 0.0004, 3,
                                                 offset=(9.1, -4.2)) * 0.5 + 0.5)
        crags = nk.ridged(wx * 0.0016, wy * 0.0016, 5, offset=(-5.5, 2.2))
        H = roll * rng.uniform(180, 260) + crag_mask * np.power(
            np.clip(crags, 0, None), 1.4) * rng.uniform(220, 380)
        water_pct = rng.uniform(4, 12) if rng.random() < 0.45 else None

    elif kind == "coast":
        ang = rng.uniform(0, 2 * math.pi)
        tilt = (X * math.cos(ang) + Y * math.sin(ang)) / (size / 2)
        base = nk.fbm(wx * 0.0008, wy * 0.0008, 6) * 0.5 + 0.5
        cliffs = nk.ridged(wx * 0.0013, wy * 0.0013, 5, offset=(1.7, 7.7))
        H = base * 170 + np.power(np.clip(cliffs, 0, None), 1.5) * \
            rng.uniform(160, 300) * smoothstep(-0.2, 0.6, tilt) - tilt * rng.uniform(90, 150)
        water_pct = rng.uniform(18, 32)

    else:  # canyon
        plateau = rng.uniform(200, 300) + (nk.fbm(wx * 0.0008, wy * 0.0008, 5)
                                           * 0.5 + 0.5) * 90
        channel = np.abs(nk.fbm(wx * 0.00045, wy * 0.00045, 3, offset=(21.0, -13.0)))
        carve = 1.0 - smoothstep(0.02, rng.uniform(0.16, 0.26), channel)
        depth = rng.uniform(160, 240)
        H = plateau - carve * depth
        step = rng.uniform(22, 40)
        terr = np.round(H / step) * step
        H = H * 0.55 + terr * 0.45 * carve + H * 0.45 * (1 - carve)
        H += (nk.ridged(wx * 0.002, wy * 0.002, 4, offset=(4.0, 4.0)) - 0.5) * 30
        wl = plateau.mean() - depth + 6
        water_pct = (float(np.clip((H < wl).mean() * 100, 3, 35))
                     if rng.random() < 0.5 else None)

    # medium-scale relief everywhere (~50-200 m features) so hills never
    # read as smooth blobs; erosion then carves texture into it
    detail = nk.fbm(wx * 0.006, wy * 0.006, 5, offset=(140.0, -77.0))
    H += detail * (H.max() - H.min()) * 0.07
    H += nk.ridged(wx * 0.003, wy * 0.003, 4, offset=(-66.0, 19.0)) * \
        (H.max() - H.min()) * 0.08

    # normalize sea of negatives, erode, polish
    H = H - H.min()
    lo, hi = H.min(), H.max()
    cell = size / (n - 1)
    H_scaled = H / cell                       # erosion works in cell units
    H_scaled = thermal_erosion(H_scaled, iterations=25,
                               talus=math.tan(math.radians(rng.uniform(33, 40))),
                               k=0.3)
    H_scaled = hydraulic_erosion(H_scaled, nrng,
                                 drops=int(18000 * (n / 512) ** 2) + 6000,
                                 steps=48)
    H = blur(H_scaled, 1) * cell
    H = np.clip(np.nan_to_num(H, nan=lo), lo - 40, hi + 20)
    # water level from the POST-erosion terrain, or it drowns the map
    water_z = None
    if water_pct is not None:
        water_z = float(np.clip(np.percentile(H, water_pct),
                                H.min() + 2, H.max() - 30))
    return H.astype(np.float64), water_z


class Terrain:
    """Heightfield + sampling helpers in world space (centered at origin)."""

    def __init__(self, H, size):
        self.H = H
        self.size = size
        self.n = H.shape[0]

    def height(self, x, y):
        n, s = self.n, self.size
        gx = np.clip((np.asarray(x, float) / s + 0.5) * (n - 1), 0, n - 1.001)
        gy = np.clip((np.asarray(y, float) / s + 0.5) * (n - 1), 0, n - 1.001)
        ix, iy = gx.astype(np.int64), gy.astype(np.int64)
        fx, fy = gx - ix, gy - iy
        H = self.H
        h = (H[iy, ix] * (1 - fx) + H[iy, ix + 1] * fx) * (1 - fy) + \
            (H[iy + 1, ix] * (1 - fx) + H[iy + 1, ix + 1] * fx) * fy
        return float(h) if np.isscalar(x) else h

    def slope(self):
        cell = self.size / (self.n - 1)
        gy, gx = np.gradient(self.H, cell)
        return np.sqrt(gx * gx + gy * gy)

    def grid_to_world(self, ix, iy):
        s, n = self.size, self.n
        return ((ix / (n - 1) - 0.5) * s, (iy / (n - 1) - 0.5) * s)


# --------------------------------------------------------------------------
# Blender helpers
# --------------------------------------------------------------------------

PRINCIPLED_ALIASES = {
    "Emission Color": ["Emission"],
    "Emission Strength": [],
    "Specular IOR Level": ["Specular"],
    "Transmission Weight": ["Transmission"],
    "Coat Weight": ["Clearcoat"],
    "Subsurface Weight": ["Subsurface"],
}


def pset(node, name, value):
    for candidate in [name] + PRINCIPLED_ALIASES.get(name, []):
        sock = node.inputs.get(candidate)
        if sock is not None:
            try:
                sock.default_value = value
                return True
            except (TypeError, ValueError):
                pass
    return False


def new_collection(name):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def link_obj(obj, coll):
    coll.objects.link(obj)
    return obj


def mesh_from_bmesh(name, bm, coll, mat=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        vals = [True] * len(mesh.polygons)
        mesh.polygons.foreach_set("use_smooth", vals)
    obj = bpy.data.objects.new(name, mesh)
    if mat:
        mesh.materials.append(mat)
    link_obj(obj, coll)
    return obj


def make_cylinder(name, radius, depth, coll, mat=None, segments=12,
                  radius2=None, smooth=True):
    bm = bmesh.new()
    kw = dict(cap_ends=True, segments=segments, depth=depth)
    try:
        bmesh.ops.create_cone(bm, radius1=radius,
                              radius2=radius if radius2 is None else radius2, **kw)
    except TypeError:
        bmesh.ops.create_cone(bm, diameter1=radius * 2,
                              diameter2=(radius if radius2 is None else radius2) * 2,
                              **kw)
    return mesh_from_bmesh(name, bm, coll, mat, smooth)


def make_box(name, sx, sy, sz, coll, mat=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    return mesh_from_bmesh(name, bm, coll, mat, smooth=False)


def make_icosphere(name, radius, coll, mat=None, subdivisions=2, smooth=True):
    bm = bmesh.new()
    try:
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    except TypeError:
        bmesh.ops.create_icosphere(bm, subdivisions=subdivisions,
                                   diameter=radius * 2)
    return mesh_from_bmesh(name, bm, coll, mat, smooth)


def simple_material(name, color, roughness=0.8, metallic=0.0,
                    emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    pset(bsdf, "Base Color", (*color, 1.0))
    pset(bsdf, "Roughness", roughness)
    pset(bsdf, "Metallic", metallic)
    if emission:
        pset(bsdf, "Emission Color", (*emission, 1.0))
        pset(bsdf, "Emission Strength", emission_strength)
    return mat


def weathered_material(name, color, roughness=0.9):
    """Stone with noise-broken tone so large surfaces don't read as plastic."""
    mat = simple_material(name, color, roughness)
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 0.4
    noise.inputs["Detail"].default_value = 8.0
    tex = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tex.outputs["Object"], noise.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(noise.outputs["Fac"], mix.inputs["Factor"])
    mix.inputs[6].default_value = (*color, 1.0)
    mix.inputs[7].default_value = (color[0] * 0.45, color[1] * 0.45,
                                   color[2] * 0.45, 1.0)
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.3
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def emissive_material(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1.0)
    em.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs["Emission"], out.inputs["Surface"])
    return mat


# --------------------------------------------------------------------------
# Moods: lighting, palette, atmosphere
# --------------------------------------------------------------------------

MOODS = {
    "golden_hour": dict(
        sun_elev=(4, 11), sun_energy=(4.0, 7.0), sun_color=(1.0, 0.72, 0.45),
        sun_dir="rim", sky_strength=(0.15, 0.3),
        air=1.1, dust=(2.0, 5.0), ozone=1.2,
        fog_density=(0.8e-4, 2.5e-4), fog_color=(0.90, 0.82, 0.70),
        fog_top_add=(90, 220), exposure=(0.0, 0.4),
        grass=(0.14, 0.17, 0.055), grass2=(0.26, 0.22, 0.08),
        cloud_color=(1.0, 0.80, 0.62), cloud_strength=(1.2, 2.4), cloud_cover=0.4,
        magic_color=(0.5, 0.85, 1.0), scifi_bias=0.0, glare=0.9,
    ),
    "misty_dawn": dict(
        sun_elev=(4, 10), sun_energy=(2.2, 3.8), sun_color=(1.0, 0.83, 0.62),
        sun_dir="toward", sky_strength=(0.3, 0.5),
        air=1.6, dust=(1.0, 3.0), ozone=1.6,
        fog_density=(3e-4, 8e-4), fog_color=(0.80, 0.83, 0.86),
        fog_top_add=(140, 320), exposure=(0.2, 0.7),
        grass=(0.14, 0.16, 0.09), grass2=(0.22, 0.24, 0.13),
        cloud_color=(0.92, 0.90, 0.88), cloud_strength=(0.8, 1.5), cloud_cover=0.45,
        magic_color=(0.55, 0.9, 1.0), scifi_bias=0.0, glare=1.2,
    ),
    "stormy": dict(
        sun_elev=(9, 22), sun_energy=(1.0, 2.2), sun_color=(0.92, 0.92, 0.98),
        sun_dir="side", sky_strength=(0.08, 0.16),
        air=2.0, dust=(4.0, 8.0), ozone=1.0,
        fog_density=(1.5e-4, 4e-4), fog_color=(0.62, 0.66, 0.72),
        fog_top_add=(150, 350), exposure=(0.3, 0.8),
        grass=(0.11, 0.14, 0.07), grass2=(0.18, 0.19, 0.10),
        cloud_color=(0.30, 0.32, 0.36), cloud_strength=(0.5, 1.0), cloud_cover=0.9,
        magic_color=(0.6, 0.9, 1.0), scifi_bias=0.05, glare=0.5,
    ),
    "blue_hour": dict(
        sun_elev=(2.5, 6), sun_energy=(1.0, 1.8), sun_color=(1.0, 0.62, 0.38),
        sun_dir="toward", sky_strength=(0.12, 0.2),
        air=1.9, dust=(1.0, 2.5), ozone=2.4,
        fog_density=(1.2e-4, 3e-4), fog_color=(0.55, 0.62, 0.78),
        fog_top_add=(100, 260), exposure=(0.5, 1.0),
        grass=(0.09, 0.11, 0.08), grass2=(0.14, 0.15, 0.11),
        cloud_color=(0.45, 0.48, 0.60), cloud_strength=(0.6, 1.2), cloud_cover=0.5,
        magic_color=(0.4, 0.8, 1.0), scifi_bias=0.10, glare=1.0,
    ),
    "moonlit": dict(
        sun_elev=(22, 45), sun_energy=(0.18, 0.4), sun_color=(0.68, 0.78, 1.0),
        sun_dir="rim", sky_strength=(0.006, 0.02),
        air=1.0, dust=(0.5, 1.5), ozone=1.6,
        fog_density=(1e-4, 2.5e-4), fog_color=(0.45, 0.52, 0.70),
        fog_top_add=(90, 240), exposure=(0.7, 1.3),
        grass=(0.07, 0.09, 0.07), grass2=(0.10, 0.12, 0.10),
        cloud_color=(0.20, 0.24, 0.34), cloud_strength=(0.3, 0.7), cloud_cover=0.35,
        magic_color=(0.5, 0.9, 1.0), scifi_bias=0.10, glare=1.3,
    ),
    "alien_dusk": dict(
        sun_elev=(3, 9), sun_energy=(2.0, 4.0), sun_color=(1.0, 0.5, 0.55),
        sun_dir="rim", sky_strength=(0.12, 0.22),
        air=1.4, dust=(3.0, 7.0), ozone=3.5,
        fog_density=(1.5e-4, 4e-4), fog_color=(0.55, 0.50, 0.72),
        fog_top_add=(120, 300), exposure=(0.4, 0.9),
        grass=(0.10, 0.13, 0.10), grass2=(0.20, 0.15, 0.14),
        cloud_color=(0.75, 0.45, 0.60), cloud_strength=(0.9, 1.8), cloud_cover=0.55,
        magic_color=(0.35, 1.0, 0.75), scifi_bias=0.35, glare=1.1,
    ),
}


# --------------------------------------------------------------------------
# Scene reset & render config
# --------------------------------------------------------------------------

def reset_scene():
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block_list in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                       bpy.data.cameras, bpy.data.worlds, bpy.data.images,
                       bpy.data.node_groups):
        for block in list(block_list):
            if block.users == 0:
                block_list.remove(block)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    return scene


def configure_render(scene, opts, mood, rng):
    scene.render.engine = "CYCLES"
    scene.render.resolution_x, scene.render.resolution_y = opts["res"]
    scene.render.film_transparent = False
    cycles = scene.cycles
    cycles.samples = opts["samples"]
    cycles.use_adaptive_sampling = True
    cycles.adaptive_threshold = 0.02
    try:
        cycles.use_denoising = True
        cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    try:  # use GPU when one is configured; CPU otherwise
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for dev_type in ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI"):
            try:
                prefs.compute_device_type = dev_type
                prefs.get_devices()
                if any(d.type != "CPU" for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = True
                    cycles.device = "GPU"
                    break
            except Exception:
                continue
    except Exception:
        pass
    vs = scene.view_settings
    try:
        vs.view_transform = "AgX"
        vs.look = "AgX - Base Contrast"
    except Exception:
        pass
    vs.exposure = rng.uniform(*mood["exposure"])


# --------------------------------------------------------------------------
# Terrain mesh + material
# --------------------------------------------------------------------------

def build_terrain_mesh(name, H, size, coll, mat, z_offset=0.0):
    n = H.shape[0]
    axis = np.linspace(-size / 2, size / 2, n)
    X, Y = np.meshgrid(axis, axis)
    co = np.stack([X, Y, H + z_offset], axis=-1).reshape(-1, 3)

    idx = np.arange(n * n).reshape(n, n)
    a = idx[:-1, :-1].ravel()
    b = idx[:-1, 1:].ravel()
    c = idx[1:, 1:].ravel()
    d = idx[1:, :-1].ravel()
    faces = np.stack([a, b, c, d], axis=-1)

    mesh = bpy.data.meshes.new(name)
    nv, nf = co.shape[0], faces.shape[0]
    mesh.vertices.add(nv)
    mesh.vertices.foreach_set("co", co.ravel())
    mesh.loops.add(nf * 4)
    mesh.loops.foreach_set("vertex_index", faces.ravel())
    mesh.polygons.add(nf)
    mesh.polygons.foreach_set("loop_start", np.arange(0, nf * 4, 4))
    try:
        mesh.polygons.foreach_set("loop_total", np.full(nf, 4, dtype=np.int32))
    except Exception:
        pass
    mesh.update(calc_edges=True)
    mesh.validate()
    mesh.polygons.foreach_set("use_smooth", np.ones(nf, dtype=bool))
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    link_obj(obj, coll)
    return obj


def terrain_material(mood, rng, water_z, snow_z, rock_hue=None):
    mat = bpy.data.materials.new("TerrainMat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    pset(bsdf, "Roughness", 0.95)
    pset(bsdf, "Specular IOR Level", 0.15)

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep_n = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], sep_n.inputs["Vector"])
    sep_p = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], sep_p.inputs["Vector"])

    # slope factor: 0 flat -> 1 steep
    slope_ramp = nt.nodes.new("ShaderNodeMapRange")
    slope_ramp.inputs["From Min"].default_value = 0.93   # cos of slope angle
    slope_ramp.inputs["From Max"].default_value = 0.75
    nt.links.new(sep_n.outputs["Z"], slope_ramp.inputs["Value"])

    # breakup noise so transitions never look painted-on
    breakup = nt.nodes.new("ShaderNodeTexNoise")
    breakup.inputs["Scale"].default_value = 0.008
    breakup.inputs["Detail"].default_value = 6.0
    nt.links.new(geo.outputs["Position"], breakup.inputs["Vector"])

    slope_mix = nt.nodes.new("ShaderNodeMath")
    slope_mix.operation = "MULTIPLY_ADD"
    nt.links.new(breakup.outputs["Fac"], slope_mix.inputs[0])
    slope_mix.inputs[1].default_value = 0.35
    nt.links.new(slope_ramp.outputs["Result"], slope_mix.inputs[2])

    # base colors
    hue = rock_hue if rock_hue else rng.uniform(0.02, 0.08)
    rock_a = (0.16 + hue, 0.145 + hue * 0.5, 0.13, 1.0)
    rock_b = (0.075, 0.07, 0.068, 1.0)
    grass_a = (*mood["grass"], 1.0)
    grass_b = (*mood["grass2"], 1.0)

    rock_noise = nt.nodes.new("ShaderNodeTexNoise")
    rock_noise.inputs["Scale"].default_value = 0.02
    rock_noise.inputs["Detail"].default_value = 8.0
    rock_noise.inputs["Roughness"].default_value = 0.62
    nt.links.new(geo.outputs["Position"], rock_noise.inputs["Vector"])
    rock_col = nt.nodes.new("ShaderNodeMix")
    rock_col.data_type = "RGBA"
    nt.links.new(rock_noise.outputs["Fac"], rock_col.inputs["Factor"])
    rock_col.inputs[6].default_value = rock_a
    rock_col.inputs[7].default_value = rock_b

    grass_noise = nt.nodes.new("ShaderNodeTexNoise")
    grass_noise.inputs["Scale"].default_value = 0.02
    grass_noise.inputs["Detail"].default_value = 7.0
    nt.links.new(geo.outputs["Position"], grass_noise.inputs["Vector"])
    grass_col = nt.nodes.new("ShaderNodeMix")
    grass_col.data_type = "RGBA"
    nt.links.new(grass_noise.outputs["Fac"], grass_col.inputs["Factor"])
    grass_col.inputs[6].default_value = grass_a
    grass_col.inputs[7].default_value = grass_b

    ground = nt.nodes.new("ShaderNodeMix")   # grass on flats, rock on steeps
    ground.data_type = "RGBA"
    nt.links.new(slope_mix.outputs["Value"], ground.inputs["Factor"])
    nt.links.new(grass_col.outputs[2], ground.inputs[6])
    nt.links.new(rock_col.outputs[2], ground.inputs[7])

    # snow above the snowline (noise-broken), only on gentler slopes
    snow_h = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(sep_p.outputs["Z"], snow_h.inputs["Value"])
    snow_h.inputs["From Min"].default_value = snow_z - 8.0
    snow_h.inputs["From Max"].default_value = snow_z + 35.0
    snow_gate = nt.nodes.new("ShaderNodeMath")
    snow_gate.operation = "MULTIPLY"
    nt.links.new(snow_h.outputs["Result"], snow_gate.inputs[0])
    inv_slope = nt.nodes.new("ShaderNodeMath")
    inv_slope.operation = "SUBTRACT"
    inv_slope.inputs[0].default_value = 1.0
    nt.links.new(slope_ramp.outputs["Result"], inv_slope.inputs[1])
    nt.links.new(inv_slope.outputs["Value"], snow_gate.inputs[1])
    snow_mix = nt.nodes.new("ShaderNodeMix")
    snow_mix.data_type = "RGBA"
    nt.links.new(snow_gate.outputs["Value"], snow_mix.inputs["Factor"])
    nt.links.new(ground.outputs[2], snow_mix.inputs[6])
    snow_mix.inputs[7].default_value = (0.75, 0.78, 0.83, 1.0)

    final_col = snow_mix
    if water_z is not None:  # dark wet band just above the waterline
        wet = nt.nodes.new("ShaderNodeMapRange")
        nt.links.new(sep_p.outputs["Z"], wet.inputs["Value"])
        wet.inputs["From Min"].default_value = water_z + 4.0
        wet.inputs["From Max"].default_value = water_z + 0.5
        wet_mix = nt.nodes.new("ShaderNodeMix")
        wet_mix.data_type = "RGBA"
        nt.links.new(wet.outputs["Result"], wet_mix.inputs["Factor"])
        nt.links.new(snow_mix.outputs[2], wet_mix.inputs[6])
        wet_mix.inputs[7].default_value = (0.05, 0.045, 0.04, 1.0)
        final_col = wet_mix

    # fake aerial perspective: fade distant geometry toward the haze color
    # (works even with --no-volumetrics, and gives the far shell depth)
    camd = nt.nodes.new("ShaderNodeCameraData")
    haze_rng = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(camd.outputs["View Distance"], haze_rng.inputs["Value"])
    haze_rng.inputs["From Min"].default_value = 900.0
    haze_rng.inputs["From Max"].default_value = 14000.0
    haze_rng.inputs["To Max"].default_value = 0.75
    haze_mix = nt.nodes.new("ShaderNodeMix")
    haze_mix.data_type = "RGBA"
    nt.links.new(haze_rng.outputs["Result"], haze_mix.inputs["Factor"])
    nt.links.new(final_col.outputs[2], haze_mix.inputs[6])
    fc = mood["fog_color"]
    haze_mix.inputs[7].default_value = (fc[0] * 0.9, fc[1] * 0.92, fc[2], 1.0)

    nt.links.new(haze_mix.outputs[2], bsdf.inputs["Base Color"])

    # two bump octaves: broad ground undulation + fine micro-relief
    big_noise = nt.nodes.new("ShaderNodeTexNoise")
    big_noise.inputs["Scale"].default_value = 0.04
    big_noise.inputs["Detail"].default_value = 8.0
    nt.links.new(geo.outputs["Position"], big_noise.inputs["Vector"])
    big_bump = nt.nodes.new("ShaderNodeBump")
    big_bump.inputs["Strength"].default_value = 0.35
    nt.links.new(big_noise.outputs["Fac"], big_bump.inputs["Height"])

    bump_noise = nt.nodes.new("ShaderNodeTexNoise")
    bump_noise.inputs["Scale"].default_value = 0.35
    bump_noise.inputs["Detail"].default_value = 10.0
    bump_noise.inputs["Roughness"].default_value = 0.6
    nt.links.new(geo.outputs["Position"], bump_noise.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    nt.links.new(bump_noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(big_bump.outputs["Normal"], bump.inputs["Normal"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def build_water(water_z, mood, coll, rng):
    mat = bpy.data.materials.new("WaterMat")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    pset(bsdf, "Base Color", (0.012, 0.03, 0.035, 1.0))
    pset(bsdf, "Roughness", rng.uniform(0.02, 0.12))
    pset(bsdf, "Specular IOR Level", 0.6)
    ripple = nt.nodes.new("ShaderNodeTexNoise")
    ripple.inputs["Scale"].default_value = 0.05
    ripple.inputs["Detail"].default_value = 8.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.06
    nt.links.new(ripple.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=11000)
    water = mesh_from_bmesh("Water", bm, coll, mat, smooth=True)
    water.location.z = water_z
    return water


# --------------------------------------------------------------------------
# Atmosphere: sky, sun, fog volume, cloud cards
# --------------------------------------------------------------------------

def build_sky_and_sun(scene, mood, rng, coll):
    world = bpy.data.worlds.new("FantasyWorld")
    world.use_nodes = True
    scene.world = world
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    bg.inputs["Strength"].default_value = rng.uniform(*mood["sky_strength"])

    elev = math.radians(rng.uniform(*mood["sun_elev"]))
    azim = rng.uniform(0, 2 * math.pi)      # refined later vs camera

    sky = nt.nodes.new("ShaderNodeTexSky")
    if hasattr(sky, "sky_type"):
        try:
            sky.sky_type = "NISHITA"
        except TypeError:
            pass
    for attr, val in (("sun_elevation", elev), ("sun_rotation", azim),
                      ("sun_disc", False), ("altitude", 500.0),
                      ("air_density", mood["air"]),
                      ("dust_density", rng.uniform(*mood["dust"])),
                      ("ozone_density", mood["ozone"])):
        if hasattr(sky, attr):
            try:
                setattr(sky, attr, val)
            except Exception:
                pass
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])

    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = rng.uniform(*mood["sun_energy"])
    sun_data.color = mood["sun_color"]
    sun_data.angle = math.radians(rng.uniform(0.4, 1.6))
    sun = bpy.data.objects.new("Sun", sun_data)
    link_obj(sun, coll)
    sun["elev"] = elev
    return sun, sky


def aim_sun(sun, sky, elev, azim):
    sun.rotation_euler = Euler((math.pi / 2 - elev, 0, azim + math.pi), "XYZ")
    if sky is not None and hasattr(sky, "sun_rotation"):
        # Nishita's rotation is measured from north (+Y), CCW; the lamp's
        # -Z axis after this Euler points along azimuth measured from -Y.
        try:
            sky.sun_rotation = -azim - math.pi / 2
        except Exception:
            pass


def build_fog(mood, rng, coll, ground_min, fog_top, enabled):
    if not enabled:
        return None
    mat = bpy.data.materials.new("FogMat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    scat = nt.nodes.new("ShaderNodeVolumeScatter")
    scat.inputs["Color"].default_value = (*mood["fog_color"], 1.0)
    scat.inputs["Anisotropy"].default_value = 0.55
    density = rng.uniform(*mood["fog_density"])

    tex = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tex.outputs["Object"], sep.inputs["Vector"])
    # object-space Z runs -1..1 across the cube: fade density towards the top
    fade = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(sep.outputs["Z"], fade.inputs["Value"])
    fade.inputs["From Min"].default_value = -0.9
    fade.inputs["From Max"].default_value = 0.9
    fade.inputs["To Min"].default_value = 1.0
    fade.inputs["To Max"].default_value = 0.0
    curve = nt.nodes.new("ShaderNodeMath")
    curve.operation = "POWER"
    nt.links.new(fade.outputs["Result"], curve.inputs[0])
    curve.inputs[1].default_value = 1.8

    wisps = nt.nodes.new("ShaderNodeTexNoise")
    wisps.inputs["Scale"].default_value = rng.uniform(1.2, 2.8)
    wisps.inputs["Detail"].default_value = 4.0
    nt.links.new(tex.outputs["Object"], wisps.inputs["Vector"])
    wisp_rng = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(wisps.outputs["Fac"], wisp_rng.inputs["Value"])
    wisp_rng.inputs["From Min"].default_value = 0.35
    wisp_rng.inputs["From Max"].default_value = 0.75
    wisp_rng.inputs["To Min"].default_value = 0.25
    wisp_rng.inputs["To Max"].default_value = 1.0

    m1 = nt.nodes.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    nt.links.new(curve.outputs["Value"], m1.inputs[0])
    nt.links.new(wisp_rng.outputs["Result"], m1.inputs[1])
    m2 = nt.nodes.new("ShaderNodeMath")
    m2.operation = "MULTIPLY"
    nt.links.new(m1.outputs["Value"], m2.inputs[0])
    m2.inputs[1].default_value = density
    nt.links.new(m2.outputs["Value"], scat.inputs["Density"])
    nt.links.new(scat.outputs["Volume"], out.inputs["Volume"])

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    fog = mesh_from_bmesh("FogVolume", bm, coll, mat)
    depth = fog_top - (ground_min - 60)
    fog.scale = (7000, 7000, depth)
    fog.location = (0, 0, ground_min - 60 + depth / 2)
    fog.display_type = "WIRE"
    try:
        fog.visible_shadow = False
    except Exception:
        pass
    return fog


def build_clouds(mood, rng, coll, top_z):
    strength = rng.uniform(*mood["cloud_strength"])
    mat = bpy.data.materials.new("CloudMat")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*mood["cloud_color"], 1.0)
    emit.inputs["Strength"].default_value = strength
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = rng.uniform(1.5, 3.2)
    noise.inputs["Detail"].default_value = 8.0
    tex = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tex.outputs["Object"], noise.inputs["Vector"])
    cover = mood["cloud_cover"]
    ramp = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"])
    ramp.inputs["From Min"].default_value = 0.62 - 0.30 * cover
    ramp.inputs["From Max"].default_value = 0.82 - 0.25 * cover
    # radial falloff so the rectangular card edges never show
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    map2 = nt.nodes.new("ShaderNodeMapping")
    map2.inputs["Scale"].default_value = (2.2, 2.2, 2.2)
    nt.links.new(tex.outputs["Object"], map2.inputs["Vector"])
    nt.links.new(map2.outputs["Vector"], grad.inputs["Vector"])
    edge = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(grad.outputs["Fac"], edge.inputs["Value"])
    edge.inputs["From Min"].default_value = 0.0
    edge.inputs["From Max"].default_value = 0.35
    fade = nt.nodes.new("ShaderNodeMath")
    fade.operation = "MULTIPLY"
    nt.links.new(ramp.outputs["Result"], fade.inputs[0])
    nt.links.new(edge.outputs["Result"], fade.inputs[1])
    nt.links.new(fade.outputs["Value"], mix.inputs["Fac"])
    nt.links.new(trans.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])

    count = rng.randint(6, 12) + int(cover * 10)
    for i in range(count):
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
        card = mesh_from_bmesh(f"Cloud.{i}", bm, coll, mat)
        card.scale = (rng.uniform(1400, 4500), rng.uniform(900, 3000), 1)
        ang = rng.uniform(0, 2 * math.pi)
        dist = rng.uniform(3000, 14000)
        card.location = (math.cos(ang) * dist, math.sin(ang) * dist,
                         top_z + rng.uniform(400, 1500))
        card.rotation_euler = (rng.uniform(-0.12, 0.12),
                               rng.uniform(-0.12, 0.12),
                               rng.uniform(0, math.pi))
        try:
            card.visible_shadow = False
        except Exception:
            pass


# --------------------------------------------------------------------------
# Site finding on the terrain
# --------------------------------------------------------------------------

class SiteFinder:
    def __init__(self, terrain, water_z, rng):
        self.t = terrain
        self.rng = rng
        self.water_z = water_z if water_z is not None else -1e9
        self.slope = blur(terrain.slope(), 2)
        self.taken = []

    def _candidates(self, mask):
        n = self.t.n
        border = int(n * 0.16)
        m = np.zeros_like(mask)
        m[border:-border, border:-border] = mask[border:-border, border:-border]
        iy, ix = np.nonzero(m)
        return ix, iy

    def _pick(self, ix, iy, min_gap):
        order = self.rng.sample(range(len(ix)), min(400, len(ix)))
        for k in order:
            x, y = self.t.grid_to_world(ix[k], iy[k])
            if all((x - tx) ** 2 + (y - ty) ** 2 > min_gap ** 2
                   for tx, ty in self.taken):
                self.taken.append((x, y))
                return (x, y, self.t.height(x, y))
        return None

    def promontory(self, min_gap=250):
        """High, prominent, not-too-steep spot: castle / spire territory."""
        H = self.t.H
        hi = H > np.percentile(H, 82)
        ok = hi & (self.slope < 0.9) & (H > self.water_z + 15)
        ix, iy = self._candidates(ok)
        if len(ix) == 0:
            ok = (H > np.percentile(H, 65)) & (self.slope < 1.2)
            ix, iy = self._candidates(ok)
        return self._pick(ix, iy, min_gap) if len(ix) else None

    def gentle(self, lo_pct=15, hi_pct=60, max_slope=0.22, min_gap=220):
        """Flat-ish mid ground: ruins, stones, farms, figures."""
        H = self.t.H
        ok = ((H > np.percentile(H, lo_pct)) & (H < np.percentile(H, hi_pct)) &
              (self.slope < max_slope) & (H > self.water_z + 4))
        ix, iy = self._candidates(ok)
        return self._pick(ix, iy, min_gap) if len(ix) else None


# --------------------------------------------------------------------------
# Fantasy elements
# --------------------------------------------------------------------------

def build_castle(site, terrain, rng, coll, mood):
    x, y, base_z = site
    stone = weathered_material("CastleStone", (0.17, 0.155, 0.135),
                               roughness=0.9)
    slate = simple_material("CastleSlate", (0.06, 0.065, 0.08), roughness=0.7)
    rock = weathered_material("CragRock", (0.13, 0.12, 0.11), roughness=0.95)

    scale = rng.uniform(0.8, 1.4)
    ring_r = rng.uniform(16, 26) * scale
    n_towers = rng.randint(3, 6)
    start = rng.uniform(0, 2 * math.pi)

    # rocky crag the castle grows out of
    crag = make_icosphere("CastleCrag", 1.0, coll, rock, subdivisions=4)
    crag.scale = (ring_r * 1.9, ring_r * 1.9, ring_r * 1.1)
    crag.location = (x, y, base_z - ring_r * 0.55)
    try:    # craggy displacement so the outcrop doesn't read as a blob
        ctex = bpy.data.textures.new("CragTex", "CLOUDS")
        ctex.noise_scale = 0.6
        disp = crag.modifiers.new("Craggy", "DISPLACE")
        disp.texture = ctex
        disp.strength = 0.55
    except Exception:
        pass

    top_of_crag = base_z + ring_r * 0.5
    towers = []
    for i in range(n_towers):
        a = start + i * 2 * math.pi / n_towers + rng.uniform(-0.2, 0.2)
        tx = x + math.cos(a) * ring_r
        ty = y + math.sin(a) * ring_r
        h = rng.uniform(22, 40) * scale
        r = rng.uniform(2.6, 4.2) * scale
        t = make_cylinder(f"Tower.{i}", r, h, coll, stone, segments=10)
        t.location = (tx, ty, top_of_crag + h / 2 - 6)
        roof = make_cylinder(f"TowerRoof.{i}", r * 1.3, r * 2.6, coll, slate,
                             segments=10, radius2=0.05)
        roof.location = (tx, ty, top_of_crag + h - 6 + r * 1.3)
        towers.append((tx, ty, h, r))

    for i in range(n_towers):   # curtain walls between neighbours
        x1, y1, h1, _ = towers[i]
        x2, y2, h2, _ = towers[(i + 1) % n_towers]
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        length = math.hypot(x2 - x1, y2 - y1)
        wall_h = min(h1, h2) * rng.uniform(0.45, 0.6)
        w = make_box(f"Wall.{i}", length, 2.2 * scale, wall_h, coll, stone)
        w.location = (mx, my, top_of_crag + wall_h / 2 - 6)
        w.rotation_euler = (0, 0, math.atan2(y2 - y1, x2 - x1))

    keep_h = rng.uniform(38, 60) * scale
    keep_r = rng.uniform(6, 9) * scale
    keep = make_cylinder("Keep", keep_r, keep_h, coll, stone, segments=12)
    keep.location = (x, y, top_of_crag + keep_h / 2 - 4)
    keep_roof = make_cylinder("KeepRoof", keep_r * 1.25, keep_r * 2.2, coll,
                              slate, segments=12, radius2=0.05)
    keep_roof.location = (x, y, top_of_crag + keep_h - 4 + keep_r * 1.1)

    if mood in ("blue_hour", "moonlit", "misty_dawn"):  # sparse warm windows
        win = emissive_material("Window", (1.0, 0.6, 0.25), 30)
        for _ in range(rng.randint(2, 6)):
            wobj = make_box("Window", 0.5, 0.5, 1.1, coll, win)
            a = rng.uniform(0, 2 * math.pi)
            wobj.location = (x + math.cos(a) * keep_r,
                             y + math.sin(a) * keep_r,
                             top_of_crag + rng.uniform(0.35, 0.85) * keep_h)
    return Vector((x, y, top_of_crag + keep_h * 0.7))


def build_ruins(site, rng, coll):
    x, y, z = site
    stone = weathered_material("RuinStone", (0.21, 0.195, 0.165),
                               roughness=0.92)
    ring_r = rng.uniform(6, 13)
    n = rng.randint(6, 12)
    for i in range(n):
        a = i * 2 * math.pi / n + rng.uniform(-0.25, 0.25)
        cx = x + math.cos(a) * ring_r
        cy = y + math.sin(a) * ring_r
        if rng.random() < 0.25:      # fallen column
            h = rng.uniform(3, 6)
            col = make_cylinder(f"FallenCol.{i}", 0.5, h, coll, stone, segments=9)
            col.location = (cx, cy, z + 0.5)
            col.rotation_euler = (math.pi / 2, 0, rng.uniform(0, math.pi))
        else:
            h = rng.uniform(1.0, 7.5)
            col = make_cylinder(f"Col.{i}", 0.5, h, coll, stone, segments=9)
            col.location = (cx, cy, z + h / 2 - 0.3)
            col.rotation_euler = (rng.uniform(-0.05, 0.05),
                                  rng.uniform(-0.05, 0.05), 0)
    if rng.random() < 0.7:           # a surviving arch fragment
        a = rng.uniform(0, 2 * math.pi)
        ax, ay = x + math.cos(a) * ring_r, y + math.sin(a) * ring_r
        for s in (-1.6, 1.6):
            p = make_box("ArchPost", 1.0, 1.0, 7.5, coll, stone)
            p.location = (ax + s * math.cos(a + math.pi / 2),
                          ay + s * math.sin(a + math.pi / 2), z + 3.4)
        lintel = make_box("ArchLintel", 4.6, 1.1, 1.1, coll, stone)
        lintel.location = (ax, ay, z + 7.2)
        lintel.rotation_euler = (0, 0, a + math.pi / 2)
    for i in range(rng.randint(4, 10)):   # rubble
        r = make_icosphere(f"Rubble.{i}", rng.uniform(0.4, 1.1), coll, stone, 1)
        ang, d = rng.uniform(0, 2 * math.pi), rng.uniform(0, ring_r * 1.3)
        r.location = (x + math.cos(ang) * d, y + math.sin(ang) * d, z + 0.15)
        r.scale = (1, rng.uniform(0.6, 1.2), rng.uniform(0.4, 0.8))
    return Vector((x, y, z + 4))


def build_fields(site, terrain, rng, coll, mood, mood_name):
    x, y, z = site

    def local_relief(s):
        xs = np.linspace(x - s / 2, x + s / 2, 12)
        ys = np.linspace(y - s / 2, y + s / 2, 12)
        XX, YY = np.meshgrid(xs, ys)
        hs = terrain.height(XX.ravel(), YY.ravel())
        return float(hs.max() - hs.min())

    # farmland only makes sense on genuinely gentle ground; shrink the
    # patch until it fits the local relief, or give up
    span = rng.uniform(220, 420)
    while span > 130 and local_relief(span) > span * 0.20:
        span *= 0.78
    if local_relief(span) > span * 0.24:
        return None
    mat = bpy.data.materials.new("FieldsMat")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    pset(bsdf, "Roughness", 0.95)
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = rng.uniform(9, 16)
    tex = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tex.outputs["Generated"], vor.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    g = mood["grass"]
    stops = [(0.0, (g[0] * 0.9, g[1] * 1.15, g[2] * 0.8, 1)),
             (0.3, (0.30, 0.26, 0.08, 1)),
             (0.55, (g[0] * 1.5, g[1] * 1.25, g[2], 1)),
             (0.8, (0.23, 0.15, 0.07, 1)),
             (1.0, (0.33, 0.30, 0.10, 1))]
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = stops[0]
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = stops[-1]
    for pos, col in stops[1:-1]:
        e = ramp.color_ramp.elements.new(pos)
        e.color = col
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(vor.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Red"], ramp.inputs["Fac"])

    edge = nt.nodes.new("ShaderNodeTexVoronoi")
    edge.feature = "DISTANCE_TO_EDGE"
    edge.inputs["Scale"].default_value = vor.inputs["Scale"].default_value
    nt.links.new(tex.outputs["Generated"], edge.inputs["Vector"])
    hedge = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(edge.outputs["Distance"], hedge.inputs["Value"])
    hedge.inputs["From Min"].default_value = 0.014
    hedge.inputs["From Max"].default_value = 0.007
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(hedge.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(ramp.outputs["Color"], mix.inputs[6])
    mix.inputs[7].default_value = (0.045, 0.06, 0.03, 1.0)
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])

    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=72, y_segments=72, size=span / 2)
    patch = mesh_from_bmesh("Fields", bm, coll, mat, smooth=True)
    patch.location = (x, y, z + 60)
    terrain_obj = bpy.data.objects.get("Terrain")
    sw = patch.modifiers.new("Shrinkwrap", "SHRINKWRAP")
    sw.target = terrain_obj
    sw.wrap_method = "PROJECT"
    sw.use_project_z = True
    sw.use_negative_direction = True
    sw.offset = 0.45

    house_mat = simple_material("Farmhouse", (0.42, 0.36, 0.28), 0.85)
    roof_mat = simple_material("FarmRoof", (0.12, 0.09, 0.07), 0.8)
    win_mat = emissive_material("FarmWindow", (1.0, 0.62, 0.28), 25)
    focal = Vector((x, y, z + 2))
    for i in range(rng.randint(1, 3)):
        hx = x + rng.uniform(-span / 3, span / 3)
        hy = y + rng.uniform(-span / 3, span / 3)
        hz = terrain.height(hx, hy)
        body = make_box(f"House.{i}", 7, 4.5, 3.2, coll, house_mat)
        rot = rng.uniform(0, math.pi)
        body.location = (hx, hy, hz + 1.4)
        body.rotation_euler = (0, 0, rot)
        roof = make_box(f"Roof.{i}", 7.6, 4.2, 2.4, coll, roof_mat)
        roof.location = (hx, hy, hz + 3.9)
        roof.rotation_euler = (0, math.pi / 4, rot)
        roof.scale = (1, 1.35, 1)
        if mood_name in ("blue_hour", "moonlit", "misty_dawn", "stormy"):
            wn = make_box(f"HouseWin.{i}", 0.08, 0.7, 0.6, coll, win_mat)
            wn.location = (hx + 3.56 * math.cos(rot), hy + 3.56 * math.sin(rot),
                           hz + 1.6)
            wn.rotation_euler = (0, 0, rot)
        if i == 0:
            focal = Vector((hx, hy, hz + 2))
    return focal


def build_stones(site, rng, coll, mood):
    x, y, z = site
    stone = simple_material("StandingStone", (0.20, 0.19, 0.18), 0.9)
    glow = emissive_material("MagicGlow", mood["magic_color"],
                             rng.uniform(6, 20))
    ring_r = rng.uniform(5, 10)
    n = rng.randint(5, 9)
    for i in range(n):
        a = i * 2 * math.pi / n + rng.uniform(-0.15, 0.15)
        h = rng.uniform(3.0, 6.0)
        s = make_box(f"Stone.{i}", rng.uniform(0.9, 1.5),
                     rng.uniform(0.6, 1.0), h, coll, stone)
        s.location = (x + math.cos(a) * ring_r, y + math.sin(a) * ring_r,
                      z + h / 2 - 0.4)
        s.rotation_euler = (rng.uniform(-0.09, 0.09),
                            rng.uniform(-0.09, 0.09),
                            rng.uniform(0, math.pi))
    shard = make_icosphere("MagicShard", 1.0, coll, glow, 2)
    shard.scale = (0.5, 0.5, rng.uniform(1.2, 2.2))
    hover = rng.uniform(1.5, 4.0)
    shard.location = (x, y, z + hover)
    for i in range(rng.randint(3, 7)):   # small levitating rocks
        peb = make_icosphere(f"FloatRock.{i}", rng.uniform(0.15, 0.45),
                             coll, stone, 1)
        a = rng.uniform(0, 2 * math.pi)
        d = rng.uniform(1.2, 3.2)
        peb.location = (x + math.cos(a) * d, y + math.sin(a) * d,
                        z + hover + rng.uniform(-1, 1.4))
    light = bpy.data.lights.new("MagicLight", "POINT")
    light.color = mood["magic_color"]
    light.energy = rng.uniform(800, 3500)
    light.shadow_soft_size = 2.5
    lo = bpy.data.objects.new("MagicLight", light)
    lo.location = (x, y, z + hover)
    link_obj(lo, coll)
    return Vector((x, y, z + hover))


def build_spire(site, rng, coll, mood):
    x, y, z = site
    hull = simple_material("SpireHull", (0.03, 0.032, 0.038),
                           roughness=0.25, metallic=0.85)
    trim = emissive_material("SpireTrim", mood["magic_color"],
                             rng.uniform(4, 12))
    h = rng.uniform(90, 200)
    w = h * rng.uniform(0.045, 0.08)
    spire = make_box("Spire", w, w * 0.55, h, coll, hull)
    spire.location = (x, y, z + h / 2 - 5)
    spire.rotation_euler = (0, 0, rng.uniform(0, math.pi))
    taper = spire.modifiers.new("Taper", "SIMPLE_DEFORM")
    taper.deform_method = "TAPER"
    taper.factor = -rng.uniform(0.75, 0.95)
    taper.deform_axis = "Z"
    ring = make_cylinder("SpireRing", w * 0.5, 0.5, coll, trim, segments=16)
    ring.location = (x, y, z + h * rng.uniform(0.6, 0.8))
    return Vector((x, y, z + h * 0.65))


def build_ships(terrain, rng, coll, mood, cam, view_azim):
    hull = simple_material("ShipHull", (0.02, 0.022, 0.028),
                           roughness=0.4, metallic=0.7)
    lightm = emissive_material("ShipLight", (0.9, 0.95, 1.0),
                               rng.uniform(15, 50))
    top = terrain.H.max()
    n = rng.randint(1, 4)
    first = None
    heading = rng.uniform(0, 2 * math.pi)
    for i in range(n):
        length = rng.uniform(60, 220)
        # keep the flotilla inside the camera's field of view, far off
        ang = view_azim + rng.uniform(-0.35, 0.35)
        dist = rng.uniform(1400, 4500)
        cx = cam.location.x + math.cos(ang) * dist
        cy = cam.location.y + math.sin(ang) * dist
        cz = top + rng.uniform(150, 700) + i * rng.uniform(20, 90)
        ship = make_icosphere(f"Ship.{i}", 1.0, coll, hull, 2)
        ship.scale = (length / 2, length * 0.11, length * 0.06)
        ship.location = (cx, cy, cz)
        ship.rotation_euler = (0, rng.uniform(-0.03, 0.03),
                               heading + rng.uniform(-0.15, 0.15))
        fin = make_box(f"ShipFin.{i}", length * 0.16, length * 0.02,
                       length * 0.10, coll, hull)
        fin.location = (cx - math.cos(heading) * length * 0.3,
                        cy - math.sin(heading) * length * 0.3,
                        cz + length * 0.05)
        fin.rotation_euler = (0, 0, heading)
        for k in range(rng.randint(2, 5)):
            d = make_icosphere(f"ShipLight.{i}.{k}", length * 0.006, coll,
                               lightm, 1)
            t = rng.uniform(-0.4, 0.4)
            d.location = (cx + math.cos(heading) * length * t,
                          cy + math.sin(heading) * length * t,
                          cz - length * 0.055)
        if first is None:
            first = Vector((cx, cy, cz))
    return first


def build_figures(terrain, cam_pos, focal, rng, coll):
    cloth = simple_material("FigureCloth", (0.025, 0.022, 0.02), 0.95)
    n = rng.randint(1, 3)
    t = rng.uniform(0.22, 0.45)
    bx = cam_pos.x + (focal.x - cam_pos.x) * t
    by = cam_pos.y + (focal.y - cam_pos.y) * t
    side = rng.uniform(-25, 25)
    dirx, diry = focal.x - cam_pos.x, focal.y - cam_pos.y
    L = math.hypot(dirx, diry) + 1e-9
    bx += -diry / L * side
    by += dirx / L * side
    for i in range(n):
        fx = bx + rng.uniform(-3, 3)
        fy = by + rng.uniform(-3, 3)
        fz = terrain.height(fx, fy)
        body = make_cylinder(f"Figure.{i}", 0.24, 1.15, coll, cloth, segments=8)
        body.location = (fx, fy, fz + 0.95)
        cloak = make_cylinder(f"Cloak.{i}", 0.5, 1.2, coll, cloth,
                              segments=8, radius2=0.22)
        cloak.location = (fx, fy, fz + 0.75)
        head = make_icosphere(f"Head.{i}", 0.15, coll, cloth, 1)
        head.location = (fx, fy, fz + 1.62)
    return Vector((bx, by, terrain.height(bx, by) + 1.2))


# --------------------------------------------------------------------------
# Nature scatter: trees & boulders
# --------------------------------------------------------------------------

def tree_prototypes(mood, rng, coll):
    prototypes = []
    conifer_mat = simple_material(
        "Conifer", tuple(min(1.0, c * rng.uniform(0.8, 1.2))
                         for c in (0.022, 0.05, 0.025)), 0.95)
    trunk_mat = simple_material("Trunk", (0.09, 0.06, 0.04), 0.9)
    bm = bmesh.new()
    z0 = 0.0
    for radius, height in ((1.6, 2.6), (1.25, 2.4), (0.85, 2.2)):
        geom = None
        try:
            geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=7,
                                         radius1=radius, radius2=0.03,
                                         depth=height)
        except TypeError:
            geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=7,
                                         diameter1=radius * 2, diameter2=0.06,
                                         depth=height)
        verts = geom["verts"]
        bmesh.ops.translate(bm, vec=(0, 0, z0 + height / 2 + 1.0), verts=verts)
        z0 += height * 0.62
    proto = mesh_from_bmesh("TreeProto", bm, coll, conifer_mat, smooth=False)
    trunk = make_cylinder("TrunkProto", 0.18, 2.0, coll, trunk_mat, segments=6)
    trunk.location = (0, 0, 1.0)
    trunk.parent = proto
    proto.location = (0, 0, -4000)   # prototype parked out of sight
    prototypes.append(proto)
    return prototypes


def scatter_trees(terrain, water_z, mood, nk, rng, coll, count):
    protos = tree_prototypes(mood, rng, coll)
    slope = blur(terrain.slope(), 2)
    H = terrain.H
    treeline = np.percentile(H, 80)
    floor = (water_z + 4) if water_z is not None else H.min() + 2
    n = terrain.n
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 20:
        attempts += 1
        ix = rng.randint(int(n * 0.1), int(n * 0.9))
        iy = rng.randint(int(n * 0.1), int(n * 0.9))
        if slope[iy, ix] > 0.7 or not (floor < H[iy, ix] < treeline):
            continue
        x, y = terrain.grid_to_world(ix, iy)
        clump = nk.fbm(np.array([x * 0.002]), np.array([y * 0.002]),
                       3, offset=(77.0, -12.0))[0]
        if clump < rng.uniform(-0.18, 0.12):
            continue
        proto = protos[0]
        inst = bpy.data.objects.new(f"Tree.{placed}", proto.data)
        s = rng.uniform(0.9, 2.4)
        inst.scale = (s, s, s * rng.uniform(0.9, 1.3))
        inst.location = (x + rng.uniform(-3, 3), y + rng.uniform(-3, 3),
                         terrain.height(x, y) - 0.4)
        inst.rotation_euler = (rng.uniform(-0.04, 0.04),
                               rng.uniform(-0.04, 0.04),
                               rng.uniform(0, 2 * math.pi))
        link_obj(inst, coll)
        for child in proto.children:
            ci = bpy.data.objects.new(f"TreeTrunk.{placed}", child.data)
            ci.parent = inst
            ci.location = child.location
            link_obj(ci, coll)
        placed += 1
    return placed


def scatter_boulders(terrain, rng, coll, count):
    rock = simple_material("Boulder", (0.14, 0.13, 0.12), 0.95)
    slope = blur(terrain.slope(), 2)
    n = terrain.n
    placed = 0
    attempts = 0
    while placed < count and attempts < count * 15:
        attempts += 1
        ix = rng.randint(int(n * 0.12), int(n * 0.88))
        iy = rng.randint(int(n * 0.12), int(n * 0.88))
        if not (0.25 < slope[iy, ix] < 0.9):
            continue
        x, y = terrain.grid_to_world(ix, iy)
        b = make_icosphere(f"Boulder.{placed}", rng.uniform(1.2, 4.5),
                           coll, rock, 1)
        b.location = (x, y, terrain.height(x, y) + 0.2)
        b.scale = (1, rng.uniform(0.6, 1.3), rng.uniform(0.45, 0.85))
        b.rotation_euler = (rng.uniform(0, 3), rng.uniform(0, 3),
                            rng.uniform(0, 3))
        placed += 1
    return placed


# --------------------------------------------------------------------------
# Camera
# --------------------------------------------------------------------------

def place_camera(scene, terrain, focal, rng, coll, water_z):
    # aim below the focal's top so the land holds most of the frame
    ground_f = terrain.height(focal.x, focal.y)
    aim = Vector((focal.x, focal.y,
                  ground_f + (focal.z - ground_f) * 0.45 + 4))
    cam_data = bpy.data.cameras.new("CineCam")
    cam_data.lens = rng.choice([35, 35, 50, 50, 50, 85])
    cam_data.sensor_width = 36
    cam_data.clip_start = 0.5
    cam_data.clip_end = 60000.0     # the world is ~20 km across
    cam = bpy.data.objects.new("CineCam", cam_data)
    link_obj(cam, coll)
    scene.camera = cam

    base_dist = {35: (350, 700), 50: (450, 950), 85: (700, 1400)}[int(cam_data.lens)]
    lim = terrain.size * 0.47
    ax = max(-lim * 0.7, min(lim * 0.7, focal.x))
    ay = max(-lim * 0.7, min(lim * 0.7, focal.y))
    best = None
    for _ in range(80):
        ang = rng.uniform(0, 2 * math.pi)
        dist = rng.uniform(*base_dist)
        cx = ax + math.cos(ang) * dist
        cy = ay + math.sin(ang) * dist
        if abs(cx) > lim or abs(cy) > lim:
            continue
        ground = terrain.height(cx, cy)
        if water_z is not None and ground < water_z + 2:
            continue          # keep the camera on dry land
        cz = ground + rng.uniform(6, 55)
        # keep the horizon in a cinematic band: not staring at the ground
        horiz = math.hypot(aim.x - cx, aim.y - cy)
        pitch = math.atan2(aim.z - cz, max(horiz, 1.0))
        pitch_pen = max(0.0, -0.30 - pitch) + max(0.0, pitch - 0.18)
        # line-of-sight: sample along the ray, count blocked samples
        blocked = 0
        for t in np.linspace(0.08, 0.92, 18):
            sx = cx + (aim.x - cx) * t
            sy = cy + (aim.y - cy) * t
            sz = cz + (aim.z - cz) * t
            if terrain.height(sx, sy) > sz + 2:
                blocked += 1
        score = -blocked * 10 - pitch_pen * 60 + rng.uniform(0, 1)
        if best is None or score > best[0]:
            best = (score, cx, cy, cz)
        if blocked == 0 and pitch_pen == 0:
            break
    if best is None:
        # guaranteed dry-land fallback: nearest in-bounds cell to the
        # preferred shooting distance
        n = terrain.n
        b = int(n * 0.16)
        yy, xx = np.mgrid[b:n - b, b:n - b]
        gx = (xx / (n - 1) - 0.5) * terrain.size
        gy = (yy / (n - 1) - 0.5) * terrain.size
        Hs = terrain.H[b:n - b, b:n - b]
        d = np.hypot(gx - ax, gy - ay)
        wz = water_z if water_z is not None else -1e9
        d = np.where(Hs > wz + 2, np.abs(d - base_dist[0]), 1e12)
        k = np.argmin(d)
        cx, cy = float(gx.ravel()[k]), float(gy.ravel()[k])
        best = (0, cx, cy, terrain.height(cx, cy) + 25)
    _, cx, cy, cz = best
    cam.location = (cx, cy, cz)

    # aim with a gentle rule-of-thirds offset
    look = aim - cam.location
    rot = look.to_track_quat("-Z", "Y").to_euler()
    cam.rotation_euler = rot
    cam_data.shift_x = rng.uniform(-0.07, 0.07)
    cam_data.shift_y = rng.uniform(-0.03, 0.06)
    if rng.random() < 0.2:
        cam_data.dof.use_dof = True
        cam_data.dof.focus_distance = look.length
        cam_data.dof.aperture_fstop = rng.uniform(5.6, 11)
    return cam


def sun_azimuth_for(mood, cam, focal, rng):
    view = math.atan2(focal.y - cam.location.y, focal.x - cam.location.x)
    mode = mood["sun_dir"]
    if mode == "toward":            # shooting into the light: silhouettes
        off = rng.uniform(-0.5, 0.5)
    elif mode == "side":
        off = rng.choice([-1, 1]) * rng.uniform(1.1, 1.7)
    else:                           # rim: sun behind-and-to-the-side
        off = rng.choice([-1, 1]) * rng.uniform(0.6, 1.15)
    return view + off


# --------------------------------------------------------------------------
# Compositor (glare + vignette) — handles 4.x and 5.x APIs
# --------------------------------------------------------------------------

def setup_compositor(scene, mood):
    try:
        nt = None
        if hasattr(scene, "compositing_node_group"):
            # Blender 5.x: the compositor tree is a node-group datablock;
            # render passes come from a Render Layers node inside it.
            nt = bpy.data.node_groups.new("FantasyComp", "CompositorNodeTree")
            scene.compositing_node_group = nt
            nt.interface.new_socket("Image", in_out="OUTPUT",
                                    socket_type="NodeSocketColor")
            rl = nt.nodes.new("CompositorNodeRLayers")
            outp = nt.nodes.new("NodeGroupOutput")
            src_out = rl.outputs["Image"]
            dst_in = outp.inputs[0]
        else:
            scene.use_nodes = True
            nt = scene.node_tree
            nt.nodes.clear()
            rl = nt.nodes.new("CompositorNodeRLayers")
            comp = nt.nodes.new("CompositorNodeComposite")
            src_out = rl.outputs["Image"]
            dst_in = comp.inputs["Image"]

        glare = nt.nodes.new("CompositorNodeGlare")
        try:
            glare.glare_type = "FOG_GLOW"
        except Exception:
            pass
        for attr, val in (("quality", "MEDIUM"), ("size", 8),
                          ("threshold", 1.0), ("mix", -0.55)):
            try:
                setattr(glare, attr, val)
            except Exception:
                pass
        try:
            glare.inputs["Strength"].default_value = 0.06 * mood["glare"]
        except Exception:
            pass
        nt.links.new(src_out, glare.inputs["Image"])
        nt.links.new(glare.outputs["Image"], dst_in)
        return True
    except Exception as exc:
        print(f"[fantasy] compositor skipped: {exc}")
        return False


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

ELEMENTS = ("castle", "ruins", "fields", "stones", "spire", "ships", "figures")


def decide_elements(rng, mood_name, mood, opts):
    p = {
        "castle": 0.45, "ruins": 0.40, "fields": 0.35, "stones": 0.35,
        "spire": 0.12 + mood["scifi_bias"], "ships": 0.18 + mood["scifi_bias"],
        "figures": 0.25,
    }
    chosen = {e for e in ELEMENTS if rng.random() < p[e]}
    chosen |= (opts["force_on"] & set(ELEMENTS))
    chosen -= opts["force_off"]
    focal_worthy = {"castle", "spire", "ruins", "stones", "fields"}
    if not (chosen & focal_worthy) and not opts["force_off"] >= focal_worthy:
        pick = rng.choice(sorted(focal_worthy - opts["force_off"]))
        chosen.add(pick)
    return chosen


def main():
    t0 = time.time()
    opts = parse_args()
    seed = opts["seed"] if opts["seed"] is not None else random.randrange(10 ** 6)
    rng = random.Random(seed)
    nrng = np.random.default_rng(seed)
    nk = NoiseKit(nrng)

    mood_name = opts["mood"] or rng.choice(sorted(MOODS.keys()))
    if mood_name not in MOODS:
        print(f"Unknown mood '{mood_name}'. Options: {', '.join(MOODS)}")
        sys.exit(1)
    mood = MOODS[mood_name]
    archetype = opts["archetype"] or rng.choice(ARCHETYPES)

    print(f"[fantasy] seed={seed} mood={mood_name} archetype={archetype} "
          f"grid={opts['grid']}")

    scene = reset_scene()
    configure_render(scene, opts, mood, rng)

    c_terrain = new_collection("Terrain")
    c_elements = new_collection("Elements")
    c_nature = new_collection("Nature")
    c_atmos = new_collection("Atmosphere")
    c_cam = new_collection("Cameras")

    # ---- terrain -----------------------------------------------------------
    size = 3000.0
    H, water_z = generate_heightfield(archetype, opts["grid"], size, nk, rng,
                                      nrng)
    terrain = Terrain(H, size)
    # snowline: genuinely high ground only, never rolling lowlands
    relief = float(H.max() - H.min())
    snow_z = max(float(np.percentile(H, rng.uniform(90, 97))),
                 float(H.min() + 0.62 * relief))
    if relief < 330:          # low country: no snow at all
        snow_z = float(H.max() + 500)
    mat = terrain_material(mood, rng, water_z, snow_z)
    build_terrain_mesh("Terrain", H, size, c_terrain, mat)

    # far shell: coarse distant mountains ringing the playable terrain
    n2 = 192
    far_size = 20000.0
    axis2 = np.linspace(-far_size / 2, far_size / 2, n2)
    X2, Y2 = np.meshgrid(axis2, axis2)
    far = nk.ridged(X2 * 0.00028, Y2 * 0.00028, 6, offset=(101.0, 55.0))
    far = np.power(np.clip(far, 0, None), 1.4) * rng.uniform(700, 1200)
    far += (nk.fbm(X2 * 0.0005, Y2 * 0.0005, 4) * 0.5 + 0.5) * 200
    r = np.maximum(np.abs(X2), np.abs(Y2))
    mask = smoothstep(size * 0.42, size * 0.85, r)
    far = far * mask - 40 * (1 - mask)
    build_terrain_mesh("FarShell", far, far_size, c_terrain, mat, z_offset=-2)

    if water_z is not None:
        build_water(water_z, mood, c_terrain, rng)

    # ---- atmosphere --------------------------------------------------------
    sun, sky = build_sky_and_sun(scene, mood, rng, c_atmos)
    fog_top = (water_z if water_z is not None else float(H.min())) + \
        rng.uniform(*mood["fog_top_add"])
    build_fog(mood, rng, c_atmos, float(H.min()), fog_top, opts["volumetrics"])
    build_clouds(mood, rng, c_atmos, float(H.max()))

    # ---- elements ----------------------------------------------------------
    chosen = decide_elements(rng, mood_name, mood, opts)
    finder = SiteFinder(terrain, water_z, rng)
    focals = {}

    if "castle" in chosen:
        site = finder.promontory()
        if site:
            focals["castle"] = build_castle(site, terrain, rng, c_elements,
                                            mood_name)
    if "spire" in chosen:
        site = finder.promontory(min_gap=400)
        if site:
            focals["spire"] = build_spire(site, rng, c_elements, mood)
    if "ruins" in chosen:
        site = finder.gentle(20, 75, 0.3)
        if site:
            focals["ruins"] = build_ruins(site, rng, c_elements)
    if "stones" in chosen:
        site = finder.gentle(25, 80, 0.25)
        if site:
            focals["stones"] = build_stones(site, rng, c_elements, mood)
    if "fields" in chosen:
        site = finder.gentle(8, 45, 0.14, min_gap=350)
        if site:
            focals["fields"] = build_fields(site, terrain, rng, c_elements,
                                            mood, mood_name)
    # ---- nature ------------------------------------------------------------
    tree_count = 250 if opts["fast"] else rng.randint(450, 900)
    n_trees = scatter_trees(terrain, water_z, mood, nk, rng, c_nature,
                            tree_count)
    n_boulders = scatter_boulders(terrain, rng, c_nature,
                                  20 if opts["fast"] else rng.randint(25, 60))

    # ---- camera, sun aim, figures -----------------------------------------
    priority = ["castle", "spire", "ruins", "stones", "fields"]
    focal = next((focals[k] for k in priority if k in focals and focals[k]),
                 None)
    if focal is None:      # aim at the most dramatic peak
        iy, ix = np.unravel_index(np.argmax(H), H.shape)
        fx, fy = terrain.grid_to_world(ix, iy)
        focal = Vector((fx, fy, float(H.max())))

    cam = place_camera(scene, terrain, focal, rng, c_cam, water_z)
    azim = sun_azimuth_for(mood, cam, focal, rng)
    aim_sun(sun, sky, sun["elev"], azim)

    view_azim = math.atan2(focal.y - cam.location.y, focal.x - cam.location.x)
    if "ships" in chosen:
        focals["ships"] = build_ships(terrain, rng, c_elements, mood, cam,
                                      view_azim)
    if "figures" in chosen:
        focals["figures"] = build_figures(terrain, cam.location, focal, rng,
                                          c_elements)

    setup_compositor(scene, mood)

    present = sorted(k for k, v in focals.items() if v)
    print(f"[fantasy] elements: {', '.join(present) if present else 'none'} | "
          f"trees={n_trees} boulders={n_boulders} | "
          f"water={'yes' if water_z is not None else 'no'} | "
          f"lens={int(cam.data.lens)}mm | built in {time.time() - t0:.1f}s")
    print(f"[fantasy] recipe: --seed {seed} --mood {mood_name} "
          f"--archetype {archetype}")

    if opts["save"]:
        bpy.ops.wm.save_as_mainfile(filepath=bpy.path.abspath(opts["save"]))
        print(f"[fantasy] saved {opts['save']}")
    if opts["render"]:
        scene.render.filepath = bpy.path.abspath(opts["render"])
        print(f"[fantasy] rendering {opts['res'][0]}x{opts['res'][1]} at "
              f"{opts['samples']} samples...")
        bpy.ops.render.render(write_still=True)
        print(f"[fantasy] wrote {opts['render']} "
              f"(total {time.time() - t0:.1f}s)")


if __name__ == "__main__":
    main()
