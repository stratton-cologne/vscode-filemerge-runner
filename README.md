Merge ausgewählter Dateien/Ordner direkt in **VS Code** – komplett **ohne Python-Abhängigkeit**. Die Extension sammelt Inhalte, filtert auf Wunsch Kommentare, berücksichtigt Ausschlüsse/Globs und schreibt alles in **eine kombinierte Ausgabedatei**. Optional wird ein **Verzeichnisbaum** mit ausgegeben.

## Features

-   ✅ Auswahl mehrerer **Dateien & Ordner** im Workspace
-   ✅ **Ausschlüsse** als konkrete Pfade _und_ per **Glob-Pattern** (`*`, `**`, `?`)
-   ✅ Optionaler **Kommentar-Filter** (`#`, `//` pro Zeile)
-   ✅ Optional **Directory Tree** vor dem Merge
-   ✅ Ergebnis als **UTF‑8‑Textdatei** an frei wählbarem Ziel
-   ✅ Fortschritt & Logs im **Output-Panel › FileMerge**

## Voraussetzungen

-   VS Code **1.90+** (getestet auf macOS/Windows/Linux)
-   Node.js 18+ empfohlen (wird indirekt von VS Code bereitgestellt)

## Installation

**A) Aus VSIX installieren**

1. Paket bauen:

```bash
npm install
npm run build
npx vsce package
```

VS Code → Extensions → … → Install from VSIX… → erzeugte .vsix wählen.

**B) Schnell testen (Entwicklungsmodus)**

Ordner in VS Code öffnen → F5 (Run & Debug → Run Extension)

Es startet ein zweites Fenster (Extension Development Host).

## Nutzung

1. Cmd/Ctrl + Shift + P → FileMerge: Merge Dateien/Ordner…
2. Pfade auswählen → (optional) Ausschlüsse setzen:

    - konkrete Pfade (zweiter Dialog)
    - Glob-Patterns (Eingabefeld, kommagetrennt)

3. Optionen wählen: Kommentare filtern? / Directory Tree erzeugen?
4. Ziel-Datei festlegen (Standard: merged_files.txt).
5. Öffne die Ergebnisdatei oder prüfe das Output-Panel › FileMerge.

## Einstellungen

Diese Settings sind optional und können pro Workspace gesetzt werden:

-   `filemerge.workingDirectory (string):` Arbeitsverzeichnis für die Ausgabe (leer = Workspace-Root).
-   `filemerge.defaultOutputName (string):` Standard-Dateiname, z. B. merged_files.txt.

**Hinweis**: Die Extension arbeitet rein lesend. Schreib-/Löschvorgänge betreffen nur die **Ausgabedatei**.

## Glob-Patterns – Beispiele

-   `*.log` → alle .log-Dateien ausschließen
-   `**/*.min.*` → alle minifizierten Artefakte überall
-   `node_modules/**` → das komplette node_modules-Verzeichnis
-   `dist/**, build/**` → Build-Artefakte

## Tastenkürzel (optional)

Code → Preferences → Keyboard Shortcuts und folgendes JSON hinzufügen:

```bash
{
"key": "cmd+shift+m",
"command": "filemerge.mergeInVSCode",
"when": "editorTextFocus"
}
```

(Unter Windows z. B. `ctrl+shift+m.`)

## Troubleshooting

-   **vsce meldet**: activationEvents fehlt → In `package.json` muss stehen:
    `"activationEvents": ["onCommand:filemerge.mergeInVSCode"]`
-   **Warnungen**: repository / LICENSE fehlt → `repository`, `bugs`, `homepage` und `license`: `"MIT"` ergänzen und **LICENSE**-Datei anlegen.
-   **TypeScript**: "replaceAll" nicht vorhanden → Entweder `lib` auf `ES2021` anheben oder Regex-Variante ohne `replaceAll` (bereits in diesem Projekt umgesetzt).
-   **Dateizugriff verweigert** → Prüfe Dateirechte. Die Extension liest Dateien im Benutzerkontext.

## Entwicklung

-   Build: `npm run build`, Watch: `npm run watch`
-   Start im Dev-Host: F5
-   Projektstruktur: `src/extension.ts → VS Code Command + UI-Dialoge`
    (keine externen Runtimes; Merge-Logik in TS implementiert)

## Lizenz & Hinweise

-   Lizenz: MIT (siehe LICENSE)
-   © 2025 Stratton Cologne — Werte: Vertrauen • Innovation • Stabilität • Exzellenz

```bash
bash
npm install
npm run build

# .vsix erstellen

npx vsce package

# in VS Code installieren: Extensions-Ansicht → 3-Punkte → Install from VSIX…
```

## Changelog

-   **1.0.0** Erste Node.js-Implementierung (Pfad-/Pattern-Auswahl, Optionen, Output-Panel, Öffnen der Ergebnisdatei)
