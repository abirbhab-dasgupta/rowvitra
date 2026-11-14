export type ProcessorAction='profile'|'suggest'|'preview'|'chart'|'rules'|'script'|'rows'|'chart-advisor'|'replay'|'impact-chart';
export class ProcessorError extends Error{
  status:number;
  constructor(message:string,status:number){super(message);this.status=status}
}
export async function processDataset(action:ProcessorAction, csv:string, payload:Record<string,unknown>={}) {
  const endpoint=process.env.PROCESSOR_API_URL;
  const token=process.env.PROCESSOR_SERVICE_TOKEN;
  if(!endpoint||!token) throw new Error('Processor service is not configured');
  let response:Response;
  try{
    response=await fetch(`${endpoint.replace(/\/$/,'')}/v1/${action}`,{
      method:'POST',headers:{'Content-Type':'application/json','X-Processor-Token':token},
      body:JSON.stringify({csv,...payload}),cache:'no-store',signal:AbortSignal.timeout(55_000),
    });
  }catch{throw new ProcessorError('Processing service unavailable',503)}
  const result=await response.json().catch(()=>null);
  if(!result||typeof result!=='object'||Array.isArray(result))throw new ProcessorError('Processing service returned an invalid response',503);
  if(!response.ok) throw new ProcessorError(response.status===422?(typeof result.detail==='string'?result.detail:'Invalid processing request'):'Processing service unavailable',response.status===422?422:503);
  return result;
}
