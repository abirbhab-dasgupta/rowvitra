import {NextRequest,NextResponse} from 'next/server';
import {processDataset,ProcessorAction} from '@/lib/processor';
export const runtime='nodejs';
const allowed=new Set(['profile','suggest','chart-advisor','replay','impact-chart','preview','chart','rules','script','rows']);
export async function POST(request:NextRequest){
  if(process.env.ENABLE_PUBLIC_DEMO!=='true')return NextResponse.json({error:'Public demo is disabled'},{status:404});
  try{
    const body=await request.json();
    if(!allowed.has(body.action)||typeof body.csv!=='string'||body.csv.length>100_000)throw new Error('Invalid public demo request');
    const action=body.action as ProcessorAction;
    if(action==='chart-advisor'){
      const profile=await processDataset('profile',body.csv,{goal:body.goal||''});
      const numeric=profile.columns.filter((c:{type:string})=>c.type==='number');
      const text=profile.columns.filter((c:{type:string})=>c.type==='text');
      return NextResponse.json({mode:'rules',spec:{type:'bar',x:text[0]?.name||profile.columns[0]?.name,y:numeric[0]?.name||profile.columns[1]?.name,aggregation:numeric.length?'sum':'count',title:'Dataset overview'},reason:'Suggested using column types'});
    }
    if(action==='suggest'){
      const profile=await processDataset('profile',body.csv,{goal:body.goal||''});
      const proposals=profile.issues.flatMap((i:{kind:string;column:string|null;id:string})=>i.kind==='inconsistent_category'?[{issueId:i.id,title:'Standardize category labels',reason:'Normalize case and whitespace',risk:'medium',operation:{operation:'normalize_category',column:i.column,parameters:{}},source:'rules'}]:i.kind==='exact_duplicate'?[{issueId:i.id,title:'Remove exact duplicates',reason:'Review identical rows before removal',risk:'medium',operation:{operation:'drop_duplicates',column:null,parameters:{}},source:'rules'}]:[]);
      return NextResponse.json({mode:'rules',notice:'Rule-based demo; connect NVIDIA for AI plans',proposals});
    }
    const result=await processDataset(action,body.csv,{goal:body.goal||'',operations:body.operations||[],rules:body.rules||[],spec:body.spec,newCsv:body.newCsv});
    return NextResponse.json(result);
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Demo error'},{status:400});}
}
