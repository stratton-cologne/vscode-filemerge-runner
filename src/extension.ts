import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/** Pfad nach POSIX normalisieren (für konsistente Globs) */
function toPosix(p: string) {
    return p.replaceAll("\\", "/");
}

/** Glob in RegExp konvertieren: unterstützt **, *, ?  */
function globToRegExp(glob: string): RegExp {
    const posix = glob.replaceAll("\\", "/").trim();
    const specials = /[.+^${}()|[\]\\]/g;
    let re = "";
    let i = 0;
    while (i < posix.length) {
        const c = posix[i];
        if (c === "*") {
            if (posix[i + 1] === "*") {
                // **  ->  .*
                re += ".*";
                i += 2;
            } else {
                // *   ->  [^/]*  (kein Slash)
                re += "[^/]*";
                i += 1;
            }
        } else if (c === "?") {
            re += "[^/]";
            i += 1;
        } else {
            re += c.replace(specials, "\\$&");
            i += 1;
        }
    }
    return new RegExp("^" + re + "$", "i");
}

/** Exclude-Checker bauen (konkrete Pfade + Globs) */
function buildExcluder(
    workDir: string,
    excludePaths: string[],
    excludePatterns: string[]
) {
    const absDirs = new Set(excludePaths.map((p) => path.resolve(workDir, p)));
    const regexes = excludePatterns
        .map((p) => p.trim())
        .filter(Boolean)
        .map(globToRegExp);

    return (fullPath: string) => {
        const abs = path.resolve(fullPath);
        // 1) Konkrete Pfade/Direktories (Prefix-Match)
        for (const dir of absDirs) {
            if (abs === dir || abs.startsWith(dir + path.sep)) return true;
        }
        // 2) Globs wirken auf rel. Pfad ab workDir und Basename
        const rel = toPosix(path.relative(workDir, abs));
        const base = toPosix(path.basename(abs));
        return regexes.some((r) => r.test(rel) || r.test(base));
    };
}

function readFileContent(filePath: string, filterComments: boolean): string {
    let content = fs.readFileSync(filePath, "utf8");
    if (filterComments) {
        // einfache Filter: Zeilen die mit # oder // beginnen
        content = content
            .split("\n")
            .filter((line) => {
                const t = line.trim();
                return !(t.startsWith("#") || t.startsWith("//"));
            })
            .join("\n");
    }
    return content;
}

function walkDirectory(
    dir: string,
    isExcluded: (p: string) => boolean
): string[] {
    let results: string[] = [];
    if (isExcluded(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of list) {
        const fullPath = path.join(dir, ent.name);
        if (isExcluded(fullPath)) continue;
        if (ent.isDirectory()) {
            results = results.concat(walkDirectory(fullPath, isExcluded));
        } else if (ent.isFile()) {
            results.push(fullPath);
        }
    }
    return results;
}

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand(
        "filemerge.mergeInVSCode",
        async () => {
            const workspaceFolder =
                vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const cwd = workspaceFolder || process.cwd();

            const out = vscode.window.createOutputChannel("FileMerge");
            out.show(true);

            try {
                // 1) Eingabepfade wählen
                const includeUris = await vscode.window.showOpenDialog({
                    title: "Dateien/Ordner für Merge wählen",
                    canSelectFiles: true,
                    canSelectFolders: true,
                    canSelectMany: true,
                    defaultUri: workspaceFolder
                        ? vscode.Uri.file(workspaceFolder)
                        : undefined,
                    openLabel: "Hinzufügen",
                });
                if (!includeUris || includeUris.length === 0) return;

                // 2) Ausschlüsse (konkrete Pfade)
                const excludeUris = await vscode.window.showOpenDialog({
                    title: "Konkrete Dateien/Ordner ausschließen (optional)",
                    canSelectFiles: true,
                    canSelectFolders: true,
                    canSelectMany: true,
                    defaultUri: workspaceFolder
                        ? vscode.Uri.file(workspaceFolder)
                        : undefined,
                    openLabel: "Ausschließen",
                });

                // 3) Ausschluss-Patterns (Globs)
                const excludePatternInput = await vscode.window.showInputBox({
                    title: "Ausschluss-Patterns (optional)",
                    prompt: "Kommagetrennt, z.B. *.log, **/*.min.* , node_modules/**",
                    placeHolder: "*.log, **/*.min.* , node_modules/**",
                });
                const excludePatterns: string[] = (excludePatternInput || "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);

                // 4) Optionen
                const filterPick = await vscode.window.showQuickPick(
                    ["Ja", "Nein"],
                    {
                        title: "Kommentare herausfiltern (#, //)?",
                        canPickMany: false,
                    }
                );
                if (!filterPick) return;
                const filterComments = filterPick === "Ja";

                const treePick = await vscode.window.showQuickPick(
                    ["Nein", "Ja"],
                    {
                        title: "Verzeichnisbaum zusätzlich schreiben?",
                        canPickMany: false,
                    }
                );
                if (!treePick) return;
                const createTree = treePick === "Ja";

                // 5) Ausgabedatei
                const defaultFile = vscode.Uri.file(
                    path.join(cwd, "merged_files.txt")
                );
                const outUri = await vscode.window.showSaveDialog({
                    title: "Ausgabedatei wählen",
                    defaultUri: defaultFile,
                    filters: { Textdatei: ["txt"] },
                });
                if (!outUri) return;

                // 6) Excluder bauen
                const excludePaths = (excludeUris || []).map((u) => u.fsPath);
                const isExcluded = buildExcluder(
                    cwd,
                    excludePaths,
                    excludePatterns
                );

                // 7) Dateien sammeln
                let files: string[] = [];
                for (const uri of includeUris) {
                    const stat = fs.statSync(uri.fsPath);
                    if (stat.isDirectory()) {
                        files = files.concat(
                            walkDirectory(uri.fsPath, isExcluded)
                        );
                    } else if (stat.isFile() && !isExcluded(uri.fsPath)) {
                        files.push(uri.fsPath);
                    }
                }
                files.sort();

                // 8) Inhalte mergen (+ optional Tree)
                let merged = "";
                if (createTree) {
                    merged += "# DIRECTORY TREE:\n";
                    for (const f of files) {
                        merged += toPosix(path.relative(cwd, f)) + "\n";
                    }
                    merged += "\n";
                }
                for (const file of files) {
                    const rel = path.relative(cwd, file) || path.basename(file);
                    merged += `\n===== ${rel} =====\n`;
                    try {
                        merged += readFileContent(file, filterComments) + "\n";
                    } catch (err: any) {
                        merged += `\n[LESFEHLER] ${file}: ${
                            err?.message || err
                        }\n`;
                        out.appendLine(
                            `Fehler beim Lesen von ${file}: ${
                                err?.message || err
                            }`
                        );
                    }
                }

                fs.writeFileSync(outUri.fsPath, merged, "utf8");
                vscode.window
                    .showInformationMessage(
                        "FileMerge abgeschlossen.",
                        "Öffnen"
                    )
                    .then((action) => {
                        if (action)
                            vscode.workspace
                                .openTextDocument(outUri)
                                .then((doc) =>
                                    vscode.window.showTextDocument(doc)
                                );
                    });
            } catch (e: any) {
                vscode.window.showErrorMessage(`Fehler: ${e?.message || e}`);
            }
        }
    );

    context.subscriptions.push(disposable);
}

export function deactivate() {}
