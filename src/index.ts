import { GraphQLResolveInfo, SelectionNode, DirectiveNode, FragmentDefinitionNode } from 'graphql'

// API

export interface GraphqlFieldsOptions {
  /** List of fields that will be (deep) excluded from tree */
  excludedFields?: string[]
}

/**
 * Parsed fields with mongoDB relations convention
 */
export interface FieldsObject {
  [field: string]: 1 | FieldsObject
}

export const defaultGraphqlFieldsOptions: Required<GraphqlFieldsOptions> = {
  excludedFields: [],
}

function graphqlFields(
  info: GraphQLResolveInfo,
  obj: FieldsObject = {},
  options?: GraphqlFieldsOptions,
) {
  const fields = info.fieldNodes // add || info.fieldsAST or it's depreciated ??

  const opts: Required<GraphqlFieldsOptions> = {
    ...defaultGraphqlFieldsOptions,
    ...options,
  }

  return fields.reduce((o, ast) => flattenAST(ast, info, o, opts), obj)
}

export default graphqlFields

// Lib

function getSelections(ast: SelectionNode | FragmentDefinitionNode) {
  if (
    'selectionSet' in ast &&
    ast.selectionSet &&
    ast.selectionSet.selections &&
    ast.selectionSet.selections.length > 0
  ) {
    return ast.selectionSet.selections
  }

  return []
}

function getDirectiveValue(directive: DirectiveNode, info: GraphQLResolveInfo) {
  // only arg on an include or skip directive is "if"
  const arg = directive.arguments && directive.arguments[0]

  if (arg) {
    if (arg.value.kind !== 'Variable') {
      //  skipping weird values
      if (
        arg.value.kind === 'NullValue' ||
        arg.value.kind === 'ListValue' ||
        arg.value.kind === 'ObjectValue'
      ) {
        return false
      }

      return !!arg.value.value
    } else {
      return info.variableValues[arg.value.name.value]
    }
  }

  return false
}

function getDirectiveResults(
  ast: SelectionNode | FragmentDefinitionNode,
  info: GraphQLResolveInfo,
) {
  const directiveResult = {
    shouldInclude: true,
    shouldSkip: false,
  }

  return (ast.directives || []).reduce((result, directive) => {
    switch (directive.name.value) {
      case 'include':
        return { ...result, shouldInclude: getDirectiveValue(directive, info) }
      case 'skip':
        return { ...result, shouldSkip: getDirectiveValue(directive, info) }
      default:
        return result
    }
  }, directiveResult)
}

function flattenAST(
  ast: SelectionNode | FragmentDefinitionNode,
  info: GraphQLResolveInfo,
  obj: FieldsObject = {},
  options: Required<GraphqlFieldsOptions>,
): FieldsObject {
  return getSelections(ast).reduce((flattened, selection) => {
    // field/fragment is not included if either the @skip condition is true or the @include condition is false
    // https://facebook.github.io/graphql/draft/#sec--include
    if (selection.directives && selection.directives.length) {
      const { shouldInclude, shouldSkip } = getDirectiveResults(selection, info)
      if (shouldSkip || !shouldInclude) {
        return flattened
      }
    }

    if (selection.kind === 'Field') {
      //  respect exclude list
      const name = selection.name.value
      if (options.excludedFields.indexOf(name) !== -1) {
        return flattened
      }

      // no nested selectionSet means it's plain field and we can assign 1
      const selections = getSelections(selection)

      if (selections.length === 0) {
        flattened[name] = 1
        return flattened
      }

      // 1 means it's plain field selection and those cannot have nested fields selection
      const flattenedField = flattened[name]

      if (flattenedField === 1) {
        flattened[name] = 1
        return flattened
      }

      const nested = flattenAST(selection, info, flattenedField, options)

      // there was nested selection but it was skipped
      if (Object.keys(nested).length === 0) {
        return flattened
      }

      flattened[name] = {
        ...flattenedField,
        ...flattenAST(selection, info, flattenedField, options),
      }

      return flattened
    }

    if (selection.kind === 'InlineFragment') {
      return flattenAST(selection, info, flattened, options)
    }

    if (selection.kind === 'FragmentSpread') {
      const fragmentName = selection.name.value
      const fragment = info.fragments[fragmentName]

      return flattenAST(fragment, info, flattened, options)
    }

    // noop
    return flattened
  }, obj)
}
