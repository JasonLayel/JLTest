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
import os
import re
import time
import numpy as np
from mathutils import Vector, Euler
from mathutils import noise as mnoise

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
        "asset_lib": os.environ.get("FANTASY_ASSET_LIB"),
        "hdri_dir": os.environ.get("FANTASY_HDRI_DIR"),
        "hdri": None, "clouds": "deck", "lod": 2, "tex_res": "2k",
        "relief": 1.0, "hdri_match": None,
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
        elif a == "--asset-lib":
            opts["asset_lib"] = nxt()
        elif a == "--hdri-dir":
            opts["hdri_dir"] = nxt()
        elif a == "--hdri":
            opts["hdri"] = nxt()
        elif a == "--clouds":
            opts["clouds"] = nxt()   # deck | volume | off
        elif a == "--lod":
            opts["lod"] = int(nxt())
        elif a == "--tex-res":
            opts["tex_res"] = nxt().lower()
        elif a == "--relief":
            opts["relief"] = float(nxt())
        elif a == "--hdri-match":
            opts["hdri_match"] = nxt().lower()
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


def generate_heightfield(kind, n, size, nk, rng, nrng, relief=1.0):
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

    # craggy summits: high ground gets a little extra ridged roughness so
    # peaks and big hills never end as perfectly smooth cones (kept gentle
    # and blurred so it never facets into shading artifacts)
    span0 = max(H.max() - H.min(), 1e-6)
    hn = (H - H.min()) / span0
    crag = (nk.ridged(wx * 0.0018, wy * 0.0018, 5, offset=(9.0, 77.0)) - 0.4) \
        * span0 * 0.11 * np.power(hn, 1.6)
    H += blur(crag, 1)

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
    H = blur(H_scaled, 2) * cell              # extra blur kills single-cell
    H = np.clip(np.nan_to_num(H, nan=lo), lo - 40, hi + 20)   # spikes/creases

    # RELIEF: scale height about the mean. 0 = flat plain, 1 = default,
    # >1 = dramatic mountains. Lets the user dial "how mountainous".
    base = float(np.percentile(H, 30))
    H = base + (H - base) * float(max(relief, 0.0))

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
# Asset library: link user-owned scans (Quixel/Megascans etc.) from .blend
# asset files. One or many .blend files in the library folder; objects
# marked as Assets are classified by name keywords. Fully optional — the
# generator falls back to procedural prototypes without it.
# --------------------------------------------------------------------------

ASSET_KEYWORDS = {
    # trees/plants checked first so a "3dplant" path never falls through to
    # the broad rock words
    "tree": ("tree", "3dplant", "plant", "vegetation", "foliage", "bush",
             "shrub", "fern", "pine", "spruce", "fir", "birch", "oak",
             "juniper", "cypress", "poplar", "willow", "maple", "aspen",
             "trunk", "stump", "log", "branch"),
    "rock": ("rock", "cliff", "stone", "boulder", "scree", "rubble", "crag",
             "granite", "sandstone", "limestone"),
}


# Megascans / FAB texture map filename keywords -> shader role
MEGA_TEX_ROLES = {
    "base": ("albedo", "basecolor", "base_color", "diffuse", "_col", "_color"),
    "normal": ("normal", "_nrm", "normalgl", "_nor"),
    "rough": ("roughness", "_rgh", "_rough"),
    "ao": ("occlusion", "ambientocclusion", "_ao"),
    "disp": ("displacement", "height", "_dsp", "_disp"),
    "metal": ("metalness", "metallic", "_mtl"),
    "opacity": ("opacity", "alpha", "_opc", "_mask"),
}
_TEX_EXT = (".jpg", ".jpeg", ".png", ".exr", ".tif", ".tiff")
_RES_PREF = ("2k", "1k", "512", "4k", "8k")   # scatter: balance detail/memory


def _enable_fbx():
    try:
        import addon_utils
        addon_utils.enable("io_scene_fbx", default_set=False, persistent=True)
    except Exception:
        pass


def classify_asset_text(text):
    """Return the first asset category whose keyword appears in text."""
    for cat, keys in ASSET_KEYWORDS.items():
        if any(k in text for k in keys):
            return cat
    return None


def pick_lod_fbx(folder, filenames, prefer_lod):
    fbxs = [f for f in filenames if f.lower().endswith(".fbx")]
    if not fbxs:
        return None
    best = None
    for f in fbxs:
        m = re.search(r"lod(\d+)", f.lower())
        lod = int(m.group(1)) if m else 0
        score = abs(lod - prefer_lod)
        # prefer closest to target LOD; on ties take the lower-poly (higher) one
        if best is None or (score, -lod) < (best[0], -best[2]):
            best = (score, f, lod)
    return best[1]


def _list_images(d):
    try:
        return [(os.path.join(d, f), f) for f in os.listdir(d)
                if f.lower().endswith(_TEX_EXT)]
    except Exception:
        return []


def collect_textures(folder, res_pref):
    """Find one texture per PBR role. Textures usually sit beside the FBX;
    some libraries put them one level up or in a 'Textures' subfolder, so we
    search the folder first, then the neighborhood for anything missing."""
    order = (res_pref.lower(),) + tuple(r for r in _RES_PREF
                                        if r != res_pref.lower())

    def res_rank(name):
        low = name.lower()
        for i, r in enumerate(order):
            if r in low:
                return i
        return len(order)

    here = _list_images(folder)
    near = []
    near += _list_images(os.path.dirname(folder))
    try:
        for e in os.listdir(folder):
            p = os.path.join(folder, e)
            if os.path.isdir(p):
                near += _list_images(p)
    except Exception:
        pass

    def match(role, keys, pool):
        cands = [(p, f) for (p, f) in pool if any(k in f.lower() for k in keys)]
        if role == "normal":     # keep 'ao'/'col' substrings from stealing it
            cands = [(p, f) for (p, f) in cands if "normal" in f.lower()
                     or "_nrm" in f.lower() or "_nor" in f.lower()]
        if not cands:
            return None
        cands.sort(key=lambda pf: (res_rank(pf[1]), len(pf[1])))
        return cands[0][0]

    tex = {}
    for role, keys in MEGA_TEX_ROLES.items():
        hit = match(role, keys, here) or match(role, keys, near)
        if hit:
            tex[role] = hit
    return tex


def build_pbr_material(name, tex):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    def img_node(path, non_color):
        n = nt.nodes.new("ShaderNodeTexImage")
        try:
            n.image = bpy.data.images.load(path, check_existing=True)
            if non_color:
                n.image.colorspace_settings.name = "Non-Color"
        except Exception as exc:
            print(f"[fantasy]   tex load fail {os.path.basename(path)}: {exc}")
            return None
        return n

    base = img_node(tex["base"], False) if "base" in tex else None
    if base:
        if "ao" in tex:      # multiply AO into base color
            ao = img_node(tex["ao"], True)
            if ao:
                mix = nt.nodes.new("ShaderNodeMixRGB")
                mix.blend_type = "MULTIPLY"
                mix.inputs["Fac"].default_value = 0.8
                nt.links.new(base.outputs["Color"], mix.inputs["Color1"])
                nt.links.new(ao.outputs["Color"], mix.inputs["Color2"])
                nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
            else:
                nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
    if "rough" in tex:
        r = img_node(tex["rough"], True)
        if r:
            nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
    if "metal" in tex:
        m = img_node(tex["metal"], True)
        if m:
            nt.links.new(m.outputs["Color"], bsdf.inputs["Metallic"])
    if "opacity" in tex:
        o = img_node(tex["opacity"], True)
        if o:
            pset(bsdf, "Alpha", 0.0)   # ensure the socket accepts a link
            nt.links.new(o.outputs["Color"], bsdf.inputs["Alpha"])
            try:
                mat.blend_method = "CLIP"
                mat.shadow_method = "CLIP"
            except Exception:
                pass
    normal_out = None
    if "normal" in tex:
        nn = img_node(tex["normal"], True)
        if nn:
            nmap = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(nn.outputs["Color"], nmap.inputs["Color"])
            normal_out = nmap.outputs["Normal"]
    if "disp" in tex:
        dn = img_node(tex["disp"], True)
        if dn:
            bump = nt.nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = 0.3
            nt.links.new(dn.outputs["Color"], bump.inputs["Height"])
            if normal_out:
                nt.links.new(normal_out, bump.inputs["Normal"])
            normal_out = bump.outputs["Normal"]
    if normal_out:
        nt.links.new(normal_out, bsdf.inputs["Normal"])
    return mat


