import esbuild from "esbuild";
import archiver from "archiver";
import {
  rmSync,
  mkdirSync,
  cpSync,
  readFileSync,
  writeFileSync,
  createWriteStream
} from "node:fs";
import { join } from "node:path";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (a && typeof a === "object" && b && typeof b === "object") {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = k in out ? deepMerge(out[k], v) : v;
    }
    return out;
  }
  return b ?? a;
}

async function bundle(outDir) {
  await esbuild.build({
    entryPoints: {
      popup: "src/popup/popup.js",
      content: "src/content/content.js"
    },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome114", "firefox109"],
    sourcemap: false,
    minify: false,
    outdir: outDir,
    entryNames: "[name]"
  });
}

function copyStatic(outDir) {
  cpSync("src/popup.html", join(outDir, "popup.html"));
  cpSync("src/icons", join(outDir, "icons"), { recursive: true });
}

function writeManifest(outDir, target, version) {
  const base = readJson("src/manifest.base.json");
  const targetJson = readJson(
    target === "firefox" ? "src/manifest.firefox.json" : "src/manifest.chrome.json"
  );

  const merged = deepMerge(base, targetJson);

  // ✅ Single source of truth: package.json version
  merged.version = version;

  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(merged, null, 2));
}

async function zipDir(srcDir, zipPath, { ignore = [] } = {}) {
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);

    archive.on("warning", (err) => {
      // Keep build running on non-fatal warnings (e.g., missing optional files)
      console.warn("zip warning:", err);
    });
    archive.on("error", reject);

    archive.pipe(output);

    // Use glob + ignore instead of directory() to avoid self-including zips
    archive.glob("**/*", {
      cwd: srcDir,
      dot: true,
      ignore: ["**/.DS_Store", ...ignore]
    });

    archive.finalize();
  });
}

async function buildTarget(target, version) {
  const outDir = join("dist", target);
  mkdirSync(outDir, { recursive: true });

  await bundle(outDir);
  copyStatic(outDir);
  writeManifest(outDir, target, version);
}

async function main() {
  rmSync("dist", { recursive: true, force: true });
  mkdirSync("dist", { recursive: true });

  // ✅ Single source of truth
  const pkg = readJson("package.json");
  const version = pkg.version;
  const artifactBaseName = pkg.name || "sv-meldeportal-jlohn-autofill";

  await buildTarget("chrome", version);
  await buildTarget("firefox", version);

  await zipDir("dist/chrome", `dist/${artifactBaseName}-${version}-chrome-edge.zip`);
  await zipDir("dist/firefox", `dist/${artifactBaseName}-${version}-firefox.zip`);

  // Full project zip (exclude dist + huge folders)
  await zipDir(".", `dist/${artifactBaseName}-${version}-full-project.zip`, {
    ignore: ["dist/**", "node_modules/**", ".git/**"]
  });

  console.log(`✅ Build done (${artifactBaseName}@${version}).`);
}

main().catch((e) => {
  console.error("❌ Build failed:", e);
  process.exit(1);
});

