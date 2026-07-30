r"""
run_in_blender.py  --  beginner-friendly launcher for fantasy_landscape.py
===========================================================================

You do NOT need to know any scripting to use this.

HOW TO USE
----------
1. Put this file in the SAME folder as  fantasy_landscape.py
2. In Blender, click the "Scripting" tab along the very top.
3. In the text area, click "Open" and choose THIS file (run_in_blender.py).
4. Edit the SETTINGS block below (your F:\ paths, seed, mood).
5. Click the "Run Script" button (the ▶ play icon in the header).
6. The viewport jumps to the camera and shows a lit preview.
   Press  F12  for a full-quality image.  Change SEED and Run again for a
   brand-new world.

Tip: open  Window > Toggle System Console  first (Windows). The messages
that start with "[fantasy]" tell you what it imported and the render recipe.
"""

import os
import sys
import runpy

# ==========================================================================
# SETTINGS  --  edit these, then click "Run Script"
# ==========================================================================

# Your libraries. The  r  before each quote is REQUIRED for Windows paths.
# FIRST TIME: leave BOTH as ""  to test the built-in look (fast, proves it
# works). Then put your paths back in and Run again to use your own assets.
ASSET_LIB = r"F:\Quixel-FAB Library"     # rocks & trees (Megascans/FAB)
HDRI_DIR  = r"F:\HDRI\HDRI Haven"        # your .hdr / .exr skies

SEED   = 7        # any number = a repeatable world;  None = random each run
MOOD   = ""       # "" = random, or one of:
                  # golden_hour  misty_dawn  stormy  blue_hour  moonlit  alien_dusk

# Landscape shape:
ARCHETYPE = ""    # "" = random, or:  alpine  highlands  coast  canyon
RELIEF    = 1.0   # how mountainous:  0.3 = gentle plains, 1.0 = default,
                  #                   1.6 = dramatic peaks

# Sky:
CLOUDS = "deck"   # only used when NO HDRI is loaded:
                  # "deck" = fast cloud layer, "volume" = volumetric, "off"
HDRI_MATCH = ""   # pick skies whose FILENAME contains this text, e.g.
                  # "sunset", "field", "kloppenheim". "" = auto (outdoor).
                  # Interiors are filtered out automatically.

# Quality. Start here; raise GRID / lower it for speed.
GRID    = 384     # terrain detail:  256 = fast,  384 = balanced,  512 = detailed
LOD     = 2       # Megascans detail level to load:  0 = highest, 3 = lightest
TEXRES  = "2K"    # texture resolution to prefer:  "1K"  "2K"  "4K"
RES     = "1280x720"   # render size. "960x540" previews fast; "1920x1080" for finals
SAMPLES = 96      # render quality/noise: 48 = fast preview, 128 = clean final

RENDER_TO = r""   # e.g.  r"F:\renders\land.png"  to auto-save a render;
                  # leave "" to just build the scene and press F12 yourself.

# Auto-update: pull the newest fantasy_landscape.py from GitHub each run, so
# you never have to download it by hand. Set False to freeze your local copy.
AUTO_UPDATE = True

# Only needed if Blender can't auto-find this file's folder (rare) --
# paste the folder that holds these two .py files, e.g.  r"C:\FantasyLandscape"
SCRIPT_FOLDER = r""

# ==========================================================================
# You don't need to edit anything below here.
# ==========================================================================

def _find_folder():
    if SCRIPT_FOLDER:
        return SCRIPT_FOLDER
    try:
        import bpy
        p = bpy.context.space_data.text.filepath
        if p:
            return os.path.dirname(bpy.path.abspath(p))
    except Exception:
        pass
    if "__file__" in globals():
        return os.path.dirname(os.path.abspath(__file__))
    return os.getcwd()


folder = _find_folder()
main_script = os.path.join(folder, "fantasy_landscape.py")

# Auto-update: fetch the latest generator from the GitHub branch. This can
# even bootstrap the main script if only this launcher is present.
_BRANCH = "claude/fantasy-landscape-generator-bn8yog"
_RAW_URL = ("https://raw.githubusercontent.com/jasonlayel/jltest/" + _BRANCH +
            "/fantasy-landscape/fantasy_landscape.py")
if AUTO_UPDATE:
    try:
        import urllib.request
        print("[launcher] checking GitHub for the latest script...")
        with urllib.request.urlopen(_RAW_URL, timeout=25) as resp:
            data = resp.read()
        if b"def main" in data and b"fantasy" in data.lower():
            with open(main_script, "wb") as fh:
                fh.write(data)
            print("[launcher] updated fantasy_landscape.py (%d KB)"
                  % (len(data) // 1024))
        else:
            print("[launcher] update response looked wrong; keeping local copy")
    except Exception as exc:
        print("[launcher] update skipped (%s); using local copy" % exc)

if not os.path.exists(main_script):
    raise SystemExit(
        "Could not find fantasy_landscape.py next to this launcher.\n"
        "Put both files in the same folder, or set SCRIPT_FOLDER at the top,\n"
        "or set AUTO_UPDATE = True to download it automatically.")

argv = ["fantasy_landscape.py", "--", "--grid", str(GRID),
        "--clouds", CLOUDS, "--lod", str(LOD), "--tex-res", TEXRES,
        "--res", RES, "--samples", str(SAMPLES), "--relief", str(RELIEF)]
if ASSET_LIB:
    argv += ["--asset-lib", ASSET_LIB]
if HDRI_DIR:
    argv += ["--hdri-dir", HDRI_DIR]
if HDRI_MATCH:
    argv += ["--hdri-match", HDRI_MATCH]
if SEED is not None:
    argv += ["--seed", str(SEED)]
if MOOD:
    argv += ["--mood", MOOD]
if ARCHETYPE:
    argv += ["--archetype", ARCHETYPE]
if RENDER_TO:
    argv += ["--render", RENDER_TO]
sys.argv = argv

print("[launcher] building scene, please wait...")
runpy.run_path(main_script, run_name="__main__")

# Snap every 3D viewport to the camera and switch to rendered preview, so
# you immediately see the composed, lit shot without hunting for the camera.
try:
    import bpy
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            for space in area.spaces:
                if space.type == "VIEW_3D":
                    space.shading.type = "RENDERED"
                    space.region_3d.view_perspective = "CAMERA"
    print("[launcher] done -- press F12 to render a full image.")
except Exception:
    pass
