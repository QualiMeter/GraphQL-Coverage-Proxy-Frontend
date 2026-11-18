import {useId, useMemo, useState} from 'react';
import {Select} from '../components/Select';
import type {GraphType} from '../model';
import {
  coverageRows, defaultAdvancedFilters, filterCoverageRows,
  type AdvancedFilters, type CoverageFilter, type CoverageSort,
} from './coverageTableFilters';
import './schemaCoverageTable.css';
import {useExportFilterState,usePublishExport} from './ExportWorkspace';
import {coverageExportFilters} from './exportFilters';

const advancedControls = [
  {key: 'hits', label: 'Hits', options: [
    {value: 'all', label: 'Все'}, {value: 'zero', label: '0'},
    {value: 'low', label: '1–5'}, {value: 'medium', label: '6–20'}, {value: 'high', label: 'Более 20'},
  ]},
  {key: 'returns', label: 'Возвращаемое значение', options: [
    {value: 'all', label: 'Все'}, {value: 'scalar', label: 'Скаляр'},
    {value: 'object', label: 'Объект'}, {value: 'list', label: 'Список'},
  ]},
  {key: 'deprecated', label: 'Deprecated', options: [
    {value: 'all', label: 'Все'}, {value: 'yes', label: 'Устаревшие'}, {value: 'no', label: 'Не устаревшие'},
  ]},
] as const;

type Props = {
  types: GraphType[];
  coverageAvailable?: boolean;
  sdl?: string;
  query: string;
  filter: CoverageFilter;
  sort: string;
  selectedField: string | null;
  onQuery: (query: string) => void;
  onFilter: (filter: CoverageFilter) => void;
  onSort: (sort: CoverageSort) => void;
  onField: (type: string, field: string) => void;
};

const fieldCount = new Intl.NumberFormat('ru-RU');

