'use client';
import {useEffect,useRef} from 'react';
import {ChartResult} from './types';
export function PlotlyChart({chart,onSelect}:{chart:ChartResult|null;onSelect?:(ids:string[])=>void}){
  const div=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    let cancelled=false; let cleanup=()=>{};
    (async()=>{
      if(!div.current||!chart)return;
      const Plotly=(await import('plotly.js-dist-min')).default;
      if(cancelled||!div.current)return;
      const pts=chart.points||[];
      let data:Record<string,unknown>[]=[];
      const color='#e9440a';
      const rowIds=pts.map(p=>p.rowIds||[]);
      if(chart.type==='pie')data=[{type:'pie',labels:pts.map(p=>String(p.x)),values:pts.map(p=>p.y),hole:.45,marker:{colors:['#e9440a','#26201d','#b87c5f','#d8c7bc','#88807a','#f2aa83']},customdata:rowIds,textinfo:'label+percent'}];
      else if(chart.type==='scatter')data=[{type:'scatter',mode:'markers',x:pts.map(p=>p.x),y:pts.map(p=>p.y),marker:{color,size:10,opacity:.78},customdata:rowIds}];
      else if(chart.type==='map')data=[{type:'scattergeo',mode:'markers',lat:pts.map(p=>p.x),lon:pts.map(p=>p.y),marker:{color,size:8,opacity:.8},customdata:rowIds}];
      else if(chart.type==='histogram')data=[{type:'histogram',x:pts.map(p=>p.x),marker:{color},customdata:rowIds,nbinsx:20}];
      else if(chart.type==='box')data=[{type:'box',y:pts.map(p=>p.x),marker:{color},line:{color},boxpoints:'all',jitter:.3,pointpos:-1,customdata:rowIds}];
      else if(chart.type==='heatmap')data=[{type:'heatmap',z:chart.matrix||[],x:chart.labels||[],y:chart.labels||[],colorscale:[[0,'#f3e8dc'],[.5,'#edb08c'],[1,'#c93b0e']]}];
      else data=[{type:chart.type||'bar',x:pts.map(p=>p.x),y:pts.map(p=>p.y),marker:{color},line:{color,width:3},mode:chart.type==='line'?'lines+markers':undefined,customdata:rowIds}];
      const gd=div.current as HTMLDivElement;
      await Plotly.react(gd,data as never,{title:{text:chart.title||'',font:{family:'Arial, sans-serif',size:17,color:'#161616'}},paper_bgcolor:'#fff',plot_bgcolor:'#fff',margin:{l:55,r:22,t:65,b:80},font:{family:'Arial, sans-serif',color:'#39332e',size:12},xaxis:{title:{text:chart.xLabel||''},gridcolor:'#eee7e0'},yaxis:{title:{text:chart.yLabel||''},gridcolor:'#eee7e0'},showlegend:false,geo:chart.type==='map'?{showland:true,landcolor:'#eee7e0',showocean:true,oceancolor:'#f8f6f2',projection:{type:'natural earth'}}:undefined},{responsive:true,displaylogo:false,modeBarButtonsToRemove:['sendDataToCloud','lasso2d'] as never});
      if(cancelled){Plotly.purge(gd);return;}
      const graph=gd as HTMLDivElement & {on?:(event:string,callback:(value:any)=>void)=>void;removeAllListeners?:(event:string)=>void};
      graph.on?.('plotly_click',(evt:any)=>{
        const point=evt.points?.[0];
        // Histograms report all source indices in the selected bin; preserve
        // real source lineage rather than incorrectly selecting only one row.
        const sourceIndices: number[] | undefined = Array.isArray(point?.pointNumbers) ? point.pointNumbers : undefined;
        const ids = sourceIndices ? sourceIndices.flatMap(index => rowIds[index] || []) :
          point?.customdata || rowIds[point?.pointIndex ?? point?.pointNumber] || [];
        if(Array.isArray(ids)) onSelect?.([...new Set(ids.map(String))].slice(0, 300));
      });
      cleanup=()=>{graph.removeAllListeners?.('plotly_click');Plotly.purge(gd)};
    })();
    return()=>{cancelled=true;cleanup()};
  },[chart,onSelect]);
  if(!chart)return <div className="no-content"><strong>No chart yet</strong><p className="subtle small">Choose columns and generate a chart to begin.</p></div>;
  return <div ref={div} style={{width:'100%',height:400}} role="img" aria-label={chart.title||'Dataset visualization'}/>;
}