def import_fbx_object(path):
    """Import an FBX, return one joined mesh object unlinked from the scene."""
    _enable_fbx()
    before = set(bpy.data.objects)
    try:
        bpy.ops.import_scene.fbx(filepath=path)
    except Exception as exc:
        print(f"[fantasy]   fbx import fail {os.path.basename(path)}: {exc}")
        return None
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    extras = [o for o in new if o.type != "MESH"]
    main = None
    if meshes:
        try:                       # join all parts into the first mesh
            for o in bpy.data.objects:
                o.select_set(False)
            for o in meshes:
                o.select_set(True)
            bpy.context.view_layer.objects.active = meshes[0]
            if len(meshes) > 1:
                bpy.ops.object.join()
            main = meshes[0]
        except Exception:
            main = max(meshes, key=lambda o: len(o.data.vertices))
            for o in meshes:
                if o is not main:
                    bpy.data.objects.remove(o, do_unlink=True)
    for o in extras:
        bpy.data.objects.remove(o, do_unlink=True)
    if main is None:
        return None
    for c in list(main.users_collection):   # detach from render collections
        c.objects.unlink(main)
    return main


MESH_EXTS = (".fbx", ".obj")


def scan_megascans_folders(root, max_depth=12):
    """Walk root; every dir directly containing a mesh file is an asset
    folder. Classification uses the WHOLE relative path (so a parent folder
    like '3dplant' or 'rock' is enough) plus any JSON metadata and the file
    names. Prints a diagnostic so an unfamiliar layout is visible."""
    assets = []
    root = os.path.abspath(root)
    base = root.rstrip(os.sep).count(os.sep)
    n_mesh_dirs = 0
    unclassified = []
    for dirpath, dirnames, filenames in os.walk(root):
        if dirpath.count(os.sep) - base > max_depth:
            dirnames[:] = []
            continue
        if not any(f.lower().endswith(MESH_EXTS) for f in filenames):
            continue
        n_mesh_dirs += 1
        # full path from the library root: catches '.../Downloaded/3dplant/...'
        text = os.path.relpath(dirpath, root).replace(os.sep, " ").lower()
        for f in filenames:
            if f.lower().endswith(".json"):
                try:
                    with open(os.path.join(dirpath, f), encoding="utf-8",
                              errors="ignore") as fh:
                        text += " " + fh.read().lower()
                except Exception:
                    pass
        text += " " + " ".join(filenames).lower()
        cat = classify_asset_text(text)
        fallback = False
        if cat is None:
            # Megascans/FAB 3D scans with ID-named folders and no useful
            # metadata: non-plant scans scattered on terrain are almost
            # always rocks/debris, so default them to rock rather than drop
            is_mega = any(k in text for k in ("3d", "megascans", "quixel",
                                              "fab", "scan"))
            if is_mega:
                cat, fallback = "rock", True
        if cat:
            assets.append((dirpath, cat, filenames))
            if fallback:
                unclassified.append(os.path.basename(dirpath) + " ->rock")
        else:
            unclassified.append(os.path.basename(dirpath))
        dirnames[:] = []           # don't descend into an asset's LOD subdirs
    if n_mesh_dirs:
        by_cat = {}
        for _, c, _ in assets:
            by_cat[c] = by_cat.get(c, 0) + 1
        print(f"[fantasy] megascans scan: {n_mesh_dirs} mesh folders under "
              f"{root} -> classified {by_cat or '{}'}")
        if unclassified:
            print(f"[fantasy]   {len(unclassified)} unclassified, e.g. "
                  f"{unclassified[:6]}")
    else:
        print(f"[fantasy] megascans scan: no .fbx/.obj folders found under "
              f"{root} (check the path, or that meshes are extracted)")
    return assets


def load_asset_library(lib_dir, rng=None, max_per_cat=8, prefer_lod=2,
                       tex_res="2k"):
    """Build cat->[objects] from a library folder. Handles two layouts:
    (1) .blend files with objects marked as Assets  -> linked
    (2) raw Megascans/FAB folders (FBX + textures)   -> imported + PBR mats
    Fully optional; returns None when nothing usable is found."""
    if not lib_dir or not os.path.isdir(lib_dir):
        return None
    cats = {k: [] for k in ASSET_KEYWORDS}

    # (1) marked-asset .blend files
    for fname in sorted(os.listdir(lib_dir)):
        if not fname.endswith(".blend"):
            continue
        path = os.path.join(lib_dir, fname)
        try:
            with bpy.data.libraries.load(path, link=True,
                                         assets_only=True) as (dfrom, dto):
                dto.objects = list(dfrom.objects)
        except Exception as exc:
            print(f"[fantasy] asset lib skip {fname}: {exc}")
            continue
        for obj in dto.objects:
            if obj is None or obj.type != "MESH":
                continue
            cat = classify_asset_text(obj.name.lower())
            if cat:
                cats[cat].append(obj)

    # (2) raw Megascans/FAB asset folders
    mega = scan_megascans_folders(lib_dir)
    by_cat = {}
    for entry in mega:
        by_cat.setdefault(entry[1], []).append(entry)
    for cat, items in by_cat.items():
        if rng is not None and len(items) > max_per_cat:
            items = rng.sample(items, max_per_cat)
        else:
            items = items[:max_per_cat]
        for folder, _, filenames in items:
            fbx = pick_lod_fbx(folder, filenames, prefer_lod)
            if not fbx:
                continue
            obj = import_fbx_object(os.path.join(folder, fbx))
            if obj is None:
                continue
            tex = collect_textures(folder, tex_res)
            if tex:
                mat = build_pbr_material(os.path.basename(folder), tex)
                obj.data.materials.clear()
                obj.data.materials.append(mat)
            obj.name = "MEGA_" + os.path.basename(folder)
            cats[cat].append(obj)
            print(f"[fantasy]   imported {cat}: {os.path.basename(folder)} "
                  f"({fbx}, {len(tex)} maps)")

    found = {k: len(v) for k, v in cats.items() if v}
    if found:
        print(f"[fantasy] asset library: {found} from {lib_dir}")
        return cats
    return None


def build_proto_collection(name, objs, target_size):
    """Hidden prototype collection; objects normalized to target_size."""
    coll = bpy.data.collections.new(name)     # not linked to the scene:
    for i, src in enumerate(objs):            # originals never render
        ob = bpy.data.objects.new(f"{name}.{i}", src.data)
        dim = max(src.dimensions[:] or [1.0]) or 1.0
        s = target_size / dim
        ob.scale = (s, s, s)
        coll.objects.link(ob)
    return coll


# --------------------------------------------------------------------------
# Geometry Nodes scatter: one reusable group, parameters exposed on the
# modifier so everything stays art-directable in the Blender UI.
# --------------------------------------------------------------------------

