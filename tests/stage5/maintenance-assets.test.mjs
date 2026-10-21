import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SqliteStore,emptyState} from '../../server/db/store.ts';
import {validateAssetContents} from '../../server/db/assets.ts';

const root=fileURLToPath(new URL('../../',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(t){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-stage5-backup-')),data=path.join(temporary,'data');
  fs.mkdirSync(path.join(data,'files','blobs'),{recursive:true});fs.mkdirSync(path.join(data,'files','staging'));
  const contents=[Buffer.from('historical version'),Buffer.from('current version')];
  const versions=contents.map((bytes,index)=>({id:'version_'+randomUUID(),fileId:'file',workspaceId:'ws',version:index+1,name:'proof.txt',managed:true,storageFormat:'orbit-assets-v1',storageKey:randomUUID(),byteSize:bytes.length,mimeType:'text/plain',sha256:digest(bytes)}));
  versions.forEach((version,index)=>fs.writeFileSync(path.join(data,'files','blobs',version.storageKey),contents[index]));
  fs.writeFileSync(path.join(data,'files','staging',randomUUID()+'.part'),'interrupted upload');
  const state=emptyState();state.workspaces=[{id:'ws',members:[]}];state.files=[{...versions[1],id:'file',currentVersionId:versions[1].id},{id:'legacy',workspaceId:'ws',name:'Lost old upload',url:'blob:expired'}];delete state.files[0].fileId;state.fileVersions=versions;
  const store=new SqliteStore(path.join(data,'orbit.sqlite'));store.saveState(state);store.close();
  t.after(()=>{assert.equal(path.dirname(path.resolve(temporary)),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(temporary).startsWith('orbit-stage5-backup-'));fs.rmSync(temporary,{recursive:true,force:true});});
  const cli=(command,args=[],target=data)=>spawnSync(process.execPath,[path.join(root,'dist','server','database.cjs'),command,...args],{cwd:root,env:{...process.env,PROJECT_ROOT:root,DATA_DIR:target,LEGACY_DB_IMPORT:'',HOST:'127.0.0.1',PORT:'3000',APP_ORIGIN:'',ALLOW_NETWORK_ACCESS:''},windowsHide:true,encoding:'utf8',timeout:20000});
  return{temporary,data,contents,versions,state,cli};
}
test('asset integrity checks current and historical bytes while preserving unavailable legacy metadata',t=>{
  const f=fixture(t);
  assert.deepEqual(validateAssetContents(f.data),{managedFiles:1,managedVersions:2,legacyMetadataFiles:1,checkedBytes:f.contents[0].length+f.contents[1].length});
  const historical=path.join(f.data,'files','blobs',f.versions[0].storageKey);
  fs.writeFileSync(historical,Buffer.alloc(f.contents[0].length,65));
  assert.throws(()=>validateAssetContents(f.data),/checksum/);
  fs.writeFileSync(historical,f.contents[0]);fs.unlinkSync(historical);
  assert.throws(()=>validateAssetContents(f.data),/ENOENT/);
});
test('backup and restore retain every file version and exclude interrupted staging bytes',t=>{
  const f=fixture(t),backup=path.join(f.temporary,'backup'),restored=path.join(f.temporary,'restored');
  let result=f.cli('backup',['--output',backup]);assert.equal(result.status,0,result.stdout+result.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
  assert.equal(manifest.files.some(file=>file.path.startsWith('files/staging/')),false);
  for(let index=0;index<f.versions.length;index++)assert.deepEqual(fs.readFileSync(path.join(backup,'data','files','blobs',f.versions[index].storageKey)),f.contents[index]);
  result=f.cli('restore',['--source',backup],restored);assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(validateAssetContents(restored).managedVersions,2);
  const store=new SqliteStore(path.join(restored,'orbit.sqlite'));try{assert.deepEqual(store.loadState().files,f.state.files);assert.deepEqual(store.loadState().fileVersions,f.versions);}finally{store.close();}
});
test('restore rejects altered content even when its outer backup checksum was updated',t=>{
  const f=fixture(t),backup=path.join(f.temporary,'backup'),target=path.join(f.temporary,'existing');
  let result=f.cli('backup',['--output',backup]);assert.equal(result.status,0,result.stdout+result.stderr);
  const filename=path.join(backup,'data','files','blobs',f.versions[0].storageKey);fs.writeFileSync(filename,Buffer.alloc(f.contents[0].length,66));
  const manifestFile=path.join(backup,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  manifest.files.find(file=>file.path==='files/blobs/'+f.versions[0].storageKey).sha256=digest(fs.readFileSync(filename));fs.writeFileSync(manifestFile,JSON.stringify(manifest));
  fs.mkdirSync(target);const store=new SqliteStore(path.join(target,'orbit.sqlite'));const sentinel=emptyState();sentinel.workspaces=[{id:'preserve-existing',members:[]}];store.saveState(sentinel);store.close();
  const before=digest(fs.readFileSync(path.join(target,'orbit.sqlite')));
  result=f.cli('restore',['--source',backup],target);assert.notEqual(result.status,0);assert.match(result.stderr,/checksum|size/);
  assert.equal(digest(fs.readFileSync(path.join(target,'orbit.sqlite'))),before);
  assert.equal(fs.existsSync(target+'.restore-pending'),false);
});
test('interrupted completed restore recovers when preserved old assets were already missing',t=>{
  const f=fixture(t),backup=path.join(f.temporary,'backup');
  let result=f.cli('backup',['--output',backup]);assert.equal(result.status,0,result.stdout+result.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json'),'utf8'));
  fs.unlinkSync(path.join(f.data,'files','blobs',f.versions[0].storageKey));
  const inventory=(directory,prefix='')=>fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{const relative=prefix?prefix+'/'+entry.name:entry.name,actual=path.join(directory,entry.name);return entry.isDirectory()?inventory(actual,relative):[{path:relative,bytes:fs.statSync(actual).size,sha256:digest(fs.readFileSync(actual))}];}).sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const previousFiles=inventory(f.data),previous=f.data+'.previous-'+randomUUID(),staging=f.data+'.restore-'+randomUUID();
  fs.renameSync(f.data,previous);fs.cpSync(path.join(backup,'data'),f.data,{recursive:true});
  fs.writeFileSync(f.data+'.restore-pending',JSON.stringify({current:f.data,staging,previous,source:backup,createdAt:new Date().toISOString(),previousFiles,targetFiles:manifest.files}));
  result=f.cli('recover-restore');assert.equal(result.status,0,result.stdout+result.stderr);
  assert.equal(fs.existsSync(f.data+'.restore-pending'),false);assert.equal(validateAssetContents(f.data).managedVersions,2);
  assert.equal(fs.existsSync(previous),true);assert.equal(fs.existsSync(path.join(previous,'files','blobs',f.versions[0].storageKey)),false);
});
