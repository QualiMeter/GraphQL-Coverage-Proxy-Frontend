import type {RequestOut,RequestDetail} from '../api/runAnalytics';
export const pathSdl=`
 interface Node { id: ID!, price: Float }
 type Product implements Node { id: ID!, price: Float, related: Product }
 type User implements Node { id: ID!, price: Float, favorites: [Product!]! }
 type Order { price: Float, items: [OrderItem!]! }
 type OrderItem { product: Product! }
 union SearchResult = Product | User
 type Query { product(id: ID): Product, viewer: User, orders: [Order!]!, node: Node, search: SearchResult }
`;
export const productPrice=[{typeName:'Query',fieldName:'product'},{typeName:'Product',fieldName:'price'}];
export const candidate=(id:string):RequestOut=>({id,runId:'run',operationName:null,operationType:'query',httpMethod:'POST',httpStatus:200,analysisStatus:'success',responseHasData:true,graphqlHasErrors:false,durationMs:1,errorCode:null,createdAt:'2026-11-18T00:00:00Z'});
export const requestDetail=(id:string,document='query { product { price } }'):RequestDetail=>({...candidate(id),countedInCoverage:true,selectedFields:[],safeGraphqlDocument:document,documentAvailability:'available'});
