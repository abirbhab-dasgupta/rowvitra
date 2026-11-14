export type ProcessorAction='profile'|'suggest'|'preview'|'chart'|'rules'|'script'|'rows'|'chart-advisor'|'replay'|'impact-chart';
export async function processDataset(action:ProcessorAction, csv:string, payload:Record<string,unknown>={}) {
  const endpoint=process.env.PROCESSOR_API_URL;
  const token=process.env.PROCESSOR_SERVICE_TOKEN;
  if(!endpoint||!token) throw new Error('Processor service is not configured');
  const response=await fetch(`${endpoint.replace(/\/$/,'')}/v1/${action}`,{
    method:'POST',headers:{'Content-Type':'application/json','X-Processor-Token':token},
    body:JSON.stringify({csv,...payload}),cache:'no-store',signal:AbortSignal.timeout(55_000),
  });
  const result=await response.json().catch(()=>({detail:'Processor returned an invalid response'}));
  if(!response.ok) throw new Error(typeof result.detail==='string'?result.detail:`Processing failed (${response.status})`);
  return result;
}
