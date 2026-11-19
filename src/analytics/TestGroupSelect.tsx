import {Select} from '../components/Select';
import type {ExecutionQuery} from '../api/testCoverage';
import type {GroupDimension} from '../api/testGroups';
import {analyticsError} from './runAnalyticsModel';
import {selectedGroupValue,withTestGroup} from './testCoverageModel';
export function TestGroupSelect({dimension,query,resource,onChange}:{dimension:GroupDimension;query:ExecutionQuery;resource:{data?:string[];loading:boolean;error?:Error;retry:()=>void};onChange:(query:ExecutionQuery)=>void}){
 const team=dimension==='team',value=selectedGroupValue(query,dimension),label=team?'Команда':'Набор тестов';
 const keys=resource.data??[],selected=team?query.teamKey:query.suiteKey;
 const options=selected&&!keys.includes(selected)?[selected,...keys]:keys;
 return <div className="test-group-filter"><Select label={label} value={value} options={[{value:'',label:team?'Все команды':'Все наборы'},...options.map(key=>({value:`key:${key}`,label:key})),{value:'unassigned',label:'Без группы'}]} onChange={value=>onChange(withTestGroup(query,dimension,value))}/>{resource.loading&&<small role="status">{team?'Загружаем команды…':'Загружаем наборы…'}</small>}{resource.error&&<small role="alert">{analyticsError(resource.error)} <button type="button" onClick={resource.retry}>Повторить {team?'команды':'наборы'}</button></small>}{resource.data&&!resource.data.length&&<small>{team?'Нет маркированных команд':'Нет маркированных наборов'}</small>}</div>;
}
