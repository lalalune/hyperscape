---
name: express-api-generator
description: Generates Express.js API routes with proper middleware, error handling, validation, and TypeScript support. Use when creating REST APIs or Express endpoints.
---

# Express.js API Generator Skill

Expert at creating well-structured Express.js APIs with TypeScript, proper error handling, and best practices.

## When to Activate

- "create Express API for [resource]"
- "generate REST endpoints for [feature]"
- "build Express routes for [entity]"
- "scaffold Express API"

## Complete API Structure

### 1. Router File

```typescript
// routes/users.routes.ts
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validate } from '../middleware/validation.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { createUserSchema, updateUserSchema } from '../schemas/user.schema';

const router = Router();
const userController = new UserController();

// GET /api/users - List all users
router.get(
  '/',
  authenticate,
  userController.getAll
);

// GET /api/users/:id - Get user by ID
router.get(
  '/:id',
  authenticate,
  userController.getById
);

// POST /api/users - Create new user
router.post(
  '/',
  validate(createUserSchema),
  userController.create
);

// PUT /api/users/:id - Update user
router.put(
  '/:id',
  authenticate,
  validate(updateUserSchema),
  userController.update
);

// DELETE /api/users/:id - Delete user
router.delete(
  '/:id',
  authenticate,
  userController.delete
);

export default router;
```

### 2. Controller

```typescript
// controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { CreateUserDTO, UpdateUserDTO } from '../dto/user.dto';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  getAll = asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 10, search } = req.query;

    const result = await this.userService.getAll({
      page: Number(page),
      limit: Number(limit),
      search: search as string,
    });

    res.status(200).json({
      success: true,
      data: result.users,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await this.userService.getById(id);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const userData: CreateUserDTO = req.body;

    const user = await this.userService.create(userData);

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully',
    });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userData: UpdateUserDTO = req.body;

    const user = await this.userService.update(id, userData);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    res.status(200).json({
      success: true,
      data: user,
      message: 'User updated successfully',
    });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await this.userService.delete(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  });
}
```

### 3. Service Layer

```typescript
// services/user.service.ts
import { User } from '../models/user.model';
import { CreateUserDTO, UpdateUserDTO } from '../dto/user.dto';
import { ApiError } from '../utils/ApiError';
import bcrypt from 'bcrypt';

interface GetAllOptions {
  page: number;
  limit: number;
  search?: string;
}

export class UserService {
  async getAll(options: GetAllOptions) {
    const { page, limit, search } = options;
    const skip = (page - 1) * limit;

    const query = search
      ? { $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ]}
      : {};

    const [users, total] = await Promise.all([
      User.find(query).skip(skip).limit(limit).select('-password'),
      User.countDocuments(query),
    ]);

    return { users, total, page, limit };
  }

  async getById(id: string) {
    const user = await User.findById(id).select('-password');
    return user;
  }

  async create(userData: CreateUserDTO) {
    const existingUser = await User.findOne({ email: userData.email });

    if (existingUser) {
      throw new ApiError(409, 'Email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const user = await User.create({
      ...userData,
      password: hashedPassword,
    });

    const userObject = user.toObject();
    delete userObject.password;

    return userObject;
  }

  async update(id: string, userData: UpdateUserDTO) {
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: userData },
      { new: true, runValidators: true }
    ).select('-password');

    return user;
  }

  async delete(id: string) {
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return true;
  }
}
```

### 4. Validation Schema

```typescript
// schemas/user.schema.ts
import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  role: Joi.string().valid('user', 'admin').default('user'),
});

export const updateUserSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  email: Joi.string().email(),
  password: Joi.string().min(8),
  role: Joi.string().valid('user', 'admin'),
}).min(1);
```

### 5. Middleware

```typescript
// middleware/validation.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ApiError } from '../utils/ApiError';

export const validate = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map(d => d.message).join(', ');
      throw new ApiError(400, message);
    }

    req.body = value;
    next();
  };
};
```

```typescript
// middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';

interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new ApiError(401, 'Authentication required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired token');
  }
};
```

### 6. Error Handler

```typescript
// utils/ApiError.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public errors: any[] = []
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// utils/asyncHandler.ts
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  console.error('Unexpected error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
};
```

## File Structure

```
src/
├── routes/
│   └── user.routes.ts
├── controllers/
│   └── user.controller.ts
├── services/
│   └── user.service.ts
├── models/
│   └── user.model.ts
├── dto/
│   └── user.dto.ts
├── schemas/
│   └── user.schema.ts
├── middleware/
│   ├── auth.middleware.ts
│   ├── validation.middleware.ts
│   └── errorHandler.ts
└── utils/
    ├── ApiError.ts
    └── asyncHandler.ts
```

## Best Practices

- ✅ Separate routes, controllers, and services
- ✅ Use TypeScript for type safety
- ✅ Implement proper error handling
- ✅ Validate input data
- ✅ Use async/await with error handling
- ✅ Implement authentication/authorization
- ✅ Return consistent response format
- ✅ Add pagination for list endpoints
- ✅ Use HTTP status codes correctly
- ✅ Handle edge cases
- ✅ Add request logging
- ✅ Implement rate limiting

## Output Checklist

- ✅ Routes file created
- ✅ Controller implemented
- ✅ Service layer added
- ✅ Validation schemas defined
- ✅ Middleware configured
- ✅ Error handling setup
- ✅ Tests created
- 📝 API documentation provided
