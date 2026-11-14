import {createHash,createHmac,timingSafeEqual} from 'node:crypto';

type ApprovalContext={userId:string;datasetId:string;versionId:string;operations:unknown[];rules:unknown[];csv:string};

function secret(){
  const value=process.env.BETTER_AUTH_SECRET;
  if(!value)throw new Error('Preview signing is not configured');
  return value;
}

function fingerprint(context:ApprovalContext){
  return createHash('sha256').update(JSON.stringify({...context,csv:createHash('sha256').update(context.csv).digest('hex')})).digest('hex');
}

export function issuePreviewApproval(context:ApprovalContext){
  const payload=Buffer.from(JSON.stringify({fingerprint:fingerprint(context),expiresAt:Date.now()+10*60_000})).toString('base64url');
  const signature=createHmac('sha256',secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyPreviewApproval(token:unknown,context:ApprovalContext){
  if(typeof token!=='string'||token.length>1024)return false;
  const [payload,signature,...extra]=token.split('.');
  if(!payload||!signature||extra.length)return false;
  const expected=createHmac('sha256',secret()).update(payload).digest();
  let provided:Buffer;
  try{provided=Buffer.from(signature,'base64url')}catch{return false}
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))return false;
  try{
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return parsed.expiresAt>Date.now()&&parsed.fingerprint===fingerprint(context);
  }catch{return false}
}