export function SchemaCoverageTable({
  types, coverageAvailable = true, sdl, query, filter, sort, selectedField, onQuery, onFilter, onSort, onField,
}: Props) {
  const advancedId = useId();
  const [type, setType] = useExportFilterState('coverage','type','');
  const [advanced, setAdvanced] = useExportFilterState('coverage','advanced',defaultAdvancedFilters);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const fields = useMemo(() => coverageRows(types, sdl), [types, sdl]);
  const typeOptions = useMemo(() => [
    {value: '', label: 'Все типы'},
    ...types.map(({name}) => name).sort((a, b) => a.localeCompare(b)).map(name => ({value: name, label: name})),
  ], [types]);
  const search = query.trim().toLowerCase();
  const order = sort === 'type-field' || coverageAvailable && (sort === 'hits-asc' || sort === 'hits') ? sort : 'date';
  const hasDeprecated = fields.some(({field}) => typeof field.deprecated === 'boolean');
  const controls = advancedControls.filter(control => (control.key !== 'deprecated' || hasDeprecated) && (control.key !== 'hits' || coverageAvailable));
  usePublishExport('coverage',coverageExportFilters(query,coverageAvailable?filter:'all',order,type,{...advanced,hits:coverageAvailable?advanced.hits:'all',deprecated:hasDeprecated?advanced.deprecated:'all'}));
  const activeAdvanced = controls.filter(control => advanced[control.key] !== 'all');
  const visibleFields = useMemo(() => filterCoverageRows(fields, {
    ...advanced, hits: coverageAvailable ? advanced.hits : 'all', deprecated: hasDeprecated ? advanced.deprecated : 'all',
    type, search, coverage: coverageAvailable ? filter : 'all',
  }, order), [fields, advanced, coverageAvailable, hasDeprecated, type, search, filter, order]);

  function updateAdvanced<Key extends keyof AdvancedFilters>(key: Key, value: AdvancedFilters[Key]) {
    setAdvanced(previous => ({...previous, [key]: value}));
  }

  const hasFilters = Boolean(query || type) || filter !== 'all' || activeAdvanced.length > 0;
  const reset = () => {
    setType('');
    setAdvanced(defaultAdvancedFilters);
    onQuery('');
    onFilter('all');
    onSort('date');
  };

  return (
    <>
      <div className="panel-tools schema-table-tools">
        <div className="schema-table-primary">
          <label className="schema-table-search" data-active={Boolean(search)}>
            <span>Поиск по таблице</span>
            <input type="search" placeholder="Найти поле или тип" value={query} onChange={event => onQuery(event.target.value)}/>
          </label>
          {coverageAvailable && <Select
            label="Покрытие"
            value={filter}
            modified={filter !== 'all'}
            onChange={onFilter}
            options={[
              {value: 'all', label: 'Все поля'},
              {value: 'covered', label: 'Покрытые'},
              {value: 'uncovered', label: 'Не покрытые'},
            ]}
          />}
          <Select label="Тип схемы" value={type} options={typeOptions} modified={Boolean(type)} onChange={setType}/>
          <Select
            label="Сортировка"
            value={order}
            modified={order !== 'date'}
            onChange={onSort}
            options={[
              {value: 'date', label: 'По имени поля (А–Я)'},
              {value: 'type-field', label: 'По типу и полю'},
              ...(coverageAvailable ? [
                {value: 'hits-asc', label: 'Hits ↑ Возрастание'},
                {value: 'hits', label: 'Hits ↓ Убывание'},
              ] as const : []),
            ]}
          />
        </div>
        <div className="schema-table-actions">
          <button type="button" aria-expanded={advancedOpen} aria-controls={advancedId} onClick={() => setAdvancedOpen(!advancedOpen)}>
            Дополнительные фильтры <span aria-hidden="true">{advancedOpen ? '▴' : '▾'}</span>
          </button>
          <button type="button" onClick={reset} disabled={!hasFilters && order === 'date'}>Сбросить</button>
          <output className="schema-table-count" aria-label="Найдено полей">
            <strong>{fieldCount.format(visibleFields.length)}</strong> из {fieldCount.format(fields.length)} полей
          </output>
        </div>
        <div id={advancedId} className="schema-table-advanced" hidden={!advancedOpen}>
          {advancedOpen && controls.map(({key, label, options}) => (
            <Select key={key} label={label} value={advanced[key]} options={options}
              modified={advanced[key] !== 'all'} onChange={value => updateAdvanced(key, value)}/>
          ))}
        </div>
        {activeAdvanced.length > 0 && <div className="schema-table-conditions" role="group" aria-label="Активные дополнительные фильтры">
          {activeAdvanced.map(({key, label, options}) => {
            const selected = options.find(option => option.value === advanced[key])?.label;
            return <button key={key} type="button" aria-label={`Убрать фильтр: ${label}, ${selected}`} onClick={() => updateAdvanced(key, 'all')}>
              {label}: {selected} <span aria-hidden="true">×</span>
            </button>;
          })}
        </div>}
      </div>
      <div className="table-scroll schema-table-scroll">
        <table className="schema-coverage-table" aria-label={coverageAvailable ? "Покрытие полей схемы" : "Поля схемы"}>
          <colgroup>
            <col className="schema-table-type-col"/>
            <col className="schema-table-field-col"/>
            <col/>
            <col className="schema-table-hits-col"/>
            <col className="schema-table-status-col"/>
          </colgroup>
          <thead>
            <tr>
              <th scope="col" aria-sort={order === 'type-field' ? 'ascending' : undefined}>Тип</th>
              <th scope="col" aria-sort={order === 'date' ? 'ascending' : undefined}>Поле</th>
              <th scope="col">Возвращаемый тип</th>
              <th scope="col" className="schema-table-hits" aria-sort={order === 'hits-asc' ? 'ascending' : order === 'hits' ? 'descending' : undefined}>
                Hits {(order === 'hits' || order === 'hits-asc') && <span aria-hidden="true">{order === 'hits-asc' ? '↑' : '↓'}</span>}
              </th>
              <th scope="col">Покрытие</th>
            </tr>
          </thead>
          <tbody>
            {visibleFields.map(({type, field, id}) => {
              const selected = id === selectedField;
              return (
                <tr key={id} className={selected ? 'selected' : undefined} onClick={() => onField(type, field.name)}>
                  <td className="schema-table-type">{type}</td>
                  <td><button type="button" className="schema-table-field" aria-pressed={selected} onClick={event => {
                    event.stopPropagation();
                    onField(type, field.name);
                  }}>{field.name}</button></td>
                  <td><code>{field.returnType}</code></td>
                  <td className="schema-table-hits">{field.hits === null ? '—' : fieldCount.format(field.hits)}</td>
                  <td>{field.covered === null ? '—' : <span className={field.covered ? 'schema-table-status covered' : 'schema-table-status'}>
                    {field.covered ? 'Покрыто' : 'Не покрыто'}
                  </span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visibleFields.length && <p className="schema-table-empty">{fields.length
          ? 'Поля не найдены. Измените поиск или сбросьте фильтры.'
          : 'В выбранной схеме нет полей.'}</p>}
      </div>
    </>
  );
}