def _rv_socket(node, sock_type, name, output=False):
    socks = node.outputs if output else node.inputs
    for s in socks:
        if s.name == name and s.type == sock_type:
            return s
    return None


def gn_scatter_group():
    name = "FL_Scatter"
    if name in bpy.data.node_groups:
        return bpy.data.node_groups[name]
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    iface = ng.interface
    iface.new_socket("Geometry", in_out="INPUT",
                     socket_type="NodeSocketGeometry")
    for sname, stype, default in (
            ("Prototypes", "NodeSocketCollection", None),
            ("Density", "NodeSocketFloat", 0.0002),
            ("Seed", "NodeSocketInt", 0),
            ("Scale Min", "NodeSocketFloat", 0.8),
            ("Scale Max", "NodeSocketFloat", 1.6),
            ("Min Normal Z", "NodeSocketFloat", 0.0),
            ("Min Z", "NodeSocketFloat", -100000.0),
            ("Max Z", "NodeSocketFloat", 100000.0),
            ("Clump Scale", "NodeSocketFloat", 0.003),
            ("Clump Keep", "NodeSocketFloat", 1.0),
            ("Tilt", "NodeSocketFloat", 0.05),
            ("Sink", "NodeSocketFloat", 0.1)):
        s = iface.new_socket(sname, in_out="INPUT", socket_type=stype)
        if default is not None:
            try:
                s.default_value = default
            except Exception:
                pass
    iface.new_socket("Geometry", in_out="OUTPUT",
                     socket_type="NodeSocketGeometry")

    n = ng.nodes
    lk = ng.links.new
    gin = n.new("NodeGroupInput")
    gout = n.new("NodeGroupOutput")

    dist = n.new("GeometryNodeDistributePointsOnFaces")
    lk(gin.outputs["Geometry"], dist.inputs["Mesh"])
    lk(gin.outputs["Density"], dist.inputs["Density"])
    lk(gin.outputs["Seed"], dist.inputs["Seed"])

    pos = n.new("GeometryNodeInputPosition")
    sep = n.new("ShaderNodeSeparateXYZ")
    lk(pos.outputs["Position"], sep.inputs["Vector"])

    z_lo = n.new("FunctionNodeCompare")
    z_lo.operation = "GREATER_THAN"
    lk(sep.outputs["Z"], z_lo.inputs["A"])
    lk(gin.outputs["Min Z"], z_lo.inputs["B"])
    z_hi = n.new("FunctionNodeCompare")
    z_hi.operation = "LESS_THAN"
    lk(sep.outputs["Z"], z_hi.inputs["A"])
    lk(gin.outputs["Max Z"], z_hi.inputs["B"])
    z_ok = n.new("FunctionNodeBooleanMath")
    z_ok.operation = "AND"
    lk(z_lo.outputs["Result"], z_ok.inputs[0])
    lk(z_hi.outputs["Result"], z_ok.inputs[1])

    nsep = n.new("ShaderNodeSeparateXYZ")
    lk(dist.outputs["Normal"], nsep.inputs["Vector"])
    n_ok = n.new("FunctionNodeCompare")
    n_ok.operation = "GREATER_THAN"
    lk(nsep.outputs["Z"], n_ok.inputs["A"])
    lk(gin.outputs["Min Normal Z"], n_ok.inputs["B"])

    clump = n.new("ShaderNodeTexNoise")
    clump.inputs["Detail"].default_value = 3.0
    lk(pos.outputs["Position"], clump.inputs["Vector"])
    cscale = n.new("ShaderNodeMath")            # noise Scale expects ~1/m
    cscale.operation = "MULTIPLY"
    lk(gin.outputs["Clump Scale"], cscale.inputs[0])
    cscale.inputs[1].default_value = 1000.0
    lk(cscale.outputs["Value"], clump.inputs["Scale"])
    thresh = n.new("ShaderNodeMath")
    thresh.operation = "SUBTRACT"
    thresh.inputs[0].default_value = 1.0
    lk(gin.outputs["Clump Keep"], thresh.inputs[1])
    c_ok = n.new("FunctionNodeCompare")
    c_ok.operation = "GREATER_THAN"
    lk(clump.outputs["Fac"], c_ok.inputs["A"])
    lk(thresh.outputs["Value"], c_ok.inputs["B"])

    and1 = n.new("FunctionNodeBooleanMath")
    and1.operation = "AND"
    lk(z_ok.outputs["Boolean"], and1.inputs[0])
    lk(n_ok.outputs["Result"], and1.inputs[1])
    sel = n.new("FunctionNodeBooleanMath")
    sel.operation = "AND"
    lk(and1.outputs["Boolean"], sel.inputs[0])
    lk(c_ok.outputs["Result"], sel.inputs[1])

    cinfo = n.new("GeometryNodeCollectionInfo")
    cinfo.inputs["Separate Children"].default_value = True
    cinfo.inputs["Reset Children"].default_value = False   # keep proto scale
    lk(gin.outputs["Prototypes"], cinfo.inputs["Collection"])

    pick = n.new("FunctionNodeRandomValue")
    pick.data_type = "INT"
    _rv_socket(pick, "INT", "Max").default_value = 100000
    lk(gin.outputs["Seed"], _rv_socket(pick, "INT", "Seed"))

    inst = n.new("GeometryNodeInstanceOnPoints")
    inst.inputs["Pick Instance"].default_value = True
    lk(dist.outputs["Points"], inst.inputs["Points"])
    lk(sel.outputs["Boolean"], inst.inputs["Selection"])
    lk(cinfo.outputs["Instances"], inst.inputs["Instance"])
    lk(_rv_socket(pick, "INT", "Value", True), inst.inputs["Instance Index"])

    def rand_float(lo_sock, hi_sock, seed_off, lo_val=None, hi_val=None):
        r = n.new("FunctionNodeRandomValue")
        r.data_type = "FLOAT"
        if lo_sock is not None:
            lk(lo_sock, _rv_socket(r, "VALUE", "Min"))
        else:
            _rv_socket(r, "VALUE", "Min").default_value = lo_val
        if hi_sock is not None:
            lk(hi_sock, _rv_socket(r, "VALUE", "Max"))
        else:
            _rv_socket(r, "VALUE", "Max").default_value = hi_val
        soff = n.new("ShaderNodeMath")
        soff.operation = "ADD"
        lk(gin.outputs["Seed"], soff.inputs[0])
        soff.inputs[1].default_value = seed_off
        lk(soff.outputs["Value"], _rv_socket(r, "INT", "Seed"))
        return _rv_socket(r, "VALUE", "Value", True)

    scale_v = rand_float(gin.outputs["Scale Min"], gin.outputs["Scale Max"], 11)
    zjit = rand_float(None, None, 23, 0.8, 1.25)
    sz = n.new("ShaderNodeMath")
    sz.operation = "MULTIPLY"
    lk(scale_v, sz.inputs[0])
    lk(zjit, sz.inputs[1])
    scale_vec = n.new("ShaderNodeCombineXYZ")
    lk(scale_v, scale_vec.inputs["X"])
    lk(scale_v, scale_vec.inputs["Y"])
    lk(sz.outputs["Value"], scale_vec.inputs["Z"])

    tilt_x = rand_float(None, None, 31, -1.0, 1.0)
    tilt_y = rand_float(None, None, 41, -1.0, 1.0)
    spin = rand_float(None, None, 53, 0.0, 6.2832)
    tx = n.new("ShaderNodeMath")
    tx.operation = "MULTIPLY"
    lk(tilt_x, tx.inputs[0])
    lk(gin.outputs["Tilt"], tx.inputs[1])
    ty = n.new("ShaderNodeMath")
    ty.operation = "MULTIPLY"
    lk(tilt_y, ty.inputs[0])
    lk(gin.outputs["Tilt"], ty.inputs[1])
    rot_vec = n.new("ShaderNodeCombineXYZ")
    lk(tx.outputs["Value"], rot_vec.inputs["X"])
    lk(ty.outputs["Value"], rot_vec.inputs["Y"])
    lk(spin, rot_vec.inputs["Z"])

    rot = n.new("GeometryNodeRotateInstances")
    lk(inst.outputs["Instances"], rot.inputs["Instances"])
    lk(rot_vec.outputs["Vector"], rot.inputs["Rotation"])
    scl = n.new("GeometryNodeScaleInstances")
    lk(rot.outputs["Instances"], scl.inputs["Instances"])
    lk(scale_vec.outputs["Vector"], scl.inputs["Scale"])

    sink = n.new("ShaderNodeMath")
    sink.operation = "MULTIPLY"
    lk(scale_v, sink.inputs[0])
    lk(gin.outputs["Sink"], sink.inputs[1])
    sink_neg = n.new("ShaderNodeMath")
    sink_neg.operation = "MULTIPLY"
    lk(sink.outputs["Value"], sink_neg.inputs[0])
    sink_neg.inputs[1].default_value = -1.0
    sink_vec = n.new("ShaderNodeCombineXYZ")
    lk(sink_neg.outputs["Value"], sink_vec.inputs["Z"])
    trans = n.new("GeometryNodeTranslateInstances")
    trans.inputs["Local Space"].default_value = False
    lk(scl.outputs["Instances"], trans.inputs["Instances"])
    lk(sink_vec.outputs["Vector"], trans.inputs["Translation"])

    join = n.new("GeometryNodeJoinGeometry")
    lk(trans.outputs["Instances"], join.inputs["Geometry"])
    lk(gin.outputs["Geometry"], join.inputs["Geometry"])
    lk(join.outputs["Geometry"], gout.inputs["Geometry"])
    return ng


