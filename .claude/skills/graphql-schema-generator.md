---
name: graphql-schema-generator
description: Generates GraphQL schemas with type definitions, resolvers, queries, mutations, and subscriptions. Use when building GraphQL APIs.
---

# GraphQL Schema Generator Skill

Expert at creating GraphQL schemas with proper types, resolvers, and best practices.

## When to Activate

- "create GraphQL schema for [entity]"
- "generate GraphQL API"
- "build GraphQL types and resolvers"

## Complete GraphQL Structure

```typescript
// schema/user.schema.ts
import { gql } from 'apollo-server-express';

export const userTypeDefs = gql`
  type User {
    id: ID!
    email: String!
    name: String!
    role: UserRole!
    posts: [Post!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum UserRole {
    USER
    ADMIN
    MODERATOR
  }

  input CreateUserInput {
    email: String!
    name: String!
    password: String!
    role: UserRole = USER
  }

  input UpdateUserInput {
    email: String
    name: String
    password: String
    role: UserRole
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type Query {
    user(id: ID!): User
    users(
      first: Int = 10
      after: String
      search: String
    ): UserConnection!
    me: User
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!
  }

  type Subscription {
    userCreated: User!
    userUpdated(id: ID!): User!
  }
`;

// resolvers/user.resolvers.ts
import { UserInputError, AuthenticationError } from 'apollo-server-express';
import { UserService } from '../services/user.service';
import { pubsub } from '../pubsub';

const USER_CREATED = 'USER_CREATED';
const USER_UPDATED = 'USER_UPDATED';

export const userResolvers = {
  Query: {
    user: async (_parent, { id }, { services, user }) => {
      if (!user) {
        throw new AuthenticationError('Not authenticated');
      }

      return await services.user.findById(id);
    },

    users: async (_parent, { first, after, search }, { services, user }) => {
      if (!user) {
        throw new AuthenticationError('Not authenticated');
      }

      const result = await services.user.findAll({
        first,
        after,
        search,
      });

      return {
        edges: result.users.map(user => ({
          node: user,
          cursor: Buffer.from(user.id.toString()).toString('base64'),
        })),
        pageInfo: {
          hasNextPage: result.hasNextPage,
          endCursor: result.endCursor,
        },
        totalCount: result.totalCount,
      };
    },

    me: async (_parent, _args, { user }) => {
      if (!user) {
        throw new AuthenticationError('Not authenticated');
      }

      return user;
    },
  },

  Mutation: {
    createUser: async (_parent, { input }, { services }) => {
      const user = await services.user.create(input);

      // Publish subscription event
      pubsub.publish(USER_CREATED, { userCreated: user });

      return user;
    },

    updateUser: async (_parent, { id, input }, { services, user }) => {
      if (!user) {
        throw new AuthenticationError('Not authenticated');
      }

      if (user.id !== id && user.role !== 'ADMIN') {
        throw new AuthenticationError('Not authorized');
      }

      const updatedUser = await services.user.update(id, input);

      if (!updatedUser) {
        throw new UserInputError('User not found');
      }

      // Publish subscription event
      pubsub.publish(USER_UPDATED, {
        userUpdated: updatedUser,
        id,
      });

      return updatedUser;
    },

    deleteUser: async (_parent, { id }, { services, user }) => {
      if (!user || user.role !== 'ADMIN') {
        throw new AuthenticationError('Admin access required');
      }

      const success = await services.user.delete(id);

      if (!success) {
        throw new UserInputError('User not found');
      }

      return true;
    },
  },

  Subscription: {
    userCreated: {
      subscribe: () => pubsub.asyncIterator([USER_CREATED]),
    },

    userUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([USER_UPDATED]),
        (payload, variables) => {
          return payload.id === variables.id;
        }
      ),
    },
  },

  User: {
    // Field resolver for nested data
    posts: async (parent, _args, { services }) => {
      return await services.post.findByAuthorId(parent.id);
    },
  },
};
```

## DataLoader Pattern

```typescript
// dataloaders/user.dataloader.ts
import DataLoader from 'dataloader';
import { UserService } from '../services/user.service';

export function createUserLoader(userService: UserService) {
  return new DataLoader(async (ids: readonly string[]) => {
    const users = await userService.findByIds([...ids]);

    const userMap = new Map(users.map(user => [user.id, user]));

    return ids.map(id => userMap.get(id) || null);
  });
}

// Use in context
export const createContext = ({ req }) => {
  const userService = new UserService();

  return {
    user: req.user,
    services: {
      user: userService,
    },
    loaders: {
      user: createUserLoader(userService),
    },
  };
};
```

## Best Practices

- Use clear, descriptive type names
- Implement pagination (Connection pattern)
- Add input validation
- Use enums for fixed values
- Implement authentication/authorization
- Use DataLoaders to prevent N+1 queries
- Add proper error handling
- Document schema with descriptions
- Version your API
- Use subscriptions for real-time data
- Implement field-level resolvers
- Cache responses when appropriate

## Output Checklist

- ✅ Type definitions created
- ✅ Resolvers implemented
- ✅ Queries/Mutations/Subscriptions
- ✅ DataLoaders setup
- ✅ Authentication added
- ✅ Error handling
- 📝 Usage examples
