import {afterEach, describe, expect, it, vi} from 'vitest';
import {getFilteredJournal, getJournal, getOperations, getRequestDetail, getRunStats, type OperationOut} from './runAnalytics';
import {analysisErrors, analyticsError, matchesOperation, mayReadJournal, millis} from '../analytics/runAnalyticsModel';

const runId='00000000-0000-4000-8000-000000000040';
const row={
  id:'req',runId,operationName:'GetUsers',operationType:'query',operationKey:'signature',httpMethod:'POST',
  httpStatus:200,analysisStatus:'success',responseHasData:true,graphqlHasErrors:false,durationMs:null,errorCode:null,createdAt:'2026-11-16T10:00:00Z',
};
const operation:OperationOut={
  operationKey:'signature',operationName:'GetUsers',operationType:'query',requestCount:4,countedRequestCount:2,
  httpErrorCount:1,graphqlErrorCount:1,avgDurationMs:null,lastSeenAt:row.createdAt,fields:[{typeName:'Query',fieldName:'users',hits:2}],
};
const zeroStats={
  totalFields:0,coveredFields:0,coveragePercent:0,
  totalRequests:0,countedRequests:0,uniqueOperations:0,queryRequests:0,mutationRequests:0,subscriptionRequests:0,
  httpErrorCount:0,graphqlErrorCount:0,avgDurationMs:null,p95DurationMs:null,
  analysisStatusCounts:{parseError:0,validationError:0,internalError:0,success:0,unsupported:0},requestTimeline:[],
};

afterEach(()=>vi.unstubAllGlobals());

describe('backend run analytics',()=>{
  it('uses backend aggregates and combines operation filters',async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(Response.json([operation])).mockResolvedValueOnce(Response.json(zeroStats));
    vi.stubGlobal('fetch',fetch);
    const operations=await getOperations(runId);
    expect(operations).toEqual([operation]);
    expect(matchesOperation(operations[0],' getusers ','query','Query.users',true)).toBe(true);
    expect(matchesOperation(operations[0],'getusers','mutation','Query.users',true)).toBe(false);
    expect(matchesOperation(operations[0],'getusers','query','Other.users',true)).toBe(false);
    const result=await getRunStats(runId);
    expect(result.totalRequests).toBe(0);
    expect(millis(result.p95DurationMs)).toBe('—');
    expect(analysisErrors(result)).toBe(0);
    expect(analysisErrors({...result,analysisStatusCounts:{...zeroStats.analysisStatusCounts,unsupported:3,validationError:2}})).toBe(2);
    expect(fetch.mock.calls.map(call=>call[0])).toEqual(['/api/runs/'+runId+'/operations','/api/runs/'+runId+'/stats']);
  });

  it('preserves operation identity and carries field, error, date and sort filters into paginated requests', async()=>{
    const fetch=vi.fn().mockResolvedValue(Response.json([row],{headers:{'X-Total-Count':'80'}}));
    vi.stubGlobal('fetch',fetch);
    const query={operationKey:operation.operationKey,operationName:'Get Users',operationType:'query',typeName:'Query',fieldName:'users',
      graphqlHasErrors:false,analysisStatus:'success',from:row.createdAt,sortBy:'durationMs',sortOrder:'asc'} as const;
    const {signal}=new AbortController();
    expect(await getJournal(runId,query,50,signal)).toEqual({rows:[row],more:true});
    const [path,options]=fetch.mock.calls[0];
    expect(Object.fromEntries(new URL(path,'https://example.test').searchParams)).toEqual({
      ...query,graphqlHasErrors:'false',offset:'50',limit:'50',
    });
    expect(options).toMatchObject({signal,credentials:'same-origin',method:'GET'});
  });

  it('combines HTTP status classes in server sort order without collecting unrelated traffic', async()=>{
    const fetch=vi.fn((path:string)=>{
      const params=new URL(path,'https://example.test').searchParams;
      const status=params.get('httpStatusClass')==='4'?404:500;
      return Promise.resolve(Response.json([{...row,id:String(status),httpStatus:status,durationMs:status}],{headers:{'X-Total-Count':'1'}}));
    });
    vi.stubGlobal('fetch',fetch);
    const data=await getFilteredJournal(runId,{sortBy:'durationMs',operationKey:'signature'},0,'http');
    expect(data.rows.map(request=>request.httpStatus)).toEqual([500,404]);
    expect(data.more).toBe(false);
    expect(fetch.mock.calls.map(([path])=>path)).toEqual([
      expect.stringContaining('operationKey=signature&httpStatusClass=4'),
      expect.stringContaining('operationKey=signature&httpStatusClass=5'),
    ]);
  });

  it('returns safe detail and rejects observations from a different run',async()=>{
    const detail={...row,countedInCoverage:true,selectedFields:[{typeName:'Query',fieldName:'users',returnType:'[User!]!'}],
      safeGraphqlDocument:'query GetUsers { users { id } }',documentAvailability:'redacted'};
    const fetch=vi.fn().mockResolvedValueOnce(Response.json(detail)).mockResolvedValueOnce(Response.json({...detail,runId:'old-run'}));
    vi.stubGlobal('fetch',fetch);
    await expect(getRequestDetail(runId,row.id)).resolves.toEqual(detail);
    await expect(getRequestDetail(runId,row.id)).rejects.toMatchObject({kind:'invalid-response'});
  });

  it.each([[401,'Войдите'],[403,'Недостаточно прав'],[404,'доступ к ним ограничен'],[503,'HTTP 503']])(
    'surfaces HTTP %s with no mock fallback',async(status,message)=>{
      vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status})));
      const error=await getJournal(runId,{sortBy:'createdAt'},0).catch((error:Error)=>error);
      expect(error).toMatchObject({kind:'http',status});
      expect(analyticsError(error as Error)).toContain(message);
    },
  );

  it('gates the request journal by role while the server enforces service ACL',()=>{
    expect([undefined,'viewer','analyst','operator','admin'].map(mayReadJournal)).toEqual([false,false,true,true,true]);
  });
});
