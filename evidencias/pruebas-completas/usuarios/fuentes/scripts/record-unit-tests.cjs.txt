// Ejecución local reproducible; no carga .env ni servicios externos.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const moduleName = process.argv[2];
const tests = process.argv.slice(3);
if (!/^[a-z-]+$/.test(moduleName || '') || tests.length === 0) throw new Error('Indicar módulo y archivos de prueba');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'evidencias', 'pruebas-completas', moduleName);
fs.mkdirSync(dir, { recursive: true });
const args = ['node_modules/jest/bin/jest.js', '--runInBand', '--watch=false', '--verbose', '--runTestsByPath', ...tests, '--json', `--outputFile=${path.relative(root, path.join(dir, 'resultado.json')).replaceAll('\\', '/')}`];
const meta = {
  inicio: new Date().toISOString(), zona: 'America/La_Paz',
  comando: 'node ' + args.join(' '), archivos: tests,
  versiones: { node: process.version, npm: cp.execSync('npm --version', {encoding:'utf8'}).trim(), ...Object.fromEntries(['jest','jest-expo','typescript','expo'].map(n=>[n, require(n+'/package.json').version])) },
  commit: cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  cambiosLocales: cp.execFileSync('git',['status','--short'],{encoding:'utf8'}),
};
const result = cp.spawnSync(process.execPath,args,{ cwd:root, encoding:'utf8' });
fs.writeFileSync(path.join(dir,'salida.log'), result.stdout + result.stderr);
meta.fin = new Date().toISOString(); meta.codigoSalida = result.status;
fs.writeFileSync(path.join(dir,'ejecucion.json'),JSON.stringify(meta,null,2));
for (const file of tests) {
 const dest=path.join(dir,'fuentes',file+'.txt'); fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);
}
process.stdout.write(result.stdout + result.stderr);
process.exit(result.status ?? 1);
