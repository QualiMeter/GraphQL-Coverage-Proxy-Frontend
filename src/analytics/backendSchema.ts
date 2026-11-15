import type {CoverageGraph, RootOperation, SchemaOut} from '../api/schemas';
import {fieldId, type SchemaType} from '../model';

export type SnapshotOption = {id: string; name: string; source: string; createdAt: string};

export function snapshotOption(snapshot: SchemaOut): SnapshotOption {
  return {
    id: snapshot.id,
    name: snapshot.displayName?.trim() || `Снимок ${snapshot.schemaHash.slice(0, 8)}`,
    source: snapshot.source,
    createdAt: snapshot.createdAt,
  };
}

const rootOperations: readonly RootOperation[] = ['query', 'mutation', 'subscription'];

export function schemaGraphTypes(graph: CoverageGraph): SchemaType<null>[] {
  const names = new Set(graph.types.map(type => type.name));
  const relations = new Map(graph.relations
    .filter(relation => names.has(relation.toType))
    .map(relation => [fieldId(relation.fromType, relation.field), relation]));
  return graph.types.map(type => {
    const operations = rootOperations.filter(role =>
      graph.rootTypes?.[role] === type.name || type.rootOperations?.includes(role));
    return {
      name: type.name,
      kind: type.kind,
      description: type.description,
      role: operations[0],
      rootOperations: operations,
      totalFields: type.totalFields,
      coveredFields: null,
      coveragePercent: null,
      fields: type.fields.map(field => {
        const relation = relations.get(fieldId(type.name, field.name));
        return {
          name: field.name,
          returnType: field.returnType,
          targetType: relation?.toType ?? null,
          relationId: relation?.id,
          deprecated: field.deprecated,
          description: field.description,
          deprecationReason: field.deprecationReason,
          args: field.args,
          covered: null,
          hits: null,
        };
      }),
    };
  });
}
