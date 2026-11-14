import { NextResponse } from 'next/server';
import {eq,and,desc} from 'drizzle-orm';
import {db} from '@/db';
import {datasets,datasetVersions} from '@/db/schema';
import {currentSession} from '@/lib/session';
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
  const status=message==='UNAUTHORIZED'?401:message==='NOT_FOUND'?404:message==='STALE_VERSION'?409:message.includes('configured')?503:message.includes('exceeds')?413:400;
  return NextResponse.json({error:message},{status});
}
