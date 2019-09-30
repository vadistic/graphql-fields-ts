import {
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLList,
  graphql,
  buildSchema,
} from 'graphql'
import graphqlFields from '../src'

describe('graphqlFields', () => {
  it('should flatten fragments', async () => {
    let info = {} as GraphQLResolveInfo

    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          viewer: {
            type: new GraphQLObjectType({
              name: 'Viewer',
              fields: {
                users: {
                  args: {
                    userId: { type: GraphQLString },
                    first: { type: GraphQLInt },
                    includeInactive: { type: GraphQLBoolean },
                  },
                  type: new GraphQLObjectType({
                    name: 'UserConnection',
                    fields: {
                      pageInfo: {
                        type: new GraphQLObjectType({
                          name: 'PageInfo',
                          fields: {
                            totalResults: { type: GraphQLInt },
                          },
                        }),
                      },
                      edges: {
                        type: new GraphQLList(
                          new GraphQLObjectType({
                            name: 'UserEdge',
                            fields: {
                              cursor: { type: GraphQLString },
                              node: {
                                type: new GraphQLObjectType({
                                  name: 'User',
                                  fields: {
                                    addressBook: {
                                      type: new GraphQLObjectType({
                                        name: 'AddressBook',
                                        fields: {
                                          apiType: { type: GraphQLString },
                                        },
                                      }),
                                    },
                                    profile: {
                                      type: new GraphQLObjectType({
                                        name: 'Profile',
                                        fields: {
                                          displayName: { type: GraphQLString },
                                          email: { type: GraphQLString },
                                        },
                                      }),
                                    },
                                    proProfile: {
                                      type: new GraphQLObjectType({
                                        name: 'ProProfile',
                                        fields: {
                                          apiType: { type: GraphQLString },
                                        },
                                      }),
                                    },
                                  },
                                }),
                              },
                            },
                          }),
                        ),
                      },
                    },
                  }),
                },
              },
            }),
            resolve(root, args, context, i) {
              info = i
              return {}
            },
          },
        },
      }),
    })

    const query = `
        query UsersRoute {
          viewer {
            users(userId:"123",first:25,includeInactive:true) @skip(if:false) {
              ...A
              ...D
                pageInfo {
                totalResults
              }

            }
          }
        }

        fragment A on UserConnection {
          edges {
            node {
              addressBook {
                apiType
              }
            }
          }
          ...B
        }
        fragment B on UserConnection {
          ...C
          edges {
            cursor
          }
        }

        fragment C on UserConnection {
          edges {
            cursor,
            node {
                profile {
                    displayName,
                    email
                }
            }
          }
        }
        fragment D on UserConnection {
          edges {
            node {
              proProfile {
                apiType
              }
            }
          }
          ...B
        }
        `

    await graphql(schema, query, null, {})

    const expected = {
      users: {
        pageInfo: {
          totalResults: {},
        },
        edges: {
          cursor: {},
          node: {
            addressBook: {
              apiType: {},
            },
            proProfile: {
              apiType: {},
            },
            profile: {
              displayName: {},
              email: {},
            },
          },
        },
      },
    }

    const fields = graphqlFields(info)

    expect(fields).toStrictEqual(expected)
  })

  describe('should respect include/skip directives when generating the field map', () => {
    let info = {} as GraphQLResolveInfo

    const schemaString = /* GraphQL */ `
      type Pet {
        name: String!
      }
      type Person {
        name: String!
        age: Int!
        pets: [Pet!]
      }
      type Query {
        person: Person!
      }
    `

    const schema = buildSchema(schemaString)

    const root = {
      person(args: any, ctx: any, i: any) {
        info = i

        return {
          name: 'john doe',
          age: 42,
        }
      },
    }

    it('does not include fields with a false include directive', async () => {
      const query = /* GraphQL */ `
        query Query($shouldInclude: Boolean!) {
          person {
            name @include(if: $shouldInclude)
            age @include(if: false) @skip(if: false)
            pets {
              name
            }
          }
        }
      `

      await graphql(schema, query, root, {}, { ['shouldInclude']: false })

      const expected = {
        pets: {
          name: {},
        },
      }

      const fields = graphqlFields(info)

      expect(fields).toStrictEqual(expected)
    })

    it('does not include fields with a true skip directive', async () => {
      const query = /* GraphQL */ `
        query Query($shouldSkip: Boolean!) {
          person {
            name @skip(if: $shouldSkip)
            age
            pets {
              name @skip(if: true) @include(if: true)
            }
          }
        }
      `

      await graphql(schema, query, root, {}, { ['shouldSkip']: true })

      const expected = {
        age: {},
        pets: {},
      }

      const fields = graphqlFields(info)

      expect(fields).toEqual(expected)
    })
  })

  describe('excluded fields', () => {
    let info = {} as GraphQLResolveInfo

    const schemaString = /* GraphQL */ `
      type Person {
        name: String!
        age: Int!
      }
      type Query {
        person: Person!
      }
    `

    const schema = buildSchema(schemaString)

    const root = {
      person(args: any, ctx: any, i: any) {
        info = i
        return {
          name: 'john doe',
          age: 42,
        }
      },
    }

    const query = /* GraphQL */ `
      {
        person {
          name
          age
          __typename
        }
      }
    `

    it('Should exclude fields', async () => {
      await graphql(schema, query, root, {})

      const expected = {
        name: {},
      }

      const fields = graphqlFields(info, {}, { excludedFields: ['__typename', 'age'] })

      expect(fields).toEqual(expected)
    })

    it('Should not exclude fields if not specified in options', async () => {
      await graphql(schema, query, root, {})

      const expected = {
        name: {},
        age: {},
        __typename: {},
      }

      const fields = graphqlFields(info)

      expect(fields).toEqual(expected)
    })
  })
})
