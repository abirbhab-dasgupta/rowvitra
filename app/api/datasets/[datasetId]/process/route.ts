import {NextRequest,NextResponse} from 'next/server';
import {and,eq} from 'drizzle-orm';
import {db} from '@/db';
import {datasets,datasetVersions,auditEvents,savedCharts,dataRules} from '@/db/schema';
import {requireUser,loadDataset,apiError} from '@/lib/dataset-access';
import {uploadCSV,downloadCSV,csvHash} from '@/lib/storage';
import {processDataset,ProcessorAction} from '@/lib/processor';
export const runtime='nodejs';
const ACTIONS=new Set(['profile','suggest','chart-advisor','replay','impact-chart','preview','chart','rules','script','rows','commit','save-chart','save-rule','delete-rule']);
export async function POST(request:NextRequest,{params}:{params:Promise<{datasetId:string}>}){
  try{
    const user=await requireUser();
    const {datasetId}=await params;
    const {dataset,current}=await loadDataset(datasetId,user.id);
    const body=await request.json();
    const action=String(body.action||'');
    if(!ACTIONS.has(action))return NextResponse.json({error:'Invalid action'},{status:400});
    if(body.versionId!==current.id)throw new Error('STALE_VERSION');
    if(action==='save-chart'){
      const spec=body.spec;
      if(!spec || typeof spec !== 'object')throw new Error('Invalid chart spec');
      const [item]=await db.insert(savedCharts).values({datasetId,userId:user.id,title:String(spec.title||'Untitled chart').slice(0,120),spec}).returning();
      return NextResponse.json({chart:item});
    }
    if(action==='delete-rule'){
      const rule=body.rule;
      if(!rule || typeof rule.column!=='string'||typeof rule.type!=='string')throw new Error('Invalid rule');
      await db.delete(dataRules).where(and(eq(dataRules.datasetId,datasetId),eq(dataRules.column,rule.column),eq(dataRules.type,rule.type)));
      return NextResponse.json({deleted:true});
    }
    if(action==='save-rule'){
      const rule=body.rule;
      if(!rule || typeof rule.column!=='string'||!['not_null','unique','range','allowed_values'].includes(rule.type))throw new Error('Invalid rule');
      const [item]=await db.insert(dataRules).values({datasetId,column:rule.column,type:rule.type,options:rule}).returning();
      return NextResponse.json({rule:item});
    }
    const csv=await downloadCSV(current.publicId,current.csvHash);
    const operations=Array.isArray(body.operations)?body.operations:[];
    const rules=Array.isArray(body.rules)?body.rules:[];
    if(action==='commit'){
      if(!operations.length)throw new Error('Choose at least one operation');
      const result=await processDataset('preview',csv,{operations,rules,goal:dataset.goal});
      if(!result.valid) return NextResponse.json({error:'Data rules failed',results:result.rules},{status:422});
      if(result.csv===csv)throw new Error('No data changes to commit');
      const publicId=await uploadCSV(result.csv);
      // A checkpoint preserves row identity semantics across immutable CSV reloads.
      const combined=[...(current.operations||[]),...operations,{operation:'checkpoint'}];
      const next=await db.transaction(async(tx)=>{
        const [version]=await tx.insert(datasetVersions).values({datasetId,publicId,csvHash:csvHash(result.csv),operations:combined,parentVersionId:current.id}).returning();
        const updated=await tx.update(datasets).set({currentVersionId:version.id,updatedAt:new Date()}).where(and(eq(datasets.id,datasetId),eq(datasets.currentVersionId,current.id))).returning();
        if(!updated.length)throw new Error('STALE_VERSION');
        await tx.insert(auditEvents).values({datasetId,versionId:version.id,userId:user.id,action:'repair_committed',details:{operations,diff:result.diff,verifiedRules:result.rules}});
        return version;
      });
      return NextResponse.json({versionId:next.id,csv:result.csv,preview:result,operations:combined});
    }
    const result=await processDataset(action as ProcessorAction,csv,{goal:dataset.goal,operations,rules,spec:body.spec,newCsv:body.newCsv});
    return NextResponse.json(result);
  }catch(error){return apiError(error);}
}
