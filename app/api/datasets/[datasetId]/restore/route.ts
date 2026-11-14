import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/db';
import {datasets,auditEvents} from '@/db/schema';
import {and,eq} from 'drizzle-orm';
import {requireUser,requireSameOrigin,loadDataset,apiError} from '@/lib/dataset-access';
import {downloadCSV} from '@/lib/storage';
export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{datasetId:string}>}){
  try{
    requireSameOrigin(request);
    const {datasetId}=await params; const user=await requireUser();
    const {current,versions}=await loadDataset(datasetId,user.id);
    const body=await request.json();
    if(body.baseVersionId!==current.id)throw new Error('STALE_VERSION');
    const target=versions.find(v=>v.id===body.versionId);
    if(!target)throw new Error('NOT_FOUND');
    const csv=await downloadCSV(target.publicId,target.csvHash);
    await db.transaction(async(tx)=>{
      const rows=await tx.update(datasets).set({currentVersionId:target.id,updatedAt:new Date()}).where(and(eq(datasets.id,datasetId),eq(datasets.currentVersionId,current.id))).returning();
      if(!rows.length)throw new Error('STALE_VERSION');
      await tx.insert(auditEvents).values({datasetId,versionId:target.id,userId:user.id,action:'version_restored',details:{from:current.id,to:target.id}});
    });
    return NextResponse.json({versionId:target.id,csv});
  }catch(error){return apiError(error);}
}
