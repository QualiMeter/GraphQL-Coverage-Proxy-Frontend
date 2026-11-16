import {Controls, ControlButton, getViewportForBounds, useReactFlow, useStore, useStoreApi} from '@xyflow/react';
import {ActionTooltip} from './ActionTooltip';

const minReadableZoom = .72;
const fitOptions = {padding:.12, maxZoom:1, duration:350};

export function GraphControls({hasNodes}:{hasNodes:boolean}) {
  const {zoomIn,zoomOut,fitView,getNodes,getNodesBounds,setViewport}=useReactFlow();
  const store=useStoreApi();
  const canZoomIn=useStore(state=>state.transform[2]<state.maxZoom);
  const canZoomOut=useStore(state=>state.transform[2]>state.minZoom);

  function fitReadableView() {
    const {width,height}=store.getState();
    const nodes=getNodes().filter(node=>!node.hidden&&node.measured?.width&&node.measured.height);
    if(!width||!height||!nodes.length)return;

    const bounds=getNodesBounds(nodes);
    const fitted=getViewportForBounds(bounds,width,height,0,fitOptions.maxZoom,fitOptions.padding);
    if(fitted.zoom>=minReadableZoom) {
      void fitView(fitOptions);
      return;
    }

    // Start at the first row or column when the full layout would be too small to read.
    const inset=16;
    const visible=getViewportForBounds(bounds,width,height,minReadableZoom,fitOptions.maxZoom,fitOptions.padding);
    void setViewport({
      x:bounds.width*visible.zoom>width-2*inset?inset-bounds.x*visible.zoom:visible.x,
      y:bounds.height*visible.zoom>height-2*inset?inset-bounds.y*visible.zoom:visible.y,
      zoom:visible.zoom,
    },{duration:fitOptions.duration});
  }

  return <Controls className="schema-graph-controls" aria-label="Масштаб графа"
    showZoom={false} showFitView={false} showInteractive={false}>
    <GraphControl label="Увеличить масштаб" path="M4 9h10M9 4v10"
      disabled={!canZoomIn} onClick={()=>void zoomIn()}/>
    <GraphControl label="Уменьшить масштаб" path="M4 9h10"
      disabled={!canZoomOut} onClick={()=>void zoomOut()}/>
    <GraphControl label="Вписать граф" path="M7 3H3v4m8-4h4v4m0 4v4h-4m-8-4v4h4"
      disabled={!hasNodes} onClick={fitReadableView}/>
  </Controls>;
}

function GraphControl({label,path,disabled,onClick}:{label:string;path:string;disabled:boolean;onClick:()=>void}) {
  return <ActionTooltip label={label}>
    <ControlButton aria-label={label} disabled={disabled} onClick={onClick}>
      <svg aria-hidden="true" viewBox="0 0 18 18">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </ControlButton>
  </ActionTooltip>;
}
