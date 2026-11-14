import { NextResponse } from 'next/server';
import {eq,and,desc} from 'drizzle-orm';
import {db} from '@/db';
import {datasets,datasetVersions} from '@/db/schema';
import {currentSession} from '@/lib/session';
import {ProcessorError} from '@/lib/processor';

export function requireSameOrigin(request:Request){
  const expected=process.env.BETTER_AUTH_URL;
  const actual=request.headers.get('origin');
  if(!expected||!actual||actual!==new URL(expected).origin)throw new Error('INVALID_ORIGIN');
}
export async function requireUser(){
  const session=await currentSession();
  if(!session?.user) throw new Error('UNAUTHORIZED');
  return session.user;
}
export async function loadDataset(datasetId:string,userId:string){
  const rows=await db.select().from(datasets).where(and(eq(datasets.id,datasetId),eq(datasets.userId,userId))).limit(1);
  if(!rows.length)throw new Error('NOT_FOUND');
  const dataset=rows[0];
  if(!dataset.currentVersionId)throw new Error('Dataset has no current version');
  const versions=await db.select().from(datasetVersions).where(eq(datasetVersions.datasetId,dataset.id)).orderBy(desc(datasetVersions.createdAt));
  const current=versions.find(v=>v.id===dataset.currentVersionId);
  if(!current)throw new Error('Missing active version');
  return {dataset,current,versions};
}
export function apiError(error:unknown){
  const message=error instanceof Error?error.message:'Unexpected error';
  if(message==='UNAUTHORIZED')return NextResponse.json({error:'Sign in required'},{status:401});
  if(message==='NOT_FOUND')return NextResponse.json({error:'Dataset not found'},{status:404});
  if(message==='STALE_VERSION')return NextResponse.json({error:'Dataset version changed; reload and try again'},{status:409});
  if(message==='STALE_PREVIEW')return NextResponse.json({error:'Repair selection or rules changed; preview again'},{status:409});
  if(message==='INVALID_ORIGIN')return NextResponse.json({error:'Invalid request origin'},{status:403});
  if(error instanceof SyntaxError)return NextResponse.json({error:'Invalid JSON request'},{status:400});
  if(error instanceof ProcessorError)return NextResponse.json({error:error.message},{status:error.status});
  if(['Invalid action','Invalid operations','Invalid rules','Invalid rule','Invalid rule column','Invalid chart spec','Choose at least one operation','No data changes to commit','Data rules failed','A dataset may contain no more than 50 rules','Recipe exceeds 300 operations'].includes(message))return NextResponse.json({error:message},{status:400});
  if(message.includes('configured')||message==='Cloudinary credentials are missing')return NextResponse.json({error:'A required service is unavailable'},{status:503});
  return NextResponse.json({error:'Request could not be completed'},{status:500});
}