def add_scatter(obj, label, protos_coll, **params):
    """Attach an FL_Scatter modifier; params keyed by socket name."""
    ng = gn_scatter_group()
    mod = obj.modifiers.new(label, "NODES")
    mod.node_group = ng
    ident = {}
    for item in ng.interface.items_tree:
        if getattr(item, "in_out", None) == "INPUT":
            ident[item.name] = item.identifier
    mod[ident["Prototypes"]] = protos_coll
    for key, val in params.items():
        if key in ident:
            mod[ident[key]] = val
    return mod


# --------------------------------------------------------------------------
# HDRI environment: flat folder of .hdr/.exr, auto-classified into moods
# by brightness / warmth / saturation. Filenames containing a mood name
# (e.g. "cloudy_dusk_blue_hour.exr") override the guess.
# --------------------------------------------------------------------------

def analyze_hdri(path):
    img = None
    try:
        img = bpy.data.images.load(path)
        img.scale(256, 128)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(128, 256, 4)
        rgb = px[..., :3]
    finally:
        if img is not None:
            bpy.data.images.remove(img)
    lum = (rgb * [0.2126, 0.7152, 0.0722]).sum(-1)
    k = np.ones((5, 5)) / 25.0
    lb = lum.copy()
    for _ in range(2):     # cheap blur so the sun peak is stable
        lb = (np.roll(lb, 1, 0) + np.roll(lb, -1, 0) + np.roll(lb, 1, 1) +
              np.roll(lb, -1, 1) + lb) / 5.0
    r, c = np.unravel_index(np.argmax(lb), lb.shape)
    u = (c + 0.5) / 256.0
    v = (r + 0.5) / 128.0            # pixel row 0 is the image bottom
    sun_elev = (v - 0.5) * math.pi
    sun_azim = (u - 0.75) * 2 * math.pi
    top = rgb[64:]                    # upper hemisphere only
    mean_lum = float(lum.mean())
    warmth = float((top[..., 0] - top[..., 2]).mean() /
                   max(top.mean(), 1e-6))
    sat = float((top.max(-1) - top.min(-1)).mean() / max(top.mean(), 1e-6))
    contrast = float(lb.max() / max(mean_lum, 1e-6))
    return dict(path=path, mean_lum=mean_lum, warmth=warmth, sat=sat,
                contrast=contrast, sun_elev=sun_elev, sun_azim=sun_azim)


# Filename hints. HDRI names rarely encode a mood reliably, so we pick by
# filename only: filter out interiors, then (absent an explicit --hdri-match)
# gently prefer names that hint at the mood. The user steers with HDRI_MATCH.
INTERIOR_HINTS = ("interior", "indoor", "room", "studio", "hall", "office",
                  "garage", "workshop", "locker", "cellar", "basement",
                  "theater", "theatre", "museum", "lobby", "kitchen",
                  "bathroom", "bedroom", "stairwell", "corridor", "shop",
                  "restaurant", "cafe", "church", "hangar", "warehouse",
                  "attic", "gym", "tunnel_interior")
MOOD_HDRI_HINTS = {
    "golden_hour": ("sunset", "sunrise", "golden", "evening", "dusk", "dawn"),
    "misty_dawn": ("misty", "fog", "foggy", "morning", "overcast", "cloudy"),
    "stormy": ("storm", "overcast", "cloudy", "dramatic", "rain"),
    "blue_hour": ("blue", "dusk", "twilight", "evening", "sunset"),
    "moonlit": ("night", "moon", "star", "midnight"),
    "alien_dusk": ("sunset", "dusk", "dramatic", "sky"),
}


def gather_hdris(hdri_dir):
    """Every .hdr/.exr under hdri_dir (recursive), preferring smaller
    (1k/2k) variants of the same name for fast loading."""
    if not hdri_dir or not os.path.isdir(hdri_dir):
        return []
    files = []
    for dp, _, fnames in os.walk(hdri_dir):
        for f in fnames:
            if f.lower().endswith((".hdr", ".exr")):
                files.append(os.path.join(dp, f))
    return files


def _res_key(path):        # sort key: prefer 1k, then 2k, then bigger
    low = os.path.basename(path).lower()
    for i, r in enumerate(("_1k", "_2k", "_4k", "_8k", "_16k")):
        if r in low:
            return i
    return 2


def pick_hdri(hdri_dir, mood, match, rng):
    files = gather_hdris(hdri_dir)
    if not files:
        return None
    if match:
        pool = [f for f in files if match in os.path.basename(f).lower()]
        tag = f"match '{match}'"
    else:
        outdoor = [f for f in files if not any(
            k in os.path.basename(f).lower() for k in INTERIOR_HINTS)]
        hinted = [f for f in outdoor if any(
            k in os.path.basename(f).lower() for k in MOOD_HDRI_HINTS[mood])]
        pool = hinted or outdoor or files
        tag = f"mood '{mood}'" if hinted else "outdoor"
    if not pool:
        return None
    # collapse duplicate names to the lowest-res variant, then choose
    by_stem = {}
    for f in pool:
        stem = re.sub(r"_\d+k", "", os.path.basename(f).lower())
        if stem not in by_stem or _res_key(f) < _res_key(by_stem[stem]):
            by_stem[stem] = f
    choice = rng.choice(sorted(by_stem.values()))
    print(f"[fantasy] hdri pool: {len(by_stem)} unique ({tag}) of "
          f"{len(files)} files -> {os.path.basename(choice)}")
    return choice


