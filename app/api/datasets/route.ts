import {NextRequest,NextResponse} from 'next/server';
import {desc,eq} from 'drizzle-orm';
import {db} from '@/db';
import {datasets,datasetVersions} from '@/db/schema';
import {requireUser,apiError} from '@/lib/dataset-access';
import {uploadCSV,csvHash} from '@/lib/storage';
import {processDataset} from '@/lib/processor';
export const runtime='nodejs';
export async function GET(){
  try{
    const user=await requireUser();
    const items=await db.select().from(datasets).where(eq(datasets.userId,user.id)).orderBy(desc(datasets.updatedAt));
    return NextResponse.json({datasets:items});
  }catch(error){return apiError(error);}
}
export async function POST(request:NextRequest){
  try{
    const user=await requireUser();
    const form=await request.formData();
    const file=form.get('file');
    if(!(file instanceof File))return NextResponse.json({error:'Please upload a CSV file'},{status:400});
    if(!file.name.toLowerCase().endsWith('.csv'))return NextResponse.json({error:'Only .csv files are supported'},{status:415});
    if(file.size>1_500_000)return NextResponse.json({error:'Maximum file size is 1.5 MB for this MVP'},{status:413});
    const csv=await file.text();
    const goal=String(form.get('goal')||'').slice(0,240);
    // Validate the raw file before storing it. Processing must succeed.
    await processDataset('profile',csv,{goal});
    const publicId=await uploadCSV(csv);
    const saved=await db.transaction(async(tx)=>{
      const [dataset]=await tx.insert(datasets).values({userId:user.id,name:file.name.slice(0,120),goal}).returning();
      const [version]=await tx.insert(datasetVersions).values({datasetId:dataset.id,publicId,csvHash:csvHash(csv),operations:[]}).returning();
      await tx.update(datasets).set({currentVersionId:version.id}).where(eq(datasets.id,dataset.id));
      return dataset;
    });
    return NextResponse.json({id:saved.id},{status:201});
  }catch(error){return apiError(error);}
}
