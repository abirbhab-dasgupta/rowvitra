import {NextRequest,NextResponse} from 'next/server';
import {and,asc,eq} from 'drizzle-orm';
import {db} from '@/db';
import {datasets,datasetVersions,auditEvents,savedCharts,dataRules} from '@/db/schema';
import {requireUser,requireSameOrigin,loadDataset,apiError} from '@/lib/dataset-access';
import {uploadCSV,deleteCSV,downloadCSV,csvHash} from '@/lib/storage';
import {processDataset,ProcessorAction} from '@/lib/processor';
import {issuePreviewApproval,verifyPreviewApproval} from '@/lib/preview-approval';
export const runtime='nodejs';
const ACTIONS=new Set(['decision-question','decision','profile','suggest','chart-advisor','replay','impact-chart','preview','chart','rules','script','rows','commit','save-chart','save-rule','delete-rule']);
export async function POST(request:NextRequest,{params}:{params:Promise<{datasetId:string}>}){
  try{
    requireSameOrigin(request);
    const user=await requireUser();
    const {datasetId}=await params;
    const {dataset,current,versions}=await loadDataset(datasetId,user.id);
    const body=await request.json();
    const action=String(body.action||'');
    if(!ACTIONS.has(action))return NextResponse.json({error:'Invalid action'},{status:400});
    if(body.versionId!==current.id)throw new Error('STALE_VERSION');
    const csv=await downloadCSV(current.publicId,current.csvHash);
    if(action==='decision-question')return NextResponse.json(await processDataset(action,csv,{question:body.question}));
    if(action==='decision'){
      const original=versions.find(version=>version.parentVersionId===null);
      if(!original)throw new Error('Original dataset version not found');
      const originalCsv=original.id===current.id?csv:await downloadCSV(original.publicId,original.csvHash);
      return NextResponse.json(await processDataset('decision',csv,{originalCsv,operations:current.operations,spec:body.spec}));
    }
    if(action==='save-chart'){
      const spec=body.spec;
      if(!spec || typeof spec !== 'object'||Array.isArray(spec)||JSON.stringify(spec).length>5000)throw new Error('Invalid chart spec');
      await processDataset('chart',csv,{spec});
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
      if(JSON.stringify(rule).length>5000)throw new Error('Invalid rule');
      const existing=await db.select({id:dataRules.id}).from(dataRules).where(eq(dataRules.datasetId,datasetId));
      if(existing.length>=50)throw new Error('A dataset may contain no more than 50 rules');
      const checked=await processDataset('rules',csv,{rules:[rule]});
      if(checked.results[0]?.message==='Missing column')throw new Error('Invalid rule column');
      const [item]=await db.insert(dataRules).values({datasetId,column:rule.column,type:rule.type,options:rule}).returning();
      return NextResponse.json({rule:item});
    }
    if(['preview','impact-chart','commit'].includes(action)&&(!Array.isArray(body.operations)||body.operations.some((item:unknown)=>!item||typeof item!=='object'||Array.isArray(item)||'operation' in item&&item.operation==='checkpoint')))throw new Error('Invalid operations');
    const operations=action==='script'||action==='replay'?current.operations:Array.isArray(body.operations)?body.operations:[];
    const persistedRules=await db.select().from(dataRules).where(eq(dataRules.datasetId,datasetId)).orderBy(asc(dataRules.createdAt),asc(dataRules.id));
    if(persistedRules.length>50)throw new Error('A dataset may contain no more than 50 rules');
    const rules=action==='rules'?body.rules:persistedRules.map(item=>item.options);
    if(!Array.isArray(rules))throw new Error('Invalid rules');
    if(action==='preview'){
      const result=await processDataset('preview',csv,{operations,rules,goal:dataset.goal});
      return NextResponse.json({...result,approvalToken:issuePreviewApproval({userId:user.id,datasetId,versionId:current.id,operations,rules,csv:result.csv})});
    }
    if(action==='commit'){
      if(!operations.length)throw new Error('Choose at least one operation');
      const result=await processDataset('preview',csv,{operations,rules,goal:dataset.goal});
      if(!verifyPreviewApproval(body.approvalToken,{userId:user.id,datasetId,versionId:current.id,operations,rules,csv:result.csv}))throw new Error('STALE_PREVIEW');
      if(!result.valid) return NextResponse.json({error:'Data rules failed',results:result.rules},{status:422});
      if(result.csv===csv)throw new Error('No data changes to commit');
      // A checkpoint preserves row identity semantics across immutable CSV reloads.
      const combined=[...(current.operations||[]),...operations,{operation:'checkpoint'}];
      if(combined.length>300)throw new Error('Recipe exceeds 300 operations');
      const publicId=await uploadCSV(result.csv);
      let next;
      try{
        next=await db.transaction(async(tx)=>{
          const [version]=await tx.insert(datasetVersions).values({datasetId,publicId,csvHash:csvHash(result.csv),operations:combined,parentVersionId:current.id}).returning();
          const updated=await tx.update(datasets).set({currentVersionId:version.id,updatedAt:new Date()}).where(and(eq(datasets.id,datasetId),eq(datasets.currentVersionId,current.id))).returning();
          if(!updated.length)throw new Error('STALE_VERSION');
          await tx.insert(auditEvents).values({datasetId,versionId:version.id,userId:user.id,action:'repair_committed',details:{operations,diff:result.diff,verifiedRules:result.rules}});
          return version;
        });
      }catch(error){
        await deleteCSV(publicId).catch(()=>console.error('Orphan CSV cleanup failed after commit'));
        throw error;
      }
      return NextResponse.json({versionId:next.id,csv:result.csv,preview:result,operations:combined});
    }
    const original=action==='script'||action==='replay'?versions.find(version=>version.operations.length===0):undefined;
    if((action==='script'||action==='replay')&&!original)throw new Error('Original dataset version not found');
    const sourceCsv=original?await downloadCSV(original.publicId,original.csvHash):csv;
    const result=await processDataset(action as ProcessorAction,sourceCsv,{goal:dataset.goal,operations,rules,spec:body.spec,newCsv:body.newCsv,rowIds:body.rowIds,offset:body.offset,limit:body.limit});
    return NextResponse.json(result);
  }catch(error){return apiError(error);}
}
