import {BaseEdge,type EdgeProps} from '@xyflow/react';
export type Box={x:number;y:number;width:number;height:number};
export type RouteData={obstacles:Box[];offset:number};
type Point={x:number;y:number};
const inside=(p:Point,b:Box)=>p.x>b.x-12&&p.x<b.x+b.width+12&&p.y>b.y-12&&p.y<b.y+b.height+12;
const length=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
function cubic(a:Point,b:Point,c:Point,d:Point,t:number):Point{const u=1-t;return {x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y}}
type Segment=[Point,Point,Point,Point];
function direct(a:Point,z:Point,offset:number):Segment[]{const gap=Math.max(55,Math.abs(z.x-a.x)*.42);return [[a,{x:a.x+gap+offset,y:a.y},{x:z.x-gap-offset,y:z.y},z]]}
function detour(a:Point,z:Point,y:number,offset:number):Segment[]{
  const x1=a.x+48+offset,x2=z.x-48-offset;
  const p={x:x1,y},q={x:x2,y};
  const bend=(x2-x1)*.28;
  return [
    [a,{x:x1,y:a.y},{x:x1-bend,y},p],
    [p,{x:x1+bend,y},{x:x2-bend,y},q],
    [q,{x:x2+bend,y},{x:x2,y:z.y},z],
  ];
}
function score(segments:Segment[],obstacles:Box[]){let collisions=0,distance=0;for(const [a,b,c,d] of segments){let prev=a;for(let i=1;i<=18;i++){const p=cubic(a,b,c,d,i/18);distance+=length(prev,p);if(obstacles.some(box=>inside(p,box)))collisions++;prev=p}}return collisions*180+distance}
export function routePath(sourceX:number,sourceY:number,targetX:number,targetY:number,data:RouteData={obstacles:[],offset:0}){const a={x:sourceX,y:sourceY},z={x:targetX,y:targetY};const candidates=[direct(a,z,data.offset)];const nearby=data.obstacles.filter(b=>b.x<Math.max(a.x,z.x)+100&&b.x+b.width>Math.min(a.x,z.x)-100&&b.y<Math.max(a.y,z.y)+170&&b.y+b.height>Math.min(a.y,z.y)-170);const top=Math.min(a.y,z.y,...nearby.map(b=>b.y))-54-data.offset,bottom=Math.max(a.y,z.y,...nearby.map(b=>b.y+b.height))+54+data.offset;candidates.push(detour(a,z,top,data.offset),detour(a,z,bottom,data.offset));const best=candidates.map(segments=>({segments,cost:score(segments,data.obstacles)})).sort((u,v)=>u.cost-v.cost)[0].segments;return best.map(([p,c1,c2,q],i)=>`${i?'':'M '+p.x+' '+p.y+' '}C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${q.x} ${q.y}`).join(' ')}
export function RoutedEdge({sourceX,sourceY,targetX,targetY,markerEnd,style,data}:EdgeProps){return <BaseEdge path={routePath(sourceX,sourceY,targetX,targetY,data as RouteData|undefined)} markerEnd={markerEnd} style={style}/>}
