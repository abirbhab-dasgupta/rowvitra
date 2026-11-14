import {NextRequest,NextResponse} from 'next/server';
import {eq,asc} from 'drizzle-orm';
import {db} from '@/db';
import {auditEvents} from '@/db/schema';
import {requireUser,loadDataset,apiError} from '@/lib/dataset-access';
import {downloadCSV} from '@/lib/storage';
import {processDataset} from '@/lib/processor';
export const runtime='nodejs';
export async function GET(request:NextRequest,{params}:{params:Promise<{datasetId:string}>}){
  try{
    const {datasetId}=await params; const user=await requireUser();
    const {dataset,current,versions}=await loadDataset(datasetId,user.id);
    const format=new URL(request.url).searchParams.get('format')||'csv';
    const baseName=dataset.name.replace(/\.csv$/i,'').replace(/[^a-z0-9_-]/gi,'_').slice(0,60);
    let contents=''; let mime='text/plain'; let extension='txt';
    if(format==='csv'){
      contents=await downloadCSV(current.publicId,current.csvHash); mime='text/csv; charset=utf-8';extension='csv';
    }else if(format==='python'){
      // Replay always uses original source, never the current cleaned version.
      const original=versions.find(v=>v.operations.length===0);
      if(!original)throw new Error('Original dataset version not found');
      const result=await processDataset('script',await downloadCSV(original.publicId,original.csvHash),{operations:current.operations});
      contents=result.script;mime='text/x-python; charset=utf-8';extension='py';
    }else if(format==='audit'){
      const events=await db.select().from(auditEvents).where(eq(auditEvents.datasetId,datasetId)).orderBy(asc(auditEvents.createdAt));
      contents=JSON.stringify({dataset:dataset.name,activeVersion:current.id,versions:versions.map(v=>({id:v.id,parentVersionId:v.parentVersionId,hash:v.csvHash,operations:v.operations,createdAt:v.createdAt})),events},null,2);
      mime='application/json';extension='json';
    }else return NextResponse.json({error:'Unsupported export type'},{status:400});
    return new NextResponse(contents,{headers:{'Content-Type':mime,'Content-Disposition':`attachment; filename="${baseName}_rowvitra.${extension}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){return apiError(error);}
}
