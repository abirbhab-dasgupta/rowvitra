import {v2 as cloudinary} from 'cloudinary';
import { createHash, randomUUID } from 'node:crypto';

function setup(){
  const {CLOUDINARY_CLOUD_NAME,CLOUDINARY_API_KEY,CLOUDINARY_API_SECRET}=process.env;
  if(!CLOUDINARY_CLOUD_NAME||!CLOUDINARY_API_KEY||!CLOUDINARY_API_SECRET) throw new Error('Cloudinary credentials are missing');
  cloudinary.config({cloud_name:CLOUDINARY_CLOUD_NAME,api_key:CLOUDINARY_API_KEY,api_secret:CLOUDINARY_API_SECRET,secure:true});
}
export function csvHash(csv:string){return createHash('sha256').update(csv).digest('hex');}
export async function uploadCSV(csv:string):Promise<string>{
  setup();
  const publicId=`rowvitra/datasets/${randomUUID()}.csv`;
  return new Promise((resolve,reject)=>{
    const stream=cloudinary.uploader.upload_stream({resource_type:'raw',type:'authenticated',public_id:publicId,overwrite:false,invalidate:false},(error,result)=>{
      if(error||!result?.public_id) reject(error||new Error('Upload failed'));
      else resolve(result.public_id);
    });
    stream.end(Buffer.from(csv,'utf8'));
  });
}
export async function downloadCSV(publicId:string, expectedHash?:string):Promise<string>{
  setup();
  if(!/^rowvitra\/datasets\/[a-f0-9-]{36}\.csv$/.test(publicId))throw new Error('Invalid storage identifier');
  const url=cloudinary.url(publicId,{resource_type:'raw',type:'authenticated',sign_url:true});
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15_000)});
  if(!response.ok)throw new Error(`Unable to fetch stored CSV (${response.status})`);
  const content=await response.text();
  if(Buffer.byteLength(content,'utf8')>1_500_000)throw new Error('Stored CSV exceeds processing limit');
  if(expectedHash && csvHash(content)!==expectedHash) throw new Error('Stored CSV integrity check failed');
  return content;
}
