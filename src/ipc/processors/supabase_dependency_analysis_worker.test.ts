import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { processSupabaseDependencyAnalysis } from "../../../workers/supabase_dependency_analysis/supabase_dependency_analysis_worker";
import * as nodeModuleResolution from "../../../shared/node_module_resolution";

describe("Supabase dependency analysis worker", () => {
  it("distinguishes a missing TypeScript install from an incompatible compiler API", async () => {
    const appPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "dyad-supabase-no-ts-analysis-"),
    );
    const spy = vi
      .spyOn(nodeModuleResolution, "resolveTypeScriptPackageJsonPathSync")
      .mockImplementation((p) => {
        if (p === appPath) {
          const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
          err.code = "ENOENT";
          throw err;
        }
        return nodeModuleResolution.resolveTypeScriptPackageJsonPathSync(p);
      });
    try {
      await expect(
        processSupabaseDependencyAnalysis({
          appPath,
          changedSharedModulePaths: [],
        }),
      ).resolves.toEqual({
        success: true,
        data: { kind: "all", reason: "typescript_not_installed" },
      });
    } finally {
      spy.mockRestore();
      await fs.rm(appPath, { recursive: true, force: true });
    }
  });

  it("uses bundled TypeScript 6 when an installed TS7 lacks the legacy API", async () => {
    const appPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "dyad-supabase-ts7-analysis-"),
    );
    try {
      const write = async (relativePath: string, contents: string) => {
        const filePath = path.join(appPath, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, contents);
      };
      await write(
        "node_modules/typescript/package.json",
        JSON.stringify({
          name: "typescript",
          version: "7.0.2",
          exports: { ".": "./lib/version.cjs" },
        }),
      );
      await write(
        "supabase/functions/_shared/util.ts",
        "export const value = 1;",
      );
      await write(
        "supabase/functions/alpha/index.ts",
        "import '../_shared/util.ts';",
      );
      await write(
        "supabase/functions/beta/index.ts",
        "export const value = 2;",
      );

      await expect(
        processSupabaseDependencyAnalysis({
          appPath,
          changedSharedModulePaths: ["supabase/functions/_shared/util.ts"],
        }),
      ).resolves.toEqual({
        success: true,
        data: { kind: "partial", functionNames: ["alpha"] },
      });
    } finally {
      await fs.rm(appPath, { recursive: true, force: true });
    }
  });

  it("uses bundled TypeScript 6 when a local compiler has null enum exports", async () => {
    const appPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "dyad-supabase-null-enum-analysis-"),
    );
    try {
      const write = async (relativePath: string, contents: string) => {
        const filePath = path.join(appPath, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, contents);
      };
      await write(
        "node_modules/typescript/package.json",
        JSON.stringify({
          name: "typescript",
          version: "7.0.2",
          main: "./lib/typescript.js",
        }),
      );
      await write(
        "node_modules/typescript/lib/typescript.js",
        `module.exports = {
          createSourceFile() {},
          forEachChild() {},
          isCallExpression() {},
          isExportDeclaration() {},
          isExternalModuleReference() {},
          isIdentifier() {},
          isImportDeclaration() {},
          isImportEqualsDeclaration() {},
          isStringLiteralLike() {},
          ScriptKind: null,
          ScriptTarget: {},
          SyntaxKind: {},
        };`,
      );
      await write(
        "supabase/functions/_shared/util.ts",
        "export const value = 1;",
      );
      await write(
        "supabase/functions/alpha/index.ts",
        "import '../_shared/util.ts';",
      );

      await expect(
        processSupabaseDependencyAnalysis({
          appPath,
          changedSharedModulePaths: ["supabase/functions/_shared/util.ts"],
        }),
      ).resolves.toEqual({
        success: true,
        data: { kind: "partial", functionNames: ["alpha"] },
      });
    } finally {
      await fs.rm(appPath, { recursive: true, force: true });
    }
  });
});
