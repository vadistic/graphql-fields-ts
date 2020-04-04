# graphql-fields-ts

> TypeScript fork of [`robrichard/graphql-fields`](https://github.com/robrichard/graphql-fields). Turns GraphQLResolveInfo into a map of the requested fields

- Fork in typescript
- Assign `1` on leaf (insted of empty object)
- Modified behaviour on fields whose `selectionSet` was entirely skipped - those kays are also skipped
- Does not support fields arguments feature
- CJS & ESM builds (via `tsdx`)

## ORIGINAL README

Turns GraphQLResolveInfo into a map of the requested fields. Flattens all fragments and duplicated fields into a neat object to easily see which fields were requested at any level. Takes into account any `@include` or `@skip` directives, excluding fields/fragments which are `@include(if: $false)` or `@skip(if: $true)`.

## Usage

Schema Type definition

```javascript
const graphqlFields = require('graphql-fields');
const graphql = require('graphql')

const UserType = new graphql.GraphQLObjectType({
    name: 'User',
    fields: {
        profile: {type: new graphql.GraphQLObjectType({
          name: 'Profile',
          fields: {
            firstName: {type: graphql.GraphQLString},
            lastName: {type: graphql.GraphQLString},
            middleName: {type: graphql.GraphQLString},
            nickName: {type: graphql.GraphQLString},
            maidenName: {type: graphql.GraphQLString}
          }
        }),
        email: {type: graphql.GraphQLString},
        id: {type: graphql.GraphQLID}
    }
});

module.exports = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: 'Query',
        fields: () =>
            Object.assign({
                user: {
                    type: UserType,
                    resolve(root, args, context, info) {
                        console.log(
                            JSON.stringify(graphqlFields(info), null, 2)
                        );
                        ...
                    }
                }
            })
    })
})
```

Query

```graphql
{
  user {
    ...A
    profile {
      ...B
      firstName
    }
  }
}

fragment A on User {
  ...C
  id,
  profile {
    lastName
  }
}

Fragment B on Profile {
  firstName
  nickName @skip(if: true)
}

Fragment C on User {
  email,
  profile {
    middleName
    maidenName @include(if: false)
  }
}
```

will log

```json
{
  "profile": {
    "firstName": {},
    "lastName": {},
    "middleName": {}
  },
  "email": {},
  "id": {}
}
```

### Exclude specific fields

Most of the time we don't need `__typename` to be sent to backend/rest api, we can exclude `__typename` using this:

```javascript
const graphqlFields = require('graphql-fields')
const fieldsWithoutTypeName = graphqlFields(info, {}, { excludedFields: ['__typename'] })
```

## Why

An underlying REST api may only return fields based on query params.

```graphql
{
  user {
    profile {
      firstName
    }
    id
  }
}
```

should request /api/user?fields=profile,id

while

```graphql
{
  user {
    email
  }
}
```

should request /api/user?fields=email

Implement your resolve method like so:

```
resolve(root, args, context, info) {
    const topLevelFields = Object.keys(graphqlFields(info));
    return fetch(`/api/user?fields=${topLevelFields.join(',')}`);
}
```

## Tests

```
npm test
```