def apply_hdri(scene, path, desired_azim, rng):
    """Set the world to an HDRI environment. Returns (sun_elev, sun_azim)
    describing where the HDRI's sun sits after alignment (for cloud gaps).
    No extra sun lamp is created -- the HDRI itself lights the scene."""
    try:
        info = analyze_hdri(path)
    except Exception as exc:
        print(f"[fantasy] hdri analyze failed: {exc}")
        info = dict(sun_elev=math.radians(25), sun_azim=0.0, mean_lum=0.25)
    world = bpy.data.worlds.new("FantasyHDRI")
    world.use_nodes = True
    scene.world = world
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(path)
    mapping = nt.nodes.new("ShaderNodeMapping")
    texco = nt.nodes.new("ShaderNodeTexCoord")
    # rotate so the HDRI's sun lands at the composition's desired azimuth
    mapping.inputs["Rotation"].default_value = (0, 0,
                                                desired_azim - info["sun_azim"])
    nt.links.new(texco.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    # HDRI Haven maps are physically calibrated; gently normalize toward a
    # mid exposure so dim and bright skies land in the same ballpark
    bg.inputs["Strength"].default_value = float(
        np.clip(0.28 / max(info["mean_lum"], 1e-3), 0.35, 2.5))
    scene.view_settings.exposure = 0.0     # HDRI brightness set above, not here
    return max(info["sun_elev"], math.radians(3.0)), desired_azim


# --------------------------------------------------------------------------
# Volumetric clouds (Geometry Nodes Volume Cube) — heavier renders, real
# light scattering. Enabled with --clouds volume.
# --------------------------------------------------------------------------

def build_volume_clouds(mood, rng, coll, cam, sun_azim, sun_elev, top_z,
                        view_azim=None):
    cover, base_em, glow_col, glow_str = mood["deck"]
    base_z = top_z + rng.uniform(1200, 2000)
    thick = rng.uniform(700, 1400)
    gap_azim = sun_azim
    if view_azim is not None:
        d = (sun_azim - view_azim + math.pi) % (2 * math.pi) - math.pi
        gap_azim = view_azim + max(-0.7, min(0.7, d))
    horiz = (base_z - cam.location.z) / max(math.tan(max(sun_elev, 0.05)),
                                            0.05)
    horiz = min(max(horiz, 2500.0), 15000.0)
    gx = cam.location.x + math.cos(gap_azim) * horiz
    gy = cam.location.y + math.sin(gap_azim) * horiz
    gap_r = rng.uniform(2200, 4000)

    name = "FL_Clouds"
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    iface = ng.interface
    for sname, default in (("Coverage", cover), ("Noise Scale", 0.00035),
                           ("Warp", rng.uniform(0.5, 1.5)),
                           ("Density", rng.uniform(0.004, 0.010)),
                           ("Gap Radius", gap_r)):
        s = iface.new_socket(sname, in_out="INPUT",
                             socket_type="NodeSocketFloat")
        s.default_value = default
    iface.new_socket("Geometry", in_out="OUTPUT",
                     socket_type="NodeSocketGeometry")
    n = ng.nodes
    lk = ng.links.new
    gin = n.new("NodeGroupInput")
    gout = n.new("NodeGroupOutput")

    cube = n.new("GeometryNodeVolumeCube")
    # domain sized to what the camera can see; a 32 km cube at fine voxels
    # can exhaust CPU memory (crash) when no GPU is available
    span = 9000.0
    cube.inputs["Min"].default_value = (cam.location.x - span,
                                        cam.location.y - span, base_z)
    cube.inputs["Max"].default_value = (cam.location.x + span,
                                        cam.location.y + span, base_z + thick)
    for axis, res in (("Resolution X", 128), ("Resolution Y", 128),
                      ("Resolution Z", 16)):
        cube.inputs[axis].default_value = res

    pos = n.new("GeometryNodeInputPosition")
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Detail"].default_value = 6.0
    nz.inputs["Roughness"].default_value = 0.55
    lk(pos.outputs["Position"], nz.inputs["Vector"])
    nscale = n.new("ShaderNodeMath")
    nscale.operation = "MULTIPLY"
    lk(gin.outputs["Noise Scale"], nscale.inputs[0])
    nscale.inputs[1].default_value = 1000.0
    lk(nscale.outputs["Value"], nz.inputs["Scale"])
    lk(gin.outputs["Warp"], nz.inputs["Distortion"])

    thr = n.new("ShaderNodeMath")           # threshold from coverage
    thr.operation = "MULTIPLY_ADD"
    lk(gin.outputs["Coverage"], thr.inputs[0])
    thr.inputs[1].default_value = -0.34
    thr.inputs[2].default_value = 0.66
    shape = n.new("ShaderNodeMapRange")
    lk(nz.outputs["Fac"], shape.inputs["Value"])
    lk(thr.outputs["Value"], shape.inputs["From Min"])
    thr2 = n.new("ShaderNodeMath")
    thr2.operation = "ADD"
    lk(thr.outputs["Value"], thr2.inputs[0])
    thr2.inputs[1].default_value = 0.30
    lk(thr2.outputs["Value"], shape.inputs["From Max"])

    sep = n.new("ShaderNodeSeparateXYZ")
    lk(pos.outputs["Position"], sep.inputs["Vector"])
    up = n.new("ShaderNodeMapRange")
    lk(sep.outputs["Z"], up.inputs["Value"])
    up.inputs["From Min"].default_value = base_z
    up.inputs["From Max"].default_value = base_z + thick * 0.3
    down = n.new("ShaderNodeMapRange")
    lk(sep.outputs["Z"], down.inputs["Value"])
    down.inputs["From Min"].default_value = base_z + thick * 0.55
    down.inputs["From Max"].default_value = base_z + thick
    down.inputs["To Min"].default_value = 1.0
    down.inputs["To Max"].default_value = 0.0
    prof = n.new("ShaderNodeMath")
    prof.operation = "MULTIPLY"
    lk(up.outputs["Result"], prof.inputs[0])
    lk(down.outputs["Result"], prof.inputs[1])

    gdist = n.new("ShaderNodeVectorMath")
    gdist.operation = "DISTANCE"
    lk(pos.outputs["Position"], gdist.inputs[0])
    gdist.inputs[1].default_value = (gx, gy, base_z + thick / 2)
    gmul = n.new("ShaderNodeMath")
    gmul.operation = "MULTIPLY"
    lk(gin.outputs["Gap Radius"], gmul.inputs[0])
    gmul.inputs[1].default_value = 0.35
    gap = n.new("ShaderNodeMapRange")
    lk(gdist.outputs["Value"], gap.inputs["Value"])
    lk(gmul.outputs["Value"], gap.inputs["From Min"])
    lk(gin.outputs["Gap Radius"], gap.inputs["From Max"])

    m1 = n.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    lk(shape.outputs["Result"], m1.inputs[0])
    lk(prof.outputs["Value"], m1.inputs[1])
    m2 = n.new("ShaderNodeMath")
    m2.operation = "MULTIPLY"
    lk(m1.outputs["Value"], m2.inputs[0])
    lk(gap.outputs["Result"], m2.inputs[1])
    m3 = n.new("ShaderNodeMath")
    m3.operation = "MULTIPLY"
    lk(m2.outputs["Value"], m3.inputs[0])
    lk(gin.outputs["Density"], m3.inputs[1])
    lk(m3.outputs["Value"], cube.inputs["Density"])

    mat = bpy.data.materials.new("VolumeCloudMat")
    mat.use_nodes = True
    mnt = mat.node_tree
    mnt.nodes.clear()
    mout = mnt.nodes.new("ShaderNodeOutputMaterial")
    pv = mnt.nodes.new("ShaderNodeVolumePrincipled")
    pv.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    try:
        pv.inputs["Anisotropy"].default_value = 0.4
    except Exception:
        pass
    mnt.links.new(pv.outputs["Volume"], mout.inputs["Volume"])
    setmat = n.new("GeometryNodeSetMaterial")
    setmat.inputs["Material"].default_value = mat
    lk(cube.outputs["Volume"], setmat.inputs["Geometry"])
    lk(setmat.outputs["Geometry"], gout.inputs["Geometry"])

    mesh = bpy.data.meshes.new("VolumeClouds")
    host = bpy.data.objects.new("VolumeClouds", mesh)
    link_obj(host, coll)
    mod = host.modifiers.new("Clouds", "NODES")
    mod.node_group = ng
    return host


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
        accent=(0.30, 0.14, 0.05), deck=(0.55, 0.5, (1.0, 0.55, 0.25), 4.0),
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
        accent=(0.30, 0.26, 0.14), deck=(0.68, 0.7, (0.95, 0.9, 0.8), 2.0),
    ),
    "stormy": dict(
        sun_elev=(9, 22), sun_energy=(2.4, 4.2), sun_color=(0.95, 0.94, 0.9),
        sun_dir="side", sky_strength=(0.08, 0.16),
        air=2.0, dust=(4.0, 8.0), ozone=1.0,
        fog_density=(1.5e-4, 4e-4), fog_color=(0.62, 0.66, 0.72),
        fog_top_add=(150, 350), exposure=(0.5, 1.0),
        grass=(0.12, 0.16, 0.05), grass2=(0.16, 0.19, 0.08),
        cloud_color=(0.30, 0.32, 0.36), cloud_strength=(0.5, 1.0), cloud_cover=0.9,
        magic_color=(0.6, 0.9, 1.0), scifi_bias=0.05, glare=0.5,
        accent=(0.16, 0.13, 0.04), deck=(0.92, 0.45, (0.95, 0.9, 0.8), 3.5),
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
        accent=(0.14, 0.09, 0.13), deck=(0.65, 0.3, (1.0, 0.45, 0.2), 3.0),
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
        accent=(0.08, 0.10, 0.09), deck=(0.45, 0.12, (0.6, 0.7, 0.95), 1.2),
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
        accent=(0.35, 0.10, 0.22), deck=(0.7, 0.35, (1.0, 0.35, 0.45), 3.5),
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
                gpus = [d for d in prefs.devices if d.type != "CPU"]
                if gpus:
                    for d in prefs.devices:      # GPU(s) on, CPU off (OptiX
                        d.use = (d.type != "CPU")  # + CPU can be slower)
                    cycles.device = "GPU"
                    print(f"[fantasy] render device: {dev_type} -> "
                          f"{', '.join(d.name for d in gpus)}")
                    break
            except Exception:
                continue
        else:
            print("[fantasy] render device: CPU (no GPU backend found)")
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

    # horizontal strata bands darken the cliff faces
    smap = nt.nodes.new("ShaderNodeMapping")
    smap.inputs["Scale"].default_value = (0.02, 0.02, 0.12)
    nt.links.new(geo.outputs["Position"], smap.inputs["Vector"])
    strata_noise = nt.nodes.new("ShaderNodeTexNoise")
    strata_noise.inputs["Scale"].default_value = 1.0
    strata_noise.inputs["Detail"].default_value = 6.0
    nt.links.new(smap.outputs["Vector"], strata_noise.inputs["Vector"])
    strata_band = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(strata_noise.outputs["Fac"], strata_band.inputs["Value"])
    strata_band.inputs["From Min"].default_value = 0.47
    strata_band.inputs["From Max"].default_value = 0.62
    strata_band.inputs["To Max"].default_value = 0.28
    steep2 = nt.nodes.new("ShaderNodeMath")   # strata only on true cliffs
    steep2.operation = "POWER"
    nt.links.new(slope_ramp.outputs["Result"], steep2.inputs[0])
    steep2.inputs[1].default_value = 3.0
    strata_f = nt.nodes.new("ShaderNodeMath")
    strata_f.operation = "MULTIPLY"
    nt.links.new(strata_band.outputs["Result"], strata_f.inputs[0])
    nt.links.new(steep2.outputs["Value"], strata_f.inputs[1])
    strata_mix = nt.nodes.new("ShaderNodeMix")
    strata_mix.data_type = "RGBA"
    nt.links.new(strata_f.outputs["Value"], strata_mix.inputs["Factor"])
    nt.links.new(ground.outputs[2], strata_mix.inputs[6])
    strata_mix.inputs[7].default_value = (rock_b[0] * 0.7, rock_b[1] * 0.7,
                                          rock_b[2] * 0.7, 1.0)

    # scree / bare-earth band where grass gives way to rock
    scree_lo = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(slope_mix.outputs["Value"], scree_lo.inputs["Value"])
    scree_lo.inputs["From Min"].default_value = 0.22
    scree_lo.inputs["From Max"].default_value = 0.42
    scree_hi = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(slope_mix.outputs["Value"], scree_hi.inputs["Value"])
    scree_hi.inputs["From Min"].default_value = 0.85
    scree_hi.inputs["From Max"].default_value = 0.55
    scree_f = nt.nodes.new("ShaderNodeMath")
    scree_f.operation = "MULTIPLY"
    nt.links.new(scree_lo.outputs["Result"], scree_f.inputs[0])
    nt.links.new(scree_hi.outputs["Result"], scree_f.inputs[1])
    scree_f2 = nt.nodes.new("ShaderNodeMath")
    scree_f2.operation = "MULTIPLY"
    nt.links.new(scree_f.outputs["Value"], scree_f2.inputs[0])
    nt.links.new(breakup.outputs["Fac"], scree_f2.inputs[1])
    scree_mix = nt.nodes.new("ShaderNodeMix")
    scree_mix.data_type = "RGBA"
    nt.links.new(scree_f2.outputs["Value"], scree_mix.inputs["Factor"])
    nt.links.new(strata_mix.outputs[2], scree_mix.inputs[6])
    scree_mix.inputs[7].default_value = (0.16, 0.135, 0.105, 1.0)

    # mood accent ground cover (heather / rust / straw) in broad drifts
    acc_noise = nt.nodes.new("ShaderNodeTexNoise")
    acc_noise.inputs["Scale"].default_value = 0.0025
    acc_noise.inputs["Detail"].default_value = 5.0
    nt.links.new(geo.outputs["Position"], acc_noise.inputs["Vector"])
    acc_band = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(acc_noise.outputs["Fac"], acc_band.inputs["Value"])
    acc_band.inputs["From Min"].default_value = 0.56
    acc_band.inputs["From Max"].default_value = 0.72
    acc_band.inputs["To Max"].default_value = 0.85
    acc_flat = nt.nodes.new("ShaderNodeMath")   # accents only on open ground
    acc_flat.operation = "SUBTRACT"
    acc_flat.inputs[0].default_value = 1.0
    nt.links.new(slope_mix.outputs["Value"], acc_flat.inputs[1])
    acc_f = nt.nodes.new("ShaderNodeMath")
    acc_f.operation = "MULTIPLY"
    nt.links.new(acc_band.outputs["Result"], acc_f.inputs[0])
    nt.links.new(acc_flat.outputs["Value"], acc_f.inputs[1])
    acc_mix = nt.nodes.new("ShaderNodeMix")
    acc_mix.data_type = "RGBA"
    nt.links.new(acc_f.outputs["Value"], acc_mix.inputs["Factor"])
    nt.links.new(scree_mix.outputs[2], acc_mix.inputs[6])
    acc_mix.inputs[7].default_value = (*mood["accent"], 1.0)

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
    nt.links.new(acc_mix.outputs[2], snow_mix.inputs[6])
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
    haze_rng.inputs["From Min"].default_value = 2600.0   # keep near/mid ground
    haze_rng.inputs["From Max"].default_value = 16000.0  # crisp; only the far
    haze_rng.inputs["To Max"].default_value = 0.5        # shell truly hazes
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
    wisps.inputs["Scale"].default_value = rng.uniform(2.2, 4.5)
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
    m2.inputs[1].default_value = density * 0.7
    nt.links.new(m2.outputs["Value"], scat.inputs["Density"])
    nt.links.new(scat.outputs["Volume"], out.inputs["Volume"])

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    fog = mesh_from_bmesh("FogVolume", bm, coll, mat)
    depth = fog_top - (ground_min - 60)
    fog.scale = (12000, 12000, depth)
    fog.location = (0, 0, ground_min - 60 + depth / 2)
    fog.display_type = "WIRE"
    try:
        fog.visible_shadow = False
    except Exception:
        pass
    return fog


def build_cloud_deck(mood, rng, coll, cam, sun_azim, sun_elev, top_z,
                     view_azim=None):
    """A vast shadow-casting cloud layer with a ragged gap near the sun.

    The gap keeps the scene from going flat under heavy cover: the sun
    pours through it, spilling dappled light pools on the terrain and god
    rays through the fog, with the sky glowing around the opening.
    """
    cover, base_em, glow_col, glow_str = mood["deck"]
    deck_z = top_z + rng.uniform(1600, 2800)
    horiz = (deck_z - cam.location.z) / max(math.tan(max(sun_elev, 0.05)), 0.05)
    horiz = min(max(horiz, 2500.0), 18000.0)
    gap_azim = sun_azim
    if view_azim is not None:      # keep the bright gap near the frame
        d = (sun_azim - view_azim + math.pi) % (2 * math.pi) - math.pi
        gap_azim = view_azim + max(-0.7, min(0.7, d))
    gx = cam.location.x + math.cos(gap_azim) * horiz
    gy = cam.location.y + math.sin(gap_azim) * horiz
    gap_r = rng.uniform(2000, 3800)

    mat = bpy.data.materials.new("CloudDeck")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    emit = nt.nodes.new("ShaderNodeEmission")

    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dist = nt.nodes.new("ShaderNodeVectorMath")
    dist.operation = "DISTANCE"
    nt.links.new(geo.outputs["Position"], dist.inputs[0])
    dist.inputs[1].default_value = (gx, gy, deck_z)

    # coverage noise (features ~1.5-3 km)
    tex = nt.nodes.new("ShaderNodeTexCoord")
    cmap = nt.nodes.new("ShaderNodeMapping")
    sc = rng.uniform(16, 30)
    cmap.inputs["Scale"].default_value = (sc, sc * rng.uniform(0.6, 1.0), sc)
    cmap.inputs["Rotation"].default_value = (0, 0, rng.uniform(0, 3.14))
    # Generated coords: 0..1 across the plane regardless of its size
    nt.links.new(tex.outputs["Generated"], cmap.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1.0
    noise.inputs["Detail"].default_value = 9.0
    noise.inputs["Roughness"].default_value = 0.55
    nt.links.new(cmap.outputs["Vector"], noise.inputs["Vector"])
    alpha0 = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(noise.outputs["Fac"], alpha0.inputs["Value"])
    t0 = 0.66 - 0.34 * cover
    alpha0.inputs["From Min"].default_value = t0
    alpha0.inputs["From Max"].default_value = t0 + 0.18
    alpha0.inputs["To Max"].default_value = 0.85   # sun always leaks a bit

    # carve the sun gap
    gap = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(dist.outputs["Value"], gap.inputs["Value"])
    gap.inputs["From Min"].default_value = gap_r * 0.35
    gap.inputs["From Max"].default_value = gap_r
    alpha = nt.nodes.new("ShaderNodeMath")
    alpha.operation = "MULTIPLY"
    nt.links.new(alpha0.outputs["Result"], alpha.inputs[0])
    nt.links.new(gap.outputs["Result"], alpha.inputs[1])
    nt.links.new(alpha.outputs["Value"], mix.inputs["Fac"])

    # glow: warm bright cloud color near the gap, dark bases far from it
    glow = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(dist.outputs["Value"], glow.inputs["Value"])
    glow.inputs["From Min"].default_value = gap_r * 0.4
    glow.inputs["From Max"].default_value = gap_r * 3.2
    glow.inputs["To Min"].default_value = 1.0
    glow.inputs["To Max"].default_value = 0.0
    cc = mood["cloud_color"]
    col_mix = nt.nodes.new("ShaderNodeMix")
    col_mix.data_type = "RGBA"
    nt.links.new(glow.outputs["Result"], col_mix.inputs["Factor"])
    col_mix.inputs[6].default_value = (cc[0] * 0.55, cc[1] * 0.55,
                                       cc[2] * 0.6, 1.0)
    col_mix.inputs[7].default_value = (*glow_col, 1.0)
    nt.links.new(col_mix.outputs[2], emit.inputs["Color"])
    stren = nt.nodes.new("ShaderNodeMapRange")
    nt.links.new(glow.outputs["Result"], stren.inputs["Value"])
    stren.inputs["To Min"].default_value = base_em
    stren.inputs["To Max"].default_value = base_em + glow_str
    nt.links.new(stren.outputs["Result"], emit.inputs["Strength"])

    nt.links.new(trans.outputs["BSDF"], mix.inputs[1])
    nt.links.new(emit.outputs["Emission"], mix.inputs[2])
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])

    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=30000)
    deck = mesh_from_bmesh("CloudDeck", bm, coll, mat)
    deck.location = (0, 0, deck_z)
    return deck


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

    count = rng.randint(2, 5)   # a few near cards; the deck does the rest
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


