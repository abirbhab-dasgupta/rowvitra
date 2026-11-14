import {WorkspaceClient} from '@/components/workspace/workspace-client';
export default async function Page({params}:{params:Promise<{datasetId:string}>}){const {datasetId}=await params;return <WorkspaceClient datasetId={datasetId}/>}
