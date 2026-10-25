/** Opt-in dedicated-provider smoke test. Never lists or touches objects other than fresh owned UUIDs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import dotenv from 'dotenv';
const enabled=process.env.ORBIT_REAL_BLOB_TEST==='1';
test('real private Blob: direct 6MiB and verified 25MiB retain exact hashes and deny anonymous access',{skip:!enabled,timeout:300000},async()=>{
 const env=dotenv.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../../../.cloud-provider.env')));
 const token=env.BLOB_READ_WRITE_TOKEN;if(!token)throw new Error('Dedicated private Blob credential unavailable.');
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'orbit-real-blob-'));
 let stage='compile',owned=[],storage,sdk;
 try{
  await build({entryPoints:[path.resolve(import.meta.dirname,'../../server/cloud/blob-storage.ts')],outfile:path.join(temporary,'storage.cjs'),bundle:true,platform:'node',target:'node24',format:'cjs',external:['@vercel/blob'],logLevel:'silent'});
  const {VercelBlobStorage}=createRequire(import.meta.url)(path.join(temporary,'storage.cjs'));
  sdk=await import('@vercel/blob');
  const client=await import('@vercel/blob/client');
  let lastUrl;
  const boundary={...sdk,get:async(...args)=>{const result=await sdk.get(...args);console.log('Provider read metadata: '+JSON.stringify({status:result?.statusCode,size:result?.blob?.size,mimeType:result?.blob?.contentType,exactPath:result?.blob?.pathname===args[0]}));return result;},put:async(...args)=>{const result=await sdk.put(...args);lastUrl=result.url;return result;}};
  storage=new VercelBlobStorage({token,sdk:boundary,tempRoot:temporary});
  for(const [size,direct] of [[6*1024*1024,true],[25*1024*1024,false]]){
   const key=randomUUID();owned.push(key);
   const bytes=Buffer.alloc(size,97),expected=createHash('sha256').update(bytes).digest('hex');
   stage=direct?'direct-token-and-upload-6MiB':'verified-upload-25MiB';let metadata;
   if(direct){
    const intent={id:randomUUID(),key,name:'provider-check.txt',byteSize:size,mimeType:'text/plain',expiresAt:Date.now()+600000};
    const pathname=storage.pathname(key),clientPayload=JSON.stringify({uploadId:intent.id});
    const issued=await client.handleUpload({token,request:{headers:{}},body:{type:'blob.generate-client-token',payload:{pathname,clientPayload,multipart:false}},onBeforeGenerateToken:async(p,payload)=>storage.directTokenOptions(intent,p,payload)});
    assert.equal(issued.type,'blob.generate-client-token');
    const uploaded=await client.put(pathname,bytes,{access:'private',token:issued.clientToken,contentType:'text/plain',abortSignal:AbortSignal.timeout(90000)});
    lastUrl=uploaded.url;
    metadata=await storage.verifyUploaded(intent);
   }else metadata=await storage.putVerified(key,bytes,{name:'provider-check.txt',mimeType:'text/plain',byteSize:size});
   assert.equal(metadata.sha256,expected);assert.equal(metadata.byteSize,size);
   stage='anonymous-private-denial';
   const anonymous=await fetch(lastUrl,{signal:AbortSignal.timeout(30000)});await anonymous.body?.cancel();
   assert.ok([401,403,404].includes(anonymous.status),'Private content must reject anonymous reads.');
   stage='verified-download';const read=await storage.readVerified({...metadata,name:'provider-check.txt'});
   try{const result=fs.readFileSync(read.filePath);assert.equal(result.length,size);assert.equal(createHash('sha256').update(result).digest('hex'),expected);}finally{await read.dispose();}
   stage='owned-object-delete';await storage.remove(key);
   const absent=await sdk.get(storage.pathname(key),{token,access:'private',useCache:false});assert.equal(absent,null);
   owned=owned.filter(value=>value!==key);
   console.log(`Verified ${size/1048576}MiB ${direct?'direct client-token':'server adapter'} upload, private anonymous denial, SHA-256 readback, and owned-key deletion.`);
  }
 }catch(error){throw new Error('Real private Blob smoke failed at '+stage+' ('+String(error?.code||error?.name||'provider-error').replace(/[^A-Za-z0-9_]/g,'').slice(0,60)+').');}
 finally{
  for(const key of owned)try{await storage?.remove(key);}catch{console.error('Owned test key cleanup needs retry: '+key);}
  fs.rmSync(temporary,{recursive:true,force:true});
 }
});
