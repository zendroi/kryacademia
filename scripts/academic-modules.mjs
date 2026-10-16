import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText).toString('base64')}`;
const demo = moduleUrl(await readFile(new URL('../app/admin/adminData.ts', import.meta.url), 'utf8'));
const academyUrl = moduleUrl((await readFile(new URL('../lib/academy.ts', import.meta.url), 'utf8')).replace("'@/app/admin/adminData'", JSON.stringify(demo)));
export const academy = await import(academyUrl);
export const core = await import(moduleUrl((await readFile(new URL('../lib/academic-core.ts', import.meta.url), 'utf8')).replace("import 'server-only';", '').replace("'./academy'", JSON.stringify(academyUrl))));
export const workflow = await import(moduleUrl((await readFile(new URL('../lib/teaching-workflow.ts', import.meta.url), 'utf8')).replace("import 'server-only';", '')));
