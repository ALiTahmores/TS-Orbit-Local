import path from 'node:path';
import { DomainError } from '../domain/repository.ts';
import { boolean, dto, text } from '../domain/models.ts';

const types: Record<string, string[]> = {
  '.pdf':['application/pdf'], '.doc':['application/msword'], '.docx':['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls':['application/vnd.ms-excel'], '.xlsx':['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt':['application/vnd.ms-powerpoint'], '.pptx':['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.odt':['application/vnd.oasis.opendocument.text'], '.ods':['application/vnd.oasis.opendocument.spreadsheet'], '.odp':['application/vnd.oasis.opendocument.presentation'],
  '.txt':['text/plain'], '.md':['text/markdown','text/plain'], '.csv':['text/csv','text/plain','application/vnd.ms-excel'], '.json':['application/json','text/plain'],
  '.png':['image/png'], '.jpg':['image/jpeg'], '.jpeg':['image/jpeg'], '.gif':['image/gif'], '.webp':['image/webp'], '.ico':['image/x-icon','image/vnd.microsoft.icon'], '.bmp':['image/bmp'],
  '.zip':['application/zip','application/x-zip-compressed'], '.7z':['application/x-7z-compressed'], '.rar':['application/vnd.rar','application/x-rar-compressed'], '.gz':['application/gzip','application/x-gzip'],
  '.mp3':['audio/mpeg'], '.wav':['audio/wav','audio/x-wav'], '.ogg':['audio/ogg'], '.m4a':['audio/mp4','audio/x-m4a'],
  '.mp4':['video/mp4'], '.mov':['video/quicktime'], '.webm':['video/webm','audio/webm'], '.fig':['application/octet-stream'],
};
export function fileName(value: any): string {
  const name = text(value, 'نام فایل', true, 240);
  if (/[\x00-\x1f\x7f\\/:*?"<>|]/.test(name) || name === '.' || name === '..' || name.endsWith('.') || name.endsWith(' ') || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) throw new DomainError(422,'INVALID_FILE_NAME','نام فایل امن و معتبر لازم است.');
  if (!types[path.extname(name).toLowerCase()]) throw new DomainError(415,'FILE_TYPE_NOT_ALLOWED','این نوع فایل پشتیبانی نمی‌شود.');
  return name;
}
export function uploadMetadata(req: any, publicUpload = false): any {
  const header = req.headers['x-file-metadata'];
  if (typeof header !== 'string' || header.length > 12000) throw new DomainError(422,'FILE_METADATA_REQUIRED','اطلاعات فایل در سربرگ درخواست لازم است.');
  let input: any;
  try { input = JSON.parse(decodeURIComponent(header)); } catch { throw new DomainError(422,'INVALID_FILE_METADATA','اطلاعات فایل معتبر نیست.'); }
  dto(input, publicUpload ? ['name','category','tag','note'] : ['name','projectId','taskId','conversationId','category','tag','clientVisible','approved','note']);
  const result: any = {name: fileName(input.name)};
  for (const field of ['category','tag','note']) if (input[field] !== undefined) result[field] = text(input[field],field,false,field==='note'?2000:100);
  for (const field of ['projectId','taskId','conversationId']) if (input[field] !== undefined) result[field] = text(input[field],field,true,200);
  for (const field of ['clientVisible','approved']) if (input[field] !== undefined) result[field] = boolean(input[field]);
  return result;
}
export function mimeType(name: string, header: any): string {
  const accepted = types[path.extname(name).toLowerCase()];
  const mime = typeof header === 'string' ? header.split(';')[0].trim().toLowerCase() : '';
  if (!accepted || !mime || (mime !== 'application/octet-stream' && !accepted.includes(mime))) throw new DomainError(415,'FILE_TYPE_MISMATCH','نوع محتوای فایل با پسوند آن همخوانی ندارد.');
  return mime === 'audio/webm' ? mime : accepted[0];
}
export function textual(name: string): boolean { return ['.txt','.md','.csv','.json'].includes(path.extname(name).toLowerCase()); }
export function verifySignature(name: string, prefix: Buffer, size: number): void {
  const extension = path.extname(name).toLowerCase();
  const ascii = prefix.toString('utf8').replace(/^\uFEFF/,'').trimStart();
  if (/^(?:<!doctype\s+html|<html\b|<script\b|<svg\b|<\?php)/i.test(ascii) || prefix.subarray(0,2).toString()==='MZ' || prefix.subarray(0,4).equals(Buffer.from([0x7f,0x45,0x4c,0x46]))) throw new DomainError(415,'EXECUTABLE_CONTENT_DENIED','فایل اجرایی یا محتوای فعال پذیرفته نمی‌شود.');
  const hex = prefix.toString('hex');
  const zip = /^504b(?:0304|0506|0708)/.test(hex);
  const ole = hex.startsWith('d0cf11e0a1b11ae1');
  let valid = true;
  if(extension==='.pdf')valid=prefix.subarray(0,5).toString()==='%PDF-';
  else if(['.doc','.xls','.ppt'].includes(extension))valid=ole;
  else if(['.docx','.xlsx','.pptx','.odt','.ods','.odp','.zip'].includes(extension))valid=zip;
  else if(extension==='.png')valid=hex.startsWith('89504e470d0a1a0a');
  else if(['.jpg','.jpeg'].includes(extension))valid=hex.startsWith('ffd8ff');
  else if(extension==='.gif')valid=/^GIF8[79]a/.test(prefix.subarray(0,6).toString());
  else if(extension==='.webp')valid=prefix.subarray(0,4).toString()==='RIFF'&&prefix.subarray(8,12).toString()==='WEBP';
  else if(extension==='.ico')valid=hex.startsWith('00000100');
  else if(extension==='.bmp')valid=prefix.subarray(0,2).toString()==='BM';
  else if(extension==='.7z')valid=hex.startsWith('377abcaf271c');
  else if(extension==='.rar')valid=hex.startsWith('526172211a07');
  else if(extension==='.gz')valid=hex.startsWith('1f8b');
  else if(extension==='.mp3')valid=prefix.subarray(0,3).toString()==='ID3'||(prefix.length>1&&prefix[0]===255&&(prefix[1]&0xe0)===0xe0);
  else if(extension==='.wav')valid=prefix.subarray(0,4).toString()==='RIFF'&&prefix.subarray(8,12).toString()==='WAVE';
  else if(extension==='.ogg')valid=prefix.subarray(0,4).toString()==='OggS';
  else if(['.mp4','.mov','.m4a'].includes(extension))valid=prefix.subarray(4,8).toString()==='ftyp';
  else if(extension==='.webm')valid=hex.startsWith('1a45dfa3');
  else if(extension==='.fig')valid=prefix.subarray(0,8).toString()==='fig-kiwi'||zip;
  else if(!textual(name))valid=size>0;
  if(!valid)throw new DomainError(415,'FILE_SIGNATURE_MISMATCH','محتوای فایل با نوع انتخاب‌شده همخوانی ندارد.');
}
