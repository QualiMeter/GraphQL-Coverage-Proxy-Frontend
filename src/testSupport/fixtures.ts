import type {FieldRef,Operation,Store,Observation,Run} from './model';
import {snapshotFromSDL} from './sdl';
const MOCK_SERVICE_ID = 'mock:customer';
export const customerSDL=`schema { query: Query mutation: Mutation }
type Query { customer(id: ID!): Customer customers: [Customer!]! order(id: ID!): Order orders: [Order!]! products: [Product!]! search(term: String!): [SearchResult!]! }
type Mutation { createCustomer(name: String!): Customer! createOrder(customerId: ID!): Order! updateOrder(id: ID!): Order! cancelOrder(id: ID!): Order! }
type Customer { id: ID! name: String! email: String phone: String orders: [Order!]! address: Address loyalty: Loyalty }
type Order { id: ID! total: Float! status: OrderStatus! customer: Customer! items: [OrderItem!]! shipment: Shipment createdAt: String! }
type OrderItem { id: ID! quantity: Int! price: Float! product: Product! }
type Product { id: ID! name: String! price: Float! category: Category! stock: Int! }
type Category { id: ID! name: String! products: [Product!]! }
type Address { city: String! street: String! postcode: String! }
type Shipment { id: ID! trackingCode: String status: String! address: Address! }
type Loyalty { level: String! points: Int! }
type SearchResult { customer: Customer order: Order product: Product }
enum OrderStatus { NEW PAID SHIPPED CANCELLED }`;
const oldSDL=customerSDL.replace(' phone: String','').replace(' loyalty: Loyalty','').replace('type Loyalty { level: String! points: Int! }','');
const services=[{id:MOCK_SERVICE_ID,name:'Mock Customer API',endpointUrl:'https://customer.example.com/graphql',description:'Демонстрационный сервис клиентов',createdAt:'2026-11-01T00:00:00Z'},{id:'billing',name:'Billing API',endpointUrl:'https://billing.example.com/graphql',description:'Демонстрационный сервис счетов',createdAt:'2026-11-01T00:00:00Z'}];
const snapshots=[{...snapshotFromSDL(customerSDL,MOCK_SERVICE_ID,'Customer schema v2','customer-v2'),createdAt:'2026-11-12T08:00:00Z'},{...snapshotFromSDL(oldSDL,MOCK_SERVICE_ID,'Customer schema v1','customer-v1'),createdAt:'2026-11-07T08:00:00Z'},{...snapshotFromSDL('type Query { invoice(id: ID!): Invoice invoices: [Invoice!]! } type Invoice { id: ID! amount: Float! paid: Boolean! }','billing','Billing schema v1','billing-v1'),createdAt:'2026-11-09T08:00:00Z'}];
const runs:Run[]=[{id:'reg13',serviceId:MOCK_SERVICE_ID,snapshotId:'customer-v2',name:'Regression #13',status:'completed',startedAt:'2026-11-13T09:00:00Z',endedAt:'2026-11-13T09:34:00Z'},{id:'reg12',serviceId:MOCK_SERVICE_ID,snapshotId:'customer-v1',name:'Regression #12',status:'completed',startedAt:'2026-11-08T09:00:00Z',endedAt:'2026-11-08T09:28:00Z'},{id:'smoke',serviceId:MOCK_SERVICE_ID,snapshotId:'customer-v2',name:'Smoke #24',status:'completed',startedAt:'2026-11-12T10:00:00Z',endedAt:'2026-11-12T10:06:00Z'},{id:'active',serviceId:MOCK_SERVICE_ID,snapshotId:'customer-v2',name:'Current run',status:'active',startedAt:'2026-11-14T08:00:00Z',endedAt:null},{id:'billing-run',serviceId:'billing',snapshotId:'billing-v1',name:'Billing smoke',status:'completed',startedAt:'2026-11-10T11:00:00Z',endedAt:'2026-11-10T11:09:00Z'}];
const refs=(...parts:string[]):FieldRef[]=>parts.map(x=>{const [type,field]=x.split('.');return {type,field}});
const spec:{id:string;name:string;kind:'Query'|'Mutation';document:string;fields:FieldRef[]}[]=[
 {id:'get-customer',name:'GetCustomer',kind:'Query',document:'query GetCustomer { customer(id: "[redacted]") { id name email orders { id total status } } }',fields:refs('Query.customer','Customer.id','Customer.name','Customer.email','Customer.orders','Order.id','Order.total','Order.status')},
 {id:'get-orders',name:'GetOrders',kind:'Query',document:'query GetOrders { orders { id total status customer { id name } items { quantity price } } }',fields:refs('Query.orders','Order.id','Order.total','Order.status','Order.customer','Customer.id','Customer.name','Order.items','OrderItem.quantity','OrderItem.price')},
 {id:'get-orders-brief',name:'GetOrders',kind:'Query',document:'query GetOrders { orders { id status } }',fields:refs('Query.orders','Order.id','Order.status')},
 {id:'products',name:'BrowseProducts',kind:'Query',document:'query BrowseProducts { products { id name price category { name } } }',fields:refs('Query.products','Product.id','Product.name','Product.price','Product.category','Category.name')},
 {id:'create-order',name:'CreateOrder',kind:'Mutation',document:'mutation CreateOrder { createOrder(customerId: "[redacted]") { id total status } }',fields:refs('Mutation.createOrder','Order.id','Order.total','Order.status')},
 {id:'create-customer',name:'CreateCustomer',kind:'Mutation',document:'mutation CreateCustomer { createCustomer(name: "[redacted]") { id name } }',fields:refs('Mutation.createCustomer','Customer.id','Customer.name')},
 {id:'search',name:'Анонимная операция',kind:'Query',document:'{ search(term: "[redacted]") { product { id name } customer { id } } }',fields:refs('Query.search','SearchResult.product','Product.id','Product.name','SearchResult.customer','Customer.id')},
 {id:'update-order',name:'UpdateOrder',kind:'Mutation',document:'mutation UpdateOrder { updateOrder(id: "[redacted]") { id status } }',fields:refs('Mutation.updateOrder','Order.id','Order.status')},
 {id:'invoice',name:'GetInvoice',kind:'Query',document:'query GetInvoice { invoice(id: "[redacted]") { id amount paid } }',fields:refs('Query.invoice','Invoice.id','Invoice.amount','Invoice.paid')}
];
const operations:Operation[]=snapshots.flatMap(s=>spec.filter(o=>s.serviceId==='billing'?o.id==='invoice':o.id!=='invoice').map(o=>({...o,id:`${s.id}:${o.id}`,snapshotId:s.id,fields:o.fields.filter(f=>s.types.some(t=>t.name===f.type&&t.fields.some(x=>x.name===f.field)))})));
const observations:Observation[]=[];
function generate(runId:string,count:number){const run=runs.find(r=>r.id===runId)!;const candidates=operations.filter(o=>o.snapshotId===run.snapshotId);for(let i=0;i<count;i++){const op=candidates[(i*7+Math.floor(i/8))%candidates.length];const httpStatus=i%23===0?500:i%17===0?404:200;const graphqlErrors=i%13===0?[{message:'Field resolution failed',path:'order.items',line:1,column:12}]:[];observations.push({id:`${runId}-${String(i+1).padStart(3,'0')}`,runId,operationId:op.id,at:new Date(Date.parse(run.startedAt)+i*17000).toISOString(),httpStatus,graphqlErrors,durationMs:i%19===0?1800+i:55+(i*37)%390,analyzerError:i%29===0?'Документ не удалось проанализировать':null,hasData:httpStatus===200&&i%31!==0,safeDocument:op.document})}}
generate('reg13',112);generate('reg12',86);generate('smoke',18);generate('billing-run',12);
export const initialStore:Store={services,snapshots,runs,operations,observations};
