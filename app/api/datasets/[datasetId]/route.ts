import {NextResponse} from 'next/server';
import {requireUser,requireSameOrigin,loadDataset,apiError} from '@/lib/dataset-access';
import {downloadCSV} from '@/lib/storage';
import {db} from '@/db';
import {dataRules,savedCharts} from '@/db/schema';
import {asc,eq} from 'drizzle-orm';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{datasetId:string}>}){
  try{
    const {datasetId}=await params;
    const user=await requireUser();
    const {dataset,current,versions}=await loadDataset(datasetId,user.id);
    const csv=await downloadCSV(current.publicId,current.csvHash);
    const storedRules=await db.select().from(dataRules).where(eq(dataRules.datasetId,dataset.id)).orderBy(asc(dataRules.createdAt),asc(dataRules.id));
    const charts=await db.select().from(savedCharts).where(eq(savedCharts.datasetId,dataset.id));
    return NextResponse.json({dataset,rules:storedRules.map(r=>r.options),savedCharts:charts,currentVersionId:current.id,versions:versions.map(v=>({id:v.id,parentVersionId:v.parentVersionId,createdAt:v.createdAt,operations:v.operations})),csv});
  }catch(error){return apiError(error);}
}
export async function PATCH(request:Request,{params}:{params:Promise<{datasetId:string}>}){
 try{
   requireSameOrigin(request);
   const {datasetId}=await params;const user=await requireUser();
   const body=await request.json();const goal=String(body.goal||'').slice(0,240);
   const {datasets}=await import('@/db/schema');const {and}=await import('drizzle-orm');
   const [item]=await db.update(datasets).set({goal,updatedAt:new Date()}).where(and(eq(datasets.id,datasetId),eq(datasets.userId,user.id))).returning();
   if(!item)throw new Error('NOT_FOUND');
   return NextResponse.json({goal});
 }catch(error){return apiError(error)}
}
