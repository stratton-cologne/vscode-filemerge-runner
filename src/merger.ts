import * as fsp from "fs/promises";
import * as path from "path";
import { Minimatch } from "minimatch";

type MergeOptions = {
    includes: string[];
    excludePaths: string[];
    excludePatterns: string[];
    filterComments: boolean;
    createTree: boolean;
    onlyIncluded: boolean;
    outputPath: string;
    cwd: string;
};

export async function runMerge(
    opts: MergeOptions
): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
        const absIncludes = opts.includes.map((p) =>
            path.isAbsolute(p) ? p : path.join(opts.cwd, p)
        );
        const absExclude = new Set(
            opts.excludePaths.map((p) => path.resolve(opts.cwd, p))
        );
        const matchers = opts.excludePatterns.map(
            (p) => new Minimatch(p, { dot: true, nocase: true })
        );

        const files: string[] = [];
        for (const inc of absIncludes) {
            const stat = await fsp.stat(inc);
            if (stat.isDirectory()) {
                await walk(inc, files, absExclude, matchers);
            } else if (stat.isFile()) {
                if (!shouldExclude(inc, absExclude, matchers)) files.push(inc);
            }
        }

        files.sort();

        let output = "";
        if (opts.createTree) {
            output += makeTree(files, opts.cwd, opts.onlyIncluded);
            output += "\n\n";
        }

        for (const file of files) {
            const rel = path.relative(opts.cwd, file) || path.basename(file);
            output += `\n===== ${rel} =====\n`;
            const content = await fsp.readFile(file, "utf8");
            output += opts.filterComments ? stripComments(content) : content;
            output += "\n";
        }

        await fsp.mkdir(path.dirname(opts.outputPath), { recursive: true });
        await fsp.writeFile(opts.outputPath, output, "utf8");

        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
    }
}

function shouldExclude(
    filePath: string,
    excludeAbs: Set<string>,
    matchers: Minimatch[]
) {
    if (excludeAbs.has(filePath)) return true;
    const base = path.basename(filePath);
    return matchers.some((m) => m.match(base) || m.match(filePath));
}

async function walk(
    dir: string,
    out: string[],
    excludeAbs: Set<string>,
    matchers: Minimatch[]
) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
        const p = path.join(dir, ent.name);
        if (shouldExclude(p, excludeAbs, matchers)) continue;
        if (ent.isDirectory()) {
            await walk(p, out, excludeAbs, matchers);
        } else if (ent.isFile()) {
            out.push(p);
        }
    }
}

function stripComments(src: string): string {
    // 1) Blockkommentare /* ... */
    let s = src.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\*\//gs, "");
    // 2) Zeilenkommentare //
    s = s.replace(/(^|\s)\/\/.*$/gm, "$1");
    // 3) Zeilen die mit # beginnen
    s = s.replace(/^\s*#.*$/gm, "");
    return s;
}

function makeTree(
    files: string[],
    cwd: string,
    _onlyIncluded: boolean
): string {
    const root: any = {};
    for (const f of files) {
        const parts = (path.isAbsolute(f) ? path.relative(cwd, f) : f)
            .split(path.sep)
            .filter(Boolean);
        let node = root;
        for (const part of parts) {
            node[part] = node[part] || {};
            node = node[part];
        }
    }
    const lines: string[] = ["# TREE"];
    const render = (node: any, prefix: string) => {
        const keys = Object.keys(node).sort();
        keys.forEach((k, i) => {
            const child = node[k];
            const isLast = i === keys.length - 1;
            const branch = prefix + (isLast ? "└─ " : "├─ ");
            lines.push(branch + k);
            const nextPrefix = prefix + (isLast ? "   " : "│  ");
            render(child, nextPrefix);
        });
    };
    render(root, "");
    return lines.join("\n");
}
