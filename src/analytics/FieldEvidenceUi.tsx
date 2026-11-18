import {ApiError} from '../api/client';
import type {EvidenceState,FieldEvidencePage} from '../api/fieldEvidence';
import {analyticsError} from './runAnalyticsModel';
import './fieldEvidence.css';
export const evidenceLabels:Record<EvidenceState,string>={observed:'Наблюдалось',not_observed:'Не наблюдалось',indeterminate:'Неопределённо',unavailable:'Недостаточно данных'};
const descriptions:Record<EvidenceState,string>={observed:'Выбранный ключ достоверно присутствовал в ответе, включая значение null. Это не доказывает успешность resolver.',not_observed:'Доказано отсутствие ключа в соответствующем контексте ответа либо неприменимость ветки типа. Это не обязательно ошибка.',indeterminate:'Присутствие поля нельзя установить достоверно. Это не доказанное отсутствие.',unavailable:'Данные присутствия отсутствуют или непригодны. Это не доказанное отсутствие.'};
export function EvidenceBadge({state,note}:{state:EvidenceState|'loading'|'not_loaded';note?:string}){
 return <span className="evidence-badge" data-state={state} title={note??(state==='loading'?'Загружаем доказательства присутствия.':state==='not_loaded'?'Доказательства ещё не загружены.':descriptions[state])}>{state==='loading'?'Загрузка…':state==='not_loaded'?'Не загружено':evidenceLabels[state]}</span>;
}
export function EvidenceCounts({observed,notObserved,indeterminate,unavailable}:{observed:number;notObserved:number;indeterminate:number;unavailable:number}){
 return <dl className="evidence-counts" aria-label="Состояния присутствия поля в ответах">{([['observed',observed],['not_observed',notObserved],['indeterminate',indeterminate],['unavailable',unavailable]] as [EvidenceState,number][]).map(([state,count])=><div key={state}><dt><EvidenceBadge state={state}/></dt><dd>{count}</dd></div>)}</dl>;
}
export function EvidenceMeaning(){return <details className="evidence-meaning"><summary>Как понимать наличие поля</summary><p>Наблюдалось — выбранный ключ присутствовал в ответе, в том числе со значением null. Не наблюдалось — доказанное отсутствие в контексте ответа или неприменимость ветки типа.</p><p>Неопределённо и недостаточно данных не означают отсутствие. Эти свидетельства не определяют успешность resolver, корректность значения или успешность теста. Одно обращение даёт не более одного состояния для координаты, независимо от алиасов и размера массива.</p></details>}
export function EvidenceWarnings({page,scopeLabel}:{page:FieldEvidencePage;scopeLabel:string}){
 return <div className="evidence-warnings">{page.selectionUnavailableRequestCount>0&&<p>В области «{scopeLabel}» выбор полей недоступен для {page.selectionUnavailableRequestCount} из {page.requestCount} обращений. Их нельзя отнести к отсутствию выбранного поля.</p>}{page.evidenceUnavailableRequestCount>0&&<p>В области «{scopeLabel}» свидетельства полностью или частично недоступны для {page.evidenceUnavailableRequestCount} обращений. Этот счётчик относится к обращениям, а не к четырём состояниям одного поля.</p>}</div>;
}
export function EvidenceResourceStatus({loading,error,onRetry}:{loading:boolean;error?:Error;onRetry:()=>void}){
 return loading?<p role="status">Загружаем Field Evidence…</p>:error?<div className="evidence-error" role="alert"><p>{error instanceof ApiError&&error.status===422?'Некорректные параметры запроса Field Evidence (HTTP 422).':analyticsError(error)}</p><button type="button" onClick={onRetry}>Повторить чтение Evidence</button></div>:null;
}