def jagged_wall(name, length, height, thick, coll, mat, rng):
    """A ruined wall: subdivided box whose top edge is broken down."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=6,
                              use_grid_fill=True)
    off = rng.uniform(0, 50)
    for v in bm.verts:
        if v.co.z > 0.3:
            n = abs(mnoise.noise(Vector((v.co.x * 2.6 + off,
                                         v.co.y * 2.6, v.co.z))))
            v.co.z -= n * rng.uniform(0.45, 0.95)
            v.co.x += mnoise.noise(Vector((v.co.z * 3.0, off, v.co.x))) * 0.03
    bmesh.ops.scale(bm, vec=(length, thick, height), verts=bm.verts)
    return mesh_from_bmesh(name, bm, coll, mat, smooth=False)


def build_ruins(site, rng, coll):
    x, y, z = site
    stone = weathered_material("RuinStone", (0.21, 0.195, 0.165),
                               roughness=0.92)

    # broken rectangular shell of a keep or chapel
    w = rng.uniform(9, 17)
    d = rng.uniform(6, 12)
    rot = rng.uniform(0, math.pi)
    cr, sr = math.cos(rot), math.sin(rot)
    sides = [((w / 2, 0), d, math.pi / 2), ((-w / 2, 0), d, math.pi / 2),
             ((0, d / 2), w, 0.0), ((0, -d / 2), w, 0.0)]
    heights = [rng.uniform(4.5, 8.5), rng.uniform(2.5, 6),
               rng.uniform(0.8, 2.0), rng.uniform(1.5, 5)]
    rng.shuffle(heights)
    for i, ((lx, ly), length, lrot) in enumerate(sides):
        wx = x + lx * cr - ly * sr
        wy = y + lx * sr + ly * cr
        wall = jagged_wall(f"RuinWall.{i}", length, heights[i], 1.0,
                           coll, stone, rng)
        wall.location = (wx, wy, z + heights[i] * 0.4 - 0.5)
        wall.rotation_euler = (0, 0, rot + lrot)

    ring_r = max(w, d) * rng.uniform(0.9, 1.4)
    for i in range(rng.randint(2, 5)):
        a = rng.uniform(0, 2 * math.pi)
        cx = x + math.cos(a) * ring_r
        cy = y + math.sin(a) * ring_r
        if rng.random() < 0.3:       # fallen column
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

def procedural_tree_protos(mood, rng, coll):
    """Two stylized single-mesh conifers (canopy + trunk material slots)."""
    protos = []
    for k in range(2):
        conifer_mat = simple_material(
            f"Conifer.{k}", tuple(min(1.0, c * rng.uniform(0.75, 1.25))
                                  for c in (0.022, 0.05, 0.025)), 0.95)
        trunk_mat = simple_material(f"Trunk.{k}", (0.09, 0.06, 0.04), 0.9)
        bm = bmesh.new()
        z0 = 0.0
        tiers = ((1.6, 2.6), (1.25, 2.4), (0.85, 2.2)) if k == 0 else \
                ((1.9, 2.2), (1.4, 2.0), (1.0, 1.8), (0.6, 1.6))
        for radius, height in tiers:
            try:
                geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=7,
                                             radius1=radius, radius2=0.03,
                                             depth=height)
            except TypeError:
                geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=7,
                                             diameter1=radius * 2,
                                             diameter2=0.06, depth=height)
            bmesh.ops.translate(bm, vec=(0, 0, z0 + height / 2 + 1.0),
                                verts=geom["verts"])
            z0 += height * 0.62
        bm.faces.ensure_lookup_table()
        canopy_faces = len(bm.faces)
        try:
            bmesh.ops.create_cone(bm, cap_ends=True, segments=6,
                                  radius1=0.18, radius2=0.14, depth=2.0)
        except TypeError:
            bmesh.ops.create_cone(bm, cap_ends=True, segments=6,
                                  diameter1=0.36, diameter2=0.28, depth=2.0)
        bm.faces.ensure_lookup_table()
        for i in range(canopy_faces, len(bm.faces)):
            bm.faces[i].material_index = 1
        bmesh.ops.translate(
            bm, vec=(0, 0, 1.0),
            verts=list({v for f in bm.faces[canopy_faces:]
                        for v in f.verts}))
        proto = mesh_from_bmesh(f"TreeProto.{k}", bm, coll, conifer_mat,
                                smooth=False)
        proto.data.materials.append(trunk_mat)
        protos.append(proto)
    return protos


def boulder_prototypes(rng, coll, mat, n_protos=3):
    """Noise-displaced rock meshes, shared by all scattered instances."""
    protos = []
    for i in range(n_protos):
        bm = bmesh.new()
        try:
            bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        except TypeError:
            bmesh.ops.create_icosphere(bm, subdivisions=3, diameter=2.0)
        off = Vector((rng.uniform(0, 90), rng.uniform(0, 90),
                      rng.uniform(0, 90)))
        freq = rng.uniform(1.0, 1.9)
        for v in bm.verts:
            d = mnoise.noise(v.co * freq + off)
            d += 0.5 * mnoise.noise(v.co * freq * 2.7 + off)
            v.co *= 1.0 + 0.33 * d
        obj = mesh_from_bmesh(f"BoulderProto.{i}", bm, coll, mat, smooth=True)
        protos.append(obj)
    return protos


def build_scatter_protos(kind, assets, mood, rng):
    """Prototype collection for a scatter system: user assets when the
    library has them, procedural stand-ins otherwise. The collection is
    intentionally NOT linked to the scene, so originals never render."""
    if assets and assets.get(kind):
        target = {"rock": 2.4, "tree": 9.0}[kind]
        return build_proto_collection(f"FL_{kind}_protos", assets[kind],
                                      target), True
    coll = bpy.data.collections.new(f"FL_{kind}_protos")
    if kind == "rock":
        rock = weathered_material("Boulder", (0.135, 0.125, 0.115), 0.95)
        boulder_prototypes(rng, coll, rock)
    else:
        procedural_tree_protos(mood, rng, coll)
    return coll, False


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
                                      nrng, relief=opts["relief"])
    terrain = Terrain(H, size)
    # snowline: genuinely high ground only, never rolling lowlands
    relief = float(H.max() - H.min())
    snow_z = max(float(np.percentile(H, rng.uniform(90, 97))),
                 float(H.min() + 0.62 * relief))
    if relief < 330:          # low country: no snow at all
        snow_z = float(H.max() + 500)
    mat = terrain_material(mood, rng, water_z, snow_z)
    terrain_obj = build_terrain_mesh("Terrain", H, size, c_terrain, mat)

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
    # ---- nature: Geometry Nodes scatter (art-directable in the UI) --------
    script_dir = os.path.dirname(os.path.abspath(__file__)) \
        if "__file__" in globals() else os.getcwd()
    assets = load_asset_library(opts["asset_lib"] or
                                os.path.join(script_dir, "assets"),
                                rng=rng, prefer_lod=opts["lod"],
                                tex_res=opts["tex_res"])
    rock_coll, rock_real = build_scatter_protos("rock", assets, mood, rng)
    tree_coll, tree_real = build_scatter_protos("tree", assets, mood, rng)
    dens_mul = 0.4 if opts["fast"] else 1.0
    floor_z = (water_z + 3.0) if water_z is not None else float(H.min())
    treeline = float(np.percentile(H, 80))
    add_scatter(terrain_obj, "FL Rocks", rock_coll,
                Density=rng.uniform(1.2e-4, 3e-4) * dens_mul,
                Seed=seed % 10000, **{
                    "Scale Min": 0.5, "Scale Max": 2.6,
                    "Min Normal Z": 0.0, "Min Z": floor_z,
                    "Clump Scale": 0.004, "Clump Keep": rng.uniform(0.4, 0.7),
                    "Tilt": 0.25, "Sink": rng.uniform(0.2, 0.4)})
    add_scatter(terrain_obj, "FL Trees", tree_coll,
                Density=rng.uniform(3e-4, 8e-4) * dens_mul,
                Seed=(seed + 7) % 10000, **{
                    "Scale Min": 0.7, "Scale Max": 1.8,
                    "Min Normal Z": 0.8, "Min Z": floor_z + 1.0,
                    "Max Z": treeline,
                    "Clump Scale": 0.002, "Clump Keep": rng.uniform(0.25, 0.5),
                    "Tilt": 0.03, "Sink": 0.05})

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
    va = math.atan2(focal.y - cam.location.y, focal.x - cam.location.x)

    # HDRI environment (explicit file, or picked from the folder by name).
    # When an HDRI is used it lights the scene by itself -- no sun lamp, and
    # no procedural clouds (the HDRI already carries a sky).
    hdri_path = opts["hdri"]
    if not hdri_path:
        hdri_path = pick_hdri(opts["hdri_dir"] or os.path.join(script_dir,
                              "hdri"), mood_name, opts["hdri_match"], rng)
    hdri_used = bool(hdri_path)
    if hdri_used:
        bpy.data.objects.remove(sun, do_unlink=True)
        sun_elev, azim = apply_hdri(scene, hdri_path, azim, rng)
    else:
        sun_elev = sun["elev"]
        aim_sun(sun, sky, sun_elev, azim)

    cloud_mode = "deck" if opts["fast"] else opts["clouds"]
    if not hdri_used:
        if cloud_mode == "volume":
            build_volume_clouds(mood, rng, c_atmos, cam, azim, sun_elev,
                                float(H.max()), view_azim=va)
        elif cloud_mode == "deck":
            build_cloud_deck(mood, rng, c_atmos, cam, azim, sun_elev,
                             float(H.max()), view_azim=va)

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
          f"scatter: rocks={'assets' if rock_real else 'procedural'} "
          f"trees={'assets' if tree_real else 'procedural'} | "
          f"sky={'hdri' if hdri_used else cloud_mode} | "
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
